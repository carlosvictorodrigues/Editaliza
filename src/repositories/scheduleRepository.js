/**
 * Schedule Repository - Data access layer for schedules and study sessions
 * 
 * This repository handles all database operations related to study schedules,
 * sessions, time tracking, and schedule analytics.
 * 
 * FASE 2: Migrado para usar DatabaseAdapter com suporte PostgreSQL/SQLite
 */

// Usar implementação simples PostgreSQL
const simpleDb = require('../../database-simple-postgres');
// Removido translateQuery, translateParams, validateTableName - não necessários com implementação simples
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
        securityLog('schedule_repository_query', {
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
        securityLog('schedule_repository_error', {
            type,
            context: logContext,
            error: error.message,
            dialect: db.dialect,
            sql: sql.substring(0, 50)
        });
        throw error;
    }
}

/**
 * Get schedule (study sessions) for a specific plan
 */
const getScheduleByPlan = async (planId, userId) => {
    const db = await getDB();
    
    const planSQL = db.isPostgreSQL 
        ? 'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2'
        : 'SELECT id FROM study_plans WHERE id = ? AND user_id = ?';
    
    const plan = await executeQuery('get', planSQL, [planId, userId], 'getScheduleByPlan_verify');
    
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const sessionsSQL = db.isPostgreSQL 
        ? `SELECT * FROM study_sessions 
        WHERE study_plan_id = $1 
        ORDER BY session_date ASC, id ASC`
        : `SELECT * FROM study_sessions 
        WHERE study_plan_id = ? 
        ORDER BY session_date ASC, id ASC`;

    return await executeQuery('all', sessionsSQL, [planId], 'getScheduleByPlan_sessions');
};

/**
 * Get schedule grouped by date for calendar view
 */
const getScheduleGroupedByDate = async (planId, userId) => {
    const sessions = await getScheduleByPlan(planId, userId);
    
    const groupedByDate = sessions.reduce((acc, session) => {
        const date = session.session_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(session);
        return acc;
    }, {});

    return groupedByDate;
};

/**
 * Get schedule within date range
 */
const getScheduleByDateRange = async (planId, userId, startDate, endDate) => {
    const db = await getDB();
    
    const planSQL = db.isPostgreSQL 
        ? 'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2'
        : 'SELECT id FROM study_plans WHERE id = ? AND user_id = ?';
    
    const plan = await executeQuery('get', planSQL, [planId, userId], 'getScheduleByDateRange_verify');
    
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const sessionsSQL = db.isPostgreSQL 
        ? `SELECT * FROM study_sessions 
        WHERE study_plan_id = $1 
        AND session_date >= $2 
        AND session_date <= $3
        ORDER BY session_date ASC, id ASC`
        : `SELECT * FROM study_sessions 
        WHERE study_plan_id = ? 
        AND session_date >= ? 
        AND session_date <= ?
        ORDER BY session_date ASC, id ASC`;

    return await executeQuery('all', sessionsSQL, [planId, startDate, endDate], 'getScheduleByDateRange_sessions');
};

/**
 * Get single study session by ID
 */
const getSessionById = async (sessionId, userId) => {
    const db = await getDB();
    
    const sql = db.isPostgreSQL 
        ? `SELECT
            ss.*,
            s.subject_name,
            t.description AS topic_description
        FROM
            study_sessions ss
        JOIN
            topics t ON ss.topic_id = t.id
        JOIN
            subjects s ON t.subject_id = s.id
        JOIN
            study_plans sp ON ss.study_plan_id = sp.id
        WHERE
            ss.id = $1 AND sp.user_id = $2`
        : `SELECT
            ss.*,
            s.subject_name,
            t.description AS topic_description
        FROM
            study_sessions ss
        JOIN
            topics t ON ss.topic_id = t.id
        JOIN
            subjects s ON t.subject_id = s.id
        JOIN
            study_plans sp ON ss.study_plan_id = sp.id
        WHERE
            ss.id = ? AND sp.user_id = ?`;

    return await executeQuery('get', sql, [sessionId, userId], 'getSessionById');
};

/**
 * Get multiple sessions by IDs
 */
