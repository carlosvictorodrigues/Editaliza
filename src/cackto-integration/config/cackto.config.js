// cackto.config.js - Configuração específica para integração com CACKTO
const config = {
    // URLs da API CACKTO
    api: {
        baseURL: process.env.CACKTO_API_URL || 'https://api.cackto.com',
        timeout: 30000, // 30 segundos
        retryAttempts: 3,
        retryDelay: 1000 // 1 segundo
    },

    // Configuração de autenticação
    auth: {
        apiKey: process.env.CACKTO_API_KEY,
        secretKey: process.env.CACKTO_SECRET_KEY,
        webhookSecret: process.env.CACKTO_WEBHOOK_SECRET
    },

    // IPs autorizados para webhooks da CACKTO
    security: {
        allowedIPs: [
            // IPs que serão fornecidos pela documentação da CACKTO
            '200.147.67.142',
            '191.252.221.153',
            '18.231.194.124'
        ],
        maxTimestampDifference: 300, // 5 minutos em segundos
        signatureHeader: 'x-cackto-signature',
        timestampHeader: 'x-cackto-timestamp'
    },

    // Eventos suportados pela CACKTO
    events: {
        supported: [
            'payment.approved',
            'payment.rejected',
            'payment.cancelled',
            'payment.refunded',
            'subscription.created',
            'subscription.activated',
            'subscription.suspended',
            'subscription.cancelled',
            'subscription.renewed',
            'subscription.expired',
            'chargeback.created',
            'chargeback.resolved'
        ],
        
        // Mapeamento de eventos CACKTO para eventos internos
        mapping: {
            'payment.approved': 'order.paid',
            'payment.rejected': 'order.failed',
            'payment.cancelled': 'order.cancelled',
            'payment.refunded': 'order.refunded',
            'subscription.created': 'subscription.started',
            'subscription.activated': 'subscription.activated',
            'subscription.suspended': 'subscription.suspended',
            'subscription.cancelled': 'subscription.cancelled',
            'subscription.renewed': 'subscription.renewed',
            'subscription.expired': 'subscription.expired'
        }
    },

    // Configuração de produtos/planos
    products: {
        // Códigos dos produtos na CACKTO que correspondem aos planos do Editaliza
        planMapping: {
            'editaliza-premium-mensal': {
                cacktoProductId: process.env.CACKTO_PRODUCT_MENSAL,
                name: 'Editaliza Premium Mensal',
                price: 97.00,
                currency: 'BRL',
                billingCycle: 'monthly'
            },
            'editaliza-premium-semestral': {
                cacktoProductId: process.env.CACKTO_PRODUCT_SEMESTRAL,
                name: 'Editaliza Premium Semestral',
                price: 497.00,
                currency: 'BRL',
                billingCycle: 'semiannual'
            },
            'editaliza-premium-anual': {
                cacktoProductId: process.env.CACKTO_PRODUCT_ANUAL,
                name: 'Editaliza Premium Anual',
                price: 897.00,
                currency: 'BRL',
                billingCycle: 'annual'
            }
        }
    },

    // Configuração de rate limiting
    rateLimiting: {
        webhooks: {
            windowMs: 60000, // 1 minuto
            maxRequests: 200, // 200 requests por minuto por IP
            skipSuccessfulRequests: false
        },
        api: {
            windowMs: 60000, // 1 minuto
            maxRequests: 100 // 100 requests por minuto
        }
    },

    // Configuração de circuit breaker
    circuitBreaker: {
        maxFailures: 5,
        resetTimeout: 60000, // 1 minuto
        monitoringWindow: 300000 // 5 minutos
    },

    // Configuração de logs e auditoria
    logging: {
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        logSensitiveData: false,
        auditWebhooks: true,
        auditApiCalls: true
    },

    // Configuração de cache
    cache: {
        ttl: {
            subscription: 300, // 5 minutos
            transaction: 600, // 10 minutos
            productInfo: 3600 // 1 hora
        },
        keyPrefix: 'cackto:'
    },

    // Configuração de retry e dead letter queue
    queue: {
        retryAttempts: 3,
        retryBackoff: 'exponential', // exponential ou fixed
        deadLetterRetention: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
        batchSize: 10
    },

    // Validação de dados
    validation: {
        strictMode: process.env.NODE_ENV === 'production',
        requiredFields: {
            webhook: ['id', 'event', 'data', 'created_at'],
            transaction: ['id', 'status', 'amount', 'customer'],
            subscription: ['id', 'status', 'plan', 'customer']
        }
    }
};

// Validação de configuração obrigatória
function validateConfig() {
    const required = [
        'CACKTO_API_KEY',
        'CACKTO_SECRET_KEY',
        'CACKTO_WEBHOOK_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Configuração CACKTO incompleta. Faltam: ${missing.join(', ')}`);
    }

    // Validar produtos se estiver em produção
    if (process.env.NODE_ENV === 'production') {
        const productKeys = [
            'CACKTO_PRODUCT_MENSAL',
            'CACKTO_PRODUCT_SEMESTRAL',
            'CACKTO_PRODUCT_ANUAL'
        ];

        const missingProducts = productKeys.filter(key => !process.env[key]);
        
        if (missingProducts.length > 0) {
            console.warn(`Produtos CACKTO não configurados: ${missingProducts.join(', ')}`);
        }
    }
}

// Executar validação na inicialização
if (process.env.NODE_ENV !== 'test') {
    validateConfig();
}

module.exports = config;