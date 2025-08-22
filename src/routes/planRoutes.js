/**
 * Plan Routes - HTTP routes for study plan endpoints
 * 
 * This module defines all the routes related to study plans,
 * connecting HTTP requests to the appropriate controller methods.
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { 
    authenticateToken, 
    validators, 
    handleValidationErrors, 
    sanitizeMiddleware 
} = require('../../middleware');

// Import controller
const planController = require('../controllers/planController');

// Apply sanitization to all routes
router.use(sanitizeMiddleware);

/**
 * @route GET /plans/:planId/schedule_preview
 * @desc Get schedule preview with simulation calculations
 * @access Private
 */
router.get('/:planId/schedule_preview',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getSchedulePreview
);

/**
 * @route GET /plans/:planId/progress
 * @desc Get basic plan progress
 * @access Private
 */
router.get('/:planId/progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getProgress
);

/**
 * @route GET /plans/:planId/detailed_progress
 * @desc Get detailed progress breakdown by subject
 * @access Private
 */
router.get('/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getDetailedProgress
);

/**
 * @route GET /plans/:planId/goal_progress
 * @desc Get daily and weekly goal progress
 * @access Private
 */
router.get('/:planId/goal_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getGoalProgress
);

/**
 * @route GET /plans/:planId/realitycheck
 * @desc Get reality check analysis
 * @access Private
 */
router.get('/:planId/realitycheck',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getRealityCheck
);

/**
 * @route GET /plans/:planId/gamification
 * @desc Get gamification data
 * @access Private
 */
router.get('/:planId/gamification',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getGamification
);

/**
 * @route GET /plans/:planId/sessions/completed
 * @desc Get completed sessions for gamification stats
 * @access Private
 */
router.get('/:planId/sessions/completed',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getCompletedSessions
);

/**
 * @route GET /plans/:planId/user_stats
 * @desc Get user stats for the plan
 * @access Private
 */
router.get('/:planId/user_stats',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getUserStats
);

/**
 * @route GET /plans/:planId/question_radar
 * @desc Get question radar (weak points)
 * @access Private
 */
router.get('/:planId/question_radar',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getQuestionRadar
);

/**
 * @route GET /plans/:planId/overdue_check
 * @desc Check for overdue tasks
 * @access Private
 */
router.get('/:planId/overdue_check',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getOverdueCheck
);

/**
 * @route GET /plans/:planId/activity_summary
 * @desc Get activity summary for a date
 * @access Private
 */
router.get('/:planId/activity_summary',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getActivitySummary
);

/**
 * @route GET /plans/:planId/subjects
 * @desc Get subjects for a plan
 * @access Private
 */
router.get('/:planId/subjects',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    planController.getSubjects
);

module.exports = router;