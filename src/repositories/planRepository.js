/**
 * Plan Repository - Data access layer for study plans
 * 
 * This repository handles all database interactions related to study plans,
 * providing a clean interface between the service layer and the database.
 */

const { dbGet, dbAll } = require('../utils/database');

// Função para obter data brasileira
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get plan by ID and verify user ownership
 */
const getPlanByIdAndUser = async (planId, userId) => {
    return await dbGet(
        'SELECT * FROM study_plans WHERE id = ? AND user_id = ?', 
        [planId, userId]
    );
};

/**
 * Get all study sessions for a plan
 */
const getStudySessions = async (planId) => {
    return await dbAll(
        'SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY session_date',
        [planId]
    );
};

/**
 * Get topics with their completion status
 * CORREÇÃO: Garantir sincronização com sessões concluídas
 */
const getTopicsWithStatus = async (planId) => {
    return await dbAll(`
        SELECT 
            t.*,
            s.subject_name,
            s.priority_weight as priority,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM study_sessions ss 
                    WHERE ss.topic_id = t.id 
                    AND ss.session_type = 'Novo Tópico' 
                    AND ss.status = 'Concluído'
                ) THEN 'Concluído'
                ELSE COALESCE(t.status, 'Pendente')
            END as status
        FROM topics t 
        JOIN subjects s ON t.subject_id = s.id 
        WHERE s.study_plan_id = ?
        ORDER BY s.priority_weight DESC, t.id ASC
    `, [planId]);
};

/**
 * Get subject progress details with time spent
 */
const getSubjectProgressDetails = async (planId) => {
    const query = `
        SELECT
            s.id,
            s.subject_name as name,
            COUNT(t.id) as totalTopics,
            COUNT(
                CASE WHEN EXISTS (
                    SELECT 1 FROM study_sessions ss
                    WHERE ss.topic_id = t.id
                    AND ss.session_type = 'Novo Tópico'
                    AND ss.status = 'Concluído'
                ) THEN 1 END
            ) as completedTopics,
            (
                SELECT COALESCE(SUM(ss.time_studied_seconds), 0)
                FROM study_sessions ss
                LEFT JOIN topics tt ON ss.topic_id = tt.id
                WHERE ss.study_plan_id = s.study_plan_id
                AND ss.status = 'Concluído'
                AND (
                    tt.subject_id = s.id
                    OR (ss.topic_id IS NULL AND ss.subject_name = s.subject_name)
                )
            ) as totalTime,
            CASE
                WHEN COUNT(t.id) > 0
                THEN ROUND((
                    COUNT(
                        CASE WHEN EXISTS (
                            SELECT 1 FROM study_sessions ss
                            WHERE ss.topic_id = t.id
                            AND ss.session_type = 'Novo Tópico'
                            AND ss.status = 'Concluído'
                        ) THEN 1 END
                    ) * 100.0
                ) / COUNT(t.id), 1)
                ELSE 0
            END as progress
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        WHERE s.study_plan_id = ?
        GROUP BY s.id, s.subject_name
        ORDER BY s.subject_name
    `;

    const subjects = await dbAll(query, [planId]);

    // Get topics for each subject with time studied and completion status
    for (const subject of subjects) {
        subject.topics = await dbAll(`
            SELECT
                t.id,
                t.description as description,
                COALESCE(SUM(ss.time_studied_seconds), 0) as timeStudied,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM study_sessions ss2
                        WHERE ss2.topic_id = t.id 
                        AND ss2.session_type = 'Novo Tópico'
                        AND ss2.status = 'Concluído'
                    ) THEN 1
                    ELSE 0
                END as isCompleted
            FROM topics t
            LEFT JOIN study_sessions ss ON ss.topic_id = t.id AND ss.status = 'Concluído'
            WHERE t.subject_id = ?
            GROUP BY t.id, t.description
            ORDER BY t.id
        `, [subject.id]);
    }

    return subjects;
};

/**
 * Get total progress across all subjects
 * CORREÇÃO: Usar contagem DISTINCT para evitar duplicatas
 */
const getTotalProgress = async (planId) => {
    // CORREÇÃO: Usar método unificado com DISTINCT topic_id
    const completedResult = await dbGet(`
        SELECT COUNT(DISTINCT topic_id) as count 
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
    `, [planId]);
    
    const totalResult = await dbGet(`
        SELECT COUNT(t.id) as total
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE s.study_plan_id = ?
    `, [planId]);
    
    const total = totalResult.total || 0;
    const completed = completedResult.count || 0;
    
    // CORREÇÃO: Log para debug
    console.log(`📊 [TOTAL_PROGRESS] Plano ${planId}: ${completed}/${total} tópicos`);
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
};

/**
 * Get daily progress (questions answered today)
 */
