/**
 * Schedule Routes - HTTP routes for schedule and session management
 * 
 * This file defines all the routes related to study schedules, sessions,
 * time tracking, and schedule analytics using the modular architecture.
 */

const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// Import middleware functions
const {
    authenticateToken,
    validators,
    handleValidationErrors,
    sanitizeMiddleware
} = require('../../middleware');

// =====================================
// SCHEDULE ROUTES
// =====================================

/**
 * GET /schedules/:planId - Get complete schedule for a plan
 */
router.get('/:planId',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    scheduleController.getSchedule
);

/**
 * GET /schedules/:planId/range - Get schedule within date range
 */
router.get('/:planId/range',
    authenticateToken,
    validators.numericId('planId'),
    validators.dateString('startDate'),
    validators.dateString('endDate'),
    handleValidationErrors,
    scheduleController.getScheduleByDateRange
);

/**
 * GET /schedules/:planId/overview - Get schedule overview/summary
 */
router.get('/:planId/overview',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    scheduleController.getScheduleOverview
);

/**
 * GET /schedules/:planId/analytics - Get schedule analytics and statistics
 */
router.get('/:planId/analytics',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    scheduleController.getScheduleAnalytics
);

/**
 * GET /schedules/:planId/weekly - Get weekly schedule view
 */
router.get('/:planId/weekly',
    authenticateToken,
    validators.numericId('planId'),
    validators.dateString('weekStart'),
    handleValidationErrors,
    scheduleController.getWeeklySchedule
);

/**
 * GET /schedules/:planId/monthly - Get monthly schedule overview
 */
router.get('/:planId/monthly',
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('year', 2020, 2030),
    validators.integer('month', 1, 12),
    handleValidationErrors,
    scheduleController.getMonthlySchedule
);

/**
 * GET /schedules/:planId/progress - Get schedule progress tracking
 */
router.get('/:planId/progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    scheduleController.getScheduleProgress
);

/**
 * GET /schedules/:planId/export - Export schedule data
 */
router.get('/:planId/export',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    scheduleController.exportSchedule
);

/**
 * GET /schedules/templates - Get schedule templates
 */
router.get('/templates',
    authenticateToken,
    scheduleController.getScheduleTemplates
);

// =====================================
// SESSION ROUTES
// =====================================

/**
 * GET /schedules/sessions/:sessionId - Get single session details
 */
router.get('/sessions/:sessionId',
    authenticateToken,
    validators.numericId('sessionId'),
    handleValidationErrors,
    scheduleController.getSession
);

/**
 * POST /schedules/sessions - Create new study session
 */
router.post('/sessions',
    authenticateToken,
    sanitizeMiddleware,
    validators.sessionCreate(),
    handleValidationErrors,
    scheduleController.createSession
);

/**
 * PATCH /schedules/sessions/:sessionId - Update study session
 */
router.patch('/sessions/:sessionId',
    authenticateToken,
    validators.numericId('sessionId'),
    sanitizeMiddleware,
    validators.sessionUpdate(),
    handleValidationErrors,
    scheduleController.updateSession
);

/**
 * PATCH /schedules/sessions/:sessionId/status - Update session status
 */
router.patch('/sessions/:sessionId/status',
    authenticateToken,
    validators.numericId('sessionId'),
    validators.sessionStatus(),
    handleValidationErrors,
    scheduleController.updateSessionStatus
);

/**
 * PATCH /schedules/sessions/batch-status - Batch update session statuses
 */
router.patch('/sessions/batch-status',
    authenticateToken,
    validators.batchStatusUpdate(),
    handleValidationErrors,
    scheduleController.batchUpdateStatus
);

/**
 * DELETE /schedules/sessions/:sessionId - Delete study session
 */
router.delete('/sessions/:sessionId',
    authenticateToken,
    validators.numericId('sessionId'),
    handleValidationErrors,
    scheduleController.deleteSession
);

/**
 * POST /schedules/sessions/:sessionId/reinforce - Create reinforcement session
 */
router.post('/sessions/:sessionId/reinforce',
    authenticateToken,
    validators.numericId('sessionId'),
    handleValidationErrors,
    scheduleController.createReinforcementSession
);

/**
 * PATCH /schedules/sessions/:sessionId/postpone - Postpone session
 */
router.patch('/sessions/:sessionId/postpone',
    authenticateToken,
    validators.numericId('sessionId'),
    validators.sessionPostpone(),
    handleValidationErrors,
    scheduleController.postponeSession
);

/**
 * POST /schedules/sessions/:sessionId/time - Record study time
 */
router.post('/sessions/:sessionId/time',
    authenticateToken,
    validators.numericId('sessionId'),
    validators.timeRecord(),
    handleValidationErrors,
    scheduleController.recordStudyTime
);

module.exports = router;