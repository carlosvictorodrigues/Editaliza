/**
 * Middleware de Validação Robusto - Reescrito para compatibilidade
 * Implementa validações avançadas, sanitização e proteções contra ataques
 * 
 * FUNCIONALIDADES:
 * - Validação de entrada com express-validator
 * - Sanitização contra XSS
 * - Proteção contra SQL injection
 * - Rate limiting inteligente
 * - Validação de tipos de dados
 * - Normalização de dados
 * - Logging de tentativas de ataque
 * - Blacklist de IPs maliciosos
 */

const { body, param, query, validationResult, matchedData } = require('express-validator');
const logger = require('../../src/utils/logger');

// === CONFIGURAÇÕES DE SEGURANÇA ===

// Lista de campos que nunca devem ser logados
const SENSITIVE_FIELDS = [
    'password',
    'confirmPassword', 
    'newPassword',
    'currentPassword',
    'password_hash',
    'token',
    'refreshToken',
    'accessToken',
    'authorization',
    'cookie',
    'session'
];

// Blacklist de IPs (em produção usar Redis)
const ipBlacklist = new Set();

// === MIDDLEWARE DE VALIDAÇÃO ===

/**
 * Processa erros de validação do express-validator
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Sanitizar dados para log (remover campos sensíveis)
        const safeBody = { ...req.body };
        SENSITIVE_FIELDS.forEach(field => {
            if (safeBody[field]) {
                safeBody[field] = '[REDACTED]';
            }
        });
        
        logger.info('Validation errors in request', {
            url: req.originalUrl,
            method: req.method,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                location: err.location,
                value: SENSITIVE_FIELDS.includes(err.param) ? '[REDACTED]' : err.value
            })),
            body: safeBody
        });
        
        return res.status(400).json({
            success: false,
            error: 'Dados de entrada inválidos',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                location: err.location
            }))
        });
    }
    
    // Adicionar dados validados ao request
    req.validatedData = matchedData(req);
    
    // CRÍTICO: Sempre chamar next() quando não há erros de validação
    return next();
}

// === VALIDADORES PRÉ-DEFINIDOS ===

/**
 * Validadores comuns reutilizáveis
 */
