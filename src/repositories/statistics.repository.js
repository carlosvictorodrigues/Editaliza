/**
 * Statistics Repository
 * Centraliza queries complexas de estatísticas, dashboards e analytics
 * FASE 3 - Criado manualmente com CTEs e queries agregadas
 */

const BaseRepository = require('./base.repository');

class StatisticsRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    // ======================== ESTATÍSTICAS GERAIS DO PLANO ========================

    /**
     * Estatísticas completas do plano com CTEs
     */
    async getPlanComprehensiveStats(planId, userId) {
        const query = `
            WITH plan_stats AS (
                SELECT 
                    sp.id,
                    sp.plan_name,
                    sp.exam_date,
                    sp.daily_study_hours,
                    sp.days_per_week,
                    JULIANDAY(sp.exam_date) - JULIANDAY(DATE('now')) as days_until_exam
                FROM study_plans sp
                WHERE sp.id = $1 AND sp.user_id = $2
            ),
            subject_stats AS (
                SELECT 
                    COUNT(DISTINCT s.id) as total_subjects,
                    COUNT(DISTINCT t.id) as total_topics,
                    COUNT(DISTINCT CASE WHEN t.completed = 1 THEN t.id END) as completed_topics
                FROM subjects s
                LEFT JOIN topics t ON s.id = t.subject_id
                WHERE s.study_plan_id = $1
            ),
            session_stats AS (
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
                    COUNT(CASE WHEN status = 'pending' AND session_date < CURRENT_DATE THEN 1 END) as overdue_sessions,
                    COALESCE(SUM(time_studied_seconds), 0) as total_study_seconds,
                    COALESCE(SUM(questions_solved), 0) as total_questions_solved
                FROM study_sessions
                WHERE study_plan_id = $1
            ),
            daily_streak AS (
                SELECT COUNT(DISTINCT DATE(session_date)) as study_days
                FROM study_sessions
                WHERE study_plan_id = $1 
                    AND (status = 'completed' OR time_studied_seconds > 0)
            )
            SELECT 
                ps.*,
                ss.total_subjects,
                ss.total_topics,
                ss.completed_topics,
                ROUND(ss.completed_topics * 100.0 / NULLIF(ss.total_topics, 0), 2) as progress_percentage,
                ses.total_sessions,
                ses.completed_sessions,
                ses.overdue_sessions,
                ses.total_study_seconds,
                ROUND(ses.total_study_seconds / 3600.0, 2) as total_study_hours,
                ses.total_questions_solved,
                ds.study_days,
                ROUND(ses.total_study_seconds / NULLIF(ds.study_days * 3600.0, 0), 2) as avg_hours_per_day
            FROM plan_stats ps
            CROSS JOIN subject_stats ss
            CROSS JOIN session_stats ses
            CROSS JOIN daily_streak ds
        `;
        
        return this.findOne(query, [planId, userId]);
    }

    /**
     * Calcula streak de estudo (dias consecutivos)
     */
    async getStudyStreak(planId) {
        const query = `
            WITH RECURSIVE study_dates AS (
                SELECT DISTINCT DATE(session_date) as study_date
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND (status = 'completed' OR time_studied_seconds > 0)
                ORDER BY study_date DESC
            ),
            streak_calc AS (
                SELECT 
                    study_date,
                    study_date - ROW_NUMBER() OVER (ORDER BY study_date DESC) as streak_group
                FROM study_dates
            ),
            current_streak AS (
                SELECT 
                    COUNT(*) as streak_days,
                    MIN(study_date) as streak_start,
                    MAX(study_date) as streak_end
                FROM streak_calc
                WHERE streak_group = (
                    SELECT streak_group 
                    FROM streak_calc 
                    WHERE study_date = DATE('now')
                    LIMIT 1
                )
            ),
            longest_streak AS (
                SELECT 
                    MAX(streak_count) as max_streak
                FROM (
                    SELECT COUNT(*) as streak_count
                    FROM streak_calc
                    GROUP BY streak_group
                ) as streaks
            )
            SELECT 
                COALESCE(cs.streak_days, 0) as current_streak,
                cs.streak_start,
                cs.streak_end,
                ls.max_streak as longest_streak,
                CASE 
                    WHEN cs.streak_end = DATE('now') THEN 1
                    ELSE 0
                END as is_active
            FROM current_streak cs
            CROSS JOIN longest_streak ls
        `;
        
        return this.findOne(query, [planId]);
    }

    // ======================== PROGRESSO DETALHADO ========================

    /**
     * Progresso detalhado por disciplina e tópico
     */
    async getDetailedProgress(planId) {
        const query = `
            WITH topic_progress AS (
                SELECT 
                    t.id as topic_id,
                    t.topic_name,
                    t.subject_id,
                    t.completed,
                    t.priority_weight,
                    t.total_questions,
                    t.correct_questions,
                    COALESCE(ss.total_time, 0) as time_studied_seconds,
                    COALESCE(ss.session_count, 0) as session_count
                FROM topics t
                LEFT JOIN (
                    SELECT 
                        topic_id,
                        SUM(time_studied_seconds) as total_time,
                        COUNT(*) as session_count
                    FROM study_sessions
                    WHERE study_plan_id = $1 AND topic_id IS NOT NULL
                    GROUP BY topic_id
                ) ss ON t.id = ss.topic_id
                WHERE t.subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id = $1
                )
            ),
            subject_summary AS (
                SELECT 
                    s.id as subject_id,
                    s.subject_name,
                    s.priority_weight as subject_priority,
                    COUNT(tp.topic_id) as total_topics,
                    COUNT(CASE WHEN tp.completed = 1 THEN 1 END) as completed_topics,
                    SUM(tp.time_studied_seconds) as subject_time_seconds,
                    SUM(tp.total_questions) as total_questions,
                    SUM(tp.correct_questions) as correct_questions
                FROM subjects s
                LEFT JOIN topic_progress tp ON s.id = tp.subject_id
                WHERE s.study_plan_id = $1
                GROUP BY s.id, s.subject_name, s.priority_weight
            )
            SELECT 
                ss.*,
                ROUND(ss.completed_topics * 100.0 / NULLIF(ss.total_topics, 0), 2) as progress_percentage,
                ROUND(ss.correct_questions * 100.0 / NULLIF(ss.total_questions, 0), 2) as accuracy_percentage,
                ROUND(ss.subject_time_seconds / 3600.0, 2) as study_hours,
                RANK() OVER (ORDER BY ss.subject_priority DESC) as priority_rank,
                RANK() OVER (ORDER BY ss.subject_time_seconds DESC) as time_rank
            FROM subject_summary ss
            ORDER BY ss.subject_priority DESC
        `;
        
        return this.findAll(query, [planId]);
    }

    /**
     * Matriz de progresso por semana
     */
    async getWeeklyProgressMatrix(planId, weeks = 4) {
        const query = `
            WITH week_data AS (
                SELECT 
                    DATE('now', 'weekday 0', '-' || ((CAST(strftime('%w', session_date) AS INTEGER) + 6) % 7) || ' days') as week_start,
                    COUNT(*) as sessions_count,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                    SUM(time_studied_seconds) as week_time,
                    SUM(questions_solved) as week_questions
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND session_date >= DATE('now', '-' || $2 || ' weeks')
                GROUP BY week_start
            )
            SELECT 
                week_start,
                strftime('%W', week_start) as week_number,
                sessions_count,
                completed_count,
                ROUND(completed_count * 100.0 / NULLIF(sessions_count, 0), 2) as completion_rate,
                ROUND(week_time / 3600.0, 2) as hours_studied,
                week_questions,
                ROUND(week_time / NULLIF(sessions_count * 60.0, 0), 2) as avg_minutes_per_session
            FROM week_data
            ORDER BY week_start DESC
        `;
        
        return this.findAll(query, [planId, weeks]);
    }

    // ======================== ANÁLISE DE QUESTÕES ========================

    /**
     * Radar de questões - identifica pontos fracos
     */
    async getQuestionRadar(planId) {
        const query = `
            SELECT 
                s.subject_name,
                s.priority_weight,
                COUNT(t.id) as total_topics,
                SUM(t.total_questions) as total_questions,
                SUM(t.correct_questions) as correct_questions,
                ROUND(
                    SUM(t.correct_questions) * 100.0 / 
                    NULLIF(SUM(t.total_questions), 0), 2
                ) as accuracy_rate,
                CASE 
                    WHEN SUM(t.correct_questions) * 100.0 / NULLIF(SUM(t.total_questions), 0) < 50 THEN 'critical'
                    WHEN SUM(t.correct_questions) * 100.0 / NULLIF(SUM(t.total_questions), 0) < 70 THEN 'warning'
                    ELSE 'good'
                END as performance_level
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id, s.subject_name, s.priority_weight
            HAVING SUM(t.total_questions) > 0
            ORDER BY accuracy_rate ASC
        `;
        
        return this.findAll(query, [planId]);
    }

    /**
     * Análise de desempenho por tipo de questão
     */
    async getQuestionTypeAnalysis(planId) {
        const query = `
            WITH question_stats AS (
                SELECT 
                    t.subject_id,
                    t.difficulty_level,
                    COUNT(*) as topic_count,
                    SUM(t.total_questions) as questions,
                    SUM(t.correct_questions) as correct,
                    AVG(t.estimated_hours) as avg_estimated_hours
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = $1 AND t.total_questions > 0
                GROUP BY t.subject_id, t.difficulty_level
            )
            SELECT 
                s.subject_name,
                qs.difficulty_level,
                qs.topic_count,
                qs.questions,
                qs.correct,
                ROUND(qs.correct * 100.0 / NULLIF(qs.questions, 0), 2) as accuracy_rate,
                ROUND(qs.avg_estimated_hours, 2) as avg_hours,
                RANK() OVER (PARTITION BY qs.difficulty_level ORDER BY qs.correct * 100.0 / NULLIF(qs.questions, 0) DESC) as rank_in_difficulty
            FROM question_stats qs
            JOIN subjects s ON qs.subject_id = s.id
            ORDER BY s.subject_name, qs.difficulty_level
        `;
        
        return this.findAll(query, [planId]);
    }

    // ======================== METAS E OBJETIVOS ========================

    /**
     * Progresso das metas diárias e semanais
     */
    async getGoalProgress(planId) {
        const query = `
            WITH plan_goals AS (
                SELECT 
                    daily_question_goal,
                    weekly_question_goal,
                    daily_study_hours
                FROM study_plans
                WHERE id = $1
            ),
            today_progress AS (
                SELECT 
                    COALESCE(SUM(questions_solved), 0) as today_questions,
                    COALESCE(SUM(time_studied_seconds), 0) as today_seconds
                FROM study_sessions
                WHERE study_plan_id = $1 
                    AND DATE(session_date) = DATE('now')
            ),
            week_progress AS (
                SELECT 
                    COALESCE(SUM(questions_solved), 0) as week_questions,
                    COALESCE(SUM(time_studied_seconds), 0) as week_seconds,
                    COUNT(DISTINCT DATE(session_date)) as study_days_this_week
                FROM study_sessions
                WHERE study_plan_id = $1 
                    AND session_date >= DATE('now', 'weekday 0', '-6 days')
                    AND session_date <= DATE('now')
            )
            SELECT 
                pg.daily_question_goal,
                pg.weekly_question_goal,
                pg.daily_study_hours,
                tp.today_questions,
                ROUND(tp.today_seconds / 3600.0, 2) as today_hours,
                wp.week_questions,
                ROUND(wp.week_seconds / 3600.0, 2) as week_hours,
                wp.study_days_this_week,
                ROUND(tp.today_questions * 100.0 / NULLIF(pg.daily_question_goal, 0), 2) as daily_goal_percentage,
                ROUND(wp.week_questions * 100.0 / NULLIF(pg.weekly_question_goal, 0), 2) as weekly_goal_percentage,
                ROUND(tp.today_seconds * 100.0 / NULLIF(pg.daily_study_hours * 3600, 0), 2) as daily_time_percentage
            FROM plan_goals pg
            CROSS JOIN today_progress tp
            CROSS JOIN week_progress wp
        `;
        
        return this.findOne(query, [planId]);
    }

    // ======================== ANÁLISE DE TEMPO ========================

    /**
     * Distribuição de tempo de estudo por período
     */
    async getStudyTimeDistribution(planId) {
        const query = `
            WITH time_slots AS (
                SELECT 
                    CASE 
                        WHEN CAST(strftime('%H', session_date) AS INTEGER) < 6 THEN 'madrugada'
                        WHEN CAST(strftime('%H', session_date) AS INTEGER) < 12 THEN 'manhã'
                        WHEN CAST(strftime('%H', session_date) AS INTEGER) < 18 THEN 'tarde'
                        ELSE 'noite'
                    END as period,
                    COUNT(*) as session_count,
                    SUM(time_studied_seconds) as total_seconds,
                    AVG(time_studied_seconds) as avg_seconds,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
                FROM study_sessions
                WHERE study_plan_id = $1 AND time_studied_seconds > 0
                GROUP BY period
            ),
            weekday_distribution AS (
                SELECT 
                    CASE CAST(strftime('%w', session_date) AS INTEGER)
                        WHEN 0 THEN 'Domingo'
                        WHEN 1 THEN 'Segunda'
                        WHEN 2 THEN 'Terça'
                        WHEN 3 THEN 'Quarta'
                        WHEN 4 THEN 'Quinta'
                        WHEN 5 THEN 'Sexta'
                        WHEN 6 THEN 'Sábado'
                    END as weekday,
                    CAST(strftime('%w', session_date) AS INTEGER) as weekday_num,
                    COUNT(*) as session_count,
                    SUM(time_studied_seconds) as total_seconds
                FROM study_sessions
                WHERE study_plan_id = $1
                GROUP BY weekday, weekday_num
            )
            SELECT 
                'period' as distribution_type,
                period as label,
                session_count,
                ROUND(total_seconds / 3600.0, 2) as total_hours,
                ROUND(avg_seconds / 60.0, 2) as avg_minutes,
                ROUND(completed_count * 100.0 / session_count, 2) as completion_rate
            FROM time_slots
            UNION ALL
            SELECT 
                'weekday' as distribution_type,
                weekday as label,
                session_count,
                ROUND(total_seconds / 3600.0, 2) as total_hours,
                ROUND(total_seconds / NULLIF(session_count * 60.0, 0), 2) as avg_minutes,
                NULL as completion_rate
            FROM weekday_distribution
            ORDER BY distribution_type, 
                     CASE WHEN distribution_type = 'weekday' THEN weekday_num ELSE 0 END
        `;
        
        return this.findAll(query, [planId]);
    }

    // ======================== GAMIFICAÇÃO E COMPARTILHAMENTO ========================

    /**
     * Dados para compartilhamento de progresso
     */
    async getShareableProgress(planId, userId) {
        const query = `
            WITH user_info AS (
                SELECT name, profile_picture
                FROM users
                WHERE id = $2
            ),
            progress_stats AS (
                SELECT 
                    sp.plan_name,
                    sp.exam_date,
                    COUNT(DISTINCT s.id) as total_subjects,
                    COUNT(DISTINCT t.id) as total_topics,
                    COUNT(DISTINCT CASE WHEN t.completed = 1 THEN t.id END) as completed_topics,
                    COALESCE(SUM(ss.time_studied_seconds), 0) as total_seconds,
                    COALESCE(SUM(ss.questions_solved), 0) as total_questions
                FROM study_plans sp
                LEFT JOIN subjects s ON s.study_plan_id = sp.id
                LEFT JOIN topics t ON t.subject_id = s.id
                LEFT JOIN study_sessions ss ON ss.study_plan_id = sp.id
                WHERE sp.id = $1
                GROUP BY sp.plan_name, sp.exam_date
            ),
            achievements AS (
                SELECT COUNT(*) as achievement_count
                FROM user_achievements
                WHERE user_id = $2
            )
            SELECT 
                ui.name as user_name,
                ui.profile_picture,
                ps.plan_name,
                ps.exam_date,
                ps.total_subjects,
                ps.total_topics,
                ps.completed_topics,
                ROUND(ps.completed_topics * 100.0 / NULLIF(ps.total_topics, 0), 2) as progress_percentage,
                ROUND(ps.total_seconds / 3600.0, 2) as total_hours,
                ps.total_questions,
                ac.achievement_count,
                CASE 
                    WHEN ps.completed_topics * 100.0 / NULLIF(ps.total_topics, 0) >= 80 THEN 'expert'
                    WHEN ps.completed_topics * 100.0 / NULLIF(ps.total_topics, 0) >= 60 THEN 'advanced'
                    WHEN ps.completed_topics * 100.0 / NULLIF(ps.total_topics, 0) >= 40 THEN 'intermediate'
                    WHEN ps.completed_topics * 100.0 / NULLIF(ps.total_topics, 0) >= 20 THEN 'beginner'
                    ELSE 'novice'
                END as level
            FROM user_info ui
            CROSS JOIN progress_stats ps
            CROSS JOIN achievements ac
        `;
        
        return this.findOne(query, [planId, userId]);
    }

    // ======================== ANÁLISES COMPARATIVAS ========================

    /**
     * Compara progresso atual com período anterior
     */
    async getProgressComparison(planId, days = 7) {
        const query = `
            WITH current_period AS (
                SELECT 
                    COUNT(*) as sessions,
                    SUM(time_studied_seconds) as study_time,
                    SUM(questions_solved) as questions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND session_date > DATE('now', '-' || $2 || ' days')
            ),
            previous_period AS (
                SELECT 
                    COUNT(*) as sessions,
                    SUM(time_studied_seconds) as study_time,
                    SUM(questions_solved) as questions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
                FROM study_sessions
                WHERE study_plan_id = $1
                    AND session_date > DATE('now', '-' || ($2 * 2) || ' days')
                    AND session_date <= DATE('now', '-' || $2 || ' days')
            )
            SELECT 
                cp.sessions as current_sessions,
                pp.sessions as previous_sessions,
                ROUND((cp.sessions - pp.sessions) * 100.0 / NULLIF(pp.sessions, 0), 2) as sessions_change,
                ROUND(cp.study_time / 3600.0, 2) as current_hours,
                ROUND(pp.study_time / 3600.0, 2) as previous_hours,
                ROUND((cp.study_time - pp.study_time) * 100.0 / NULLIF(pp.study_time, 0), 2) as time_change,
                cp.questions as current_questions,
                pp.questions as previous_questions,
                ROUND((cp.questions - pp.questions) * 100.0 / NULLIF(pp.questions, 0), 2) as questions_change,
                ROUND(cp.completed * 100.0 / NULLIF(cp.sessions, 0), 2) as current_completion_rate,
                ROUND(pp.completed * 100.0 / NULLIF(pp.sessions, 0), 2) as previous_completion_rate
            FROM current_period cp
            CROSS JOIN previous_period pp
        `;
        
        return this.findOne(query, [planId, days]);
    }

    // ======================== DASHBOARD MÉTRICAS ========================

    /**
     * Métricas principais para dashboard
     */
    async getDashboardMetrics(planId, userId) {
        const query = `
            SELECT 
                -- Progresso Geral
                (SELECT COUNT(*) FROM topics t 
                 JOIN subjects s ON t.subject_id = s.id 
                 WHERE s.study_plan_id = $1) as total_topics,
                 
                (SELECT COUNT(*) FROM topics t 
                 JOIN subjects s ON t.subject_id = s.id 
                 WHERE s.study_plan_id = $1 AND t.completed = 1) as completed_topics,
                
                -- Tempo de Estudo
                (SELECT COALESCE(SUM(time_studied_seconds), 0) 
                 FROM study_sessions 
                 WHERE study_plan_id = $1) as total_study_seconds,
                
                -- Questões
                (SELECT COALESCE(SUM(questions_solved), 0) 
                 FROM study_sessions 
                 WHERE study_plan_id = $1) as total_questions,
                
                -- Sessões Hoje
                (SELECT COUNT(*) 
                 FROM study_sessions 
                 WHERE study_plan_id = $1 
                   AND DATE(session_date) = DATE('now')) as sessions_today,
                
                -- Próxima Sessão
                (SELECT MIN(session_date) 
                 FROM study_sessions 
                 WHERE study_plan_id = $1 
                   AND status = 'pending' 
                   AND session_date >= CURRENT_TIMESTAMP) as next_session,
                
                -- Dias até o exame
                (SELECT JULIANDAY(exam_date) - JULIANDAY(DATE('now')) 
                 FROM study_plans 
                 WHERE id = $1 AND user_id = $2) as days_until_exam,
                
                -- Taxa de Conclusão Semanal
                (SELECT ROUND(
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0), 2)
                 FROM study_sessions 
                 WHERE study_plan_id = $1 
                   AND session_date >= DATE('now', '-7 days')) as weekly_completion_rate
        `;
        
        return this.findOne(query, [planId, userId]);
    }

    // ======================== RELATÓRIOS ========================

    /**
     * Gera relatório completo de progresso
     */
    async generateProgressReport(planId, userId) {
        // Combina múltiplas métricas em um relatório completo
        const [
            comprehensiveStats,
            detailedProgress,
            weeklyMatrix,
            questionRadar,
            goalProgress,
            timeDistribution
        ] = await Promise.all([
            this.getPlanComprehensiveStats(planId, userId),
            this.getDetailedProgress(planId),
            this.getWeeklyProgressMatrix(planId, 4),
            this.getQuestionRadar(planId),
            this.getGoalProgress(planId),
            this.getStudyTimeDistribution(planId)
        ]);

        return {
            summary: comprehensiveStats,
            subjects: detailedProgress,
            weekly_progress: weeklyMatrix,
            weak_points: questionRadar,
            goals: goalProgress,
            time_analysis: timeDistribution,
            generated_at: new Date().toISOString()
        };
    }
}

module.exports = StatisticsRepository;