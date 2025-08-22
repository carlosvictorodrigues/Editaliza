/**
 * Schedule Service - Business logic for study schedules and sessions
 * 
 * This service contains all the complex business logic for schedule management,
 * session tracking, time management, and schedule analytics.
 */

const scheduleRepository = require('../repositories/scheduleRepository');
const { sanitizeHtml } = require('../utils/sanitizer');

/**
 * Get complete schedule for a plan
 */
const getSchedule = async (planId, userId) => {
    if (!planId || !userId) {
        throw new Error('Plan ID e User ID são obrigatórios');
    }

    const schedule = await scheduleRepository.getScheduleGroupedByDate(planId, userId);
    
    // Add computed fields and sanitize data
    const sanitizedSchedule = {};
    for (const [date, sessions] of Object.entries(schedule)) {
        sanitizedSchedule[date] = sessions.map(session => ({
            ...session,
            topic_description: sanitizeHtml(session.topic_description || ''),
            subject_name: sanitizeHtml(session.subject_name || ''),
            notes: sanitizeHtml(session.notes || ''),
            session_type: sanitizeHtml(session.session_type || ''),
            // Add computed fields
            is_overdue: new Date(session.session_date) < new Date() && session.status === 'Pendente',
            duration_formatted: formatDuration(session.time_studied_seconds || 0),
            can_postpone: (session.postpone_count || 0) < 3
        }));
    }

    return sanitizedSchedule;
};

/**
 * Get schedule within date range
 */
const getScheduleByDateRange = async (planId, userId, startDate, endDate) => {
    if (!planId || !userId || !startDate || !endDate) {
        throw new Error('Todos os parâmetros são obrigatórios');
    }

    // Validate date format
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error('Formato de data inválido. Use YYYY-MM-DD');
    }

    if (new Date(startDate) > new Date(endDate)) {
        throw new Error('Data inicial deve ser anterior à data final');
    }

    const sessions = await scheduleRepository.getScheduleByDateRange(planId, userId, startDate, endDate);
    
    return sessions.map(session => ({
        ...session,
        topic_description: sanitizeHtml(session.topic_description || ''),
        subject_name: sanitizeHtml(session.subject_name || ''),
        notes: sanitizeHtml(session.notes || ''),
        is_overdue: new Date(session.session_date) < new Date() && session.status === 'Pendente',
        duration_formatted: formatDuration(session.time_studied_seconds || 0)
    }));
};

/**
 * Get single session with enhanced data
 */
const getSession = async (sessionId, userId) => {
    if (!sessionId || !userId) {
        throw new Error('Session ID e User ID são obrigatórios');
    }

    const session = await scheduleRepository.getSessionById(sessionId, userId);
    if (!session) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    // Get time logs for this session
    const timeLogs = await scheduleRepository.getSessionTimeLogs(sessionId, userId);

    return {
        ...session,
        topic_description: sanitizeHtml(session.topic_description || ''),
        subject_name: sanitizeHtml(session.subject_name || ''),
        notes: sanitizeHtml(session.notes || ''),
        is_overdue: new Date(session.session_date) < new Date() && session.status === 'Pendente',
        duration_formatted: formatDuration(session.time_studied_seconds || 0),
        can_postpone: (session.postpone_count || 0) < 3,
        time_logs: timeLogs,
        time_logs_count: timeLogs.length
    };
};

/**
 * Create new study session
 */
