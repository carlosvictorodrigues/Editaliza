/**
 * ScheduleGenerationService - Orquestrador principal da geração de cronogramas
 * 
 * ATENÇÃO: Este é o serviço mais crítico do sistema!
 * Responsável por coordenar a geração completa de cronogramas de estudo
 * com algoritmos complexos de distribuição, priorização e spaced repetition.
 * 
 * INTEGRAÇÃO COMPLETA - FASE 9.5:
 * - Valida configurações do plano
 * - Processa modo reta final
 * - Aplica algoritmos de priorização
 * - Distribui sessões otimamente
 * - Calcula revisões com spaced repetition
 * - Garante atomicidade com transações
 */

const db = require('../../../database-postgresql');
const logger = require('../../../src/utils/logger');

// Importar todos os módulos criados nas fases anteriores
const TopicPriorizer = require('./algorithms/TopicPriorizer');
const SessionDistributor = require('./algorithms/SessionDistributor');
const SpacedRepetitionCalculator = require('./algorithms/SpacedRepetitionCalculator');
const RetaFinalProcessor = require('./algorithms/RetaFinalProcessor');
const PlanConfigValidator = require('./validators/PlanConfigValidator');
const TopicIntegrityValidator = require('./validators/TopicIntegrityValidator');
const TimeSlotValidator = require('./validators/TimeSlotValidator');
const DateCalculator = require('./utils/DateCalculator');
const SessionBatcher = require('./utils/SessionBatcher');

// FUNÇÃO UTILITÁRIA PARA DATA BRASILEIRA (importada do server.js)
function getBrazilianDateString() {
    const now = new Date();
    // Criar objeto Date diretamente no timezone brasileiro
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Database helpers para manter compatibilidade
const dbGet = (sql, params = []) => new Promise((resolve, reject) => 
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
);
const dbAll = (sql, params = []) => new Promise((resolve, reject) => 
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);
const dbRun = (sql, params = []) => new Promise((resolve, reject) => 
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); })
);