const getDailyProgress = async (planId, date) => {
    const result = await dbGet(`
        SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = ? 
        AND DATE(session_date) = DATE(?)
        AND status = 'Concluído'
        AND questions_solved > 0
    `, [planId, date]);
    
    return result?.count || 0;
};

/**
 * Get weekly progress (questions answered this week)
 */
const getWeeklyProgress = async (planId, weekStart) => {
    const result = await dbGet(`
        SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = ? 
        AND DATE(session_date) >= DATE(?)
        AND status = 'Concluído'
        AND questions_solved > 0
    `, [planId, weekStart]);
    
    return result?.count || 0;
};

/**
 * Get gamification stats for user
 */
const getGamificationStats = async (planId, userId) => {
    // This would connect to a gamification table
    // For now, return default values
    return {
        level: 1,
        xp: 0,
        streak: 0,
        badges: [],
        weeklyGoals: {}
    };
};

/**
 * Get completed sessions for gamification tracking
 */
const getCompletedSessions = async (planId) => {
    const result = await dbAll(`
        SELECT 
            id,
            session_type,
            status,
            session_date,
            time_studied_seconds,
            questions_solved
        FROM study_sessions 
        WHERE study_plan_id = ?
        AND status = 'Concluído'
        AND session_date IS NOT NULL
        ORDER BY session_date DESC
    `, [planId]);
    
    return result || [];
};

/**
 * Get topics where user has answered few questions (weak points)
 */
const getWeakTopics = async (planId) => {
    return await dbAll(`
        SELECT 
            t.description as topic_description,
            s.subject_name,
            COALESCE(SUM(ss.questions_solved), 0) as total_questions
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN study_sessions ss ON ss.topic_id = t.id AND ss.study_plan_id = s.study_plan_id
        WHERE s.study_plan_id = ? AND t.status = 'Concluído'
        GROUP BY t.id, t.description, s.subject_name
        HAVING total_questions < 5
        ORDER BY total_questions ASC, s.subject_name, t.description
    `, [planId]);
};

/**
 * Get overdue tasks
 */
const getOverdueTasks = async (planId) => {
    const today = getBrazilianDateString();
    
    const overdueTasks = await dbAll(`
        SELECT 
            ss.session_type,
            ss.session_date,
            ss.topic_description,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = ? 
        AND DATE(ss.session_date) < DATE(?)
        AND ss.status = 'Pendente'
        ORDER BY ss.session_date ASC
    `, [planId, today]);
    
    // Return object with count for frontend compatibility
    return {
        count: overdueTasks.length,
        tasks: overdueTasks
    };
};

/**
 * Get activity summary for a specific date
 */
const getActivitySummaryByDate = async (planId, date) => {
    return await dbAll(`
        SELECT 
            ss.session_type,
            ss.topic_description,
            ss.status,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = ? 
        AND DATE(ss.session_date) = DATE(?)
        ORDER BY ss.session_type, s.subject_name
    `, [planId, date]);
};

/**
 * Get subjects for a plan
 */
const getSubjects = async (planId) => {
    return await dbAll(`
        SELECT 
            s.*,
            COUNT(t.id) as topic_count,
            COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) as completed_topics
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        WHERE s.study_plan_id = ?
        GROUP BY s.id
        ORDER BY s.subject_name
    `, [planId]);
};

/**
 * Get user stats for gamification
 */
const getUserStats = async (planId, userId) => {
    // Get completed topics count
    const completedTopicsResult = await dbGet(`
        SELECT COUNT(DISTINCT t.id) as completed_topics
        FROM topics t 
        JOIN subjects s ON t.subject_id = s.id 
        WHERE s.study_plan_id = ? AND t.status = 'Concluído'
    `, [planId]);
    
    const completedTopics = completedTopicsResult.completed_topics || 0;
    
    // Basic achievements based on progress
    const achievements = [];
    if (completedTopics >= 1) achievements.push('Primeiro Tópico 🎯');
    if (completedTopics >= 10) achievements.push('Dezena Completa 🔢');
    if (completedTopics >= 25) achievements.push('Quarto do Caminho 📊');
    if (completedTopics >= 50) achievements.push('Meio Século 🏅');
    if (completedTopics >= 100) achievements.push('Centenário 💯');
    
    return {
        completedTopics,
        achievements
    };
};

module.exports = {
    getPlanByIdAndUser,
    getStudySessions,
    getTopicsWithStatus,
    getSubjectProgressDetails,
    getTotalProgress,
    getDailyProgress,
    getWeeklyProgress,
    getGamificationStats,
    getCompletedSessions,
    getWeakTopics,
    getOverdueTasks,
    getActivitySummaryByDate,
    getSubjects,
    getUserStats
};