/**
 * CONTROLLER DE ADMINISTRAÇÃO - FASE 8
 * 
 * Controla todas as operações administrativas do sistema,
 * preservando 100% da funcionalidade e segurança existente.
 * 
 * FUNCIONALIDADES:
 * - Gerenciamento de serviço de email
 * - Monitoramento de sistema e health checks
 * - Métricas de performance
 * - Administração de usuários
 * - Configurações do sistema
 * - Logs de auditoria
 */

const { dbGet, dbAll, dbRun } = require('../../database-postgresql');
const { systemLogger, securityLogger } = require('../utils/logger');
const { logAdminAction } = require('../middleware/admin.middleware');
const { ROUTE_CACHE_CONFIG } = require('../middleware/admin-cache.middleware');

// Importar serviços existentes
let emailService, emailRateLimitService, getMetricsReport;

try {
    emailService = require('../services/emailService');
    emailRateLimitService = require('../middleware/email-rate-limit');
    const metricsModule = require('../middleware/metrics');
    getMetricsReport = metricsModule.getMetricsReport;
} catch (error) {
    systemLogger.warn('Some admin services not available', { error: error.message });
}

// === EMAIL MANAGEMENT ===

/**
 * Obter status do serviço de email
 * GET /admin/email/status
 */
const getEmailStatus = async (req, res) => {
    try {
        logAdminAction(req, 'get_email_status');
        
        if (!emailService || !emailRateLimitService) {
            return res.status(503).json({
                error: 'Serviços de email não disponíveis',
                code: 'EMAIL_SERVICES_UNAVAILABLE'
            });
        }
        
        const status = emailService.getStatus();
        const rateLimitStats = emailRateLimitService.getStats();
        
        res.json({
            success: true,
            data: {
                emailService: status,
                rateLimiting: rateLimitStats,
                timestamp: new Date().toISOString(),
                serverTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            }
        });
    } catch (error) {
        systemLogger.error('Error getting email status', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao obter status do email',
            code: 'EMAIL_STATUS_ERROR'
        });
    }
};

/**
 * Enviar email de teste
 * POST /admin/email/test
 */
const sendTestEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        logAdminAction(req, 'send_test_email', { targetEmail: email });
        
        if (!emailService) {
            return res.status(503).json({
                success: false,
                error: 'Serviço de email não disponível',
                code: 'EMAIL_SERVICE_UNAVAILABLE'
            });
        }
        
        const result = await emailService.sendTestEmail(email);
        
        systemLogger.info('Test email sent by admin', {
            adminId: req.user.id,
            targetEmail: email,
            messageId: result.messageId
        });
        
        res.json({
            success: true,
            message: 'Email de teste enviado com sucesso',
            data: {
                messageId: result.messageId,
                targetEmail: email,
                sentAt: new Date().toISOString()
            }
        });
    } catch (error) {
        systemLogger.error('Test email failed', {
            error: error.message,
            adminId: req.user.id,
            targetEmail: req.body.email
        });
        
        res.status(500).json({
            success: false,
            error: 'Falha ao enviar email de teste',
            code: 'TEST_EMAIL_FAILED',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Resetar limites de rate limiting para email específico
 * POST /admin/email/reset-limits
 */
const resetEmailLimits = async (req, res) => {
    try {
        const { email } = req.body;
        
        logAdminAction(req, 'reset_email_limits', { targetEmail: email });
        
        if (!emailRateLimitService) {
            return res.status(503).json({
                success: false,
                error: 'Serviço de rate limiting não disponível',
                code: 'RATE_LIMIT_SERVICE_UNAVAILABLE'
            });
        }
        
        emailRateLimitService.resetEmailLimits(email);
        
        systemLogger.info('Email rate limits reset by admin', {
            adminId: req.user.id,
            targetEmail: email
        });
        
        res.json({
            success: true,
            message: `Rate limits resetados para ${email}`,
            data: {
                email,
                resetAt: new Date().toISOString(),
                resetBy: req.user.email
            }
        });
    } catch (error) {
        systemLogger.error('Failed to reset rate limits', {
            error: error.message,
            adminId: req.user.id,
            targetEmail: req.body.email
        });
        
        res.status(500).json({
            success: false,
            error: 'Falha ao resetar rate limits',
            code: 'RESET_LIMITS_FAILED'
        });
    }
};

// === SYSTEM MONITORING ===

/**
 * Health check completo do sistema
 * GET /admin/system/health
 */
const getSystemHealth = async (req, res) => {
    try {
        logAdminAction(req, 'get_system_health');
        
        // Health check básico do sistema
        const healthData = {
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            serverTime: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            
            // Informações do processo
            process: {
                pid: process.pid,
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            
            // Status dos serviços
            services: {
                database: 'unknown',
                email: emailService ? 'available' : 'unavailable',
                rateLimiting: emailRateLimitService ? 'available' : 'unavailable'
            }
        };
        
        // Testar conexão com banco de dados
        try {
            await dbGet('SELECT 1 as test');
            healthData.services.database = 'connected';
        } catch (dbError) {
            healthData.services.database = 'disconnected';
            healthData.status = 'degraded';
            systemLogger.error('Database health check failed', { error: dbError.message });
        }
        
        // Verificar se há serviços indisponíveis
        const unavailableServices = Object.entries(healthData.services)
            .filter(([service, status]) => status === 'unavailable' || status === 'disconnected')
            .map(([service]) => service);
        
        if (unavailableServices.length > 0) {
            healthData.status = unavailableServices.includes('database') ? 'unhealthy' : 'degraded';
            healthData.issues = unavailableServices;
        }
        
        // Status code baseado na saúde do sistema
        const statusCode = healthData.status === 'healthy' ? 200 : 
                          healthData.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json({
            success: statusCode < 300,
            data: healthData
        });
        
    } catch (error) {
        systemLogger.error('Error in system health check', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar saúde do sistema',
            code: 'HEALTH_CHECK_ERROR',
            data: {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            }
        });
    }
};

/**
 * Métricas detalhadas do sistema
 * GET /admin/system/metrics
 */
const getSystemMetrics = async (req, res) => {
    try {
        logAdminAction(req, 'get_system_metrics');
        
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            
            // Métricas do processo
            process: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                pid: process.pid,
                platform: process.platform,
                versions: process.versions
            },
            
            // Métricas customizadas (se disponíveis)
            custom: null
        };
        
        // Adicionar métricas customizadas se disponível
        if (getMetricsReport) {
            try {
                metrics.custom = getMetricsReport();
            } catch (metricsError) {
                systemLogger.warn('Custom metrics unavailable', { error: metricsError.message });
            }
        }
        
        // Métricas de banco de dados otimizadas
        try {
            // Usar views materializadas para métricas pesadas (performance crítica)
            const [userMetrics, planMetrics, systemMetrics] = await Promise.all([
                // Métricas de usuários da view materializada (cache DB-level)
                dbGet('SELECT * FROM admin_user_metrics LIMIT 1'),
                
                // Métricas de planos da view materializada
                dbGet('SELECT * FROM admin_plan_metrics LIMIT 1'),
                
                // Métricas do sistema usando CTE otimizada
                dbGet(`
                    WITH system_stats AS (
                        SELECT 
                            (SELECT COUNT(*) FROM sessions WHERE expire > NOW()) as active_sessions,
                            (SELECT COUNT(*) FROM oauth_providers) as oauth_users,
                            (SELECT COUNT(*) FROM tasks WHERE completed = true AND completed_at >= NOW() - INTERVAL '24 hours') as tasks_completed_24h,
                            (SELECT AVG(study_hours_per_day) FROM plans WHERE study_hours_per_day IS NOT NULL) as avg_study_hours
                    )
                    SELECT * FROM system_stats
                `)
            ]);
            
            metrics.database = {
                users: userMetrics || {
                    total_users: 0,
                    admin_users: 0,
                    users_last_24h: 0,
                    users_last_7d: 0
                },
                plans: planMetrics || {
                    total_plans: 0,
                    plans_last_24h: 0,
                    plans_last_7d: 0
                },
                system: systemMetrics || {
                    active_sessions: 0,
                    oauth_users: 0,
                    tasks_completed_24h: 0,
                    avg_study_hours: 0
                },
                connection: 'healthy',
                cache_source: {
                    users: userMetrics ? 'materialized_view' : 'fallback',
                    plans: planMetrics ? 'materialized_view' : 'fallback'
                }
            };
            
        } catch (dbError) {
            metrics.database = {
                connection: 'error',
                error: dbError.message
            };
        }
        
        res.json({
            success: true,
            data: metrics
        });
        
    } catch (error) {
        systemLogger.error('Error getting system metrics', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao obter métricas do sistema',
            code: 'METRICS_ERROR'
        });
    }
};

