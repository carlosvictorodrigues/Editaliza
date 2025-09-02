/**
 * Auth Controller - Integração com authService
 * Este controller conecta as rotas ao authService real
 */

const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const { securityLog } = require('../utils/security');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-jwt-seguro-aqui';

/**
 * Registrar novo usuário
 */
const register = async (req, res) => {
    try {
        console.log('[AUTH_CONTROLLER] Iniciando registro');
        
        // Usar authService para registro
        const result = await authService.register(req.body, req);
        
        // Gerar token JWT no formato esperado pelo middleware
        // Usar dados do resultado do registro
        const token = jwt.sign(
            { 
                id: result.userId,
                email: req.body.email,
                name: req.body.name
            },
            JWT_SECRET,
            { 
                expiresIn: '24h',
                issuer: 'editaliza'
            }
        );
        
        console.log('[AUTH_CONTROLLER] Registro completo, userId:', result.userId);
        
        res.status(201).json({
            success: true,
            message: result.message,
            token,
            user: {
                id: result.userId
            }
        });
        
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Erro no registro:', error.message);
        
        // Tratar erros específicos
        if (error.message.includes('já está em uso')) {
            return res.status(409).json({
                success: false,
                error: error.message
            });
        }
        
        if (error.message.includes('inválido')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro ao criar usuário'
        });
    }
};

/**
 * Login de usuário
 */
const login = async (req, res) => {
    try {
        console.log('[AUTH_CONTROLLER] Iniciando login');
        console.log('[AUTH_CONTROLLER] Request body:', req.body);
        
        // Usar authService para login
        const result = await authService.login(req.body, req);
        
        console.log('[AUTH_CONTROLLER] Login completo, userId:', result.user.id);
        console.log('[AUTH_CONTROLLER] Token gerado:', result.token);
        
        res.json({
            success: true,
            message: result.message,
            token: result.token,
            user: result.user
        });
        
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Erro no login:', error.message);
        
        // Tratar erros específicos
        if (error.message.includes('Conta não encontrada')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
        
        if (error.message.includes('incorreta') || error.message.includes('Google')) {
            return res.status(401).json({
                success: false,
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro ao fazer login'
        });
    }
};

/**
 * Logout de usuário
 */
const logout = async (req, res) => {
    try {
        // Por enquanto, logout é simples (cliente remove o token)
        securityLog('user_logout', { userId: req.user?.id }, req.user?.id, req);
        
        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
        
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Erro no logout:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao fazer logout'
        });
    }
};

/**
 * Obter usuário atual
 */
const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }
        
        // Buscar usuário via authService
        const user = await authService.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                auth_provider: user.auth_provider
            }
        });
        
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Erro ao buscar usuário:', error.message);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar dados do usuário'
        });
    }
};

/**
 * Processar callback OAuth do Google
 */
const googleCallback = async (req, res) => {
    try {
        // O passport já autenticou o usuário
        const user = req.user;
        
        if (!user) {
            throw new Error('Falha na autenticação com Google');
        }
        
        // Gerar token JWT no formato esperado pelo middleware
        const token = jwt.sign(
            { 
                id: user.id,
                email: user.email,
                name: user.name
            },
            JWT_SECRET,
            { 
                expiresIn: '24h',
                issuer: 'editaliza'
            }
        );
        
        // Redirecionar para o frontend com o token
        res.redirect(`/home.html?token=${token}&auth=google`);
        
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Erro no callback Google:', error.message);
        res.redirect('/login.html?error=auth_failed');
    }
};

/**
 * Health check do sistema de autenticação
 */
const healthCheck = async (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'authentication',
        version: '2.0.0'
    });
};

// Funções stub para compatibilidade
const getAuthStatus = async (req, res) => {
    res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
        authenticated: !!req.user
    });
};

const getProfile = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
    });
};

const updateProfile = async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Funcionalidade não implementada'
    });
};

const verifyToken = async (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
};

const refreshToken = async (req, res) => {
    // Por enquanto, retornar 501 até implementarmos corretamente
    // O sistema de refresh tokens precisa ser implementado com cookies seguros
    res.status(501).json({
        success: false,
        error: 'Funcionalidade de refresh token ainda não implementada'
    });
};

// Importar do controller especializado
const passwordResetController = require('./passwordResetController');

// Delegar para o controller especializado
const requestPasswordReset = passwordResetController.requestPasswordReset;
const resetPassword = passwordResetController.resetPassword;

module.exports = {
    register,
    login,
    logout,
    getCurrentUser,
    googleCallback,
    healthCheck,
    getAuthStatus,
    getProfile,
    updateProfile,
    verifyToken,
    refreshToken,
    requestPasswordReset,
    resetPassword
};