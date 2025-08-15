// subscription.js - Configurações do sistema de assinaturas
const crypto = require('crypto');

class SubscriptionConfig {
    constructor() {
        this.validateEnvironment();
    }

    /**
     * Valida variáveis de ambiente necessárias
     */
    validateEnvironment() {
        const requiredEnvVars = [
            'KIWIFY_WEBHOOK_SECRET',
            'JWT_SECRET'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            throw new Error(
                `Variáveis de ambiente obrigatórias não configuradas: ${missingVars.join(', ')}`
            );
        }

        // Validar tamanho mínimo dos secrets em produção
        if (process.env.NODE_ENV === 'production') {
            const secretVars = ['KIWIFY_WEBHOOK_SECRET', 'JWT_SECRET'];
            
            for (const varName of secretVars) {
                if (process.env[varName].length < 32) {
                    throw new Error(
                        `${varName} deve ter pelo menos 32 caracteres em produção`
                    );
                }
            }
        }
    }

    /**
     * Configurações do Kiwify
     */
    get kiwify() {
        return {
            apiKey: process.env.KIWIFY_API_KEY,
            apiUrl: process.env.KIWIFY_API_URL || 'https://api.kiwify.com.br',
            webhookSecret: process.env.KIWIFY_WEBHOOK_SECRET,
            allowedIPs: [
                '54.207.79.86',
                '177.71.207.84',
                '18.231.194.34'
            ],
            timeout: parseInt(process.env.KIWIFY_TIMEOUT) || 30000,
            retryAttempts: parseInt(process.env.KIWIFY_RETRY_ATTEMPTS) || 3
        };
    }

    /**
     * Configurações de cache
     */
    get cache() {
        return {
            defaultTTL: parseInt(process.env.CACHE_TTL_SECONDS) || 300,
            redisUrl: process.env.REDIS_URL,
            maxMemoryItems: parseInt(process.env.CACHE_MAX_MEMORY_ITEMS) || 1000,
            enableRedis: !!process.env.REDIS_URL
        };
    }

