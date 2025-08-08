// middleware.js
const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');
const jwt = require('jsonwebtoken');
const { securityLog } = require('./src/utils/security');

// Placeholder middleware for admin-only routes
const requireAdmin = (req, res, next) => {
    // In a real application, you would check for an admin role on the user object
    // For example: if (req.user && req.user.role === 'admin')
    if (req.user && req.user.isAdmin) { // Assuming an 'isAdmin' flag for now
        return next();
    }
    
    securityLog('admin_access_denied', { 
        userId: req.user ? req.user.id : 'unknown', 
        route: req.originalUrl 
    }, req.user ? req.user.id : null, req);

    return res.status(403).json({ error: "Acesso negado. Recurso para administradores." });
};

// Função para sanitizar inputs contra XSS
const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return xss(input);
    } else if (Array.isArray(input)) { // Adicionar tratamento explícito para arrays
        return input.map(item => sanitizeInput(item)); // Sanitiza cada item do array
    } else if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const key in input) {
            sanitized[key] = sanitizeInput(input[key]);
        }
        return sanitized;
    }
    return input;
};

// Middleware para sanitizar todos os inputs
const sanitizeMiddleware = (req, res, next) => {
    req.body = sanitizeInput(req.body);
    req.query = sanitizeInput(req.query);
    req.params = sanitizeInput(req.params);
    next();
};

// Middleware para verificar erros de validação
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Middleware aprimorado de autenticação com verificação adicional
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado. Por favor, faça login novamente.' });
            }
            return res.status(403).json({ error: 'Token inválido' });
        }
        
        // Verificar se o token tem as informações necessárias
        if (!user.id || !user.email) {
            return res.status(403).json({ error: 'Token malformado' });
        }
        
        req.user = user;
        next();
    });
};