const createSession = async (sessionData, userId) => {
    if (!sessionData || !userId) {
        throw new Error('Dados da sessão e User ID são obrigatórios');
    }

    // Validate required fields
    const requiredFields = ['study_plan_id', 'session_date'];
    for (const field of requiredFields) {
        if (!sessionData[field]) {
            throw new Error(`Campo obrigatório: ${field}`);
        }
    }

    // Validate date format
    if (!isValidDate(sessionData.session_date)) {
        throw new Error('Formato de data inválido. Use YYYY-MM-DD');
    }

    // Sanitize input data
    const sanitizedData = {
        ...sessionData,
        subject_name: sanitizeHtml(sessionData.subject_name || ''),
        topic_description: sanitizeHtml(sessionData.topic_description || ''),
        notes: sanitizeHtml(sessionData.notes || ''),
        session_type: sanitizeHtml(sessionData.session_type || 'Novo Tópico'),
        status: sessionData.status || 'Pendente'
    };

    // Validate session type
    const validSessionTypes = [
        'Novo Tópico', 'Revisão', 'Simulado Completo', 'Simulado Direcionado', 
        'Reforço', 'Questões', 'Redação'
    ];
    
    if (!validSessionTypes.includes(sanitizedData.session_type)) {
        throw new Error('Tipo de sessão inválido');
    }

    const sessionId = await scheduleRepository.createSession(sanitizedData, userId);
    return { id: sessionId, message: 'Sessão criada com sucesso' };
};

/**
 * Update study session
 */
const updateSession = async (sessionId, updateData, userId) => {
    if (!sessionId || !updateData || !userId) {
        throw new Error('Session ID, dados de atualização e User ID são obrigatórios');
    }

    // Sanitize input data
    const sanitizedData = {};
    
    if (updateData.subject_name !== undefined) {
        sanitizedData.subject_name = sanitizeHtml(updateData.subject_name);
    }
    
    if (updateData.topic_description !== undefined) {
        sanitizedData.topic_description = sanitizeHtml(updateData.topic_description);
    }
    
    if (updateData.notes !== undefined) {
        sanitizedData.notes = sanitizeHtml(updateData.notes);
    }
    
    if (updateData.session_date !== undefined) {
        if (!isValidDate(updateData.session_date)) {
            throw new Error('Formato de data inválido. Use YYYY-MM-DD');
        }
        sanitizedData.session_date = updateData.session_date;
    }
    
    if (updateData.session_type !== undefined) {
        const validSessionTypes = [
            'Novo Tópico', 'Revisão', 'Simulado Completo', 'Simulado Direcionado', 
            'Reforço', 'Questões', 'Redação'
        ];
        
        if (!validSessionTypes.includes(updateData.session_type)) {
            throw new Error('Tipo de sessão inválido');
        }
        sanitizedData.session_type = updateData.session_type;
    }
    
    if (updateData.status !== undefined) {
        if (!['Pendente', 'Concluído'].includes(updateData.status)) {
            throw new Error('Status inválido');
        }
        sanitizedData.status = updateData.status;
    }

    // Copy numeric fields directly
    const numericFields = ['questions_solved', 'time_studied_seconds'];
    for (const field of numericFields) {
        if (updateData[field] !== undefined) {
            const value = parseInt(updateData[field], 10);
            if (!isNaN(value) && value >= 0) {
                sanitizedData[field] = value;
            }
        }
    }

    await scheduleRepository.updateSession(sessionId, sanitizedData, userId);
    return { message: 'Sessão atualizada com sucesso' };
};

/**
 * Update session status with topic completion handling
 * CORREÇÃO: Invalidar cache de métricas após atualização
 */
const updateSessionStatus = async (sessionId, status, userId) => {
    if (!sessionId || !status || !userId) {
        throw new Error('Session ID, status e User ID são obrigatórios');
    }

    if (!['Pendente', 'Concluído'].includes(status)) {
        throw new Error('Status inválido');
    }

    // Obter detalhes da sessão antes da atualização
    const sessionDetails = await scheduleRepository.getSessionById(sessionId, userId);
    
    await scheduleRepository.updateSessionStatus(sessionId, status, userId);
    
    // CORREÇÃO: Invalidar cache de métricas
    if (sessionDetails && sessionDetails.study_plan_id) {
        const planId = sessionDetails.study_plan_id;
        if (global.planCache) {
            delete global.planCache[`${planId}_schedule_preview`];
            delete global.planCache[`${planId}_progress`];
            delete global.planCache[`${planId}_realitycheck`];
        }
    }
    
    const statusMessage = status === 'Concluído' 
        ? 'Parabéns! Sessão marcada como concluída.' 
        : 'Sessão marcada como pendente.';
    
    return { message: statusMessage };
};

