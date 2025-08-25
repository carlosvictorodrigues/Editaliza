/**
 * ROTAS DE ADMINISTRAÇÃO - FASE 8
 * 
 * Define todas as rotas administrativas com segurança robusta,
 * preservando 100% da funcionalidade existente e adicionando
 * melhorias de auditoria e controle de acesso.
 * 
 * ESTRUTURA DAS ROTAS:
 * - /admin/email/* - Gerenciamento de email
 * - /admin/system/* - Monitoramento e health checks
 * - /admin/users/* - Gerenciamento de usuários
 * - /admin/config/* - Configurações do sistema
 * - /admin/audit/* - Logs de auditoria
 */

const express = require('express');
const router = express.Router();

// Middleware de validação
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');

// Middleware de autenticação (usando existente)
const { authenticateToken } = require('../middleware/auth.middleware');
const { 
    requireAdmin, 
    requireSecureAdmin,
    adminLoggingContext,
    auditDestructiveActions
} = require('../middleware/admin.middleware');

// Controller de admin
const adminController = require('../controllers/admin.controller');

// Cache middleware para rotas pesadas
const { ROUTE_CACHE_CONFIG, cacheStats, cacheClear } = require('../middleware/admin-cache.middleware');

// === MIDDLEWARE GLOBAL PARA ROTAS ADMIN ===

// Aplicar autenticação, verificação de admin e contexto de logging
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminLoggingContext);

// === EMAIL MANAGEMENT ROUTES ===

/**
 * GET /admin/email/status
 * Obter status do serviço de email
 * Preserva funcionalidade existente do server.js linha 4241
 */
router.get('/email/status', adminController.getEmailStatus);

/**
 * POST /admin/email/test
 * Enviar email de teste
 * Preserva funcionalidade existente do server.js linha 4258
 */
router.post('/email/test',
    validators.email('email'),
    handleValidationErrors,
    adminController.sendTestEmail
);

/**
 * POST /admin/email/reset-limits
 * Resetar limites de rate limiting para email específico
 * Preserva funcionalidade existente do server.js linha 4284
 */
router.post('/email/reset-limits',
    validators.email('email'),
    handleValidationErrors,
    adminController.resetEmailLimits
);

// === SYSTEM MONITORING ROUTES ===

/**
 * GET /admin/system/health
 * Health check completo do sistema
 * Expandido da funcionalidade existente /health (linha 4201)
 */
router.get('/system/health', adminController.getSystemHealth);

/**
 * GET /admin/system/metrics
 * Métricas detalhadas do sistema (COM CACHE - 5min TTL)
 * Expandido da funcionalidade existente /metrics (linha 4221)
 */
router.get('/system/metrics', 
    ROUTE_CACHE_CONFIG.metrics.get,  // Cache de 5 minutos
    adminController.getSystemMetrics
);

/**
 * GET /admin/system/ready
 * Ready probe endpoint (para K8s/Docker)
 * Expandido da funcionalidade existente /ready (linha 4216)
 */
router.get('/system/ready', (req, res) => {
    res.status(200).json({ 
        status: 'ready', 
        timestamp: Date.now(),
        admin: true,
        requestId: req.logger?.context?.requestId
    });
});

// === USER MANAGEMENT ROUTES ===

/**
 * GET /admin/users
 * Listar usuários do sistema com paginação e filtros (COM CACHE - 2min TTL)
 */
router.get('/users',
    // Validações de query parameters
    validators.numericParam('page', { min: 1, max: 1000, optional: true }),
    validators.numericParam('limit', { min: 1, max: 100, optional: true }),
    validators.textParam('search', { minLength: 0, maxLength: 100, optional: true }),
    validators.enumParam('role', ['all', 'user', 'admin'], { optional: true }),
    validators.enumParam('sortBy', ['created_at', 'email', 'name', 'last_login_at'], { optional: true }),
    validators.enumParam('sortOrder', ['ASC', 'DESC'], { optional: true }),
    handleValidationErrors,
    ROUTE_CACHE_CONFIG.users.get,  // Cache de 2 minutos
    adminController.getUsers
);

/**
 * GET /admin/users/:userId
 * Obter detalhes de um usuário específico
 */
