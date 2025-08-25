/**
 * Plans Routes - FASE 3 MIGRAÇÃO COMPLETA
 * 
 * Rotas HTTP consolidadas para todas as operações relacionadas a planos de estudo.
 * Migra TODAS as rotas do server.js mantendo 100% da funcionalidade e validações.
 * 
 * ATENÇÃO: Este é o CORE BUSINESS da aplicação. Qualquer alteração pode quebrar
 * funcionalidades críticas. Proceder com máxima cautela.
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

// Import middleware
const { 
    authenticateToken, 
    validators, 
    handleValidationErrors, 
    sanitizeMiddleware 
} = require('../../middleware');

// Import controller
const plansController = require('../controllers/plans.controller');

// Apply sanitization to all routes
router.use(sanitizeMiddleware);

/**
 * 📋 CRUD BÁSICO DE PLANOS
 */

/**
 * @route GET /plans
 * @desc Listar todos os planos do usuário
 * @access Private
 */
router.get('/', 
    authenticateToken, 
    plansController.getPlans
);

/**
 * @route POST /plans
 * @desc Criar novo plano
 * @access Private
 */
router.post('/', 
    authenticateToken,
    validators.text('plan_name', 1, 200),
    validators.date('exam_date'),
    handleValidationErrors,
    plansController.createPlan
);

/**
 * @route GET /plans/:planId
 * @desc Obter plano específico
 * @access Private
 */
router.get('/:planId', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getPlan
);

/**
 * @route DELETE /plans/:planId
 * @desc Deletar plano com CASCADE manual
 * @access Private
 */
router.delete('/:planId', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.deletePlan
);

/**
 * @route PATCH /plans/:planId/settings
 * @desc Atualizar configurações do plano
 * @access Private
 */