/**
 * Batch update session statuses
 * CORREÇÃO: Invalidar cache de métricas após atualização
 */
const batchUpdateStatus = async (sessions, userId) => {
    if (!sessions || !Array.isArray(sessions) || !userId) {
        throw new Error('Lista de sessões e User ID são obrigatórios');
    }

    if (sessions.length === 0) {
        throw new Error('Lista de sessões não pode estar vazia');
    }

    // Validate each session
    for (const session of sessions) {
        if (!session.id || !session.status) {
            throw new Error('Cada sessão deve ter ID e status');
        }
        
        if (!['Pendente', 'Concluído'].includes(session.status)) {
            throw new Error(`Status inválido: ${session.status}`);
        }
    }

    await scheduleRepository.batchUpdateSessionStatus(sessions, userId);
    
    // CORREÇÃO: Invalidar cache de métricas para forçar atualização
    // Identificar planos afetados
    const affectedPlans = new Set();
    for (const session of sessions) {
        try {
            const sessionDetails = await scheduleRepository.getSessionById(session.id, userId);
            if (sessionDetails && sessionDetails.study_plan_id) {
                affectedPlans.add(sessionDetails.study_plan_id);
            }
        } catch (error) {
            // Ignorar sessões não encontradas durante invalidação de cache
            console.warn(`Sessão ${session.id} não encontrada para invalidação de cache`);
        }
    }
    
    // Invalidar cache para cada plano afetado
    for (const planId of affectedPlans) {
        if (global.planCache) {
            delete global.planCache[`${planId}_schedule_preview`];
            delete global.planCache[`${planId}_progress`];
            delete global.planCache[`${planId}_realitycheck`];
        }
    }
    
    return { message: 'Sessões atualizadas com sucesso' };
};

/**
 * Delete study session
 */
const deleteSession = async (sessionId, userId) => {
    if (!sessionId || !userId) {
        throw new Error('Session ID e User ID são obrigatórios');
    }

    await scheduleRepository.deleteSession(sessionId, userId);
    return { message: 'Sessão removida com sucesso' };
};

/**
 * Create reinforcement session
 */
const createReinforcementSession = async (originalSessionId, userId) => {
    if (!originalSessionId || !userId) {
        throw new Error('Session ID original e User ID são obrigatórios');
    }

    const newSessionId = await scheduleRepository.createReinforcementSession(originalSessionId, userId);
    return { 
        id: newSessionId, 
        message: 'Sessão de reforço agendada com sucesso' 
    };
};

/**
 * Postpone session
 */
const postponeSession = async (sessionId, userId, postponementData = {}) => {
    if (!sessionId || !userId) {
        throw new Error('Session ID e User ID são obrigatórios');
    }

    if (postponementData.newDate && !isValidDate(postponementData.newDate)) {
        throw new Error('Formato de data inválido. Use YYYY-MM-DD');
    }

    const result = await scheduleRepository.postponeSession(sessionId, userId, postponementData);
    return {
        ...result,
        message: `Sessão adiada para ${result.newDate}. Total de adiamentos: ${result.postponeCount}`
    };
};

/**
 * Get schedule statistics and analytics
 */
const getScheduleAnalytics = async (planId, userId) => {
    if (!planId || !userId) {
        throw new Error('Plan ID e User ID são obrigatórios');
    }

    const stats = await scheduleRepository.getScheduleStatistics(planId, userId);
    
    // Add computed analytics
    const analytics = {
        ...stats,
        completion_rate: stats.completion_rate,
        total_time_formatted: formatDuration(stats.total_time_seconds || 0),
        avg_time_formatted: formatDuration(stats.avg_time_per_session || 0),
        productivity_score: calculateProductivityScore(stats),
        study_streak: await calculateStudyStreak(planId, userId),
        weekly_goal_progress: await calculateWeeklyProgress(planId, userId)
    };

    return analytics;
};