router.get('/users/:userId',
    validators.numericParam('userId', { location: 'params' }),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { dbGet } = require('../../database-postgresql');
            const { logAdminAction } = require('../middleware/admin.middleware');
            
            logAdminAction(req, 'get_user_details', { targetUserId: userId });
            
            const user = await dbGet(`
                SELECT 
                    id, email, name, role, created_at, profile_picture,
                    auth_provider, google_id, phone, whatsapp, state, city,
                    birth_date, education, work_status, first_time,
                    concursos_count, area_interest, level_desired,
                    timeline_goal, study_hours, motivation_text
                FROM users 
                WHERE id = $1
            `, [userId]);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuário não encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            // Obter estatísticas do usuário
            const { dbAll } = require('../../database-postgresql');
            const userStats = await dbAll(`
                SELECT 
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_plans
                FROM study_plans 
                WHERE user_id = $1
            `, [userId]);
            
            res.json({
                success: true,
                data: {
                    user,
                    stats: userStats[0] || { total_plans: 0, active_plans: 0 }
                }
            });
            
        } catch (error) {
            const { systemLogger } = require('../utils/logger');
            systemLogger.error('Error getting user details', {
                error: error.message,
                adminId: req.user.id,
                targetUserId: req.params.userId
            });
            
            res.status(500).json({
                success: false,
                error: 'Erro ao obter detalhes do usuário',
                code: 'GET_USER_ERROR'
            });
        }
    }
);

/**
 * PATCH /admin/users/:userId/role
 * Atualizar role de um usuário (operação crítica + INVALIDAR CACHE)
 */
router.patch('/users/:userId/role',
    requireSecureAdmin, // Requer IP whitelist
    auditDestructiveActions('role_change'),
    validators.numericParam('userId', { location: 'params' }),
    validators.enumParam('role', ['user', 'admin']),
    handleValidationErrors,
    adminController.updateUserRole,
    ROUTE_CACHE_CONFIG.users.invalidate  // Invalidar cache de usuários
);

/**
 * POST /admin/users/:userId/ban
 * Banir usuário (operação crítica)
 */
