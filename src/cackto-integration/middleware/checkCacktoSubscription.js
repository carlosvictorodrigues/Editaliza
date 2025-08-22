// checkCacktoSubscription.js - Middleware para verificar assinaturas CACKTO
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const CacktoSubscriptionManager = require('../services/subscriptionManager');
const AuditModel = require('../../subscription/models/audit');

/**
 * Middleware principal para verificar assinatura ativa
 * @param {Object} options - Opções do middleware
 * @returns {Function} - Middleware function
 */
function checkCacktoSubscription(options = {}) {
    const {
        redirectToPlans = true,
        allowGracePeriod = false,
        gracePeriodDays = 3,
        requiredFeature = null,
        strict = false
    } = options;

    return async (req, res, next) => {
        try {
            // Verificar se o usuário está autenticado
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    error: 'Usuário não autenticado',
                    code: 'AUTHENTICATION_REQUIRED'
                });
            }

            const userId = req.user.id;

            // Verificar assinatura do usuário
            const subscriptionStatus = await CacktoSubscriptionManager.checkUserSubscription(userId);

            // Adicionar informações da assinatura ao request
            req.subscription = subscriptionStatus;

            // Log da verificação
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION_CHECK',
                entityId: userId,
                action: 'ACCESS_VERIFICATION',
                userId: userId,
                details: {
                    hasActiveSubscription: subscriptionStatus.hasActiveSubscription,
                    status: subscriptionStatus.status,
                    plan: subscriptionStatus.subscription?.plan,
                    requestPath: req.path,
                    requiredFeature
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'DEBUG'
            });

            // Verificar se tem assinatura ativa
            if (!subscriptionStatus.hasActiveSubscription) {
                return handleInactiveSubscription(
                    req, res, subscriptionStatus, 
                    { redirectToPlans, allowGracePeriod, gracePeriodDays, strict }
                );
            }

            // Verificar funcionalidade específica se requerida
            if (requiredFeature) {
                const hasAccess = await CacktoSubscriptionManager.hasFeatureAccess(userId, requiredFeature);
                
                if (!hasAccess) {
                    await AuditModel.logEvent({
                        entityType: 'FEATURE_ACCESS_DENIED',
                        entityId: userId,
                        action: 'FEATURE_ACCESS_DENIED',
                        userId: userId,
                        details: {
                            requiredFeature,
                            userPlan: subscriptionStatus.subscription?.plan,
                            requestPath: req.path
                        },
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        severity: 'WARN'
                    });

                    return res.status(403).json({
                        error: 'Funcionalidade não disponível no seu plano',
                        code: 'FEATURE_NOT_AVAILABLE',
                        requiredFeature,
                        currentPlan: subscriptionStatus.subscription?.plan,
                        upgradeRequired: true
                    });
                }
            }

            // Verificar se a assinatura está próxima do vencimento
            if (subscriptionStatus.subscription?.expiresAt) {
                const expiresAt = new Date(subscriptionStatus.subscription.expiresAt);
                const now = new Date();
                const daysUntilExpiration = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

                if (daysUntilExpiration <= 7 && daysUntilExpiration > 0) {
                    // Adicionar aviso de expiração próxima ao response
                    res.set('X-Subscription-Expires-Soon', 'true');
                    res.set('X-Subscription-Days-Remaining', daysUntilExpiration.toString());
                }
            }

            // Tudo OK, continuar
            next();

        } catch (error) {
            console.error('Erro ao verificar assinatura:', error);

            // Log do erro
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION_CHECK_ERROR',
                entityId: req.user?.id || 'unknown',
                action: 'VERIFICATION_ERROR',
                userId: req.user?.id,
                details: {
                    error: error.message,
                    requestPath: req.path,
                    stack: error.stack
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'ERROR'
            });

            // Em caso de erro, decidir se permite ou bloqueia acesso
            if (strict) {
                return res.status(503).json({
                    error: 'Erro ao verificar assinatura',
                    code: 'SUBSCRIPTION_CHECK_ERROR',
                    temporary: true
                });
            } else {
                // Modo gracioso - permitir acesso mas logar o erro
                req.subscription = {
                    hasActiveSubscription: false,
                    error: true,
                    errorMessage: error.message
                };
                next();
            }
        }
    };
}

/**
 * Middleware específico para funcionalidades premium
 */
function requirePremiumFeature(feature) {
    return checkCacktoSubscription({
        requiredFeature: feature,
        redirectToPlans: true,
        strict: true
    });
}

/**
 * Middleware para verificar apenas se tem alguma assinatura (ativa ou em período de graça)
 */
function requireAnySubscription() {
    return checkCacktoSubscription({
        allowGracePeriod: true,
        gracePeriodDays: 7,
        redirectToPlans: true,
        strict: false
    });
}

/**
 * Middleware para APIs que precisam de verificação estrita
 */
function requireActiveSubscriptionStrict() {
    return checkCacktoSubscription({
        redirectToPlans: false,
        allowGracePeriod: false,
        strict: true
    });
}