class ScheduleGenerationService {
    /**
     * Gera um cronograma completo de estudos
     * @param {Object} config - Configuração do cronograma
     * @returns {Object} Resultado da geração
     */
    static async generate(config) {
        const startTime = Date.now();
        logger.info('Iniciando geração de cronograma', { 
            planId: config.planId, 
            userId: config.userId 
        });

        // Usar transação SQLite para manter compatibilidade com implementação existente
        try {
            await dbRun('BEGIN');
            
            // 1. Validar configuração do plano
            const planValidation = await PlanConfigValidator.validate(config);
            if (!planValidation.isValid) {
                throw new Error(planValidation.error);
            }
            
            // 2. Carregar dados completos do plano
            const planData = await this.loadPlanData(config);
            
            // 3. Validar integridade dos tópicos
            const topicValidation = await TopicIntegrityValidator.validate(config.planId);
            if (!topicValidation.isValid) {
                logger.warn('Problemas de integridade encontrados', topicValidation.warnings);
            }
            
            // 4. Validar viabilidade temporal do cronograma
            const timeValidation = await TimeSlotValidator.validate(planData, config);
            if (!timeValidation.isValid) {
                throw new Error(timeValidation.error);
            }
            
            // 5. Buscar e preparar tópicos
            const topics = await this.loadTopics(config.planId);
            if (!topics || topics.length === 0) {
                throw new Error('Nenhum tópico encontrado para gerar cronograma');
            }
            
            // 6. Aplicar modo reta final se necessário
            let processedTopics = topics;
            let excludedTopics = [];
            
            if (config.reta_final_mode && timeValidation.needsExclusions) {
                logger.info('Aplicando modo reta final', {
                    planId: config.planId,
                    totalTopics: topics.length,
                    availableSlots: timeValidation.availableSlots
                });
                
                const retaFinalResult = await RetaFinalProcessor.process(
                    topics, 
                    timeValidation.availableSlots,
                    config
                );
                processedTopics = retaFinalResult.selected;
                excludedTopics = retaFinalResult.excluded;
                
                // Salvar exclusões no banco
                await this.saveExclusions(config.planId, excludedTopics);
                
                logger.info('Modo reta final aplicado', {
                    planId: config.planId,
                    selected: processedTopics.length,
                    excluded: excludedTopics.length
                });
            }
            
            // 7. Priorizar tópicos usando algoritmo round-robin ponderado
            const prioritizedTopics = await TopicPriorizer.prioritize(
                processedTopics, 
                config
            );
            
            logger.info('Tópicos priorizados', {
                planId: config.planId,
                count: prioritizedTopics.length
            });
            
            // 8. Distribuir sessões de estudo
            const sessions = await SessionDistributor.distribute(
                prioritizedTopics,
                planData,
                config
            );
            
            logger.info('Sessões de estudo distribuídas', {
                planId: config.planId,
                count: sessions.length
            });
            
            // 9. Aplicar spaced repetition (revisões)
            const enhancedSessions = await SpacedRepetitionCalculator.apply(
                sessions,
                planData,
                config
            );
            
            logger.info('Revisões calculadas', {
                planId: config.planId,
                totalSessions: enhancedSessions.length,
                reviewSessions: enhancedSessions.length - sessions.length
            });
            
            // 10. Limpar sessões antigas
            const clearedCount = await this.clearOldSessions(config.planId);
            logger.info('Sessões antigas removidas', {
                planId: config.planId,
                count: clearedCount
            });
            
            // 11. Inserir novas sessões em batch
            const insertResult = await SessionBatcher.insert(
                enhancedSessions,
                config.planId
            );
            
            // 12. Atualizar metadados do plano
            await this.updatePlanMetadata(config);
            
            // Commit da transação
            await dbRun('COMMIT');
            
            const duration = Date.now() - startTime;
            logger.info('Cronograma gerado com sucesso', {
                planId: config.planId,
                sessionsCreated: insertResult.count,
                excludedTopics: excludedTopics.length,
                duration
            });
            
            return {
                success: true,
                message: 'Seu mapa para a aprovação foi traçado com sucesso. 🗺️',
                statistics: {
                    totalSessions: insertResult.count,
                    studySessions: sessions.length,
                    reviewSessions: enhancedSessions.length - sessions.length,
                    excludedTopics: excludedTopics.length,
                    generationTime: duration
                },
                plan: planData,
                excludedTopics: excludedTopics
            };
            
        } catch (error) {
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                logger.error('Erro no rollback', {
                    planId: config.planId,
                    error: rollbackError.message
                });
            }
            
            logger.error('Erro na geração de cronograma', {
                planId: config.planId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Carrega dados completos do plano
     */
    static async loadPlanData(config) {
        const plan = await dbGet(`
            SELECT 
                id, exam_date, plan_name, daily_question_goal,
                weekly_question_goal, session_duration_minutes,
                has_essay, reta_final_mode, study_hours_per_day,
                created_at, updated_at
            FROM study_plans 
            WHERE id = ? AND user_id = ?
        `, [config.planId, config.userId]);
        
        if (!plan) {
            throw new Error('Plano não encontrado ou sem permissão');
        }
        
        // Processar study_hours_per_day se for string JSON
        if (typeof plan.study_hours_per_day === 'string') {
            try {
                plan.study_hours_per_day = JSON.parse(plan.study_hours_per_day);
            } catch (error) {
                logger.warn('Erro ao parsear study_hours_per_day', {
                    planId: config.planId,
                    error: error.message
                });
                plan.study_hours_per_day = {};
            }
        }
        
        return plan;
    }
    
    /**
     * Carrega todos os tópicos do plano
     */
    static async loadTopics(planId) {
        const topics = await dbAll(`
            SELECT 
                t.id,
                t.topic_name,
                t.topic_name as description,
                t.status,
                t.completion_date,
                COALESCE(t.priority_weight, 3) as topic_priority,
                s.id as subject_id,
                s.subject_name,
                COALESCE(s.priority_weight, 3) as subject_priority
            FROM subjects s
            INNER JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = ?
            ORDER BY 
                s.priority_weight DESC,
                COALESCE(t.priority_weight, 3) DESC,
                t.id ASC
        `, [planId]);
        
        // Normalizar prioridades para inteiros
        return topics.map(topic => ({
            ...topic,
            subject_priority: parseInt(topic.subject_priority, 10) || 3,
            topic_priority: parseInt(topic.topic_priority, 10) || 3
        }));
    }
    
    /**
     * Limpa sessões antigas do plano
     */
    static async clearOldSessions(planId) {
        const result = await dbRun(`
            DELETE FROM study_sessions 
            WHERE study_plan_id = ?
        `, [planId]);
        
        logger.info('Sessões antigas removidas', {
            planId,
            count: result.changes || 0
        });
        
        return result.changes || 0;
    }
    
    /**
     * Salva tópicos excluídos no modo reta final
     */
    static async saveExclusions(planId, excludedTopics) {
        // Limpar exclusões antigas das duas tabelas para compatibilidade
        await dbRun('DELETE FROM reta_final_exclusions WHERE plan_id = ?', [planId]);
        await dbRun('DELETE FROM reta_final_excluded_topics WHERE plan_id = ?', [planId]);
        
        if (excludedTopics.length === 0) return;
        
        // Inserir exclusões uma por uma para máxima compatibilidade
        for (const topic of excludedTopics) {
            const priorityCombined = ((topic.subject_priority || 3) * 10) + (topic.topic_priority || 3);
            const reason = `Tópico excluído automaticamente no Modo Reta Final devido à falta de tempo. Prioridade combinada: ${priorityCombined.toFixed(2)}`;
            
            try {
                // Verificar se o tópico existe antes de inserir na tabela legada
                const topicExists = await dbGet('SELECT id FROM topics WHERE id = ?', [topic.id]);
                
                if (topicExists) {
                    // Inserir na tabela legada (com FOREIGN KEY)
                    await dbRun(
                        'INSERT INTO reta_final_exclusions (plan_id, topic_id, reason) VALUES (?, ?, ?)',
                        [planId, topic.id, `${topic.subject_name} - ${topic.topic_name || topic.description} (Prioridade: ${priorityCombined.toFixed(2)})`]
                    );
                }
                
                // Sempre inserir na nova tabela (sem FOREIGN KEY restrito)
                await dbRun(
                    'INSERT INTO reta_final_excluded_topics (plan_id, subject_id, topic_id, reason) VALUES (?, ?, ?, ?)',
                    [planId, topic.subject_id || null, topic.id, reason]
                );
                
            } catch (insertError) {
                logger.error('Erro ao salvar exclusão', {
                    planId,
                    topicId: topic.id,
                    error: insertError.message
                });
                // Não relançar o erro para não quebrar todo o processo
            }
        }
        
        logger.info('Exclusões salvas', {
            planId,
            count: excludedTopics.length
        });
    }
    
    /**
     * Atualiza metadados do plano após geração
     */
    static async updatePlanMetadata(config) {
        const hoursJson = JSON.stringify(config.study_hours_per_day);
        
        await dbRun(`
            UPDATE study_plans 
            SET 
                daily_question_goal = ?,
                weekly_question_goal = ?,
                session_duration_minutes = ?,
                has_essay = ?,
                reta_final_mode = ?,
                study_hours_per_day = ?
            WHERE id = ? AND user_id = ?
        `, [
            config.daily_question_goal,
            config.weekly_question_goal,
            config.session_duration_minutes,
            config.has_essay ? 1 : 0,
            config.reta_final_mode ? 1 : 0,
            hoursJson,
            config.planId,
            config.userId
        ]);
        
        logger.info('Metadados do plano atualizados', {
            planId: config.planId
        });
    }
    
    /**
     * Replaneja todas as sessões atrasadas usando algoritmo inteligente
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário
     * @returns {Object} Resultado do replanejamento
     */
    static async replanSchedule(planId, userId) {
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                throw new Error('Plano não encontrado.');
            }

            const todayStr = getBrazilianDateString();
            const overdueSessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\' AND session_date < ? ORDER BY session_date, id', [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return { 
                    success: true, 
                    message: 'Nenhuma tarefa atrasada para replanejar.' 
                };
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // Função para encontrar próximo slot disponível com segurança
            const findNextAvailableSlot = async (startDate, skipDate = null, maxDaysSearch = 365) => {
                const currentDate = new Date(startDate);
                let daysSearched = 0;
                
                while (currentDate <= examDate && daysSearched < maxDaysSearch) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    // Pula domingos ou data específica se fornecida
                    if (dayOfWeek === 0 || (skipDate && dateStr === skipDate)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        daysSearched++;
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    
                    // Segurança: verificar se há estudo neste dia
                    if (maxSessions <= 0) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        daysSearched++;
                        continue;
                    }
                    
                    const currentSessionCountResult = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                    const currentSessionCount = currentSessionCountResult.count;

                    if (currentSessionCount < maxSessions) {
                        return { 
                            date: currentDate, 
                            availableSlots: maxSessions - currentSessionCount,
                            dayOfWeek: dayOfWeek
                        };
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                    daysSearched++;
                }
                return null;
            };

            // Estratégia inteligente de replanejamento
            const smartReplan = async () => {
                console.log(`[REPLAN] Iniciando replanejamento inteligente para ${overdueSessions.length} sessões atrasadas`);
                
                // Cache de sessões por data para performance
                const sessionDateCache = new Map();
                const loadSessionsForDate = async (dateStr) => {
                    if (!sessionDateCache.has(dateStr)) {
                        const sessions = await dbAll('SELECT id, subject_name FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                        sessionDateCache.set(dateStr, sessions);
                    }
                    return sessionDateCache.get(dateStr);
                };
                
                // Agrupar sessões atrasadas por matéria e tipo (priorizar sessões de estudo inicial)
                const sessionsBySubject = {};
                overdueSessions.forEach(session => {
                    if (!sessionsBySubject[session.subject_name]) {
                        sessionsBySubject[session.subject_name] = [];
                    }
                    sessionsBySubject[session.subject_name].push(session);
                });
                
                // Ordenar por prioridade: sessões de estudo inicial primeiro, depois revisões
                Object.keys(sessionsBySubject).forEach(subject => {
                    sessionsBySubject[subject].sort((a, b) => {
                        const priorityOrder = {'Estudo Inicial': 1, 'Primeira Revisão': 2, 'Segunda Revisão': 3, 'Revisão Final': 4};
                        return (priorityOrder[a.session_type] || 5) - (priorityOrder[b.session_type] || 5);
                    });
                });

                // Buscar sessões futuras por matéria para inserção inteligente
                const futureSessions = await dbAll(`
                    SELECT * FROM study_sessions 
                    WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? 
                    ORDER BY session_date, id
                `, [planId, todayStr]);

                const futureSessionsBySubject = {};
                futureSessions.forEach(session => {
                    if (!futureSessionsBySubject[session.subject_name]) {
                        futureSessionsBySubject[session.subject_name] = [];
                    }
                    futureSessionsBySubject[session.subject_name].push(session);
                });

                let rescheduledCount = 0;
                const failedSessions = [];
                const reschedulingLog = [];

                // Processar cada matéria com segurança
                for (const [subject, sessions] of Object.entries(sessionsBySubject)) {
                    console.log(`[REPLAN] Processando ${sessions.length} sessões da matéria: ${subject}`);
                    
                    const futureSessionsOfSubject = futureSessionsBySubject[subject] || [];
                    
                    for (const session of sessions) {
                        let rescheduled = false;
                        let strategy = '';
                        
                        // SEGURANÇA: Verificar se a sessão ainda existe e está pendente
                        const sessionExists = await dbGet('SELECT id, status FROM study_sessions WHERE id = ? AND status = "Pendente"', [session.id]);
                        if (!sessionExists) {
                            console.log(`[REPLAN] ⚠ Sessão ${session.id} não existe ou não está pendente - ignorando`);
                            continue;
                        }
                        
                        // ESTRATÉGIA 1: Tentar inserir antes da próxima sessão da mesma matéria
                        if (futureSessionsOfSubject.length > 0) {
                            const nextSessionDate = new Date(futureSessionsOfSubject[0].session_date);
                            const searchStartDate = new Date();
                            
                            // Buscar slot entre hoje e a próxima sessão da matéria
                            const slot = await findNextAvailableSlot(searchStartDate);
                            if (slot && slot.date < nextSessionDate) {
                                const newDateStr = slot.date.toISOString().split('T')[0];
                                
                                // Verificar se não há sobrecarga da mesma matéria no mesmo dia
                                const sessionsOnDate = await loadSessionsForDate(newDateStr);
                                const sameSubjectCount = sessionsOnDate.filter(s => s.subject_name === session.subject_name).length;
                                
                                // Máximo 2 sessões da mesma matéria por dia para evitar fadiga
                                if (sameSubjectCount < 2) {
                                    await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                    sessionDateCache.get(newDateStr).push({id: session.id, subject_name: session.subject_name});
                                    rescheduled = true;
                                    strategy = 'inserida antes da próxima sessão';
                                    rescheduledCount++;
                                    reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy})`);
                                    console.log(`[REPLAN] ✓ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                                }
                            }
                        }
                        
                        // ESTRATÉGIA 2: Encontrar próximo slot disponível com balanceamento
                        if (!rescheduled) {
                            let currentSearchDate = new Date();
                            let attempts = 0;
                            const maxAttempts = 30; // Procurar por até 30 dias
                            
                            while (attempts < maxAttempts && !rescheduled) {
                                const slot = await findNextAvailableSlot(currentSearchDate);
                                if (slot) {
                                    const newDateStr = slot.date.toISOString().split('T')[0];
                                    const sessionsOnDate = await loadSessionsForDate(newDateStr);
                                    const sameSubjectCount = sessionsOnDate.filter(s => s.subject_name === session.subject_name).length;
                                    
                                    // Preferir dias com menor concentração da mesma matéria
                                    if (sameSubjectCount < 2) {
                                        await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                        sessionDateCache.get(newDateStr).push({id: session.id, subject_name: session.subject_name});
                                        rescheduled = true;
                                        strategy = 'próximo slot balanceado';
                                        rescheduledCount++;
                                        reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy})`);
                                        console.log(`[REPLAN] ✓ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                                    } else {
                                        // Pular para o próximo dia se já há muitas sessões da mesma matéria
                                        currentSearchDate = new Date(slot.date);
                                        currentSearchDate.setDate(currentSearchDate.getDate() + 1);
                                        attempts++;
                                    }
                                } else {
                                    break; // Não há mais slots disponíveis
                                }
                            }
                        }
                        
                        // ESTRATÉGIA 3: Se ainda não conseguiu, verificar se há espaço no final do cronograma
                        if (!rescheduled) {
                            // Procurar nos últimos dias antes do exame
                            const examMinusWeek = new Date(examDate);
                            examMinusWeek.setDate(examMinusWeek.getDate() - 7);
                            
                            const lateSlot = await findNextAvailableSlot(examMinusWeek);
                            if (lateSlot) {
                                const newDateStr = lateSlot.date.toISOString().split('T')[0];
                                await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                rescheduled = true;
                                strategy = 'slot de emergência próximo ao exame';
                                rescheduledCount++;
                                reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy} - ATENÇÃO!)`);
                                console.log(`[REPLAN] ⚠ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                            }
                        }
                        
                        if (!rescheduled) {
                            failedSessions.push({
                                ...session,
                                reason: 'Sem slots disponíveis até o exame'
                            });
                            console.log(`[REPLAN] ✗ Não foi possível reagendar sessão ${session.id} - sem slots disponíveis`);
                        }
                    }
                }

