// index.js - Ponto de entrada principal do sistema de assinaturas Kiwify
const express = require('express');
const subscriptionConfig = require('./config/subscription');
const { AppError, ERROR_TYPES } = require('../utils/error-handler');

// Importar modelos
const SubscriptionModel = require('./models/subscription');
const AuditModel = require('./models/audit');

// Importar serviços
const KiwifyService = require('./services/kiwify');
const CacheService = require('./services/cache');

// Importar middleware
const SubscriptionMiddleware = require('./middleware/subscription');

// Importar rotas
const webhookRoutes = require('./routes/webhooks');
const subscriptionRoutes = require('./routes/subscriptions');

// Importar sistema de fila
const WebhookQueue = require('./webhooks/queue');

class SubscriptionSystem {
    constructor() {
        this.app = express();
        this.initialized = false;
        this.healthStatus = {
            status: 'initializing',
            services: {},
            lastCheck: null
        };
    }

    /**
     * Inicializa o sistema de assinaturas
     * @param {Object} options - Opções de inicialização
     */
    async initialize(options = {}) {
        const {
            skipHealthCheck = false,
            skipCacheInit = false,
            verbose = false
        } = options;

        try {
            if (verbose) {
                console.log('🚀 Inicializando sistema de assinaturas Kiwify...');
            }

            // 1. Validar configuração
            await this.validateConfiguration();

            // 2. Inicializar serviços
            await this.initializeServices({ skipCacheInit, verbose });

            // 3. Configurar rotas
            this.setupRoutes();

            // 4. Verificar conectividade (se não for pulado)
            if (!skipHealthCheck) {
                await this.performHealthCheck();
            }

            // 5. Registrar inicialização
            await this.logInitialization();

            this.initialized = true;
            this.healthStatus.status = 'healthy';

            if (verbose) {
                console.log('✅ Sistema de assinaturas inicializado com sucesso');
            }

            return true;

        } catch (error) {
            this.healthStatus.status = 'unhealthy';
            this.healthStatus.error = error.message;

            if (verbose) {
                console.error('❌ Erro na inicialização do sistema de assinaturas:', error.message);
            }

            throw new AppError(
                'Falha na inicialização do sistema de assinaturas',
                ERROR_TYPES.INITIALIZATION_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Valida configuração do sistema
     */
    async validateConfiguration() {
        try {
            // Validar configuração em produção
            if (process.env.NODE_ENV === 'production') {
                subscriptionConfig.validateProduction();
            }

            // Verificar banco de dados
            const db = require('./utils/database');
            await db.get('SELECT 1'); // Teste de conectividade

            // Verificar tabelas necessárias
            const requiredTables = [
                'subscriptions',
                'audit_events',
                'webhook_events',
                'subscription_settings'
            ];

            for (const table of requiredTables) {
                try {
                    await db.get(`SELECT 1 FROM ${table} LIMIT 1`);
                } catch (error) {
                    throw new Error(`Tabela ${table} não encontrada. Execute o setup do banco primeiro.`);
                }
            }

        } catch (error) {
            throw new Error(`Configuração inválida: ${error.message}`);
        }
    }

    /**
     * Inicializa serviços
     */
    async initializeServices({ skipCacheInit, verbose }) {
        try {
            // Inicializar cache se não for pulado
            if (!skipCacheInit) {
                if (verbose) {
                    console.log('  💾 Inicializando sistema de cache...');
                }
                // Cache é inicializado automaticamente
                const cacheHealth = await CacheService.healthCheck();
                this.healthStatus.services.cache = cacheHealth;
            }

            // Verificar conectividade com Kiwify
            if (verbose) {
                console.log('  🔗 Verificando conectividade com Kiwify...');
            }
            const kiwifyHealth = await KiwifyService.healthCheck();
            this.healthStatus.services.kiwify = kiwifyHealth;

            // Inicializar fila de webhooks
            if (verbose) {
                console.log('  📎 Inicializando fila de webhooks...');
            }
            const queueStats = WebhookQueue.getQueueStats();
            this.healthStatus.services.queue = {
                status: 'healthy',
                stats: queueStats
            };

        } catch (error) {
            throw new Error(`Erro na inicialização dos serviços: ${error.message}`);
        }
    }

    /**
     * Configura rotas do sistema
     */
    setupRoutes() {
        // Middleware de parsing JSON
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Rotas de webhook
        this.app.use('/api/webhooks', webhookRoutes);

        // Rotas de assinaturas
        this.app.use('/api/subscriptions', subscriptionRoutes);

        // Rota de health check do sistema
        this.app.get('/api/subscription-system/health', async (req, res) => {
            try {
                const health = await this.getHealthStatus();
                const statusCode = health.status === 'healthy' ? 200 : 503;
                res.status(statusCode).json(health);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Rota de informações do sistema
        this.app.get('/api/subscription-system/info', (req, res) => {
            res.json({
                system: 'Editaliza Subscription System',
                version: '1.0.0',
                provider: 'Kiwify',
                initialized: this.initialized,
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                features: [
                    'webhook_processing',
                    'subscription_management',
                    'audit_logging',
                    'cache_optimization',
                    'rate_limiting',
                    'security_validation'
                ]
            });
        });
    }

    /**
     * Realiza verificação de saúde dos serviços
     */
    async performHealthCheck() {
        try {
            // Verificar cache
            const cacheHealth = await CacheService.healthCheck();
            this.healthStatus.services.cache = cacheHealth;

            // Verificar Kiwify
            const kiwifyHealth = await KiwifyService.healthCheck();
            this.healthStatus.services.kiwify = kiwifyHealth;

            // Verificar fila
            const queueStats = WebhookQueue.getQueueStats();
            this.healthStatus.services.queue = {
                status: queueStats.ready > 100 ? 'degraded' : 'healthy',
                stats: queueStats
            };

            // Verificar banco de dados
            const db = require('./utils/database');
            const dbStart = Date.now();
            await db.get('SELECT datetime(\'now\') as current_time');
            const dbResponseTime = Date.now() - dbStart;

            this.healthStatus.services.database = {
                status: dbResponseTime < 1000 ? 'healthy' : 'degraded',
                responseTime: dbResponseTime
            };

            this.healthStatus.lastCheck = new Date().toISOString();

            // Determinar status geral
            const serviceStatuses = Object.values(this.healthStatus.services).map(s => s.status);
            if (serviceStatuses.includes('unhealthy')) {
                this.healthStatus.status = 'unhealthy';
            } else if (serviceStatuses.includes('degraded')) {
                this.healthStatus.status = 'degraded';
            } else {
                this.healthStatus.status = 'healthy';
            }

        } catch (error) {
            this.healthStatus.status = 'unhealthy';
            this.healthStatus.error = error.message;
            throw error;
        }
    }

    /**
     * Registra inicialização no sistema de auditoria
     */
    async logInitialization() {
        try {
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION_SYSTEM',
                entityId: 'system_initialization',
                action: 'SYSTEM_STARTED',
                userId: null,
                details: {
                    version: '1.0.0',
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV || 'development',
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    services: Object.keys(this.healthStatus.services)
                },
                severity: 'INFO'
            });
        } catch (error) {
            console.warn('Erro ao registrar inicialização:', error.message);
        }
    }

    /**
     * Obtém status de saúde atual
     */
    async getHealthStatus() {
        // Atualizar health check se foi há mais de 1 minuto
        const lastCheck = this.healthStatus.lastCheck ? new Date(this.healthStatus.lastCheck) : null;
        const now = new Date();
        
        if (!lastCheck || (now - lastCheck) > 60000) {
            try {
                await this.performHealthCheck();
            } catch (error) {
                console.warn('Erro no health check:', error.message);
            }
        }

        return {
            ...this.healthStatus,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Middleware para verificar se sistema está inicializado
     */
    requireInitialized() {
        return (req, res, next) => {
            if (!this.initialized) {
                return res.status(503).json({
                    error: 'Sistema de assinaturas não inicializado',
                    type: 'SYSTEM_NOT_READY'
                });
            }
            next();
        };
    }

    /**
     * Obtém instância do middleware de assinatura
     */
    getSubscriptionMiddleware() {
        return SubscriptionMiddleware;
    }

    /**
     * Obtém modelos do sistema
     */
    getModels() {
        return {
            Subscription: SubscriptionModel,
            Audit: AuditModel
        };
    }

    /**
     * Obtém serviços do sistema
     */
    getServices() {
        return {
            Kiwify: KiwifyService,
            Cache: CacheService,
            Queue: WebhookQueue
        };
    }

    /**
     * Obtém configurações do sistema
     */
    getConfig() {
        return subscriptionConfig.getConfig();
    }

    /**
     * Finaliza sistema graciosamente
     */
    async shutdown() {
        try {
            console.log('🛑 Finalizando sistema de assinaturas...');

            // Registrar shutdown
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION_SYSTEM',
                entityId: 'system_shutdown',
                action: 'SYSTEM_STOPPED',
                userId: null,
                details: {
                    uptime: process.uptime(),
                    reason: 'graceful_shutdown'
                },
                severity: 'INFO'
            });

            // Limpar cache se necessário
            if (subscriptionConfig.cache.enableRedis) {
                await CacheService.flush();
            }

            this.initialized = false;
            this.healthStatus.status = 'stopped';

            console.log('✅ Sistema de assinaturas finalizado');

        } catch (error) {
            console.error('❌ Erro ao finalizar sistema:', error.message);
        }
    }

    /**
     * Obtém instância do app Express
     */
    getApp() {
        return this.app;
    }
}

// Singleton para garantir uma única instância
const subscriptionSystem = new SubscriptionSystem();

// Exportar tanto a classe quanto a instância
module.exports = {
    SubscriptionSystem,
    subscriptionSystem,
    
    // Exports diretos para conveniência
    models: {
        Subscription: SubscriptionModel,
        Audit: AuditModel
    },
    
    services: {
        Kiwify: KiwifyService,
        Cache: CacheService,
        Queue: WebhookQueue
    },
    
    middleware: {
        Subscription: SubscriptionMiddleware
    },
    
    config: subscriptionConfig
};