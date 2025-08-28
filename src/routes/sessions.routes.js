const express = require('express');
const { body, param } = require('express-validator');
const SessionsController = require('../controllers/sessions.controller');

// Import middleware
const { authenticateToken } = require('../middleware/auth.middleware');
const { handleValidationErrors, validators: validationValidators } = require('../middleware/validation.middleware');

const router = express.Router();

// VALIDATION RULES
const validators = {
    numericId: (paramName) => validationValidators.numericId(paramName),
    sessionStatus: body('status').isIn(['Pendente', 'Concluído']).withMessage('Status deve ser "Pendente" ou "Concluído"'),
    studyTime: body('seconds').isInt({ min: 0, max: 86400 }).withMessage('Tempo deve ser entre 0 e 86400 segundos (24 horas)'),
    postponeDays: body('days').custom((value) => {
        return value === 'next' || (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 30);
    }).withMessage('Número de dias deve ser "next" ou entre 1 e 30 dias'),
    batchSessions: [
        body('sessions').isArray({ min: 1 }).withMessage('O corpo deve conter um array com pelo menos uma sessão'),
        body('sessions.*.id').isInt({ min: 1 }).withMessage('ID da sessão deve ser um número inteiro positivo'),
        body('sessions.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status da sessão inválido')
    ]
};

/**
 * @route GET /api/sessions/by-date/:planId
 * @desc Get sessions grouped by date (schedule view)
 * @access Private
 * @critical Brazilian timezone handling for accurate date grouping
 */
router.get('/by-date/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    SessionsController.getSessionsByDate
);

/**
 * @route GET /api/sessions/overdue-check/:planId  
 * @desc Check count of overdue sessions
 * @access Private
 * @critical Uses Brazilian timezone to determine what's overdue
 */
router.get('/overdue-check/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    SessionsController.getOverdueCheck
);

/**
 * @route GET /api/sessions/statistics/:planId
 * @desc Get detailed session statistics for analytics
 * @access Private
 * @critical Complex calculations for streaks, study hours, performance metrics
 */
router.get('/statistics/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    SessionsController.getSessionStatistics
);

/**
 * @route GET /api/sessions/question-progress/:planId
 * @desc Get daily and weekly question solving progress
 * @access Private
 * @critical Brazilian timezone for accurate daily/weekly calculations
 */
router.get('/question-progress/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    SessionsController.getQuestionProgress
);

/**
 * @route PATCH /api/sessions/batch-update-status
 * @desc Update status of multiple sessions in one transaction
 * @access Private
 * @critical High-performance batch operation with security validation
 */
router.patch('/batch-update-status',
    authenticateToken(),
    validators.batchSessions,
    handleValidationErrors,
    SessionsController.batchUpdateStatus
);

/**
 * @route PATCH /api/sessions/:sessionId
 * @desc Update individual session status
 * @access Private
 * @critical Individual session updates with ownership validation
 */

// Debug middleware para rastrear onde trava
const debugTap = (label) => (req, res, next) => {
    console.log(`[DEBUG SESSIONS] ${label} - ${req.method} ${req.path}`);
    console.log(`[DEBUG SESSIONS] ${label} - Body:`, req.body);
    console.log(`[DEBUG SESSIONS] ${label} - Params:`, req.params);
    next();
};

router.patch('/:sessionId',
    debugTap('1-START'),
    authenticateToken(),
    debugTap('2-AFTER-AUTH'),
    validators.numericId('sessionId'),
    debugTap('3-AFTER-NUMERIC-ID'),
    validators.sessionStatus,
    debugTap('4-AFTER-SESSION-STATUS'),
    handleValidationErrors,
    debugTap('5-AFTER-VALIDATION-ERRORS'),
    SessionsController.updateSessionStatus
);

/**
 * @route PATCH /api/sessions/:sessionId/postpone
 * @desc Postpone session with intelligent date finding
 * @access Private
 * @critical Complex algorithm to find next available study day
 */
router.patch('/:sessionId/postpone',
    authenticateToken(),
    validators.numericId('sessionId'),
    validators.postponeDays,
    handleValidationErrors,
    SessionsController.postponeSession
);

/**
 * @route POST /api/sessions/:sessionId/time
 * @desc Register study time for a session
 * @access Private
 * @critical Time tracking for analytics and progress calculation
 */
router.post('/:sessionId/time',
    authenticateToken(),
    validators.numericId('sessionId'),
    validators.studyTime,
    handleValidationErrors,
    SessionsController.registerStudyTime
);

/**
 * @route POST /api/sessions/:sessionId/reinforce
 * @desc Create reinforcement session for spaced repetition
 * @access Private
 * @critical Spaced repetition algorithm - schedules review 3 days later
 */
router.post('/:sessionId/reinforce',
    authenticateToken(),
    validators.numericId('sessionId'),
    handleValidationErrors,
    SessionsController.createReinforcementSession
);

// === PHASE 5 WAVE 2 - NEW SERVICE-ENHANCED ROUTES ===

