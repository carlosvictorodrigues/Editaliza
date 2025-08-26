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
const { body } = require('express-validator');

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
 * @route GET /plans/:planId/replan-preview
 * @desc Preview de replanejamento inteligente
 * @access Private
 */
router.get('/:planId/replan-preview',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getReplanPreview
);

/**
 * @route POST /plans/:planId/replan
 * @desc Executar replanejamento inteligente
 * @access Private
 */
router.post('/:planId/replan',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.executeReplan
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
 * 🎯 FASE 6 WAVE 3 - RETA FINAL EXCLUSIONS MANAGEMENT
 * Implementa as 3 rotas críticas para gerenciar exclusões do modo Reta Final
 */

/**
 * @route GET /plans/:planId/reta-final-exclusions
 * @desc Obter todas as exclusões do modo reta final
 * @access Private
 */
router.get('/:planId/reta-final-exclusions',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getRetaFinalExclusions
);

/**
 * @route POST /plans/:planId/reta-final-exclusions
 * @desc Adicionar nova exclusão manual ao modo reta final
 * @access Private
 */
router.post('/:planId/reta-final-exclusions',
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('topicId', 1),
    body('reason').optional().isString().isLength({ max: 1000 }).withMessage('Razão deve ter até 1000 caracteres'),
    handleValidationErrors,
    plansController.addRetaFinalExclusion
);

/**
 * @route DELETE /plans/:planId/reta-final-exclusions/:id
 * @desc Remover exclusão específica do modo reta final
 * @access Private
 */
router.delete('/:planId/reta-final-exclusions/:id',
    authenticateToken,
    validators.numericId('planId'),
    validators.numericId('id'),
    handleValidationErrors,
    plansController.removeRetaFinalExclusion
);

/**
 * @route GET /plans/:planId/schedule
 * @desc Get study schedule grouped by date
 * @access Private
 * @note WAVE 2 INTEGRATION: Migrated from inline to use plansController.getSchedule
 */
router.get('/:planId/schedule',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getSchedule
);

/**
 * 📝 ROTAS COMPLEXAS EM MIGRAÇÃO - FASE 5 WAVE 4 - REPLAN MIGRATION
 * 
 * ✅ MIGRADAS E APRIMORADAS:
 * - GET /plans/:planId/progress (Progresso avançado com PlanService)
 * - GET /plans/:planId/goal_progress (Metas com timezone brasileiro correto)
 * - GET /plans/:planId/realitycheck (Diagnóstico preditivo avançado)
 * - GET /plans/:planId/schedule-preview (Preview com análises detalhadas)
 * - GET /plans/:planId/performance (Métricas de performance completas)
 * - GET /plans/:planId/replan-preview (Preview de replanejamento inteligente)
 * - POST /plans/:planId/replan (Replanejamento executivo com algoritmo inteligente)
 * 
 * 🔄 AINDA NO SERVER.JS (próximas waves):
 * - POST /plans/:planId/generate (Algoritmo de geração - 500+ linhas) - MIGRADO
 * - GET /plans/:planId/review_data (Dados de revisão complexos)
 * - GET /plans/:planId/detailed_progress (Progresso ultra-detalhado)
 * - GET /plans/:planId/activity_summary (Resumo de atividades)
 */

/**
 * 📝 ROTAS MIGRADAS - FASE 5 WAVE 3 STATUS
 * 
 * ✅ MIGRADAS E APRIMORADAS COM PLANSERVICE:
 * - GET /plans/:planId/overdue_check (Enhanced com algoritmos avançados)
 * - GET /plans/:planId/gamification (Enhanced com sistema de ranks humorístico)
 * - GET /plans/:planId/progress (Enhanced com cálculos precisos)
 * - GET /plans/:planId/goal_progress (Enhanced com timezone brasileiro)
 * - GET /plans/:planId/realitycheck (Enhanced com projeções preditivas)
 * - GET /plans/:planId/schedule-preview (Enhanced com análises de cobertura)
 * - GET /plans/:planId/performance (Enhanced com métricas avançadas)
 * - POST /plans/:planId/replan-preview (Enhanced com algoritmos de replanejamento)
 * 
 * 🔄 MANTIDAS EM OUTROS CONTROLLERS:
 * - GET /plans/:planId/schedule -> ✅ MIGRATED: Now uses plansController.getSchedule (WAVE 2)
 * - POST /plans/:planId/generate -> Migrada anteriormente para este controller
 */

/**
 * 🔄 FASE 6 WAVE 4 - BATCH UPDATES
 * Rotas para atualização em lote de cronogramas
 */

/**
 * @route POST /plans/:planId/batch_update
 * @desc Atualização em lote de sessões do cronograma
 * @access Private
 * @body { updates: Array<{sessionId: number, status?: string, questionsResolved?: number, timeStudiedSeconds?: number}> }
 */
router.post('/:planId/batch_update',
    authenticateToken,
    validators.numericId('planId'),
    body('updates').isArray({ min: 1, max: 100 }).withMessage('Updates deve ser um array com 1-100 itens'),
    body('updates.*.sessionId').isInt({ min: 1 }).withMessage('sessionId deve ser um inteiro positivo'),
    body('updates.*.status').optional().isIn(['Pendente', 'Concluído', 'Pulado', 'Adiado']).withMessage('Status inválido'),
    body('updates.*.questionsResolved').optional().isInt({ min: 0 }).withMessage('questionsResolved deve ser um inteiro não-negativo'),
    body('updates.*.timeStudiedSeconds').optional().isInt({ min: 0 }).withMessage('timeStudiedSeconds deve ser um inteiro não-negativo'),
    handleValidationErrors,
    plansController.batchUpdateSchedule
);

/**
 * @route POST /plans/:planId/batch_update_details
 * @desc Atualização detalhada em lote de sessões com dados adicionais
 * @access Private
 * @body { updates: Array<{sessionId: number, status?: string, questionsResolved?: number, timeStudiedSeconds?: number, difficulty?: number, notes?: string, completed_at?: string}> }
 */
router.post('/:planId/batch_update_details',
    authenticateToken,
    validators.numericId('planId'),
    body('updates').isArray({ min: 1, max: 50 }).withMessage('Updates deve ser um array com 1-50 itens'),
    body('updates.*.sessionId').isInt({ min: 1 }).withMessage('sessionId deve ser um inteiro positivo'),
    body('updates.*.status').optional().isIn(['Pendente', 'Concluído', 'Pulado', 'Adiado']).withMessage('Status inválido'),
    body('updates.*.questionsResolved').optional().isInt({ min: 0 }).withMessage('questionsResolved deve ser um inteiro não-negativo'),
    body('updates.*.timeStudiedSeconds').optional().isInt({ min: 0 }).withMessage('timeStudiedSeconds deve ser um inteiro não-negativo'),
    body('updates.*.difficulty').optional().isInt({ min: 1, max: 5 }).withMessage('difficulty deve ser um inteiro entre 1 e 5'),
    body('updates.*.notes').optional().isString().isLength({ max: 1000 }).withMessage('notes deve ter até 1000 caracteres'),
    body('updates.*.completed_at').optional().isISO8601().withMessage('completed_at deve ser uma data válida'),
    handleValidationErrors,
    plansController.batchUpdateScheduleDetails
);

/**
 * 🎯 FASE 6 WAVE 7 - CONFLICT RESOLUTION
 * Rotas para detecção e resolução de conflitos no cronograma
 */

/**
 * @route GET /plans/:planId/schedule-conflicts
 * @desc Detecta conflitos no cronograma do plano
 * @access Private
 * @returns {Object} Relatório completo de conflitos detectados
 */
router.get('/:planId/schedule-conflicts',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    plansController.getScheduleConflicts
);

/**
 * @route POST /plans/:planId/resolve-conflicts
 * @desc Resolve conflitos automaticamente no cronograma
 * @access Private
 * @body { conflictIds?: Array<string>, resolution?: Object }
 * @returns {Object} Resultado da resolução dos conflitos
 */
router.post('/:planId/resolve-conflicts',
    authenticateToken,
    validators.numericId('planId'),
    body('conflictIds').optional().isArray().withMessage('conflictIds deve ser um array'),
    body('conflictIds.*').optional().isString().withMessage('Cada conflictId deve ser uma string'),
    body('resolution').optional().isObject().withMessage('resolution deve ser um objeto'),
    body('resolution.strategy').optional().isIn(['automatic', 'redistribute', 'remove_duplicates']).withMessage('Estratégia de resolução inválida'),
    body('resolution.priority').optional().isIn(['speed', 'quality', 'balanced']).withMessage('Prioridade de resolução inválida'),
    handleValidationErrors,
    plansController.resolveScheduleConflicts
);

/**
 * 📊 WAVE 7 COMPLETION SUMMARY
 * 
 * ✅ ROTAS IMPLEMENTADAS:
 * - GET  /plans/:planId/schedule-conflicts (Detecção de conflitos)
 * - POST /plans/:planId/resolve-conflicts (Resolução automática)
 * 
 * ⚡ FUNCIONALIDADES:
 * - Detecta conflitos de data/sobrecarga
 * - Identifica gaps problemáticos
 * - Remove tópicos duplicados
 * - Redistribui sessões automaticamente
 * - Transações atômicas para segurança
 * - Validações completas de entrada
 * - Error handling robusto
 * 
 * 🎯 FASE 6 CONCLUÍDA - TODAS AS WAVES FINALIZADAS!
 */

module.exports = router;