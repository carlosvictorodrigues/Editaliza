// src/middleware/index.js - FASE 8 CORRIGIDO - Middleware Global Consolidado

const express = require('express');
const rateLimit = require('express-rate-limit');
const { sanitizeInput } = require('../utils/security');
const { collectMetrics } = require('./metrics');
const { securityLog } = require('../utils/security');

// Middleware para limitar tamanho do corpo da requisição
const bodySizeLimit = (maxSize = '2mb') => {
    return (req, res, next) => {
        try {
            console.log(`[BODY_SIZE_LIMIT] ${req.method} ${req.path}`);
            
            const contentLength = req.headers['content-length'];
            const maxSizeBytes = maxSize.includes('mb') ? 
                parseInt(maxSize) * 1024 * 1024 : 
                parseInt(maxSize);
            
            if (contentLength && parseInt(contentLength) > maxSizeBytes) {
                console.log(`[BODY_SIZE_LIMIT] Requisição rejeitada - tamanho: ${contentLength}`);
                return res.status(413).json({ error: 'Requisição muito grande' });
            }
            
            next();
        } catch (error) {
            console.error('[BODY_SIZE_LIMIT] Erro:', error.message);
            next();
        }
    };
};

// Middleware CORRIGIDO para sanitizar todos os inputs
const sanitizeMiddleware = (req, res, next) => {
    try {
        console.log(`[SANITIZE] Processando ${req.method} ${req.path}`);
        
        // Sanitizar body se existir
        if (req.body && typeof req.body === 'object') {
            for (const key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = sanitizeInput(req.body[key]);
                }
            }
        }
        
        // Sanitizar query params se existirem
        if (req.query && typeof req.query === 'object') {
            for (const key in req.query) {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = sanitizeInput(req.query[key]);
                }
            }
        }
        
        console.log(`[SANITIZE] Concluído para ${req.path}`);
        next();
    } catch (error) {
        console.error(`[SANITIZE] Erro ao sanitizar ${req.path}:`, error.message);
        next(); // Continuar mesmo com erro
    }
};

/**
 * Aplicar todos os middlewares globais de forma organizada e CORRIGIDA
 * @param {Express} app - Instância do Express
 */
function applyGlobalMiddleware(app) {
    console.log('[MIDDLEWARE] Iniciando aplicação dos middlewares globais...');
    
    try {
        // ==========================================
        // MIDDLEWARE DE MÉTRICAS
        // ==========================================
        app.use((req, res, next) => {
            try {
                console.log(`[METRICS] ${req.method} ${req.path}`);
                collectMetrics(req, res, next);
            } catch (error) {
                console.error('[METRICS] Erro:', error.message);
                next();
            }
        });

        // ==========================================
        // BODY PARSING COM VERIFICAÇÃO SEGURA
        // ==========================================
        app.use(express.json({ 
            limit: '2mb',
            verify: (req, res, buf) => {
                try {
                    if (buf.length > 1024 * 1024) {
                        console.log(`[BODY_PARSE] Payload grande detectado: ${buf.length} bytes`);
                        securityLog('large_payload_detected', {
                            size: buf.length,
                            ip: req.ip,
                            endpoint: req.path
                        });
                    }
                } catch (verifyError) {
                    console.error('[BODY_PARSE] Erro na verificação:', verifyError.message);
                }
            }
        }));
        
        app.use(express.urlencoded({ 
            extended: true, 
            limit: '2mb',
            parameterLimit: 100
        }));
        
        // ==========================================
        // LIMITAÇÃO DE TAMANHO E SANITIZAÇÃO
        // ==========================================
        app.use(bodySizeLimit('2mb'));
        
        // APENAS UM middleware de sanitização (CORRIGIDO)
        app.use(sanitizeMiddleware);

        // ==========================================
        // RATE LIMITING GLOBAL COM EXCEÇÕES PARA AUTH
        // ==========================================
        
        // Desabilitar rate limit completamente se configurado
        console.log('[MIDDLEWARE] DISABLE_RATE_LIMIT =', process.env.DISABLE_RATE_LIMIT);
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            console.log('[RATE_LIMIT] Rate limit DESABILITADO (DISABLE_RATE_LIMIT=true)');
            app.use((req, res, next) => {
                console.log(`[RATE_LIMIT] Pulado (desabilitado): ${req.method} ${req.path}`);
                next();
            });
        } else {
            const globalLimiter = rateLimit({
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5000, // Aumentado para desenvolvimento
            message: { 
                error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
                code: 'RATE_LIMIT_GENERAL' 
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                const skipPaths = [
                    '/health', '/ready', // Health checks
                    '/api/auth/login', '/api/auth/register', // ROTAS DE AUTH ADICIONADAS
                    '/api/auth/csrf-token', '/api/auth/status', // Rotas de auth auxiliares
                    '/login', '/register', // Rotas legadas
                    '/gamification',
                    '/schedule', 
                    '/overdue_check',
                    '/progress',
                    '/goal_progress',
                    '/realitycheck',
                    '/settings',
                    '/generate',
                    '/batch_update',
                    '/batch_update_details'
                ];
                
                // Skip POST requests para topics (desenvolvimento)
                if (req.method === 'POST' && req.path.includes('/topics')) {
                    return true;
                }
                
                const shouldSkip = skipPaths.some(path => req.path === path || req.path.endsWith(path)) || 
                       req.path.includes('/plans/') || 
                       req.path.includes('/topics') ||
                       req.path.includes('/subjects') || // Removido / para pegar todas as variações
                       req.path.startsWith('/api/auth/'); // Skip todas as rotas de auth
                
                if (shouldSkip) {
                    console.log(`[RATE_LIMIT] Pulando rate limit para: ${req.path}`);
                }
                
                return shouldSkip;
            },
            handler: (req, res, next) => {
                console.log(`[RATE_LIMIT] Limite excedido para ${req.path}`);
                res.status(429).json({
                    error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
                    code: 'RATE_LIMIT_GENERAL'
                });
            }
        });
        
        app.use((req, res, next) => {
            try {
                console.log(`[RATE_LIMIT] Processando ${req.method} ${req.path}`);
                globalLimiter(req, res, next);
            } catch (error) {
                console.error(`[RATE_LIMIT] Erro:`, error.message);
                next();
            }
        });
        } // Fechando o else do rate limit
        
        console.log('[MIDDLEWARE] Middlewares globais aplicados com sucesso!');
    } catch (error) {
        console.error('[MIDDLEWARE] Erro ao aplicar middlewares globais:', error.message);
        throw error;
    }
}

module.exports = {
    applyGlobalMiddleware
};
