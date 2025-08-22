// processor.js - Processador robusto de webhooks CACKTO
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../../subscription/models/audit');
const SubscriptionModel = require('../../subscription/models/subscription');
const cacktoConfig = require('../config/cackto.config');
const CacheService = require('../../subscription/services/cache');
const { dbGet, dbAll, dbRun } = require('../../utils/database');
const emailService = require('../../services/emailService');

class CacktoWebhookProcessor {
    constructor() {
        this.config = cacktoConfig;
        this.eventHandlers = new Map();
        this.setupEventHandlers();
    }

    /**
     * Configura handlers para diferentes tipos de eventos
     */
    setupEventHandlers() {
        // Eventos de pagamento
        this.eventHandlers.set('payment.approved', this.handlePaymentApproved.bind(this));
        this.eventHandlers.set('payment.rejected', this.handlePaymentRejected.bind(this));
        this.eventHandlers.set('payment.cancelled', this.handlePaymentCancelled.bind(this));
        this.eventHandlers.set('payment.refunded', this.handlePaymentRefunded.bind(this));

        // Eventos de assinatura
        this.eventHandlers.set('subscription.created', this.handleSubscriptionCreated.bind(this));
        this.eventHandlers.set('subscription.activated', this.handleSubscriptionActivated.bind(this));
        this.eventHandlers.set('subscription.suspended', this.handleSubscriptionSuspended.bind(this));
        this.eventHandlers.set('subscription.cancelled', this.handleSubscriptionCancelled.bind(this));
        this.eventHandlers.set('subscription.renewed', this.handleSubscriptionRenewed.bind(this));
        this.eventHandlers.set('subscription.expired', this.handleSubscriptionExpired.bind(this));

        // Eventos de chargeback
        this.eventHandlers.set('chargeback.created', this.handleChargebackCreated.bind(this));
        this.eventHandlers.set('chargeback.resolved', this.handleChargebackResolved.bind(this));
    }

