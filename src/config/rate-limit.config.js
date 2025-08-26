// src/config/rate-limit.config.js - FASE 8 - Configurações de Rate Limiting

const rateLimit = require('express-rate-limit');

/**
 * Rate limiting específico para rotas de autenticação
 */
const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas
    message: { 
        error: 'Muitas tentativas. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_STRICT' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiting moderado para APIs
 */
const moderateRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requisições
    message: { 
        error: 'Limite de requisições atingido. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_MODERATE' 
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiting específico para login
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
});

/**
 * Aplicar rate limits específicos por rota
 * @param {Express} app - Instância do Express
 */
function applyRateLimits(app) {
    // Rate limiting para rotas de autenticação
    app.use('/login', strictRateLimit);
    app.use('/register', strictRateLimit);
    app.use('/forgot-password', strictRateLimit);
    app.use('/reset-password', strictRateLimit);
    
    // Rate limiting para APIs
    app.use('/api/', moderateRateLimit);
}

module.exports = {
    strictRateLimit,
    moderateRateLimit,
    loginLimiter,
    applyRateLimits
};
