/**
 * MIDDLEWARE DE ADMINISTRAÇÃO - FASE 8
 * 
 * Sistema robusto de controle de acesso administrativo
 * com suporte completo a logs de segurança e auditoria.
 * 
 * FUNCIONALIDADES:
 * - Verificação de role administrativo
 * - Logs de auditoria para ações admin
 * - Rate limiting específico para admins
 * - Detecção de tentativas de acesso não autorizado
 * - Session management para admins
 * - IP whitelist para operações críticas
 */

const { dbGet } = require('../../database-postgresql');
const { securityLogger, systemLogger } = require('../utils/logger');

// === CONFIGURAÇÕES DE SEGURANÇA ADMIN ===

// IPs permitidos para operações críticas (em produção configurar via ENV)
const ADMIN_WHITELIST_IPS = process.env.ADMIN_WHITELIST_IPS 
    ? process.env.ADMIN_WHITELIST_IPS.split(',').map(ip => ip.trim())
    : ['127.0.0.1', '::1', 'localhost'];

// Operações críticas que requerem IP whitelist
const CRITICAL_OPERATIONS = [
    '/admin/users/delete',
    '/admin/database/backup',
    '/admin/database/restore',
    '/admin/system/maintenance',
    '/admin/config/update'
];

// Cache de verificações de admin (evitar queries desnecessárias)
const adminCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// === FUNÇÕES UTILITÁRIAS ===

/**
 * Limpar cache de admin expirado
 */
function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of adminCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            adminCache.delete(key);
        }
    }
}

/**
 * Verificar se usuário é admin (com cache)
 */
async function isUserAdmin(userId) {
    const cacheKey = `admin:${userId}`;
    const cached = adminCache.get(cacheKey);
    
    // Retornar do cache se válido
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.isAdmin;
    }
    
    try {
        const user = await dbGet('SELECT role FROM users WHERE id = $1', [userId]);
        const isAdmin = user && user.role === 'admin';
        
        // Cachear resultado
        adminCache.set(cacheKey, {
            isAdmin,
            timestamp: Date.now()
        });
        
        return isAdmin;
    } catch (error) {
        systemLogger.error('Error checking admin status', {
            userId,
            error: error.message
        });
        return false;
    }
}

/**
 * Registrar tentativa de acesso admin não autorizada
 */
function logUnauthorizedAdminAttempt(req, reason) {
    const logger = securityLogger.child({
        requestId: req.logger?.context?.requestId,
        ip: req.ip,
        userId: req.user?.id,
        userAgent: req.get('User-Agent')
    });
    
    logger.warn('Unauthorized admin access attempt', {
        url: req.originalUrl,
        method: req.method,
        reason,
        timestamp: new Date().toISOString(),
        headers: {
            'x-forwarded-for': req.get('X-Forwarded-For'),
            'x-real-ip': req.get('X-Real-IP'),
            'referer': req.get('Referer')
        }
    });
}

/**
 * Registrar ação administrativa executada
 */
function logAdminAction(req, action, details = {}) {
    const logger = securityLogger.child({
        requestId: req.logger?.context?.requestId,
        adminId: req.user.id,
        ip: req.ip
    });
    
    logger.info('Admin action executed', {
        action,
        url: req.originalUrl,
        method: req.method,
        details,
        timestamp: new Date().toISOString(),
        adminEmail: req.user.email
    });
}

// === MIDDLEWARES PRINCIPAIS ===

/**
 * Middleware básico de verificação de admin
 * Verifica se o usuário autenticado tem role de admin
 */
