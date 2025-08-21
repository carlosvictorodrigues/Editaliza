/**
 * Middleware de Métricas e Monitoramento
 * Coleta informações importantes sobre o sistema
 */

const { createLogger } = require('../config/logger-config');

const logger = createLogger('METRICS');

// Armazenar métricas em memória (últimos 1000 requests)
const metrics = {
    requests: [],
    errors: {},
    slowEndpoints: [],
    activeUsers: new Set(),
    startTime: Date.now()
};

// Limpar métricas antigas a cada hora
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    metrics.requests = metrics.requests.filter(r => r.timestamp > oneHourAgo);
    metrics.slowEndpoints = metrics.slowEndpoints.filter(r => r.timestamp > oneHourAgo);
}, 3600000);

/**
 * Middleware para coletar métricas de cada request
 */
function collectMetrics(req, res, next) {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Adicionar ID único ao request
    req.requestId = requestId;
    
    // Capturar informações do request
    const requestInfo = {
        id: requestId,
        timestamp: startTime,
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: null // Será preenchido se autenticado
    };
    
    // Interceptar o final da resposta
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Completar informações
        requestInfo.duration = duration;
        requestInfo.statusCode = res.statusCode;
        requestInfo.userId = req.user?.id || null;
        
        // Adicionar às métricas
        metrics.requests.push(requestInfo);
        
        // Rastrear usuários ativos
        if (requestInfo.userId) {
            metrics.activeUsers.add(requestInfo.userId);
        }
        
        // Registrar endpoints lentos
        if (duration > 2000) {
            metrics.slowEndpoints.push({
                timestamp: startTime,
                path: req.path,
                duration,
                method: req.method
            });
            
            logger.warn(`Endpoint lento: ${req.method} ${req.path} (${duration}ms)`);
        }
        
        // Registrar erros
        if (res.statusCode >= 400) {
            const errorKey = `${req.method}_${req.path}_${res.statusCode}`;
            metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
            
            if (res.statusCode >= 500) {
                logger.error(`Erro 500: ${req.method} ${req.path}`, {
                    ip: requestInfo.ip,
                    duration
                });
            }
        }
        
        // Log apenas se não for health check ou arquivo estático
        if (!req.path.includes('/health') && 
            !req.path.includes('.css') && 
            !req.path.includes('.js') &&
            !req.path.includes('.png')) {
            
            // Log compacto
            const status = res.statusCode < 400 ? '✓' : '✗';
            const durationStr = duration > 1000 ? `${duration}ms ⚠️` : `${duration}ms`;
            
            logger.info(`${status} ${req.method} ${req.path} [${res.statusCode}] ${durationStr}`);
        }
        
        // Manter apenas últimos 1000 requests
        if (metrics.requests.length > 1000) {
            metrics.requests.shift();
        }
        
        // Chamar função original
        originalSend.call(this, data);
    };
    
    next();
}

/**
 * Endpoint para visualizar métricas
 */
function getMetricsReport() {
    const now = Date.now();
    const uptime = Math.floor((now - metrics.startTime) / 1000);
    
    // Calcular estatísticas dos últimos 5 minutos
    const fiveMinutesAgo = now - 300000;
    const recentRequests = metrics.requests.filter(r => r.timestamp > fiveMinutesAgo);
    
    // Taxa de erro
    const totalRequests = recentRequests.length;
    const errorRequests = recentRequests.filter(r => r.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests * 100).toFixed(2) : 0;
    
    // Tempo médio de resposta
    const avgResponseTime = totalRequests > 0 
        ? Math.round(recentRequests.reduce((sum, r) => sum + r.duration, 0) / totalRequests)
        : 0;
    
    // Endpoints mais acessados
    const endpointCounts = {};
    recentRequests.forEach(r => {
        const key = `${r.method} ${r.path}`;
        endpointCounts[key] = (endpointCounts[key] || 0) + 1;
    });
    
    const topEndpoints = Object.entries(endpointCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([endpoint, count]) => ({ endpoint, count }));
    
    // Memória
    const memUsage = process.memoryUsage();
    const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    return {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memory: `${memoryMB}MB`,
        activeUsers: metrics.activeUsers.size,
        last5Minutes: {
            totalRequests,
            errorRate: `${errorRate}%`,
            avgResponseTime: `${avgResponseTime}ms`,
            errors: errorRequests,
            slowEndpoints: metrics.slowEndpoints.filter(r => r.timestamp > fiveMinutesAgo).length
        },
        topEndpoints,
        recentErrors: Object.entries(metrics.errors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([error, count]) => ({ error, count }))
    };
}

/**
 * Limpar usuários inativos a cada 15 minutos
 */
setInterval(() => {
    const fifteenMinutesAgo = Date.now() - 900000;
    const activeUserIds = new Set();
    
    metrics.requests
        .filter(r => r.timestamp > fifteenMinutesAgo && r.userId)
        .forEach(r => activeUserIds.add(r.userId));
    
    metrics.activeUsers = activeUserIds;
}, 900000);

/**
 * Log de métricas resumidas a cada 5 minutos
 */
setInterval(() => {
    const report = getMetricsReport();
    logger.info(`📊 MÉTRICAS: Usuários: ${report.activeUsers} | Requests: ${report.last5Minutes.totalRequests} | Erros: ${report.last5Minutes.errorRate} | Tempo: ${report.last5Minutes.avgResponseTime} | Mem: ${report.memory}`);
}, 300000);

module.exports = {
    collectMetrics,
    getMetricsReport,
    metrics
};