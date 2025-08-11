/**
 * Schedule Repository - Data access layer for schedules and study sessions
 * 
 * This repository handles all database operations related to study schedules,
 * sessions, time tracking, and schedule analytics.
 */

const db = require('../../database');
const { validateTableName } = require('../utils/security');

/**
 * Helper function for database queries with promisification
 */
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

/**
 * Get schedule (study sessions) for a specific plan
 */
const getScheduleByPlan = async (planId, userId) => {
    const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const sessions = await dbAll(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? 
        ORDER BY session_date ASC, id ASC
    `, [planId]);

    return sessions;
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
    const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const sessions = await dbAll(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? 
        AND session_date >= ? 
        AND session_date <= ?
        ORDER BY session_date ASC, id ASC
    `, [planId, startDate, endDate]);

    return sessions;
};

/**
 * Get single study session by ID
 */
const getSessionById = async (sessionId, userId) => {
    const session = await dbGet(`
        SELECT
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
            ss.id = ? AND sp.user_id = ?
    `, [sessionId, userId]);

    return session;
};

/**
 * Get multiple sessions by IDs
 */
const getSessionsByIds = async (sessionIds, userId) => {
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
        return [];
    }

    const placeholders = sessionIds.map(() => '?').join(',');
    const params = [...sessionIds, userId];

    const sessions = await dbAll(`
        SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id IN (${placeholders}) AND sp.user_id = ?
    `, params);

    return sessions;
};

/**
 * Create a new study session
 */
const createSession = async (sessionData, userId) => {
    // Verify plan ownership
    const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [sessionData.study_plan_id, userId]);
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const result = await dbRun(`
        INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes, questions_solved, time_studied_seconds, postpone_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);

    return result.lastID;
};

/**
 * Update study session
 */
const updateSession = async (sessionId, updateData, userId) => {
    // Build dynamic update query
    const fields = [];
    const values = [];

    const allowedFields = [
        'subject_name', 'topic_description', 'session_date', 'session_type',
        'status', 'notes', 'questions_solved', 'time_studied_seconds', 'postpone_count'
    ];

    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updateData[field]);
        }
    }

    if (fields.length === 0) {
        throw new Error('Nenhum campo válido para atualizar');
    }

    values.push(sessionId, userId);

    const result = await dbRun(`
        UPDATE study_sessions SET ${fields.join(', ')} 
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
    `, values);

    if (result.changes === 0) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    return result;
};

/**
 * Update session status and handle topic completion
 */
const updateSessionStatus = async (sessionId, status, userId) => {
    await dbRun('BEGIN TRANSACTION');

    try {
        // Update session status
        const result = await dbRun(`
            UPDATE study_sessions SET status = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
        `, [status, sessionId, userId]);

        if (result.changes === 0) {
            await dbRun('ROLLBACK');
            throw new Error('Sessão não encontrada ou não autorizada');
        }

        // Handle topic completion logic
        const session = await dbGet('SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = ?', [sessionId]);
        
        if (session && session.topic_id && session.session_type === 'Novo Tópico') {
            if (status === 'Concluído') {
                const completionDate = session.session_date;
                await dbRun('UPDATE topics SET status = ?, completion_date = ? WHERE id = ?', ['Concluído', completionDate, session.topic_id]);
            } else if (status === 'Pendente') {
                await dbRun('UPDATE topics SET status = ?, completion_date = NULL WHERE id = ?', ['Pendente', session.topic_id]);
            }
        }

        await dbRun('COMMIT');
        return result;
    } catch (error) {
        await dbRun('ROLLBACK');
        throw error;
    }
};

/**
 * Batch update session statuses
 * CORREÇÃO: Adicionar lógica de atualização dos tópicos também no batch
 */
const batchUpdateSessionStatus = async (sessions, userId) => {
    await dbRun('BEGIN TRANSACTION');

    try {
        const stmt = db.prepare(`
            UPDATE study_sessions 
            SET status = ? 
            WHERE id = ? AND EXISTS (
                SELECT 1 FROM study_plans
                WHERE study_plans.id = study_sessions.study_plan_id
                AND study_plans.user_id = ?
            )
        `);

        // Collect session details for topic updates
        const sessionUpdates = [];
        
        for (const session of sessions) {
            const sessionId = parseInt(session.id, 10);
            if (isNaN(sessionId)) continue;

            // Get session details before updating
            const sessionDetails = await dbGet('SELECT topic_id, session_type, session_date FROM study_sessions WHERE id = ?', [sessionId]);
            
            await new Promise((resolve, reject) => {
                stmt.run(session.status, sessionId, userId, function(err) {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            // Store for topic updates if needed
            if (sessionDetails && sessionDetails.topic_id && sessionDetails.session_type === 'Novo Tópico') {
                sessionUpdates.push({
                    topicId: sessionDetails.topic_id,
                    status: session.status,
                    completionDate: sessionDetails.session_date
                });
            }
        }

        await new Promise((resolve, reject) => stmt.finalize(err => err ? reject(err) : resolve()));
        
        // Update topic statuses
        for (const update of sessionUpdates) {
            if (update.status === 'Concluído') {
                await dbRun('UPDATE topics SET status = ?, completion_date = ? WHERE id = ?', ['Concluído', update.completionDate, update.topicId]);
            } else if (update.status === 'Pendente') {
                await dbRun('UPDATE topics SET status = ?, completion_date = NULL WHERE id = ?', ['Pendente', update.topicId]);
            }
        }
        
        await dbRun('COMMIT');

        return { success: true };
    } catch (error) {
        await dbRun('ROLLBACK');
        throw error;
    }
};

/**
 * Delete a study session
 */
const deleteSession = async (sessionId, userId) => {
    const result = await dbRun(`
        DELETE FROM study_sessions 
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
    `, [sessionId, userId]);

    if (result.changes === 0) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    return result;
};

/**
 * Create reinforcement session
 */
const createReinforcementSession = async (originalSessionId, userId) => {
    const originalSession = await dbGet(`
        SELECT ss.* FROM study_sessions ss 
        JOIN study_plans sp ON ss.study_plan_id = sp.id 
        WHERE ss.id = ? AND sp.user_id = ?
    `, [originalSessionId, userId]);

    if (!originalSession || !originalSession.topic_id) {
        throw new Error('Sessão original não encontrada ou não é um tópico estudável');
    }

    // Find next available date
    const nextAvailableDate = await getNextAvailableDate(originalSession.study_plan_id);

    const result = await dbRun(`
        INSERT INTO study_sessions 
        (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        originalSession.study_plan_id,
        originalSession.topic_id,
        originalSession.subject_name,
        originalSession.topic_description,
        nextAvailableDate,
        'Reforço',
        'Pendente',
        `Reforço solicitado da sessão original #${originalSessionId}`
    ]);

    return result.lastID;
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
    
    const result = await dbRun(`
        UPDATE study_sessions 
        SET session_date = ?, postpone_count = ?
        WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
    `, [newDate, currentPostponeCount + 1, sessionId, userId]);

    if (result.changes === 0) {
        throw new Error('Erro ao adiar sessão');
    }

    return { newDate, postponeCount: currentPostponeCount + 1 };
};

