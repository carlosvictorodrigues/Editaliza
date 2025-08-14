/**
 * SISTEMA DE ERROR HANDLING ROBUSTO - EDITALIZA
 * Tratamento centralizado de erros com logging e recuperação
 */

const fs = require('fs');
const path = require('path');
const { securityLog } = require('./security');

/**
 * Tipos de erro padronizados
 */
const ERROR_TYPES = {
    VALIDATION: 'VALIDATION_ERROR',
    DATABASE: 'DATABASE_ERROR',
    AUTHENTICATION: 'AUTH_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    RATE_LIMIT: 'RATE_LIMIT_ERROR',
    INTERNAL: 'INTERNAL_ERROR',
    NETWORK: 'NETWORK_ERROR',
    FILE_SYSTEM: 'FILE_SYSTEM_ERROR'
};

/**
 * Códigos de erro HTTP padronizados
 */
const HTTP_STATUS = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

/**
 * Classe para erros customizados
 */
class AppError extends Error {
    constructor(message, type = ERROR_TYPES.INTERNAL, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, isOperational = true) {
        super(message);
        
        this.name = this.constructor.name;
        this.type = type;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Logger de erros com rotação automática
 */
class ErrorLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `error-${date}.log`);
    }

    log(error, req = null, additionalContext = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            error: {
                name: error.name,
                message: error.message,
                type: error.type || ERROR_TYPES.INTERNAL,
                statusCode: error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                stack: error.stack
            },
            request: req ? {
                method: req.method,
                url: req.url,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id || null
            } : null,
            context: additionalContext
        };

        // Log para console em desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
            console.error('[ERROR]', JSON.stringify(logEntry, null, 2));
        }

        // Log para arquivo
        try {
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(this.getLogFileName(), logLine);
        } catch (fileError) {
            console.error('Erro ao escrever log:', fileError);
        }

        // Log de segurança para erros críticos
        if (error.type === ERROR_TYPES.AUTHENTICATION || 
            error.type === ERROR_TYPES.AUTHORIZATION ||
            error.statusCode >= 500) {
            securityLog('error_logged', {
                errorType: error.type,
                statusCode: error.statusCode,
                endpoint: req?.url,
                userId: req?.user?.id
            });
        }
    }

    async cleanup(daysToKeep = 7) {
        try {
            const files = fs.readdirSync(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            for (const file of files) {
                if (file.startsWith('error-') && file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        console.log(`Log antigo removido: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Erro na limpeza de logs:', error);
        }
    }
}

// Instância global do logger
const errorLogger = new ErrorLogger();

/**
 * Middleware de tratamento de erros
 */
function errorHandler(err, req, res, next) {
    // Garantir que temos um erro AppError
    let error = err;
    if (!(err instanceof AppError)) {
        error = new AppError(
            err.message || 'Erro interno do servidor',
            ERROR_TYPES.INTERNAL,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            false
        );
    }

    // Log do erro
    errorLogger.log(error, req);

    // Resposta para o cliente
    const response = {
        error: true,
        type: error.type,
        message: error.message,
        timestamp: error.timestamp
    };

    // Em desenvolvimento, incluir stack trace
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        response.stack = error.stack;
    }

    // Verificar se resposta já foi enviada
    if (!res.headersSent) {
        res.status(error.statusCode).json(response);
    }
}

/**
 * Wrapper para async functions com tratamento automático de erro
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Tratamento específico para erros de banco de dados
 */
function handleDatabaseError(err) {
    let message = 'Erro no banco de dados';
    let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;

    // SQLite specific errors
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        message = 'Já existe um registro com estes dados';
        statusCode = HTTP_STATUS.CONFLICT;
    } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        message = 'Erro de integridade dos dados';
        statusCode = HTTP_STATUS.BAD_REQUEST;
    } else if (err.code === 'SQLITE_BUSY') {
        message = 'Banco de dados temporariamente indisponível';
        statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
    }

    return new AppError(message, ERROR_TYPES.DATABASE, statusCode);
}

/**
 * Validador de entrada com tratamento de erro
 */
function validateRequired(data, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field] === '') {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        throw new AppError(
            `Campos obrigatórios ausentes: ${missingFields.join(', ')}`,
            ERROR_TYPES.VALIDATION,
            HTTP_STATUS.BAD_REQUEST
        );
    }
}

/**
 * Tratamento de erros não capturados
 */
function setupGlobalErrorHandling() {
    // Erros não capturados de Promises
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        errorLogger.log(new AppError(
            `Unhandled Rejection: ${reason}`,
            ERROR_TYPES.INTERNAL,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            false
        ));
    });

    // Exceções não capturadas
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        errorLogger.log(new AppError(
            `Uncaught Exception: ${error.message}`,
            ERROR_TYPES.INTERNAL,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            false
        ));
        
        // Em produção, reiniciar graciosamente
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    });
}

/**
 * Circuit breaker para operações críticas
 */
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.threshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new AppError(
                    'Serviço temporariamente indisponível',
                    ERROR_TYPES.INTERNAL,
                    HTTP_STATUS.SERVICE_UNAVAILABLE
                );
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
        }
    }
}

// Limpeza automática de logs (executar uma vez por dia)
setInterval(() => {
    errorLogger.cleanup();
}, 24 * 60 * 60 * 1000);

module.exports = {
    AppError,
    ERROR_TYPES,
    HTTP_STATUS,
    ErrorLogger,
    errorLogger,
    errorHandler,
    asyncHandler,
    handleDatabaseError,
    validateRequired,
    setupGlobalErrorHandling,
    CircuitBreaker
};