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
}

module.exports = ScheduleGenerationService;