router.post('/users/:userId/ban',
    requireSecureAdmin,
    auditDestructiveActions('user_ban'),
    validators.numericParam('userId', { location: 'params' }),
    validators.textParam('reason', { minLength: 10, maxLength: 500 }),
    validators.numericParam('duration_hours', { min: 1, max: 8760, optional: true }), // max 1 ano
    handleValidationErrors,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { reason, duration_hours = 24 } = req.body;
            
            // Implementar lógica de ban
            // Por enquanto, apenas logar a ação
            const { logAdminAction } = require('../middleware/admin.middleware');
            const { systemLogger } = require('../utils/logger');
            
            logAdminAction(req, 'ban_user', {
                targetUserId: userId,
                reason,
                duration_hours
            });
            
            systemLogger.warn('User ban requested by admin', {
                adminId: req.user.id,
                targetUserId: userId,
                reason,
                duration_hours
            });
            
            res.json({
                success: true,
                message: 'Funcionalidade de ban será implementada em versão futura',
                data: {
                    userId: parseInt(userId),
                    reason,
                    duration_hours,
                    requestedBy: req.user.id,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            const { systemLogger } = require('../utils/logger');
            systemLogger.error('Error in ban user', {
                error: error.message,
                adminId: req.user.id
            });
            
            res.status(500).json({
                success: false,
                error: 'Erro ao processar banimento',
                code: 'BAN_USER_ERROR'
            });
        }
    }
);

// === SYSTEM CONFIGURATION ROUTES ===

/**
 * GET /admin/config
 * Obter configurações do sistema (COM CACHE - 30min TTL)
 */
router.get('/config', 
    ROUTE_CACHE_CONFIG.config.get,  // Cache de 30 minutos
    adminController.getSystemConfig
);

/**
 * POST /admin/config/update
 * Atualizar configurações (operação crítica + INVALIDAR CACHE)
 */
router.post('/config/update',
    requireSecureAdmin,
    auditDestructiveActions('config_update'),
    // Validações específicas para configurações
    validators.textParam('section', { minLength: 3, maxLength: 50 }),
    validators.textParam('key', { minLength: 3, maxLength: 100 }),
    validators.textParam('value', { minLength: 0, maxLength: 1000 }),
    handleValidationErrors,
    async (req, res) => {
        try {
            const { section, key, value } = req.body;
            
            const { logAdminAction } = require('../middleware/admin.middleware');
            const { systemLogger } = require('../utils/logger');
            
            logAdminAction(req, 'update_config', { section, key, value });
            
            // Por enquanto, apenas logar. Em implementação completa,
            // seria salvo no banco de dados ou arquivo de configuração
            systemLogger.info('System configuration update requested', {
                adminId: req.user.id,
                section,
                key,
                value
            });
            
            res.json({
                success: true,
                message: 'Atualização de configuração registrada',
                data: {
                    section,
                    key,
                    value,
                    updatedBy: req.user.id,
                    timestamp: new Date().toISOString(),
                    note: 'Funcionalidade será implementada em versão futura'
                }
            });
            
        } catch (error) {
            const { systemLogger } = require('../utils/logger');
            systemLogger.error('Error updating config', {
                error: error.message,
                adminId: req.user.id
            });
            
            res.status(500).json({
                success: false,
                error: 'Erro ao atualizar configuração',
                code: 'UPDATE_CONFIG_ERROR'
            });
        }
    },
    ROUTE_CACHE_CONFIG.config.invalidate  // Invalidar cache de configurações
);

// === AUDIT LOGS ROUTES ===

/**
 * GET /admin/audit/logs
 * Obter logs de auditoria (COM CACHE - 1min TTL)
 */
router.get('/audit/logs',
    validators.numericParam('page', { min: 1, max: 1000, optional: true }),
    validators.numericParam('limit', { min: 1, max: 100, optional: true }),
    validators.textParam('action', { minLength: 0, maxLength: 100, optional: true }),
    validators.numericParam('userId', { min: 1, optional: true }),
    validators.dateParam('startDate', { optional: true }),
    validators.dateParam('endDate', { optional: true }),
    handleValidationErrors,
    ROUTE_CACHE_CONFIG.audit.get,  // Cache de 1 minuto
    adminController.getAuditLogs
);

/**
 * GET /admin/audit/summary
 * Resumo de atividades administrativas
 */
router.get('/audit/summary', async (req, res) => {
    try {
        const { logAdminAction } = require('../middleware/admin.middleware');
        const { systemLogger } = require('../utils/logger');
        
        logAdminAction(req, 'get_audit_summary');
        
        // Implementação básica - em produção seria mais detalhada
        const summary = {
            period: '24h',
            totalActions: 0,
            uniqueAdmins: 0,
            topActions: [],
            recentActivity: [],
            systemHealth: 'healthy',
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: summary,
            message: 'Sistema de auditoria em desenvolvimento'
        });
        
    } catch (error) {
        const { systemLogger } = require('../utils/logger');
        systemLogger.error('Error getting audit summary', {
            error: error.message,
            adminId: req.user.id
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao obter resumo de auditoria',
            code: 'AUDIT_SUMMARY_ERROR'
        });
    }
});

// === UTILIDADES PARA VALIDAÇÃO ===

// Função para validar parâmetros numéricos
function numericParam(paramName, options = {}) {
    const { min = 1, max = Number.MAX_SAFE_INTEGER, location = 'query', optional = false } = options;
    
    let validator;
    if (location === 'params') {
        validator = require('express-validator').param(paramName);
    } else {
        validator = require('express-validator').query(paramName);
    }
    
    validator = validator
        .isInt({ min, max })
        .withMessage(`${paramName} deve ser um número entre ${min} e ${max}`)
        .toInt();
    
    if (optional) {
        validator = validator.optional({ checkFalsy: true });
    }
    
    return validator;
}

// Função para validar parâmetros de texto
function textParam(paramName, options = {}) {
    const { minLength = 0, maxLength = 255, location = 'body', optional = false } = options;
    
    let validator;
    if (location === 'params') {
        validator = require('express-validator').param(paramName);
    } else if (location === 'query') {
        validator = require('express-validator').query(paramName);
    } else {
        validator = require('express-validator').body(paramName);
    }
    
    validator = validator
        .trim()
        .isLength({ min: minLength, max: maxLength })
        .withMessage(`${paramName} deve ter entre ${minLength} e ${maxLength} caracteres`);
    
    if (optional) {
        validator = validator.optional({ checkFalsy: true });
    }
    
    return validator;
}