/**
 * Get weekly schedule view
 */
const getWeeklySchedule = async (planId, userId, weekStart) => {
    if (!planId || !userId || !weekStart) {
        throw new Error('Plan ID, User ID e data inicial da semana são obrigatórios');
    }

    const weekStartDate = new Date(weekStart);
    if (isNaN(weekStartDate.getTime())) {
        throw new Error('Data inicial da semana inválida');
    }

    const weeklyData = await scheduleRepository.getWeeklySchedule(planId, userId, weekStartDate);
    
    // Add weekly statistics
    const weeklyStats = {
        total_sessions: 0,
        completed_sessions: 0,
        total_time: 0,
        days_with_sessions: 0
    };

    const enhancedWeekly = {};
    
    for (const [date, sessions] of Object.entries(weeklyData)) {
        enhancedWeekly[date] = sessions.map(session => ({
            ...session,
            topic_description: sanitizeHtml(session.topic_description || ''),
            subject_name: sanitizeHtml(session.subject_name || ''),
            duration_formatted: formatDuration(session.time_studied_seconds || 0)
        }));

        weeklyStats.total_sessions += sessions.length;
        weeklyStats.completed_sessions += sessions.filter(s => s.status === 'Concluído').length;
        weeklyStats.total_time += sessions.reduce((sum, s) => sum + (s.time_studied_seconds || 0), 0);
        
        if (sessions.length > 0) {
            weeklyStats.days_with_sessions++;
        }
    }

    return {
        schedule: enhancedWeekly,
        statistics: {
            ...weeklyStats,
            total_time_formatted: formatDuration(weeklyStats.total_time),
            completion_rate: weeklyStats.total_sessions > 0 
                ? Math.round((weeklyStats.completed_sessions / weeklyStats.total_sessions) * 100) 
                : 0
        }
    };
};

/**
 * Get monthly schedule overview
 */
const getMonthlySchedule = async (planId, userId, year, month) => {
    if (!planId || !userId || !year || !month) {
        throw new Error('Todos os parâmetros são obrigatórios');
    }

    if (year < 2020 || year > 2030) {
        throw new Error('Ano inválido');
    }

    if (month < 1 || month > 12) {
        throw new Error('Mês inválido');
    }

    const monthlyData = await scheduleRepository.getMonthlySchedule(planId, userId, year, month);
    
    return {
        ...monthlyData,
        total_time_formatted: formatDuration(monthlyData.total_time),
        completion_rate: monthlyData.total_sessions > 0 
            ? Math.round((monthlyData.completed_sessions / monthlyData.total_sessions) * 100) 
            : 0,
        avg_sessions_per_day: monthlyData.total_sessions > 0 
            ? Math.round(monthlyData.total_sessions / new Date(year, month, 0).getDate() * 100) / 100
            : 0
    };
};

/**
 * Record study time for a session
 */
const recordStudyTime = async (sessionId, userId, timeData) => {
    if (!sessionId || !userId || !timeData) {
        throw new Error('Session ID, User ID e dados de tempo são obrigatórios');
    }

    // Validate time data
    if (!timeData.start_time || !timeData.end_time) {
        throw new Error('Hora de início e fim são obrigatórias');
    }

    const startTime = new Date(timeData.start_time);
    const endTime = new Date(timeData.end_time);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Formato de data/hora inválido');
    }

    if (startTime >= endTime) {
        throw new Error('Hora de fim deve ser posterior à hora de início');
    }

    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    // Validate reasonable study time (max 8 hours per session)
    if (durationSeconds > 8 * 60 * 60) {
        throw new Error('Tempo de estudo muito longo (máximo 8 horas por sessão)');
    }

    const timeLogData = {
        start_time: timeData.start_time,
        end_time: timeData.end_time,
        duration_seconds: durationSeconds
    };

    const timeLogId = await scheduleRepository.createTimeLog(sessionId, userId, timeLogData);
    
    return {
        id: timeLogId,
        duration_seconds: durationSeconds,
        duration_formatted: formatDuration(durationSeconds),
        message: 'Tempo de estudo registrado com sucesso'
    };
};

