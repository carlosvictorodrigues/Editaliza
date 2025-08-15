// index.js - Ponto de entrada principal para integração CACKTO
const CacktoService = require('./services/cacktoService');
const CacktoSubscriptionManager = require('./services/subscriptionManager');
const CacktoWebhookValidator = require('./webhooks/validator');
const CacktoWebhookProcessor = require('./webhooks/processor');
const CacktoMiddleware = require('./middleware/checkCacktoSubscription');
const CacktoRoutes = require('./routes/webhooks');
const CacktoConfig = require('./config/cackto.config');

/**
 * Integração CACKTO - Editaliza
 * 
 * Esta integração fornece:
 * - Processamento robusto de webhooks
 * - Gerenciamento completo de assinaturas  
 * - Validação criptográfica de segurança
 * - Rate limiting e proteção contra ataques
 * - Circuit breaker para resiliência
 * - Sistema de auditoria completo
 * - Cache para performance
 * - Retry automático e dead letter queue
 */

class CacktoIntegration {
    constructor() {
        this.service = CacktoService;
        this.subscriptionManager = CacktoSubscriptionManager;
        this.webhookValidator = new CacktoWebhookValidator();
        this.webhookProcessor = new CacktoWebhookProcessor();
        this.config = CacktoConfig;
        this.isInitialized = false;
    }

    /**
     * Inicializa a integração CACKTO
     * @param {Object} options - Opções de inicialização
     */
    async initialize(options = {}) {
        try {
            console.log('🚀 Inicializando integração CACKTO...');

            // Validar configurações obrigatórias
            this.validateConfiguration();

            // Inicializar componentes
            await this.initializeComponents(options);

            // Verificar conectividade
            await this.checkConnectivity();

            // Sincronizar configurações se necessário
            if (options.syncOnInit) {
                await this.syncConfigurations();
            }

            this.isInitialized = true;
            console.log('✅ Integração CACKTO inicializada com sucesso');

            return {
                success: true,
                message: 'Integração CACKTO inicializada',
                version: this.getVersion(),
                config: this.getSafeConfig()
            };

        } catch (error) {
            console.error('❌ Erro ao inicializar integração CACKTO:', error.message);
            throw error;
        }
    }