// Função para validar parâmetros enum
function enumParam(paramName, allowedValues, options = {}) {
    const { location = 'body', optional = false } = options;
    
    let validator;
    if (location === 'params') {
        validator = require('express-validator').param(paramName);
    } else if (location === 'query') {
        validator = require('express-validator').query(paramName);
    } else {
        validator = require('express-validator').body(paramName);
    }
    
    validator = validator
        .isIn(allowedValues)
        .withMessage(`${paramName} deve ser um dos valores: ${allowedValues.join(', ')}`);
    
    if (optional) {
        validator = validator.optional({ checkFalsy: true });
    }
    
    return validator;
}

// Função para validar datas
function dateParam(paramName, options = {}) {
    const { location = 'query', optional = false } = options;
    
    let validator;
    if (location === 'params') {
        validator = require('express-validator').param(paramName);
    } else if (location === 'query') {
        validator = require('express-validator').query(paramName);
    } else {
        validator = require('express-validator').body(paramName);
    }
    
    validator = validator
        .isISO8601()
        .withMessage(`${paramName} deve ser uma data válida no formato ISO 8601`)
        .toDate();
    
    if (optional) {
        validator = validator.optional({ checkFalsy: true });
    }
    
    return validator;
}

// Adicionar validadores customizados ao objeto validators
Object.assign(validators, {
    numericParam,
    textParam,
    enumParam,
    dateParam
});

// === CACHE MANAGEMENT ROUTES ===

/**
 * GET /admin/cache/stats
 * Estatísticas do cache administrativo
 */
router.get('/cache/stats', cacheStats);

/**
 * POST /admin/cache/clear
 * Limpeza manual do cache
 * Body: { "tag": "users" } ou vazio para limpar tudo
 */
router.post('/cache/clear',
    requireSecureAdmin,
    validators.textParam('tag', { minLength: 0, maxLength: 50, optional: true }),
    handleValidationErrors,
    cacheClear
);

/**
 * POST /admin/cache/refresh-views
 * Refresh manual das views materializadas
 */
router.post('/cache/refresh-views',
    requireSecureAdmin,
    async (req, res) => {
        try {
            const { dbRun } = require('../../database-postgresql');
            const { logAdminAction } = require('../middleware/admin.middleware');
            const { systemLogger } = require('../utils/logger');
            
            logAdminAction(req, 'refresh_materialized_views');
            
            // Refresh das views materializadas em paralelo
            await Promise.all([
                dbRun('SELECT refresh_admin_metrics()'),
                dbRun('REFRESH MATERIALIZED VIEW CONCURRENTLY admin_user_metrics'),
                dbRun('REFRESH MATERIALIZED VIEW CONCURRENTLY admin_plan_metrics')
            ]);
            
            systemLogger.info('Materialized views refreshed manually', {
                adminId: req.user.id
            });
            
            res.json({
                success: true,
                message: 'Views materializadas atualizadas com sucesso',
                data: {
                    refreshedAt: new Date().toISOString(),
                    refreshedBy: req.user.id,
                    views: ['admin_user_metrics', 'admin_plan_metrics']
                }
            });
            
        } catch (error) {
            const { systemLogger } = require('../utils/logger');
            systemLogger.error('Error refreshing materialized views', {
                error: error.message,
                adminId: req.user.id
            });
            
            res.status(500).json({
                success: false,
                error: 'Erro ao atualizar views materializadas',
                code: 'REFRESH_VIEWS_ERROR'
            });
        }
    }
);

// === ERROR HANDLING ===

// Middleware de erro específico para rotas admin
router.use((error, req, res, next) => {
    const { systemLogger } = require('../utils/logger');
    
    systemLogger.error('Admin route error', {
        error: error.message,
        stack: error.stack,
        adminId: req.user?.id,
        url: req.originalUrl,
        method: req.method
    });
    
    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Erro interno do servidor',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;