/**
 * Get schedule statistics
 */
const getScheduleStatistics = async (planId, userId) => {
    const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
    if (!plan) {
        throw new Error('Plano não encontrado ou não autorizado');
    }

    const stats = await dbGet(`
        SELECT 
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_sessions,
            COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pending_sessions,
            SUM(time_studied_seconds) as total_time_seconds,
            SUM(questions_solved) as total_questions,
            COUNT(DISTINCT session_type) as unique_session_types,
            AVG(time_studied_seconds) as avg_time_per_session
        FROM study_sessions 
        WHERE study_plan_id = ?
    `, [planId]);

    const sessionTypes = await dbAll(`
        SELECT 
            session_type,
            COUNT(*) as count,
            COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed
        FROM study_sessions 
        WHERE study_plan_id = ?
        GROUP BY session_type
        ORDER BY count DESC
    `, [planId]);

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
    const logs = await dbAll(`
        SELECT stl.* FROM study_time_logs stl
        JOIN study_sessions ss ON stl.session_id = ss.id
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE stl.session_id = ? AND sp.user_id = ?
        ORDER BY stl.start_time ASC
    `, [sessionId, userId]);

    return logs;
};

/**
 * Create time log entry
 */
const createTimeLog = async (sessionId, userId, timeData) => {
    // Verify session ownership
    const session = await getSessionById(sessionId, userId);
    if (!session) {
        throw new Error('Sessão não encontrada ou não autorizada');
    }

    const result = await dbRun(`
        INSERT INTO study_time_logs 
        (session_id, user_id, start_time, end_time, duration_seconds)
        VALUES (?, ?, ?, ?, ?)
    `, [
        sessionId,
        userId,
        timeData.start_time,
        timeData.end_time,
        timeData.duration_seconds
    ]);

    // Update total time in session
    await dbRun(`
        UPDATE study_sessions 
        SET time_studied_seconds = time_studied_seconds + ?
        WHERE id = ?
    `, [timeData.duration_seconds, sessionId]);

    return result.lastID;
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