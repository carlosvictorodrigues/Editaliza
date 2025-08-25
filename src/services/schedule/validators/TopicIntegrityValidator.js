const logger = require('../../../utils/logger');

/**
 * Validador de integridade dos topic_ids
 * Implementa a lógica crítica de validação encontrada no server.js
 */
class TopicIntegrityValidator {
    /**
     * Valida se todos os topic_ids existem na base de dados
     * Lógica EXATA baseada no server.js (linhas 2409-2426)
     * @param {Array} sessions - Sessions a serem criadas
     * @param {Function} dbAll - Função de consulta ao banco
     * @returns {Object} Resultado da validação
     */
    static async validateTopicIds(sessions, dbAll) {
        const startTime = Date.now();
        logger.info(`[TopicIntegrityValidator] Iniciando validação de ${sessions.length} sessões`);
        
        try {
            // Lógica EXATA do server.js preservada (linha 2412-2416)
            console.log('[CRONOGRAMA] Validando topic_ids antes da inserção...');
            
            // Coletar todos os topic_ids únicos que não são null
            const uniqueTopicIds = [...new Set(
                sessions
                    .map(s => s.topicId)
                    .filter(id => id !== null && id !== undefined)
            )];
            
            logger.debug(`[TopicIntegrityValidator] Encontrados ${uniqueTopicIds.length} topic_ids únicos para validação`);
            
            // Verificar quais topic_ids existem
            const validTopicIds = new Set();
            if (uniqueTopicIds.length > 0) {
                const placeholders = uniqueTopicIds.map(() => '?').join(',');
                const existingTopics = await dbAll(`SELECT id FROM topics WHERE id IN (${placeholders})`, uniqueTopicIds);
                existingTopics.forEach(topic => validTopicIds.add(topic.id));
                
                console.log(`[CRONOGRAMA] Dos ${uniqueTopicIds.length} topic_ids únicos, ${validTopicIds.size} são válidos`);
                logger.info(`[TopicIntegrityValidator] ${validTopicIds.size}/${uniqueTopicIds.length} topic_ids válidos`);
            }
            
            // Identificar topic_ids inválidos
            const invalidTopicIds = uniqueTopicIds.filter(id => !validTopicIds.has(id));
            
            // Criar mapa de correções necessárias
            const correctionMap = new Map();
            let correctedSessions = 0;
            
            const correctedSessionsArray = sessions.map(session => {
                if (session.topicId !== null && session.topicId !== undefined) {
                    if (!validTopicIds.has(session.topicId)) {
                        logger.warn(`[TopicIntegrityValidator] Topic ID ${session.topicId} não encontrado, definindo como null`);
                        correctionMap.set(session.topicId, null);
                        correctedSessions++;
                        return {
                            ...session,
                            topicId: null
                        };
                    }
                }
                return session;
            });
            
            const executionTime = Date.now() - startTime;
            
            const result = {
                isValid: invalidTopicIds.length === 0,
                totalSessions: sessions.length,
                uniqueTopicIds: uniqueTopicIds.length,
                validTopicIds: validTopicIds.size,
                invalidTopicIds,
                correctedSessions,
                correctionMap,
                sessionsWithCorrections: correctedSessionsArray,
                performance: {
                    validationTime: executionTime
                }
            };
            
            logger.info(`[TopicIntegrityValidator] Validação concluída em ${executionTime}ms`, {
                totalSessions: result.totalSessions,
                validIds: result.validTopicIds,
                invalidIds: result.invalidTopicIds.length,
                corrected: result.correctedSessions
            });
            
            if (invalidTopicIds.length > 0) {
                logger.warn(`[TopicIntegrityValidator] Topic_ids inválidos encontrados:`, invalidTopicIds);
            }
            
            return result;
            
        } catch (error) {
            logger.error(`[TopicIntegrityValidator] Erro durante validação:`, {
                error: error.message,
                stack: error.stack,
                sessionsCount: sessions.length
            });
            
            return {
                isValid: false,
                error: error.message,
                totalSessions: sessions.length,
                performance: {
                    validationTime: Date.now() - startTime
                }
            };
        }
    }
    
