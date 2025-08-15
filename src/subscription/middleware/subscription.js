// subscription.js - Middleware robusto para verificação de assinatura
const SubscriptionModel = require('../models/subscription');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../models/audit');
const CacheService = require('../services/cache');

class SubscriptionMiddleware {
    /**
     * Middleware para verificar se usuário tem assinatura ativa
     * @param {Object} options - Opções do middleware
     * @returns {Function} - Middleware do Express
     */
    static requireActiveSubscription(options = {}) {
        const {
            allowTrial = false,
            requiredPlan = null,
            gracePeriodDays = 3,
            fallbackOnError = false
        } = options;

        return async (req, res, next) => {
            try {
                // Verificar se usuário está autenticado
                if (!req.user || !req.user.id) {
                    throw new AppError(
                        'Usuário não autenticado',
                        ERROR_TYPES.UNAUTHORIZED
                    );
                }

                const userId = req.user.id;
                const cacheKey = `subscription:active:${userId}`;
                
                // Tentar buscar no cache primeiro
                let subscription = await CacheService.get(cacheKey);
                
                if (!subscription) {
                    // Buscar no banco se não estiver em cache
                    subscription = await SubscriptionModel.findActiveByUserId(userId);
                    
                    if (subscription) {
                        // Cachear por 5 minutos
                        await CacheService.set(cacheKey, subscription, 300);
                    }
                }

                // Verificar se tem assinatura
                if (!subscription) {
                    await this.logAccessDenied(req, 'NO_SUBSCRIPTION');
                    
                    if (fallbackOnError) {
                        req.subscriptionStatus = { active: false, reason: 'no_subscription' };
                        return next();
                    }
                    
                    return this.sendSubscriptionRequired(res);
                }

                // Verificar status da assinatura
                const validationResult = await this.validateSubscription(
                    subscription, 
                    { allowTrial, requiredPlan, gracePeriodDays }
                );

                if (!validationResult.valid) {
                    await this.logAccessDenied(req, validationResult.reason, subscription);
                    
                    if (fallbackOnError) {
                        req.subscriptionStatus = {
                            active: false,
                            reason: validationResult.reason,
                            subscription
                        };
                        return next();
                    }
                    
                    return this.sendSubscriptionInvalid(res, validationResult);
                }

                // Anexar informações da assinatura ao request
                req.subscription = subscription;
                req.subscriptionStatus = {
                    active: true,
                    plan: subscription.plan,
                    expiresAt: subscription.expires_at,
                    features: this.getPlanFeatures(subscription.plan)
                };

                // Log de acesso autorizado
                await AuditModel.logEvent({
                    entityType: 'SUBSCRIPTION_ACCESS',
                    entityId: subscription.id,
                    action: 'ACCESS_GRANTED',
                    userId,
                    details: {
                        plan: subscription.plan,
                        endpoint: req.path,
                        method: req.method
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    severity: 'INFO'
                });

                next();

            } catch (error) {
                await this.logAccessError(req, error);
                
                if (fallbackOnError) {
                    req.subscriptionStatus = { 
                        active: false, 
                        reason: 'error',
                        error: error.message 
                    };
                    return next();
                }
                
                if (error instanceof AppError) {
                    return res.status(error.statusCode).json({
                        error: error.message,
                        type: error.type
                    });
                }
                
                return res.status(500).json({
                    error: 'Erro interno do servidor',
                    type: 'INTERNAL_ERROR'
                });
            }
        };
    }

    /**
     * Middleware para verificar recursos específicos do plano
     * @param {string|Array} requiredFeatures - Recursos necessários
     * @returns {Function} - Middleware do Express
     */
    static requireFeatures(requiredFeatures) {
        const features = Array.isArray(requiredFeatures) ? requiredFeatures : [requiredFeatures];
        
        return async (req, res, next) => {
            try {
                // Verificar se já passou pela verificação de assinatura
                if (!req.subscriptionStatus || !req.subscriptionStatus.active) {
                    throw new AppError(
                        'Assinatura ativa requerida',
                        ERROR_TYPES.FORBIDDEN
                    );
                }

                const userFeatures = req.subscriptionStatus.features || [];
                const missingFeatures = features.filter(feature => !userFeatures.includes(feature));

                if (missingFeatures.length > 0) {
                    await AuditModel.logEvent({
                        entityType: 'FEATURE_ACCESS',
                        entityId: req.subscription?.id,
                        action: 'ACCESS_DENIED_MISSING_FEATURES',
                        userId: req.user.id,
                        details: {
                            requiredFeatures: features,
                            userFeatures,
                            missingFeatures,
                            endpoint: req.path,
                            method: req.method
                        },
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        severity: 'WARN'
                    });

                    return res.status(403).json({
                        error: 'Recurso não disponível no seu plano',
                        type: 'FEATURE_NOT_AVAILABLE',
                        missingFeatures,
                        currentPlan: req.subscription?.plan,
                        upgradeRequired: true
                    });
                }

                next();

            } catch (error) {
                if (error instanceof AppError) {
                    return res.status(error.statusCode).json({
                        error: error.message,
                        type: error.type
                    });
                }
                
                return res.status(500).json({
                    error: 'Erro interno do servidor',
                    type: 'INTERNAL_ERROR'
                });
            }
        };
    }

    /**
     * Middleware para rate limiting baseado no plano
     * @param {Object} limits - Limites por plano
     * @returns {Function} - Middleware do Express
     */
    static planBasedRateLimit(limits = {}) {
        const defaultLimits = {
            free: { requests: 10, window: 60000 }, // 10 req/min
            premium: { requests: 100, window: 60000 }, // 100 req/min
            premium_anual: { requests: 200, window: 60000 } // 200 req/min
        };
        
        const finalLimits = { ...defaultLimits, ...limits };
        const userRequests = new Map();
        
        return async (req, res, next) => {
            try {
                const plan = req.subscription?.plan || 'free';
                const limit = finalLimits[plan] || finalLimits.free;
                const userId = req.user?.id;
                
                if (!userId) {
                    return next();
                }
                
                const key = `${userId}:${plan}`;
                const now = Date.now();
                const windowStart = now - limit.window;
                
                // Limpar requisições antigas
                if (userRequests.has(key)) {
                    const requests = userRequests.get(key).filter(time => time > windowStart);
                    userRequests.set(key, requests);
                }
                
                const currentRequests = userRequests.get(key) || [];
                
                if (currentRequests.length >= limit.requests) {
                    await AuditModel.logEvent({
                        entityType: 'RATE_LIMIT',
                        entityId: req.subscription?.id,
                        action: 'RATE_LIMIT_EXCEEDED',
                        userId,
                        details: {
                            plan,
                            currentRequests: currentRequests.length,
                            limit: limit.requests,
                            window: limit.window,
                            endpoint: req.path
                        },
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        severity: 'WARN'
                    });
                    
                    return res.status(429).json({
                        error: 'Limite de requisições excedido para o seu plano',
                        type: 'RATE_LIMIT_EXCEEDED',
                        plan,
                        limit: limit.requests,
                        window: limit.window,
                        retryAfter: Math.ceil(limit.window / 1000)
                    });
                }
                
                // Adicionar requisição atual
                currentRequests.push(now);
                userRequests.set(key, currentRequests);
                
                // Adicionar headers de rate limit
                res.set({
                    'X-RateLimit-Limit': limit.requests,
                    'X-RateLimit-Remaining': limit.requests - currentRequests.length,
                    'X-RateLimit-Reset': new Date(now + limit.window).toISOString()
                });
                
                next();
                
            } catch (error) {
                console.error('Erro no rate limiting:', error);
                next(); // Não bloquear em caso de erro
            }
        };
    }

    /**
     * Valida assinatura com regras de negócio
     * @param {Object} subscription - Assinatura para validar
     * @param {Object} options - Opções de validação
     * @returns {Promise<Object>} - Resultado da validação
     */
    static async validateSubscription(subscription, options = {}) {
        const { allowTrial, requiredPlan, gracePeriodDays } = options;
        
        // Verificar status
        const validStatuses = ['active'];
        if (allowTrial) {
            validStatuses.push('trialing');
        }
        
        if (!validStatuses.includes(subscription.status)) {
            return {
                valid: false,
                reason: 'INVALID_STATUS',
                details: { currentStatus: subscription.status, validStatuses }
            };
        }
        
        // Verificar expiração
        if (subscription.expires_at) {
            const expirationDate = new Date(subscription.expires_at);
            const now = new Date();
            
            if (expirationDate <= now) {
                // Verificar período de graça
                const gracePeriodEnd = new Date(expirationDate);
                gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
                
                if (now > gracePeriodEnd) {
                    return {
                        valid: false,
                        reason: 'EXPIRED',
                        details: {
                            expiresAt: subscription.expires_at,
                            gracePeriodEnd: gracePeriodEnd.toISOString()
                        }
                    };
                }
                
                // Dentro do período de graça
                return {
                    valid: true,
                    warning: 'GRACE_PERIOD',
                    details: {
                        expiresAt: subscription.expires_at,
                        gracePeriodEnd: gracePeriodEnd.toISOString()
                    }
                };
            }
        }
        
        // Verificar plano específico se requerido
        if (requiredPlan && subscription.plan !== requiredPlan) {
            return {
                valid: false,
                reason: 'PLAN_MISMATCH',
                details: {
                    currentPlan: subscription.plan,
                    requiredPlan
                }
            };
        }
        
        // Verificar integridade
        if (!SubscriptionModel.verifyIntegrity(subscription)) {
            return {
                valid: false,
                reason: 'INTEGRITY_VIOLATION',
                details: { subscriptionId: subscription.id }
            };
        }
        
        return { valid: true };
    }

    /**
     * Obtém recursos disponíveis para um plano
     * @param {string} plan - Nome do plano
     * @returns {Array} - Lista de recursos
     */
    static getPlanFeatures(plan) {
        const planFeatures = {
            free: [
                'cronograma_basico',
                'simulados_limitados'
            ],
            premium: [
                'cronograma_personalizado',
                'simulados_ilimitados',
                'analises_detalhadas',
                'suporte_prioritario',
                'exportacao_dados'
            ],
            premium_anual: [
                'cronograma_personalizado',
                'simulados_ilimitados',
                'analises_detalhadas',
                'suporte_prioritario',
                'exportacao_dados',
                'acesso_antecipado',
                'consultoria_personalizada'
            ]
        };
        
        return planFeatures[plan] || planFeatures.free;
    }

    /**
     * Registra acesso negado
     * @param {Object} req - Request
     * @param {string} reason - Razão da negação
     * @param {Object} subscription - Assinatura (se existir)
     */
    static async logAccessDenied(req, reason, subscription = null) {
        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION_ACCESS',
            entityId: subscription?.id || 'none',
            action: 'ACCESS_DENIED',
            userId: req.user?.id,
            details: {
                reason,
                endpoint: req.path,
                method: req.method,
                subscription: subscription ? {
                    id: subscription.id,
                    plan: subscription.plan,
                    status: subscription.status,
                    expiresAt: subscription.expires_at
                } : null
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'WARN'
        });
    }

