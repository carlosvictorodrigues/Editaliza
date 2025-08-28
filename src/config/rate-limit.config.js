// src/config/rate-limit.config.js - FASE 8 - Configurações de Rate Limiting

const rateLimit = require('express-rate-limit');

/**
 * Rate limiting específico para rotas de autenticação
 */
const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 tentativas em produção, 50 em dev
    message: { 
        error: 'Muitas tentativas. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_STRICT' 
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false
});

/**
 * Rate limiting moderado para APIs
 */
const moderateRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto para permitir mais requisições
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 req/min por IP em produção
    message: { 
        error: 'Limite de requisições atingido. Tente novamente em alguns instantes.',
        code: 'RATE_LIMIT_MODERATE' 
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false
});

/**
 * Rate limiting específico para login
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 tentativas falhas em produção
    message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true // Só conta tentativas falhas
});

/**
 * Aplicar rate limits específicos por rota - CORRIGIDO
 * @param {Express} app - Instância do Express
 */
function applyRateLimits(app) {
    console.log('[RATE_LIMITS] Aplicando rate limits específicos...');
    
    // Desabilitar completamente se configurado
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
        console.log('[RATE_LIMITS] Rate limits DESABILITADOS (DISABLE_RATE_LIMIT=true)');
        return;
    }
    
    try {
        // Rate limiting ESPECÍFICO para rotas de autenticação (apenas legadas)
        app.use('/login', (req, res, next) => {
            console.log('[RATE_LIMIT] Aplicando strict limit para /login');
            strictRateLimit(req, res, next);
        });
        
        app.use('/register', (req, res, next) => {
            console.log('[RATE_LIMIT] Aplicando strict limit para /register');
            strictRateLimit(req, res, next);
        });
        
        app.use('/forgot-password', strictRateLimit);
        app.use('/reset-password', strictRateLimit);
        
        // Rate limiting moderado para APIs gerais (EXCLUINDO auth)
        app.use('/api/', (req, res, next) => {
            // Pular rate limit para rotas de auth
            if (req.path.startsWith('/api/auth/')) {
                console.log(`[RATE_LIMIT] Pulando rate limit para auth: ${req.path}`);
                return next();
            }
            
            console.log(`[RATE_LIMIT] Aplicando moderate limit para: ${req.path}`);
            moderateRateLimit(req, res, next);
        });
        
        console.log('[RATE_LIMITS] Rate limits específicos aplicados com sucesso!');
    } catch (error) {
        console.error('[RATE_LIMITS] Erro ao aplicar rate limits:', error.message);
        throw error;
    }
}

module.exports = {
    strictRateLimit,
    moderateRateLimit,
    loginLimiter,
    applyRateLimits
};
