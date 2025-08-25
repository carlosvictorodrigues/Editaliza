/**
 * Session Repository
 * Centraliza todas as queries relacionadas a sessões de estudo
 * FASE 3 - Criado manualmente com contexto de negócio adequado
 */

const BaseRepository = require('./base.repository');

class SessionRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    // ======================== CRIAÇÃO E ATUALIZAÇÃO ========================

    /**
     * Cria uma nova sessão de estudo
     */
    async createSession(sessionData) {
        const {
            study_plan_id, topic_id, subject_name, session_date,
            session_type, status, duration_minutes, priority
        } = sessionData;

        const query = `
            INSERT INTO study_sessions (
                study_plan_id, topic_id, subject_name, session_date,
                session_type, status, duration_minutes, priority,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            study_plan_id, topic_id, subject_name, session_date,
            session_type, status || 'pending', duration_minutes, priority || 0
        ];

        return this.create(query, params);
    }

    /**
     * Atualiza uma sessão específica
     */
    async updateSession(sessionId, planId, updates) {
        const allowedFields = [
            'session_date', 'status', 'time_studied_seconds',
            'questions_solved', 'topic_id', 'notes', 'duration_minutes'
        ];

        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return 0;
        }

        updateData.updated_at = 'CURRENT_TIMESTAMP';
        
        const { query, params } = this.buildUpdateQuery(
            'study_sessions',
            updateData,
            'id = $1 AND study_plan_id = $2',
            [sessionId, planId]
        );

        return this.update(query, params);
    }

    /**
     * Marca sessão como completa com estatísticas
     */
    async markAsCompleted(sessionId, planId, completionData) {
        const query = `
            UPDATE study_sessions 
            SET status = 'completed',
                time_studied_seconds = $3,
                questions_solved = $4,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND study_plan_id = $2
        `;
        
        return this.update(query, [
            sessionId,
            planId,
            completionData.timeStudied || 0,
            completionData.questionsSolved || 0
        ]);
    }

    /**
     * Reagenda uma sessão para nova data
     */
    async rescheduleSession(sessionId, planId, newDate) {
        const query = `
            UPDATE study_sessions 
            SET session_date = $3,
                status = 'rescheduled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND study_plan_id = $2
        `;
        return this.update(query, [sessionId, planId, newDate]);
    }

    /**
     * Atualiza múltiplas sessões (para replanejamento)
     */
    async bulkUpdateSessions(planId, sessions) {
        return this.transaction(async (repo) => {
            const results = [];
            for (const session of sessions) {
                const query = `
                    UPDATE study_sessions 
                    SET session_date = $3,
                        priority = $4,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND study_plan_id = $2
                `;
                const result = await repo.update(query, [
                    session.id,
                    planId,
                    session.session_date,
                    session.priority || 0
                ]);
                results.push(result);
            }
            return results;
        });
    }

    // ======================== BUSCA E LISTAGEM ========================

    /**
     * Busca todas as sessões de um plano
     */
    async findByPlanId(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
            ORDER BY session_date ASC, priority DESC, id ASC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca sessões em um período
     */
    async findByDateRange(planId, startDate, endDate) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND session_date >= $2 
                AND session_date <= $3
            ORDER BY session_date ASC, priority DESC
        `;
        return this.findAll(query, [planId, startDate, endDate]);
    }

    /**
     * Busca sessões pendentes
     */
    async findPendingSessions(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND status IN ('pending', 'rescheduled')
            ORDER BY session_date ASC, priority DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca sessões completadas
     */
    async findCompletedSessions(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND status = 'completed'
            ORDER BY completed_at DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca sessões por tópico
     */
    async findByTopicId(topicId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE topic_id = $1
            ORDER BY session_date ASC
        `;
        return this.findAll(query, [topicId]);
    }

    /**
     * Busca sessões de uma data específica
     */
    async getSessionsForDate(planId, date) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND DATE(session_date) = DATE($2)
            ORDER BY priority DESC, id ASC
        `;
        return this.findAll(query, [planId, date]);
    }

    /**
     * Busca sessões atrasadas
     */
    async findOverdueSessions(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND status IN ('pending', 'rescheduled')
                AND session_date < CURRENT_DATE
            ORDER BY session_date ASC
        `;
        return this.findAll(query, [planId]);
    }

    // ======================== ESTATÍSTICAS ========================

    /**
     * Estatísticas gerais de estudo
     */
    async getStudyStatistics(planId) {
        const query = `
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_sessions,
                COUNT(CASE WHEN status IN ('pending', 'rescheduled') 
                      AND session_date < CURRENT_DATE THEN 1 END) as overdue_sessions,
                COALESCE(SUM(time_studied_seconds), 0) as total_time_seconds,
                COALESCE(SUM(questions_solved), 0) as total_questions,
                COALESCE(AVG(time_studied_seconds), 0) as avg_time_per_session,
                COUNT(DISTINCT DATE(session_date)) as unique_study_days
            FROM study_sessions
            WHERE study_plan_id = $1
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Progresso diário
     */
    async getDailyProgress(planId, date) {
        const query = `
            SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COALESCE(SUM(time_studied_seconds), 0) as time_studied,
                COALESCE(SUM(questions_solved), 0) as questions_solved
            FROM study_sessions
            WHERE study_plan_id = $1 
                AND DATE(session_date) = DATE($2)
        `;
        return this.findOne(query, [planId, date]);
    }

    /**
     * Progresso semanal
     */
    async getWeeklyProgress(planId, weekStart) {
        const query = `
            SELECT 
                DATE(session_date) as study_date,
                COUNT(*) as sessions_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(SUM(time_studied_seconds), 0) as daily_time,
                COALESCE(SUM(questions_solved), 0) as daily_questions
            FROM study_sessions
            WHERE study_plan_id = $1 
                AND session_date >= $2
                AND session_date < ($2::date + INTERVAL '7 days')
            GROUP BY DATE(session_date)
            ORDER BY study_date ASC
        `;
        return this.findAll(query, [planId, weekStart]);
    }

    /**
     * Calcula sequência de dias estudados
     */
    async getStudyStreak(planId) {
        const query = `
            WITH study_days AS (
                SELECT DISTINCT DATE(session_date) as study_date
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND (status = 'completed' OR time_studied_seconds > 0)
                ORDER BY study_date DESC
            ),
            streak_groups AS (
                SELECT 
                    study_date,
                    (study_date - INTERVAL '1 day' * ROW_NUMBER() OVER (ORDER BY study_date DESC)) as grp
                FROM study_days
            )
            SELECT 
                COUNT(*) as current_streak,
                MIN(study_date) as streak_start,
                MAX(study_date) as streak_end
            FROM streak_groups
            WHERE grp = (SELECT grp FROM streak_groups LIMIT 1)
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Tempo médio de estudo por dia
     */
    async getAverageStudyTime(planId) {
        const query = `
            SELECT 
                AVG(daily_seconds) / 3600.0 as avg_hours_per_day,
                MAX(daily_seconds) / 3600.0 as max_hours_per_day,
                MIN(daily_seconds) / 3600.0 as min_hours_per_day
            FROM (
                SELECT 
                    DATE(session_date) as study_date,
                    SUM(time_studied_seconds) as daily_seconds
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND time_studied_seconds > 0
                GROUP BY DATE(session_date)
            ) as daily_stats
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Estatísticas de questões resolvidas
     */
    async getQuestionsSolvedStats(planId, dateRange = null) {
        let query;
        const params = [planId];

        if (dateRange && dateRange.start && dateRange.end) {
            query = `
                SELECT 
                    SUM(questions_solved) as total_questions,
                    AVG(questions_solved) as avg_per_session,
                    MAX(questions_solved) as max_per_session,
                    COUNT(CASE WHEN questions_solved > 0 THEN 1 END) as sessions_with_questions
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND session_date >= $2
                    AND session_date <= $3
            `;
            params.push(dateRange.start, dateRange.end);
        } else {
            query = `
                SELECT 
                    SUM(questions_solved) as total_questions,
                    AVG(questions_solved) as avg_per_session,
                    MAX(questions_solved) as max_per_session,
                    COUNT(CASE WHEN questions_solved > 0 THEN 1 END) as sessions_with_questions
                FROM study_sessions
                WHERE study_plan_id = $1
            `;
        }

        return this.findOne(query, params);
    }

    /**
     * Distribuição de estudo por dia da semana
     */
    async getStudyDistributionByWeekday(planId) {
        const query = `
            SELECT 
                EXTRACT(DOW FROM session_date) as day_of_week,
                COUNT(*) as sessions_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                AVG(time_studied_seconds) as avg_time
            FROM study_sessions
            WHERE study_plan_id = $1
            GROUP BY EXTRACT(DOW FROM session_date)
            ORDER BY day_of_week
        `;
        return this.findAll(query, [planId]);
    }

    // ======================== DELEÇÃO E LIMPEZA ========================

    /**
     * Deleta todas as sessões de um plano
     */
    async deleteByPlanId(planId) {
        const query = `DELETE FROM study_sessions WHERE study_plan_id = $1`;
        return this.delete(query, [planId]);
    }

    /**
     * Deleta sessões de um tópico
     */
    async deleteByTopicId(topicId) {
        const query = `DELETE FROM study_sessions WHERE topic_id = $1`;
        return this.delete(query, [topicId]);
    }

    /**
     * Deleta sessões de uma disciplina
     */
    async deleteBySubjectId(subjectId) {
        const query = `
            DELETE FROM study_sessions 
            WHERE topic_id IN (
                SELECT id FROM topics WHERE subject_id = $1
            )
        `;
        return this.delete(query, [subjectId]);
    }

    /**
     * Limpa sessões antigas
     */
    async cleanupOldSessions(planId, beforeDate) {
        const query = `
            DELETE FROM study_sessions 
            WHERE study_plan_id = $1 
                AND session_date < $2
                AND status IN ('completed', 'skipped')
        `;
        return this.delete(query, [planId, beforeDate]);
    }

    // ======================== VALIDAÇÃO E VERIFICAÇÃO ========================

    /**
     * Verifica se há sessões em uma data
     */
    async hasSessionsForDate(planId, date) {
        const query = `
            SELECT COUNT(*) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 
                AND DATE(session_date) = DATE($2)
        `;
        const result = await this.findOne(query, [planId, date]);
        return result.count > 0;
    }

    /**
     * Conta sessões pendentes
     */
    async countPendingSessions(planId) {
        return this.count(
            'study_sessions',
            'study_plan_id = $1 AND status IN (\'pending\', \'rescheduled\')',
            [planId]
        );
    }

    /**
     * Conta sessões atrasadas
     */
    async countOverdueSessions(planId, todayStr = null) {
        let query, params;
        
        if (todayStr) {
            // Para compatibilidade com a implementação original que usa Brazilian timezone
            query = `
                SELECT COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = $1 
                    AND status = 'Pendente'
                    AND session_date < $2
            `;
            params = [planId, todayStr];
        } else {
            query = `
                SELECT COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = $1 
                    AND status IN ('pending', 'rescheduled')
                    AND session_date < CURRENT_DATE
            `;
            params = [planId];
        }
        
        const result = await this.findOne(query, params);
        return result.count;
    }

    /**
     * Verifica próxima sessão disponível
     */
    async getNextSession(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND status IN ('pending', 'rescheduled')
                AND session_date >= CURRENT_DATE
            ORDER BY session_date ASC, priority DESC
            LIMIT 1
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Busca slot disponível para nova sessão
     */
    async findNextAvailableSlot(planId, afterDate, maxSessionsPerDay = 3) {
        const query = `
            WITH daily_counts AS (
                SELECT 
                    DATE(session_date) as study_date,
                    COUNT(*) as session_count
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND session_date >= $2
                GROUP BY DATE(session_date)
            )
            SELECT 
                study_date,
                session_count
            FROM daily_counts
            WHERE session_count < $3
            ORDER BY study_date ASC
            LIMIT 1
        `;
        return this.findOne(query, [planId, afterDate, maxSessionsPerDay]);
    }
}

module.exports = SessionRepository;