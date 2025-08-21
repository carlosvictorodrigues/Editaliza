// src/utils/error-handler.js
const logger = require('./logger');

// Tipos de erro
const ERROR_TYPES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
    FILE_SYSTEM: 'FILE_SYSTEM_ERROR'
};

// Custom error class
class AppError extends Error {
    constructor(type, message, statusCode = 500, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.type = type;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  const payload = {
    err: logger.serializeError(err),
    path: req?.originalUrl || req?.url,
    method: req?.method,
    userId: req?.user?.id,
    ip: req?.ip,
  };

  // Não passe o objeto err cru para o logger.
  logger.error('Unhandled error', payload);

  const status = err.status || err.statusCode || 500;
  
  // Check if headers were already sent
  if (res.headersSent) {
    return logger.error('Headers already sent, cannot send error response', payload);
  }
  
  return res.status(status).json({
    error: payload.err.name || 'Error',
    message: payload.err.message || 'Internal Server Error',
  });
}

// Async wrapper
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Export tudo
module.exports = {
    AppError,
    ERROR_TYPES,
    errorHandler,
    asyncHandler
};
