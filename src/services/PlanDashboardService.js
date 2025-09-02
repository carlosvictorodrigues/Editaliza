const dayjs = require('dayjs');
const PlanService = require('./planService');
const SessionService = require('./sessionService');

class PlanDashboardService {
    /**
     * Obtém dados consolidados do dashboard para um plano
     * @param {number} planId - ID do plano
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} Dados completos do dashboard
     */
    static async getDashboard(planId, userId) {
        try {
            // Buscar dados em paralelo para melhor performance
            const [
                planDetails,
                scheduleData,
                progressData,
                revisionStats,
                simulationCounts,
                paceData
            ] = await Promise.all([
                this.getPlanDetails(planId, userId),
                this.getScheduleData(planId),
                this.getProgressData(planId),
                this.getRevisionStats(planId),
                this.getSimulationCounts(planId),
                this.getPaceData(planId)
            ]);

            // Calcular métricas derivadas
            const metrics = this.calculateMetrics({
                planDetails,
                scheduleData,
                progressData,
                paceData
            });

            // Montar resposta completa
            return {
                planId,
                asOf: new Date().toISOString(),
                exam: {
                    date: planDetails.examDate,
                    daysRemaining: this.calculateDaysRemaining(planDetails.examDate)
                },
                schedule: {
                    totalTopics: scheduleData.totalTopics,
                    scheduledTopics: scheduleData.scheduledTopics,
                    unscheduledTopics: scheduleData.unscheduledTopics,
                    coveragePct: this.round2((scheduleData.scheduledTopics / scheduleData.totalTopics) * 100)
                },
                progress: {
                    completedTopics: progressData.completedTopics,
                    completedPct: this.round2((progressData.completedTopics / scheduleData.totalTopics) * 100),
                    pendingTopics: Math.max(scheduleData.totalTopics - progressData.completedTopics, 0),
                    sessions: {
                        studyInitialCount: progressData.studyInitialCount || 0,
                        revisionCount: progressData.revisionCount || 0,
                        sessionsCompleted: progressData.sessionsCompleted || 0
                    }
                },
                revisions: revisionStats,
                simulations: simulationCounts,
                pace: metrics.pace,
                projection: metrics.projection,
                uiHints: metrics.uiHints
            };
        } catch (error) {
            console.error('Erro ao buscar dados do dashboard:', error);
            throw error;
        }
    }

    /**
     * Busca detalhes básicos do plano
     */
    static async getPlanDetails(planId, userId) {
        try {
            // Usar repositories globais e db
            const db = require('../../database-postgresql.js');
            const repos = global.repos;
            const planServiceInstance = new PlanService(repos, db);
            
            const plan = await planServiceInstance.getPlan(planId, userId);
            return {
                examDate: plan.exam_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias como padrão
                title: plan.title || plan.plan_name,
                createdAt: plan.created_at
            };
        } catch (error) {
            console.error('Erro ao buscar detalhes do plano:', error);
            return {
                examDate: new Date().toISOString(),
                title: 'Plano',
                createdAt: new Date().toISOString()
            };
        }
    }

    /**
     * Busca dados do cronograma
     */
    static async getScheduleData(planId) {
        try {
            const db = require('../../database-postgresql.js');
            const { createRepositories } = require('../repositories');
            const repos = createRepositories(db);
            const planServiceInstance = new PlanService(repos, db);
            
            const stats = await planServiceInstance.getScheduleStatistics(planId);
            return {
                totalTopics: stats.total || 0,
                scheduledTopics: stats.scheduled || 0,
                unscheduledTopics: stats.unscheduled || 0
            };
        } catch (error) {
            console.error('Erro ao buscar dados do cronograma:', error);
            return {
                totalTopics: 0,
                scheduledTopics: 0,
                unscheduledTopics: 0
            };
        }
    }

    /**
     * Busca dados de progresso
     */
    static async getProgressData(planId) {
        try {
            const db = require('../../database-postgresql.js');
            const { createRepositories } = require('../repositories');
            const repos = createRepositories(db);
            const planServiceInstance = new PlanService(repos, db);
            
            const progress = await planServiceInstance.calculateProgress(planId);
            return {
                completedTopics: progress.completedTopics || 0,
                studyInitialCount: progress.totalSessions || 0,
                revisionCount: progress.revisionSessions || 0,
                sessionsCompleted: progress.completedSessions || 0
            };
        } catch (error) {
            console.error('Erro ao buscar dados de progresso:', error);
            return {
                completedTopics: 0,
                studyInitialCount: 0,
                revisionCount: 0,
                sessionsCompleted: 0
            };
        }
    }