    /**
     * Valida a integridade de tópicos de um plano
     * @param {number} planId - ID do plano
     * @param {Function} dbAll - Função de consulta ao banco
     * @returns {Object} Resultado da validação
     */
    static async validatePlanTopics(planId, dbAll) {
        const startTime = Date.now();
        logger.info(`[TopicIntegrityValidator] Validando tópicos do plano ${planId}`);
        
        try {
            // Query EXATA do server.js (linha 1908-1917)
            const allTopicsQuery = `
                SELECT 
                    t.id, t.topic_name, t.topic_name as description, t.status, t.completion_date,
                    s.subject_name, s.priority_weight as subject_priority,
                    COALESCE(t.priority_weight, 3) as topic_priority
                FROM subjects s
                INNER JOIN topics t ON s.id = t.subject_id
                WHERE s.study_plan_id = ?
                ORDER BY s.priority_weight DESC, COALESCE(t.priority_weight, 3) DESC, t.id ASC
            `;
            
            const allTopics = await dbAll(allTopicsQuery, [planId]);
            
            // Normalização EXATA do server.js (linha 1919-1923)
            allTopics.forEach(t => {
                t.subject_priority = parseInt(t.subject_priority, 10) || 3;
                t.topic_priority = parseInt(t.topic_priority, 10) || 3;
            });
            
            logger.debug(`[TopicIntegrityValidator] Encontrados ${allTopics.length} tópicos`);
            
            // Análise de integridade
            const analysis = {
                totalTopics: allTopics.length,
                completedTopics: allTopics.filter(t => t.status === 'Concluído').length,
                pendingTopics: allTopics.filter(t => t.status !== 'Concluído').length,
                topicsWithoutPriority: allTopics.filter(t => !t.topic_priority || t.topic_priority === 3).length,
                subjectsMap: new Map(),
                orphanedTopics: [],
                duplicatedIds: []
            };
            
            // Agrupar por disciplina
            allTopics.forEach(topic => {
                if (!analysis.subjectsMap.has(topic.subject_name)) {
                    analysis.subjectsMap.set(topic.subject_name, {
                        name: topic.subject_name,
                        priority: topic.subject_priority,
                        topics: [],
                        completed: 0,
                        pending: 0
                    });
                }
                
                const subject = analysis.subjectsMap.get(topic.subject_name);
                subject.topics.push(topic);
                
                if (topic.status === 'Concluído') {
                    subject.completed++;
                } else {
                    subject.pending++;
                }
            });
            
            // Detectar IDs duplicados
            const idCounts = new Map();
            allTopics.forEach(topic => {
                const count = idCounts.get(topic.id) || 0;
                idCounts.set(topic.id, count + 1);
            });
            
            idCounts.forEach((count, id) => {
                if (count > 1) {
                    analysis.duplicatedIds.push({ id, count });
                }
            });
            
            const executionTime = Date.now() - startTime;
            
            logger.info(`[TopicIntegrityValidator] Validação de plano concluída em ${executionTime}ms`, {
                planId,
                totalTopics: analysis.totalTopics,
                completed: analysis.completedTopics,
                pending: analysis.pendingTopics,
                subjects: analysis.subjectsMap.size
            });
            
            if (analysis.duplicatedIds.length > 0) {
                logger.warn(`[TopicIntegrityValidator] IDs duplicados encontrados:`, analysis.duplicatedIds);
            }
            
            return {
                isValid: analysis.duplicatedIds.length === 0,
                topics: allTopics,
                analysis,
                performance: {
                    validationTime: executionTime
                }
            };
            
        } catch (error) {
            logger.error(`[TopicIntegrityValidator] Erro ao validar tópicos do plano ${planId}:`, {
                error: error.message,
                stack: error.stack
            });
            
            return {
                isValid: false,
                error: error.message,
                planId,
                performance: {
                    validationTime: Date.now() - startTime
                }
            };
        }
    }
    
    /**
     * Valida tópicos concluídos para geração de revisões
     * Query EXATA do server.js (linha 2031-2037)
     */
    static async validateCompletedTopics(planId, dbAll) {
        const startTime = Date.now();
        logger.debug(`[TopicIntegrityValidator] Validando tópicos concluídos do plano ${planId}`);
        
        try {
            // Query EXATA do server.js
            const completedTopicsQuery = `
                SELECT t.id, t.description, t.completion_date, s.subject_name
                FROM topics t
                INNER JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = ? AND t.status = 'Concluído' AND t.completion_date IS NOT NULL
                ORDER BY t.completion_date DESC
            `;
            
            const completedTopics = await dbAll(completedTopicsQuery, [planId]);
            
            logger.debug(`[TopicIntegrityValidator] ${completedTopics.length} tópicos concluídos encontrados`);
            
            // Validar datas de conclusão
            const invalidDates = [];
            const validTopics = [];
            
            completedTopics.forEach(topic => {
                if (!topic.completion_date) {
                    invalidDates.push({ id: topic.id, reason: 'Data de conclusão ausente' });
                } else {
                    const completionDate = new Date(topic.completion_date + 'T00:00:00');
                    if (isNaN(completionDate.getTime())) {
                        invalidDates.push({ id: topic.id, reason: 'Data de conclusão inválida' });
                    } else {
                        validTopics.push({
                            ...topic,
                            completionDateObj: completionDate
                        });
                    }
                }
            });
            
            const executionTime = Date.now() - startTime;
            
            const result = {
                isValid: invalidDates.length === 0,
                totalCompleted: completedTopics.length,
                validCompleted: validTopics.length,
                invalidDates,
                validTopics,
                performance: {
                    validationTime: executionTime
                }
            };
            
            logger.debug(`[TopicIntegrityValidator] Validação de concluídos: ${result.validCompleted}/${result.totalCompleted} válidos`);
            
            if (invalidDates.length > 0) {
                logger.warn(`[TopicIntegrityValidator] Datas inválidas encontradas:`, invalidDates);
            }
            
            return result;
            
        } catch (error) {
            logger.error(`[TopicIntegrityValidator] Erro ao validar tópicos concluídos:`, {
                planId,
                error: error.message,
                stack: error.stack
            });
            
            return {
                isValid: false,
                error: error.message,
                planId,
                performance: {
                    validationTime: Date.now() - startTime
                }
            };
        }
    }
    
    /**
     * Valida e sanitiza dados de sessão antes da inserção
     * Baseado na lógica do server.js (linhas 2450-2456)
     */
    static sanitizeSessionData(sessionData) {
        return {
            ...sessionData,
            subjectName: String(sessionData.subjectName || '').substring(0, 200),
            topicDescription: String(sessionData.topicDescription || '').substring(0, 500),
            sessionType: sessionData.sessionType || 'Novo Tópico',
            status: 'Pendente'
        };
    }
    
    /**
     * Valida se uma sessão está bem formada
     */
    static validateSessionStructure(session) {
        const requiredFields = ['subjectName', 'topicDescription', 'session_date', 'sessionType'];
        const missingFields = [];
        
        requiredFields.forEach(field => {
            if (!session[field]) {
                missingFields.push(field);
            }
        });
        
        return {
            isValid: missingFields.length === 0,
            missingFields,
            hasTopicId: session.topicId !== null && session.topicId !== undefined
        };
    }
}

module.exports = TopicIntegrityValidator;