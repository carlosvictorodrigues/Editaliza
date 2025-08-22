/**
 * Schedule Controller - Handles all schedule and session-related HTTP requests
 * 
 * This controller manages study schedules, sessions, time tracking, analytics,
 * and all related business logic that was previously in server.js
 */

const scheduleService = require('../services/scheduleService');
const { sanitizeHtml } = require('../utils/sanitizer');
const { createSafeError, securityLog } = require('../utils/security');

/**
 * Get complete schedule for a plan
 * GET /schedules/:planId
 */
const getSchedule = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const schedule = await scheduleService.getSchedule(planId, userId);
        res.json(schedule);
    } catch (error) {
        securityLog('get_schedule_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar cronograma'));
        }
    }
};

/**
 * Get schedule within date range
 * GET /schedules/:planId/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
const getScheduleByDateRange = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const { startDate, endDate } = req.query;
        
        const sessions = await scheduleService.getScheduleByDateRange(planId, userId, startDate, endDate);
        res.json(sessions);
    } catch (error) {
        securityLog('get_schedule_range_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || 
            error.message.includes('obrigatórios') ||
            error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar cronograma por período'));
        }
    }
};

/**
 * Get single session details
 * GET /schedules/sessions/:sessionId
 */
const getSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        
        const session = await scheduleService.getSession(sessionId, userId);
        res.json(session);
    } catch (error) {
        securityLog('get_session_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrada') || error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar sessão'));
        }
    }
};

/**
 * Create new study session
 * POST /schedules/sessions
 */
const createSession = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await scheduleService.createSession(req.body, userId);
        res.status(201).json(result);
    } catch (error) {
        securityLog('create_session_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrado') || 
                   error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao criar sessão'));
        }
    }
};

/**
 * Update study session
 * PATCH /schedules/sessions/:sessionId
 */
const updateSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        
        const result = await scheduleService.updateSession(sessionId, req.body, userId);
        res.json(result);
    } catch (error) {
        securityLog('update_session_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrada') || 
                   error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar sessão'));
        }
    }
};

/**
 * Update session status
 * PATCH /schedules/sessions/:sessionId/status
 */
const updateSessionStatus = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        const { status } = req.body;
        
        const result = await scheduleService.updateSessionStatus(sessionId, status, userId);
        res.json(result);
    } catch (error) {
        securityLog('update_session_status_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrada') || 
                   error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar status da sessão'));
        }
    }
};

/**
 * Batch update session statuses
 * PATCH /schedules/sessions/batch-status
 */
const batchUpdateStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessions } = req.body;
        
        const result = await scheduleService.batchUpdateStatus(sessions, userId);
        res.json(result);
    } catch (error) {
        securityLog('batch_update_status_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido') ||
            error.message.includes('vazia')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar sessões em lote'));
        }
    }
};

/**
 * Delete study session
 * DELETE /schedules/sessions/:sessionId
 */
const deleteSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        
        const result = await scheduleService.deleteSession(sessionId, userId);
        res.json(result);
    } catch (error) {
        securityLog('delete_session_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrada') || 
            error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao remover sessão'));
        }
    }
};

/**
 * Create reinforcement session
 * POST /schedules/sessions/:sessionId/reinforce
 */
const createReinforcementSession = async (req, res) => {
    try {
        const originalSessionId = req.params.sessionId;
        const userId = req.user.id;
        
        const result = await scheduleService.createReinforcementSession(originalSessionId, userId);
        res.status(201).json(result);
    } catch (error) {
        securityLog('create_reinforcement_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrada') || 
            error.message.includes('não é um tópico')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao criar sessão de reforço'));
        }
    }
};

/**
 * Postpone session
 * PATCH /schedules/sessions/:sessionId/postpone
 */
const postponeSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        const postponementData = req.body;
        
        const result = await scheduleService.postponeSession(sessionId, userId, postponementData);
        res.json(result);
    } catch (error) {
        securityLog('postpone_session_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrada') || 
            error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else if (error.message.includes('limite atingido') ||
                   error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao adiar sessão'));
        }
    }
};

/**
 * Get schedule analytics
 * GET /schedules/:planId/analytics
 */
const getScheduleAnalytics = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const analytics = await scheduleService.getScheduleAnalytics(planId, userId);
        res.json(analytics);
    } catch (error) {
        securityLog('get_schedule_analytics_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || 
            error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar analíticas do cronograma'));
        }
    }
};

/**
 * Get weekly schedule view
 * GET /schedules/:planId/weekly?weekStart=YYYY-MM-DD
 */
const getWeeklySchedule = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const { weekStart } = req.query;
        
        const weeklyData = await scheduleService.getWeeklySchedule(planId, userId, weekStart);
        res.json(weeklyData);
    } catch (error) {
        securityLog('get_weekly_schedule_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválida')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrado') || 
                   error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar cronograma semanal'));
        }
    }
};

/**
 * Get monthly schedule overview
 * GET /schedules/:planId/monthly?year=2024&month=1
 */
const getMonthlySchedule = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const { year, month } = req.query;
        
        const monthlyData = await scheduleService.getMonthlySchedule(
            planId, 
            userId, 
            parseInt(year, 10), 
            parseInt(month, 10)
        );
        res.json(monthlyData);
    } catch (error) {
        securityLog('get_monthly_schedule_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrado') || 
                   error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar cronograma mensal'));
        }
    }
};

