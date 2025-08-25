/**
 * Route Compatibility Middleware
 * 
 * Mantém compatibilidade com rotas antigas durante a migração,
 * redirecionando para as novas rotas padronizadas.
 * 
 * IMPORTANTE: Este middleware é temporário e deve ser removido
 * após todos os clientes migrarem para as novas rotas.
 */

const logger = require('../utils/logger');

// Mapa de rotas antigas para novas
const ROUTE_MAP = {
    // Autenticação - rotas que estavam em /api/* vão para /api/auth/*
    'POST:/api/login': '/api/auth/login',
    'POST:/api/register': '/api/auth/register',
    'POST:/api/logout': '/api/auth/logout',
    'GET:/api/csrf-token': '/api/auth/csrf-token',
    'POST:/api/request-password-reset': '/api/auth/password/request',
    'POST:/api/reset-password': '/api/auth/password/reset',
    
    // OAuth - padronizar para /api/auth/google
    'GET:/auth/google': '/api/auth/google',
    'GET:/auth/google/callback': '/api/auth/google/callback',
    'GET:/auth/session-token': '/api/auth/session-token',
    'GET:/auth/google/status': '/api/auth/google/status',
    
    // Perfil - mover para /api/users
    'GET:/api/profile': '/api/users/profile',
    'PATCH:/api/profile': '/api/users/profile',
    'POST:/api/profile/upload-photo': '/api/users/profile/photo',
    
    // Cronogramas - padronizar para /api/schedules
    'POST:/api/sessions/:sessionId/reinforce': '/api/schedules/sessions/:sessionId/reinforce',
    'POST:/api/sessions/:sessionId/time': '/api/schedules/sessions/:sessionId/time',
    
    // Disciplinas e Tópicos - consolidar em /api/plans
    'DELETE:/api/subjects/:subjectId': '/api/plans/subjects/:subjectId',
    'GET:/api/subjects/:subjectId/topics': '/api/plans/subjects/:subjectId/topics',
    'DELETE:/api/topics/:topicId': '/api/plans/topics/:topicId'
};

// Estatísticas de uso para monitoramento
const usageStats = new Map();

/**
 * Middleware de compatibilidade de rotas
 */
const routeCompatibility = (req, res, next) => {
    const routeKey = `${req.method}:${req.path}`;
    const originalUrl = req.originalUrl;
    
    // Verificar se é uma rota que precisa ser redirecionada
    let newPath = null;
    
    // Verificar correspondência exata
    if (ROUTE_MAP[routeKey]) {
        newPath = ROUTE_MAP[routeKey];
    } else {
        // Verificar correspondência com parâmetros
        for (const [pattern, replacement] of Object.entries(ROUTE_MAP)) {
            const [method, path] = pattern.split(':');
            if (method !== req.method) continue;
            
            // Converter pattern para regex
            const regexPattern = path.replace(/:[^/]+/g, '([^/]+)');
            const regex = new RegExp(`^${regexPattern}$`);
            const match = req.path.match(regex);
            
            if (match) {
                // Substituir parâmetros na nova rota
                newPath = replacement;
                const params = path.match(/:[^/]+/g) || [];
                params.forEach((param, index) => {
                    const paramName = param.slice(1);
                    const paramValue = match[index + 1];
                    newPath = newPath.replace(`:${paramName}`, paramValue);
                });
                break;
            }
        }
    }
    
    // Se encontrou uma rota para redirecionar
    if (newPath) {
        // Registrar uso para monitoramento
        const statsKey = `${req.method}:${req.path} → ${newPath}`;
        usageStats.set(statsKey, (usageStats.get(statsKey) || 0) + 1);
        
        // Log da migração
        logger.warn('DEPRECATED_ROUTE', {
            originalPath: req.path,
            newPath: newPath,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString()
        });
        
        // Reescrever URL internamente (não é um redirect 301)
        req.url = newPath + (req.originalUrl.includes('?') ? 
            req.originalUrl.substring(req.originalUrl.indexOf('?')) : '');
        
        // Adicionar header para indicar que houve migração
        res.setHeader('X-Route-Migration', `${req.path} → ${newPath}`);
        res.setHeader('X-Deprecation-Warning', 
            `This route is deprecated. Please use ${newPath} instead.`);
    }
    
    next();
};

/**
 * Middleware para adicionar CORS headers para novas rotas
 * Garante que o frontend possa acessar as novas rotas
 */
const corsCompatibility = (req, res, next) => {
    // Adicionar headers CORS para rotas migradas
    if (req.path.startsWith('/api/auth/') || 
        req.path.startsWith('/api/users/') || 
        req.path.startsWith('/api/schedules/')) {
        
        const origin = req.headers.origin;
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://app.editaliza.com.br',
            'https://editaliza.com.br'
        ];
        
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 
                'Content-Type, Authorization, X-CSRF-Token');
        }
    }
    
    next();
};

/**
 * Função para obter estatísticas de uso das rotas deprecadas
 */
const getUsageStats = () => {
    const stats = [];
    for (const [route, count] of usageStats.entries()) {
        stats.push({ route, count });
    }
    return stats.sort((a, b) => b.count - a.count);
};

/**
 * Função para limpar estatísticas (útil para testes)
 */
const clearUsageStats = () => {
    usageStats.clear();
};

/**
 * Middleware para log detalhado de rotas
 */
const routeLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log no início da requisição
    logger.info('REQUEST_START', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    
    // Log no final da requisição
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('REQUEST_END', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            migrated: res.getHeader('X-Route-Migration') || false
        });
    });
    
    next();
};

module.exports = {
    routeCompatibility,
    corsCompatibility,
    routeLogger,
    getUsageStats,
    clearUsageStats,
    ROUTE_MAP
};