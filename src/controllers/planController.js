/**
 * Plan Controller - Handles all plan-related HTTP requests
 * 
 * This controller manages study plans, schedules, progress tracking,
 * and all related business logic that was previously in server.js
 */

const planService = require('../services/planService');
const { sanitizeHtml } = require('../utils/sanitizer');
const { createSafeError, securityLog } = require('../utils/security');

/**
 * Get schedule preview for a plan
 * GET /plans/:planId/schedule_preview
 */
const getSchedulePreview = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const scheduleData = await planService.getSchedulePreview(planId, userId);
        res.json(scheduleData);
    } catch (error) {
        securityLog('schedule_preview_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar preview do cronograma'));
    }
};

/**
 * Get plan progress data
 * GET /plans/:planId/progress
 */
const getProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const progressData = await planService.getProgress(planId, userId);
        res.json(progressData);
    } catch (error) {
        console.error('Error getting plan progress:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar progresso do plano',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get detailed progress breakdown
 * GET /plans/:planId/detailed_progress
 */
const getDetailedProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const detailedData = await planService.getDetailedProgress(planId, userId);
        res.json(detailedData);
    } catch (error) {
        console.error('Error getting detailed progress:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar progresso detalhado',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get goal progress
 * GET /plans/:planId/goal_progress
 */
const getGoalProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const goalData = await planService.getGoalProgress(planId, userId);
        res.json(goalData);
    } catch (error) {
        console.error('Error getting goal progress:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar metas',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get reality check data
 * GET /plans/:planId/realitycheck
 */
const getRealityCheck = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const realityData = await planService.getRealityCheck(planId, userId);
        res.json(realityData);
    } catch (error) {
        console.error('Error getting reality check:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar diagnóstico',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get gamification data
 * GET /plans/:planId/gamification
 */
const getGamification = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const gamificationData = await planService.getGamification(planId, userId);
        res.json(gamificationData);
    } catch (error) {
        console.error('Error getting gamification data:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar dados de gamificação',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get completed sessions for gamification
 * GET /plans/:planId/sessions/completed
 */
const getCompletedSessions = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const sessions = await planService.getCompletedSessions(planId, userId);
        res.json({ sessions });
    } catch (error) {
        console.error('Error getting completed sessions:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar sessões concluídas',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get user stats for plan
 * GET /plans/:planId/user_stats
 */
const getUserStats = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const stats = await planService.getUserStats(planId, userId);
        res.json(stats);
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar estatísticas do usuário',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get question radar (weak points)
 * GET /plans/:planId/question_radar
 */
const getQuestionRadar = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const radarData = await planService.getQuestionRadar(planId, userId);
        res.json(radarData);
    } catch (error) {
        console.error('Error getting question radar:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar radar de questões',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get overdue check
 * GET /plans/:planId/overdue_check
 */
const getOverdueCheck = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const overdueData = await planService.getOverdueCheck(planId, userId);
        res.json(overdueData);
    } catch (error) {
        console.error('Error getting overdue check:', error);
        res.status(500).json({ 
            error: 'Erro ao verificar tarefas atrasadas',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get activity summary
 * GET /plans/:planId/activity_summary
 */
const getActivitySummary = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const date = req.query.date;
        
        const summaryData = await planService.getActivitySummary(planId, userId, date);
        res.json(summaryData);
    } catch (error) {
        console.error('Error getting activity summary:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar resumo de atividades',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get plan subjects
 * GET /plans/:planId/subjects
 */
const getSubjects = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const subjects = await planService.getSubjects(planId, userId);
        res.json(subjects);
    } catch (error) {
        console.error('Error getting plan subjects:', error);
        res.status(500).json({ 
            error: 'Erro ao carregar disciplinas do plano',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getSchedulePreview,
    getProgress,
    getDetailedProgress,
    getGoalProgress,
    getRealityCheck,
    getGamification,
    getCompletedSessions,
    getUserStats,
    getQuestionRadar,
    getOverdueCheck,
    getActivitySummary,
    getSubjects
};