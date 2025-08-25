// ============================================================================
// STATISTICS CONTROLLER - PHASE 6 OF MODULAR MIGRATION
// ============================================================================
// Complex statistics endpoints with CTEs, recursive queries and analytics
// CRITICAL: All CTEs and complex queries MUST be preserved exactly
// CRITICAL: Performance optimizations cannot be modified

const { dbGet, dbAll, getBrazilianDateString } = require('../config/database');

/**
 * GET /api/plans/:planId/statistics
 * Complex statistics with CTE and recursive queries for study streaks
 * CRITICAL: Contains recursive CTE - DO NOT SIMPLIFY
 */
const getPlanStatistics = async (req, res) => {
    try {
        const planId = req.params.planId;
        
        // Verificar se o plano pertence ao usuário
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
        }
        
        // 1. Total de dias com estudo
        const totalDaysResult = await dbGet(`
            SELECT COUNT(DISTINCT DATE(session_date)) as total_days
            FROM study_sessions
            WHERE study_plan_id = ?
            AND (time_studied_seconds > 0 OR status = 'completed')
        `, [planId]);
        
        const totalStudyDays = totalDaysResult?.total_days || 0;
        
        // 2. Calcular sequência atual (streak) - dias consecutivos de estudo
        // CRITICAL: This is a RECURSIVE CTE - preserve character-by-character
        const streakQuery = `
            WITH RECURSIVE study_dates AS (
                -- Obter todas as datas com estudo
                SELECT DISTINCT DATE(session_date) as study_date
                FROM study_sessions
                WHERE study_plan_id = ?
                AND (time_studied_seconds > 0 OR status = 'completed')
            ),
            recent_dates AS (
                -- Obter datas recentes ordenadas
                SELECT study_date
                FROM study_dates
                WHERE study_date <= CURRENT_DATE
                ORDER BY study_date DESC
            ),
            streak_calc AS (
                -- Calcular sequência
                SELECT 
                    study_date,
                    study_date - (ROW_NUMBER() OVER (ORDER BY study_date DESC) - 1) * INTERVAL '1 day' as group_date
                FROM recent_dates
            )
            SELECT COUNT(*) as current_streak
            FROM streak_calc
            WHERE group_date = (
                SELECT MAX(group_date) 
                FROM streak_calc 
                WHERE study_date >= CURRENT_DATE - INTERVAL '1 day'
            )
        `;
        
        let currentStreak = 0;
        try {
            const streakResult = await dbGet(streakQuery, [planId]);
            currentStreak = streakResult?.current_streak || 0;
        } catch (streakError) {
            // Fallback: cálculo simplificado se a query recursiva falhar
            console.log('Usando cálculo simplificado de streak');
            const simplifiedStreak = await dbGet(`
                SELECT COUNT(DISTINCT DATE(session_date)) as streak
                FROM study_sessions
                WHERE study_plan_id = ?
                AND (time_studied_seconds > 0 OR status = 'completed')
                AND session_date >= CURRENT_DATE - INTERVAL '7 days'
            `, [planId]);
            currentStreak = Math.min(simplifiedStreak?.streak || 0, 7);
        }
        
        // 3. Total de horas estudadas
        const totalHoursResult = await dbGet(`
            SELECT 
                COALESCE(SUM(time_studied_seconds) / 3600.0, 0) as total_hours,
                COUNT(CASE WHEN time_studied_seconds > 0 OR status = 'completed' THEN 1 END) as completed_sessions,
                COUNT(*) as total_sessions
            FROM study_sessions
            WHERE study_plan_id = ?
        `, [planId]);
        
        // 4. Média de estudo por dia
        const avgStudyResult = await dbGet(`
            SELECT 
                AVG(daily_seconds) / 3600.0 as avg_hours_per_day
            FROM (
                SELECT 
                    DATE(session_date) as study_date,
                    SUM(time_studied_seconds) as daily_seconds
                FROM study_sessions
                WHERE study_plan_id = ?
                AND time_studied_seconds > 0
                GROUP BY DATE(session_date)
            ) as daily_stats
        `, [planId]);
        
        // 5. Melhor dia da semana para estudo
        const bestDayResult = await dbGet(`
            SELECT 
                EXTRACT(DOW FROM session_date) as day_of_week,
                COUNT(*) as sessions_count
            FROM study_sessions
            WHERE study_plan_id = ?
            AND (time_studied_seconds > 0 OR status = 'completed')
            GROUP BY EXTRACT(DOW FROM session_date)
            ORDER BY sessions_count DESC
            LIMIT 1
        `, [planId]);
        
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const bestDay = bestDayResult ? daysOfWeek[bestDayResult.day_of_week] : null;
        
        // 6. Progresso geral
        const progressPercent = totalHoursResult.total_sessions > 0 
            ? Math.round((totalHoursResult.completed_sessions / totalHoursResult.total_sessions) * 100)
            : 0;
        
        res.json({
            totalStudyDays,
            currentStreak,
            totalHours: parseFloat(totalHoursResult.total_hours).toFixed(1),
            completedSessions: totalHoursResult.completed_sessions,
            totalSessions: totalHoursResult.total_sessions,
            progressPercent,
            avgHoursPerDay: parseFloat(avgStudyResult?.avg_hours_per_day || 0).toFixed(1),
            bestStudyDay: bestDay,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
    }
};

/**
 * GET /api/plans/:planId/detailed_progress
 * Complex detailed progress analytics with time breakdowns
 * CRITICAL: Contains complex JOINs and aggregations - preserve exactly
 */
const getDetailedProgress = async (req, res) => {
    const planId = req.params.planId;
    const userId = req.user.id;
    
    try {
        const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
        if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

        // Obter dados básicos de tópicos e disciplinas
        const subjects = await dbAll('SELECT id, subject_name FROM subjects WHERE study_plan_id = ?', [planId]);
        
        // CORREÇÃO: Query melhorada para capturar tempo de estudo de sessões concluídas
        // CRITICAL: This complex LEFT JOIN must be preserved exactly
        const topics = await dbAll(`
            SELECT 
                t.id, t.description, t.status, t.subject_id, 
                COALESCE(ss.total_time, 0) as time_studied 
            FROM topics t 
            LEFT JOIN (
                SELECT 
                    topic_id, 
                    SUM(COALESCE(time_studied_seconds, 0)) as total_time 
                FROM study_sessions 
                WHERE study_plan_id = ? 
                    AND topic_id IS NOT NULL
                    AND status = 'Concluído'
                    AND time_studied_seconds > 0
                GROUP BY topic_id
            ) ss ON t.id = ss.topic_id 
            WHERE t.subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)
        `, [planId, planId]);
        
        // CORREÇÃO: Também capturar tempo de estudo de sessões por disciplina que não têm topic_id
        // CRITICAL: This LEFT JOIN calculation is performance-critical
        const subjectStudyTime = await dbAll(`
            SELECT 
                s.id as subject_id,
                s.subject_name,
                COALESCE(SUM(ss.time_studied_seconds), 0) as additional_time
            FROM subjects s
            LEFT JOIN study_sessions ss ON s.subject_name = ss.subject_name
            WHERE s.study_plan_id = ? 
                AND ss.study_plan_id = ?
                AND ss.status = 'Concluído'
                AND ss.time_studied_seconds > 0
                AND (ss.topic_id IS NULL OR ss.topic_id = '')
            GROUP BY s.id, s.subject_name
        `, [planId, planId]);

        // Calcular estatísticas de atividades
        // CRITICAL: This GROUP BY aggregation drives the entire activity breakdown
        const activityStats = await dbAll(`
            SELECT 
                session_type,
                COUNT(*) as total_sessions,
                SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as completed_sessions,
                SUM(COALESCE(time_studied_seconds, 0)) as total_time_seconds
            FROM study_sessions 
            WHERE study_plan_id = ?
            GROUP BY session_type
        `, [planId]);

        // Organizar estatísticas por tipo de atividade
        const activityBreakdown = {
            revisoes_7d: { completed: 0, total: 0, timeSpent: 0 },
            revisoes_14d: { completed: 0, total: 0, timeSpent: 0 },
            revisoes_28d: { completed: 0, total: 0, timeSpent: 0 },
            simulados_direcionados: { completed: 0, total: 0, timeSpent: 0 },
            simulados_completos: { completed: 0, total: 0, timeSpent: 0 },
            redacoes: { completed: 0, total: 0, timeSpent: 0 },
            novos_topicos: { completed: 0, total: 0, timeSpent: 0 }
        };

        // CRITICAL: This mapping logic is essential for activity categorization
        activityStats.forEach(stat => {
            const sessionType = stat.session_type;
            if (sessionType === 'Revisão 7D') {
                activityBreakdown.revisoes_7d = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Revisão 14D') {
                activityBreakdown.revisoes_14d = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Revisão 28D') {
                activityBreakdown.revisoes_28d = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Simulado Direcionado') {
                activityBreakdown.simulados_direcionados = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Simulado Completo') {
                activityBreakdown.simulados_completos = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Redação') {
                activityBreakdown.redacoes = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            } else if (sessionType === 'Novo Tópico') {
                activityBreakdown.novos_topicos = {
                    completed: stat.completed_sessions,
                    total: stat.total_sessions,
                    timeSpent: stat.total_time_seconds
                };
            }
        });

        // Calcular tempo total de revisões vs conteúdo novo
        const totalReviewTime = activityBreakdown.revisoes_7d.timeSpent + 
                               activityBreakdown.revisoes_14d.timeSpent + 
                               activityBreakdown.revisoes_28d.timeSpent;
        const totalNewContentTime = activityBreakdown.novos_topicos.timeSpent;
        
        // CORREÇÃO: Incluir TODOS os tipos de sessão no tempo total
        const totalStudyTime = totalReviewTime + 
                             totalNewContentTime + 
                             activityBreakdown.simulados_direcionados.timeSpent + 
                             activityBreakdown.simulados_completos.timeSpent + 
                             activityBreakdown.redacoes.timeSpent;
        
        console.log(`📊 Tempo total calculado: revisões=${totalReviewTime}s, novos=${totalNewContentTime}s, simulados_dir=${activityBreakdown.simulados_direcionados.timeSpent}s, simulados_comp=${activityBreakdown.simulados_completos.timeSpent}s, redações=${activityBreakdown.redacoes.timeSpent}s, TOTAL=${totalStudyTime}s`);

        // CORREÇÃO: Melhorar cálculo de tempo total por disciplina incluindo tempo adicional
        const subjectData = subjects.map(subject => {
            const subjectTopics = topics.filter(t => t.subject_id === subject.id);
            const completedTopics = subjectTopics.filter(t => t.status === 'Concluído').length;
            
            // Tempo dos tópicos específicos
            const topicsTime = subjectTopics.reduce((sum, t) => sum + t.time_studied, 0);
            
            // Tempo adicional de sessões da disciplina sem topic_id específico
            const additionalTime = subjectStudyTime.find(st => st.subject_id === subject.id)?.additional_time || 0;
            
            // Tempo total = tempo dos tópicos + tempo adicional da disciplina
            const totalTime = topicsTime + additionalTime;
            
            console.log(`📊 Disciplina ${subject.subject_name}: tópicos=${topicsTime}s, adicional=${additionalTime}s, total=${totalTime}s`);

            return {
                id: subject.id,
                name: subject.subject_name,
                progress: subjectTopics.length > 0 ? (completedTopics / subjectTopics.length) * 100 : 0,
                totalTime: totalTime, // Tempo total corrigido
                topics: subjectTopics.map(t => ({
                    id: t.id,
                    description: t.description,
                    status: t.status,
                    timeStudied: t.time_studied
                }))
            };
        });

        const totalTopicsInPlan = topics.length;
        const totalCompletedTopics = topics.filter(t => t.status === 'Concluído').length;
        const totalProgress = totalTopicsInPlan > 0 ? (totalCompletedTopics / totalTopicsInPlan) * 100 : 0;

        res.json({
            totalProgress,
            subjectDetails: subjectData,
            activityStats: {
                revisoes_7d: {
                    completed: activityBreakdown.revisoes_7d.completed,
                    total: activityBreakdown.revisoes_7d.total,
                    completionRate: activityBreakdown.revisoes_7d.total > 0 ? 
                        (activityBreakdown.revisoes_7d.completed / activityBreakdown.revisoes_7d.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.revisoes_7d.timeSpent
                },
                revisoes_14d: {
                    completed: activityBreakdown.revisoes_14d.completed,
                    total: activityBreakdown.revisoes_14d.total,
                    completionRate: activityBreakdown.revisoes_14d.total > 0 ? 
                        (activityBreakdown.revisoes_14d.completed / activityBreakdown.revisoes_14d.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.revisoes_14d.timeSpent
                },
                revisoes_28d: {
                    completed: activityBreakdown.revisoes_28d.completed,
                    total: activityBreakdown.revisoes_28d.total,
                    completionRate: activityBreakdown.revisoes_28d.total > 0 ? 
                        (activityBreakdown.revisoes_28d.completed / activityBreakdown.revisoes_28d.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.revisoes_28d.timeSpent
                },
                simulados_direcionados: {
                    completed: activityBreakdown.simulados_direcionados.completed,
                    total: activityBreakdown.simulados_direcionados.total,
                    completionRate: activityBreakdown.simulados_direcionados.total > 0 ? 
                        (activityBreakdown.simulados_direcionados.completed / activityBreakdown.simulados_direcionados.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.simulados_direcionados.timeSpent
                },
                simulados_completos: {
                    completed: activityBreakdown.simulados_completos.completed,
                    total: activityBreakdown.simulados_completos.total,
                    completionRate: activityBreakdown.simulados_completos.total > 0 ? 
                        (activityBreakdown.simulados_completos.completed / activityBreakdown.simulados_completos.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.simulados_completos.timeSpent
                },
                redacoes: {
                    completed: activityBreakdown.redacoes.completed,
                    total: activityBreakdown.redacoes.total,
                    completionRate: activityBreakdown.redacoes.total > 0 ? 
                        (activityBreakdown.redacoes.completed / activityBreakdown.redacoes.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.redacoes.timeSpent
                },
                novos_topicos: {
                    completed: activityBreakdown.novos_topicos.completed,
                    total: activityBreakdown.novos_topicos.total,
                    completionRate: activityBreakdown.novos_topicos.total > 0 ? 
                        (activityBreakdown.novos_topicos.completed / activityBreakdown.novos_topicos.total * 100).toFixed(1) : 0,
                    timeSpent: activityBreakdown.novos_topicos.timeSpent
                }
            },
            timeBreakdown: {
                totalReviewTime: totalReviewTime,
                totalNewContentTime: totalNewContentTime,
                totalStudyTime: totalStudyTime,
                reviewPercentage: totalStudyTime > 0 ? (totalReviewTime / totalStudyTime * 100).toFixed(1) : 0,
                newContentPercentage: totalStudyTime > 0 ? (totalNewContentTime / totalStudyTime * 100).toFixed(1) : 0
            }
        });

    } catch (error) {
        console.error('Erro ao buscar progresso detalhado:', error);
        res.status(500).json({ 'error': 'Erro ao buscar progresso detalhado' });
    }
};

/**
 * GET /api/plans/:planId/share-progress
 * Statistics for sharing progress with gamification
 */
const getShareProgress = async (req, res) => {
    const planId = req.params.planId;
    const userId = req.user.id;

    try {
        const plan = await dbGet('SELECT plan_name, exam_date FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
        if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

        const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);

        // Pegar dados de gamificação
        // CORREÇÃO: Contar tópicos únicos concluídos independente do session_type
        const completedTopicsResult = await dbGet(`
            SELECT COUNT(DISTINCT topic_id) as count 
            FROM study_sessions 
            WHERE study_plan_id = ? 
            AND status = 'Concluído' 
            AND topic_id IS NOT NULL
        `, [planId]);
        const completedTopicsCount = parseInt(completedTopicsResult?.count || 0);
        
        // Debug: Log para verificar o que está sendo calculado
        console.log(`[GAMIFICATION DEBUG] Plan ${planId}:`, {
            completedTopicsCount,
            queryResult: completedTopicsResult
        });

        // Calcular streak
        const completedSessions = await dbAll(`
            SELECT DISTINCT session_date FROM study_sessions 
            WHERE study_plan_id = ? AND status = 'Concluído' ORDER BY session_date DESC
        `, [planId]);
        
        let studyStreak = 0;
        if (completedSessions.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
            
            if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
                studyStreak = 1;
                let currentDate = new Date(lastStudyDate);
                for (let i = 1; i < completedSessions.length; i++) {
                    const prevDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                    const dayDifference = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
                    
                    if (dayDifference === 1) {
                        studyStreak++;
                        currentDate = prevDate;
                    } else {
                        break;
                    }
                }
            }
        }

        // Calcular tempo total estudado (em horas)
        const totalTimeResult = await dbGet(`
            SELECT COALESCE(SUM(time_studied_seconds), 0) / 3600.0 as total_hours 
            FROM study_sessions 
            WHERE study_plan_id = ? AND status = 'Concluído'
        `, [planId]);
        const totalHours = Math.round(totalTimeResult?.total_hours || 0);

        // Determinar nível baseado em tópicos concluídos
        let level = 1;
        let levelName = 'Iniciante';
        let nextLevelTopics = 10;
        let progress = 0;

        if (completedTopicsCount >= 200) {
            level = 10;
            levelName = 'Especialista Supremo';
            nextLevelTopics = completedTopicsCount;
            progress = 100;
        } else if (completedTopicsCount >= 150) {
            level = 9;
            levelName = 'Especialista';
            nextLevelTopics = 200;
            progress = ((completedTopicsCount - 150) / 50) * 100;
        } else if (completedTopicsCount >= 100) {
            level = 8;
            levelName = 'Expert';
            nextLevelTopics = 150;
            progress = ((completedTopicsCount - 100) / 50) * 100;
        } else if (completedTopicsCount >= 75) {
            level = 7;
            levelName = 'Avançado+';
            nextLevelTopics = 100;
            progress = ((completedTopicsCount - 75) / 25) * 100;
        } else if (completedTopicsCount >= 50) {
            level = 6;
            levelName = 'Avançado';
            nextLevelTopics = 75;
            progress = ((completedTopicsCount - 50) / 25) * 100;
        } else if (completedTopicsCount >= 35) {
            level = 5;
            levelName = 'Intermediário+';
            nextLevelTopics = 50;
            progress = ((completedTopicsCount - 35) / 15) * 100;
        } else if (completedTopicsCount >= 25) {
            level = 4;
            levelName = 'Intermediário';
            nextLevelTopics = 35;
            progress = ((completedTopicsCount - 25) / 10) * 100;
        } else if (completedTopicsCount >= 15) {
            level = 3;
            levelName = 'Básico+';
            nextLevelTopics = 25;
            progress = ((completedTopicsCount - 15) / 10) * 100;
        } else if (completedTopicsCount >= 10) {
            level = 2;
            levelName = 'Básico';
            nextLevelTopics = 15;
            progress = ((completedTopicsCount - 10) / 5) * 100;
        } else {
            level = 1;
            levelName = 'Iniciante';
            nextLevelTopics = 10;
            progress = (completedTopicsCount / 10) * 100;
        }

        // Determinar conquistas
        const achievements = [];
        if (completedTopicsCount >= 10) achievements.push({ name: 'Primeiro Marco', description: '10 tópicos concluídos' });
        if (completedTopicsCount >= 25) achievements.push({ name: 'Quartelão', description: '25 tópicos concluídos' });
        if (completedTopicsCount >= 50) achievements.push({ name: 'Meio Centenário', description: '50 tópicos concluídos' });
        if (completedTopicsCount >= 100) achievements.push({ name: 'Centenário', description: '100 tópicos concluídos' });
        if (studyStreak >= 7) achievements.push({ name: 'Semana Dedicada', description: '7 dias de estudo consecutivos' });
        if (studyStreak >= 30) achievements.push({ name: 'Mês Focado', description: '30 dias de estudo consecutivos' });
        if (totalHours >= 100) achievements.push({ name: 'Cem Horas', description: '100 horas de estudo' });

        // Estatísticas para compartilhamento
        const shareData = {
            userName: user?.name || 'Estudante',
            planName: plan.plan_name,
            examDate: plan.exam_date,
            level,
            levelName,
            completedTopics: completedTopicsCount,
            nextLevelTopics,
            levelProgress: Math.round(progress),
            studyStreak,
            totalHours,
            achievements,
            totalAchievements: achievements.length
        };

        console.log('[GAMIFICATION FINAL] Dados de compartilhamento:', shareData);
        res.json(shareData);

    } catch (error) {
        console.error('Erro ao buscar dados para compartilhamento:', error);
        res.status(500).json({ 'error': 'Erro ao buscar dados para compartilhamento' });
    }
};

/**
 * GET /metrics
 * System metrics endpoint (protected)
 */
const getMetrics = (req, res) => {
    try {
        const { getMetricsReport } = require('../middleware/metrics');
        const report = getMetricsReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao coletar métricas' });
    }
};

/**
 * GET /api/plans/:planId/goal_progress
 * Get daily and weekly question goal progress statistics
 */
const getGoalProgress = async (req, res) => {
    const planId = req.params.planId;
    const today = getBrazilianDateString();
    // Usar data brasileira para calcular dia da semana
    const brazilDate = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
    const dayOfWeek = brazilDate.getDay();
    const firstDayOfWeek = new Date();
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const firstDayOfWeekStr = firstDayOfWeek.toISOString().split('T')[0];
    
    try {
        const plan = await dbGet('SELECT daily_question_goal, weekly_question_goal FROM study_plans WHERE id = ?', [planId]);
        if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
        
        const dailyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, today]);
        const weeklyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date >= ? AND session_date <= ?', [planId, firstDayOfWeekStr, today]);
        
        res.json({
            dailyGoal: plan.daily_question_goal,
            dailyProgress: dailyResult.total || 0,
            weeklyGoal: plan.weekly_question_goal,
            weeklyProgress: weeklyResult.total || 0
        });
    } catch (error) {
        console.error('Erro ao buscar progresso de metas:', error);
        res.status(500).json({ error: 'Erro ao buscar progresso de metas' });
    }
};

/**
 * GET /api/plans/:planId/question_radar
 * Question radar - identify weak points with HAVING clause
 * CRITICAL: Contains complex JOIN and HAVING - preserve exactly
 */
const getQuestionRadar = async (req, res) => {
    const todayStr = getBrazilianDateString();
    // CRITICAL: This complex query with JOINs and HAVING must be preserved
    const sql = `
        SELECT t.description as topic_description, s.subject_name, COALESCE(SUM(ss.questions_solved), 0) as total_questions
        FROM topics t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN study_sessions ss ON t.id = ss.topic_id AND s.study_plan_id = ss.study_plan_id
        WHERE s.study_plan_id = ? 
          AND t.id IN (SELECT DISTINCT topic_id FROM study_sessions WHERE study_plan_id = ? AND session_date <= ? AND topic_id IS NOT NULL)
        GROUP BY t.id
        HAVING total_questions < 10
        ORDER BY total_questions ASC, s.subject_name
    `;
    
    try {
        const rows = await dbAll(sql, [req.params.planId, req.params.planId, todayStr]);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar radar de questões:', error);
        res.status(500).json({ 'error': 'Erro ao buscar radar de questões' });
    }
};

module.exports = {
    getPlanStatistics,
    getDetailedProgress,
    getShareProgress,
    getMetrics,
    getGoalProgress,
    getQuestionRadar
};