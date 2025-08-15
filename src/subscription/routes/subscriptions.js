// subscriptions.js - Rotas para gerenciamento de assinaturas
const express = require('express');
const SubscriptionModel = require('../models/subscription');
const SubscriptionMiddleware = require('../middleware/subscription');
const KiwifyService = require('../services/kiwify');
const AuditModel = require('../models/audit');
const { asyncHandler } = require('../../utils/error-handler');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

/**
 * GET /api/subscriptions/my
 * Obtém assinatura do usuário autenticado
 */
router.get('/my', 
    // TODO: Adicionar middleware de autenticação
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        
        const subscription = await SubscriptionModel.findActiveByUserId(userId);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Nenhuma assinatura ativa encontrada',
                hasSubscription: false
            });
        }
        
        // Remover dados sensíveis
        const sanitizedSubscription = {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            created_at: subscription.created_at,
            expires_at: subscription.expires_at,
            features: SubscriptionMiddleware.getPlanFeatures(subscription.plan)
        };
        
        res.json({
            success: true,
            subscription: sanitizedSubscription,
            hasSubscription: true
        });
    })
);

/**
 * GET /api/subscriptions/status
 * Verifica status de acesso do usuário
 */
router.get('/status',
    // TODO: Adicionar middleware de autenticação
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        
        const hasActiveSubscription = await SubscriptionModel.hasActiveSubscription(userId);
        const subscription = hasActiveSubscription ? 
            await SubscriptionModel.findActiveByUserId(userId) : null;
        
        res.json({
            success: true,
            hasActiveSubscription,
            plan: subscription?.plan || 'free',
            features: SubscriptionMiddleware.getPlanFeatures(subscription?.plan || 'free'),
            expiresAt: subscription?.expires_at,
            status: subscription?.status || 'none'
        });
    })
);

/**
 * POST /api/subscriptions/sync
 * Força sincronização com Kiwify
 */
router.post('/sync',
    // TODO: Adicionar middleware de autenticação
    asyncHandler(async (req, res) => {
        const userId = req.user.id;
        
        const subscription = await SubscriptionModel.findActiveByUserId(userId);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Nenhuma assinatura encontrada para sincronizar'
            });
        }
        
        try {
            const syncResult = await KiwifyService.syncSubscription(
                subscription.kiwify_transaction_id
            );
            
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscription.id,
                action: 'MANUAL_SYNC_REQUESTED',
                userId,
                details: {
                    syncResult,
                    requestedBy: req.user.email
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'INFO'
            });
            
            res.json({
                success: true,
                message: 'Sincronização realizada com sucesso',
                syncResult
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao sincronizar com Kiwify',
                details: error.message
            });
        }
    })
);

/**
 * GET /api/subscriptions/plans
 * Lista planos disponíveis
 */
router.get('/plans', asyncHandler(async (req, res) => {
    const plans = {
        free: {
            name: 'Gratuito',
            price: 0,
            currency: 'BRL',
            duration: 'indefinido',
            features: SubscriptionMiddleware.getPlanFeatures('free'),
            limitations: {
                cronogramas: 1,
                simulados_por_mes: 5,
                suporte: 'comunidade'
            }
        },
        premium: {
            name: 'Premium Mensal',
            price: 97.00,
            currency: 'BRL',
            duration: '1 mês',
            features: SubscriptionMiddleware.getPlanFeatures('premium'),
            limitations: {
                cronogramas: 'ilimitado',
                simulados_por_mes: 'ilimitado',
                suporte: 'prioritário'
            },
            recommended: true
        },
        premium_anual: {
            name: 'Premium Anual',
            price: 970.00,
            currency: 'BRL',
            duration: '12 meses',
            features: SubscriptionMiddleware.getPlanFeatures('premium_anual'),
            limitations: {
                cronogramas: 'ilimitado',
                simulados_por_mes: 'ilimitado',
                suporte: 'prioritário + consultoria'
            },
            discount: {
                percentage: 16.7,
                savings: 194.00
            },
            bestValue: true
        }
    };
    
    res.json({
        success: true,
        plans
    });
}));

/**
 * GET /api/subscriptions/admin/list
 * Lista todas as assinaturas (admin)
 */
router.get('/admin/list',
    // TODO: Adicionar middleware de autenticação de admin
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('status').optional().isIn(['active', 'cancelled', 'suspended', 'expired', 'refunded', 'trialing']),
        query('plan').optional().isString()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const {
            page = 1,
            limit = 50,
            status,
            plan,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;
        
        const result = await SubscriptionModel.list({
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            plan,
            sortBy,
            sortOrder
        });
        
        res.json({
            success: true,
            ...result
        });
    })
);

