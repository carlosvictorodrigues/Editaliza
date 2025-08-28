/**
 * MIDDLEWARE PARA TESTES DE PERFORMANCE ADMINISTRATIVA
 * 
 * Permite bypass de autenticação em desenvolvimento para testes de carga
 * USAR APENAS EM DESENVOLVIMENTO - NUNCA EM PRODUÇÃO
 */

const { systemLogger } = require('../utils/logger');

/**
 * Middleware de bypass para testes de performance
 * Simula usuário admin para testes de carga
 */
const performanceTestBypass = (req, res, next) => {
    // APENAS EM DESENVOLVIMENTO
    if (process.env.NODE_ENV !== 'development') {
        return next(); // Em produção, continua normalmente
    }
    
    // Verificar header especial para testes
    if (req.headers['x-performance-test'] === 'true') {
        // Simular usuário admin para testes
        req.user = {
            id: 999,
            email: 'admin-test@editaliza.com',
            name: 'Admin Performance Test',
            role: 'admin'
        };
        
        // Log do uso de bypass
        systemLogger.warn('Performance test bypass activated', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.originalUrl
        });
        
        // Pular middleware de auth
        return next();
    }
    
    next();
};

/**
 * Headers para cliente usar nos testes
 * Adicionar no curl/axios: -H "X-Performance-Test: true"
 */
const PERFORMANCE_TEST_HEADERS = {
    'X-Performance-Test': 'true',
    'Content-Type': 'application/json',
    'User-Agent': 'Admin-Performance-Tester/1.0'
};

/**
 * Middleware para medir performance detalhada
 */
const performanceMonitor = (req, res, next) => {
    const start = process.hrtime.bigint();
    
    // Interceptar response para medir
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        
        // Headers de performance
        res.set({
            'X-Response-Time-Precise': `${duration.toFixed(3)}ms`,
            'X-Memory-Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            'X-Node-Version': process.version,
            'X-Performance-Grade': duration < 100 ? 'A' : 
                                  duration < 300 ? 'B' : 
                                  duration < 500 ? 'C' : 'D'
        });
        
        // Log performance crítica
        if (duration > 1000) {
            systemLogger.error('CRITICAL: Response time > 1 second', {
                endpoint: req.originalUrl,
                method: req.method,
                duration: `${duration.toFixed(2)}ms`,
                memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                query: req.query,
                adminId: req.user?.id
            });
        } else if (duration > 500) {
            systemLogger.warn('SLOW: Response time > 500ms', {
                endpoint: req.originalUrl,
                duration: `${duration.toFixed(2)}ms`,
                adminId: req.user?.id
            });
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Comando curl para testar performance
 */
const CURL_TEST_COMMAND = `
curl -X GET \\
  -H "X-Performance-Test: true" \\
  -H "Content-Type: application/json" \\
  -o /dev/null \\
  -s \\
  -w "Time: %{time_total}s | Status: %{http_code} | Size: %{size_download} bytes\\n" \\
  http://localhost:3001/api/admin/users?limit=10
`;

module.exports = {
    performanceTestBypass,
    performanceMonitor,
    PERFORMANCE_TEST_HEADERS,
    CURL_TEST_COMMAND
};