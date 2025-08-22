// subscriptionManager.js - Gerenciador de assinaturas integrado com CACKTO
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../../subscription/models/audit');
const SubscriptionModel = require('../../subscription/models/subscription');
const CacktoService = require('./cacktoService');
const CacheService = require('../../subscription/services/cache');
const cacktoConfig = require('../config/cackto.config');

class CacktoSubscriptionManager {
    constructor() {
        this.config = cacktoConfig;
        this.cacktoService = CacktoService;
    }

    /**
     * Verifica status de assinatura por usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Status da assinatura
     */
    async checkUserSubscription(userId) {
        const cacheKey = `subscription:user:${userId}`;
        
        try {
            // Tentar buscar no cache primeiro
            const cached = await CacheService.get(cacheKey);
            if (cached) {
                return cached;
            }

            // Buscar assinatura ativa do usuário
            const subscription = await SubscriptionModel.findActiveByUserId(userId);
            
            if (!subscription) {
                const result = {
                    hasActiveSubscription: false,
                    subscription: null,
                    plan: null,
                    expiresAt: null,
                    status: 'inactive'
                };
                
                await CacheService.set(cacheKey, result, this.config.cache.ttl.subscription);
                return result;
            }

            // Verificar se a assinatura não expirou
            const now = new Date();
            const expiresAt = new Date(subscription.expires_at);
            
            if (expiresAt < now && subscription.status === 'active') {
                // Assinatura expirou, atualizar status
                await SubscriptionModel.updateStatus(subscription.id, {
                    status: 'expired',
                    expiredAt: now.toISOString()
                });
                
                subscription.status = 'expired';
            }

            const result = {
                hasActiveSubscription: subscription.status === 'active',
                subscription: {
                    id: subscription.id,
                    plan: subscription.plan,
                    status: subscription.status,
                    expiresAt: subscription.expires_at,
                    createdAt: subscription.created_at,
                    cacktoTransactionId: subscription.cackto_transaction_id
                },
                plan: this.getPlanDetails(subscription.plan),
                expiresAt: subscription.expires_at,
                status: subscription.status
            };

            // Cache por 5 minutos
            await CacheService.set(cacheKey, result, this.config.cache.ttl.subscription);
            
            return result;

        } catch (error) {
            throw new AppError(
                'Erro ao verificar assinatura do usuário',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Sincroniza assinatura com CACKTO
     * @param {number} subscriptionId - ID da assinatura local
     * @returns {Promise<Object>} - Resultado da sincronização
     */
    async syncSubscriptionWithCackto(subscriptionId) {
        try {
            const subscription = await SubscriptionModel.findById(subscriptionId);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura não encontrada',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId }
                );
            }

            if (!subscription.cackto_transaction_id) {
                throw new AppError(
                    'Assinatura não possui ID de transação CACKTO',
                    ERROR_TYPES.BAD_REQUEST,
                    { subscriptionId }
                );
            }

            // Sincronizar com CACKTO
            const syncResult = await this.cacktoService.syncSubscription(subscription.cackto_transaction_id);

            // Invalidar cache
            await this.invalidateUserSubscriptionCache(subscription.user_id);

            return syncResult;

        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao sincronizar assinatura com CACKTO',
                ERROR_TYPES.SYNC_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Cancela assinatura
     * @param {number} userId - ID do usuário
     * @param {string} reason - Razão do cancelamento
     * @returns {Promise<Object>} - Resultado do cancelamento
     */
    async cancelUserSubscription(userId, reason = 'user_request') {
        try {
            const subscription = await SubscriptionModel.findActiveByUserId(userId);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura ativa não encontrada',
                    ERROR_TYPES.NOT_FOUND,
                    { userId }
                );
            }

            // Cancelar na CACKTO se tiver ID de transação
            if (subscription.cackto_transaction_id) {
                try {
                    await this.cacktoService.cancelSubscription(subscription.cackto_transaction_id, reason);
                } catch (cacktoError) {
                    // Log do erro mas continua com cancelamento local
                    await AuditModel.logEvent({
                        entityType: 'SUBSCRIPTION_CANCELLATION',
                        entityId: subscription.id,
                        action: 'CACKTO_CANCEL_FAILED',
                        userId: userId,
                        details: {
                            cacktoError: cacktoError.message,
                            reason,
                            localCancellationProceedingAnyway: true
                        },
                        severity: 'WARN'
                    });
                }
            }

            // Cancelar localmente
            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                metadata: {
                    cancellationReason: reason,
                    cancelledBy: 'user',
                    cancelledAt: new Date().toISOString()
                }
            });

            // Log de auditoria
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'CANCELLED_BY_USER',
                userId: userId,
                details: {
                    plan: subscription.plan,
                    reason,
                    cacktoTransactionId: subscription.cackto_transaction_id
                },
                severity: 'INFO'
            });

            // Invalidar cache
            await this.invalidateUserSubscriptionCache(userId);

            return {
                success: true,
                subscriptionId: subscription.id,
                cancelledAt: new Date().toISOString(),
                message: 'Assinatura cancelada com sucesso'
            };

        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao cancelar assinatura',
                ERROR_TYPES.INTERNAL_ERROR,
                { userId, reason, originalError: error.message }
            );
        }
    }

    /**
     * Reativa assinatura suspensa
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Resultado da reativação
     */
    async reactivateUserSubscription(userId) {
        try {
            const subscription = await SubscriptionModel.findByUserId(userId, { includeSuspended: true });
            
            if (!subscription || subscription.status !== 'suspended') {
                throw new AppError(
                    'Assinatura suspensa não encontrada',
                    ERROR_TYPES.NOT_FOUND,
                    { userId }
                );
            }

            // Verificar se ainda está dentro do período de graça
            const suspendedAt = new Date(subscription.suspended_at);
            const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 dias
            const now = new Date();
            
            if (now - suspendedAt > gracePeriod) {
                throw new AppError(
                    'Período de graça para reativação expirado',
                    ERROR_TYPES.BAD_REQUEST,
                    { userId, suspendedAt: suspendedAt.toISOString() }
                );
            }

            // Reativar assinatura
            const plan = this.getPlanDetails(subscription.plan);
            const newExpirationDate = this.calculateExpirationDate(plan.billingCycle);

            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'active',
                expiresAt: newExpirationDate,
                reactivatedAt: new Date().toISOString(),
                suspendedAt: null,
                metadata: {
                    reactivationReason: 'user_request',
                    reactivatedAt: new Date().toISOString(),
                    newExpirationDate
                }
            });

            // Log de auditoria
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'REACTIVATED_BY_USER',
                userId: userId,
                details: {
                    plan: subscription.plan,
                    newExpirationDate,
                    suspendedDuration: now - suspendedAt
                },
                severity: 'INFO'
            });

            // Invalidar cache
            await this.invalidateUserSubscriptionCache(userId);

            return {
                success: true,
                subscriptionId: subscription.id,
                reactivatedAt: new Date().toISOString(),
                expiresAt: newExpirationDate,
                message: 'Assinatura reativada com sucesso'
            };

        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao reativar assinatura',
                ERROR_TYPES.INTERNAL_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Lista histórico de assinaturas do usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Array>} - Histórico de assinaturas
     */
    async getUserSubscriptionHistory(userId) {
        try {
            const subscriptions = await SubscriptionModel.findAllByUserId(userId);
            
            return subscriptions.map(sub => ({
                id: sub.id,
                plan: sub.plan,
                planDetails: this.getPlanDetails(sub.plan),
                status: sub.status,
                createdAt: sub.created_at,
                expiresAt: sub.expires_at,
                cancelledAt: sub.cancelled_at,
                suspendedAt: sub.suspended_at,
                cacktoTransactionId: sub.cackto_transaction_id,
                amount: sub.amount,
                currency: sub.currency
            }));

        } catch (error) {
            throw new AppError(
                'Erro ao buscar histórico de assinaturas',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Gera relatório de métricas de assinaturas
     * @param {Object} filters - Filtros para o relatório
     * @returns {Promise<Object>} - Métricas de assinaturas
     */
    async getSubscriptionMetrics(filters = {}) {
        try {
            const {
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias atrás
                endDate = new Date().toISOString(),
                plan = null
            } = filters;

            const metrics = await SubscriptionModel.getMetrics({
                startDate,
                endDate,
                plan
            });

            return {
                period: { startDate, endDate },
                metrics: {
                    totalSubscriptions: metrics.total || 0,
                    activeSubscriptions: metrics.active || 0,
                    cancelledSubscriptions: metrics.cancelled || 0,
                    suspendedSubscriptions: metrics.suspended || 0,
                    expiredSubscriptions: metrics.expired || 0,
                    totalRevenue: metrics.revenue || 0,
                    averageRevenue: metrics.averageRevenue || 0,
                    churnRate: this.calculateChurnRate(metrics),
                    byPlan: metrics.byPlan || []
                },
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            throw new AppError(
                'Erro ao gerar métricas de assinaturas',
                ERROR_TYPES.DATABASE_ERROR,
                { filters, originalError: error.message }
            );
        }
    }

    /**
     * Obtém detalhes do plano
     * @param {string} planCode - Código do plano
     * @returns {Object} - Detalhes do plano
     */
    getPlanDetails(planCode) {
        const planMapping = this.config.products.planMapping;
        return planMapping[planCode] || null;
    }

    /**
     * Calcula data de expiração baseada no ciclo de cobrança
     * @param {string} billingCycle - Ciclo de cobrança
     * @returns {string} - Data de expiração em ISO string
     */
    calculateExpirationDate(billingCycle) {
        const now = new Date();
        
        switch (billingCycle) {
            case 'monthly':
                now.setMonth(now.getMonth() + 1);
                break;
            case 'semiannual':
                now.setMonth(now.getMonth() + 6);
                break;
            case 'annual':
                now.setFullYear(now.getFullYear() + 1);
                break;
            default:
                now.setMonth(now.getMonth() + 1); // Default para mensal
        }
        
        return now.toISOString();
    }

    /**
     * Calcula taxa de churn
     * @param {Object} metrics - Métricas básicas
     * @returns {number} - Taxa de churn em porcentagem
     */
    calculateChurnRate(metrics) {
        if (!metrics.total || metrics.total === 0) return 0;
        
        const churned = (metrics.cancelled || 0) + (metrics.expired || 0);
        return ((churned / metrics.total) * 100).toFixed(2);
    }

    /**
     * Invalida cache de assinatura do usuário
     * @param {number} userId - ID do usuário
     */
    async invalidateUserSubscriptionCache(userId) {
        const cacheKeys = [
            `subscription:user:${userId}`,
            `user:${userId}:subscription`,
            `user:${userId}:status`
        ];
        
        for (const key of cacheKeys) {
            await CacheService.delete(key);
        }
    }

    /**
     * Verifica se o usuário tem acesso a uma funcionalidade específica
     * @param {number} userId - ID do usuário
     * @param {string} feature - Nome da funcionalidade
     * @returns {Promise<boolean>} - Se tem acesso
     */
    async hasFeatureAccess(userId, feature) {
        const subscription = await this.checkUserSubscription(userId);
        
        if (!subscription.hasActiveSubscription) {
            return false;
        }

        const plan = subscription.plan;
        if (!plan) return false;

        // Definir funcionalidades por plano
        const planFeatures = {
            'editaliza-premium-mensal': ['pdf_download', 'advanced_search', 'offline_access', 'priority_support'],
            'editaliza-premium-semestral': ['pdf_download', 'advanced_search', 'offline_access', 'priority_support', 'batch_download'],
            'editaliza-premium-anual': ['pdf_download', 'advanced_search', 'offline_access', 'priority_support', 'batch_download', 'api_access']
        };

        const features = planFeatures[subscription.subscription.plan] || [];
        return features.includes(feature);
    }

    /**
     * Processa notificação de pagamento bem-sucedido
     * @param {Object} paymentData - Dados do pagamento
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processSuccessfulPayment(paymentData) {
        try {
            const { customer, product, amount, transactionId } = paymentData;
            
            // Buscar ou criar usuário
            const UserModel = require('../../models/user');
            let user = await UserModel.findByEmail(customer.email);
            
            if (!user) {
                user = await UserModel.create({
                    email: customer.email,
                    name: customer.name,
                    source: 'cackto_payment'
                });
            }

            // Mapear produto para plano interno
            const internalPlan = this.mapCacktoPlanToInternal(product);
            
            if (!internalPlan) {
                throw new AppError(
                    'Produto não reconhecido',
                    ERROR_TYPES.BAD_REQUEST,
                    { product }
                );
            }

            // Criar assinatura
            const subscription = await SubscriptionModel.create({
                userId: user.id,
                cacktoTransactionId: transactionId,
                plan: internalPlan.code,
                status: 'active',
                expiresAt: this.calculateExpirationDate(internalPlan.billingCycle),
                amount: amount,
                currency: 'BRL'
            });

            // Invalidar cache
            await this.invalidateUserSubscriptionCache(user.id);

            return {
                success: true,
                userId: user.id,
                subscriptionId: subscription.id,
                plan: internalPlan.code,
                expiresAt: subscription.expires_at
            };

        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao processar pagamento',
                ERROR_TYPES.INTERNAL_ERROR,
                { paymentData, originalError: error.message }
            );
        }
    }

    /**
     * Mapeia produto CACKTO para plano interno
     * @param {Object} cacktoProduct - Produto CACKTO
     * @returns {Object|null} - Plano interno ou null
     */
    mapCacktoPlanToInternal(cacktoProduct) {
        const planMapping = this.config.products.planMapping;
        
        for (const [internalCode, planData] of Object.entries(planMapping)) {
            if (planData.cacktoProductId === cacktoProduct.id || 
                planData.cacktoProductId === cacktoProduct.code) {
                return {
                    code: internalCode,
                    ...planData
                };
            }
        }
        
        return null;
    }
}

// Singleton
const cacktoSubscriptionManager = new CacktoSubscriptionManager();

module.exports = cacktoSubscriptionManager;