/**
 * Consolidated Auth Routes
 * 
 * Este arquivo consolida TODAS as rotas de autenticação,
 * incluindo as que estavam no server.js e authRoutes.js
 * 
 * IMPORTANTE: Mantém 100% da segurança e validações existentes
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

// Controllers
const authController = require('../controllers/auth.controller.consolidated');
const oauthController = require('../controllers/oauthController');

// Middleware
const { 
    authenticateToken,
    validators,
    handleValidationErrors,
    sanitizeMiddleware,
    csrfProtection
} = require('../../middleware');

const { createPasswordRecoveryRateLimit } = require('../services/emailRateLimitService');

// ============================================================================
// RATE LIMITING CONFIGURATIONS
// ============================================================================

// Login/Register: 5 tentativas a cada 15 minutos
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

// Password reset: 3 tentativas por hora
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Muitas solicitações de redefinição. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false
});

// CSRF token: 20 requisições por minuto
const csrfLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Muitas requisições de token CSRF.' }
});

// ============================================================================
// MIDDLEWARE GLOBAL PARA TODAS AS ROTAS
// ============================================================================

// Aplicar sanitização em todas as rotas
router.use(sanitizeMiddleware);

// ============================================================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ============================================================================

/**
 * @route POST /api/auth/register
 * @desc Registrar novo usuário
 * @access Public
 */
router.post('/register',
    authLimiter,
    validators.email,
    validators.password,
    handleValidationErrors,
    authController.register
);

/**
 * @route POST /api/auth/login
 * @desc Login de usuário
 * @access Public
 */
router.post('/login',
    authLimiter,
    validators.email,
    validators.password,
    handleValidationErrors,
    authController.login
);

/**
 * @route GET /api/auth/csrf-token
 * @desc Obter token CSRF para requisições
 * @access Public
 */
router.get('/csrf-token',
    csrfLimiter,
    authController.getCsrfToken
);

/**
 * @route POST /api/auth/password/request
 * @desc Solicitar redefinição de senha
 * @access Public
 */
router.post('/password/request',
    createPasswordRecoveryRateLimit(),
    validators.email,
    handleValidationErrors,
    authController.requestPasswordReset
);

/**
 * @route POST /api/auth/password/reset
 * @desc Redefinir senha com token
 * @access Public
 */
router.post('/password/reset',
    passwordResetLimiter,
    body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
    validators.password,
    handleValidationErrors,
    authController.resetPassword
);

/**
 * @route GET /api/auth/session-token
 * @desc Obter token da sessão (usado após OAuth)
 * @access Public (mas requer sessão válida)
 */
router.get('/session-token',
    authController.getSessionToken
);

// ============================================================================
// ROTAS OAUTH (GOOGLE)
// ============================================================================

/**
 * @route GET /api/auth/google
 * @desc Iniciar autenticação com Google
 * @access Public
 */
router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
);

/**
 * @route GET /api/auth/google/callback
 * @desc Callback do Google OAuth
 * @access Public
 */
router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login.html?error=oauth_failed' 
    }),
    (req, res) => {
        // Gerar token JWT após autenticação bem-sucedida
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                id: req.user.id, 
                email: req.user.email 
            },
            process.env.JWT_SECRET || 'dev-secret-change-in-production',
            { 
                expiresIn: '24h',
                issuer: 'editaliza'
            }
        );
        
        // Salvar token na sessão temporariamente
        req.session.authSuccess = true;
        req.session.authToken = token;
        
        // Redirecionar para o frontend
        res.redirect('/login.html?auth_success=1');
    }
);

// ============================================================================
// ROTAS PROTEGIDAS (REQUEREM AUTENTICAÇÃO)
// ============================================================================

/**
 * @route POST /api/auth/logout
 * @desc Fazer logout do usuário
 * @access Private
 */
router.post('/logout',
    authenticateToken,
    authController.logout
);

/**
 * @route GET /api/auth/google/status
 * @desc Verificar status do OAuth Google
 * @access Private
 */
router.get('/google/status',
    authenticateToken,
    authController.getGoogleStatus
);

/**
 * @route GET /api/auth/me
 * @desc Obter informações do usuário autenticado
 * @access Private
 */
router.get('/me',
    authenticateToken,
    authController.getCurrentUser
);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar token JWT
 * @access Public (mas requer refresh token válido)
 */
router.post('/refresh',
    body('refreshToken').notEmpty().withMessage('Refresh token é obrigatório'),
    handleValidationErrors,
    authController.refreshToken
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * @route GET /api/auth/health
 * @desc Verificar saúde do serviço de autenticação
 * @access Public
 */
router.get('/health',
    authController.healthCheck
);

// ============================================================================
// ROTAS DE COMPATIBILIDADE (TEMPORÁRIAS)
// ============================================================================

// Estas rotas existem apenas para manter compatibilidade durante a migração
// Elas redirecionam internamente para as novas rotas padronizadas

/**
 * @deprecated Use /api/auth/password/request
 */
router.post('/request-password-reset',
    (req, res, next) => {
        console.warn('[DEPRECATED] /api/auth/request-password-reset → Use /api/auth/password/request');
        req.url = '/password/request';
        next();
    },
    createPasswordRecoveryRateLimit(),
    validators.email,
    handleValidationErrors,
    authController.requestPasswordReset
);

/**
 * @deprecated Use /api/auth/password/reset
 */
router.post('/reset-password',
    (req, res, next) => {
        console.warn('[DEPRECATED] /api/auth/reset-password → Use /api/auth/password/reset');
        req.url = '/password/reset';
        next();
    },
    passwordResetLimiter,
    body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
    validators.password,
    handleValidationErrors,
    authController.resetPassword
);

module.exports = router;