    /**
     * Valida configurações obrigatórias
     */
    validateConfiguration() {
        const required = [
            'CACKTO_API_KEY',
            'CACKTO_SECRET_KEY', 
            'CACKTO_WEBHOOK_SECRET'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Configurações CACKTO ausentes: ${missing.join(', ')}`);
        }
    }

    /**
     * Inicializa componentes internos
     */
    async initializeComponents(options) {
        // Configurar cache se especificado
        if (options.enableCache !== false) {
            const CacheService = require('./services/cacheService');
            await CacheService.initialize();
        }

        // Configurar métricas se especificado
        if (options.enableMetrics) {
            await this.initializeMetrics();
        }

        // Configurar rate limiting se especificado
        if (options.enableRateLimit !== false) {
            await this.initializeRateLimit();
        }
    }

    /**
     * Verifica conectividade com CACKTO
     */
    async checkConnectivity() {
        const health = await this.service.healthCheck();
        
        if (health.status !== 'healthy') {
            console.warn('⚠️ CACKTO API não está saudável:', health.error);
        } else {
            console.log(`✅ Conectividade CACKTO OK (${health.responseTime}ms)`);
        }
    }

    /**
     * Sincroniza configurações com o banco
     */
    async syncConfigurations() {
        console.log('🔄 Sincronizando configurações...');
        
        const db = require('../../database');
        
        // Atualizar mapeamentos de produtos
        const productMappings = this.config.products.planMapping;
        
        for (const [planCode, planData] of Object.entries(productMappings)) {
            if (planData.cacktoProductId) {
                await db.run(`
                    UPDATE cackto_product_mapping 
                    SET cackto_product_id = ?, price = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE internal_plan_code = ?
                `, [planData.cacktoProductId, planData.price, planCode]);
            }
        }
        
        console.log('✅ Configurações sincronizadas');
    }

    /**
     * Inicializa sistema de métricas
     */
    async initializeMetrics() {
        console.log('📊 Inicializando métricas...');
        
        // Configurar coleta de métricas básicas
        setInterval(async () => {
            await this.collectMetrics();
        }, 60000); // A cada minuto
    }

    /**
     * Coleta métricas da integração
     */
    async collectMetrics() {
        try {
            const db = require('../../database');
            
            // Métricas de assinaturas
            const subscriptionMetrics = await db.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                    SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as active_revenue
                FROM subscriptions 
                WHERE cackto_transaction_id IS NOT NULL
            `);

            // Salvar métricas
            await db.run(`
                INSERT INTO integration_metrics (metric_name, metric_value, metric_type, processor)
                VALUES (?, ?, ?, ?)
            `, ['active_subscriptions', subscriptionMetrics.active, 'gauge', 'cackto']);

            await db.run(`
                INSERT INTO integration_metrics (metric_name, metric_value, metric_type, processor) 
                VALUES (?, ?, ?, ?)
            `, ['active_revenue', subscriptionMetrics.active_revenue || 0, 'gauge', 'cackto']);

        } catch (error) {
            console.error('Erro ao coletar métricas:', error);
        }
    }

    /**
     * Inicializa rate limiting
     */
    async initializeRateLimit() {
        console.log('🛡️ Inicializando rate limiting...');
        // Rate limiting é configurado nos middlewares
    }

    /**
     * Obtém status atual da integração
     */
    async getStatus() {
        if (!this.isInitialized) {
            return {
                status: 'not_initialized',
                message: 'Integração não foi inicializada'
            };
        }

        try {
            const [serviceHealth, subscriptionStats] = await Promise.all([
                this.service.healthCheck(),
                this.subscriptionManager.getSubscriptionMetrics()
            ]);

            return {
                status: 'healthy',
                initialized: true,
                service: serviceHealth,
                subscriptions: subscriptionStats,
                config: this.getSafeConfig(),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Processa webhook CACKTO
     */
    async processWebhook(req, res) {
        if (!this.isInitialized) {
            throw new Error('Integração CACKTO não inicializada');
        }

        // Validar webhook
        const validatedWebhook = await this.webhookValidator.validateWebhook(req);
        
        // Processar webhook
        const result = await this.webhookProcessor.processWebhook(validatedWebhook, req);
        
        return result;
    }

    /**
     * Força sincronização de assinatura
     */
    async syncSubscription(subscriptionId) {
        if (!this.isInitialized) {
            throw new Error('Integração CACKTO não inicializada');
        }

        return await this.subscriptionManager.syncSubscriptionWithCackto(subscriptionId);
    }

    /**
     * Cancela assinatura
     */
    async cancelSubscription(userId, reason) {
        if (!this.isInitialized) {
            throw new Error('Integração CACKTO não inicializada');
        }

        return await this.subscriptionManager.cancelUserSubscription(userId, reason);
    }

    /**
     * Verifica assinatura do usuário
     */
    async checkUserSubscription(userId) {
        if (!this.isInitialized) {
            throw new Error('Integração CACKTO não inicializada');
        }

        return await this.subscriptionManager.checkUserSubscription(userId);
    }

    /**
     * Obtém configurações seguras (sem dados sensíveis)
     */
    getSafeConfig() {
        return {
            api: {
                baseURL: this.config.api.baseURL,
                timeout: this.config.api.timeout
            },
            events: {
                supported: this.config.events.supported
            },
            rateLimiting: this.config.rateLimiting,
            circuitBreaker: this.config.circuitBreaker,
            cache: this.config.cache
        };
    }

    /**
     * Obtém versão da integração
     */
    getVersion() {
        return process.env.npm_package_version || '1.0.0';
    }

    /**
     * Finaliza integração e limpa recursos
     */
    async shutdown() {
        console.log('🔌 Finalizando integração CACKTO...');
        
        // Limpar intervalos de métricas
        // Fechar conexões se necessário
        // Flush de cache se necessário
        
        this.isInitialized = false;
        console.log('✅ Integração CACKTO finalizada');
    }
}

// Singleton da integração
const cacktoIntegration = new CacktoIntegration();

// Exportações individuais para compatibilidade
module.exports = {
    // Instância principal
    CacktoIntegration: cacktoIntegration,
    
    // Serviços
    CacktoService,
    CacktoSubscriptionManager,
    
    // Webhooks
    CacktoWebhookValidator,
    CacktoWebhookProcessor,
    
    // Middleware
    ...CacktoMiddleware,
    
    // Rotas
    CacktoRoutes,
    
    // Configuração
    CacktoConfig,
    
    // Helpers de inicialização
    async initialize(options = {}) {
        return await cacktoIntegration.initialize(options);
    },
    
    async getStatus() {
        return await cacktoIntegration.getStatus();
    },
    
    async processWebhook(req, res) {
        return await cacktoIntegration.processWebhook(req, res);
    },
    
    async syncSubscription(subscriptionId) {
        return await cacktoIntegration.syncSubscription(subscriptionId);
    },
    
    async cancelSubscription(userId, reason) {
        return await cacktoIntegration.cancelSubscription(userId, reason);
    },
    
    async checkUserSubscription(userId) {
        return await cacktoIntegration.checkUserSubscription(userId);
    }
};