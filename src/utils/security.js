/**
 * UTILITÁRIOS DE SEGURANÇA - EDITALIZA
 * Implementação de funções críticas para prevenir vulnerabilidades
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

/**
 * Validar nomes de tabela para prevenir SQL Injection
 * @param {string} tableName - Nome da tabela a ser validado
 * @returns {string} - Nome validado da tabela
 */
function validateTableName(tableName) {
    // Lista de tabelas permitidas no sistema
    const allowedTables = [
        'users', 'study_plans', 'subjects', 'topics', 'study_sessions',
        'user_activities', 'user_settings', 'user_preferences', 'privacy_settings',
        'login_attempts', 'reta_final_excluded_topics', 'reta_final_exclusions',
        'study_time_logs'
    ];
    
    if (!allowedTables.includes(tableName)) {
        throw new Error(`Tabela '${tableName}' não é permitida no sistema`);
    }
    
    // Validar caracteres alfanuméricos e underscore apenas
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(`Nome de tabela '${tableName}' contém caracteres inválidos`);
    }
    
    return tableName;
}

/**
 * Sanitizar entrada de dados para prevenir XSS
 * @param {string} input - Dados de entrada
 * @returns {string} - Dados sanitizados
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove tags HTML e scripts maliciosos
    let sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
    
    // Escapar caracteres especiais
    sanitized = validator.escape(sanitized);
    
    return sanitized.trim();
}

/**
 * Validar email com regras rigorosas
 * @param {string} email - Email a ser validado
 * @returns {boolean} - Se o email é válido
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    // Usar validator.js para validação rigorosa
    return validator.isEmail(email, {
        allow_display_name: false,
        require_display_name: false,
        allow_utf8_local_part: false,
        require_tld: true
    });
}

/**
 * Validar senha com critérios de segurança
 * @param {string} password - Senha a ser validada
 * @returns {object} - Resultado da validação
 */
function validatePassword(password) {
    const result = {
        isValid: false,
        errors: []
    };
    
    if (!password || typeof password !== 'string') {
        result.errors.push('Senha é obrigatória');
        return result;
    }
    
    if (password.length < 8) {
        result.errors.push('Senha deve ter pelo menos 8 caracteres');
    }
    
    if (!/[a-z]/.test(password)) {
        result.errors.push('Senha deve conter pelo menos uma letra minúscula');
    }
    
    if (!/[A-Z]/.test(password)) {
        result.errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }
    
    if (!/\d/.test(password)) {
        result.errors.push('Senha deve conter pelo menos um número');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        result.errors.push('Senha deve conter pelo menos um caractere especial');
    }
    
    result.isValid = result.errors.length === 0;
    return result;
}

/**
 * Gerar token seguro para reset de senha
 * @returns {string} - Token criptograficamente seguro
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash seguro de senha com salt
 * @param {string} password - Senha a ser hasheada
 * @returns {Promise<string>} - Hash da senha
 */
async function hashPassword(password) {
    const bcrypt = require('bcrypt');
    const saltRounds = 12; // Aumentado para maior segurança
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Verificar senha contra hash
 * @param {string} password - Senha em texto plano
 * @param {string} hash - Hash armazenado
 * @returns {Promise<boolean>} - Se a senha é válida
 */
async function verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
}

/**
 * Rate limiting rigoroso para APIs críticas
 */
const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas por IP
    message: {
        error: 'Muitas tentativas. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        securityLog('rate_limit_exceeded', {
            ip: req.ip,
            endpoint: req.path,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({
            error: 'Muitas tentativas. Tente novamente em 15 minutos.',
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }
});

/**
 * Rate limiting moderado para outras APIs
 */
const moderateRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 tentativas por IP
    message: {
        error: 'Limite de requisições excedido. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Logging de eventos de segurança
 * @param {string} event - Tipo do evento
 * @param {object} metadata - Dados adicionais
 */
function securityLog(event, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        event,
        severity: 'SECURITY',
        ...metadata
    };
    
    // Em produção, enviar para sistema de monitoramento
    if (process.env.NODE_ENV === 'production') {
        console.log('[SECURITY]', JSON.stringify(logEntry));
    } else {
        console.log('[SECURITY]', event, metadata);
    }
}

/**
 * Validar parâmetros de entrada de API
 * @param {object} data - Dados a serem validados
 * @param {object} schema - Schema de validação
 * @returns {object} - Resultado da validação
 */