                return { rescheduledCount, failedSessions, reschedulingLog };
            };
            
            await dbRun('BEGIN');
            
            const result = await smartReplan();
            
            // Atualizar contador de replanejamentos
            await dbRun('UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?', [planId]);
            
            await dbRun('COMMIT');
            
            // Log detalhado para debugging
            console.log(`[REPLAN] Resultado:`);
            console.log(`- Sessions reagendadas: ${result.rescheduledCount}/${overdueSessions.length}`);
            console.log(`- Sessions não reagendadas: ${result.failedSessions.length}`);
            result.reschedulingLog.forEach(log => console.log(`  - ${log}`));
            
            // Preparar mensagem detalhada baseada no resultado
            let message = '';
            if (result.rescheduledCount === overdueSessions.length) {
                message = `✅ Todas as ${result.rescheduledCount} tarefas atrasadas foram replanejadas com sucesso!`;
            } else if (result.rescheduledCount > 0) {
                message = `⚠ ${result.rescheduledCount} de ${overdueSessions.length} tarefas foram replanejadas. ${result.failedSessions.length} tarefas não puderam ser reagendadas por falta de espaço até o exame.`;
            } else {
                message = `❌ Nenhuma tarefa pôde ser replanejada. Considere estender sua data de exame ou aumentar suas horas diárias de estudo.`;
            }
            
            // Retornar resposta detalhada
            return { 
                success: result.rescheduledCount > 0, // Sucesso se pelo menos uma sessão foi reagendada
                message,
                details: {
                    rescheduled: result.rescheduledCount,
                    failed: result.failedSessions.length,
                    total: overdueSessions.length,
                    successRate: Math.round((result.rescheduledCount / overdueSessions.length) * 100),
                    log: result.reschedulingLog.slice(0, 8), // Mostrar primeiros 8 para dar mais detalhes
                    failedReasons: result.failedSessions.slice(0, 3).map(s => ({
                        topic: s.topic_description,
                        subject: s.subject_name,
                        reason: s.reason || 'Sem slots disponíveis'
                    }))
                }
            };

        } catch (error) {
            // Rollback seguro da transação
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                console.error('[REPLAN] Erro ao fazer rollback:', rollbackError);
            }
            
            console.error('[REPLAN] Erro crítico ao replanejar:', {
                planId,
                userId,
                error: error.message,
                stack: error.stack
            });
            
            throw new Error(process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor');
        }
    }
    
    /**
     * Gera preview do replanejamento sem executar
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário
     * @returns {Object} Preview do replanejamento
     */
    static async replanPreview(planId, userId) {
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                throw new Error('Plano não encontrado.');
            }

            const todayStr = getBrazilianDateString();
            const overdueSessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\' AND session_date < ? ORDER BY session_date, id', [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return { 
                    hasOverdue: false,
                    message: 'Nenhuma tarefa atrasada encontrada.' 
                };
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // OTIMIZAÇÃO: Cache único para contagens de sessões por data
            const endDateStr = examDate.toISOString().split('T')[0];
            const sessionCountsQuery = `
                SELECT session_date, COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_date BETWEEN ? AND ?
                GROUP BY session_date
            `;
            const sessionCountsResult = await dbAll(sessionCountsQuery, [planId, todayStr, endDateStr]);
            
            // Criar mapa para acesso O(1)
            const sessionCountsCache = new Map();
            sessionCountsResult.forEach(row => {
                sessionCountsCache.set(row.session_date, row.count);
            });

            // Simular estratégia inteligente de replanejamento para preview
            const replanPreview = [];
            
            // Buscar sessões futuras por matéria para inserção inteligente
            const futureSessions = await dbAll(`
                SELECT * FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? 
                ORDER BY session_date, id
            `, [planId, todayStr]);

            const futureSessionsBySubject = {};
            futureSessions.forEach(session => {
                if (!futureSessionsBySubject[session.subject_name]) {
                    futureSessionsBySubject[session.subject_name] = [];
                }
                futureSessionsBySubject[session.subject_name].push(session);
            });

            // Função auxiliar para encontrar slot disponível no preview
            const findAvailableSlotPreview = (startDate, skipDate = null) => {
                const currentDate = new Date(startDate);
                while (currentDate <= examDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    if (dayOfWeek === 0 || (skipDate && dateStr === skipDate)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    const currentSessionCount = sessionCountsCache.get(dateStr) || 0;

                    if (totalMinutes > 0 && currentSessionCount < maxSessions) {
                        return currentDate;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return null;
            };

            // Agrupar sessões atrasadas por matéria
            const sessionsBySubject = {};
            overdueSessions.forEach(session => {
                if (!sessionsBySubject[session.subject_name]) {
                    sessionsBySubject[session.subject_name] = [];
                }
                sessionsBySubject[session.subject_name].push(session);
            });

            // Simular estratégia inteligente para cada matéria
            for (const [subject, sessions] of Object.entries(sessionsBySubject)) {
                const futureSessionsOfSubject = futureSessionsBySubject[subject] || [];
                
                for (const session of sessions) {
                    let newDate = null;
                    let strategy = '';
                    
                    // ESTRATÉGIA 1: Tentar inserir antes da próxima sessão da mesma matéria
                    if (futureSessionsOfSubject.length > 0) {
                        const nextSessionDate = new Date(futureSessionsOfSubject[0].session_date);
                        const insertDate = new Date(nextSessionDate);
                        insertDate.setDate(insertDate.getDate() - 1);
                        
                        const slot = findAvailableSlotPreview(insertDate > new Date() ? insertDate : new Date());
                        if (slot && slot < nextSessionDate) {
                            newDate = slot;
                            strategy = 'Inserida antes da próxima sessão da matéria';
                        }
                    }
                    
                    // ESTRATÉGIA 2: Encontrar próximo slot disponível
                    if (!newDate) {
                        newDate = findAvailableSlotPreview(new Date());
                        strategy = 'Próximo slot disponível';
                    }
                    
                    if (newDate) {
                        const dateStr = newDate.toISOString().split('T')[0];
                        replanPreview.push({
                            sessionId: session.id,
                            topic: session.topic_description,
                            subject: session.subject_name,
                            sessionType: session.session_type,
                            originalDate: session.session_date,
                            newDate: dateStr,
                            newDateFormatted: newDate.toLocaleDateString('pt-BR', { 
                                weekday: 'long', 
                                day: '2-digit', 
                                month: 'long' 
                            }),
                            strategy: strategy
                        });
                        
                        // Atualizar cache para próximas simulações
                        const currentCount = sessionCountsCache.get(dateStr) || 0;
                        sessionCountsCache.set(dateStr, currentCount + 1);
                    }
                }
            }

            return {
                hasOverdue: true,
                count: overdueSessions.length,
                strategy: 'Redistribuição Inteligente',
                description: 'As tarefas atrasadas serão reagendadas de forma inteligente: preferencialmente antes das próximas sessões da mesma matéria, preservando a continuidade do aprendizado.',
                replanPreview: replanPreview.slice(0, 5), // Mostrar apenas primeiras 5
                totalToReplan: replanPreview.length,
                examDate: plan.exam_date,
                daysUntilExam: Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24))
            };

        } catch (error) {
            console.error('Erro ao gerar preview de replanejamento:', error);
            throw new Error('Erro ao analisar tarefas atrasadas.');
        }
    }
}

module.exports = ScheduleGenerationService;