    /**
     * Busca estatísticas de revisão
     */
    static async getRevisionStats(planId) {
        try {
            const db = require('../../database-postgresql.js');
            const { createRepositories } = require('../repositories');
            const repos = createRepositories(db);
            const sessionServiceInstance = new SessionService(repos, db);
            
            const stats = await sessionServiceInstance.getRevisionStatistics(planId);
            return {
                cycles: [
                    {
                        label: '7d',
                        scheduled: stats.revision7?.total || 0,
                        completed: stats.revision7?.completed || 0,
                        overdue: stats.revision7?.overdue || 0
                    },
                    {
                        label: '14d',
                        scheduled: stats.revision14?.total || 0,
                        completed: stats.revision14?.completed || 0,
                        overdue: stats.revision14?.overdue || 0
                    },
                    {
                        label: '28d',
                        scheduled: stats.revision28?.total || 0,
                        completed: stats.revision28?.completed || 0,
                        overdue: stats.revision28?.overdue || 0
                    }
                ],
                debt: (stats.revision7?.overdue || 0) + 
                      (stats.revision14?.overdue || 0) + 
                      (stats.revision28?.overdue || 0)
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas de revisão:', error);
            return {
                cycles: [
                    { label: '7d', scheduled: 0, completed: 0, overdue: 0 },
                    { label: '14d', scheduled: 0, completed: 0, overdue: 0 },
                    { label: '28d', scheduled: 0, completed: 0, overdue: 0 }
                ],
                debt: 0
            };
        }
    }

    /**
     * Busca contadores de simulados
     */
    static async getSimulationCounts(_planId) {
        try {
            // Por enquanto retornamos dados mockados
            // TODO: Implementar quando tivermos tabela de simulados
            return {
                directed: 0,
                general: 0,
                total: 0
            };
        } catch (error) {
            console.error('Erro ao buscar simulados:', error);
            // Return statement removed as unreachable code
        }
        return {
            directed: 0,
            general: 0,
            total: 0
        };
    }

    /**
     * Busca dados de ritmo de estudo
     */
    static async getPaceData(planId) {
        try {
            const db = require('../../database-postgresql.js');
            const { createRepositories } = require('../repositories');
            const repos = createRepositories(db);
            const sessionServiceInstance = new SessionService(repos, db);
            
            const pace = await sessionServiceInstance.getStudyPace(planId);
            return {
                last7Days: pace.last7Days || 0,
                last14Days: pace.last14Days || 0,
                last30Days: pace.last30Days || 0
            };
        } catch (error) {
            console.error('Erro ao buscar ritmo de estudo:', error);
            return {
                last7Days: 0,
                last14Days: 0,
                last30Days: 0
            };
        }
    }

    /**
     * Calcula métricas derivadas
     */
    static calculateMetrics({ planDetails, scheduleData, progressData, paceData }) {
        const daysRemaining = this.calculateDaysRemaining(planDetails.examDate);
        const pendingTopics = Math.max(scheduleData.totalTopics - progressData.completedTopics, 0);
        
        // Ritmo necessário
        const requiredTopicsPerDay = daysRemaining > 0 
            ? this.round2(pendingTopics / daysRemaining)
            : pendingTopics;
        
        // Ritmo atual (média dos últimos 7 dias)
        const currentTopicsPerDay = this.round2(paceData.last7Days || 0);
        
        // Déficit diário
        const deficitPerDay = this.round2(Math.max(requiredTopicsPerDay - currentTopicsPerDay, 0));
        
        // Está no ritmo?
        const onTrack = deficitPerDay <= 0.5;
        
        // Projeção de término
        const daysToFinish = currentTopicsPerDay > 0 
            ? Math.ceil(pendingTopics / currentTopicsPerDay)
            : Infinity;
        const forecastDate = isFinite(daysToFinish)
            ? dayjs().add(daysToFinish, 'day').toISOString()
            : null;
        
        // Mensagem e hints de UI
        let message, statusColor, headline, subtext;
        
        if (onTrack) {
            message = 'EXCELLENT';
            statusColor = 'on-track';
            headline = 'Excelente trabalho!';
            subtext = 'Seu ritmo atual está adequado para concluir todo o cronograma.';
        } else if (deficitPerDay <= 2) {
            message = 'ATTENTION';
            statusColor = 'attention-needed';
            headline = 'Atenção ao ritmo';
            subtext = `Aumente ${deficitPerDay.toFixed(1)} tópicos/dia para manter o prazo.`;
        } else {
            message = 'OFF_TRACK';
            statusColor = 'off-track';
            headline = 'Ritmo abaixo do necessário';
            subtext = `Você precisa estudar ${requiredTopicsPerDay.toFixed(1)} tópicos/dia para concluir a tempo.`;
        }
        
        return {
            pace: {
                currentTopicsPerDay,
                last7Avg: currentTopicsPerDay,
                last14Avg: this.round2(paceData.last14Days || 0),
                requiredTopicsPerDay,
                todayTopics
            },
            projection: {
                onTrack,
                forecastDate,
                deficitPerDay,
                message
            },
            uiHints: {
                statusColor,
                headline,
                subtext
            }
        };
    }

    /**
     * Calcula dias restantes até o exame
     */
    static calculateDaysRemaining(examDate) {
        if (!examDate) return 0;
        const today = dayjs();
        const exam = dayjs(examDate);
        const diff = exam.diff(today, 'day');
        return Math.max(0, diff);
    }

    /**
     * Arredonda para 2 casas decimais
     */
    static round2(n) {
        return Math.round(n * 100) / 100;
    }
}

module.exports = PlanDashboardService;