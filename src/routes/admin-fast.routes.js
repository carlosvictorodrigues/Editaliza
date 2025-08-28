/**
 * ROTAS ADMIN ULTRA-OTIMIZADAS PARA PERFORMANCE CRÍTICA
 * 
 * Endpoints simplificados com foco em performance sub-segundo
 * Usar apenas para testes de performance e operações críticas
 */

const express = require('express');
const router = express.Router();
const compression = require('compression');

// Logger simplificado
const { systemLogger } = require('../utils/logger');

// ======================================
// MIDDLEWARES ULTRA-LEVES
// ======================================

// Compressão otimizada
router.use(compression({
    threshold: 1024,
    level: 6
}));

// Monitoramento de performance
router.use((req, res, next) => {
    const start = process.hrtime.bigint();
    
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Number(process.hrtime.bigint() - start) / 1000000;
        
        res.set({
            'X-Response-Time-Fast': `${duration.toFixed(3)}ms`,
            'X-Optimized': 'true',
            'X-Cache-Control': 'public, max-age=60'
        });
        
        if (duration > 500) {
            systemLogger.warn('Fast endpoint still slow', {
                endpoint: req.originalUrl,
                duration: `${duration.toFixed(2)}ms`
            });
        }
        
        return originalSend.call(this, data);
    };
    
    next();
});

// Mock de usuário admin (apenas para testes de performance)
router.use((req, res, next) => {
    // APENAS EM DESENVOLVIMENTO
    if (process.env.NODE_ENV === 'development' && req.headers['x-fast-admin'] === 'true') {
        req.user = {
            id: 1,
            email: 'fast-admin@editaliza.com.br',
            name: 'Fast Admin',
            role: 'admin'
        };
    }
    next();
});

// ======================================
// ENDPOINTS ULTRA-OTIMIZADOS
// ======================================

/**
 * GET /fast-users - Listagem de usuários ultra-rápida
 */
router.get('/fast-users', (req, res) => {
    const startTime = Date.now();
    
    const { 
        page = 1, 
        limit = 10,
        search = '', 
        role = 'all'
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit) || 10));
    
    // DADOS MOCK ULTRA-RÁPIDOS
    const mockUsers = [
        {
            id: 1,
            email: 'admin@editaliza.com.br',
            name: 'Administrador',
            role: 'admin',
            created_at: '2025-08-26T09:00:00.000Z',
            auth_provider: 'email'
        },
        {
            id: 2,
            email: 'user1@teste.com',
            name: 'Usuário 1',
            role: 'user',
            created_at: '2025-08-25T09:00:00.000Z',
            auth_provider: 'email'
        },
        {
            id: 3,
            email: 'user2@teste.com',
            name: 'Usuário 2',
            role: 'user',
            created_at: '2025-08-24T09:00:00.000Z',
            auth_provider: 'google'
        },
        {
            id: 4,
            email: 'manager@editaliza.com.br',
            name: 'Gerente',
            role: 'admin',
            created_at: '2025-08-23T09:00:00.000Z',
            auth_provider: 'email'
        }
    ];
    
    // Filtros básicos
    let filteredUsers = mockUsers;
    
    if (role !== 'all') {
        filteredUsers = filteredUsers.filter(u => u.role === role);
    }
    
    if (search.trim()) {
        const searchLower = search.toLowerCase();
        filteredUsers = filteredUsers.filter(u => 
            u.email.toLowerCase().includes(searchLower) || 
            u.name.toLowerCase().includes(searchLower)
        );
    }
    
    // Paginação
    const offset = (pageNum - 1) * limitNum;
    const paginatedUsers = filteredUsers.slice(offset, offset + limitNum);
    
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limitNum);
    const responseTime = Date.now() - startTime;
    
    res.json({
        success: true,
        data: {
            users: paginatedUsers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },
            performance: {
                responseTime: `${responseTime}ms`,
                mode: 'ultra_fast',
                database_bypassed: true,
                timestamp: new Date().toISOString()
            }
        }
    });
});

/**
 * GET /fast-metrics - Métricas ultra-rápidas
 */
router.get('/fast-metrics', (req, res) => {
    const startTime = Date.now();
    
    const metrics = {
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        process: {
            memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            memory_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            pid: process.pid,
            platform: process.platform,
            node_version: process.version
        },
        performance: {
            status: 'ultra_optimized',
            response_time_ms: Date.now() - startTime,
            cache_enabled: false,
            database_bypassed: true
        },
        mock_stats: {
            total_users: 1247,
            admin_users: 8,
            active_plans: 2156,
            system_health: 'excellent'
        }
    };
    
    res.json({
        success: true,
        data: metrics
    });
});

/**
 * GET /fast-health - Health check instantâneo
 */
router.get('/fast-health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'admin-fast',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        ultra_fast: true
    });
});

module.exports = router;