/**
 * @file src/utils/logger.js
 * @description Sistema de logs estruturados para produção
 * @version 1.0.0
 */

const config = require('../config/environment');

/**
 * Níveis de log
 */
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

/**
 * Classe Logger estruturado
 */
class Logger {
    constructor() {
        this.level = LOG_LEVELS[config.DEBUG.LOG_LEVEL] || LOG_LEVELS.info;
        this.isProduction = config.IS_PRODUCTION;
    }

    /**
     * Formatar log para stdout/stderr
     */
    formatLog(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        
        if (this.isProduction) {
            // JSON estruturado para produção
            return JSON.stringify({
                timestamp,
                level,
                message,
                ...meta,
                pid: process.pid,
                env: config.NODE_ENV
            });
        } else {
            // Formato legível para desenvolvimento
            const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        }
    }

    /**
     * Verificar se deve logar
     */
    shouldLog(level) {
        return LOG_LEVELS[level] <= this.level;
    }

    /**
     * Log de erro
     */
    error(message, meta = {}) {
        if (this.shouldLog('error')) {
            console.error(this.formatLog('error', message, meta));
        }
    }

    /**
     * Log de warning
     */
    warn(message, meta = {}) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatLog('warn', message, meta));
        }
    }

    /**
     * Log de info
     */
    info(message, meta = {}) {
        if (this.shouldLog('info')) {
            console.log(this.formatLog('info', message, meta));
        }
    }

    /**
     * Log de debug
     */
    debug(message, meta = {}) {
        if (this.shouldLog('debug')) {
            console.log(this.formatLog('debug', message, meta));
        }
    }

    /**
     * Log de requisição HTTP
     */
    request(req, res, duration) {
        const meta = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            userId: req.user?.id || null
        };

        if (res.statusCode >= 400) {
            this.error(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
        } else {
            this.info(`HTTP ${res.statusCode} - ${req.method} ${req.url}`, meta);
        }
    }

    /**
     * Log de autenticação
     */
    auth(action, user, success, meta = {}) {
        const logMeta = {
            action,
            userId: user?.id || null,
            email: user?.email || null,
            success,
            ...meta
        };

        if (success) {
            this.info(`Auth ${action} successful`, logMeta);
        } else {
            this.warn(`Auth ${action} failed`, logMeta);
        }
    }

    /**
     * Log de banco de dados
     */
    database(operation, table, duration, meta = {}) {
        const logMeta = {
            operation,
            table,
            duration: `${duration}ms`,
            ...meta
        };

        if (duration > 1000) {
            this.warn(`Slow database query`, logMeta);
        } else {
            this.debug(`Database ${operation}`, logMeta);
        }
    }

    /**
     * Log de erro de aplicação
     */
    appError(error, context = {}) {
        const meta = {
            error: {
                name: error.name,
                message: error.message,
                stack: this.isProduction ? undefined : error.stack
            },
            context
        };

        this.error('Application error', meta);
    }
}

// Instância singleton
const logger = new Logger();

// Middleware para logs de requisição
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Override do res.end para capturar quando a resposta termina
    const originalEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - start;
        logger.request(req, res, duration);
        originalEnd.apply(this, args);
    };
    
    next();
};

// Override do console para capturar logs não estruturados
if (config.IS_PRODUCTION) {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = (...args) => {
        logger.info(args.join(' '));
    };
    
    console.error = (...args) => {
        logger.error(args.join(' '));
    };
    
    console.warn = (...args) => {
        logger.warn(args.join(' '));
    };
}

module.exports = {
    logger,
    requestLogger
};