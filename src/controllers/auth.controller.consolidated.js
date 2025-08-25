/**
 * Consolidated Auth Controller
 * 
 * Este arquivo consolida TODAS as funções de autenticação que estavam
 * espalhadas entre server.js e authController.js
 * 
 * IMPORTANTE: Mantém 100% da lógica e segurança existente
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

// Services
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const { emailRateLimitService } = require('../services/emailRateLimitService');

// Utils
const db = require('../../database-postgresql');
const logger = require('../utils/logger');
const { sanitizeHtml } = require('../utils/sanitizer');
const { 
    createSafeError, 
    securityLog,
    generateCSRFToken 
} = require('../utils/security');

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Register a new user
 * POST /api/auth/register
 * 
 * Mantém toda a lógica do server.js linhas 738-771
 */
const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Verificar se o e-mail já está em uso
        const existingUser = await db.getAsync(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            logger.warn('REGISTER_DUPLICATE_EMAIL', { email, ip: req.ip });
            return res.status(400).json({ 
                error: 'Este e-mail já está em uso' 
            });
        }

        // Criar o usuário
        const result = await db.runAsync(
            'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, datetime("now"))',
            [email, hashedPassword]
        );

        const userId = result.lastID;

        // Gerar token JWT
        const token = jwt.sign(
            { id: userId, email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN, issuer: 'editaliza' }
        );

        logger.info('USER_REGISTERED', { userId, email });
        
        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: { id: userId, email }
        });
    } catch (error) {
        logger.error('REGISTER_ERROR', error);
        res.status(500).json({ 
            error: 'Erro ao criar usuário. Tente novamente.' 
        });
    }
};

/**
 * User login
 * POST /api/auth/login
 * 
 * Mantém toda a lógica do server.js linhas 783-824
 */
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Buscar usuário
        const user = await db.getAsync(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            logger.warn('LOGIN_USER_NOT_FOUND', { email, ip: req.ip });
            return res.status(401).json({ 
                error: 'Credenciais inválidas' 
            });
        }

        // Verificar conta OAuth
        if (user.auth_provider === 'google' && !user.password_hash) {
            return res.status(401).json({ 
                error: 'Esta conta foi criada com Google. Use o login do Google.' 
            });
        }

        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password_hash || '');
        if (!validPassword) {
            logger.warn('LOGIN_INVALID_PASSWORD', { email, ip: req.ip });
            return res.status(401).json({ 
                error: 'Credenciais inválidas' 
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN, issuer: 'editaliza' }
        );

        // Atualizar último login
        await db.runAsync(
            'UPDATE users SET last_login = datetime("now") WHERE id = ?',
            [user.id]
        );

        // Configurar sessão
        if (req.session) {
            req.session.userId = user.id;
            req.session.loginTime = new Date();
        }

        logger.info('USER_LOGIN', { userId: user.id, email });

        res.json({
            message: 'Login bem-sucedido!',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        logger.error('LOGIN_ERROR', error);
        res.status(500).json({ 
            error: 'Erro no login. Tente novamente.' 
        });
    }
};

/**
 * Get CSRF Token
 * GET /api/auth/csrf-token
 * 
 * Mantém lógica do server.js linhas 877-887
 */
const getCsrfToken = (req, res) => {
    // Gerar token CSRF se não existir na sessão
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    
    res.json({ 
        csrfToken: req.session.csrfToken,
        info: 'Use este token no header x-csrf-token para requisições POST/PUT/DELETE'
    });
};

/**
 * User logout
 * POST /api/auth/logout
 * 
 * Mantém lógica do server.js linhas 903-910
 */
const logout = async (req, res) => {
    try {
        // Destruir sessão
        req.session.destroy((err) => {
            if (err) {
                logger.error('LOGOUT_ERROR', err);
                return res.status(500).json({ 
                    error: 'Erro ao fazer logout' 
                });
            }
            
            logger.info('USER_LOGOUT', { userId: req.user?.id });
            res.json({ 
                message: 'Logout realizado com sucesso' 
            });
        });
    } catch (error) {
        logger.error('LOGOUT_ERROR', error);
        res.status(500).json({ 
            error: 'Erro ao fazer logout' 
        });
    }
};

/**
 * Request password reset
 * POST /api/auth/password/request
 * 
 * Mantém TODA a lógica do server.js linhas 913-986
 */
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    try {
        // Verificar rate limits
        const rateLimitCheck = emailRateLimitService.checkLimits(email, clientIP);
        if (!rateLimitCheck.allowed) {
            logger.warn('PASSWORD_RESET_RATE_LIMITED', { 
                email, 
                ip: clientIP,
                reason: rateLimitCheck.reason 
            });
            return res.status(429).json({ 
                error: rateLimitCheck.message 
            });
        }

        // Buscar usuário
        const user = await db.getAsync(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            // Não revelar se o email existe ou não
            logger.info('PASSWORD_RESET_USER_NOT_FOUND', { email });
            return res.json({ 
                message: 'Se o e-mail existir em nossa base, você receberá instruções de recuperação.' 
            });
        }

        // Verificar se é conta OAuth
        if (user.auth_provider === 'google' && !user.password_hash) {
            return res.status(400).json({ 
                error: 'Esta conta foi criada com Google. Use o login do Google para acessar.' 
            });
        }

        // Gerar token de recuperação
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hora

        // Salvar token no banco
        await db.runAsync(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, resetExpires.toISOString(), user.id]
        );

        // Enviar email
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
        
        const emailSent = await emailService.sendPasswordResetEmail(
            email,
            resetToken,
            user.name || email.split('@')[0]
        );

        if (emailSent) {
            // Registrar tentativa bem-sucedida
            emailRateLimitService.recordAttempt(email, clientIP);
            
            logger.info('PASSWORD_RESET_EMAIL_SENT', { 
                userId: user.id, 
                email 
            });
            
            res.json({ 
                message: 'E-mail de recuperação enviado com sucesso!' 
            });
        } else {
            throw new Error('Falha ao enviar e-mail');
        }
    } catch (error) {
        logger.error('PASSWORD_RESET_ERROR', error);
        res.status(500).json({ 
            error: 'Erro ao processar solicitação. Tente novamente mais tarde.' 
        });
    }
};