    /**
     * Registra erro de acesso
     * @param {Object} req - Request
     * @param {Error} error - Erro ocorrido
     */
    static async logAccessError(req, error) {
        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION_ACCESS',
            entityId: 'error',
            action: 'ACCESS_ERROR',
            userId: req.user?.id,
            details: {
                error: error.message,
                endpoint: req.path,
                method: req.method
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'ERROR'
        });
    }

    /**
     * Envia resposta de assinatura requerida
     * @param {Object} res - Response
     */
    static sendSubscriptionRequired(res) {
        return res.status(402).json({
            error: 'Assinatura premium requerida',
            type: 'SUBSCRIPTION_REQUIRED',
            message: 'Este recurso está disponível apenas para assinantes premium.',
            upgradeUrl: '/planos',
            features: {
                premium: this.getPlanFeatures('premium'),
                premium_anual: this.getPlanFeatures('premium_anual')
            }
        });
    }

    /**
     * Envia resposta de assinatura inválida
     * @param {Object} res - Response
     * @param {Object} validationResult - Resultado da validação
     */
    static sendSubscriptionInvalid(res, validationResult) {
        const statusCodes = {
            INVALID_STATUS: 402,
            EXPIRED: 402,
            PLAN_MISMATCH: 403,
            INTEGRITY_VIOLATION: 403
        };
        
        const statusCode = statusCodes[validationResult.reason] || 402;
        
        return res.status(statusCode).json({
            error: 'Assinatura inválida ou expirada',
            type: 'SUBSCRIPTION_INVALID',
            reason: validationResult.reason,
            details: validationResult.details,
            renewUrl: '/planos'
        });
    }
}

module.exports = SubscriptionMiddleware;