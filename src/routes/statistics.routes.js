// ============================================================================
// STATISTICS ROUTES - PHASE 6 OF MODULAR MIGRATION
// ============================================================================
// Complex statistics endpoints with CTEs, recursive queries and analytics
// Routes migrated from server.js lines 3130-4509

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');
const statisticsController = require('../controllers/statistics.controller');

// ============================================================================
// PLAN STATISTICS ROUTES
// ============================================================================

/**
 * GET /api/plans/:planId/statistics
 * Complex statistics with CTE and recursive queries for study streaks
 * Original: server.js line 3130
 * CRITICAL: Contains recursive CTE - DO NOT SIMPLIFY
 */
router.get('/plans/:planId/statistics',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    statisticsController.getPlanStatistics
);

/**
 * GET /api/plans/:planId/detailed_progress  
 * Complex detailed progress analytics with time breakdowns
 * Original: server.js line 3633
 * CRITICAL: Contains complex JOINs and aggregations - preserve exactly
 */
router.get('/plans/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    statisticsController.getDetailedProgress
);

/**
 * GET /api/plans/:planId/share-progress
 * Statistics for sharing progress with gamification
 * Original: server.js line 4360
 */
router.get('/plans/:planId/share-progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    statisticsController.getShareProgress
);

// ============================================================================
// SYSTEM METRICS ROUTES
// ============================================================================

/**
 * GET /api/plans/:planId/goal_progress
 * Get daily and weekly question goal progress statistics
 * Original: server.js line 3525 (was commented as migrated)
 */
router.get('/plans/:planId/goal_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    statisticsController.getGoalProgress
);

/**
 * GET /api/plans/:planId/question_radar
 * Question radar - identify weak points with complex query
 * Original: server.js line 3562 (was commented as migrated)
 * CRITICAL: Contains complex JOIN and HAVING - preserve exactly
 */
router.get('/plans/:planId/question_radar',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    statisticsController.getQuestionRadar
);

// ============================================================================
// SYSTEM METRICS ROUTES
// ============================================================================

/**
 * GET /metrics
 * System metrics endpoint (protected)
 * Original: server.js line 4501
 */
router.get('/metrics',
    authenticateToken,
    statisticsController.getMetrics
);

module.exports = router;