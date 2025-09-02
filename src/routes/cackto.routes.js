/**
 * Rotas do Cackto - Integração com sistema de pagamentos
 * 
 * Este arquivo conecta as rotas de webhook do Cackto ao servidor principal
 * Processa eventos de pagamento, assinatura e chargeback
 */

const express = require('express');
const router = express.Router();

// Importar rotas de webhook da integração Cackto
const cacktoWebhookRoutes = require('../cackto-integration/routes/webhooks');

// Montar as rotas de webhook no path base
// Todas as rotas do webhook estarão disponíveis em /api/webhooks/*
router.use('/', cacktoWebhookRoutes);

// Rota adicional para verificar status da integração
router.get('/status', (req, res) => {
    res.json({
        status: 'active',
        integration: 'CACKTO',
        endpoints: {
            webhook: '/api/webhooks/cackto',
            health: '/api/webhooks/cackto/health',
            stats: '/api/webhooks/cackto/stats',
            test: process.env.NODE_ENV === 'development' ? '/api/webhooks/cackto/test' : null
        },
        timestamp: new Date().toISOString()
    });
});

module.exports = router;