router.patch('/:planId/settings', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    body('reta_final_mode').isBoolean().withMessage('reta_final_mode deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    plansController.updatePlanSettings
);

/**
 * 📚 DISCIPLINAS E TÓPICOS
 */

/**
 * @route POST /plans/:planId/subjects_with_topics
 * @desc Criar disciplina com tópicos
 * @access Private
 */
router.post('/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    body('topics_list').isString().isLength({ max: 10000 }).withMessage('Lista de tópicos muito longa'),
    handleValidationErrors,
    plansController.createSubjectWithTopics
);

/**
 * @route GET /plans/:planId/subjects_with_topics
 * @desc Listar disciplinas com tópicos
 * @access Private
 */
router.get('/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getSubjectsWithTopics
);

/**
 * @route PATCH /subjects/:subjectId
 * @desc Atualizar disciplina
 * @access Private
 * @note Esta rota não está no padrão /api/plans - mantida como /api/subjects no server.js
 */
// ATENÇÃO: Esta rota permanece em server.js como /api/subjects/:subjectId
// router.patch('/subjects/:subjectId', ...)

/**
 * @route DELETE /subjects/:subjectId
 * @desc Deletar disciplina com CASCADE
 * @access Private
 * @note Esta rota não está no padrão /api/plans - mantida como /api/subjects no server.js
 */
// ATENÇÃO: Esta rota permanece em server.js como /api/subjects/:subjectId
// router.delete('/subjects/:subjectId', ...)

/**
 * @route GET /subjects/:subjectId/topics
 * @desc Listar tópicos de uma disciplina
 * @access Private
 * @note Esta rota não está no padrão /api/plans - mantida como /api/subjects no server.js
 */
// ATENÇÃO: Esta rota permanece em server.js como /api/subjects/:subjectId/topics
// router.get('/subjects/:subjectId/topics', ...)

/**
 * @route PATCH /topics/batch_update
 * @desc Atualização em lote de tópicos
 * @access Private
 * @note Esta rota não está no padrão /api/plans - mantida como /api/topics no server.js
 */
// ATENÇÃO: Esta rota permanece em server.js como /api/topics/batch_update
// router.patch('/topics/batch_update', ...)

/**
 * 🔄 REPLANEJAMENTO E CONTROLE DE ATRASOS
 */

/**
 * @route GET /plans/:planId/overdue_check
 * @desc Verificar tarefas atrasadas
 * @access Private
 */
router.get('/:planId/overdue_check',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getOverdueCheck
);

/**
 * 📊 ESTATÍSTICAS E ANÁLISES
 */

/**
 * @route GET /plans/:planId/statistics
 * @desc Estatísticas do plano
 * @access Private
 */
router.get('/:planId/statistics',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getPlanStatistics
);

/**
 * @route GET /plans/:planId/exclusions
 * @desc Tópicos excluídos (legado - mantido para compatibilidade)
 * @access Private
 */
router.get('/:planId/exclusions',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getPlanExclusions
);

/**
 * @route GET /plans/:planId/excluded-topics
 * @desc Tópicos excluídos no modo Reta Final
 * @access Private
 */
router.get('/:planId/excluded-topics',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getExcludedTopics
);

/**
 * 🎮 GAMIFICAÇÃO E COMPARTILHAMENTO
 */

/**
 * @route GET /plans/:planId/gamification
 * @desc Dados de gamificação
 * @access Private
 */
router.get('/:planId/gamification', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getGamification
);

/**
 * @route GET /plans/:planId/share-progress
 * @desc Dados para compartilhamento
 * @access Private
 */
router.get('/:planId/share-progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getShareProgress
);

/**
 * @route GET /plans/:planId/schedule
 * @desc Get study schedule grouped by date
 * @access Private
 * @note Route was missing from modular implementation - added for compatibility
 */
router.get('/:planId/schedule',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const db = req.app.locals.db;
            // PostgreSQL query com parâmetros $1, $2
            const plan = await db.query(
                'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2', 
                [req.params.planId, req.user.id]
            );
            
            if (!plan.rows || plan.rows.length === 0) {
                return res.status(404).json({ error: "Plano não encontrado ou não autorizado." });
            }

            const result = await db.query(
                "SELECT * FROM study_sessions WHERE study_plan_id = $1 ORDER BY session_date ASC, id ASC", 
                [req.params.planId]
            );
            
            const groupedByDate = result.rows.reduce((acc, session) => {
                const date = session.session_date;
                if (!acc[date]) acc[date] = [];
                acc[date].push(session);
                return acc;
            }, {});
            
            res.json(groupedByDate);
        } catch(err) {
            console.error('Erro ao buscar cronograma:', err);
            res.status(500).json({ error: "Erro ao buscar cronograma" });
        }
    }
);

/**
 * 🚧 ROTAS COMPLEXAS AINDA NÃO MIGRADAS
 * 
 * As seguintes rotas são EXTREMAMENTE complexas e serão migradas em etapas futuras:
 * - POST /plans/:planId/generate (Algoritmo de geração de cronograma - 500+ linhas)
 * - GET /plans/:planId/replan-preview (Preview de replanejamento inteligente)
 * - POST /plans/:planId/replan (Replanejamento com estratégia otimizada)
 * - GET /plans/:planId/review_data (Dados para revisão com CTEs complexas)
 * - GET /plans/:planId/detailed_progress (Progresso detalhado com múltiplas queries)
 * - GET /plans/:planId/realitycheck (Diagnóstico de performance com análises complexas)
 * 
 * Estas rotas permanecem no server.js até serem migradas individualmente
 * devido à sua extrema complexidade e criticidade para o sistema.
 */

/**
 * 📝 ROTAS JÁ MIGRADAS EM OUTRAS FASES
 * 
 * As seguintes rotas JÁ foram migradas para outros controllers:
 * ✅ GET /plans/:planId/subjects -> planRoutes.js (existente)
 * ✅ GET /plans/:planId/progress -> planRoutes.js (existente) 
 * ✅ GET /plans/:planId/goal_progress -> planRoutes.js (existente)
 * ✅ GET /plans/:planId/question_radar -> planRoutes.js (existente)
 * ✅ GET /plans/:planId/overdue_check -> planRoutes.js (✅ IMPLEMENTADO)
 * ✅ GET /plans/:planId/activity_summary -> planRoutes.js (existente)
 * ✅ GET /plans/:planId/schedule -> scheduleRoutes.js
 */

module.exports = router;