const getSessionsByIds = async (sessionIds, userId) => {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
        return [];
    }

    const db = await getDB();
    let sql, params;
    
    if (db.isPostgreSQL) {
        const placeholders = sessionIds.map((_, index) => `$${index + 1}`).join(',');
        sql = `SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id IN (${placeholders}) AND sp.user_id = $${sessionIds.length + 1}`;
        params = [...sessionIds, userId];
    } else {
        const placeholders = sessionIds.map(() => '?').join(',');
        sql = `SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id IN (${placeholders}) AND sp.user_id = ?`;
        params = [...sessionIds, userId];
    }

    return await executeQuery('all', sql, params, 'getSessionsByIds');
};

/**
 * Create a new study session
 */
const createSession = async (sessionData, userId) => {
    const db = await getDB();
    
    // Verify plan ownership
    const planSQL = db.isPostgreSQL 
        ? 'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2'
        : 'SELECT id FROM study_plans WHERE id = ? AND user_id = ?';
    
    const plan = await executeQuery('get', planSQL, [sessionData.study_plan_id, userId], 'createSession_verify');
    
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    let sql, result;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes, questions_solved, time_studied_seconds, postpone_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`;
        
        result = await executeQuery('run', sql, [
            sessionData.study_plan_id,
            sessionData.topic_id || null,
            sessionData.subject_name || '',
            sessionData.topic_description || '',
            sessionData.session_date,
            sessionData.session_type || 'Novo Tópico',
            sessionData.status || 'Pendente',
            sessionData.notes || '',
            sessionData.questions_solved || 0,
            sessionData.time_studied_seconds || 0,
            sessionData.postpone_count || 0
        ], 'createSession');
        
        return result?.rows?.[0]?.id || result?.id;
    } else {
        sql = `INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes, questions_solved, time_studied_seconds, postpone_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        result = await executeQuery('run', sql, [
            sessionData.study_plan_id,
            sessionData.topic_id || null,
            sessionData.subject_name || '',
            sessionData.topic_description || '',
            sessionData.session_date,
            sessionData.session_type || 'Novo Tópico',
            sessionData.status || 'Pendente',
            sessionData.notes || '',
            sessionData.questions_solved || 0,
            sessionData.time_studied_seconds || 0,
            sessionData.postpone_count || 0
        ], 'createSession');
        
        return result.lastID;
    }
};

/**
 * Update study session
 */
const updateSession = async (sessionId, updateData, userId) => {
    const db = await getDB();
    
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
        'subject_name', 'topic_description', 'session_date', 'session_type',
        'status', 'notes', 'questions_solved', 'time_studied_seconds', 'postpone_count'
    ];

    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            if (db.isPostgreSQL) {
                fields.push(`${field} = $${paramCount}`);
            } else {
                fields.push(`${field} = ?`);
            }
            values.push(updateData[field]);
            paramCount++;
        }
    }

    if (fields.length === 0) {
        throw new Error('Nenhum campo válido para atualizar');
    }

    values.push(sessionId, userId);

    let sql;
    if (db.isPostgreSQL) {
        sql = `UPDATE study_sessions SET ${fields.join(', ')} 
        WHERE id = $${paramCount} AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $${paramCount + 1})`;
    } else {
        sql = `UPDATE study_sessions SET ${fields.join(', ')} 
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)`;
    }

    const result = await executeQuery('run', sql, values, 'updateSession');

    if (result.changes === 0) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    return result;
};

/**
 * Update session status and handle topic completion
 */
const updateSessionStatus = async (sessionId, status, userId) => {
    const db = await getDB();
    
    // For PostgreSQL, we need to handle transactions differently
    // For now, we'll do it in sequence without explicit transaction
    
    try {
        // Update session status
        const updateSQL = db.isPostgreSQL 
            ? `UPDATE study_sessions SET status = $1 
            WHERE id = $2 AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $3)`
            : `UPDATE study_sessions SET status = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)`;
        
        const result = await executeQuery('run', updateSQL, [status, sessionId, userId], 'updateSessionStatus_update');

        if (result.changes === 0) {
            throw new Error('Sessão não encontrada ou não autorizada');
        }

        // Handle topic completion logic
        const sessionSQL = db.isPostgreSQL 
            ? 'SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = $1'
            : 'SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = ?';
        
        const session = await executeQuery('get', sessionSQL, [sessionId], 'updateSessionStatus_getSession');
        
        if (session && session.topic_id && session.session_type === 'Novo Tópico') {
            if (status === 'Concluído') {
                const completionDate = session.session_date;
                const topicSQL = db.isPostgreSQL 
                    ? 'UPDATE topics SET status = $1, completion_date = $2 WHERE id = $3'
                    : 'UPDATE topics SET status = ?, completion_date = ? WHERE id = ?';
                
                await executeQuery('run', topicSQL, ['Concluído', completionDate, session.topic_id], 'updateSessionStatus_completeTopic');
            } else if (status === 'Pendente') {
                const topicSQL = db.isPostgreSQL 
                    ? 'UPDATE topics SET status = $1, completion_date = NULL WHERE id = $2'
                    : 'UPDATE topics SET status = ?, completion_date = NULL WHERE id = ?';
                
                await executeQuery('run', topicSQL, ['Pendente', session.topic_id], 'updateSessionStatus_pendingTopic');
            }
        }

        return result;
    } catch (error) {
        throw error;
    }
};

