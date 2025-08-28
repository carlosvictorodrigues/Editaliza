/**
 * Auth Routes - Rotas de autenticação integradas com authController
 * 
 * Esta versão utiliza o authController.js existente com todas as suas 
 * funcionalidades de segurança, validação e JWT já implementadas.
 */

const express = require('express');
// const passport = require('passport'); // DESABILITADO: OAuth removido (integração Cackto)
const rateLimit = require('express-rate-limit');

// Importar controller de autenticação
const authController = require('../controllers/authController');

// Importar middlewares de validação
const { authenticateToken } = require('../middleware/auth.middleware');
const { authenticateTokenSimple } = require('../middleware/auth-simple.middleware');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');

const router = express.Router();

// === RATE LIMITING ===

// Rate limit para login/register
const strictAuthLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_AUTH'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limit para password reset
const passwordResetLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
    message: {
        error: 'Muitas solicitações de reset de senha. Tente novamente em 1 hora.',
        code: 'RATE_LIMIT_PASSWORD_RESET'
    }
});

// Rate limit geral para outras operações
const generalAuthLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 100,
    message: {
        error: 'Muitas requisições. Tente novamente em alguns minutos.',
        code: 'RATE_LIMIT_GENERAL'
    }
});

// === VALIDAÇÕES ===

// Validação para registro usando validators existentes
const registerValidation = [
    validators.email,
    validators.password,
    validators.text('name', 2, 100).optional()
];

// Validação para login
const loginValidation = [
    validators.email,
    validators.password
];

// === ROTAS ===

// GET /api/auth/status - Health check
router.get('/status', generalAuthLimit, authController.getAuthStatus);

// GET /api/auth/test - Teste simples para debug
router.get('/test', (req, res) => {
    res.json({ 
        message: 'Auth routes funcionando!', 
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL Simple'
    });
});

// POST /api/auth/register - Registrar novo usuário
router.post('/register', 
    // strictAuthLimit,  // Temporariamente desabilitado para debug
    // registerValidation,  // Temporariamente desabilitado para debug
    // handleValidationErrors,  // Temporariamente desabilitado para debug
    authController.register
);

// POST /api/auth/login - Login de usuário  
router.post('/login',
    // strictAuthLimit,  // Temporariamente desabilitado para debug
    // loginValidation,  // Temporariamente desabilitado para debug
    // handleValidationErrors,  // Temporariamente desabilitado para debug
    authController.login
);

// GET /api/auth/profile - Obter dados do usuário atual
router.get('/profile',
    authenticateToken(),
    authController.getProfile
);

// PUT /api/auth/profile - Atualizar perfil do usuário
router.put('/profile',
    authenticateToken(),
    authController.updateProfile
);

// POST /api/auth/logout - Logout de usuário
router.post('/logout',
    authenticateToken(),
    authController.logout
);

// POST /api/auth/request-password-reset - Solicitar reset de senha
router.post('/request-password-reset',
    passwordResetLimit,
    [validators.email],
    handleValidationErrors,
    authController.requestPasswordReset
);

// POST /api/auth/reset-password - Redefinir senha com token
router.post('/reset-password',
    passwordResetLimit,
    [
        validators.text('token', 1, 200),
        validators.password
    ],
    handleValidationErrors,
    authController.resetPassword
);

// GET /api/auth/verify - Verificar token
router.get('/verify',
    authenticateToken(),
    authController.verifyToken
);

// POST /api/auth/refresh - Refresh token
router.post('/refresh',
    generalAuthLimit,
    authController.refreshToken
);

// === GOOGLE OAUTH ROUTES ===

// DESABILITADO: OAuth do Google será removido (integração com Cackto)
// Os usuários receberão credenciais por email após pagamento na plataforma Cackto

// // GET /api/auth/google - Iniciar Google OAuth
// router.get('/google',
//     passport.authenticate('google', { scope: ['profile', 'email'] })
// );
// 
// // GET /api/auth/google/callback - Callback do Google OAuth
// router.get('/google/callback',
//     passport.authenticate('google', { session: false }),
//     (req, res) => {
//         // O usuário está em req.user após autenticação bem-sucedida
//         const token = authController.generateJWT(req.user);
//         
//         // Redirecionar com token (ou definir cookie)
//         res.cookie('authToken', token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'strict',
//             maxAge: 24 * 60 * 60 * 1000 // 24 horas
//         });
//         
//         // Redirecionar para frontend
//         res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000/dashboard.html');
//     }
// );

// GET /api/auth/google/status - Status do Google OAuth
// DESABILITADO: OAuth do Google será removido (integração com Cackto)
// router.get('/google/status',
//     authenticateToken,
//     authController.getGoogleStatus
// );

module.exports = router;