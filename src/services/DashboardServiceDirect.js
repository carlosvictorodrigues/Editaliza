/**
 * Dashboard Service Direct - Versão simplificada e funcional
 * Busca dados diretamente do banco sem múltiplas instâncias
 */

const db = require('../../database-postgresql.js');

class DashboardServiceDirect {
    
    /**
     * Busca todos os dados do dashboard de uma vez só
     */
    static async getDashboardData(planId, userId) {
        try {
            console.log(`[DASHBOARD] Buscando dados para plano ${planId}, usuário ${userId}`);
            
            // 1. Buscar dados do plano
            const planQuery = `
                SELECT id, plan_name, exam_date, created_at, 
                       daily_question_goal, weekly_question_goal
                FROM study_plans 
                WHERE id = $1 AND user_id = $2
            `;
            const planResult = await db.get(planQuery, [planId, userId]);
            
            if (!planResult) {
                throw new Error('Plano não encontrado');
            }
            
            console.log('[DASHBOARD] Plano encontrado:', planResult.plan_name);
            
            // 2. Buscar total de tópicos
            const topicsQuery = `
                SELECT COUNT(t.id) as total_topics
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = $1
            `;
            const topicsResult = await db.get(topicsQuery, [planId]);
            const totalTopics = parseInt(topicsResult?.total_topics || 0);
            
            console.log('[DASHBOARD] Total de tópicos:', totalTopics);
            
            // 3. Buscar sessões e calcular estatísticas
            const sessionsQuery = `
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_sessions,
                    COUNT(CASE WHEN session_type = 'Novo Tópico' THEN 1 END) as study_sessions,
                    COUNT(CASE WHEN session_type LIKE 'Revisão%' THEN 1 END) as revision_sessions,
                    COUNT(DISTINCT CASE WHEN status = 'Concluído' AND topic_id IS NOT NULL THEN topic_id END) as completed_topics
                FROM study_sessions
                WHERE study_plan_id = $1
            `;
            const sessionsResult = await db.get(sessionsQuery, [planId]);
            
            console.log('[DASHBOARD] Estatísticas de sessões:', sessionsResult);
            
            // 4. Buscar revisões pendentes
            const revisionsQuery = `
                SELECT 
                    session_type,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed,
                    COUNT(CASE WHEN status != 'Concluído' AND session_date < CURRENT_DATE THEN 1 END) as overdue
                FROM study_sessions
                WHERE study_plan_id = $1 
                    AND session_type IN ('Revisão 7d', 'Revisão 14d', 'Revisão 28d')
                GROUP BY session_type
            `;
            const revisionsResult = await db.all(revisionsQuery, [planId]);
            
            console.log('[DASHBOARD] Revisões:', revisionsResult);
            
            // 5. Calcular ritmo de estudo (últimos 7 dias)
            const paceQuery = `
                SELECT COUNT(DISTINCT topic_id) as topics_last_7_days
                FROM study_sessions
                WHERE study_plan_id = $1 
                    AND status = 'Concluído' 
                    AND topic_id IS NOT NULL
                    AND completed_at >= CURRENT_DATE - INTERVAL '7 days'
            `;
            const paceResult = await db.get(paceQuery, [planId]);
            const topicsLast7Days = parseInt(paceResult?.topics_last_7_days || 0);
            const averagePace = topicsLast7Days / 7;
            
            console.log('[DASHBOARD] Ritmo últimos 7 dias:', averagePace);
            
            // 6. Calcular métricas derivadas
            const completedTopics = parseInt(sessionsResult?.completed_topics || 0);
            const completedSessions = parseInt(sessionsResult?.completed_sessions || 0);
            const totalSessions = parseInt(sessionsResult?.total_sessions || 0);
            
            const examDate = new Date(planResult.exam_date);
            const today = new Date();
            const daysRemaining = Math.max(0, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
            
            const pendingTopics = Math.max(0, totalTopics - completedTopics);
            const requiredPace = daysRemaining > 0 ? pendingTopics / daysRemaining : 0;
            
            const completionPercentage = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;
            const coveragePercentage = totalTopics > 0 ? (totalSessions / totalTopics) * 100 : Math.min(100, totalSessions * 2);
            
            // 7. Organizar dados de revisão
            const revisionCycles = {
                '7d': { scheduled: 0, completed: 0, overdue: 0 },
                '14d': { scheduled: 0, completed: 0, overdue: 0 },
                '28d': { scheduled: 0, completed: 0, overdue: 0 }
            };
            
            revisionsResult.forEach(rev => {
                const cycle = rev.session_type.replace('Revisão ', '');
                if (revisionCycles[cycle]) {
                    revisionCycles[cycle] = {
                        scheduled: parseInt(rev.total || 0),
                        completed: parseInt(rev.completed || 0),
                        overdue: parseInt(rev.overdue || 0)
                    };
                }
            });
            
            const totalDebt = Object.values(revisionCycles).reduce((sum, cycle) => sum + cycle.overdue, 0);
            
            // 8. Determinar status e mensagem
            let status, statusColor, headline, subtext;
            
            if (averagePace >= requiredPace) {
                status = 'EXCELLENT';
                statusColor = 'on-track';
                headline = 'Excelente trabalho!';
                subtext = `Mantendo este ritmo, você concluirá 100% do edital.`;
            } else if (averagePace >= requiredPace * 0.7) {
                status = 'ATTENTION';
                statusColor = 'attention-needed';
                headline = 'Atenção ao ritmo';
                subtext = `Aumente ${(requiredPace - averagePace).toFixed(1)} tópicos/dia para manter o prazo.`;
            } else {
                status = 'OFF_TRACK';
                statusColor = 'off-track';
                headline = 'Ritmo abaixo do necessário';
                subtext = `Você precisa estudar ${requiredPace.toFixed(1)} tópicos/dia para concluir a tempo.`;
            }
            
            // 9. Buscar dados de gamificação
            const gamificationQuery = `
                SELECT 
                    COUNT(DISTINCT CASE WHEN ss.status IN ('Concluído', 'Concluída', 'Concluida', 'completed') AND ss.topic_id IS NOT NULL THEN ss.topic_id END) as completed_topics_count,
                    COUNT(DISTINCT DATE(ss.session_date)) as unique_study_days,
                    COUNT(CASE WHEN ss.status IN ('Concluído', 'Concluída', 'Concluida', 'completed') THEN 1 END) as total_completed_sessions
                FROM study_sessions ss
                WHERE ss.user_id = $1
            `;
            const gamificationResult = await db.get(gamificationQuery, [userId]);
            
            const completedTopicsForXP = parseInt(gamificationResult?.completed_topics_count || 0);
            const uniqueStudyDays = parseInt(gamificationResult?.unique_study_days || 0);
            const totalCompletedSessions = parseInt(gamificationResult?.total_completed_sessions || 0);
            
            // Calcular XP
            const experiencePoints = (completedTopicsForXP * 10) + (uniqueStudyDays * 5);
            
            console.log('[DASHBOARD] Gamificação - XP:', experiencePoints, 'Tópicos:', completedTopicsForXP, 'Dias:', uniqueStudyDays);
            
            // 10. Montar resposta final
            const response = {
                planId: parseInt(planId),
                asOf: new Date().toISOString(),
                exam: {
                    date: planResult.exam_date,
                    daysRemaining: daysRemaining
                },
                schedule: {
                    totalTopics: totalTopics,
                    scheduledTopics: parseInt(sessionsResult?.study_sessions || 0),
                    unscheduledTopics: Math.max(0, totalTopics - parseInt(sessionsResult?.study_sessions || 0)),
                    coveragePct: parseFloat(coveragePercentage.toFixed(1))
                },
                progress: {
                    completedTopics: completedTopics,
                    completedPct: parseFloat(completionPercentage.toFixed(1)),
                    pendingTopics: pendingTopics,
                    sessions: {
                        studyInitialCount: parseInt(sessionsResult?.study_sessions || 0),
                        revisionCount: parseInt(sessionsResult?.revision_sessions || 0),
                        sessionsCompleted: completedSessions
                    }
                },
                revisions: {
                    cycles: [
                        { label: '7d', ...revisionCycles['7d'] },
                        { label: '14d', ...revisionCycles['14d'] },
                        { label: '28d', ...revisionCycles['28d'] }
                    ],
                    debt: totalDebt
                },
                simulations: {
                    directed: 0,
                    general: 0,
                    total: 0
                },
                pace: {
                    currentTopicsPerDay: parseFloat(averagePace.toFixed(2)),
                    last7Avg: parseFloat(averagePace.toFixed(2)),
                    last14Avg: 0, // Simplificado por enquanto
                    requiredTopicsPerDay: parseFloat(requiredPace.toFixed(2))
                },
                projection: {
                    onTrack: averagePace >= requiredPace,
                    forecastDate: averagePace > 0 ? 
                        new Date(Date.now() + (pendingTopics / averagePace) * 24 * 60 * 60 * 1000).toISOString() : 
                        null,
                    deficitPerDay: parseFloat(Math.max(0, requiredPace - averagePace).toFixed(2)),
                    message: status
                },
                uiHints: {
                    statusColor: statusColor,
                    headline: headline,
                    subtext: subtext
                },
                // Dados de gamificação
                gamification: {
                    xp: experiencePoints,
                    experiencePoints: experiencePoints,
                    totalXP: experiencePoints,
                    completedTopicsCount: completedTopicsForXP,
                    completed_topics_count: completedTopicsForXP, // Adicionar formato alternativo
                    totalStudyDays: uniqueStudyDays,
                    totalCompletedSessions: totalCompletedSessions,
                    studyStreak: uniqueStudyDays, // Simplificado por enquanto
                    current_streak: uniqueStudyDays, // Formato alternativo
                    currentStreak: uniqueStudyDays,
                    achievements: [], // Será preenchido depois se necessário
                    level: Math.ceil(uniqueStudyDays / 7) || 1,
                    concurseiroLevel: completedTopicsForXP < 10 ? 'Pagador de Inscrição 💸' : 'Sobrevivente do Primeiro PDF 📄',
                    // Adicionar informações de nível estruturadas
                    level_info: {
                        title: completedTopicsForXP < 10 ? 'Pagador de Inscrição 💸' : 'Sobrevivente do Primeiro PDF 📄',
                        level: 1,
                        color: '#3B82F6',
                        phrase: 'A jornada dos mil editais começa com o primeiro boleto!',
                        icon: '💸',
                        emoji: '🌟',
                        next_level_info: {
                            title: 'Sobrevivente do Primeiro PDF 📄',
                            threshold: 11
                        }
                    },
                    nextLevel: 'Sobrevivente do Primeiro PDF 📄'
                },
                // Dados extras úteis
                plan: {
                    name: planResult.plan_name,
                    dailyGoal: planResult.daily_question_goal || 50,
                    weeklyGoal: planResult.weekly_question_goal || 300
                }
            };
            
            console.log('[DASHBOARD] Resposta montada com sucesso');
            return response;
            
        } catch (error) {
            console.error('[DASHBOARD] Erro ao buscar dados:', error);
            throw error;
        }
    }
}

module.exports = DashboardServiceDirect;