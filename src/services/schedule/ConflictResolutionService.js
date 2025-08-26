/**
 * ConflictResolutionService - FASE 6 WAVE 7
 * 
 * Serviço especializado em detecção e resolução de conflitos de cronograma.
 * Responsável por identificar sobreposições, sessões conflitantes e propor soluções.
 * 
 * FUNCIONALIDADES:
 * - Detectar conflitos de horário
 * - Identificar sessões sobrepostas
 * - Propor soluções automáticas
 * - Resolver conflitos com redistribuição inteligente
 * - Validar integridade do cronograma
 */

const db = require('../../../database-postgresql');
const logger = require('../../utils/logger');

// FUNÇÃO UTILITÁRIA PARA DATA BRASILEIRA
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Database helpers
const dbGet = (sql, params = []) => new Promise((resolve, reject) => 
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
);
const dbAll = (sql, params = []) => new Promise((resolve, reject) => 
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);
const dbRun = (sql, params = []) => new Promise((resolve, reject) => 
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

class ConflictResolutionService {
    /**
     * Detecta conflitos de cronograma em um plano
     * @param {number} planId - ID do plano
     * @param {number} userId - ID do usuário (para validação)
     * @returns {Object} Relatório de conflitos detectados
     */
    async getScheduleConflicts(planId, userId) {
        try {
            logger.info(`[ConflictService] Iniciando detecção de conflitos para plano ${planId}`);
            
            // 1. Validar permissão do usuário
            const plan = await dbGet(
                'SELECT id, plan_name, exam_date FROM study_plans WHERE id = $1 AND user_id = $2', 
                [planId, userId]
            );
            
            if (!plan) {
                throw new Error('Plano não encontrado ou não autorizado');
            }

            // 2. Buscar todas as sessões do plano
            const sessions = await dbAll(`
                SELECT 
                    id, session_date, session_type, subject_name, topic_description,
                    status, estimated_duration_minutes, created_at
                FROM study_sessions 
                WHERE study_plan_id = $1 
                ORDER BY session_date ASC, created_at ASC
            `, [planId]);

            // 3. Detectar tipos de conflitos
            const conflicts = {
                dateConflicts: await this.detectDateConflicts(sessions),
                overloadedDays: await this.detectOverloadedDays(sessions, planId),
                sessionGaps: await this.detectSessionGaps(sessions, plan.exam_date),
                duplicateTopics: await this.detectDuplicateTopics(sessions),
                summary: {}
            };

            // 4. Calcular resumo dos conflitos
            const totalConflicts = 
                conflicts.dateConflicts.length + 
                conflicts.overloadedDays.length + 
                conflicts.sessionGaps.length + 
                conflicts.duplicateTopics.length;

            conflicts.summary = {
                totalConflicts,
                hasCriticalConflicts: conflicts.dateConflicts.length > 0 || conflicts.overloadedDays.length > 0,
                planName: plan.plan_name,
                examDate: plan.exam_date,
                totalSessions: sessions.length,
                analyzedDate: getBrazilianDateString()
            };

            logger.info(`[ConflictService] Detectados ${totalConflicts} conflitos no plano ${planId}`);
            return conflicts;

        } catch (error) {
            logger.error(`[ConflictService] Erro ao detectar conflitos:`, error);
            throw new Error(`Erro ao detectar conflitos: ${error.message}`);
        }
    }

    /**
     * Detecta conflitos de data (sessões na mesma data com sobrecarga)
     * @private
     */
    async detectDateConflicts(sessions) {
        const conflicts = [];
        const sessionsByDate = {};

        // Agrupar sessões por data
        sessions.forEach(session => {
            const date = session.session_date;
            if (!sessionsByDate[date]) {
                sessionsByDate[date] = [];
            }
            sessionsByDate[date].push(session);
        });

        // Detectar dias com muitas sessões (mais de 8 horas de estudo)
        for (const [date, dateSessions] of Object.entries(sessionsByDate)) {
            const totalMinutes = dateSessions.reduce((sum, session) => 
                sum + (session.estimated_duration_minutes || 60), 0);
            
            if (totalMinutes > 480) { // Mais de 8 horas
                conflicts.push({
                    type: 'date_overload',
                    date,
                    totalMinutes,
                    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
                    sessionCount: dateSessions.length,
                    sessions: dateSessions.map(s => ({
                        id: s.id,
                        type: s.session_type,
                        subject: s.subject_name,
                        topic: s.topic_description,
                        duration: s.estimated_duration_minutes || 60
                    })),
                    severity: totalMinutes > 600 ? 'critical' : 'warning'
                });
            }
        }

        return conflicts;
    }

    /**
     * Detecta dias sobrecarregados com base na configuração do plano
     * @private
     */
    async detectOverloadedDays(sessions, planId) {
        try {
            // Buscar configuração do plano
            const config = await dbGet(`
                SELECT daily_time_available, weekly_sessions 
                FROM study_plans 
                WHERE id = $1
            `, [planId]);

            const dailyLimit = config?.daily_time_available || 480; // Default: 8 horas
            const overloaded = [];
            const sessionsByDate = {};

            // Agrupar por data
            sessions.forEach(session => {
                const date = session.session_date;
                if (!sessionsByDate[date]) {
                    sessionsByDate[date] = [];
                }
                sessionsByDate[date].push(session);
            });

            // Detectar sobrecarga
            for (const [date, dateSessions] of Object.entries(sessionsByDate)) {
                const totalMinutes = dateSessions.reduce((sum, s) => 
                    sum + (s.estimated_duration_minutes || 60), 0);
                
                if (totalMinutes > dailyLimit) {
                    overloaded.push({
                        type: 'daily_overload',
                        date,
                        totalMinutes,
                        limitMinutes: dailyLimit,
                        excessMinutes: totalMinutes - dailyLimit,
                        sessionCount: dateSessions.length,
                        severity: totalMinutes > dailyLimit * 1.5 ? 'critical' : 'warning'
                    });
                }
            }

            return overloaded;
        } catch (error) {
            logger.error(`[ConflictService] Erro ao detectar dias sobrecarregados:`, error);
            return [];
        }
    }

    /**
     * Detecta gaps problemáticos no cronograma
     * @private
     */
    async detectSessionGaps(sessions, examDate) {
        const gaps = [];
        const today = new Date(getBrazilianDateString());
        const exam = new Date(examDate);
        
        // Ordenar sessões por data
        const sortedSessions = sessions.sort((a, b) => new Date(a.session_date) - new Date(b.session_date));
        
        // Detectar gaps grandes entre sessões
        for (let i = 1; i < sortedSessions.length; i++) {
            const currentSession = new Date(sortedSessions[i].session_date);
            const previousSession = new Date(sortedSessions[i - 1].session_date);
            
            const daysDiff = Math.floor((currentSession - previousSession) / (1000 * 60 * 60 * 24));
            
            if (daysDiff > 7) { // Gap de mais de 7 dias
                gaps.push({
                    type: 'large_gap',
                    startDate: sortedSessions[i - 1].session_date,
                    endDate: sortedSessions[i].session_date,
                    daysDiff,
                    severity: daysDiff > 14 ? 'critical' : 'warning'
                });
            }
        }

        return gaps;
    }

    /**
     * Detecta tópicos duplicados no cronograma
     * @private
     */
    async detectDuplicateTopics(sessions) {
        const duplicates = [];
        const topicCounts = {};

        // Contar sessões por tópico (apenas "Novo Tópico")
        sessions
            .filter(s => s.session_type === 'Novo Tópico' && s.topic_description)
            .forEach(session => {
                const key = `${session.subject_name}::${session.topic_description}`;
                if (!topicCounts[key]) {
                    topicCounts[key] = [];
                }
                topicCounts[key].push(session);
            });

        // Identificar tópicos com múltiplas sessões "Novo Tópico"
        for (const [topicKey, topicSessions] of Object.entries(topicCounts)) {
            if (topicSessions.length > 1) {
                const [subject, topic] = topicKey.split('::');
                duplicates.push({
                    type: 'duplicate_topic',
                    subject,
                    topic,
                    sessionCount: topicSessions.length,
                    sessions: topicSessions.map(s => ({
                        id: s.id,
                        date: s.session_date,
                        status: s.status
                    })),
                    severity: 'warning'
                });
            }
        }

        return duplicates;
    }

    /**
     * Resolve conflitos automaticamente
     * @param {number} planId - ID do plano
     * @param {number} userId - ID do usuário
     * @param {Array} conflictIds - IDs dos conflitos a resolver
     * @param {Object} resolution - Estratégia de resolução
     * @returns {Object} Resultado da resolução
     */
    async resolveConflicts(planId, userId, conflictIds = [], resolution = {}) {
        try {
            logger.info(`[ConflictService] Resolvendo ${conflictIds.length} conflitos para plano ${planId}`);
            
            // 1. Validar permissão
            const plan = await dbGet(
                'SELECT id, plan_name FROM study_plans WHERE id = $1 AND user_id = $2', 
                [planId, userId]
            );
            
            if (!plan) {
                throw new Error('Plano não encontrado ou não autorizado');
            }

            // 2. Detectar conflitos atuais
            const conflicts = await this.getScheduleConflicts(planId, userId);
            
            if (conflicts.summary.totalConflicts === 0) {
                return {
                    success: true,
                    message: 'Nenhum conflito encontrado para resolver.',
                    resolvedCount: 0,
                    conflicts: conflicts
                };
            }

            // 3. Aplicar estratégias de resolução
            const results = {
                resolved: [],
                failed: [],
                totalAttempted: 0
            };

            // Iniciar transação para operações atômicas
            await dbRun('BEGIN');

            try {
                // Resolver conflitos de data (redistribuir sessões)
                if (conflicts.dateConflicts.length > 0) {
                    const dateResults = await this.resolveDateConflicts(planId, conflicts.dateConflicts, resolution);
                    results.resolved.push(...dateResults.resolved);
                    results.failed.push(...dateResults.failed);
                    results.totalAttempted += dateResults.attempted;
                }

                // Resolver dias sobrecarregados
                if (conflicts.overloadedDays.length > 0) {
                    const overloadResults = await this.resolveOverloadedDays(planId, conflicts.overloadedDays, resolution);
                    results.resolved.push(...overloadResults.resolved);
                    results.failed.push(...overloadResults.failed);
                    results.totalAttempted += overloadResults.attempted;
                }

                // Resolver tópicos duplicados
                if (conflicts.duplicateTopics.length > 0) {
                    const duplicateResults = await this.resolveDuplicateTopics(planId, conflicts.duplicateTopics);
                    results.resolved.push(...duplicateResults.resolved);
                    results.failed.push(...duplicateResults.failed);
                    results.totalAttempted += duplicateResults.attempted;
                }

                await dbRun('COMMIT');

                const resolvedCount = results.resolved.length;
                const failedCount = results.failed.length;

                logger.info(`[ConflictService] Resolução concluída: ${resolvedCount} resolvidos, ${failedCount} falharam`);

                return {
                    success: true,
                    message: resolvedCount > 0 
                        ? `✅ ${resolvedCount} conflito(s) resolvido(s) com sucesso!`
                        : '⚠️ Nenhum conflito pôde ser resolvido automaticamente.',
                    resolvedCount,
                    failedCount,
                    totalAttempted: results.totalAttempted,
                    details: results,
                    updatedConflicts: await this.getScheduleConflicts(planId, userId)
                };

            } catch (error) {
                await dbRun('ROLLBACK');
                throw error;
            }

        } catch (error) {
            logger.error(`[ConflictService] Erro ao resolver conflitos:`, error);
            throw new Error(`Erro ao resolver conflitos: ${error.message}`);
        }
    }

    /**
     * Resolve conflitos de data redistribuindo sessões
     * @private
     */
    async resolveDateConflicts(planId, dateConflicts, resolution) {
        const results = { resolved: [], failed: [], attempted: 0 };

        for (const conflict of dateConflicts) {
            results.attempted++;
            
            try {
                if (conflict.severity === 'critical' && conflict.sessionCount > 10) {
                    // Muito crítico - redistribuir metade das sessões
                    const sessionsToMove = Math.floor(conflict.sessions.length / 2);
                    const moved = await this.redistributeSessions(planId, conflict.sessions.slice(0, sessionsToMove));
                    
                    if (moved > 0) {
                        results.resolved.push({
                            type: 'date_conflict_resolved',
                            date: conflict.date,
                            sessionsRelocated: moved
                        });
                    } else {
                        results.failed.push({
                            type: 'date_conflict_failed',
                            date: conflict.date,
                            reason: 'Não foi possível encontrar slots disponíveis'
                        });
                    }
                }
            } catch (error) {
                results.failed.push({
                    type: 'date_conflict_failed',
                    date: conflict.date,
                    reason: error.message
                });
            }
        }

        return results;
    }

    /**
     * Resolve dias sobrecarregados
     * @private
     */
    async resolveOverloadedDays(planId, overloadedDays, resolution) {
        const results = { resolved: [], failed: [], attempted: 0 };

        for (const overload of overloadedDays) {
            results.attempted++;
            
            try {
                // Buscar sessões do dia sobrecarregado
                const sessions = await dbAll(`
                    SELECT id, session_type, estimated_duration_minutes, status
                    FROM study_sessions 
                    WHERE study_plan_id = $1 AND session_date = $2
                    ORDER BY created_at ASC
                `, [planId, overload.date]);

                // Mover sessões de menor prioridade (revisões primeiro)
                const sessionsToMove = sessions
                    .filter(s => s.session_type.includes('Revisão') && s.status === 'Pendente')
                    .slice(0, Math.ceil(sessions.length * 0.3)); // Mover 30% das sessões

                if (sessionsToMove.length > 0) {
                    const moved = await this.redistributeSessions(planId, sessionsToMove);
                    
                    if (moved > 0) {
                        results.resolved.push({
                            type: 'overload_resolved',
                            date: overload.date,
                            sessionsRelocated: moved
                        });
                    }
                }
            } catch (error) {
                results.failed.push({
                    type: 'overload_failed',
                    date: overload.date,
                    reason: error.message
                });
            }
        }

        return results;
    }

    /**
     * Resolve tópicos duplicados removendo duplicatas
     * @private
     */
    async resolveDuplicateTopics(planId, duplicateTopics) {
        const results = { resolved: [], failed: [], attempted: 0 };

        for (const duplicate of duplicateTopics) {
            results.attempted++;
            
            try {
                // Manter apenas a primeira sessão, remover as outras
                const sessionsToRemove = duplicate.sessions.slice(1);
                
                for (const session of sessionsToRemove) {
                    await dbRun(`
                        DELETE FROM study_sessions 
                        WHERE id = $1 AND study_plan_id = $2 AND status = 'Pendente'
                    `, [session.id, planId]);
                }

                results.resolved.push({
                    type: 'duplicate_resolved',
                    topic: duplicate.topic,
                    removedSessions: sessionsToRemove.length
                });
            } catch (error) {
                results.failed.push({
                    type: 'duplicate_failed',
                    topic: duplicate.topic,
                    reason: error.message
                });
            }
        }

        return results;
    }

    /**
     * Redistribui sessões para datas disponíveis
     * @private
     */
    async redistributeSessions(planId, sessions) {
        let movedCount = 0;
        const today = new Date(getBrazilianDateString());
        
        for (const session of sessions) {
            try {
                // Encontrar próxima data disponível (com menos de 4 horas de estudo)
                const availableDate = await this.findNextAvailableDate(planId, today);
                
                if (availableDate) {
                    await dbRun(`
                        UPDATE study_sessions 
                        SET session_date = $1 
                        WHERE id = $2 AND study_plan_id = $3
                    `, [availableDate, session.id, planId]);
                    
                    movedCount++;
                }
            } catch (error) {
                logger.error(`[ConflictService] Erro ao mover sessão ${session.id}:`, error);
            }
        }

        return movedCount;
    }

    /**
     * Encontra a próxima data disponível com carga leve
     * @private
     */
    async findNextAvailableDate(planId, startDate) {
        const maxDays = 30; // Procurar até 30 dias à frente
        
        for (let i = 1; i <= maxDays; i++) {
            const checkDate = new Date(startDate);
            checkDate.setDate(startDate.getDate() + i);
            const dateStr = checkDate.toISOString().split('T')[0];
            
            // Verificar carga do dia
            const dayLoad = await dbGet(`
                SELECT 
                    COUNT(*) as session_count,
                    COALESCE(SUM(estimated_duration_minutes), 0) as total_minutes
                FROM study_sessions 
                WHERE study_plan_id = $1 AND session_date = $2
            `, [planId, dateStr]);
            
            // Se o dia tem menos de 4 horas de estudo, está disponível
            if (dayLoad.total_minutes < 240) {
                return dateStr;
            }
        }
        
        return null; // Nenhum slot disponível
    }
}

module.exports = ConflictResolutionService;