/**
 * Manipula assinatura inativa
 */
async function handleInactiveSubscription(req, res, subscriptionStatus, options) {
    const { redirectToPlans, allowGracePeriod, gracePeriodDays, strict } = options;
    const userId = req.user.id;

    // Verificar se está em período de graça
    if (allowGracePeriod && subscriptionStatus.subscription) {
        const subscription = subscriptionStatus.subscription;
        
        if (subscription.status === 'expired') {
            const expiredAt = new Date(subscription.expiresAt);
            const now = new Date();
            const daysSinceExpiration = Math.floor((now - expiredAt) / (1000 * 60 * 60 * 24));

            if (daysSinceExpiration <= gracePeriodDays) {
                // Ainda está no período de graça
                req.subscription = {
                    ...subscriptionStatus,
                    inGracePeriod: true,
                    gracePeriodDaysRemaining: gracePeriodDays - daysSinceExpiration
                };

                // Adicionar headers informativos
                res.set('X-Subscription-Grace-Period', 'true');
                res.set('X-Subscription-Grace-Days-Remaining', (gracePeriodDays - daysSinceExpiration).toString());

                await AuditModel.logEvent({
                    entityType: 'SUBSCRIPTION_GRACE_PERIOD',
                    entityId: userId,
                    action: 'GRACE_PERIOD_ACCESS',
                    userId: userId,
                    details: {
                        daysInGracePeriod: daysSinceExpiration,
                        daysRemaining: gracePeriodDays - daysSinceExpiration,
                        requestPath: req.path
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    severity: 'INFO'
                });

                return req.next ? req.next() : next();
            }
        }
    }

    // Log de acesso negado
    await AuditModel.logEvent({
        entityType: 'SUBSCRIPTION_ACCESS_DENIED',
        entityId: userId,
        action: 'ACCESS_DENIED_NO_SUBSCRIPTION',
        userId: userId,
        details: {
            subscriptionStatus: subscriptionStatus.status,
            requestPath: req.path,
            hasExpiredSubscription: !!subscriptionStatus.subscription
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: 'WARN'
    });

    // Determinar resposta baseada no tipo de requisição
    if (req.accepts('html') && redirectToPlans) {
        // Requisição HTML - redirecionar para página de planos
        return res.redirect('/plans?reason=subscription_required');
    } else {
        // Requisição JSON/API - retornar erro estruturado
        const response = {
            error: 'Assinatura ativa requerida',
            code: 'SUBSCRIPTION_REQUIRED',
            subscriptionStatus: subscriptionStatus.status,
            hasExpiredSubscription: !!subscriptionStatus.subscription
        };

        if (subscriptionStatus.subscription) {
            response.expiredAt = subscriptionStatus.subscription.expiresAt;
            response.plan = subscriptionStatus.subscription.plan;
        }

        return res.status(402).json(response); // 402 Payment Required
    }
}

/**
 * Middleware para adicionar informações de assinatura sem bloquear acesso
 */
function addSubscriptionInfo() {
    return async (req, res, next) => {
        try {
            if (req.user && req.user.id) {
                const subscriptionStatus = await CacktoSubscriptionManager.checkUserSubscription(req.user.id);
                req.subscription = subscriptionStatus;

                // Adicionar headers informativos
                res.set('X-Has-Active-Subscription', subscriptionStatus.hasActiveSubscription.toString());
                if (subscriptionStatus.subscription) {
                    res.set('X-Subscription-Plan', subscriptionStatus.subscription.plan);
                    res.set('X-Subscription-Status', subscriptionStatus.subscription.status);
                }
            }
        } catch (error) {
            console.error('Erro ao adicionar informações de assinatura:', error);
            // Não bloqueia em caso de erro
        }
        
        next();
    };
}

/**
 * Middleware para verificar se o usuário pode fazer upgrade
 */
function canUpgrade() {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return next();
            }

            const subscriptionStatus = await CacktoSubscriptionManager.checkUserSubscription(req.user.id);
            
            // Determinar se pode fazer upgrade
            const currentPlan = subscriptionStatus.subscription?.plan;
            const planHierarchy = ['editaliza-premium-mensal', 'editaliza-premium-semestral', 'editaliza-premium-anual'];
            
            let canUpgrade = true;
            let availableUpgrades = [];

            if (currentPlan) {
                const currentIndex = planHierarchy.indexOf(currentPlan);
                if (currentIndex !== -1) {
                    availableUpgrades = planHierarchy.slice(currentIndex + 1);
                    canUpgrade = availableUpgrades.length > 0;
                }
            } else {
                availableUpgrades = planHierarchy;
            }

            req.upgradeInfo = {
                canUpgrade,
                currentPlan,
                availableUpgrades
            };

        } catch (error) {
            console.error('Erro ao verificar possibilidade de upgrade:', error);
        }
        
        next();
    };
}

module.exports = {
    checkCacktoSubscription,
    requirePremiumFeature,
    requireAnySubscription,
    requireActiveSubscriptionStrict,
    addSubscriptionInfo,
    canUpgrade
};