/**
 * Plan Repository - Data access layer for study plans
 * 
 * This repository handles all database interactions related to study plans,
 * providing a clean interface between the service layer and the database.
 * 
 * FASE 2: Migrado para usar DatabaseAdapter com suporte PostgreSQL/SQLite
 */

// Usar implementação simples PostgreSQL
const simpleDb = require('../../database-simple-postgres');
// Removido translateQuery, translateParams - não necessários com implementação simples
const { securityLog } = require('../utils/security');

// Cache da instância do banco
let dbInstance = null;

/**
 * Obter instância do banco de dados
 */
async function getDB() {
    if (!dbInstance) {
        dbInstance = simpleDb;
    }
    return dbInstance;
}

/**
 * Wrapper para queries com log e adaptação
 */
async function executeQuery(type, sql, params = [], logContext = '') {
    const db = await getDB();
    
    try {
        // Log detalhado para debug
        securityLog('plan_repository_query', {
            type,
            context: logContext,
            dialect: db.dialect,
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            paramCount: Array.isArray(params) ? params.length : 0
        });
        
        let result;
        
        if (type === 'get') {
            result = await db.get(sql, params);
        } else if (type === 'all') {
            result = await db.all(sql, params);
        } else if (type === 'run') {
            result = await db.run(sql, params);
        }
        
        return result;
        
    } catch (error) {
        securityLog('plan_repository_error', {
            type,
            context: logContext,
            error: error.message,
            dialect: db.dialect,
            sql: sql.substring(0, 50)
        });
        throw error;
    }
}

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
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM study_plans WHERE id = $1 AND user_id = $2'
        : 'SELECT * FROM study_plans WHERE id = ? AND user_id = ?';
    
    return await executeQuery('get', sql, [planId, userId], 'getPlanByIdAndUser');
};

/**
 * Get all study sessions for a plan
 */
const getStudySessions = async (planId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM study_sessions WHERE study_plan_id = $1 ORDER BY session_date'
        : 'SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY session_date';
    
    return await executeQuery('all', sql, [planId], 'getStudySessions');
};

/**
 * Get topics with their completion status
 * CORREÇÃO: Garantir sincronização com sessões concluídas
 */
const getTopicsWithStatus = async (planId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
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
        WHERE s.study_plan_id = $1
        ORDER BY s.priority_weight DESC, t.id ASC`
        : `SELECT 
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
        ORDER BY s.priority_weight DESC, t.id ASC`;
    
    return await executeQuery('all', sql, [planId], 'getTopicsWithStatus');
};

/**
 * Get subject progress details with time spent
 */
const getSubjectProgressDetails = async (planId) => {
    const db = await getDB();
    const query = db.isPostgreSQL 
        ? `SELECT
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
        WHERE s.study_plan_id = $1
        GROUP BY s.id, s.subject_name
        ORDER BY s.subject_name`
        : `SELECT
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
        ORDER BY s.subject_name`;

    const subjects = await executeQuery('all', query, [planId], 'getSubjectProgressDetails');

    // Get topics for each subject with time studied and completion status
    for (const subject of subjects) {
        const topicsSQL = db.isPostgreSQL 
            ? `SELECT
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
            WHERE t.subject_id = $1
            GROUP BY t.id, t.description
            ORDER BY t.id`
            : `SELECT
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
            ORDER BY t.id`;
        
        subject.topics = await executeQuery('all', topicsSQL, [subject.id], 'getSubjectProgressDetails_topics');
    }

    return subjects;
};

/**
 * Get total progress across all subjects
 * CORREÇÃO: Usar contagem DISTINCT para evitar duplicatas
 */
const getTotalProgress = async (planId) => {
    const db = await getDB();
    
    // CORREÇÃO: Usar método unificado com DISTINCT topic_id
    const completedSQL = db.isPostgreSQL 
        ? `SELECT COUNT(DISTINCT topic_id) as count 
        FROM study_sessions 
        WHERE study_plan_id = $1 AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL`
        : `SELECT COUNT(DISTINCT topic_id) as count 
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL`;
    
    const completedResult = await executeQuery('get', completedSQL, [planId], 'getTotalProgress_completed');
    
    const totalSQL = db.isPostgreSQL 
        ? `SELECT COUNT(t.id) as total
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE s.study_plan_id = $1`
        : `SELECT COUNT(t.id) as total
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        WHERE s.study_plan_id = ?`;
    
    const totalResult = await executeQuery('get', totalSQL, [planId], 'getTotalProgress_total');
    
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
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = $1 
        AND session_date::date = $2::date
        AND status = 'Concluído'
        AND questions_solved > 0`
        : `SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = ? 
        AND session_date::date = ?::date
        AND status = 'Concluído'
        AND questions_solved > 0`;
    
    const result = await executeQuery('get', sql, [planId, date], 'getDailyProgress');
    
    return result?.count || 0;
};

/**
 * Get weekly progress (questions answered this week)
 */