/**
 * GET /api/subscriptions/admin/:subscriptionId
 * Detalhes de uma assinatura específica (admin)
 */
router.get('/admin/:subscriptionId',
    // TODO: Adicionar middleware de autenticação de admin
    asyncHandler(async (req, res) => {
        const { subscriptionId } = req.params;
        
        const subscription = await SubscriptionModel.findById(subscriptionId);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Assinatura não encontrada'
            });
        }
        
        // Buscar logs de auditoria
        const auditLogs = await SubscriptionModel.getAuditLogs(subscriptionId, {
            limit: 20
        });
        
        res.json({
            success: true,
            subscription,
            auditLogs
        });
    })
);

/**
 * POST /api/subscriptions/admin/:subscriptionId/cancel
 * Cancela assinatura (admin)
 */
router.post('/admin/:subscriptionId/cancel',
    // TODO: Adicionar middleware de autenticação de admin
    [
        body('reason').notEmpty().withMessage('Razão é obrigatória'),
        body('cancelInKiwify').optional().isBoolean()
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        
        const { subscriptionId } = req.params;
        const { reason, cancelInKiwify = false } = req.body;
        
        const subscription = await SubscriptionModel.findById(subscriptionId);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'Assinatura não encontrada'
            });
        }
        
        try {
            // Cancelar no Kiwify se solicitado
            if (cancelInKiwify) {
                await KiwifyService.cancelSubscription(
                    subscription.kiwify_transaction_id,
                    reason
                );
            }
            
            // Cancelar localmente
            const updatedSubscription = await SubscriptionModel.cancel(subscriptionId, {
                reason,
                cancelledBy: req.user.id,
                adminAction: true,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: subscriptionId,
                action: 'ADMIN_CANCELLATION',
                userId: req.user.id,
                details: {
                    reason,
                    cancelInKiwify,
                    previousStatus: subscription.status,
                    cancelledBy: req.user.email
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'WARN'
            });
            
            res.json({
                success: true,
                message: 'Assinatura cancelada com sucesso',
                subscription: updatedSubscription
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Erro ao cancelar assinatura',
                details: error.message
            });
        }
    })
);

/**
 * GET /api/subscriptions/admin/stats
 * Estatísticas de assinaturas (admin)
 */
router.get('/admin/stats',
    // TODO: Adicionar middleware de autenticação de admin
    asyncHandler(async (req, res) => {
        const db = require('../utils/database');
        
        const [subscriptionStats, revenueStats, churnStats] = await Promise.all([
            db.get('SELECT * FROM subscription_stats'),
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_subscriptions,
                    SUM(amount) as revenue
                FROM subscriptions 
                WHERE created_at > date('now', '-30 days')
                AND status = 'active'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `),
            db.all(`
                SELECT 
                    DATE(updated_at) as date,
                    COUNT(*) as cancellations
                FROM subscriptions 
                WHERE updated_at > date('now', '-30 days')
                AND status = 'cancelled'
                GROUP BY DATE(updated_at)
                ORDER BY date DESC
            `)
        ]);
        
        res.json({
            success: true,
            overview: subscriptionStats,
            revenue_trend: revenueStats,
            churn_trend: churnStats,
            generated_at: new Date().toISOString()
        });
    })
);

/**
 * POST /api/subscriptions/admin/export
 * Exporta dados de assinaturas (admin)
 */
router.post('/admin/export',
    // TODO: Adicionar middleware de autenticação de admin
    [
        body('format').optional().isIn(['json', 'csv']),
        body('startDate').optional().isISO8601(),
        body('endDate').optional().isISO8601(),
        body('status').optional().isArray()
    ],
    asyncHandler(async (req, res) => {
        const {
            format = 'json',
            startDate,
            endDate,
            status
        } = req.body;
        
        const filters = {};
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (status) filters.status = status;
        
        const result = await SubscriptionModel.list({
            ...filters,
            limit: 10000 // Grande limite para exportação
        });
        
        await AuditModel.logEvent({
            entityType: 'DATA_EXPORT',
            entityId: `export_${Date.now()}`,
            action: 'SUBSCRIPTION_DATA_EXPORT',
            userId: req.user.id,
            details: {
                format,
                filters,
                recordCount: result.data.length,
                exportedBy: req.user.email
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            severity: 'INFO'
        });
        
        if (format === 'csv') {
            // TODO: Implementar conversão para CSV
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.csv');
            // Implementar CSV
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=subscriptions.json');
        }
        
        res.json({
            success: true,
            exported_at: new Date().toISOString(),
            filters,
            data: result.data
        });
    })
);

module.exports = router;