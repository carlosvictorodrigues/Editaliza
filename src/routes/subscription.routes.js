/**
 * Rotas de Gerenciamento de Assinaturas
 * 
 * Endpoints para:
 * - Verificar status da assinatura
 * - Executar manutenção manual (admin)
 * - Consultar planos expirando
 * - Renovar assinaturas
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { checkSubscription, requireActiveSubscription } = require('../middleware/subscription.middleware');
const subscriptionMaintenanceService = require('../services/subscriptionMaintenanceService');
const { dbGet, dbAll } = require('../config/database');

/**
 * GET /api/subscription/status
 * Retorna status detalhado da assinatura do usuário atual
 */
router.get('/status', authenticateToken(), checkSubscription, async (req, res) => {
    try {
        if (!req.subscription) {
            return res.status(404).json({
                success: false,
                error: 'Informações de assinatura não disponíveis'
            });
        }

        res.json({
            success: true,
            subscription: req.subscription
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao obter status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao obter status da assinatura'
        });
    }
});

/**
 * GET /api/subscription/check
 * Verifica se o usuário tem assinatura ativa (retorna true/false)
 */
router.get('/check', authenticateToken(), checkSubscription, (req, res) => {
    res.json({
        success: true,
        is_active: req.subscription?.is_active || false,
        days_remaining: req.subscription?.days_remaining || 0
    });
});

/**
 * POST /api/subscription/maintenance/run
 * Executa job de manutenção manualmente (ADMIN ONLY)
 */
router.post('/maintenance/run', authenticateToken(), async (req, res) => {
    try {
        // Verificar se é admin (implementar verificação real aqui)
        const user = await dbGet('SELECT email, is_admin FROM users WHERE id = ?', [req.user.id]);
        
        // Por enquanto, permitir apenas para emails específicos
        const adminEmails = ['carlosvictorodrigues@gmail.com', 'admin@editaliza.com.br'];
        
        if (!adminEmails.includes(user.email)) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado. Apenas administradores podem executar esta ação.'
            });
        }

        console.log(`[SUBSCRIPTION] Manutenção manual iniciada por ${user.email}`);
        
        const results = await subscriptionMaintenanceService.runMaintenance();
        
        res.json({
            success: true,
            message: 'Manutenção executada com sucesso',
            results
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Erro na manutenção manual:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao executar manutenção'
        });
    }
});

/**
 * GET /api/subscription/maintenance/status
 * Retorna status do serviço de manutenção (ADMIN ONLY)
 */
router.get('/maintenance/status', authenticateToken(), async (req, res) => {
    try {
        // Verificar se é admin
        const user = await dbGet('SELECT email FROM users WHERE id = ?', [req.user.id]);
        const adminEmails = ['carlosvictorodrigues@gmail.com', 'admin@editaliza.com.br'];
        
        if (!adminEmails.includes(user.email)) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        const status = subscriptionMaintenanceService.getStatus();
        
        res.json({
            success: true,
            maintenance: status
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao obter status de manutenção:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao obter status'
        });
    }
});

/**
 * GET /api/subscription/expiring
 * Lista usuários com planos expirando (ADMIN ONLY)
 */
router.get('/expiring', authenticateToken(), async (req, res) => {
    try {
        // Verificar se é admin
        const user = await dbGet('SELECT email FROM users WHERE id = ?', [req.user.id]);
        const adminEmails = ['carlosvictorodrigues@gmail.com', 'admin@editaliza.com.br'];
        
        if (!adminEmails.includes(user.email)) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        const days = parseInt(req.query.days) || 7;
        
        const expiringUsers = await dbAll(`
            SELECT 
                id,
                email, 
                name, 
                plan_type, 
                plan_expiry,
                plan_status,
                EXTRACT(DAY FROM (plan_expiry - NOW())) as days_remaining
            FROM users
            WHERE plan_status = 'active'
            AND plan_expiry BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
            ORDER BY plan_expiry ASC
        `);

        res.json({
            success: true,
            count: expiringUsers.length,
            users: expiringUsers
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao buscar usuários expirando:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar usuários'
        });
    }
});

/**
 * GET /api/subscription/expired
 * Lista usuários com planos expirados (ADMIN ONLY)
 */
router.get('/expired', authenticateToken(), async (req, res) => {
    try {
        // Verificar se é admin
        const user = await dbGet('SELECT email FROM users WHERE id = ?', [req.user.id]);
        const adminEmails = ['carlosvictorodrigues@gmail.com', 'admin@editaliza.com.br'];
        
        if (!adminEmails.includes(user.email)) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        const expiredUsers = await dbAll(`
            SELECT 
                id,
                email, 
                name, 
                plan_type, 
                plan_expiry,
                plan_status,
                EXTRACT(DAY FROM (NOW() - plan_expiry)) as days_expired
            FROM users
            WHERE plan_status = 'expired'
            OR (plan_expiry < NOW() AND plan_expiry IS NOT NULL)
            ORDER BY plan_expiry DESC
            LIMIT 100
        `);

        res.json({
            success: true,
            count: expiredUsers.length,
            users: expiredUsers
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao buscar usuários expirados:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar usuários'
        });
    }
});

module.exports = router;