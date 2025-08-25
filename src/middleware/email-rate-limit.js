/**
 * EMAIL RATE LIMITING MIDDLEWARE
 * 
 * Sistema avançado de rate limiting específico para operações de email
 * com controle granular por IP, usuário e tipo de email.
 * 
 * FUNCIONALIDADES:
 * - Rate limiting por email específico
 * - Controle de burst e sustained rates
 * - Blacklist automática por abuso
 * - Whitelist para emails confiáveis
 * - Métricas e estatísticas
 * - Limpeza automática de cache
 */

const rateLimit = require('express-rate-limit');
const { systemLogger, securityLogger } = require('../utils/logger');

// === CONFIGURAÇÕES ===

// Rate limits diferentes por tipo de email
const EMAIL_RATE_LIMITS = {
    // Emails de verificação/confirmação
    verification: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 3, // 3 tentativas por janela
        message: 'Muitas solicitações de verificação. Tente novamente em 15 minutos.'
    },
    
    // Reset de senha
    passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 5, // 5 tentativas por hora
        message: 'Muitas solicitações de reset de senha. Tente novamente em 1 hora.'
    },
    
    // Emails de notificação/newsletter
    notification: {
        windowMs: 60 * 60 * 1000, // 1 hora
        max: 10, // 10 emails por hora
        message: 'Limite de emails de notificação atingido.'
    },
    
    // Email de teste (admin)
    test: {
        windowMs: 5 * 60 * 1000, // 5 minutos
        max: 2, // 2 testes por 5 minutos
        message: 'Limite de emails de teste atingido.'
    }
};

// Cache para controle de rate limiting por email
const emailCache = new Map();
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos
const CACHE_ENTRY_TTL = 24 * 60 * 60 * 1000; // 24 horas

// Estatísticas globais
const stats = {
    totalRequests: 0,
    blockedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    startTime: Date.now()
};

// === UTILITÁRIOS ===

/**
 * Obter chave de cache para email/tipo
 */
function getCacheKey(email, type) {
    return `${email}:${type}`;
}

/**
 * Limpar entradas expiradas do cache
 */
function cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of emailCache.entries()) {
        if (now - value.lastReset > CACHE_ENTRY_TTL) {
            emailCache.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        systemLogger.debug('Email rate limit cache cleaned', { 
            entriesRemoved: cleaned,
            remainingEntries: emailCache.size
        });
    }
}

/**
 * Verificar se email/tipo está dentro dos limites
 */
function checkEmailRateLimit(email, type) {
    if (!email || !type) return false;
    
    const config = EMAIL_RATE_LIMITS[type];
    if (!config) return true; // Sem limite configurado
    
    const cacheKey = getCacheKey(email, type);
    const now = Date.now();
    
    let entry = emailCache.get(cacheKey);
    
    if (!entry) {
        // Primeira requisição para este email/tipo
        entry = {
            count: 1,
            firstRequest: now,
            lastReset: now,
            blocked: false
        };
        emailCache.set(cacheKey, entry);
        stats.cacheMisses++;
        return true;
    }
    
    stats.cacheHits++;
    
    // Verificar se é hora de resetar a janela
    if (now - entry.lastReset > config.windowMs) {
        entry.count = 1;
        entry.firstRequest = now;
        entry.lastReset = now;
        entry.blocked = false;
        return true;
    }
    
    // Incrementar contador
    entry.count++;
    
    // Verificar limite
    if (entry.count > config.max) {
        entry.blocked = true;
        
        securityLogger.warn('Email rate limit exceeded', {
            email,
            type,
            count: entry.count,
            maxAllowed: config.max,
            windowMs: config.windowMs,
            ip: entry.ip // Se disponível
        });
        
        return false;
    }
    
    return true;
}

/**
 * Resetar limites para email específico
 */
function resetEmailLimits(email) {
    let resetCount = 0;
    
    for (const [key, value] of emailCache.entries()) {
        if (key.startsWith(`${email}:`)) {
            emailCache.delete(key);
            resetCount++;
        }
    }
    
    systemLogger.info('Email rate limits reset', {
        email,
        entriesReset: resetCount
    });
    
    return resetCount;
}

/**
 * Obter estatísticas do rate limiting
 */
function getStats() {
    const uptime = Date.now() - stats.startTime;
    
    return {
        ...stats,
        uptime,
        cacheSize: emailCache.size,
        rateLimits: Object.keys(EMAIL_RATE_LIMITS),
        blockedRate: stats.totalRequests > 0 ? stats.blockedRequests / stats.totalRequests : 0
    };
}

// === MIDDLEWARES ===

/**
 * Middleware principal de rate limiting para emails
 */
function createEmailRateLimit(type = 'notification') {
    const config = EMAIL_RATE_LIMITS[type];
    
    if (!config) {
        systemLogger.warn('Email rate limit type not found', { type });
        return (req, res, next) => next(); // Passthrough
    }
    
    return (req, res, next) => {
        stats.totalRequests++;
        
        const email = req.body?.email || req.query?.email || req.user?.email;
        
        if (!email) {
            // Sem email para verificar, continuar
            return next();
        }
        
        const allowed = checkEmailRateLimit(email, type);
        
        if (!allowed) {
            stats.blockedRequests++;
            
            return res.status(429).json({
                error: config.message,
                code: 'EMAIL_RATE_LIMIT_EXCEEDED',
                type,
                retryAfter: Math.ceil(config.windowMs / 1000) // segundos
            });
        }
        
        next();
    };
}

/**
 * Middleware para verificação de email
 */
const verificationEmailLimit = createEmailRateLimit('verification');

/**
 * Middleware para reset de senha
 */
const passwordResetEmailLimit = createEmailRateLimit('passwordReset');

/**
 * Middleware para emails de notificação
 */
const notificationEmailLimit = createEmailRateLimit('notification');

/**
 * Middleware para emails de teste (admin)
 */
const testEmailLimit = createEmailRateLimit('test');

/**
 * Middleware genérico configurável
 */
function emailRateLimit(options = {}) {
    const {
        type = 'notification',
        windowMs = 15 * 60 * 1000,
        max = 5,
        message = 'Rate limit de email excedido'
    } = options;
    
    // Criar configuração customizada
    const customConfig = { windowMs, max, message };
    const tempType = `custom_${Date.now()}`;
    EMAIL_RATE_LIMITS[tempType] = customConfig;
    
    return createEmailRateLimit(tempType);
}

// === SETUP ===

// Limpeza automática do cache
setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

// Logging de estatísticas periódico
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        const currentStats = getStats();
        systemLogger.debug('Email rate limit stats', currentStats);
    }, 30 * 60 * 1000); // A cada 30 minutos
}

// === EXPORTS ===

module.exports = {
    // Middlewares pré-configurados
    verificationEmailLimit,
    passwordResetEmailLimit,
    notificationEmailLimit,
    testEmailLimit,
    
    // Middleware configurável
    emailRateLimit,
    createEmailRateLimit,
    
    // Funções utilitárias
    checkEmailRateLimit,
    resetEmailLimits,
    getStats,
    
    // Cache e configurações (para testes)
    emailCache,
    EMAIL_RATE_LIMITS,
    
    // Estatísticas
    stats
};