/**
 * Record study time for session
 * POST /schedules/sessions/:sessionId/time
 */
const recordStudyTime = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user.id;
        
        const result = await scheduleService.recordStudyTime(sessionId, userId, req.body);
        res.status(201).json(result);
    } catch (error) {
        securityLog('record_study_time_error', error.message, req.user.id, req);
        
        if (error.message.includes('obrigatório') || 
            error.message.includes('inválido') ||
            error.message.includes('muito longo')) {
            res.status(400).json({ error: error.message });
        } else if (error.message.includes('não encontrada') || 
                   error.message.includes('não autorizada')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao registrar tempo de estudo'));
        }
    }
};

/**
 * Get schedule templates
 * GET /schedules/templates
 */
const getScheduleTemplates = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const templates = await scheduleService.getScheduleTemplates(userId);
        res.json(templates);
    } catch (error) {
        securityLog('get_schedule_templates_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar modelos de cronograma'));
    }
};

/**
 * Get schedule overview (summary statistics)
 * GET /schedules/:planId/overview
 */
const getScheduleOverview = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        // Get both basic schedule and analytics for overview
        const [schedule, analytics] = await Promise.all([
            scheduleService.getSchedule(planId, userId),
            scheduleService.getScheduleAnalytics(planId, userId)
        ]);

        // Calculate overview statistics
        const allSessions = Object.values(schedule).flat();
        const todaysSessions = schedule[new Date().toISOString().split('T')[0]] || [];
        const overdueSessions = allSessions.filter(s => s.is_overdue);
        
        const overview = {
            total_sessions: analytics.total_sessions,
            completed_sessions: analytics.completed_sessions,
            pending_sessions: analytics.pending_sessions,
            completion_rate: analytics.completion_rate,
            total_time_formatted: analytics.total_time_formatted,
            productivity_score: analytics.productivity_score,
            study_streak: analytics.study_streak,
            
            // Today's data
            todays_sessions: todaysSessions.length,
            todays_completed: todaysSessions.filter(s => s.status === 'Concluído').length,
            
            // Alerts and insights
            overdue_sessions: overdueSessions.length,
            overdue_details: overdueSessions.slice(0, 5), // Show first 5 overdue
            
            // Weekly progress
            weekly_progress: analytics.weekly_goal_progress,
            
            // Session type breakdown
            session_types: analytics.session_types
        };

        res.json(overview);
    } catch (error) {
        securityLog('get_schedule_overview_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || 
            error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar resumo do cronograma'));
        }
    }
};

/**
 * Get schedule progress tracking
 * GET /schedules/:planId/progress?period=week|month
 */
const getScheduleProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const period = req.query.period || 'week';
        
        if (!['week', 'month'].includes(period)) {
            return res.status(400).json({ error: 'Período deve ser "week" ou "month"' });
        }

        let progressData;
        
        if (period === 'week') {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            progressData = await scheduleService.getWeeklySchedule(
                planId, 
                userId, 
                weekStart.toISOString().split('T')[0]
            );
        } else {
            const now = new Date();
            progressData = await scheduleService.getMonthlySchedule(
                planId, 
                userId, 
                now.getFullYear(), 
                now.getMonth() + 1
            );
        }

        res.json(progressData);
    } catch (error) {
        securityLog('get_schedule_progress_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || 
            error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar progresso do cronograma'));
        }
    }
};

/**
 * Export schedule data
 * GET /schedules/:planId/export?format=json|csv
 */
const exportSchedule = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const format = req.query.format || 'json';
        
        if (!['json', 'csv'].includes(format)) {
            return res.status(400).json({ error: 'Formato deve ser "json" ou "csv"' });
        }

        const schedule = await scheduleService.getSchedule(planId, userId);
        const allSessions = Object.values(schedule).flat();

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=cronograma_${planId}.json`);
            res.json({
                exported_at: new Date().toISOString(),
                plan_id: planId,
                total_sessions: allSessions.length,
                schedule: schedule
            });
        } else {
            // CSV format
            const csvHeader = 'Data,Matéria,Tópico,Tipo,Status,Tempo Estudado,Questões\n';
            const csvRows = allSessions.map(session => [
                session.session_date,
                `"${session.subject_name || ''}"`,
                `"${session.topic_description || ''}"`,
                `"${session.session_type || ''}"`,
                session.status,
                session.time_studied_seconds || 0,
                session.questions_solved || 0
            ].join(',')).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=cronograma_${planId}.csv`);
            res.send(csvHeader + csvRows);
        }

        securityLog('schedule_export', { planId, format, sessions_count: allSessions.length }, userId, req);
    } catch (error) {
        securityLog('export_schedule_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado') || 
            error.message.includes('não autorizado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao exportar cronograma'));
        }
    }
};

module.exports = {
    getSchedule,
    getScheduleByDateRange,
    getSession,
    createSession,
    updateSession,
    updateSessionStatus,
    batchUpdateStatus,
    deleteSession,
    createReinforcementSession,
    postponeSession,
    getScheduleAnalytics,
    getWeeklySchedule,
    getMonthlySchedule,
    recordStudyTime,
    getScheduleTemplates,
    getScheduleOverview,
    getScheduleProgress,
    exportSchedule
};