    /**
     * Configurações de webhook
     */
    get webhook() {
        return {
            maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3,
            initialDelay: parseInt(process.env.WEBHOOK_INITIAL_DELAY) || 1000,
            maxDelay: parseInt(process.env.WEBHOOK_MAX_DELAY) || 30000,
            backoffFactor: parseFloat(process.env.WEBHOOK_BACKOFF_FACTOR) || 2,
            timestampTolerance: parseInt(process.env.WEBHOOK_TIMESTAMP_TOLERANCE) || 300,
            rateLimitWindow: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW) || 60000,
            rateLimitMax: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 100
        };
    }

    /**
     * Configurações de assinatura
     */
    get subscription() {
        return {
            gracePeriodDays: parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS) || 3,
            cacheInvalidationEnabled: process.env.SUBSCRIPTION_CACHE_INVALIDATION !== 'false',
            auditEnabled: process.env.SUBSCRIPTION_AUDIT_ENABLED !== 'false',
            encryptMetadata: process.env.SUBSCRIPTION_ENCRYPT_METADATA !== 'false'
        };
    }

    /**
     * Configurações de auditoria
     */
    get audit() {
        return {
            enabled: process.env.AUDIT_ENABLED !== 'false',
            retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 2555, // 7 anos
            enableBlockchain: process.env.AUDIT_ENABLE_BLOCKCHAIN !== 'false',
            logLevel: process.env.AUDIT_LOG_LEVEL || 'INFO'
        };
    }

    /**
     * Configurações de segurança
     */
    get security() {
        return {
            encryptionAlgorithm: 'aes-256-gcm',
            hashAlgorithm: 'sha256',
            jwtSecret: process.env.JWT_SECRET,
            enableRateLimit: process.env.SECURITY_ENABLE_RATE_LIMIT !== 'false',
            enableIpWhitelist: process.env.SECURITY_ENABLE_IP_WHITELIST !== 'false',
            maxLoginAttempts: parseInt(process.env.SECURITY_MAX_LOGIN_ATTEMPTS) || 5,
            lockoutDuration: parseInt(process.env.SECURITY_LOCKOUT_DURATION) || 900000 // 15 minutos
        };
    }

    /**
     * Planos de assinatura disponíveis
     */
    get plans() {
        return {
            free: {
                name: 'Gratuito',
                price: 0,
                currency: 'BRL',
                duration: null, // Indefinido
                features: [
                    'cronograma_basico',
                    'simulados_limitados'
                ],
                limits: {
                    cronogramas: 1,
                    simulados_por_mes: 5,
                    storage_mb: 50
                }
            },
            premium: {
                name: 'Premium Mensal',
                price: 97.00,
                currency: 'BRL',
                duration: 30, // dias
                features: [
                    'cronograma_personalizado',
                    'simulados_ilimitados',
                    'analises_detalhadas',
                    'suporte_prioritario',
                    'exportacao_dados'
                ],
                limits: {
                    cronogramas: -1, // Ilimitado
                    simulados_por_mes: -1,
                    storage_mb: 1000
                },
                kiwifyProductCodes: ['editaliza-premium-mensal']
            },
            premium_anual: {
                name: 'Premium Anual',
                price: 970.00,
                currency: 'BRL',
                duration: 365, // dias
                features: [
                    'cronograma_personalizado',
                    'simulados_ilimitados',
                    'analises_detalhadas',
                    'suporte_prioritario',
                    'exportacao_dados',
                    'acesso_antecipado',
                    'consultoria_personalizada'
                ],
                limits: {
                    cronogramas: -1,
                    simulados_por_mes: -1,
                    storage_mb: 5000
                },
                kiwifyProductCodes: ['editaliza-premium-anual'],
                discount: {
                    percentage: 16.7,
                    savings: 194.00
                }
            }
        };
    }

    /**
     * Configurações de rate limiting por plano
     */
    get rateLimits() {
        return {
            free: {
                requests: 10,
                window: 60000, // 1 minuto
                burst: 20
            },
            premium: {
                requests: 100,
                window: 60000,
                burst: 200
            },
            premium_anual: {
                requests: 200,
                window: 60000,
                burst: 400
            }
        };
    }

    /**
     * Configurações de monitoramento
     */
    get monitoring() {
        return {
            enableHealthChecks: process.env.MONITORING_ENABLE_HEALTH_CHECKS !== 'false',
            healthCheckInterval: parseInt(process.env.MONITORING_HEALTH_CHECK_INTERVAL) || 60000,
            enableMetrics: process.env.MONITORING_ENABLE_METRICS !== 'false',
            metricsPort: parseInt(process.env.MONITORING_METRICS_PORT) || 9090,
            alerting: {
                webhookFailureThreshold: parseInt(process.env.ALERT_WEBHOOK_FAILURE_THRESHOLD) || 5,
                responseTimeThreshold: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 5000,
                errorRateThreshold: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.1
            }
        };
    }

    /**
     * Configurações de notificações
     */
    get notifications() {
        return {
            email: {
                enabled: process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true',
                from: process.env.NOTIFICATIONS_EMAIL_FROM || 'noreply@editaliza.com.br',
                templates: {
                    subscriptionActivated: 'subscription-activated',
                    subscriptionCancelled: 'subscription-cancelled',
                    subscriptionExpiring: 'subscription-expiring',
                    paymentFailed: 'payment-failed'
                }
            },
            slack: {
                enabled: process.env.NOTIFICATIONS_SLACK_ENABLED === 'true',
                webhookUrl: process.env.NOTIFICATIONS_SLACK_WEBHOOK_URL,
                channel: process.env.NOTIFICATIONS_SLACK_CHANNEL || '#alerts'
            }
        };
    }

    /**
     * Configurações de backup
     */
    get backup() {
        return {
            enabled: process.env.BACKUP_ENABLED !== 'false',
            interval: parseInt(process.env.BACKUP_INTERVAL) || 86400000, // 24 horas
            retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
            encryption: {
                enabled: process.env.BACKUP_ENCRYPTION_ENABLED !== 'false',
                key: process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET
            },
            storage: {
                type: process.env.BACKUP_STORAGE_TYPE || 'local',
                path: process.env.BACKUP_STORAGE_PATH || './backups',
                s3: {
                    bucket: process.env.BACKUP_S3_BUCKET,
                    region: process.env.BACKUP_S3_REGION,
                    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
                    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY
                }
            }
        };
    }

    /**
     * Gera configuração para desenvolvimento
     */
    generateDevConfig() {
        return {
            KIWIFY_WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex'),
            KIWIFY_API_KEY: 'dev_api_key_placeholder',
            WEBHOOK_MAX_RETRIES: '3',
            WEBHOOK_INITIAL_DELAY: '1000',
            CACHE_TTL_SECONDS: '300',
            SUBSCRIPTION_GRACE_PERIOD_DAYS: '3',
            AUDIT_RETENTION_DAYS: '30',
            SECURITY_ENABLE_RATE_LIMIT: 'true',
            MONITORING_ENABLE_HEALTH_CHECKS: 'true'
        };
    }

    /**
     * Valida configuração de produção
     */
    validateProduction() {
        const errors = [];

        // Verificar secrets
        if (!this.kiwify.apiKey) {
            errors.push('KIWIFY_API_KEY não configurado');
        }

        if (!this.kiwify.webhookSecret || this.kiwify.webhookSecret.length < 32) {
            errors.push('KIWIFY_WEBHOOK_SECRET deve ter pelo menos 32 caracteres');
        }

        // Verificar configurações de segurança
        if (!this.security.jwtSecret || this.security.jwtSecret.length < 32) {
            errors.push('JWT_SECRET deve ter pelo menos 32 caracteres');
        }

        // Verificar configurações de notificação
        if (this.notifications.email.enabled && !process.env.EMAIL_HOST) {
            errors.push('Configurações de email necessárias para notificações');
        }

        if (errors.length > 0) {
            throw new Error(`Configuração de produção inválida:\n${errors.join('\n')}`);
        }

        return true;
    }

    /**
     * Obtém configuração completa
     */
    getConfig() {
        return {
            kiwify: this.kiwify,
            cache: this.cache,
            webhook: this.webhook,
            subscription: this.subscription,
            audit: this.audit,
            security: this.security,
            plans: this.plans,
            rateLimits: this.rateLimits,
            monitoring: this.monitoring,
            notifications: this.notifications,
            backup: this.backup
        };
    }
}

// Singleton para garantir configuração consistente
const subscriptionConfig = new SubscriptionConfig();

module.exports = subscriptionConfig;