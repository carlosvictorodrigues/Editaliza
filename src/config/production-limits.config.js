/**
 * Configuração de Rate Limiting para Produção
 * Otimizado para suportar 1000 usuários simultâneos
 */

const rateLimit = require('express-rate-limit');

/**
 * Configurações para 1000 usuários simultâneos:
 * - 100 req/min por IP = 6000 req/min total se todos ativos
 * - Janelas curtas (1 min) para resetar rapidamente
 * - Limites mais agressivos apenas para endpoints sensíveis
 */

// Para APIs gerais (dashboard, planos, disciplinas, etc.)
const generalApiLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requisições por minuto por IP
    message: {
        error: 'Muitas requisições. Por favor, aguarde um momento.',
        code: 'RATE_LIMIT_GENERAL',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Trust proxy para pegar IP real atrás do Nginx
    trustProxy: true,
    // Não contar requisições com erro 5xx
    skipFailedRequests: true
});

// Para endpoints de autenticação (login, registro)
const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 tentativas por 15 minutos
    message: {
        error: 'Muitas tentativas. Por segurança, aguarde 15 minutos.',
        code: 'RATE_LIMIT_AUTH',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    // Só conta tentativas falhas para login
    skipSuccessfulRequests: true
});

// Para operações de escrita pesadas (criação de planos, importação)
const heavyOperationLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 20, // 20 operações pesadas por 5 minutos
    message: {
        error: 'Limite de operações atingido. Aguarde alguns minutos.',
        code: 'RATE_LIMIT_HEAVY',
        retryAfter: 300
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true
});

// Para endpoints de leitura frequente (sessions, topics)
const readLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 200, // 200 requisições por minuto (para polling, atualizações)
    message: {
        error: 'Limite de consultas atingido. Aguarde um momento.',
        code: 'RATE_LIMIT_READ',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    skipFailedRequests: true
});

// Rate limit global como fallback
const globalLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 300, // 300 req/min por IP (bem generoso)
    message: {
        error: 'Servidor sobrecarregado. Por favor, tente novamente.',
        code: 'RATE_LIMIT_GLOBAL',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true,
    skipFailedRequests: true,
    // Handler customizado para logar IPs problemáticos
    handler: (req, res) => {
        console.warn(`[RATE_LIMIT] IP bloqueado: ${req.ip} - Path: ${req.path}`);
        res.status(429).json({
            error: 'Servidor sobrecarregado. Por favor, tente novamente.',
            code: 'RATE_LIMIT_GLOBAL',
            retryAfter: 60
        });
    }
});

/**
 * Aplicar rate limits por tipo de endpoint
 */
function applyProductionLimits(app) {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
        console.log('[RATE_LIMIT] DESABILITADO via variável de ambiente');
        return;
    }

    console.log('[RATE_LIMIT] Configurando para produção (1000 usuários simultâneos)...');

    // Rate limit global (aplica primeiro como safety net)
    app.use(globalLimit);

    // Auth endpoints (mais restritivos)
    app.use('/api/auth/login', authLimit);
    app.use('/api/auth/register', authLimit);
    app.use('/api/auth/request-password-reset', authLimit);

    // Heavy operations
    app.use('/api/plans', (req, res, next) => {
        if (req.method === 'POST' || req.method === 'PUT') {
            return heavyOperationLimit(req, res, next);
        }
        next();
    });

    // Read-heavy endpoints
    app.use('/api/sessions', readLimit);
    app.use('/api/topics', readLimit);
    app.use('/api/statistics', readLimit);
    app.use('/api/gamification', readLimit);

    // General API
    app.use('/api/', generalApiLimit);

    console.log('[RATE_LIMIT] Configuração para produção aplicada com sucesso!');
}

module.exports = {
    generalApiLimit,
    authLimit,
    heavyOperationLimit,
    readLimit,
    globalLimit,
    applyProductionLimits
};