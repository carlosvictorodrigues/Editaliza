/**
 * Auth Controller - Handles all authentication-related HTTP requests
 * 
 * This controller manages user registration, login, logout, password reset,
 * OAuth integration, and profile management that was previously in server.js
 */

const authService = require('../services/authService');
const { sanitizeHtml } = require('../utils/sanitizer');
const { createSafeError, securityLog } = require('../utils/security');

/**
 * Register a new user
 * POST /auth/register
 */
const register = async (req, res) => {
    try {
        const result = await authService.register(req.body, req);
        res.status(201).json(result);
    } catch (error) {
        securityLog('register_error', error.message, null, req);
        
        if (error.message.includes('já está em uso')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao criar usuário'));
        }
    }
};

/**
 * User login
 * POST /auth/login
 */
const login = async (req, res) => {
    try {
        const result = await authService.login(req.body, req);
        
        // Set session data
        req.session.userId = result.user.id;
        req.session.loginTime = new Date();
        
        // CORREÇÃO: Verificar se o usuário tem planos para decidir o redirecionamento
        const userHasPlans = await authService.checkIfUserHasPlans(result.user.id);
        
        res.json({
            ...result,
            redirectUrl: userHasPlans ? 'home.html' : 'dashboard.html'
        });
    } catch (error) {
        securityLog('login_error', error.message, null, req);
        
        if (error.message.includes('inválidos') || 
            error.message.includes('Google') ||
            error.message.includes('tentativas')) {
            res.status(401).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro no login'));
        }
    }
};

/**
 * Process Google OAuth callback
 * This is called by Passport middleware, not directly by HTTP requests
 */
const processGoogleCallback = async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await authService.processGoogleCallback(profile);
        return done(null, user);
    } catch (error) {
        console.error('Google OAuth Error:', error);
        return done(error, null);
    }
};

/**
 * Get Google OAuth status
 * GET /auth/google/status
 */
const getGoogleStatus = async (req, res) => {
    try {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                auth_provider: req.user.auth_provider
            }
        });
    } catch (error) {
        res.status(500).json(createSafeError(error, 'Erro ao verificar status'));
    }
};

/**
 * User logout
 * POST /auth/logout
 */
const logout = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        req.session.destroy((err) => {
            if (err) {
                securityLog('logout_session_error', err.message, userId, req);
                return res.status(500).json({ error: 'Erro ao fazer logout' });
            }
            
            securityLog('user_logout', { userId }, userId, req);
            res.json({ message: 'Logout realizado com sucesso' });
        });
    } catch (error) {
        res.status(500).json(createSafeError(error, 'Erro ao fazer logout'));
    }
};

/**
 * Request password reset
 * POST /auth/request-password-reset
 */
const requestPasswordReset = async (req, res) => {
    try {
        const result = await authService.requestPasswordReset(req.body.email, req);
        res.json(result);
    } catch (error) {
        securityLog('password_reset_request_error', error.message, null, req);
        
        if (error.message.includes('Google') ||
            error.message.includes('solicitações')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao processar solicitação'));
        }
    }
};

/**
 * Reset password with token
 * POST /auth/reset-password
 */
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const result = await authService.resetPassword(token, password, req);
        res.json(result);
    } catch (error) {
        securityLog('password_reset_error', error.message, null, req);
        
        if (error.message.includes('inválido') || 
            error.message.includes('expirado')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao redefinir senha'));
        }
    }
};

/**
 * Get user profile
 * GET /auth/profile
 */
const getProfile = async (req, res) => {
    try {
        const profile = await authService.getUserProfile(req.user.id, req);
        res.json(profile);
    } catch (error) {
        securityLog('get_profile_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar perfil'));
        }
    }
};

/**
 * Update user profile
 * PUT /auth/profile
 */
const updateProfile = async (req, res) => {
    try {
        const updatedProfile = await authService.updateUserProfile(req.user.id, req.body, req);
        res.json(updatedProfile);
    } catch (error) {
        securityLog('update_profile_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao atualizar perfil'));
    }
};

/**
 * Verify token
 * GET /auth/verify
 */
const verifyToken = async (req, res) => {
    try {
        // Token already verified by middleware, just return user info
        res.json({
            valid: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            }
        });
    } catch (error) {
        res.status(500).json(createSafeError(error, 'Erro na verificação'));
    }
};

/**
 * Refresh JWT token
 * POST /auth/refresh
 */
const refreshToken = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }
        
        const result = await authService.refreshToken(token, req);
        
        // Update session
        if (req.session) {
            req.session.userId = result.user.id;
            req.session.loginTime = new Date();
        }
        
        res.json(result);
    } catch (error) {
        securityLog('token_refresh_error', error.message, null, req);
        
        if (error.message.includes('expirado') ||
            error.message.includes('inválido') ||
            error.message.includes('malformado') ||
            error.message.includes('antigo')) {
            res.status(401).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao renovar token'));
        }
    }
};

/**
 * Upload profile photo
 * POST /auth/profile/upload-photo
 * This endpoint handles file uploads and requires special middleware
 */
const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        
        const photoUrl = `/uploads/${req.file.filename}`;
        
        // Update user profile with photo URL
        await authService.updateUserProfile(req.user.id, {
            profile_picture: photoUrl
        }, req);
        
        securityLog('profile_photo_uploaded', { userId: req.user.id, filename: req.file.filename }, req.user.id, req);
        
        res.json({
            message: 'Foto de perfil atualizada com sucesso',
            profilePicture: photoUrl
        });
    } catch (error) {
        securityLog('profile_photo_upload_error', error.message, req.user?.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao fazer upload da foto'));
    }
};

/**
 * Check authentication status
 * GET /auth/status
 */
const getAuthStatus = async (req, res) => {
    try {
        // This endpoint is called without authentication middleware
        // to check if user has valid session/token
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.json({ authenticated: false });
        }
        
        const user = await authService.verifyToken(token);
        
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        res.json({ authenticated: false });
    }
};

module.exports = {
    register,
    login,
    processGoogleCallback,
    getGoogleStatus,
    logout,
    requestPasswordReset,
    resetPassword,
    getProfile,
    updateProfile,
    verifyToken,
    refreshToken,
    uploadProfilePhoto,
    getAuthStatus
};
