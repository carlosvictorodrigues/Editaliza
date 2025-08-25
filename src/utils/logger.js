/**
 * Sistema de Logging Robusto com Winston
 * Implementa logging estruturado, rotação de arquivos e performance tracking
 * 
 * FUNCIONALIDADES:
 * - Múltiplos níveis de log (error, warn, info, debug)
 * - Rotação automática de arquivos
 * - Logging estruturado em JSON
 * - Context tracking para requisições
 * - Performance monitoring
 * - Security event logging
 * - Filtros inteligentes para reduzir ruído
 * - Backward compatibility com logger anterior
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Tentar importar configuração (pode não existir ainda)
let appConfig;
try {
    appConfig = require('../config/app.config');
} catch (error) {
    // Fallback configuration se app.config não existir
    appConfig = {
        environment: {
            isDevelopment: process.env.NODE_ENV !== 'production',
            isProduction: process.env.NODE_ENV === 'production'
        },
        logging: {
            level: process.env.LOG_LEVEL || 'info',
            sql: process.env.LOG_SQL === 'true',
            performance: {
                enabled: process.env.NODE_ENV !== 'production',
                slowQueryThreshold: 1000,
                slowRequestThreshold: 2000
            },
            rotation: {
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5,
                zippedArchive: true
            }
        },
        paths: {
            logs: path.join(process.cwd(), 'logs')
        }
    };
}

// Garantir que diretório de logs existe
const logDir = appConfig.paths.logs;
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// === BACKWARD COMPATIBILITY ===
// Manter funções do logger anterior
function safeStringify(obj, { maxDepth = 8, maxLen = 10000 } = {}) {
  const seen = new WeakSet();
  function recur(value, depth = 0) {
    if (depth > maxDepth) return '[MaxDepth]';
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(v => recur(v, depth + 1));
      const out = {};
      for (const k of Object.keys(value)) out[k] = recur(value[k], depth + 1);
      return out;
    }
    if (typeof value === 'string' && value.length > maxLen) {
      return value.slice(0, maxLen) + '…[truncated]';
    }
    return value;
  }
  try { return JSON.stringify(recur(obj)); } catch { return '"[Unserializable]"'; }
}

function serializeError(err) {
  if (!err || typeof err !== 'object') return err;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: err.code,
    status: err.status || err.statusCode,
    cause: err.cause && (typeof err.cause === 'object'
      ? { name: err.cause.name, message: err.cause.message, stack: err.cause.stack }
      : String(err.cause)),
    ...('toJSON' in err ? err.toJSON() : {}),
  };
}

// === FORMATTERS ===

// Formato para desenvolvimento (colorido e legível)
const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, category, requestId, userId, ...meta }) => {
        let output = `${timestamp} [${level}]`;
        
        if (category) output += ` [${category}]`;
        if (requestId) output += ` [${requestId.substring(0, 8)}]`;
        if (userId) output += ` [user:${userId}]`;
        
        output += ` ${message}`;
        
        if (Object.keys(meta).length > 0) {
            output += ` ${safeStringify(meta)}`;
        }
        
        return output;
    })
);

// Formato para produção (JSON estruturado)
const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        // Estrutura consistente para logs em produção
        const logEntry = {
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            category: info.category || 'general',
            requestId: info.requestId,
            userId: info.userId,
            ip: info.ip,
            userAgent: info.userAgent,
            duration: info.duration,
            statusCode: info.statusCode,
            method: info.method,
            url: info.url,
            ...info.meta
        };

        // Remover campos undefined
        Object.keys(logEntry).forEach(key => {
            if (logEntry[key] === undefined) {
                delete logEntry[key];
            }
        });

        return JSON.stringify(logEntry);
    })
);

// Formato de fallback (compatível com logger anterior)
const fallbackFormat = winston.format.printf(info => {
  const { level, message, timestamp, ...meta } = info;
  const m = typeof message === 'string' ? message : safeStringify(message);
  const rest = Object.keys(meta).length ? ' ' + safeStringify(meta) : '';
  return `${timestamp} ${level}: ${m}${rest}`;
});

// === TRANSPORTS ===

const transports = [];

// Console transport
transports.push(
    new winston.transports.Console({
        level: appConfig.logging.level,
        format: appConfig.environment.isDevelopment ? developmentFormat : 
               (winston.format.combine(
                   winston.format.timestamp(),
                   winston.format.errors({ stack: true }),
                   fallbackFormat
               )),
        handleExceptions: true,
        handleRejections: true
    })
);

// Tentar adicionar transports de arquivo se winston-daily-rotate-file estiver disponível
try {
    const DailyRotateFile = require('winston-daily-rotate-file');
    
    // Arquivo de erros
    transports.push(
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            format: productionFormat,
            maxSize: appConfig.logging.rotation.maxsize,
            maxFiles: appConfig.logging.rotation.maxFiles,
            zippedArchive: appConfig.logging.rotation.zippedArchive,
            handleExceptions: true,
            handleRejections: true
        })
    );

    // Arquivo combinado
    transports.push(
        new DailyRotateFile({
            filename: path.join(logDir, 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            format: productionFormat,
            maxSize: appConfig.logging.rotation.maxsize,
            maxFiles: appConfig.logging.rotation.maxFiles,
            zippedArchive: appConfig.logging.rotation.zippedArchive
        })
    );
} catch (error) {
    // winston-daily-rotate-file não disponível, usar transports básicos
    if (appConfig.environment.isDevelopment) {
        console.warn('winston-daily-rotate-file não instalado. Usando apenas console transport.');
    }
}

// === LOGGER PRINCIPAL ===

const logger = winston.createLogger({
    level: appConfig.logging.level,
    transports,
    exitOnError: false
});

// === PADRÕES DE LOG IGNORADOS ===

const ignorePatterns = [
    /MODULE_NOT_FOUND.*\/opt\/Editaliza-sv/,
    /Failed to prune sessions/,
    /email service not configured/,
    /permission denied.*Permission denied/,
    /favicon\.ico/,
    /robots\.txt/,
    /health.*check/i
];

// Função para verificar se deve logar
function shouldLog(message, level = 'info') {
    if (typeof message !== 'string') return true;
    
    // Aplicar filtros apenas para níveis info e debug
    if (level === 'error' || level === 'warn') return true;
    
    return !ignorePatterns.some(pattern => pattern.test(message));
}

// === LOGGER CONTEXTUAL ===

class ContextualLogger {
    constructor(category, context = {}) {
        this.category = category;
        this.context = context;
        this.startTime = Date.now();
    }

    // Método privado para construir log entry
    _buildLogEntry(level, message, meta = {}) {
        const entry = {
            level,
            message,
            category: this.category,
            ...this.context,
            ...meta,
            timestamp: new Date().toISOString()
        };

        return entry;
    }

    // Log de erro
    error(message, meta = {}) {
        if (!shouldLog(message, 'error')) return this;
        
        const entry = this._buildLogEntry('error', message, {
            ...meta,
            stack: meta.error?.stack || meta.stack
        });
        
        logger.error(entry);
        return this;
    }

    // Log de warning
    warn(message, meta = {}) {
        if (!shouldLog(message, 'warn')) return this;
        
        const entry = this._buildLogEntry('warn', message, meta);
        logger.warn(entry);
        return this;
    }

    // Log informativo
    info(message, meta = {}) {
        if (!shouldLog(message, 'info')) return this;
        
        const entry = this._buildLogEntry('info', message, meta);
        logger.info(entry);
        return this;
    }

    // Log de debug
    debug(message, meta = {}) {
        if (!appConfig.environment.isDevelopment && !appConfig.logging.sql) return this;
        if (!shouldLog(message, 'debug')) return this;
        
        const entry = this._buildLogEntry('debug', message, meta);
        logger.debug(entry);
        return this;
    }

    // Log de performance
    performance(operation, duration, meta = {}) {
        const isSlowOperation = duration > (appConfig.logging.performance.slowRequestThreshold || 2000);
        const level = isSlowOperation ? 'warn' : 'info';
        
        this[level](`Performance: ${operation}`, {
            duration: `${duration}ms`,
            performance: true,
            ...meta
        });
        
        return this;
    }

    // Log de segurança
    security(event, meta = {}) {
        // Logs de segurança sempre são registrados
        const safeData = { ...meta };
        
        // Remover dados sensíveis
        delete safeData.password;
        delete safeData.token;
        delete safeData.password_hash;
        delete safeData.session;
        
        this.warn(`Security Event: ${event}`, {
            security: true,
            ...safeData
        });
        
        return this;
    }

    // Log de database
    database(query, params, duration, meta = {}) {
        if (!appConfig.logging.sql) return this;
        
        // Simplificar query para log
        const simplifiedQuery = query
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200) + (query.length > 200 ? '...' : '');

        const level = duration > (appConfig.logging.performance.slowQueryThreshold || 1000) ? 'warn' : 'debug';
        
        this[level](`Database Query`, {
            query: simplifiedQuery,
            duration: `${duration}ms`,
            paramCount: params ? params.length : 0,
            database: true,
            ...meta
        });
        
        return this;
    }

    // Timer utility
    timer(label) {
        const startTime = Date.now();
        
        return {
            end: (meta = {}) => {
                const duration = Date.now() - startTime;
                this.performance(label, duration, meta);
                return duration;
            }
        };
    }

    // Child logger com contexto adicional
    child(additionalContext) {
        return new ContextualLogger(this.category, {
            ...this.context,
            ...additionalContext
        });
    }
}

// === FACTORY FUNCTIONS ===

// Criar logger por categoria
function createLogger(category, context = {}) {
    return new ContextualLogger(category, context);
}

// Criar logger para requisição HTTP
function createRequestLogger(req) {
    const requestId = crypto.randomBytes(4).toString('hex');
    
    return new ContextualLogger('http', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
    });
}

// === MIDDLEWARE DE LOGGING ===

function httpLoggingMiddleware() {
    return (req, res, next) => {
        const startTime = Date.now();
        req.logger = createRequestLogger(req);
        
        // Log da requisição entrante (apenas em desenvolvimento)
        if (appConfig.environment.isDevelopment) {
            req.logger.info('Request started');
        }
        
        // Hook para log de resposta
        const originalSend = res.send;
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            // Log apenas requests lentos ou com erro em produção
            if (appConfig.environment.isProduction) {
                if (duration > 2000 || res.statusCode >= 400) {
                    req.logger.info(`${req.method} ${req.originalUrl}`, {
                        statusCode: res.statusCode,
                        duration: `${duration}ms`
                    });
                }
            } else {
                req.logger.info(`${req.method} ${req.originalUrl}`, {
                    statusCode: res.statusCode,
                    duration: `${duration}ms`
                });
            }
            
            return originalSend.call(this, data);
        };
        
        next();
    };
}

// === LOGGERS ESPECIALIZADOS ===

// Logger para autenticação
const authLogger = createLogger('auth');

// Logger para banco de dados
const dbLogger = createLogger('database');

// Logger para sistema
const systemLogger = createLogger('system');

// Logger para segurança
const securityLogger = createLogger('security');

// Logger para performance
const performanceLogger = createLogger('performance');

// === BACKWARD COMPATIBILITY ===
// Adicionar funções do logger anterior ao logger principal
logger.safeStringify = safeStringify;
logger.serializeError = serializeError;

// === UTILITIES ===

// Capturar uncaught exceptions
process.on('uncaughtException', (error) => {
    systemLogger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
        fatal: true
    });
    
    // Aguardar logs serem escritos
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Capturar unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    systemLogger.error('Unhandled Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        fatal: false
    });
});

// === HEALTH CHECK PARA LOGS ===

function getLoggerHealth() {
    try {
        if (!fs.existsSync(logDir)) {
            return {
                status: 'healthy',
                logDir,
                fileCount: 0,
                totalSize: '0MB',
                level: appConfig.logging.level,
                transports: transports.length,
                note: 'Console only - no file logging'
            };
        }

        const logFiles = fs.readdirSync(logDir);
        const totalSize = logFiles.reduce((size, file) => {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            return size + stats.size;
        }, 0);

        return {
            status: 'healthy',
            logDir,
            fileCount: logFiles.length,
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
            level: appConfig.logging.level,
            transports: transports.length
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message
        };
    }
}

// === EXPORTS ===

// Exporte de forma compatível com require e import (backward compatibility)
module.exports = logger;
module.exports.default = logger;

// Exportar novas funcionalidades
module.exports.createLogger = createLogger;
module.exports.createRequestLogger = createRequestLogger;
module.exports.authLogger = authLogger;
module.exports.dbLogger = dbLogger;
module.exports.systemLogger = systemLogger;
module.exports.securityLogger = securityLogger;
module.exports.performanceLogger = performanceLogger;
module.exports.httpLoggingMiddleware = httpLoggingMiddleware;
module.exports.getLoggerHealth = getLoggerHealth;
module.exports.ContextualLogger = ContextualLogger;
module.exports.safeStringify = safeStringify;
module.exports.serializeError = serializeError;