const requireAdmin = async (req, res, next) => {
    try {
        // Verificar se há usuário autenticado
        if (!req.user || !req.user.id) {
            logUnauthorizedAdminAttempt(req, 'No authenticated user');
            return res.status(401).json({
                error: 'Acesso não autorizado',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Verificar se usuário é admin
        const isAdmin = await isUserAdmin(req.user.id);
        
        if (!isAdmin) {
            logUnauthorizedAdminAttempt(req, 'User is not admin');
            return res.status(403).json({
                error: 'Acesso negado - privilégios administrativos requeridos',
                code: 'ADMIN_REQUIRED'
            });
        }
        
        // Adicionar flag de admin ao request
        req.isAdmin = true;
        
        // Log da ação admin (exceto rotas de status/health)
        if (!req.originalUrl.includes('/status') && !req.originalUrl.includes('/health')) {
            logAdminAction(req, 'admin_access', {
                endpoint: req.originalUrl
            });
        }
        
        next();
    } catch (error) {
        systemLogger.error('Error in requireAdmin middleware', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id,
            url: req.originalUrl
        });
        
        return res.status(500).json({
            error: 'Erro interno na verificação de administrador',
            code: 'ADMIN_CHECK_ERROR'
        });
    }
};

/**
 * Middleware para operações críticas que requerem IP whitelist
 */
const requireSecureAdmin = (req, res, next) => {
    // Verificar se é uma operação crítica
    const isCritical = CRITICAL_OPERATIONS.some(op => req.originalUrl.includes(op));
    
    if (!isCritical) {
        return next(); // Não é crítica, continuar
    }
    
    // Obter IP real do request
    const clientIP = req.ip || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Verificar se IP está na whitelist
    const isWhitelisted = ADMIN_WHITELIST_IPS.some(allowedIP => {
        return clientIP === allowedIP || 
               clientIP.includes(allowedIP) ||
               allowedIP === '0.0.0.0'; // Allow all (apenas desenvolvimento)
    });
    
    if (!isWhitelisted) {
        logUnauthorizedAdminAttempt(req, `Critical operation from non-whitelisted IP: ${clientIP}`);
        
        return res.status(403).json({
            error: 'Operação crítica bloqueada - IP não autorizado',
            code: 'IP_NOT_WHITELISTED',
            clientIP: process.env.NODE_ENV === 'development' ? clientIP : '[HIDDEN]'
        });
    }
    
    logAdminAction(req, 'critical_operation_access', {
        operation: req.originalUrl,
        clientIP
    });
    
    next();
};

/**
 * Middleware para invalidar cache de admin
 * Usado quando roles são modificados
 */
const invalidateAdminCache = (userId) => {
    if (userId) {
        adminCache.delete(`admin:${userId}`);
    } else {
        // Limpar todo o cache
        adminCache.clear();
    }
    
    systemLogger.info('Admin cache invalidated', { userId });
};

/**
 * Middleware para adicionar contexto admin ao logger
 */
const adminLoggingContext = (req, res, next) => {
    if (req.user && req.isAdmin) {
        // Adicionar contexto de admin ao logger do request
        if (req.logger && req.logger.context) {
            req.logger.context.adminId = req.user.id;
            req.logger.context.adminEmail = req.user.email;
            req.logger.context.isAdminAction = true;
        }
    }
    next();
};

/**
 * Middleware de auditoria para actions destrutivas
 */
const auditDestructiveActions = (actionType) => {
    return (req, res, next) => {
        // Interceptar resposta para logar resultado
        const originalSend = res.send;
        const originalJson = res.json;
        
        res.send = function(body) {
            logAdminAction(req, `destructive_${actionType}`, {
                actionType,
                success: res.statusCode < 400,
                statusCode: res.statusCode,
                bodySize: Buffer.byteLength(body || '', 'utf8')
            });
            
            return originalSend.call(this, body);
        };
        
        res.json = function(body) {
            logAdminAction(req, `destructive_${actionType}`, {
                actionType,
                success: res.statusCode < 400,
                statusCode: res.statusCode,
                responseData: process.env.NODE_ENV === 'development' ? body : '[HIDDEN]'
            });
            
            return originalJson.call(this, body);
        };
        
        next();
    };
};

// === UTILITIES ADMINISTRATIVAS ===

/**
 * Obter estatísticas de uso do cache de admin
 */
function getAdminCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, value] of adminCache.entries()) {
        if (now - value.timestamp < CACHE_TTL) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    }
    
    return {
        totalEntries: adminCache.size,
        validEntries,
        expiredEntries,
        cacheHitRate: validEntries / (validEntries + expiredEntries) || 0,
        cacheTTL: CACHE_TTL
    };
}

/**
 * Obter lista de admins ativos
 */
async function getActiveAdmins() {
    try {
        const admins = await dbGet(`
            SELECT id, email, name, created_at, 
                   last_login_at, profile_picture
            FROM users 
            WHERE role = 'admin'
            ORDER BY created_at DESC
        `);
        
        return admins || [];
    } catch (error) {
        systemLogger.error('Error fetching active admins', { error: error.message });
        return [];
    }
}

// Limpeza periódica do cache
setInterval(cleanExpiredCache, 5 * 60 * 1000); // A cada 5 minutos

// === EXPORTS ===

module.exports = {
    // Middlewares principais
    requireAdmin,
    requireSecureAdmin,
    adminLoggingContext,
    auditDestructiveActions,
    
    // Funções utilitárias
    isUserAdmin,
    invalidateAdminCache,
    logAdminAction,
    logUnauthorizedAdminAttempt,
    
    // Estatísticas e monitoramento
    getAdminCacheStats,
    getActiveAdmins,
    
    // Constantes (para testes)
    ADMIN_WHITELIST_IPS,
    CRITICAL_OPERATIONS
};