const getWeeklyProgress = async (planId, weekStart) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = $1 
        AND session_date::date >= $2::date
        AND status = 'Concluído'
        AND questions_solved > 0`
        : `SELECT SUM(questions_solved) as count
        FROM study_sessions
        WHERE study_plan_id = ? 
        AND session_date::date >= ?::date
        AND status = 'Concluído'
        AND questions_solved > 0`;
    
    const result = await executeQuery('get', sql, [planId, weekStart], 'getWeeklyProgress');
    
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
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            id,
            session_type,
            status,
            session_date,
            time_studied_seconds,
            questions_solved
        FROM study_sessions 
        WHERE study_plan_id = $1
        AND status = 'Concluído'
        AND session_date IS NOT NULL
        ORDER BY session_date DESC`
        : `SELECT 
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
        ORDER BY session_date DESC`;
    
    const result = await executeQuery('all', sql, [planId], 'getCompletedSessions');
    
    return result || [];
};

/**
 * Get topics where user has answered few questions (weak points)
 */
const getWeakTopics = async (planId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            t.description as topic_description,
            s.subject_name,
            COALESCE(SUM(ss.questions_solved), 0) as total_questions
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN study_sessions ss ON ss.topic_id = t.id AND ss.study_plan_id = s.study_plan_id
        WHERE s.study_plan_id = $1 AND t.status = 'Concluído'
        GROUP BY t.id, t.description, s.subject_name
        HAVING COALESCE(SUM(ss.questions_solved), 0) < 5
        ORDER BY total_questions ASC, s.subject_name, t.description`
        : `SELECT 
            t.description as topic_description,
            s.subject_name,
            COALESCE(SUM(ss.questions_solved), 0) as total_questions
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN study_sessions ss ON ss.topic_id = t.id AND ss.study_plan_id = s.study_plan_id
        WHERE s.study_plan_id = ? AND t.status = 'Concluído'
        GROUP BY t.id, t.description, s.subject_name
        HAVING total_questions < 5
        ORDER BY total_questions ASC, s.subject_name, t.description`;
    
    return await executeQuery('all', sql, [planId], 'getWeakTopics');
};

/**
 * Get overdue tasks
 */
const getOverdueTasks = async (planId) => {
    const today = getBrazilianDateString();
    
    const db = await getDB();
    const overdueSQL = db.isPostgreSQL 
        ? `SELECT 
            ss.session_type,
            ss.session_date,
            ss.topic_description,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = $1 
        AND ss.session_date::date < $2::date
        AND ss.status = 'Pendente'
        ORDER BY ss.session_date ASC`
        : `SELECT 
            ss.session_type,
            ss.session_date,
            ss.topic_description,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = ? 
        AND ss.session_date::date < ?::date
        AND ss.status = 'Pendente'
        ORDER BY ss.session_date ASC`;
    
    const overdueTasks = await executeQuery('all', overdueSQL, [planId, today], 'getOverdueTasks');
    
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
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            ss.session_type,
            ss.topic_description,
            ss.status,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = $1 
        AND ss.session_date::date = $2::date
        ORDER BY ss.session_type, s.subject_name`
        : `SELECT 
            ss.session_type,
            ss.topic_description,
            ss.status,
            s.subject_name
        FROM study_sessions ss
        LEFT JOIN topics t ON ss.topic_id = t.id
        LEFT JOIN subjects s ON t.subject_id = s.id
        WHERE ss.study_plan_id = ? 
        AND ss.session_date::date = ?::date
        ORDER BY ss.session_type, s.subject_name`;
    
    return await executeQuery('all', sql, [planId, date], 'getActivitySummaryByDate');
};

/**
 * Get subjects for a plan
 */
const getSubjects = async (planId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            s.*,
            COUNT(t.id) as topic_count,
            COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) as completed_topics
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        WHERE s.study_plan_id = $1
        GROUP BY s.id, s.subject_name, s.priority_weight, s.study_plan_id, s.created_at, s.updated_at
        ORDER BY s.subject_name`
        : `SELECT 
            s.*,
            COUNT(t.id) as topic_count,
            COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) as completed_topics
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        WHERE s.study_plan_id = ?
        GROUP BY s.id
        ORDER BY s.subject_name`;
    
    return await executeQuery('all', sql, [planId], 'getSubjects');
};

/**
 * Get user stats for gamification
 */
const getUserStats = async (planId, userId) => {
    // Get completed topics count
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT COUNT(DISTINCT t.id) as completed_topics
        FROM topics t 
        JOIN subjects s ON t.subject_id = s.id 
        WHERE s.study_plan_id = $1 AND t.status = 'Concluído'`
        : `SELECT COUNT(DISTINCT t.id) as completed_topics
        FROM topics t 
        JOIN subjects s ON t.subject_id = s.id 
        WHERE s.study_plan_id = ? AND t.status = 'Concluído'`;
    
    const completedTopicsResult = await executeQuery('get', sql, [planId], 'getUserStats');
    
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