// webhooks.js - Rotas para webhooks da CACKTO
const express = require('express');
const CacktoWebhookValidator = require('../webhooks/validator');
const CacktoWebhookProcessor = require('../webhooks/processor');
const AuditModel = require('../../subscription/models/audit');
const { asyncHandler } = require('../../utils/error-handler');

const router = express.Router();
const webhookValidator = new CacktoWebhookValidator();
const webhookProcessor = new CacktoWebhookProcessor();

// Middleware para capturar raw body
router.use('/cackto', CacktoWebhookValidator.rawBodyMiddleware);

// Rate limiting específico para webhooks CACKTO
router.use('/cackto', CacktoWebhookValidator.createWebhookRateLimit({
    windowMs: 60000, // 1 minuto
    maxRequests: 200, // 200 requests por minuto
    keyGenerator: (req) => req.ip
}));

/**
 * POST /api/webhooks/cackto
 * Endpoint principal para receber webhooks da CACKTO
 */
router.post('/cackto', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    
    try {
        // 1. Validar webhook
        const validatedWebhook = await webhookValidator.validateWebhook(req);
        
        // 2. Processar webhook
        const result = await webhookProcessor.processWebhook(validatedWebhook, req);
        
        // 3. Responder com sucesso
        res.status(200).json({
            success: true,
            processingId: result.processingId,
            processingTime: Date.now() - startTime,
            message: 'Webhook CACKTO processado com sucesso'
        });
        
    } catch (error) {
        // Log do erro para monitoramento
        await AuditModel.logEvent({
            entityType: 'CACKTO_WEBHOOK_ERROR',
            entityId: req.body?.id || 'unknown',
            action: 'WEBHOOK_PROCESSING_FAILED',
            userId: null,
            details: {
                error: error.message,
                type: error.type,
                processingTime: Date.now() - startTime,
                body: req.body,
                headers: {
                    'user-agent': req.headers['user-agent'],
                    'content-type': req.headers['content-type']
                }
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'ERROR'
        });
        
        // Retornar erro apropriado
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            error: error.message,
            type: error.type || 'CACKTO_WEBHOOK_ERROR',
            processingTime: Date.now() - startTime
        });
    }
}));

/**
 * GET /api/webhooks/cackto/health
 * Health check para monitoramento da integração CACKTO
 */
router.get('/cackto/health', asyncHandler(async (req, res) => {
    const CacktoService = require('../services/cacktoService');
    const CacheService = require('../../subscription/services/cache');
    
    const [cacktoHealth, cacheHealth] = await Promise.all([
        CacktoService.healthCheck(),
        CacheService.healthCheck()
    ]);
    
    const overallStatus = 
        cacktoHealth.status === 'healthy' && 
        cacheHealth.status === 'healthy' 
            ? 'healthy' : 'degraded';
    
    res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
            cackto: cacktoHealth,
            cache: cacheHealth
        },
        integration: 'CACKTO',
        version: process.env.npm_package_version || '1.0.0'
    });
}));

/**
 * GET /api/webhooks/cackto/stats
 * Estatísticas de processamento de webhooks CACKTO
 * Requer autenticação de admin
 */
router.get('/cackto/stats', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const db = require('../../../database');
    const timeframe = req.query.timeframe || '24h';
    
    let timeCondition;
    switch (timeframe) {
        case '1h':
            timeCondition = "created_at > datetime('now', '-1 hour')";
            break;
        case '24h':
            timeCondition = "created_at > datetime('now', '-1 day')";
            break;
        case '7d':
            timeCondition = "created_at > datetime('now', '-7 days')";
            break;
        case '30d':
            timeCondition = "created_at > datetime('now', '-30 days')";
            break;
        default:
            timeCondition = "created_at > datetime('now', '-1 day')";
    }
    
    const [webhookStats, errorStats, subscriptionStats] = await Promise.all([
        db.all(`
            SELECT 
                event_type,
                status,
                COUNT(*) as count,
                AVG(processing_time) as avg_processing_time,
                MAX(processing_time) as max_processing_time
            FROM webhook_events 
            WHERE ${timeCondition}
            AND event_type LIKE 'cackto.%' OR event_type IN (
                'payment.approved', 'payment.rejected', 'payment.cancelled', 'payment.refunded',
                'subscription.created', 'subscription.activated', 'subscription.suspended', 
                'subscription.cancelled', 'subscription.renewed', 'subscription.expired',
                'chargeback.created', 'chargeback.resolved'
            )
            GROUP BY event_type, status
            ORDER BY event_type, status
        `),
        db.all(`
            SELECT 
                action,
                COUNT(*) as count
            FROM audit_events
            WHERE entity_type = 'CACKTO_WEBHOOK_VALIDATION'
            AND ${timeCondition}
            AND severity IN ('WARN', 'ERROR')
            GROUP BY action
            ORDER BY count DESC
        `),
        db.get(`
            SELECT 
                COUNT(*) as total_subscriptions,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
                COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_subscriptions,
                SUM(amount) as total_revenue
            FROM subscriptions
            WHERE cackto_transaction_id IS NOT NULL
            AND ${timeCondition.replace('created_at', 'created_at')}
        `)
    ]);
    
    res.json({
        timeframe,
        integration: 'CACKTO',
        webhook_stats: webhookStats,
        error_stats: errorStats,
        subscription_stats: subscriptionStats,
        generated_at: new Date().toISOString()
    });
}));