// === USER MANAGEMENT ===

/**
 * Listar usuários do sistema
 * GET /admin/users
 */
const getUsers = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            search = '', 
            role = 'all',
            sortBy = 'created_at',
            sortOrder = 'DESC' 
        } = req.query;
        
        logAdminAction(req, 'list_users', { page, limit, search, role });
        
        const offset = (page - 1) * limit;
        
        // Construir query base
        let whereClause = 'WHERE 1=1';
        const queryParams = [];
        let paramIndex = 1;
        
        // Filtro por busca
        if (search.trim()) {
            whereClause += ` AND (email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
            queryParams.push(`%${search.trim()}%`);
            paramIndex++;
        }
        
        // Filtro por role
        if (role !== 'all') {
            whereClause += ` AND role = $${paramIndex}`;
            queryParams.push(role);
            paramIndex++;
        }
        
        // Validar campos de ordenação
        const allowedSortFields = ['created_at', 'email', 'name', 'last_login_at'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        // Query principal otimizada com CTE e paginação eficiente
        const optimizedQuery = `
            WITH filtered_users AS (
                SELECT 
                    id, email, name, role, created_at, 
                    auth_provider, google_id, avatar_url,
                    created_at as last_activity,
                    COUNT(*) OVER() as total_count
                FROM users 
                ${whereClause}
            ),
            paginated_users AS (
                SELECT *,
                       ROW_NUMBER() OVER(ORDER BY ${sortField} ${order}, id) as row_num
                FROM filtered_users
            )
            SELECT 
                id, email, name, role, created_at, 
                auth_provider, google_id, avatar_url, last_activity,
                total_count
            FROM paginated_users
            WHERE row_num > $${paramIndex} AND row_num <= $${paramIndex + 1}
            ORDER BY ${sortField} ${order}, id
        `;
        
        queryParams.push(offset, offset + parseInt(limit));
        
        // Executar query única otimizada
        const users = await dbAll(optimizedQuery, queryParams);
        const total = users.length > 0 ? users[0].total_count : 0;
        
        const totalPages = Math.ceil(total / limit);
        
        // Limpar total_count dos resultados
        const cleanUsers = users.map(user => {
            const { total_count, ...cleanUser } = user;
            return cleanUser;
        });
        
        res.json({
            success: true,
            data: {
                users: cleanUsers || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                filters: {
                    search,
                    role,
                    sortBy: sortField,
                    sortOrder: order
                }
            }
        });
        
    } catch (error) {
        systemLogger.error('Error listing users', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao listar usuários',
            code: 'LIST_USERS_ERROR'
        });
    }
};

/**
 * Atualizar role de usuário
 * PATCH /admin/users/:userId/role
 */
const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        
        // Validar role
        const allowedRoles = ['user', 'admin'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Role inválida. Permitidas: user, admin',
                code: 'INVALID_ROLE'
            });
        }
        
        // Verificar se usuário existe
        const user = await dbGet('SELECT id, email, role FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Prevenir admin de remover seu próprio acesso
        if (user.id === req.user.id && role !== 'admin') {
            return res.status(400).json({
                success: false,
                error: 'Você não pode remover seus próprios privilégios de admin',
                code: 'CANNOT_DEMOTE_SELF'
            });
        }
        
        logAdminAction(req, 'update_user_role', {
            targetUserId: userId,
            targetUserEmail: user.email,
            oldRole: user.role,
            newRole: role
        });
        
        // Atualizar role
        await dbRun('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
        
        // Invalidar cache de admin se necessário
        const { invalidateAdminCache } = require('../middleware/admin.middleware');
        invalidateAdminCache(userId);
        
        systemLogger.info('User role updated by admin', {
            adminId: req.user.id,
            targetUserId: userId,
            targetUserEmail: user.email,
            oldRole: user.role,
            newRole: role
        });
        
        res.json({
            success: true,
            message: 'Role do usuário atualizada com sucesso',
            data: {
                userId: parseInt(userId),
                email: user.email,
                oldRole: user.role,
                newRole: role,
                updatedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        systemLogger.error('Error updating user role', {
            error: error.message,
            adminId: req.user.id,
            targetUserId: req.params.userId
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar role do usuário',
            code: 'UPDATE_ROLE_ERROR'
        });
    }
};

// === SYSTEM CONFIGURATION ===

/**
 * Obter configurações do sistema
 * GET /admin/config
 */
const getSystemConfig = async (req, res) => {
    try {
        logAdminAction(req, 'get_system_config');
        
        const config = {
            environment: process.env.NODE_ENV || 'development',
            features: {
                email: !!emailService,
                rateLimiting: !!emailRateLimitService,
                metrics: !!getMetricsReport,
                oauth: !!process.env.GOOGLE_CLIENT_ID
            },
            limits: {
                maxUsers: process.env.MAX_USERS || 'unlimited',
                maxPlansPerUser: process.env.MAX_PLANS_PER_USER || 10,
                sessionTimeout: process.env.SESSION_TIMEOUT || '24h'
            },
            security: {
                jwtExpiry: process.env.JWT_EXPIRES_IN || '24h',
                bcryptRounds: 12,
                corsEnabled: true,
                helmetEnabled: true
            },
            database: {
                type: 'postgresql',
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'editaliza_db'
            }
        };
        
        res.json({
            success: true,
            data: config
        });
        
    } catch (error) {
        systemLogger.error('Error getting system config', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao obter configurações do sistema',
            code: 'GET_CONFIG_ERROR'
        });
    }
};

// === AUDIT LOGS ===

/**
 * Obter logs de auditoria
 * GET /admin/audit/logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50,
            action = 'all',
            userId = null,
            startDate = null,
            endDate = null
        } = req.query;
        
        logAdminAction(req, 'get_audit_logs', { page, limit, action });
        
        // Por enquanto, retornar informações básicas
        // Em uma implementação completa, isso seria integrado com um sistema de logs
        res.json({
            success: true,
            data: {
                logs: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    totalPages: 0
                },
                message: 'Sistema de logs de auditoria em desenvolvimento. Consulte os logs do servidor para informações detalhadas.'
            }
        });
        
    } catch (error) {
        systemLogger.error('Error getting audit logs', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao obter logs de auditoria',
            code: 'GET_AUDIT_LOGS_ERROR'
        });
    }
};

module.exports = {
    // Email management
    getEmailStatus,
    sendTestEmail,
    resetEmailLimits,
    
    // System monitoring
    getSystemHealth,
    getSystemMetrics,
    
    // User management
    getUsers,
    updateUserRole,
    
    // System configuration
    getSystemConfig,
    
    // Audit logs
    getAuditLogs
};