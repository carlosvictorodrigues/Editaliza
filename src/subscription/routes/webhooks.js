// webhooks.js - Rotas para webhooks do Kiwify
const express = require('express');
const WebhookValidator = require('../webhooks/validator');
const WebhookProcessor = require('../webhooks/processor');
const AuditModel = require('../models/audit');
const { asyncHandler } = require('../../utils/error-handler');

const router = express.Router();
const webhookValidator = new WebhookValidator();
const webhookProcessor = new WebhookProcessor();

// Middleware para capturar raw body
router.use('/kiwify', WebhookValidator.rawBodyMiddleware);

// Rate limiting específico para webhooks
router.use('/kiwify', WebhookValidator.createWebhookRateLimit({
    windowMs: 60000, // 1 minuto
    maxRequests: 100, // 100 requests por minuto
    keyGenerator: (req) => req.ip
}));

/**
 * POST /api/webhooks/kiwify
 * Endpoint principal para receber webhooks do Kiwify
 */
router.post('/kiwify', asyncHandler(async (req, res) => {
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
            message: 'Webhook processado com sucesso'
        });
        
    } catch (error) {
        // Log do erro para monitoramento
        await AuditModel.logEvent({
            entityType: 'WEBHOOK_ERROR',
            entityId: req.body?.id || 'unknown',
            action: 'WEBHOOK_PROCESSING_FAILED',
            userId: null,
            details: {
                error: error.message,
                type: error.type,
                processingTime: Date.now() - startTime,
                body: req.body
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
            type: error.type || 'WEBHOOK_ERROR',
            processingTime: Date.now() - startTime
        });
    }
}));

/**
 * GET /api/webhooks/health
 * Health check para monitoramento
 */
router.get('/health', asyncHandler(async (req, res) => {
    const KiwifyService = require('../services/kiwify');
    const CacheService = require('../services/cache');
    const WebhookQueue = require('../webhooks/queue');
    
    const [kiwifyHealth, cacheHealth, queueStats] = await Promise.all([
        KiwifyService.healthCheck(),
        CacheService.healthCheck(),
        Promise.resolve(WebhookQueue.getQueueStats())
    ]);
    
    const overallStatus = 
        kiwifyHealth.status === 'healthy' && 
        cacheHealth.status === 'healthy' 
            ? 'healthy' : 'degraded';
    
    res.status(overallStatus === 'healthy' ? 200 : 503).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
            kiwify: kiwifyHealth,
            cache: cacheHealth,
            queue: queueStats
        },
        version: process.env.npm_package_version || '1.0.0'
    });
}));

/**
 * GET /api/webhooks/stats
 * Estatísticas de processamento de webhooks
 * Requer autenticação de admin
 */
router.get('/stats', asyncHandler(async (req, res) => {
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
    
    const [webhookStats, dlqStats, errorStats] = await Promise.all([
        db.all(`
            SELECT 
                event_type,
                status,
                COUNT(*) as count,
                AVG(processing_time) as avg_processing_time,
                MAX(processing_time) as max_processing_time
            FROM webhook_events 
            WHERE ${timeCondition}
            GROUP BY event_type, status
            ORDER BY event_type, status
        `),
        db.get(`
            SELECT COUNT(*) as total_failed
            FROM webhook_dead_letter_queue
            WHERE failed_at > datetime('now', '-${timeframe === '1h' ? '1 hour' : timeframe === '24h' ? '1 day' : timeframe === '7d' ? '7 days' : '30 days'}')
        `),
        db.all(`
            SELECT 
                action,
                COUNT(*) as count
            FROM audit_events
            WHERE entity_type = 'WEBHOOK_VALIDATION'
            AND ${timeCondition}
            AND severity IN ('WARN', 'ERROR')
            GROUP BY action
            ORDER BY count DESC
        `)
    ]);
    
    res.json({
        timeframe,
        webhook_stats: webhookStats,
        dead_letter_queue: dlqStats,
        error_stats: errorStats,
        generated_at: new Date().toISOString()
    });
}));

/**
 * POST /api/webhooks/dlq/reprocess/:webhookId
 * Reprocessa webhook da dead letter queue
 * Requer autenticação de admin
 */
router.post('/dlq/reprocess/:webhookId', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const { webhookId } = req.params;
    const WebhookQueue = require('../webhooks/queue');
    
    try {
        const success = await WebhookQueue.reprocessFromDLQ(webhookId);
        
        if (success) {
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_ADMIN',
                entityId: webhookId,
                action: 'DLQ_REPROCESS_TRIGGERED',
                userId: req.user?.id,
                details: {
                    webhookId,
                    triggeredBy: req.user?.email || 'system'
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'INFO'
            });
            
            res.json({
                success: true,
                message: 'Webhook adicionado à fila para reprocessamento',
                webhookId
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Webhook não encontrado na dead letter queue',
                webhookId
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            webhookId
        });
    }
}));

/**
 * GET /api/webhooks/dlq
 * Lista webhooks na dead letter queue
 * Requer autenticação de admin
 */
router.get('/dlq', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const WebhookQueue = require('../webhooks/queue');
    const { page = 1, limit = 50, eventType } = req.query;
    
    const dlqItems = await WebhookQueue.listDLQ({
        page: parseInt(page),
        limit: parseInt(limit),
        eventType
    });
    
    res.json({
        success: true,
        data: dlqItems,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
}));

/**
 * DELETE /api/webhooks/dlq/cleanup
 * Limpa webhooks antigos da dead letter queue
 * Requer autenticação de admin
 */
router.delete('/dlq/cleanup', asyncHandler(async (req, res) => {
    // TODO: Adicionar middleware de autenticação de admin
    
    const WebhookQueue = require('../webhooks/queue');
    const { daysOld = 30 } = req.query;
    
    const removedCount = await WebhookQueue.cleanupDLQ(parseInt(daysOld));
    
    await AuditModel.logEvent({
        entityType: 'WEBHOOK_ADMIN',
        entityId: `cleanup_${Date.now()}`,
        action: 'DLQ_CLEANUP',
        userId: req.user?.id,
        details: {
            removedCount,
            daysOld: parseInt(daysOld),
            triggeredBy: req.user?.email || 'system'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        severity: 'INFO'
    });
    
    res.json({
        success: true,
        message: `${removedCount} webhooks removidos da dead letter queue`,
        removedCount
    });
}));

/**
 * POST /api/webhooks/test
 * Endpoint para testes de webhook em desenvolvimento
 */
if (process.env.NODE_ENV === 'development') {
    router.post('/test', asyncHandler(async (req, res) => {
        const testWebhook = {
            id: `test_${Date.now()}`,
            event_type: req.body.event_type || 'order.paid',
            data: req.body.data || {
                transaction_id: `test_txn_${Date.now()}`,
                customer: {
                    email: 'test@example.com',
                    name: 'Test User'
                },
                product: {
                    id: 'test_product',
                    code: 'editaliza-premium-mensal',
                    name: 'Editaliza Premium Mensal'
                },
                total_amount: 97.00,
                currency: 'BRL',
                payment_method: 'credit_card',
                order_date: new Date().toISOString()
            }
        };
        
        const mockReq = {
            ...req,
            body: testWebhook,
            headers: {
                ...req.headers,
                'x-kiwify-timestamp': Math.floor(Date.now() / 1000).toString(),
                'x-kiwify-signature': 'test_signature_for_development'
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
                message: 'Webhook de teste processado com sucesso',
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

module.exports = router;