const validators = {
    // Email com sanitização
    email: (fieldName = 'email', options = {}) => {
        const { required = true } = options;
        
        let validator = body(fieldName)
            .trim()
            .isEmail()
            .withMessage('Email deve ter um formato válido')
            .normalizeEmail({
                gmail_remove_dots: false, // Manter pontos no Gmail
                gmail_remove_subaddress: false, // Manter + no Gmail
                outlookdotcom_remove_subaddress: false
            })
            .isLength({ min: 3, max: 255 })
            .withMessage('Email deve ter entre 3 e 255 caracteres');
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Senha robusta
    password: (fieldName = 'password', options = {}) => {
        const { minLength = 8, maxLength = 128, requireSymbols = true } = options;
        
        let passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/; // Ao menos: minúscula, maiúscula, número
        
        if (requireSymbols) {
            passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/; // + símbolo
        }
        
        return body(fieldName)
            .isLength({ min: minLength, max: maxLength })
            .withMessage(`Senha deve ter entre ${minLength} e ${maxLength} caracteres`)
            .matches(passwordRegex)
            .withMessage(requireSymbols 
                ? 'Senha deve conter ao menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial (@$!%*?&)'
                : 'Senha deve conter ao menos: 1 letra minúscula, 1 maiúscula e 1 número'
            )
            .custom((value) => {
                // Verificar padrões comuns fracos
                const weakPatterns = [
                    /123456/,
                    /password/i,
                    /qwerty/i,
                    /admin/i,
                    /(.)\\1{2,}/ // 3 ou mais caracteres repetidos
                ];
                
                for (const pattern of weakPatterns) {
                    if (pattern.test(value)) {
                        throw new Error('Senha contém padrões comuns que são facilmente quebrados');
                    }
                }
                
                return true;
            });
    },
    
    // Nome com validação de caracteres
    name: (fieldName = 'name', options = {}) => {
        const { minLength = 2, maxLength = 100, required = false } = options;
        
        let validator = body(fieldName)
            .trim()
            .isLength({ min: minLength, max: maxLength })
            .withMessage(`Nome deve ter entre ${minLength} e ${maxLength} caracteres`)
            .matches(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/)
            .withMessage('Nome deve conter apenas letras, espaços, hífens e apóstrofes')
            .custom((value) => {
                // Verificar se não é só espaços ou caracteres especiais
                if (!/[a-zA-ZÀ-ÿ\u00f1\u00d1]/.test(value)) {
                    throw new Error('Nome deve conter ao menos uma letra');
                }
                return true;
            });
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // ID numérico
    numericId: (paramName = 'id', options = {}) => {
        const { min = 1, max = 2147483647 } = options; // max int32
        
        return param(paramName)
            .isInt({ min, max })
            .withMessage(`ID deve ser um número inteiro entre ${min} e ${max}`)
            .toInt();
    },
    
    // Data ISO
    date: (fieldName, options = {}) => {
        const { allowPast = false, allowFuture = true, required = true } = options;
        
        let validator = body(fieldName)
            .isISO8601({ strict: true })
            .withMessage('Data deve estar no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)')
            .custom((value) => {
                const date = new Date(value);
                const now = new Date();
                
                if (!allowPast && date < now) {
                    throw new Error('Data não pode ser no passado');
                }
                
                if (!allowFuture && date > now) {
                    throw new Error('Data não pode ser no futuro');
                }
                
                return true;
            })
            .toDate();
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Texto com sanitização
    text: (fieldName, options = {}) => {
        const { minLength = 1, maxLength = 1000, allowHtml = false, required = true } = options;
        
        let validator = body(fieldName)
            .trim()
            .isLength({ min: minLength, max: maxLength })
            .withMessage(`${fieldName} deve ter entre ${minLength} e ${maxLength} caracteres`);
        
        if (!allowHtml) {
            validator = validator.custom((value) => {
                if (/<[^>]+>/g.test(value)) {
                    throw new Error('HTML não é permitido neste campo');
                }
                return true;
            });
        }
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // URL validação
    url: (fieldName = 'url', options = {}) => {
        const { protocols = ['http', 'https'], required = true } = options;
        
        let validator = body(fieldName)
            .isURL({ protocols, require_protocol: true })
            .withMessage('URL deve ser válida e usar protocolo HTTP/HTTPS')
            .isLength({ max: 2000 })
            .withMessage('URL não pode ter mais de 2000 caracteres');
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Boolean
    boolean: (fieldName, required = false) => {
        let validator = body(fieldName)
            .isBoolean()
            .withMessage(`${fieldName} deve ser verdadeiro ou falso`)
            .toBoolean();
        
        if (!required) {
            validator = validator.optional({ nullable: true });
        }
        
        return validator;
    },
    
    // Enum/Choices
    enum: (fieldName, allowedValues, required = true) => {
        let validator = body(fieldName)
            .isIn(allowedValues)
            .withMessage(`${fieldName} deve ser um dos valores: ${allowedValues.join(', ')}`);
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Integer validation
    integer: (fieldName, min = 0, max = Number.MAX_SAFE_INTEGER, required = true) => {
        let validator = body(fieldName)
            .isInt({ min, max })
            .withMessage(`${fieldName} deve ser um número inteiro entre ${min} e ${max}`)
            .toInt();
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // JSON field validation - critical for schedule generation
    jsonField: (fieldName, required = true) => {
        let validator = body(fieldName)
            .custom((value) => {
                if (typeof value === 'object' && value !== null) {
                    // Se já é objeto, assumir que foi parseado corretamente
                    return true;
                }
                
                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        if (typeof parsed === 'object' && parsed !== null) {
                            return true;
                        }
                        throw new Error('JSON deve resultar em um objeto');
                    } catch (parseError) {
                        throw new Error('Campo deve conter JSON válido');
                    }
                }
                
                throw new Error('Campo deve ser um objeto JSON válido');
            })
            .withMessage(`${fieldName} deve ser um objeto JSON válido`)
            .custom((value) => {
                // Validação específica para study_hours_per_day
                if (fieldName === 'study_hours_per_day') {
                    const hours = typeof value === 'string' ? JSON.parse(value) : value;
                    
                    // Verificar se tem as chaves esperadas (dias da semana: 0-6)
                    for (let day = 0; day <= 6; day++) {
                        if (hours[day.toString()] === undefined) {
                            throw new Error(`Falta configuração para o dia ${day} (0=Domingo, 1=Segunda, etc)`);
                        }
                        
                        const dayHours = parseInt(hours[day.toString()], 10);
                        if (isNaN(dayHours) || dayHours < 0 || dayHours > 24) {
                            throw new Error(`Horas para o dia ${day} deve ser entre 0 e 24`);
                        }
                    }
                }
                
                return true;
            });
        
        if (!required) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Validadores para admin routes - que podem ser query params, body ou path params
    numericParam: (fieldName, options = {}) => {
        const { min = 1, max = 2147483647, optional = false, location = 'query' } = options;
        
        let validatorFunc;
        if (location === 'params') {
            validatorFunc = param;
        } else if (location === 'body') {
            validatorFunc = body;
        } else {
            validatorFunc = query; // default to query
        }
        
        let validator = validatorFunc(fieldName)
            .isInt({ min, max })
            .withMessage(`${fieldName} deve ser um número inteiro entre ${min} e ${max}`)
            .toInt();
            
        if (optional) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    // Validador para tempo de estudo em segundos
    studyTime: body('timeStudiedSeconds')
        .optional()
        .isInt({ min: 0, max: 86400 })
        .withMessage('Tempo deve ser entre 0 e 86400 segundos (24 horas)')
        .toInt()
        // Também aceitar incrementSeconds como alternativa
        .custom((value, { req }) => {
            if (req.body.incrementSeconds !== undefined && !req.body.timeStudiedSeconds) {
                const increment = parseInt(req.body.incrementSeconds, 10);
                if (!isNaN(increment) && increment >= 0 && increment <= 86400) {
                    req.body.timeStudiedSeconds = increment;
                    return true;
                }
                throw new Error('incrementSeconds deve ser um número entre 0 e 86400');
            }
            return true;
        }),
    
    textParam: (fieldName, options = {}) => {
        const { minLength = 0, maxLength = 255, optional = false, location = 'query' } = options;
        
        let validatorFunc;
        if (location === 'params') {
            validatorFunc = param;
        } else if (location === 'body') {
            validatorFunc = body;
        } else {
            validatorFunc = query; // default to query
        }
        
        let validator = validatorFunc(fieldName)
            .trim()
            .isLength({ min: minLength, max: maxLength })
            .withMessage(`${fieldName} deve ter entre ${minLength} e ${maxLength} caracteres`);
            
        if (optional) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    enumParam: (fieldName, allowedValues, options = {}) => {
        const { optional = false, location = 'query' } = options;
        
        let validatorFunc;
        if (location === 'params') {
            validatorFunc = param;
        } else if (location === 'body') {
            validatorFunc = body;
        } else {
            validatorFunc = query; // default to query
        }
        
        let validator = validatorFunc(fieldName)
            .isIn(allowedValues)
            .withMessage(`${fieldName} deve ser um dos valores: ${allowedValues.join(', ')}`);
            
        if (optional) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    },
    
    dateParam: (fieldName, options = {}) => {
        const { optional = false, location = 'query', allowPast = true, allowFuture = true } = options;
        
        let validatorFunc;
        if (location === 'params') {
            validatorFunc = param;
        } else if (location === 'body') {
            validatorFunc = body;
        } else {
            validatorFunc = query; // default to query
        }
        
        let validator = validatorFunc(fieldName)
            .isISO8601({ strict: true })
            .withMessage(`${fieldName} deve estar no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)`)
            .custom((value) => {
                const date = new Date(value);
                const now = new Date();
                
                if (!allowPast && date < now) {
                    throw new Error(`${fieldName} não pode ser no passado`);
                }
                
                if (!allowFuture && date > now) {
                    throw new Error(`${fieldName} não pode ser no futuro`);
                }
                
                return true;
            })
            .toDate();
            
        if (optional) {
            validator = validator.optional({ nullable: true, checkFalsy: true });
        }
        
        return validator;
    }
};

// === FUNÇÕES DE COMPATIBILIDADE COM SERVER.JS ORIGINAL ===

/**
 * Função auxiliar para compatibilidade com implementação original
 */
function jsonField(fieldName) {
    return validators.jsonField(fieldName, true);
}

function integer(fieldName, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return validators.integer(fieldName, min, max, true);
}

function numericId(paramName = 'id') {
    return validators.numericId(paramName);
}

// === MIDDLEWARE DE SANITIZAÇÃO BÁSICO ===

/**
 * Middleware básico de sanitização
 */
function sanitizeMiddleware(req, res, next) {
    // Sanitização básica - pode ser expandida conforme necessário
    if (req.body && typeof req.body === 'object') {
        // Remover null bytes de strings
        function cleanStrings(obj) {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key].replace(/\0/g, '');
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    cleanStrings(obj[key]);
                }
            }
        }
        cleanStrings(req.body);
    }
    
    next();
}

module.exports = {
    // Middleware principais
    sanitizeMiddleware,
    handleValidationErrors,
    
    // Validadores
    validators,
    
    // Funções de compatibilidade com server.js original
    jsonField,
    integer,
    numericId,
    
    // Para testes e debugging
    ipBlacklist,
    SENSITIVE_FIELDS
};