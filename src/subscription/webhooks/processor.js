// processor.js - Processamento robusto de webhooks com retry e fallback
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const SubscriptionModel = require('../models/subscription');
const AuditModel = require('../models/audit');
const WebhookQueue = require('./queue');

class WebhookProcessor {
    constructor() {
        this.retryConfig = {
            maxRetries: 3,
            initialDelay: 1000, // 1 segundo
            maxDelay: 30000,    // 30 segundos
            backoffFactor: 2
        };
        
        this.circuitBreaker = {
            failures: 0,
            maxFailures: 5,
            resetTimeout: 60000, // 1 minuto
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
    }

    /**
     * Processa webhook validado
     * @param {Object} validatedWebhook - Webhook validado
     * @param {Object} req - Request original
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processWebhook(validatedWebhook, req) {
        const processingId = crypto.randomUUID();
        const startTime = Date.now();
        
        try {
            // Verificar circuit breaker
            this.checkCircuitBreaker();
            
            // Registrar início do processamento
            await this.logWebhookEvent({
                webhookId: validatedWebhook.payload.id,
                eventType: validatedWebhook.payload.event_type,
                status: 'PROCESSING',
                processingId,
                validationId: validatedWebhook.validationId,
                attempt: 1,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            // Processar com base no tipo de evento
            const result = await this.processEventType(validatedWebhook.payload, processingId);
            
            // Registrar sucesso
            await this.logWebhookEvent({
                webhookId: validatedWebhook.payload.id,
                eventType: validatedWebhook.payload.event_type,
                status: 'SUCCESS',
                processingId,
                processingTime: Date.now() - startTime,
                result
            });
            
            // Reset circuit breaker em caso de sucesso
            this.resetCircuitBreaker();
            
            return {
                success: true,
                processingId,
                result,
                processingTime: Date.now() - startTime
            };
            
        } catch (error) {
            // Incrementar falhas do circuit breaker
            this.recordFailure();
            
            // Registrar falha
            await this.logWebhookEvent({
                webhookId: validatedWebhook.payload.id,
                eventType: validatedWebhook.payload.event_type,
                status: 'FAILED',
                processingId,
                error: error.message,
                processingTime: Date.now() - startTime
            });
            
            // Enfileirar para retry se aplicável
            if (this.shouldRetry(error)) {
                await WebhookQueue.enqueue({
                    webhook: validatedWebhook,
                    attempt: 1,
                    processingId,
                    originalRequest: {
                        ip: req.ip,
                        userAgent: req.headers['user-agent']
                    }
                });
            }
            
            throw error;
        }
    }

    /**
     * Processa evento com base no tipo
     * @param {Object} payload - Payload do webhook
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processEventType(payload, processingId) {
        const { event_type, data } = payload;
        
        switch (event_type) {
            case 'order.paid':
                return await this.processOrderPaid(data, processingId);
                
            case 'order.refunded':
                return await this.processOrderRefunded(data, processingId);
                
            case 'order.cancelled':
                return await this.processOrderCancelled(data, processingId);
                
            case 'subscription.started':
                return await this.processSubscriptionStarted(data, processingId);
                
            case 'subscription.cancelled':
                return await this.processSubscriptionCancelled(data, processingId);
                
            case 'subscription.suspended':
                return await this.processSubscriptionSuspended(data, processingId);
                
            case 'subscription.reactivated':
                return await this.processSubscriptionReactivated(data, processingId);
                
            default:
                throw new AppError(
                    `Tipo de evento não implementado: ${event_type}`,
                    ERROR_TYPES.NOT_IMPLEMENTED,
                    { eventType: event_type, processingId }
                );
        }
    }

    /**
     * Processa pagamento aprovado
     * @param {Object} data - Dados do pagamento
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processOrderPaid(data, processingId) {
        const db = require('../utils/database');
        
        try {
            await db.run('BEGIN TRANSACTION');
            
            // Buscar usuário pelo email
            const user = await db.get(
                'SELECT id, email, name FROM users WHERE email = ?',
                [data.customer.email]
            );
            
            if (!user) {
                throw new AppError(
                    'Usuário não encontrado para o email',
                    ERROR_TYPES.NOT_FOUND,
                    { email: data.customer.email, processingId }
                );
            }
            
            // Determinar plano baseado no produto
            const plan = this.determinePlanFromProduct(data.product);
            
            // Calcular data de expiração
            const expiresAt = this.calculateExpirationDate(plan, data.order_date);
            
            // Criar assinatura
            const subscription = await SubscriptionModel.create({
                userId: user.id,
                kiwifyTransactionId: data.transaction_id,
                kiwifyProductId: data.product.id,
                plan: plan.name,
                status: 'active',
                amount: data.total_amount,
                currency: data.currency || 'BRL',
                paymentMethod: data.payment_method,
                expiresAt,
                metadata: {
                    kiwifyOrderId: data.order_id,
                    customerData: this.sanitizeCustomerData(data.customer),
                    productData: data.product,
                    processingId
                }
            });
            
            await db.run('COMMIT');
            
            // Log de ativação
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'ACTIVATED_BY_PAYMENT',
                userId: user.id,
                details: {
                    plan: plan.name,
                    amount: data.total_amount,
                    kiwifyTransactionId: data.transaction_id,
                    processingId
                },
                severity: 'INFO'
            });
            
            return {
                action: 'subscription_created',
                subscriptionId: subscription.id,
                userId: user.id,
                plan: plan.name,
                expiresAt
            };
            
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * Processa reembolso
     * @param {Object} data - Dados do reembolso
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processOrderRefunded(data, processingId) {
        try {
            // Buscar assinatura pela transação
            const subscription = await SubscriptionModel.findByKiwifyTransactionId(data.transaction_id);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura não encontrada para reembolso',
                    ERROR_TYPES.NOT_FOUND,
                    { transactionId: data.transaction_id, processingId }
                );
            }
            
            // Cancelar assinatura
            const updatedSubscription = await SubscriptionModel.updateStatus(subscription.id, {
                status: 'refunded',
                userId: subscription.user_id,
                metadata: {
                    refundReason: data.refund_reason,
                    refundAmount: data.refund_amount,
                    refundDate: data.refund_date,
                    processingId
                }
            });
            
            // Log de reembolso
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'REFUNDED',
                userId: subscription.user_id,
                details: {
                    refundAmount: data.refund_amount,
                    refundReason: data.refund_reason,
                    originalAmount: subscription.amount,
                    processingId
                },
                severity: 'WARN'
            });
            
            return {
                action: 'subscription_refunded',
                subscriptionId: subscription.id,
                refundAmount: data.refund_amount
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Processa cancelamento de pedido
     * @param {Object} data - Dados do cancelamento
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processOrderCancelled(data, processingId) {
        try {
            const subscription = await SubscriptionModel.findByKiwifyTransactionId(data.transaction_id);
            
            if (!subscription) {
                // Se não existe assinatura, apenas logar
                await AuditModel.logEvent({
                    entityType: 'ORDER',
                    entityId: data.order_id,
                    action: 'CANCELLED_NO_SUBSCRIPTION',
                    userId: null,
                    details: {
                        transactionId: data.transaction_id,
                        reason: data.cancellation_reason,
                        processingId
                    },
                    severity: 'INFO'
                });
                
                return {
                    action: 'order_cancelled_no_subscription',
                    orderId: data.order_id
                };
            }
            
            // Cancelar assinatura
            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'cancelled',
                userId: subscription.user_id,
                metadata: {
                    cancellationReason: data.cancellation_reason,
                    cancelledAt: new Date().toISOString(),
                    processingId
                }
            });
            
            return {
                action: 'subscription_cancelled',
                subscriptionId: subscription.id
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Processa início de assinatura recorrente
     * @param {Object} data - Dados da assinatura
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processSubscriptionStarted(data, processingId) {
        // Similar ao processOrderPaid, mas para assinaturas recorrentes
        return await this.processOrderPaid(data, processingId);
    }

    /**
     * Processa cancelamento de assinatura
     * @param {Object} data - Dados do cancelamento
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processSubscriptionCancelled(data, processingId) {
        try {
            const subscription = await SubscriptionModel.findByKiwifyTransactionId(data.subscription_id);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura não encontrada para cancelamento',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId: data.subscription_id, processingId }
                );
            }
            
            await SubscriptionModel.cancel(subscription.id, {
                reason: 'kiwify_cancellation',
                processingId
            });
            
            return {
                action: 'subscription_cancelled',
                subscriptionId: subscription.id
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Processa suspensão de assinatura
     * @param {Object} data - Dados da suspensão
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processSubscriptionSuspended(data, processingId) {
        try {
            const subscription = await SubscriptionModel.findByKiwifyTransactionId(data.subscription_id);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura não encontrada para suspensão',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId: data.subscription_id, processingId }
                );
            }
            
            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'suspended',
                userId: subscription.user_id,
                metadata: {
                    suspensionReason: data.reason,
                    suspendedAt: new Date().toISOString(),
                    processingId
                }
            });
            
            return {
                action: 'subscription_suspended',
                subscriptionId: subscription.id
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Processa reativação de assinatura
     * @param {Object} data - Dados da reativação
     * @param {string} processingId - ID do processamento
     * @returns {Promise<Object>} - Resultado
     */
    async processSubscriptionReactivated(data, processingId) {
        try {
            const subscription = await SubscriptionModel.findByKiwifyTransactionId(data.subscription_id);
            
            if (!subscription) {
                throw new AppError(
                    'Assinatura não encontrada para reativação',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId: data.subscription_id, processingId }
                );
            }
            
            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'active',
                userId: subscription.user_id,
                metadata: {
                    reactivationReason: data.reason,
                    reactivatedAt: new Date().toISOString(),
                    processingId
                }
            });
            