/**
 * Reset password with token
 * POST /api/auth/password/reset
 * 
 * Mantém TODA a lógica do server.js linhas 988-1009
 */
const resetPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token, password } = req.body;

        // Buscar usuário com token válido
        const user = await db.getAsync(
            `SELECT * FROM users 
             WHERE reset_token = ? 
             AND datetime(reset_token_expires) > datetime('now')`,
            [token]
        );

        if (!user) {
            logger.warn('PASSWORD_RESET_INVALID_TOKEN', { token });
            return res.status(400).json({ 
                error: 'Token inválido ou expirado' 
            });
        }

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Atualizar senha e limpar token
        await db.runAsync(
            `UPDATE users 
             SET password_hash = ?, 
                 reset_token = NULL, 
                 reset_token_expires = NULL 
             WHERE id = ?`,
            [hashedPassword, user.id]
        );

        logger.info('PASSWORD_RESET_SUCCESS', { 
            userId: user.id, 
            email: user.email 
        });

        res.json({ 
            message: 'Senha redefinida com sucesso!' 
        });
    } catch (error) {
        logger.error('PASSWORD_RESET_ERROR', error);
        res.status(500).json({ 
            error: 'Erro ao redefinir senha. Tente novamente.' 
        });
    }
};

/**
 * Get session token (for OAuth)
 * GET /api/auth/session-token
 * 
 * Mantém lógica do server.js linhas 863-875
 */
const getSessionToken = (req, res) => {
    if (req.session.authSuccess && req.session.authToken) {
        const token = req.session.authToken;
        
        // Limpar dados da sessão após enviar
        delete req.session.authSuccess;
        delete req.session.authToken;
        
        res.json({ 
            success: true, 
            token: token 
        });
    } else {
        res.status(404).json({ 
            success: false, 
            error: 'Token não encontrado na sessão' 
        });
    }
};

/**
 * Get Google OAuth status
 * GET /api/auth/google/status
 * 
 * Mantém lógica do server.js linhas 890-900
 */
const getGoogleStatus = async (req, res) => {
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            auth_provider: req.user.auth_provider
        }
    });
};

/**
 * Get current user info
 * GET /api/auth/me
 * 
 * Nova rota para obter informações do usuário autenticado
 */
const getCurrentUser = async (req, res) => {
    try {
        const user = await db.getAsync(
            'SELECT id, email, name, created_at, last_login, auth_provider FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        res.json({ user });
    } catch (error) {
        logger.error('GET_USER_ERROR', error);
        res.status(500).json({ 
            error: 'Erro ao buscar dados do usuário' 
        });
    }
};

/**
 * Refresh JWT token
 * POST /api/auth/refresh
 * 
 * Nova rota para renovar token JWT
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ 
                error: 'Refresh token é obrigatório' 
            });
        }

        // Verificar refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        
        // Buscar usuário
        const user = await db.getAsync(
            'SELECT id, email FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ 
                error: 'Usuário não encontrado' 
            });
        }

        // Gerar novo token
        const newToken = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN, issuer: 'editaliza' }
        );

        res.json({ 
            token: newToken,
            expiresIn: JWT_EXPIRES_IN
        });
    } catch (error) {
        logger.error('REFRESH_TOKEN_ERROR', error);
        res.status(401).json({ 
            error: 'Token inválido ou expirado' 
        });
    }
};

/**
 * Health check endpoint
 * GET /api/auth/health
 * 
 * Nova rota para verificar saúde do serviço de autenticação
 */
const healthCheck = async (req, res) => {
    try {
        // Verificar conexão com banco
        const dbCheck = await db.getAsync('SELECT 1 as ok');
        
        res.json({
            status: 'healthy',
            service: 'authentication',
            database: dbCheck ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('HEALTH_CHECK_ERROR', error);
        res.status(503).json({
            status: 'unhealthy',
            service: 'authentication',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = {
    // Rotas principais
    register,
    login,
    logout,
    getCsrfToken,
    
    // Password reset
    requestPasswordReset,
    resetPassword,
    
    // OAuth
    getSessionToken,
    getGoogleStatus,
    
    // Novas rotas úteis
    getCurrentUser,
    refreshToken,
    healthCheck
};