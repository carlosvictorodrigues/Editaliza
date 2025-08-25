/**
 * Middleware de Autenticação Robusto e Seguro
 * 
 * FUNCIONALIDADES:
 * - Autenticação JWT com verificação completa
 * - Rate limiting por usuário
 * - Blacklist de tokens
 * - Refresh token handling
 * - Role-based access control (RBAC)
 * - Session validation
 * - Security logging
 * - Token rotation prevention
 * - Concurrent session management
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authLogger, securityLogger } = require('../utils/logger');
const appConfig = require('../config/app.config');

// === TOKEN BLACKLIST ===
// Em produção, usar Redis. Em desenvolvimento, usar Map em memória
class TokenBlacklist {
    constructor() {
        this.blacklist = new Map();
        this.cleanup();
    }

    add(token, expiresAt) {
        const tokenHash = this._hashToken(token);
        this.blacklist.set(tokenHash, expiresAt);
    }

    isBlacklisted(token) {
        const tokenHash = this._hashToken(token);
        const expiresAt = this.blacklist.get(tokenHash);
        
        if (!expiresAt) return false;
        
        // Token expirou naturalmente, remover da blacklist
        if (Date.now() > expiresAt * 1000) {
            this.blacklist.delete(tokenHash);
            return false;
        }
        
        return true;
    }

    _hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    // Limpeza automática de tokens expirados
    cleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [hash, expiresAt] of this.blacklist.entries()) {
                if (now > expiresAt * 1000) {
                    this.blacklist.delete(hash);
                }
            }
        }, 60 * 60 * 1000); // Limpar a cada hora
    }

    size() {
        return this.blacklist.size;
    }
}

const tokenBlacklist = new TokenBlacklist();

// === RATE LIMITING POR USUÁRIO ===
class UserRateLimit {
    constructor() {
        this.attempts = new Map();
        this.cleanup();
    }

    isRateLimited(userId) {
        const userAttempts = this.attempts.get(userId);
        if (!userAttempts) return false;

        const now = Date.now();
        const windowStart = now - (15 * 60 * 1000); // 15 minutos

        // Filtrar tentativas dentro da janela
        const recentAttempts = userAttempts.filter(attempt => attempt > windowStart);
        this.attempts.set(userId, recentAttempts);

        return recentAttempts.length >= 10; // Máximo 10 tentativas por 15 min
    }

    recordAttempt(userId) {
        const userAttempts = this.attempts.get(userId) || [];
        userAttempts.push(Date.now());
        this.attempts.set(userId, userAttempts);
    }

    cleanup() {
        setInterval(() => {
            const now = Date.now();
            const windowStart = now - (15 * 60 * 1000);

            for (const [userId, attempts] of this.attempts.entries()) {
                const recentAttempts = attempts.filter(attempt => attempt > windowStart);
                if (recentAttempts.length === 0) {
                    this.attempts.delete(userId);
                } else {
                    this.attempts.set(userId, recentAttempts);
                }
            }
        }, 5 * 60 * 1000); // Limpar a cada 5 minutos
    }
}

const userRateLimit = new UserRateLimit();

// === GERENCIAMENTO DE SESSÕES ===
class SessionManager {
    constructor() {
        this.activeSessions = new Map(); // userId -> Set of sessionIds
    }

    addSession(userId, sessionId) {
        if (!this.activeSessions.has(userId)) {
            this.activeSessions.set(userId, new Set());
        }
        
        const userSessions = this.activeSessions.get(userId);
        userSessions.add(sessionId);

        // Limitar a 5 sessões ativas por usuário
        if (userSessions.size > 5) {
            const oldestSession = userSessions.values().next().value;
            userSessions.delete(oldestSession);
            
            securityLogger.warn('Session limit exceeded, removed oldest session', {
                userId,
                sessionRemoved: oldestSession,
                totalSessions: userSessions.size
            });
        }
    }

    removeSession(userId, sessionId) {
        const userSessions = this.activeSessions.get(userId);
        if (userSessions) {
            userSessions.delete(sessionId);
            if (userSessions.size === 0) {
                this.activeSessions.delete(userId);
            }
        }
    }

    getSessionCount(userId) {
        const userSessions = this.activeSessions.get(userId);
        return userSessions ? userSessions.size : 0;
    }

    isValidSession(userId, sessionId) {
        const userSessions = this.activeSessions.get(userId);
        return userSessions ? userSessions.has(sessionId) : false;
    }
}

const sessionManager = new SessionManager();

// === EXTRAÇÃO DE TOKEN ===

function extractToken(req) {
    let token = null;

    // 1. Verificar Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }

    // 2. Verificar cookie (fallback)
    if (!token && req.cookies && req.cookies.authToken) {
        token = req.cookies.authToken;
    }

    // 3. Verificar header customizado
    if (!token && req.headers['x-auth-token']) {
        token = req.headers['x-auth-token'];
    }

    return token;
}

// === VALIDAÇÃO DE TOKEN ===

function validateToken(token, secret = appConfig.security.jwt.secret) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, {
            issuer: appConfig.security.jwt.issuer,
            algorithms: [appConfig.security.jwt.algorithm]
        }, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
}

// === MIDDLEWARE PRINCIPAL DE AUTENTICAÇÃO ===

function authenticateToken(options = {}) {
    const {
        required = true,
        allowExpired = false,
        checkSession = true,
        logFailures = true
    } = options;

    return async (req, res, next) => {
        const requestId = req.logger?.context?.requestId || crypto.randomBytes(4).toString('hex');
        const logger = authLogger.child({ requestId, ip: req.ip });

        try {
            const token = extractToken(req);

            // Token não fornecido
            if (!token) {
                if (!required) {
                    req.user = null;
                    return next();
                }

                if (logFailures) {
                    logger.security('auth_token_missing', {
                        url: req.originalUrl,
                        method: req.method,
                        userAgent: req.get('User-Agent')
                    });
                }

                return res.status(401).json({
                    error: 'Token de autenticação não fornecido',
                    code: 'AUTH_TOKEN_MISSING'
                });
            }

            // Verificar se token está na blacklist
            if (tokenBlacklist.isBlacklisted(token)) {
                if (logFailures) {
                    logger.security('auth_token_blacklisted', {
                        url: req.originalUrl,
                        method: req.method
                    });
                }

                return res.status(401).json({
                    error: 'Token inválido ou revogado',
                    code: 'AUTH_TOKEN_BLACKLISTED'
                });
            }

            // Validar token
            let decoded;
            try {
                decoded = await validateToken(token);
            } catch (error) {
                if (logFailures) {
                    const errorType = error.name === 'TokenExpiredError' ? 'token_expired' :
                                     error.name === 'JsonWebTokenError' ? 'token_invalid' :
                                     'token_error';
                    
                    logger.security(`auth_${errorType}`, {
                        error: error.message,
                        url: req.originalUrl,
                        method: req.method
                    });
                }

                if (error.name === 'TokenExpiredError') {
                    if (allowExpired) {
                        req.user = jwt.decode(token); // Decodificar sem verificar expiração
                        req.tokenExpired = true;
                        return next();
                    }
                    
                    return res.status(401).json({
                        error: 'Token expirado. Por favor, faça login novamente.',
                        code: 'AUTH_TOKEN_EXPIRED'
                    });
                }

                return res.status(401).json({
                    error: 'Token inválido',
                    code: 'AUTH_TOKEN_INVALID'
                });
            }

            // Validações adicionais do payload
            if (!decoded.id || !decoded.email) {
                if (logFailures) {
                    logger.security('auth_token_malformed', {
                        decoded: { ...decoded, iat: undefined, exp: undefined },
                        url: req.originalUrl
                    });
                }

                return res.status(401).json({
                    error: 'Token malformado',
                    code: 'AUTH_TOKEN_MALFORMED'
                });
            }

            // Verificar rate limiting
            if (userRateLimit.isRateLimited(decoded.id)) {
                logger.security('auth_rate_limited', {
                    userId: decoded.id,
                    email: decoded.email
                });

                return res.status(429).json({
                    error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.',
                    code: 'AUTH_RATE_LIMITED'
                });
            }

            // Verificar sessão se habilitado
            if (checkSession && decoded.sessionId) {
                if (!sessionManager.isValidSession(decoded.id, decoded.sessionId)) {
                    if (logFailures) {
                        logger.security('auth_invalid_session', {
                            userId: decoded.id,
                            sessionId: decoded.sessionId
                        });
                    }

                    return res.status(401).json({
                        error: 'Sessão inválida. Por favor, faça login novamente.',
                        code: 'AUTH_SESSION_INVALID'
                    });
                }
            }

            // Token válido - registrar informações do usuário
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role || 'user',
                sessionId: decoded.sessionId,
                iat: decoded.iat,
                exp: decoded.exp
            };

            // Log de autenticação bem-sucedida (apenas em debug)
            logger.debug('User authenticated successfully', {
                userId: decoded.id,
                email: decoded.email,
                role: decoded.role
            });

            next();

        } catch (error) {
            logger.error('Authentication middleware error', {
                error: error.message,
                stack: error.stack,
                url: req.originalUrl
            });

            return res.status(500).json({
                error: 'Erro interno do servidor',
                code: 'AUTH_INTERNAL_ERROR'
            });
        }
    };
}

// === MIDDLEWARE DE AUTORIZAÇÃO (RBAC) ===

function requireRole(allowedRoles) {
    if (typeof allowedRoles === 'string') {
        allowedRoles = [allowedRoles];
    }

    return async (req, res, next) => {
        const logger = authLogger.child({ 
            requestId: req.logger?.context?.requestId,
            userId: req.user?.id 
        });

        try {
            if (!req.user) {
                logger.security('authorization_no_user', {
                    requiredRoles: allowedRoles,
                    url: req.originalUrl
                });

                return res.status(401).json({
                    error: 'Autenticação necessária',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userRole = req.user.role || 'user';
            
            if (!allowedRoles.includes(userRole)) {
                logger.security('authorization_insufficient_role', {
                    userId: req.user.id,
                    userRole,
                    requiredRoles: allowedRoles,
                    url: req.originalUrl
                });

                return res.status(403).json({
                    error: 'Permissões insuficientes',
                    code: 'AUTH_INSUFFICIENT_PERMISSIONS'
                });
            }

            logger.debug('Authorization successful', {
                userId: req.user.id,
                userRole,
                requiredRoles: allowedRoles
            });

            next();

        } catch (error) {
            logger.error('Authorization middleware error', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id
            });

            return res.status(500).json({
                error: 'Erro interno do servidor',
                code: 'AUTH_INTERNAL_ERROR'
            });
        }
    };
}

// === MIDDLEWARE DE VERIFICAÇÃO DE PROPRIEDADE ===

function requireOwnership(resourceIdParam = 'id', userIdField = 'user_id') {
    return async (req, res, next) => {
        const logger = authLogger.child({ 
            requestId: req.logger?.context?.requestId,
            userId: req.user?.id 
        });

        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Autenticação necessária',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Admin tem acesso a tudo
            if (req.user.role === 'admin') {
                return next();
            }

            const resourceId = req.params[resourceIdParam];
            const userId = req.user.id;

            // Se não há ID do recurso, prosseguir (será validado por outros middlewares)
            if (!resourceId) {
                return next();
            }

            // Aqui você poderia implementar verificação no banco de dados
            // Por enquanto, assumimos que será verificado na rota
            req.requireOwnershipCheck = {
                resourceId,
                userId,
                userIdField
            };

            next();

        } catch (error) {
            logger.error('Ownership middleware error', {
                error: error.message,
                stack: error.stack,
                userId: req.user?.id
            });

            return res.status(500).json({
                error: 'Erro interno do servidor',
                code: 'AUTH_INTERNAL_ERROR'
            });
        }
    };
}

// === UTILITIES ===

// Gerar token JWT
function generateToken(payload, options = {}) {
    const {
        expiresIn = appConfig.security.jwt.expiresIn,
        secret = appConfig.security.jwt.secret
    } = options;

    return jwt.sign(payload, secret, {
        expiresIn,
        issuer: appConfig.security.jwt.issuer,
        algorithm: appConfig.security.jwt.algorithm
    });
}

// Gerar refresh token
function generateRefreshToken(payload) {
    return jwt.sign(payload, appConfig.security.jwt.refreshSecret, {
        expiresIn: appConfig.security.jwt.refreshExpiresIn,
        issuer: appConfig.security.jwt.issuer,
        algorithm: appConfig.security.jwt.algorithm
    });
}

// Invalidar token (adicionar à blacklist)
function invalidateToken(token) {
    try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            tokenBlacklist.add(token, decoded.exp);
            
            // Remover sessão se existir
            if (decoded.sessionId && decoded.id) {
                sessionManager.removeSession(decoded.id, decoded.sessionId);
            }
            
            return true;
        }
    } catch (error) {
        authLogger.warn('Failed to invalidate token', { error: error.message });
    }
    return false;
}

// Criar nova sessão
function createSession(userId) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessionManager.addSession(userId, sessionId);
    return sessionId;
}

// === MIDDLEWARE OPCIONAL ===

// Middleware para autenticação opcional
const optionalAuth = authenticateToken({ required: false });

// Middleware para admin
const requireAdmin = [authenticateToken(), requireRole('admin')];

// Middleware para user ou admin
const requireUser = [authenticateToken(), requireRole(['user', 'admin'])];

// === HEALTH CHECK ===

function getAuthHealth() {
    return {
        status: 'healthy',
        blacklistedTokens: tokenBlacklist.size(),
        activeSessions: sessionManager.activeSessions.size,
        rateLimit: {
            trackedUsers: userRateLimit.attempts.size
        },
        jwtConfig: {
            algorithm: appConfig.security.jwt.algorithm,
            issuer: appConfig.security.jwt.issuer,
            expiresIn: appConfig.security.jwt.expiresIn
        }
    };
}

// === EXPORTS ===

module.exports = {
    // Middleware principal
    authenticateToken,
    requireRole,
    requireOwnership,
    
    // Middleware pré-configurados
    optionalAuth,
    requireAdmin,
    requireUser,
    
    // Utilities
    generateToken,
    generateRefreshToken,
    invalidateToken,
    createSession,
    extractToken,
    validateToken,
    
    // Classes e instâncias
    TokenBlacklist,
    UserRateLimit,
    SessionManager,
    tokenBlacklist,
    userRateLimit,
    sessionManager,
    
    // Health check
    getAuthHealth
};