            return {
                action: 'subscription_reactivated',
                subscriptionId: subscription.id
            };
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Determina plano baseado no produto Kiwify
     * @param {Object} product - Dados do produto
     * @returns {Object} - Configuração do plano
     */
    determinePlanFromProduct(product) {
        // Mapear produtos Kiwify para planos internos
        const planMapping = {
            'editaliza-premium-mensal': {
                name: 'premium',
                duration: 30,
                features: ['cronograma_personalizado', 'simulados_ilimitados', 'suporte_prioritario']
            },
            'editaliza-premium-anual': {
                name: 'premium_anual',
                duration: 365,
                features: ['cronograma_personalizado', 'simulados_ilimitados', 'suporte_prioritario', 'desconto_anual']
            }
        };
        
        const plan = planMapping[product.code] || planMapping[product.name?.toLowerCase().replace(/\s+/g, '-')];
        
        if (!plan) {
            throw new AppError(
                'Produto não mapeado para plano',
                ERROR_TYPES.BAD_REQUEST,
                { productCode: product.code, productName: product.name }
            );
        }
        
        return plan;
    }

    /**
     * Calcula data de expiração da assinatura
     * @param {Object} plan - Configuração do plano
     * @param {string} startDate - Data de início
     * @returns {string} - Data de expiração ISO
     */
    calculateExpirationDate(plan, startDate) {
        const start = new Date(startDate);
        const expiration = new Date(start);
        expiration.setDate(expiration.getDate() + plan.duration);
        
        return expiration.toISOString();
    }

