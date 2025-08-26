// src/middleware/error.js - FASE 8 - Error Handlers Centralizados

const { errorHandler } = require('../utils/error-handler');

/**
 * Handler para rotas não encontradas (404)
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
}

/**
 * Configurar error handlers globais
 * @param {Express} app - Instância do Express
 */
function configureErrorHandlers(app) {
    // Handler para rotas não encontradas (deve vir antes do error handler global)
    app.use(notFoundHandler);
    
    // Error handler global (deve ser o último middleware)
    app.use(errorHandler);
}

module.exports = {
    notFoundHandler,
    errorHandler,
    configureErrorHandlers
};