/**
 * Batch update session statuses
 * CORREÇÃO: Adicionar lógica de atualização dos tópicos também no batch
 */
const batchUpdateSessionStatus = async (sessions, userId) => {
    const db = await getDB();
    
    try {
        // Collect session details for topic updates
        const sessionUpdates = [];
        
        for (const session of sessions) {
            const sessionId = parseInt(session.id, 10);
            if (isNaN(sessionId)) continue;

            // Get session details before updating
            const sessionSQL = db.isPostgreSQL 
                ? 'SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = $1'
                : 'SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = ?';
            
            const sessionDetails = await executeQuery('get', sessionSQL, [sessionId], 'batchUpdateSessionStatus_getDetails');
            
            // Update session status
            const updateSQL = db.isPostgreSQL 
                ? `UPDATE study_sessions 
                SET status = $1 
                WHERE id = $2 AND EXISTS (
                    SELECT 1 FROM study_plans
                    WHERE study_plans.id = study_sessions.study_plan_id
                    AND study_plans.user_id = $3
                )`
                : `UPDATE study_sessions 
                SET status = ? 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM study_plans
                    WHERE study_plans.id = study_sessions.study_plan_id
                    AND study_plans.user_id = ?
                )`;
            
            await executeQuery('run', updateSQL, [session.status, sessionId, userId], 'batchUpdateSessionStatus_update');
            
            // Store for topic updates if needed
            if (sessionDetails && sessionDetails.topic_id && sessionDetails.session_type === 'Novo Tópico') {
                sessionUpdates.push({
                    topicId: sessionDetails.topic_id,
                    status: session.status,
                    completionDate: sessionDetails.session_date
                });
            }
        }
        
        // Update topic statuses
        for (const update of sessionUpdates) {
            if (update.status === 'Concluído') {
                const topicSQL = db.isPostgreSQL 
                    ? 'UPDATE topics SET status = $1, completion_date = $2 WHERE id = $3'
                    : 'UPDATE topics SET status = ?, completion_date = ? WHERE id = ?';
                
                await executeQuery('run', topicSQL, ['Concluído', update.completionDate, update.topicId], 'batchUpdateSessionStatus_completeTopic');
            } else if (update.status === 'Pendente') {
                const topicSQL = db.isPostgreSQL 
                    ? 'UPDATE topics SET status = $1, completion_date = NULL WHERE id = $2'
                    : 'UPDATE topics SET status = ?, completion_date = NULL WHERE id = ?';
                
                await executeQuery('run', topicSQL, ['Pendente', update.topicId], 'batchUpdateSessionStatus_pendingTopic');
            }
        }

        return { success: true };
    } catch (error) {
        throw error;
    }
};

/**
 * Delete a study session
 */
const deleteSession = async (sessionId, userId) => {
    const db = await getDB();
    
    const sql = db.isPostgreSQL 
        ? `DELETE FROM study_sessions 
        WHERE id = $1 AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $2)`
        : `DELETE FROM study_sessions 
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)`;

    const result = await executeQuery('run', sql, [sessionId, userId], 'deleteSession');

    if (result.changes === 0) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    return result;
};

/**
 * Create reinforcement session
 */