/**
 * @route GET /api/sessions/streak/:planId
 * @desc Get detailed study streak analysis
 * @access Private
 * @enhanced Uses SessionService for advanced streak calculations and risk assessment
 */
router.get('/streak/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    SessionsController.getStudyStreak
);

/**
 * @route POST /api/sessions/schedule/:planId
 * @desc Schedule a new session with intelligent date finding
 * @access Private
 * @enhanced Uses SessionService for optimal scheduling
 */
const scheduleValidators = [
    body('session_type').isIn(['Novo Tópico', 'Revisão 3d', 'Revisão 7d', 'Revisão 15d', 'Revisão 30d', 'Simulado Direcionado', 'Simulado Completo', 'Redação']).withMessage('Tipo de sessão inválido'),
    body('subject_name').trim().isLength({ min: 1, max: 100 }).withMessage('Nome da matéria é obrigatório'),
    body('session_date').optional().isISO8601().withMessage('Data da sessão deve estar no formato ISO8601'),
    body('topic_id').optional().isInt({ min: 1 }).withMessage('ID do tópico deve ser um número positivo'),
    body('duration_minutes').optional().isInt({ min: 5, max: 480 }).withMessage('Duração deve estar entre 5 minutos e 8 horas')
];

router.post('/schedule/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    scheduleValidators,
    handleValidationErrors,
    SessionsController.scheduleSession
);

/**
 * @route POST /api/sessions/:sessionId/complete
 * @desc Complete a session with comprehensive tracking
 * @access Private
 * @enhanced Uses SessionService for automatic reinforcement scheduling and analytics
 */
const completionValidators = [
    body('timeStudied').isInt({ min: 60, max: 28800 }).withMessage('Tempo de estudo deve estar entre 1 minuto e 8 horas'),
    body('questionsSolved').optional().isInt({ min: 0 }).withMessage('Número de questões deve ser positivo'),
    body('questionsCorrect').optional().isInt({ min: 0 }).withMessage('Número de questões corretas deve ser positivo'),
    body('difficultyRating').optional().isInt({ min: 1, max: 5 }).withMessage('Avaliação de dificuldade deve ser entre 1 e 5'),
    body('confidenceRating').optional().isInt({ min: 1, max: 5 }).withMessage('Avaliação de confiança deve ser entre 1 e 5'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notas devem ter até 500 caracteres')
];

router.post('/:sessionId/complete',
    authenticateToken(),
    validators.numericId('sessionId'),
    completionValidators,
    handleValidationErrors,
    SessionsController.completeSession
);

module.exports = router;

/**
 * INTEGRATION NOTES FOR server.js:
 * 
 * Add this to your server.js file:
 * 
 * // Sessions routes - Phase 5 modular architecture
 * const sessionsRoutes = require('./src/routes/sessions.routes');
 * app.use('/api/sessions', sessionsRoutes);
 * 
 * ROUTES BEING MIGRATED FROM server.js:
 * 
 * 1. MIGRATED: app.patch('/api/sessions/batch_update_status') -> PATCH /api/sessions/batch-update-status
 * 2. MIGRATED: app.patch('/api/sessions/:sessionId') -> PATCH /api/sessions/:sessionId  
 * 3. MIGRATED: app.post('/api/sessions/:sessionId/time') -> POST /api/sessions/:sessionId/time
 * 4. MIGRATED: app.get('/api/plans/:planId/schedule') -> GET /api/sessions/by-date/:planId
 * 5. MIGRATED: app.get('/api/plans/:planId/overdue_check') -> GET /api/sessions/overdue-check/:planId
 * 6. MIGRATED: Legacy app.post('/api/sessions/:sessionId/reinforce') -> POST /api/sessions/:sessionId/reinforce
 * 7. MIGRATED: Legacy app.patch('/api/sessions/:sessionId/postpone') -> PATCH /api/sessions/:sessionId/postpone
 * 8. NEW: GET /api/sessions/statistics/:planId - Extracted complex analytics logic
 * 9. NEW: GET /api/sessions/question-progress/:planId - Extracted question progress logic
 * 
 * COMPLEX LOGIC PRESERVED:
 * ✅ Brazilian timezone handling (America/Sao_Paulo)
 * ✅ Duration calculations and time tracking  
 * ✅ Topic completion tracking via sessions
 * ✅ Session statistics and streak calculations
 * ✅ Overdue session detection with timezone accuracy
 * ✅ Batch operations with transaction safety
 * ✅ Intelligent date finding for postponement
 * ✅ Spaced repetition scheduling (3-day reinforcement)
 * ✅ Security: All routes verify user ownership of plans/sessions
 * 
 * DEPENDENCIES REQUIRED IN server.js:
 * - All existing middleware (authenticateToken, handleValidationErrors, validators)  
 * - All existing database helper functions (dbRun, dbGet, dbAll)
 * - getBrazilianDateString() function for timezone handling
 * 
 * NO FUNCTIONALITY LOST - All session complexity preserved and modularized
 */