/**
 * POST /api/webhooks/cackto/test
 * Endpoint para testes de webhook em desenvolvimento
 */
if (process.env.NODE_ENV === 'development') {
    router.post('/cackto/test', asyncHandler(async (req, res) => {
        const testWebhook = {
            id: `test_${Date.now()}`,
            event: req.body.event || 'payment.approved',
            created_at: new Date().toISOString(),
            data: req.body.data || {
                id: `test_txn_${Date.now()}`,
                amount: 97.00,
                currency: 'BRL',
                status: 'approved',
                customer: {
                    email: 'test@example.com',
                    name: 'Test User',
                    document: '12345678901'
                },
                product: {
                    id: 'test_product',
                    code: 'editaliza-premium-mensal',
                    name: 'Editaliza Premium Mensal'
                },
                payment_method: 'credit_card',
                created_at: new Date().toISOString()
            }
        };
        
        const mockReq = {
            ...req,
            body: testWebhook,
            headers: {
                ...req.headers,
                'x-cackto-timestamp': Math.floor(Date.now() / 1000).toString(),
                'x-cackto-signature': 'test_signature_for_development'
            },
            ip: req.ip || '127.0.0.1'
        };
        
        try {
            // Processar webhook de teste
            const result = await webhookProcessor.processWebhook({
                payload: testWebhook,
                validationId: `test_validation_${Date.now()}`,
                validationTime: 0
            }, mockReq);
            
            res.json({
                success: true,
                message: 'Webhook CACKTO de teste processado com sucesso',
                result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                type: error.type
            });
        }
    }));
}

/**
 * POST /api/webhooks/cackto/sync/:subscriptionId
 * Força sincronização de uma assinatura específica
 * Requer autenticação de admin
 */
router.post('/cackto/sync/:subscriptionId', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const { subscriptionId } = req.params;
    const CacktoSubscriptionManager = require('../services/subscriptionManager');
    
    try {
        const result = await CacktoSubscriptionManager.syncSubscriptionWithCackto(subscriptionId);
        
        await AuditModel.logEvent({
            entityType: 'CACKTO_MANUAL_SYNC',
            entityId: subscriptionId,
            action: 'MANUAL_SYNC_TRIGGERED',
            userId: req.user?.id,
            details: {
                subscriptionId,
                syncResult: result,
                triggeredBy: req.user?.email || 'system'
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'INFO'
        });
        
        res.json({
            success: true,
            message: 'Sincronização iniciada com sucesso',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            subscriptionId
        });
    }
}));

/**
 * GET /api/webhooks/cackto/events/:eventId
 * Busca detalhes de um evento específico
 * Requer autenticação de admin
 */
router.get('/cackto/events/:eventId', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const { eventId } = req.params;
    const db = require('../../../database');
    
    const event = await db.get(`
        SELECT 
            webhook_id,
            event_type,
            status,
            processing_id,
            raw_payload,
            created_at,
            processed_at,
            error_message
        FROM webhook_events 
        WHERE webhook_id = ? OR processing_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `, [eventId, eventId]);
    
    if (!event) {
        return res.status(404).json({
            success: false,
            error: 'Evento não encontrado'
        });
    }
    
    // Parse do payload se existir
    if (event.raw_payload) {
        try {
            event.payload = JSON.parse(event.raw_payload);
            delete event.raw_payload; // Remover raw para economizar espaço na resposta
        } catch (e) {
            // Manter raw_payload se não conseguir fazer parse
        }
    }
    
    res.json({
        success: true,
        event
    });
}));

/**
 * POST /api/webhooks/cackto/retry/:webhookId
 * Reprocessa webhook específico
 * Requer autenticação de admin
 */
router.post('/cackto/retry/:webhookId', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const { webhookId } = req.params;
    const db = require('../../../database');
    
    // Buscar webhook para reprocessamento
    const webhook = await db.get(`
        SELECT raw_payload, event_type
        FROM webhook_events 
        WHERE webhook_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    `, [webhookId]);
    
    if (!webhook) {
        return res.status(404).json({
            success: false,
            error: 'Webhook não encontrado'
        });
    }
    
    try {
        const payload = JSON.parse(webhook.raw_payload);
        
        // Criar mock request para reprocessamento
        const mockReq = {
            body: payload,
            headers: {
                'user-agent': 'Manual-Retry',
                'x-cackto-timestamp': Math.floor(Date.now() / 1000).toString()
            },
            ip: req.ip
        };
        
        // Reprocessar
        const result = await webhookProcessor.processWebhook({
            payload,
            validationId: `retry_${Date.now()}`,
            validationTime: 0
        }, mockReq);
        
        await AuditModel.logEvent({
            entityType: 'CACKTO_WEBHOOK_RETRY',
            entityId: webhookId,
            action: 'MANUAL_RETRY',
            userId: req.user?.id,
            details: {
                webhookId,
                eventType: webhook.event_type,
                retryResult: result,
                triggeredBy: req.user?.email || 'system'
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'INFO'
        });
        
        res.json({
            success: true,
            message: 'Webhook reprocessado com sucesso',
            result
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            webhookId
        });
    }
}));

module.exports = router;