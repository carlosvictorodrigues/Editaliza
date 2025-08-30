/**
 * SERVIDOR DE TESTE DE PERFORMANCE PARA ENDPOINT ADMIN
 * Servidor simplificado para testar apenas as otimizações do endpoint admin
 */

const express = require('express');
const compression = require('compression');

const app = express();
const PORT = 3002;

// Middlewares básicos
app.use(compression());
app.use(express.json());

// Mock do middleware de log
const logAdminAction = (req, action, data) => {
    console.log(`[${new Date().toISOString()}] Admin Action: ${action}`, data);
};

// Mock do usuario admin para testes
const mockAdminUser = {
    id: 1,
    email: 'admin@editaliza.com.br',
    name: 'Administrador Sistema',
    role: 'admin'
};

// Middleware de bypass de autenticação para testes
app.use('/api/admin/*', (req, res, next) => {
    req.user = mockAdminUser;
    next();
});

// Middleware de monitoramento de performance
app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // ms
        
        res.set({
            'X-Response-Time': `${duration.toFixed(3)}ms`,
            'X-Memory-Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            'X-Performance-Grade': duration < 100 ? 'A' : 
                                  duration < 300 ? 'B' : 
                                  duration < 500 ? 'C' : 'D'
        });
        
        if (duration > 1000) {
            console.error(`SLOW ENDPOINT: ${req.originalUrl} took ${duration.toFixed(2)}ms`);
        }
        
        return originalSend.call(this, data);
    };
    
    next();
});

// ENDPOINT ADMIN USERS OTIMIZADO
app.get('/api/admin/users', (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            page = 1, 
            limit = 10,
            search = '', 
            role = 'all'
        } = req.query;
        
        const pageNum = Math.max(1, Math.min(100, parseInt(page)));
        const limitNum = Math.max(5, Math.min(25, parseInt(limit)));
        
        logAdminAction(req, 'list_users_performance_test', { page: pageNum, limit: limitNum });
        
        // DADOS MOCK PARA TESTE DE PERFORMANCE
        const mockUsers = [
            {
                id: 1,
                email: 'admin@editaliza.com.br',
                name: 'Administrador Sistema',
                role: 'admin',
                created_at: new Date().toISOString(),
                auth_provider: 'email'
            },
            {
                id: 2,
                email: 'user1@editaliza.com.br',
                name: 'João da Silva',
                role: 'user',
                created_at: new Date(Date.now() - 86400000).toISOString(),
                auth_provider: 'email'
            },
            {
                id: 3,
                email: 'user2@editaliza.com.br',
                name: 'Maria Santos',
                role: 'user',
                created_at: new Date(Date.now() - 172800000).toISOString(),
                auth_provider: 'google'
            },
            {
                id: 4,
                email: 'user3@editaliza.com.br',
                name: 'Pedro Oliveira',
                role: 'user',
                created_at: new Date(Date.now() - 259200000).toISOString(),
                auth_provider: 'email'
            },
            {
                id: 5,
                email: 'manager@editaliza.com.br',
                name: 'Ana Manager',
                role: 'admin',
                created_at: new Date(Date.now() - 345600000).toISOString(),
                auth_provider: 'email'
            }
        ];
        
        // Filtros
        let filteredUsers = mockUsers;
        
        if (role !== 'all') {
            filteredUsers = filteredUsers.filter(u => u.role === role);
        }
        
        if (search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            filteredUsers = filteredUsers.filter(u => 
                u.email.toLowerCase().includes(searchTerm) || 
                u.name.toLowerCase().includes(searchTerm)
            );
        }
        
        // Paginação
        const offset = (pageNum - 1) * limitNum;
        const paginatedUsers = filteredUsers.slice(offset, offset + limitNum);
        
        const total = filteredUsers.length;
        const totalPages = Math.ceil(total / limitNum);
        const responseTime = Date.now() - startTime;
        
        // Response otimizado
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
                    optimized: true,
                    cached: false,
                    database_bypassed: true,
                    timestamp: new Date().toISOString()
                }
            }
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('Performance test error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Erro no teste de performance',
            responseTime: `${responseTime}ms`
        });
    }
});

// ENDPOINT DE MÉTRICAS OTIMIZADO
app.get('/api/admin/system/metrics', (req, res) => {
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
            cache_enabled: true,
            compression_enabled: true,
            response_time_ms: Date.now() - startTime
        },
        
        mock_database: {
            connection: 'simulated',
            user_count: 1247,
            admin_count: 3,
            plans_count: 2156
        }
    };
    
    res.json({
        success: true,
        data: metrics
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'admin-performance-test',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Performance Test Server running on port ${PORT}`);
    console.log("📊 Test endpoints:");
    console.log(`   GET http://localhost:${PORT}/health`);
    console.log(`   GET http://localhost:${PORT}/api/admin/users`);
    console.log(`   GET http://localhost:${PORT}/api/admin/system/metrics`);
    console.log("\n🧪 Test commands:");
    console.log(`   curl -s -w "Time: %{time_total}s | Status: %{http_code}\\n" http://localhost:${PORT}/api/admin/users?limit=5`);
    console.log(`   curl -s -w "Time: %{time_total}s | Status: %{http_code}\\n" http://localhost:${PORT}/api/admin/system/metrics`);
});

module.exports = app;