/**
 * @file src/utils/logger_fixed.js
 * @description Sistema de logs estruturados com correção para objetos circulares
 */

const winston = require('winston');
const path = require('path');

// Função para serializar objetos com referências circulares
function safeStringify(obj, indent = 2) {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return '[Circular Reference]';
            }
            cache.add(value);
        }
        // Limitar tamanho de strings longas
        if (typeof value === 'string' && value.length > 1000) {
            return value.substring(0, 1000) + '... [truncated]';
        }
        return value;
    }, indent);
}

// Formato customizado para logs
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
        try {
            log += ` ${safeStringify(metadata)}`;
        } catch (err) {
            log += ` [Error serializing metadata: ${err.message}]`;
        }
    }
    
    return log;
});

// Configuração do logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        customFormat
    ),
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        })
    ]
});

// Adicionar transport de arquivo em produção
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }));
    
    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'combined.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }));
}

// Wrapper para manter compatibilidade
const loggerWrapper = {
    info: (message, metadata = {}) => {
        logger.info(message, metadata);
    },
    warn: (message, metadata = {}) => {
        logger.warn(message, metadata);
    },
    error: (message, metadata = {}) => {
        logger.error(message, metadata);
    },
    debug: (message, metadata = {}) => {
        logger.debug(message, metadata);
    }
};

module.exports = {
    logger: loggerWrapper,
    rawLogger: logger
};