    /**
     * Sanitiza dados do cliente para armazenamento
     * @param {Object} customer - Dados do cliente
     * @returns {Object} - Dados sanitizados
     */
    sanitizeCustomerData(customer) {
        return {
            name: customer.name,
            email: customer.email,
            // Não armazenar documento completo por segurança
            documentType: customer.document?.length > 11 ? 'CPF' : 'CNPJ',
            phone: customer.phone ? customer.phone.replace(/\d(?=\d{4})/g, '*') : null
        };
    }

    /**
     * Registra evento de webhook no banco
     * @param {Object} eventData - Dados do evento
     */
    async logWebhookEvent(eventData) {
        const db = require('../utils/database');
        
        const query = `
            INSERT INTO webhook_events (
                id, webhook_id, event_type, status, processing_id,
                validation_id, attempt, processing_time, error,
                ip_address, user_agent, result, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        try {
            await db.run(query, [
                crypto.randomUUID(),
                eventData.webhookId,
                eventData.eventType,
                eventData.status,
                eventData.processingId,
                eventData.validationId,
                eventData.attempt || 1,
                eventData.processingTime,
                eventData.error,
                eventData.ipAddress,
                eventData.userAgent,
                eventData.result ? JSON.stringify(eventData.result) : null,
                new Date().toISOString()
            ]);
        } catch (error) {
            console.error('Erro ao registrar evento de webhook:', error);
        }
    }

    /**
     * Verifica se deve tentar novamente em caso de erro
     * @param {Error} error - Erro ocorrido
     * @returns {boolean} - Se deve tentar novamente
     */
    shouldRetry(error) {
        // Não tentar novamente para erros de negócio
        const nonRetryableErrors = [
            ERROR_TYPES.BAD_REQUEST,
            ERROR_TYPES.NOT_FOUND,
            ERROR_TYPES.UNAUTHORIZED,
            ERROR_TYPES.CONFLICT
        ];
        
        return !nonRetryableErrors.includes(error.type);
    }

    /**
     * Verifica estado do circuit breaker
     */
    checkCircuitBreaker() {
        if (this.circuitBreaker.state === 'OPEN') {
            const now = Date.now();
            if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
                this.circuitBreaker.state = 'HALF_OPEN';
                this.circuitBreaker.failures = 0;
            } else {
                throw new AppError(
                    'Circuit breaker aberto - sistema temporariamente indisponível',
                    ERROR_TYPES.SERVICE_UNAVAILABLE,
                    { circuitBreakerState: this.circuitBreaker.state }
                );
            }
        }
    }

    /**
     * Registra falha no circuit breaker
     */
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
            this.circuitBreaker.state = 'OPEN';
        }
    }

    /**
     * Reseta circuit breaker após sucesso
     */
    resetCircuitBreaker() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'CLOSED';
    }
}

module.exports = WebhookProcessor;