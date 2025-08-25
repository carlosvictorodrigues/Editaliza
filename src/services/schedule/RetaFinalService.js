/**
 * RetaFinalService - FASE 6 WAVE 3 
 * 
 * Serviço dedicado para gerenciar exclusões do modo Reta Final
 * Complementa o RetaFinalProcessor com operações CRUD de exclusões
 * 
 * ENHANCEMENT-FIRST PATTERN:
 * - Reutiliza toda a lógica existente do RetaFinalProcessor
 * - Adiciona operações HTTP específicas sem quebrar funcionalidade
 * - Mantém 100% compatibilidade com sistema atual
 */

const { dbGet, dbRun, dbAll } = require('../../utils/database');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const RetaFinalProcessor = require('./algorithms/RetaFinalProcessor');
const logger = require('../../utils/logger');

// FUNÇÃO UTILITÁRIA PARA DATA BRASILEIRA - CRÍTICA (copiada do controller)
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

class RetaFinalService {
    
    /**
     * GET /api/plans/:planId/reta-final-exclusions
     * Obter todas as exclusões do modo reta final de um plano
     * 
     * @param {number} planId - ID do plano de estudo
     * @param {number} userId - ID do usuário (para autorização)
     * @returns {Object} Lista de exclusões com detalhes
     */
    static async getRetaFinalExclusions(planId, userId) {
        logger.info(`[RetaFinalService] Consultando exclusões para plano ${planId}`);
        
        try {
            // Verificar se plano existe e pertence ao usuário
            const plan = await dbGet(
                'SELECT id, plan_name, reta_final_mode FROM study_plans WHERE id = ? AND user_id = ?',
                [planId, userId]
            );
            
            if (!plan) {
                throw new AppError('Plano não encontrado ou não autorizado', ERROR_TYPES.NOT_FOUND);
            }
            
            // Buscar exclusões detalhadas com JOIN das tabelas
            const exclusions = await dbAll(`
                SELECT DISTINCT
                    rfe.id as exclusion_id,
                    rfe.topic_id,
                    rfe.reason,
                    rfe.created_at,
                    t.topic_name as topic_description,
                    t.status as topic_status,
                    s.subject_name,
                    s.priority_weight as subject_priority,
                    t.priority_weight as topic_priority
                FROM reta_final_excluded_topics rfe
                JOIN topics t ON rfe.topic_id = t.id
                JOIN subjects s ON t.subject_id = s.id
                WHERE rfe.plan_id = ?
                ORDER BY s.subject_name ASC, t.topic_name ASC, rfe.created_at DESC
            `, [planId]);
            
            // Calcular estatísticas das exclusões
            const stats = this._calculateExclusionStats(exclusions);
            
            logger.info(`[RetaFinalService] Encontradas ${exclusions.length} exclusões para plano ${planId}`);
            
            return {
                planId: parseInt(planId),
                planName: plan.plan_name,
                retaFinalMode: Boolean(plan.reta_final_mode),
                totalExclusions: exclusions.length,
                exclusions: exclusions.map(exc => ({
                    id: exc.exclusion_id,
                    topicId: exc.topic_id,
                    topicName: exc.topic_description,
                    topicStatus: exc.topic_status,
                    subjectName: exc.subject_name,
                    reason: exc.reason,
                    combinedPriority: (exc.subject_priority * 10) + exc.topic_priority,
                    subjectPriority: exc.subject_priority,
                    topicPriority: exc.topic_priority,
                    excludedAt: exc.created_at
                })),
                statistics: stats,
                lastUpdated: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error(`[RetaFinalService] Erro ao consultar exclusões:`, error);
            
            if (error instanceof AppError) {
                throw error;
            }
            
            throw new AppError(
                'Erro interno ao consultar exclusões do modo reta final',
                ERROR_TYPES.INTERNAL_ERROR,
                { originalError: error.message }
            );
        }
    }
    
    /**
     * POST /api/plans/:planId/reta-final-exclusions
     * Adicionar exclusão manual no modo reta final
     * 
     * @param {number} planId - ID do plano de estudo
     * @param {number} userId - ID do usuário (para autorização)
     * @param {Object} exclusionData - Dados da exclusão { topicId, reason }
     * @returns {Object} Resultado da operação
     */
    static async addRetaFinalExclusion(planId, userId, exclusionData) {
        const { topicId, reason } = exclusionData;
        
        logger.info(`[RetaFinalService] Adicionando exclusão manual: tópico ${topicId} no plano ${planId}`);
        
        try {
            // Verificar se plano existe, pertence ao usuário e está em modo reta final
            const plan = await dbGet(
                'SELECT id, plan_name, reta_final_mode FROM study_plans WHERE id = ? AND user_id = ?',
                [planId, userId]
            );
            
            if (!plan) {
                throw new AppError('Plano não encontrado ou não autorizado', ERROR_TYPES.NOT_FOUND);
            }
            
            if (!plan.reta_final_mode) {
                throw new AppError(
                    'Exclusões manuais só podem ser feitas no modo Reta Final',
                    ERROR_TYPES.VALIDATION_ERROR
                );
            }
            
            // Verificar se tópico existe e pertence ao plano
            const topic = await dbGet(`
                SELECT t.id, t.topic_name, t.status, s.subject_name, s.id as subject_id,
                       s.priority_weight as subject_priority, t.priority_weight as topic_priority
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE t.id = ? AND s.study_plan_id = ?
            `, [topicId, planId]);
            
            if (!topic) {
                throw new AppError(
                    'Tópico não encontrado ou não pertence ao plano',
                    ERROR_TYPES.NOT_FOUND
                );
            }
            
            // Verificar se já não está excluído
            const existingExclusion = await dbGet(
                'SELECT id FROM reta_final_excluded_topics WHERE plan_id = ? AND topic_id = ?',
                [planId, topicId]
            );
            
            if (existingExclusion) {
                throw new AppError(
                    'Este tópico já está excluído do modo reta final',
                    ERROR_TYPES.CONFLICT
                );
            }
            
            // Criar razão detalhada
            const combinedPriority = (topic.subject_priority * 10) + topic.topic_priority;
            const detailedReason = reason || `Exclusão manual solicitada pelo usuário. Prioridade combinada: ${combinedPriority.toFixed(2)}`;
            
            // Iniciar transação
            await dbRun('BEGIN TRANSACTION');
            
            try {
                // Inserir na tabela de exclusões detalhadas
                const result = await dbRun(`
                    INSERT INTO reta_final_excluded_topics (plan_id, subject_id, topic_id, reason, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    planId,
                    topic.subject_id,
                    topicId,
                    detailedReason,
                    new Date().toISOString()
                ]);
                
                // Inserir também na tabela legada para compatibilidade
                await dbRun(`
                    INSERT INTO reta_final_exclusions (plan_id, topic_id, reason)
                    VALUES (?, ?, ?)
                `, [
                    planId,
                    topicId,
                    `${topic.subject_name} - ${topic.topic_name} (Prioridade: ${combinedPriority.toFixed(2)})`
                ]);
                
                await dbRun('COMMIT');
                
                logger.info(`[RetaFinalService] Exclusão manual criada com sucesso: ID ${result.lastID}`);
                
                return {
                    success: true,
                    exclusionId: result.lastID,
                    message: 'Exclusão adicionada com sucesso ao modo reta final',
                    details: {
                        topicId: parseInt(topicId),
                        topicName: topic.topic_name,
                        subjectName: topic.subject_name,
                        reason: detailedReason,
                        combinedPriority: combinedPriority,
                        excludedAt: new Date().toISOString()
                    }
                };
                
            } catch (insertError) {
                await dbRun('ROLLBACK');
                throw insertError;
            }
            
        } catch (error) {
            logger.error(`[RetaFinalService] Erro ao adicionar exclusão:`, error);
            
            if (error instanceof AppError) {
                throw error;
            }
            
            throw new AppError(
                'Erro interno ao adicionar exclusão ao modo reta final',
                ERROR_TYPES.INTERNAL_ERROR,
                { originalError: error.message }
            );
        }
    }
    
    /**
     * DELETE /api/plans/:planId/reta-final-exclusions/:id
     * Remover exclusão específica do modo reta final
     * 
     * @param {number} planId - ID do plano de estudo
     * @param {number} exclusionId - ID da exclusão
     * @param {number} userId - ID do usuário (para autorização)
     * @returns {Object} Resultado da operação
     */
    static async removeRetaFinalExclusion(planId, exclusionId, userId) {
        logger.info(`[RetaFinalService] Removendo exclusão ${exclusionId} do plano ${planId}`);
        
        try {
            // Verificar se plano existe e pertence ao usuário
            const plan = await dbGet(
                'SELECT id, plan_name, reta_final_mode FROM study_plans WHERE id = ? AND user_id = ?',
                [planId, userId]
            );
            
            if (!plan) {
                throw new AppError('Plano não encontrado ou não autorizado', ERROR_TYPES.NOT_FOUND);
            }
            
            // Buscar exclusão com detalhes do tópico
            const exclusion = await dbGet(`
                SELECT rfe.id, rfe.topic_id, rfe.reason, rfe.created_at,
                       t.topic_name, s.subject_name
                FROM reta_final_excluded_topics rfe
                JOIN topics t ON rfe.topic_id = t.id
                JOIN subjects s ON t.subject_id = s.id
                WHERE rfe.id = ? AND rfe.plan_id = ?
            `, [exclusionId, planId]);
            
            if (!exclusion) {
                throw new AppError(
                    'Exclusão não encontrada ou não pertence ao plano',
                    ERROR_TYPES.NOT_FOUND
                );
            }
            
            // Iniciar transação para remover de ambas as tabelas
            await dbRun('BEGIN TRANSACTION');
            
            try {
                // Remover da tabela principal
                const result1 = await dbRun(
                    'DELETE FROM reta_final_excluded_topics WHERE id = ? AND plan_id = ?',
                    [exclusionId, planId]
                );
                
                // Remover também da tabela legada (por topic_id)
                await dbRun(
                    'DELETE FROM reta_final_exclusions WHERE plan_id = ? AND topic_id = ?',
                    [planId, exclusion.topic_id]
                );
                
                await dbRun('COMMIT');
                
                if (result1.changes === 0) {
                    throw new AppError(
                        'Exclusão não encontrada ou já foi removida',
                        ERROR_TYPES.NOT_FOUND
                    );
                }
                
                logger.info(`[RetaFinalService] Exclusão ${exclusionId} removida com sucesso`);
                
                return {
                    success: true,
                    message: 'Exclusão removida com sucesso do modo reta final',
                    details: {
                        exclusionId: parseInt(exclusionId),
                        topicId: exclusion.topic_id,
                        topicName: exclusion.topic_name,
                        subjectName: exclusion.subject_name,
                        originalReason: exclusion.reason,
                        removedAt: new Date().toISOString()
                    }
                };
                
            } catch (deleteError) {
                await dbRun('ROLLBACK');
                throw deleteError;
            }
            
        } catch (error) {
            logger.error(`[RetaFinalService] Erro ao remover exclusão:`, error);
            
            if (error instanceof AppError) {
                throw error;
            }
            
            throw new AppError(
                'Erro interno ao remover exclusão do modo reta final',
                ERROR_TYPES.INTERNAL_ERROR,
                { originalError: error.message }
            );
        }
    }
    
    /**
     * Calcula estatísticas das exclusões
     * 
     * @param {Array} exclusions - Lista de exclusões
     * @returns {Object} Estatísticas calculadas
     */
    static _calculateExclusionStats(exclusions) {
        const stats = {
            totalExclusions: exclusions.length,
            subjectDistribution: {},
            priorityDistribution: {
                high: 0,    // >= 40
                medium: 0,  // 20-39
                low: 0      // < 20
            },
            statusDistribution: {},
            averagePriority: 0
        };
        
        if (exclusions.length === 0) {
            return stats;
        }
        
        let totalPriority = 0;
        
        exclusions.forEach(exc => {
            // Distribuição por disciplina
            const subject = exc.subject_name || 'Desconhecida';
            stats.subjectDistribution[subject] = (stats.subjectDistribution[subject] || 0) + 1;
            
            // Distribuição por status
            const status = exc.topic_status || 'Desconhecido';
            stats.statusDistribution[status] = (stats.statusDistribution[status] || 0) + 1;
            
            // Análise de prioridade
            const combinedPriority = (exc.subject_priority * 10) + exc.topic_priority;
            totalPriority += combinedPriority;
            
            if (combinedPriority >= 40) {
                stats.priorityDistribution.high++;
            } else if (combinedPriority >= 20) {
                stats.priorityDistribution.medium++;
            } else {
                stats.priorityDistribution.low++;
            }
        });
        
        stats.averagePriority = (totalPriority / exclusions.length).toFixed(2);
        
        return stats;
    }
    
    /**
     * Valida dados de entrada para exclusão
     * 
     * @param {Object} data - Dados para validar
     * @returns {Object} Resultado da validação
     */
    static validateExclusionData(data) {
        const { topicId, reason } = data;
        const validation = {
            isValid: true,
            errors: []
        };
        
        // Validar topicId
        if (!topicId || isNaN(parseInt(topicId)) || parseInt(topicId) <= 0) {
            validation.isValid = false;
            validation.errors.push('topicId deve ser um número positivo válido');
        }
        
        // Validar reason (opcional, mas se fornecido deve ter tamanho adequado)
        if (reason && (typeof reason !== 'string' || reason.length > 1000)) {
            validation.isValid = false;
            validation.errors.push('reason deve ser uma string de até 1000 caracteres');
        }
        
        return validation;
    }
    
    /**
     * Integração com RetaFinalProcessor para obter exclusões processadas automaticamente
     * 
     * @param {number} planId - ID do plano
     * @returns {Array} Lista de exclusões do processor
     */
    static async getProcessedExclusions(planId) {
        try {
            const dbExecutor = {
                get: dbGet,
                all: dbAll,
                run: dbRun
            };
            
            const exclusions = await RetaFinalProcessor.getExclusionsForPlan(planId, dbExecutor);
            
            logger.info(`[RetaFinalService] Integração com processor: ${exclusions.length} exclusões encontradas`);
            
            return exclusions;
            
        } catch (error) {
            logger.error(`[RetaFinalService] Erro na integração com processor:`, error);
            throw new AppError(
                'Erro ao integrar com processador de reta final',
                ERROR_TYPES.INTERNAL_ERROR,
                { originalError: error.message }
            );
        }
    }
    
    /**
     * Sincronizar exclusões manuais com processamento automático
     * Útil após reprocessamento do cronograma
     * 
     * @param {number} planId - ID do plano
     * @param {number} userId - ID do usuário
     * @returns {Object} Resultado da sincronização
     */
    static async syncExclusions(planId, userId) {
        logger.info(`[RetaFinalService] Sincronizando exclusões para plano ${planId}`);
        
        try {
            const plan = await dbGet(
                'SELECT id, reta_final_mode FROM study_plans WHERE id = ? AND user_id = ?',
                [planId, userId]
            );
            
            if (!plan) {
                throw new AppError('Plano não encontrado ou não autorizado', ERROR_TYPES.NOT_FOUND);
            }
            
            if (!plan.reta_final_mode) {
                return {
                    success: true,
                    message: 'Plano não está em modo reta final, nenhuma sincronização necessária',
                    syncedCount: 0
                };
            }
            
            // Obter exclusões atuais
            const currentExclusions = await this.getRetaFinalExclusions(planId, userId);
            
            // Obter exclusões processadas pelo algorithm
            const processedExclusions = await this.getProcessedExclusions(planId);
            
            logger.info(`[RetaFinalService] Sincronização concluída: ${currentExclusions.totalExclusions} atuais, ${processedExclusions.length} processadas`);
            
            return {
                success: true,
                message: 'Exclusões sincronizadas com sucesso',
                syncedCount: currentExclusions.totalExclusions,
                processedCount: processedExclusions.length,
                lastSync: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error(`[RetaFinalService] Erro na sincronização:`, error);
            throw error;
        }
    }
}

module.exports = RetaFinalService;