    /**
     * Processa webhook validado
     * @param {Object} validatedWebhook - Webhook já validado
     * @param {Object} req - Request original
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processWebhook(validatedWebhook, req) {
        const processingId = crypto.randomUUID();
        const startTime = Date.now();
        
        try {
            const { payload } = validatedWebhook;
            const { event, data } = payload;

            // Log de início do processamento
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_PROCESSING',
                entityId: processingId,
                action: 'PROCESSING_STARTED',
                userId: null,
                details: {
                    webhookId: payload.id,
                    eventType: event,
                    processingId
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'INFO'
            });

            // Registrar webhook na base de dados
            await this.recordWebhookEvent(payload, processingId);

            // Buscar handler para o evento
            const handler = this.eventHandlers.get(event);
            if (!handler) {
                throw new AppError(
                    `Handler não encontrado para evento: ${event}`,
                    ERROR_TYPES.NOT_IMPLEMENTED,
                    { event, processingId }
                );
            }

            // Processar evento específico
            const result = await handler(data, payload, processingId);

            // Invalidar cache relacionado
            await this.invalidateRelatedCache(event, data);

            // Log de sucesso
            const processingTime = Date.now() - startTime;
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_PROCESSING',
                entityId: processingId,
                action: 'PROCESSING_SUCCESS',
                userId: null,
                details: {
                    webhookId: payload.id,
                    eventType: event,
                    processingTime,
                    result: result?.summary || 'processed'
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'INFO'
            });

            return {
                success: true,
                processingId,
                processingTime,
                result
            };

        } catch (error) {
            // Log de erro
            const processingTime = Date.now() - startTime;
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_PROCESSING',
                entityId: processingId,
                action: 'PROCESSING_FAILED',
                userId: null,
                details: {
                    webhookId: validatedWebhook.payload?.id,
                    eventType: validatedWebhook.payload?.event,
                    error: error.message,
                    processingTime
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'ERROR'
            });

            // Adicionar à dead letter queue para retry
            await this.addToDeadLetterQueue(validatedWebhook.payload, error, processingId);

            throw error;
        }
    }

    /**
     * Handler para pagamento aprovado
     */
    async handlePaymentApproved(data, payload, processingId) {
        const { customer, plan, amount } = data;

        // Buscar ou criar usuário
        const user = await this.findOrCreateUser(customer);

        // Mapear plano CACKTO para plano interno
        const internalPlan = this.mapCacktoPlanToInternal(plan || data.product);

        if (!internalPlan) {
            throw new AppError(
                'Plano não reconhecido',
                ERROR_TYPES.BAD_REQUEST,
                { cacktoProduct: plan || data.product, processingId }
            );
        }

        // Criar ou atualizar assinatura
        const subscription = await SubscriptionModel.createOrUpdate({
            userId: user.id,
            cacktoTransactionId: data.id,
            plan: internalPlan.code,
            status: 'active',
            expiresAt: this.calculateExpirationDate(internalPlan.billingCycle),
            amount: amount,
            currency: data.currency || 'BRL',
            metadata: {
                cacktoData: data,
                processingId,
                createdAt: new Date().toISOString()
            }
        });

        // Gerar senha temporária para novos usuários
        const tempPassword = this.generateTemporaryPassword();
        
        // Enviar email com dados de acesso
        try {
            console.log('📧 ENVIANDO EMAIL COM DADOS DE ACESSO...');
            const planName = internalPlan.name || 'Premium';
            const emailResult = await emailService.sendWelcomeEmailWithCredentials(
                customer.email, 
                customer.name,
                tempPassword,
                planName
            );
            
            if (emailResult.success) {
                console.log(`✅ Email com dados de acesso enviado para: ${customer.email}`);
                console.log(`🔑 Login: ${customer.email}`);
                console.log(`🔐 Senha temporária: ${tempPassword}`);
                if (!emailResult.simulated) {
                    console.log(`📝 Message ID: ${emailResult.messageId}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao enviar email com dados de acesso:', error.message);
            // Não falhar o processamento se o email falhar
            await AuditModel.logEvent({
                entityType: 'EMAIL',
                entityId: user.id,
                action: 'ACCESS_EMAIL_FAILED',
                userId: user.id,
                details: {
                    error: error.message,
                    customerEmail: customer.email,
                    processingId
                },
                severity: 'WARN'
            });
        }

        // Registrar evento de auditoria
        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'ACTIVATED_VIA_CACKTO',
            userId: user.id,
            details: {
                cacktoTransactionId: data.id,
                plan: internalPlan.code,
                amount: amount,
                processingId
            },
            severity: 'INFO'
        });

        return {
            summary: 'subscription_activated',
            subscriptionId: subscription.id,
            userId: user.id,
            plan: internalPlan.code,
            emailSent: true
        };
    }

    /**
     * Handler para pagamento rejeitado
     */
    async handlePaymentRejected(data, payload, processingId) {
        const { customer } = data;

        // Buscar usuário
        const user = await this.findUserByEmail(customer.email);

        if (user) {
            // Buscar assinatura relacionada
            const subscription = await SubscriptionModel.findByCacktoTransactionId(data.id);

            if (subscription) {
                // Suspender assinatura
                await SubscriptionModel.updateStatus(subscription.id, {
                    status: 'suspended',
                    suspendedAt: new Date().toISOString(),
                    metadata: {
                        suspensionReason: 'payment_rejected',
                        cacktoData: data,
                        processingId
                    }
                });

                await AuditModel.logEvent({
                    entityType: 'SUBSCRIPTION',
                    entityId: subscription.id,
                    action: 'SUSPENDED_PAYMENT_REJECTED',
                    userId: user.id,
                    details: {
                        cacktoTransactionId: data.id,
                        reason: data.rejection_reason || 'payment_rejected',
                        processingId
                    },
                    severity: 'WARN'
                });
            }
        }

        return {
            summary: 'payment_rejected_processed',
            userId: user?.id,
            transactionId: data.id
        };
    }

    /**
     * Handler para pagamento cancelado
     */
    async handlePaymentCancelled(data, payload, processingId) {
        return await this.handlePaymentRejected(data, payload, processingId);
    }

    /**
     * Handler para reembolso
     */
    async handlePaymentRefunded(data, payload, processingId) {
        const { customer } = data;

        // Buscar usuário e assinatura
        const user = await this.findUserByEmail(customer.email);
        if (!user) return { summary: 'user_not_found' };

        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.transaction_id || data.id);
        if (!subscription) return { summary: 'subscription_not_found' };

        // Cancelar assinatura
        await SubscriptionModel.updateStatus(subscription.id, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            metadata: {
                cancellationReason: 'refunded',
                refundAmount: data.amount,
                cacktoData: data,
                processingId
            }
        });

        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'CANCELLED_REFUNDED',
            userId: user.id,
            details: {
                cacktoTransactionId: data.transaction_id || data.id,
                refundAmount: data.amount,
                processingId
            },
            severity: 'WARN'
        });

        return {
            summary: 'subscription_cancelled_refunded',
            subscriptionId: subscription.id,
            userId: user.id
        };
    }

    /**
     * Handler para assinatura criada
     */
    async handleSubscriptionCreated(data, payload, processingId) {
        // Similar ao payment.approved, mas sem ativar imediatamente
        return await this.handlePaymentApproved(data, payload, processingId);
    }

    /**
     * Handler para assinatura ativada
     */
    async handleSubscriptionActivated(data, payload, processingId) {
        return await this.handlePaymentApproved(data, payload, processingId);
    }

    /**
     * Handler para assinatura suspensa
     */
    async handleSubscriptionSuspended(data, payload, processingId) {
        const { customer } = data;

        const user = await this.findUserByEmail(customer.email);
        if (!user) return { summary: 'user_not_found' };

        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.id);
        if (!subscription) return { summary: 'subscription_not_found' };

        await SubscriptionModel.updateStatus(subscription.id, {
            status: 'suspended',
            suspendedAt: new Date().toISOString(),
            metadata: {
                suspensionReason: data.reason || 'cackto_suspension',
                cacktoData: data,
                processingId
            }
        });

        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'SUSPENDED_VIA_CACKTO',
            userId: user.id,
            details: {
                cacktoSubscriptionId: data.id,
                reason: data.reason,
                processingId
            },
            severity: 'WARN'
        });

        return {
            summary: 'subscription_suspended',
            subscriptionId: subscription.id,
            userId: user.id
        };
    }

    /**
     * Handler para assinatura cancelada
     */
    async handleSubscriptionCancelled(data, payload, processingId) {
        const { customer } = data;

        const user = await this.findUserByEmail(customer.email);
        if (!user) return { summary: 'user_not_found' };

        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.id);
        if (!subscription) return { summary: 'subscription_not_found' };

        await SubscriptionModel.updateStatus(subscription.id, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            metadata: {
                cancellationReason: data.reason || 'cackto_cancellation',
                cacktoData: data,
                processingId
            }
        });

        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'CANCELLED_VIA_CACKTO',
            userId: user.id,
            details: {
                cacktoSubscriptionId: data.id,
                reason: data.reason,
                processingId
            },
            severity: 'WARN'
        });

        return {
            summary: 'subscription_cancelled',
            subscriptionId: subscription.id,
            userId: user.id
        };
    }

    /**
     * Handler para renovação de assinatura
     */
    async handleSubscriptionRenewed(data, payload, processingId) {
        const { customer, plan } = data;

        const user = await this.findUserByEmail(customer.email);
        if (!user) return { summary: 'user_not_found' };

        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.id);
        if (!subscription) return { summary: 'subscription_not_found' };

        const internalPlan = this.mapCacktoPlanToInternal(plan);
        
        await SubscriptionModel.updateStatus(subscription.id, {
            status: 'active',
            expiresAt: this.calculateExpirationDate(internalPlan.billingCycle),
            renewedAt: new Date().toISOString(),
            metadata: {
                renewalSource: 'cackto',
                cacktoData: data,
                processingId
            }
        });

        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'RENEWED_VIA_CACKTO',
            userId: user.id,
            details: {
                cacktoSubscriptionId: data.id,
                newExpirationDate: this.calculateExpirationDate(internalPlan.billingCycle),
                processingId
            },
            severity: 'INFO'
        });

        return {
            summary: 'subscription_renewed',
            subscriptionId: subscription.id,
            userId: user.id
        };
    }

    /**
     * Handler para assinatura expirada
     */
    async handleSubscriptionExpired(data, payload, processingId) {
        const { customer } = data;

        const user = await this.findUserByEmail(customer.email);
        if (!user) return { summary: 'user_not_found' };

        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.id);
        if (!subscription) return { summary: 'subscription_not_found' };

        await SubscriptionModel.updateStatus(subscription.id, {
            status: 'expired',
            expiredAt: new Date().toISOString(),
            metadata: {
                expirationSource: 'cackto',
                cacktoData: data,
                processingId
            }
        });

        await AuditModel.logEvent({
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'EXPIRED_VIA_CACKTO',
            userId: user.id,
            details: {
                cacktoSubscriptionId: data.id,
                processingId
            },
            severity: 'WARN'
        });

        return {
            summary: 'subscription_expired',
            subscriptionId: subscription.id,
            userId: user.id
        };
    }

    /**
     * Handler para chargeback criado
     */
    async handleChargebackCreated(data, payload, processingId) {
        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.transaction_id);
        
        if (subscription) {
            await SubscriptionModel.updateStatus(subscription.id, {
                status: 'disputed',
                disputedAt: new Date().toISOString(),
                metadata: {
                    chargebackId: data.id,
                    chargebackReason: data.reason,
                    chargebackAmount: data.amount,
                    cacktoData: data,
                    processingId
                }
            });

            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'CHARGEBACK_CREATED',
                userId: subscription.user_id,
                details: {
                    chargebackId: data.id,
                    transactionId: data.transaction_id,
                    amount: data.amount,
                    reason: data.reason,
                    processingId
                },
                severity: 'ERROR'
            });
        }

        return {
            summary: 'chargeback_processed',
            chargebackId: data.id,
            transactionId: data.transaction_id
        };
    }

    /**
     * Handler para chargeback resolvido
     */
    async handleChargebackResolved(data, payload, processingId) {
        const subscription = await SubscriptionModel.findByCacktoTransactionId(data.transaction_id);
        
        if (subscription) {
            const newStatus = data.resolution === 'merchant_wins' ? 'active' : 'cancelled';
            
            await SubscriptionModel.updateStatus(subscription.id, {
                status: newStatus,
                disputeResolvedAt: new Date().toISOString(),
                metadata: {
                    chargebackId: data.id,
                    resolution: data.resolution,
                    cacktoData: data,
                    processingId
                }
            });

            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'CHARGEBACK_RESOLVED',
                userId: subscription.user_id,
                details: {
                    chargebackId: data.id,
                    resolution: data.resolution,
                    newStatus,
                    processingId
                },
                severity: 'WARN'
            });
        }

        return {
            summary: 'chargeback_resolved',
            chargebackId: data.id,
            resolution: data.resolution
        };
    }

    /**
     * Busca ou cria usuário baseado nos dados do cliente
     */
    async findOrCreateUser(customer) {
        const UserModel = require('../../models/user');
        
        let user = await UserModel.findByEmail(customer.email);
        
        if (!user) {
            user = await UserModel.create({
                email: customer.email,
                name: customer.name || customer.first_name || 'Cliente CACKTO',
                source: 'cackto',
                metadata: {
                    cacktoCustomer: customer,
                    createdAt: new Date().toISOString()
                }
            });
        }
        
        return user;
    }

    /**
     * Busca usuário por email
     */
    async findUserByEmail(email) {
        const UserModel = require('../../models/user');
        return await UserModel.findByEmail(email);
    }

    /**
     * Mapeia plano CACKTO para plano interno
     */
    mapCacktoPlanToInternal(cacktoProduct) {
        const planMapping = this.config.products.planMapping;
        
        // Buscar por ID do produto CACKTO
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

    /**
     * Calcula data de expiração baseada no ciclo de cobrança
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
     * Registra evento de webhook na base de dados
     */
    async recordWebhookEvent(payload, processingId) {
        const { dbGet, dbAll, dbRun } = require('../../utils/database');
        
        await dbRun(`
            INSERT INTO webhook_events (
                webhook_id, event_type, status, processing_id, 
                raw_payload, created_at, processed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            payload.id,
            payload.event,
            'processing',
            processingId,
            JSON.stringify(payload),
            payload.created_at || new Date().toISOString(),
            new Date().toISOString()
        ]);
    }

    /**
     * Invalida cache relacionado ao evento
     */
    async invalidateRelatedCache(event, data) {
        const cacheKeys = [];
        
        if (data.customer?.email) {
            cacheKeys.push(`user:${data.customer.email}`);
        }
        
        if (data.id) {
            cacheKeys.push(`subscription:${data.id}`);
            cacheKeys.push(`transaction:${data.id}`);
        }
        
        for (const key of cacheKeys) {
            await CacheService.delete(key);
        }
    }

    /**
     * Adiciona webhook à dead letter queue para retry
     */
    async addToDeadLetterQueue(payload, error, processingId) {
        const { dbGet, dbAll, dbRun } = require('../../utils/database');
        
        await dbRun(`
            INSERT INTO webhook_dead_letter_queue (
                webhook_id, event_type, error_message, retry_count, 
                raw_payload, processing_id, failed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            payload.id,
            payload.event,
            error.message,
            0,
            JSON.stringify(payload),
            processingId,
            new Date().toISOString()
        ]);
    }

    /**
     * Gera senha temporária segura para novos usuários
     */
    generateTemporaryPassword() {
        const length = 12;
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
        let password = '';
        
        // Garantir pelo menos um de cada tipo
        password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // Maiúscula
        password += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)]; // Minúscula
        password += '23456789'[Math.floor(Math.random() * 8)]; // Número
        password += '@#$%'[Math.floor(Math.random() * 4)]; // Especial
        
        // Completar com caracteres aleatórios
        for (let i = 4; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // Embaralhar
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
}

module.exports = CacktoWebhookProcessor;