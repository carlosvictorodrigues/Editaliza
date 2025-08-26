// src/middleware/index.js - FASE 8 - Middleware Global Consolidado

const express = require('express');
const rateLimit = require('express-rate-limit');
const { sanitizeInput } = require('../utils/security');
const { bodySizeLimit, sanitizeMiddleware } = require('../../middleware');
const { collectMetrics } = require('./metrics');
const { securityLog } = require('../utils/security');

/**
 * Aplicar todos os middlewares globais de forma organizada
 * @param {Express} app - Instância do Express
 */
function applyGlobalMiddleware(app) {
    // ==========================================
    // MIDDLEWARE DE MÉTRICAS
    // ==========================================
    app.use(collectMetrics);

    // ==========================================
    // BODY PARSING COM SANITIZAÇÃO
    // ==========================================
    app.use(express.json({ 
        limit: '2mb', // Reduzido para segurança
        verify: (req, res, buf) => {
            // Log suspeito de payloads muito grandes
            if (buf.length > 1024 * 1024) {
                securityLog('large_payload_detected', {
                    size: buf.length,
                    ip: req.ip,
                    endpoint: req.path
                });
            }
        }
    }));
    
    app.use(express.urlencoded({ 
        extended: true, 
        limit: '2mb',
        parameterLimit: 100 // Limitar número de parâmetros
    }));
    
    app.use(bodySizeLimit('2mb'));

    // ==========================================
    // SANITIZAÇÃO GLOBAL
    // ==========================================
    app.use((req, res, next) => {
        // Sanitizar body
        if (req.body) {
            for (const key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = sanitizeInput(req.body[key]);
                }
            }
        }
        
        // Sanitizar query params
        if (req.query) {
            for (const key in req.query) {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = sanitizeInput(req.query[key]);
                }
            }
        }
        
        next();
    });
    
    app.use(sanitizeMiddleware);

    // ==========================================
    // RATE LIMITING GLOBAL
    // ==========================================
    const globalLimiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, // Reduzido
        message: { 
            error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
            code: 'RATE_LIMIT_GENERAL' 
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            const skipPaths = [
                '/health', '/ready', // Health checks
                '/gamification',
                '/schedule', 
                '/overdue_check',
                '/progress',
                '/goal_progress',
                '/realitycheck',
                '/settings', // Configurações do plano
                '/generate', // Geração de cronograma
                '/batch_update', // Atualização em lote
                '/batch_update_details' // Atualização de detalhes
            ];
            return skipPaths.some(path => req.path.endsWith(path)) || 
                   req.path.includes('/plans/') || // Qualquer rota de planos
                   req.path.includes('/topics/'); // Qualquer rota de tópicos
        }
    });
    
    app.use(globalLimiter);
}

module.exports = {
    applyGlobalMiddleware
};
