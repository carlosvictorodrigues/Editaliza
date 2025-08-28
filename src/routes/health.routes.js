// src/routes/health.routes.js - FASE 8 - Health Checks e Métricas

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const emailService = require('../services/emailService');
const { emailRateLimitService } = require('../services/emailRateLimitService');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');

// ==========================================
// HEALTH CHECKS
// ==========================================

// Health check endpoint for Docker/K8s (SIMPLIFICADO)
router.get('/health', (req, res) => {
    const healthCheck = {
        status: 'healthy',
        uptime: process.uptime(),
        message: 'OK',
        database: 'PostgreSQL',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    };
    
    // Resposta simples sem testar banco para evitar deadlocks
    res.status(200).json(healthCheck);
});

// Ready probe endpoint for K8s
router.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready', timestamp: Date.now() });
});

// ==========================================
// MÉTRICAS (DEPRECATED)
// ==========================================

// Legacy metrics endpoint - MIGRATED TO /api/admin/system/metrics
router.get('/metrics', authenticateToken(), (req, res) => {
    console.warn('DEPRECATED: /metrics - Use /api/admin/system/metrics instead');
    try {
        const { getMetricsReport } = require('../middleware/metrics');
        const report = getMetricsReport();
        res.json({
            ...report,
            deprecated: true,
            newEndpoint: '/api/admin/system/metrics'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao coletar métricas' });
    }
});

// ==========================================
// LEGACY ADMIN ROUTES (DEPRECATED)
// ==========================================

// Legacy email service status endpoint - MIGRATED TO /api/admin/email/status
router.get('/admin/email/status', authenticateToken(), (req, res) => {
    console.warn('DEPRECATED: /admin/email/status - Use /api/admin/email/status instead');
    try {
        const status = emailService.getStatus();
        const rateLimitStats = emailRateLimitService.getStats();
        
        res.json({
            emailService: status,
            rateLimiting: rateLimitStats,
            timestamp: new Date().toISOString(),
            deprecated: true,
            newEndpoint: '/api/admin/email/status'
        });
    } catch (error) {
        console.error('Error getting email status:', error);
        res.status(500).json({ error: 'Failed to get email status' });
    }
});

// Legacy test email endpoint - MIGRATED TO /api/admin/email/test
router.post('/admin/email/test', 
    authenticateToken(),
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        console.warn('DEPRECATED: /admin/email/test - Use /api/admin/email/test instead');
        try {
            const { email } = req.body;
            const result = await emailService.sendTestEmail(email);
            
            res.json({
                success: true,
                message: 'Test email sent successfully',
                messageId: result.messageId,
                deprecated: true,
                newEndpoint: '/api/admin/email/test'
            });
        } catch (error) {
            console.error('Test email failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send test email',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Legacy reset rate limits endpoint - MIGRATED TO /api/admin/email/reset-limits
router.post('/admin/email/reset-limits',
    authenticateToken(),
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        console.warn('DEPRECATED: /admin/email/reset-limits - Use /api/admin/email/reset-limits instead');
        try {
            const { email } = req.body;
            emailRateLimitService.resetEmailLimits(email);
            
            res.json({
                success: true,
                message: `Rate limits reset for ${email}`,
                deprecated: true,
                newEndpoint: '/api/admin/email/reset-limits'
            });
        } catch (error) {
            console.error('Failed to reset rate limits:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset rate limits'
            });
        }
    }
);

module.exports = router;