// Validações comuns
const validators = {
    // Validação de email
    email: body('email')
        .isEmail().withMessage('Email inválido')
        .normalizeEmail(),
    
    // Validação de senha
    password: body('password')
        .isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres')
        .matches(/^[\w!@#$%^&*(),.?":{}|<>]+$/).withMessage('A senha contém caracteres inválidos'),
    
    // Validação de ID numérico
    numericId: (paramName) => param(paramName)
        .isInt({ min: 1 }).withMessage('ID inválido')
        .toInt(),
    
    // Validação de data
    date: (fieldName) => body(fieldName)
        .isISO8601().withMessage('Data inválida')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date >= today;
        }).withMessage('A data não pode ser no passado'),
    
    // Validação de texto com limite
    text: (fieldName, minLength = 1, maxLength = 1000) => body(fieldName)
        .isLength({ min: minLength, max: maxLength })
        .withMessage(`O campo deve ter entre ${minLength} e ${maxLength} caracteres`)
        .trim(),
    
    // Validação de número inteiro com range
    integer: (fieldName, min = 0, max = 1000) => body(fieldName)
        .isInt({ min, max })
        .withMessage(`O valor deve estar entre ${min} e ${max}`)
        .toInt(),
    
    // Validação de JSON
    jsonField: (fieldName) => body(fieldName)
        .custom((value) => {
            try {
                if (typeof value === 'object') return true;
                JSON.parse(value);
                return true;
            } catch {
                return false;
            }
        }).withMessage('JSON inválido'),
    
    // Validação de string de data em query parameters
    dateString: (paramName) => query(paramName)
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage('Formato de data inválido (use YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value + 'T00:00:00');
            return !isNaN(date.getTime());
        })
        .withMessage('Data inválida'),
    
    // Validação para criação de sessão
    sessionCreate: () => [
        body('study_plan_id')
            .isInt({ min: 1 })
            .withMessage('ID do plano é obrigatório')
            .toInt(),
        body('session_date')
            .matches(/^\d{4}-\d{2}-\d{2}$/)
            .withMessage('Formato de data inválido (use YYYY-MM-DD)')
            .custom((value) => {
                const date = new Date(value + 'T00:00:00');
                return !isNaN(date.getTime());
            })
            .withMessage('Data da sessão inválida'),
        body('topic_id')
            .optional()
            .isInt({ min: 1 })
            .withMessage('ID do tópico inválido')
            .toInt(),
        body('subject_name')
            .optional()
            .isLength({ max: 200 })
            .withMessage('Nome da matéria muito longo (máximo 200 caracteres)')
            .trim(),
        body('topic_description')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Descrição do tópico muito longa (máximo 500 caracteres)')
            .trim(),
        body('session_type')
            .optional()
            .isIn(['Novo Tópico', 'Revisão', 'Simulado Completo', 'Simulado Direcionado', 'Reforço', 'Questões', 'Redação'])
            .withMessage('Tipo de sessão inválido'),
        body('notes')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Anotações muito longas (máximo 1000 caracteres)')
            .trim()
    ],
    
    // Validação para atualização de sessão
    sessionUpdate: () => [
        body('subject_name')
            .optional()
            .isLength({ max: 200 })
            .withMessage('Nome da matéria muito longo (máximo 200 caracteres)')
            .trim(),
        body('topic_description')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Descrição do tópico muito longa (máximo 500 caracteres)')
            .trim(),
        body('session_date')
            .optional()
            .matches(/^\d{4}-\d{2}-\d{2}$/)
            .withMessage('Formato de data inválido (use YYYY-MM-DD)')
            .custom((value) => {
                const date = new Date(value + 'T00:00:00');
                return !isNaN(date.getTime());
            })
            .withMessage('Data da sessão inválida'),
        body('session_type')
            .optional()
            .isIn(['Novo Tópico', 'Revisão', 'Simulado Completo', 'Simulado Direcionado', 'Reforço', 'Questões', 'Redação'])
            .withMessage('Tipo de sessão inválido'),
        body('status')
            .optional()
            .isIn(['Pendente', 'Concluído'])
            .withMessage('Status inválido'),
        body('notes')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Anotações muito longas (máximo 1000 caracteres)')
            .trim(),
        body('questions_solved')
            .optional()
            .isInt({ min: 0, max: 1000 })
            .withMessage('Número de questões deve estar entre 0 e 1000')
            .toInt(),
        body('time_studied_seconds')
            .optional()
            .isInt({ min: 0, max: 28800 })
            .withMessage('Tempo de estudo deve estar entre 0 e 28800 segundos (8 horas)')
            .toInt()
    ],
    
    // Validação para status de sessão
    sessionStatus: () => [
        body('status')
            .isIn(['Pendente', 'Concluído'])
            .withMessage('Status deve ser "Pendente" ou "Concluído"')
    ],
    
    // Validação para adiamento de sessão
    sessionPostpone: () => [
        body('newDate')
            .optional()
            .matches(/^\d{4}-\d{2}-\d{2}$/)
            .withMessage('Formato de data inválido (use YYYY-MM-DD)')
            .custom((value) => {
                const date = new Date(value + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return !isNaN(date.getTime()) && date >= today;
            })
            .withMessage('Nova data deve ser hoje ou no futuro')
    ],
    
    // Validação para atualização em lote de status
    batchStatusUpdate: () => [
        body('sessions')
            .isArray({ min: 1 })
            .withMessage('Lista de sessões é obrigatória e não pode estar vazia'),
        body('sessions.*.id')
            .isInt({ min: 1 })
            .withMessage('ID da sessão inválido')
            .toInt(),
        body('sessions.*.status')
            .isIn(['Pendente', 'Concluído'])
            .withMessage('Status da sessão inválido')
    ],
    
    // Validação para registro de tempo
    timeRecord: () => [
        body('start_time')
            .isISO8601()
            .withMessage('Hora de início inválida (use formato ISO 8601)'),
        body('end_time')
            .isISO8601()
            .withMessage('Hora de fim inválida (use formato ISO 8601)')
            .custom((endTime, { req }) => {
                const startTime = req.body.start_time;
                if (!startTime) return true; // Will be caught by start_time validation
                
                const start = new Date(startTime);
                const end = new Date(endTime);
                
                return end > start;
            })
            .withMessage('Hora de fim deve ser posterior à hora de início')
            .custom((endTime, { req }) => {
                const startTime = req.body.start_time;
                if (!startTime) return true;
                
                const start = new Date(startTime);
                const end = new Date(endTime);
                const durationHours = (end - start) / (1000 * 60 * 60);
                
                return durationHours <= 8;
            })
            .withMessage('Tempo de estudo não pode ser maior que 8 horas')
    ]
};

// Middleware para prevenir SQL injection em campos de ordenação
const validateOrderBy = (allowedFields) => {
    return (req, res, next) => {
        if (req.query.orderBy && !allowedFields.includes(req.query.orderBy)) {
            return res.status(400).json({ error: 'Campo de ordenação inválido' });
        }
        next();
    };
};

// Middleware para limitar tamanho do corpo da requisição
const bodySizeLimit = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = req.headers['content-length'];
        const maxBytes = parseInt(maxSize) * 1024 * 1024;
        
        if (contentLength && parseInt(contentLength) > maxBytes) {
            return res.status(413).json({ error: 'Requisição muito grande' });
        }
        next();
    };
};

module.exports = {
    sanitizeInput,
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    requireAdmin,
    validators,
    validateOrderBy,
    bodySizeLimit
};