/**
 * Get schedule templates/suggestions
 */
const getScheduleTemplates = async (userId) => {
    // This could be enhanced with ML/AI recommendations based on user patterns
    const templates = [
        {
            name: 'Cronograma Intensivo',
            description: 'Para quem tem pouco tempo e precisa de máxima eficiência',
            sessions_per_day: 3,
            session_duration: 90,
            review_frequency: 7
        },
        {
            name: 'Cronograma Equilibrado',
            description: 'Balanço entre estudo e outras atividades',
            sessions_per_day: 2,
            session_duration: 120,
            review_frequency: 14
        },
        {
            name: 'Cronograma Flexível',
            description: 'Para quem precisa de flexibilidade nos horários',
            sessions_per_day: 1,
            session_duration: 180,
            review_frequency: 21
        }
    ];

    return templates;
};

// =====================================
// HELPER FUNCTIONS
// =====================================

/**
 * Validate date format (YYYY-MM-DD)
 */
const isValidDate = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

/**
 * Format duration in seconds to human readable format
 */
const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0 min';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }
    
    return `${minutes}min`;
};

/**
 * Calculate productivity score based on statistics
 */
const calculateProductivityScore = (stats) => {
    if (!stats.total_sessions) return 0;
    
    const completionWeight = 0.4;
    const consistencyWeight = 0.3;
    const timeWeight = 0.3;
    
    const completionScore = stats.completion_rate;
    const consistencyScore = Math.min(100, (stats.total_sessions / 30) * 100); // Sessions per month
    const timeScore = Math.min(100, ((stats.avg_time_per_session || 0) / 7200) * 100); // Target 2h per session
    
    return Math.round(
        completionScore * completionWeight +
        consistencyScore * consistencyWeight +
        timeScore * timeWeight
    );
};

/**
 * Calculate study streak (consecutive days with completed sessions)
 */
const calculateStudyStreak = async (planId, userId) => {
    // Simplified implementation - could be enhanced
    const recentSessions = await scheduleRepository.getScheduleByDateRange(
        planId, 
        userId, 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
    );

    const sessionsByDate = recentSessions.reduce((acc, session) => {
        if (session.status === 'Concluído') {
            acc[session.session_date] = true;
        }
        return acc;
    }, {});

    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (sessionsByDate[dateStr]) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
};

/**
 * Calculate weekly progress towards goals
 */
const calculateWeeklyProgress = async (planId, userId) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week
    
    const weeklyData = await scheduleRepository.getWeeklySchedule(planId, userId, weekStart);
    
    let completedSessions = 0;
    let totalTime = 0;
    
    Object.values(weeklyData).forEach(sessions => {
        completedSessions += sessions.filter(s => s.status === 'Concluído').length;
        totalTime += sessions.reduce((sum, s) => sum + (s.time_studied_seconds || 0), 0);
    });

    // These targets could come from user preferences
    const weeklyTargets = {
        sessions: 14, // 2 sessions per day
        time: 14 * 60 * 60 // 14 hours per week
    };

    return {
        sessions: {
            completed: completedSessions,
            target: weeklyTargets.sessions,
            progress: Math.round((completedSessions / weeklyTargets.sessions) * 100)
        },
        time: {
            completed: totalTime,
            target: weeklyTargets.time,
            progress: Math.round((totalTime / weeklyTargets.time) * 100),
            completed_formatted: formatDuration(totalTime),
            target_formatted: formatDuration(weeklyTargets.time)
        }
    };
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
    getScheduleTemplates
};