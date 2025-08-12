// src/utils/security.js
const path = require('path');
const crypto = require('crypto');

/**
 * Utilitários de segurança centralizados
 */

// Logging de auditoria seguro
const securityLog = (event, details = {}, userId = null, req = null) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        userId,
        ip: req?.ip || 'unknown',
        userAgent: req?.headers['user-agent'] || 'unknown',
        details: typeof details === 'object' ? details : { message: details }
    };
    
    console.log('[SECURITY]', JSON.stringify(logEntry));
};

// Validação segura de paths de arquivo
// CORREÇÃO DE SEGURANÇA: Validação robusta de caminhos de arquivo
const validateFilePath = (filePath, allowedDir = 'uploads') => {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Path de arquivo inválido');
    }
    
    // Decodificar URL encoding que pode mascarar ataques
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(filePath);
    } catch (error) {
        throw new Error('Path contém encoding inválido');
    }
    
    // Verificar caracteres perigosos ANTES da normalização
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(decodedPath)) {
        throw new Error('Path contém caracteres perigosos');
    }
    
    // Resolver path absoluto para o diretório permitido
    const baseDir = path.resolve(process.cwd(), allowedDir);
    const fullPath = path.resolve(baseDir, decodedPath);
    
    // CRÍTICO: Verificar se o path resolvido ainda está dentro do diretório base
    if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
        throw new Error(`Path traversal bloqueado: tentativa de acesso a ${fullPath}`);
    }
    
    // Verificar se o path normalizado não contém sequências suspeitas
    const normalizedPath = path.normalize(decodedPath);
    const suspiciousPatterns = [
        /\.\.[\/\\]/g,           // Path traversal
        /~[\/\\]/g,              // Home directory access
        /\$[A-Z_]+/g,            // Environment variables
        /%[0-9A-Fa-f]{2}/g,      // URL encoding residual
        /\\\\[^\\]+\\[^\\]+/g    // UNC paths
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalizedPath)) {
            throw new Error(`Padrão suspeito detectado no path: ${pattern.toString()}`);
        }
    }
    
    // Log de validação bem-sucedida para auditoria
    console.debug(`[SECURITY] Path validado com sucesso: ${decodedPath} -> ${fullPath}`);
    
    return normalizedPath;
};

// Validação de nome de tabela para queries PRAGMA
const validateTableName = (tableName) => {
    if (!tableName || typeof tableName !== 'string') {
        throw new Error('Nome de tabela inválido');
    }
    
    // Apenas permitir caracteres alfanuméricos e underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Nome de tabela contém caracteres inválidos');
    }
    
    // Lista de tabelas permitidas (whitelist)
    const allowedTables = [
        'users', 'user_plans', 'user_plan_subjects', 'user_sessions',
        'user_daily_progress', 'user_study_streaks', 'questoes',
        'topics', 'subjects', 'study_plans', 'study_sessions', 'user_activities',
        'login_attempts'
    ];
    
    if (!allowedTables.includes(tableName)) {
        throw new Error('Tabela não autorizada');
    }
    
    return tableName;
};

// Error handler seguro - remove informações sensíveis
const createSafeError = (error, userMessage = 'Erro interno do servidor') => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
        error: userMessage,
        details: isProduction ? undefined : error.message,
        timestamp: new Date().toISOString()
    };
};

// Rate limiting por usuário
const userRateLimiters = new Map();

const checkUserRateLimit = (userId, action, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const key = `${userId}:${action}`;
    const now = Date.now();
    
    if (!userRateLimiters.has(key)) {
        userRateLimiters.set(key, {
            attempts: 1,
            resetTime: now + windowMs
        });
        return true;
    }
    
    const limiter = userRateLimiters.get(key);
    
    // Reset se passou o tempo limite
    if (now > limiter.resetTime) {
        limiter.attempts = 1;
        limiter.resetTime = now + windowMs;
        return true;
    }
    
    // Verificar se excedeu limite
    if (limiter.attempts >= maxAttempts) {
        return false;
    }
    
    limiter.attempts++;
    return true;
};

// Validador de session secret em produção
const validateProductionSecrets = () => {
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.SESSION_SECRET) {
            throw new Error('SESSION_SECRET é obrigatório em produção');
        }
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET é obrigatório em produção');
        }
        if (process.env.SESSION_SECRET.length < 32) {
            throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres');
        }
    }
};

// Gerador de token CSRF
const generateCSRFToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Validador de token CSRF
const validateCSRFToken = (token, sessionToken) => {
    if (!token || !sessionToken) {
        return false;
    }
    return crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(sessionToken, 'hex')
    );
};

module.exports = {
    securityLog,
    validateFilePath,
    validateTableName,
    createSafeError,
    checkUserRateLimit,
    validateProductionSecrets,
    generateCSRFToken,
    validateCSRFToken
};