function validateApiInput(data, schema) {
    const result = {
        isValid: true,
        errors: [],
        sanitizedData: {}
    };
    
    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];
        
        // Verificar se campo é obrigatório
        if (rules.required && (value === undefined || value === null || value === '')) {
            result.errors.push(`Campo '${field}' é obrigatório`);
            result.isValid = false;
            continue;
        }
        
        // Se campo não é obrigatório e está vazio, pular validação
        if (!rules.required && (value === undefined || value === null || value === '')) {
            continue;
        }
        
        // Validação de tipo
        if (rules.type && typeof value !== rules.type) {
            result.errors.push(`Campo '${field}' deve ser do tipo ${rules.type}`);
            result.isValid = false;
            continue;
        }
        
        // Sanitizar string
        if (typeof value === 'string') {
            result.sanitizedData[field] = sanitizeInput(value);
            
            // Validação de comprimento mínimo
            if (rules.minLength && result.sanitizedData[field].length < rules.minLength) {
                result.errors.push(`Campo '${field}' deve ter pelo menos ${rules.minLength} caracteres`);
                result.isValid = false;
            }
            
            // Validação de comprimento máximo
            if (rules.maxLength && result.sanitizedData[field].length > rules.maxLength) {
                result.errors.push(`Campo '${field}' deve ter no máximo ${rules.maxLength} caracteres`);
                result.isValid = false;
            }
            
            // Validação de email
            if (rules.format === 'email' && !isValidEmail(result.sanitizedData[field])) {
                result.errors.push(`Campo '${field}' deve ser um email válido`);
                result.isValid = false;
            }
        } else {
            result.sanitizedData[field] = value;
        }
        
        // Validação customizada
        if (rules.validator && typeof rules.validator === 'function') {
            const customValidation = rules.validator(result.sanitizedData[field]);
            if (!customValidation.isValid) {
                result.errors.push(...customValidation.errors);
                result.isValid = false;
            }
        }
    }
    
    return result;
}

/**
 * Middleware para validação CSRF
 */
function csrfProtection() {
    return (req, res, next) => {
        // Métodos seguros não precisam de validação CSRF
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }
        
        const token = req.headers['x-csrf-token'] || req.body?._token;
        const sessionToken = req.session?.csrfToken;
        
        if (!token || !sessionToken || token !== sessionToken) {
            securityLog('csrf_validation_failed', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.path
            });
            
            return res.status(403).json({
                error: 'Token CSRF inválido',
                code: 'CSRF_TOKEN_INVALID'
            });
        }
        
        next();
    };
}

/**
 * Gerar token CSRF para sessão
 * @returns {string} - Token CSRF
 */
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Criar erro seguro para resposta ao cliente
 * @param {Error} error - Erro original
 * @param {string} defaultMessage - Mensagem padrão segura
 * @returns {object} - Objeto de erro seguro
 */
function createSafeError(error, defaultMessage = 'Erro interno do servidor') {
    // Em produção, não expor detalhes do erro
    if (process.env.NODE_ENV === 'production') {
        return { error: defaultMessage };
    }
    
    // Em desenvolvimento, incluir mais detalhes
    return {
        error: error.message || defaultMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
}

/**
 * Verificar limite de taxa para usuário
 * @param {string} userId - ID do usuário
 * @param {string} action - Ação sendo realizada
 * @param {number} maxAttempts - Máximo de tentativas permitidas
 * @param {number} windowMs - Janela de tempo em ms
 * @returns {boolean} - True se dentro do limite, false se excedido
 */
const userRateLimits = new Map();

function checkUserRateLimit(userId, action, maxAttempts = 5, windowMs = 900000) {
    const key = `${userId}:${action}`;
    const now = Date.now();
    
    if (!userRateLimits.has(key)) {
        userRateLimits.set(key, { attempts: 1, resetTime: now + windowMs });
        return true;
    }
    
    const limit = userRateLimits.get(key);
    
    // Resetar se a janela de tempo passou
    if (now > limit.resetTime) {
        userRateLimits.set(key, { attempts: 1, resetTime: now + windowMs });
        return true;
    }
    
    // Incrementar tentativas
    limit.attempts++;
    
    // Verificar se excedeu o limite
    if (limit.attempts > maxAttempts) {
        return false;
    }
    
    userRateLimits.set(key, limit);
    return true;
}

module.exports = {
    validateTableName,
    sanitizeInput,
    isValidEmail,
    validatePassword,
    generateSecureToken,
    hashPassword,
    verifyPassword,
    strictRateLimit,
    moderateRateLimit,
    securityLog,
    validateApiInput,
    csrfProtection,
    generateCSRFToken,
    createSafeError,
    checkUserRateLimit
};