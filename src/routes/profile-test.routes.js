/**
 * Profile Routes - Versão de Teste (SEM importar controller)
 * Para identificar se o travamento está na importação do controller
 */

const express = require('express');
const router = express.Router();

// Middleware
const { authenticateToken } = require('../middleware/auth.middleware');

console.log('[PROFILE TEST ROUTES] Arquivo carregado!');

/**
 * @route GET /api/profile-test
 * @desc Obter perfil do usuário autenticado (versão de teste)
 * @access Private
 */
router.get('/', authenticateToken(), (req, res) => {
    console.log('[PROFILE TEST] Usuario autenticado:', req.user?.id);
    res.json({
        success: true,
        message: 'TESTE: Perfil obtido com sucesso (SEM controller)',
        user: {
            id: req.user?.id || 'N/A',
            email: req.user?.email || 'N/A',
            name: req.user?.name || 'N/A'
        },
        timestamp: new Date().toISOString(),
        teste: 'Esta rota NÃO importa o controller'
    });
});

module.exports = router;