const createReinforcementSession = async (originalSessionId, userId) => {
    const db = await getDB();
    
    const originalSQL = db.isPostgreSQL 
        ? `SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id = $1 AND sp.user_id = $2`
        : `SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id = ? AND sp.user_id = ?`;
    
    const originalSession = await executeQuery('get', originalSQL, [originalSessionId, userId], 'createReinforcementSession_getOriginal');

    if (!originalSession || !originalSession.topic_id) {
        throw new Error('Sessão original não encontrada ou não é um tópico estudável');
    }

    // Find next available date
    const nextAvailableDate = await getNextAvailableDate(originalSession.study_plan_id);

    let sql, result;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
        
        result = await executeQuery('run', sql, [
            originalSession.study_plan_id,
            originalSession.topic_id,
            originalSession.subject_name,
            originalSession.topic_description,
            nextAvailableDate,
            'Reforço',
            'Pendente',
            `Reforço solicitado da sessão original #${originalSessionId}`
        ], 'createReinforcementSession');
        
        return result?.rows?.[0]?.id || result?.id;
    } else {
        sql = `INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        
        result = await executeQuery('run', sql, [
            originalSession.study_plan_id,
            originalSession.topic_id,
            originalSession.subject_name,
            originalSession.topic_description,
            nextAvailableDate,
            'Reforço',
            'Pendente',
            `Reforço solicitado da sessão original #${originalSessionId}`
        ], 'createReinforcementSession');
        
        return result.lastID;
    }
};

/**
 * Postpone a session
 */
const postponeSession = async (sessionId, userId, postponementData = {}) => {
    const session = await getSessionById(sessionId, userId);
    if (!session) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    const currentPostponeCount = session.postpone_count || 0;
    const maxPostponements = 3; // Configurable limit

    if (currentPostponeCount >= maxPostponements) {
        throw new Error(`Sessão já foi adiada ${maxPostponements} vezes (limite atingido)`);
    }

    const newDate = postponementData.newDate || await getNextAvailableDate(session.study_plan_id, session.session_date);
    
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `UPDATE study_sessions 
        SET session_date = $1, postpone_count = $2
        WHERE id = $3 AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $4)`
        : `UPDATE study_sessions 
        SET session_date = ?, postpone_count = ?
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)`;
    
    const result = await executeQuery('run', sql, [newDate, currentPostponeCount + 1, sessionId, userId], 'postponeSession');

    if (result.changes === 0) {
        throw new Error('Erro ao adiar sessão');
    }

    return { newDate, postponeCount: currentPostponeCount + 1 };
};

/**
 * Get schedule statistics
 */
const getScheduleStatistics = async (planId, userId) => {
    const db = await getDB();
    
    const planSQL = db.isPostgreSQL 
        ? 'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2'
        : 'SELECT id FROM study_plans WHERE id = ? AND user_id = ?';
    
    const plan = await executeQuery('get', planSQL, [planId, userId], 'getScheduleStatistics_verify');
    
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const statsSQL = db.isPostgreSQL 
        ? `SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pending_sessions,
            SUM(time_studied_seconds) as total_time_seconds,
            SUM(questions_solved) as total_questions,
            COUNT(DISTINCT session_type) as unique_session_types,
            AVG(time_studied_seconds) as avg_time_per_session
        FROM study_sessions 
        WHERE study_plan_id = $1`
        : `SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pending_sessions,
            SUM(time_studied_seconds) as total_time_seconds,
            SUM(questions_solved) as total_questions,
            COUNT(DISTINCT session_type) as unique_session_types,
            AVG(time_studied_seconds) as avg_time_per_session
        FROM study_sessions 
        WHERE study_plan_id = ?`;

    const stats = await executeQuery('get', statsSQL, [planId], 'getScheduleStatistics_stats');

    const sessionTypesSQL = db.isPostgreSQL 
        ? `SELECT 
            session_type,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed
        FROM study_sessions 
        WHERE study_plan_id = $1
        GROUP BY session_type
        ORDER BY count DESC`
        : `SELECT 
            session_type,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed
        FROM study_sessions 
        WHERE study_plan_id = ?
        GROUP BY session_type
        ORDER BY count DESC`;

    const sessionTypes = await executeQuery('all', sessionTypesSQL, [planId], 'getScheduleStatistics_types');

    return {
        ...stats,
        completion_rate: stats.total_sessions > 0 ? Math.round((stats.completed_sessions / stats.total_sessions) * 100) : 0,
        session_types: sessionTypes
    };
};

