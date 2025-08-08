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
const validateFilePath = (filePath, allowedDir = 'uploads') => {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Path de arquivo inválido');
    }
    
    // Normalizar o path para evitar path traversal
    const normalizedPath = path.normalize(filePath);
    
    // Verificar se não contém sequências perigosas
    const dangerousSequences = ['../', '..\\', '.\\', './'];
    if (dangerousSequences.some(seq => normalizedPath.includes(seq))) {
        throw new Error('Path traversal detectado');
    }
    
    // Verificar se está dentro do diretório permitido
    if (!normalizedPath.startsWith(`/${allowedDir}/`) && !normalizedPath.startsWith(allowedDir)) {
        throw new Error(`Acesso negado: fora do diretório ${allowedDir}`);
    }
    
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