/**
 * Get weekly schedule view
 */
const getWeeklySchedule = async (planId, userId, weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const sessions = await getScheduleByDateRange(
        planId, 
        userId, 
        weekStart.toISOString().split('T')[0], 
        weekEnd.toISOString().split('T')[0]
    );

    const weeklyData = {};
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        weeklyData[dateStr] = sessions.filter(s => s.session_date === dateStr);
    }

    return weeklyData;
};

/**
 * Get monthly schedule overview
 */
const getMonthlySchedule = async (planId, userId, year, month) => {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    const sessions = await getScheduleByDateRange(planId, userId, startDate, endDate);

    const monthlyStats = {
        total_sessions: sessions.length,
        completed_sessions: sessions.filter(s => s.status === 'Concluído').length,
        total_time: sessions.reduce((sum, s) => sum + (s.time_studied_seconds || 0), 0),
        sessions_by_date: sessions.reduce((acc, session) => {
            if (!acc[session.session_date]) acc[session.session_date] = [];
            acc[session.session_date].push(session);
            return acc;
        }, {})
    };

    return monthlyStats;
};

/**
 * Helper function to get next available date for scheduling
 */
const getNextAvailableDate = async (planId, fromDate = null) => {
    const baseDate = fromDate ? new Date(fromDate) : new Date();
    baseDate.setDate(baseDate.getDate() + 1);

    // Simple implementation - could be enhanced with more complex scheduling logic
    return baseDate.toISOString().split('T')[0];
};

/**
 * Get time logs for a session
 */
const getSessionTimeLogs = async (sessionId, userId) => {
    const db = await getDB();
    
    const sql = db.isPostgreSQL 
        ? `SELECT stl.* FROM study_time_logs stl
        JOIN study_sessions ss ON stl.session_id = ss.id
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE stl.session_id = $1 AND sp.user_id = $2
        ORDER BY stl.start_time ASC`
        : `SELECT stl.* FROM study_time_logs stl
        JOIN study_sessions ss ON stl.session_id = ss.id
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE stl.session_id = ? AND sp.user_id = ?
        ORDER BY stl.start_time ASC`;

    return await executeQuery('all', sql, [sessionId, userId], 'getSessionTimeLogs');
};

/**
 * Create time log entry
 */
const createTimeLog = async (sessionId, userId, timeData) => {
    const db = await getDB();
    
    // Verify session ownership
    const session = await getSessionById(sessionId, userId);
    if (!session) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    let sql, result;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO study_time_logs 
        (session_id, user_id, start_time, end_time, duration_seconds)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        
        result = await executeQuery('run', sql, [
            sessionId,
            userId,
            timeData.start_time,
            timeData.end_time,
            timeData.duration_seconds
        ], 'createTimeLog');
        
        const id = result?.rows?.[0]?.id || result?.id;
        
        // Update total time in session
        const updateSQL = `UPDATE study_sessions 
        SET time_studied_seconds = time_studied_seconds + $1
        WHERE id = $2`;
        
        await executeQuery('run', updateSQL, [timeData.duration_seconds, sessionId], 'createTimeLog_updateSession');
        
        return id;
    } else {
        sql = `INSERT INTO study_time_logs 
        (session_id, user_id, start_time, end_time, duration_seconds)
        VALUES (?, ?, ?, ?, ?)`;
        
        result = await executeQuery('run', sql, [
            sessionId,
            userId,
            timeData.start_time,
            timeData.end_time,
            timeData.duration_seconds
        ], 'createTimeLog');
        
        // Update total time in session
        const updateSQL = `UPDATE study_sessions 
        SET time_studied_seconds = time_studied_seconds + ?
        WHERE id = ?`;
        
        await executeQuery('run', updateSQL, [timeData.duration_seconds, sessionId], 'createTimeLog_updateSession');
        
        return result.lastID;
    }
};

module.exports = {
    getScheduleByPlan,
    getScheduleGroupedByDate,
    getScheduleByDateRange,
    getSessionById,
    getSessionsByIds,
    createSession,
    updateSession,
    updateSessionStatus,
    batchUpdateSessionStatus,
    deleteSession,
    createReinforcementSession,
    postponeSession,
    getScheduleStatistics,
    getWeeklySchedule,
    getMonthlySchedule,
    getSessionTimeLogs,
    createTimeLog
};