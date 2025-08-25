/**
 * BatchUpdateService - Operações de atualização em lote para cronogramas
 * 
 * FASE 6 WAVE 4 - BATCH UPDATES
 * 
 * Este serviço coordena atualizações em lote eficientes para:
 * - Status de múltiplas sessões de estudo
 * - Detalhes de progresso e tempo estudado
 * - Questões resolvidas em batch
 * - Validações atômicas com transações
 * 
 * CARACTERÍSTICAS CRÍTICAS:
 * - Transações atômicas - ou tudo funciona, ou nada é alterado
 * - Validações robustas antes de qualquer update
 * - Performance otimizada com prepared statements
 * - Logs detalhados para auditoria
 * - Rollback automático em caso de erro
 */

const db = require('../../../database-postgresql');
const logger = require('../../utils/logger');

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

class BatchUpdateService {
    /**
     * Atualização em lote de status de sessões
     * POST /api/plans/:planId/batch_update
     */
    static async batchUpdateSchedule(planId, userId, updates) {
        try {
            // Validar entrada
            if (!Array.isArray(updates) || updates.length === 0) {
                throw new Error('Lista de atualizações deve ser um array não-vazio');
            }

            if (updates.length > 100) {
                throw new Error('Máximo de 100 atualizações por lote permitido');
            }

            // Verificar se o plano pertence ao usuário
            const plan = await dbGet(
                'SELECT id FROM study_plans WHERE id = ? AND user_id = ?', 
                [planId, userId]
            );

            if (!plan) {
                throw new Error('Plano não encontrado ou não autorizado');
            }

            // Validar estrutura de cada update
            const validUpdates = [];
            for (const update of updates) {
                if (!update.sessionId || typeof update.sessionId !== 'number') {
                    throw new Error('sessionId é obrigatório e deve ser número');
                }

                // Verificar se a sessão pertence ao plano
                const session = await dbGet(
                    'SELECT id FROM study_sessions WHERE id = ? AND study_plan_id = ?',
                    [update.sessionId, planId]
                );

                if (!session) {
                    throw new Error(`Sessão ${update.sessionId} não encontrada no plano`);
                }

                const validUpdate = {
                    sessionId: update.sessionId
                };

                // Validar campos opcionais
                if (update.status) {
                    const validStatuses = ['Pendente', 'Concluído', 'Pulado', 'Adiado'];
                    if (!validStatuses.includes(update.status)) {
                        throw new Error(`Status inválido: ${update.status}`);
                    }
                    validUpdate.status = update.status;
                }

                if (update.questionsResolved !== undefined) {
                    if (!Number.isInteger(update.questionsResolved) || update.questionsResolved < 0) {
                        throw new Error('questionsResolved deve ser um inteiro não-negativo');
                    }
                    validUpdate.questionsResolved = update.questionsResolved;
                }

                if (update.timeStudiedSeconds !== undefined) {
                    if (!Number.isInteger(update.timeStudiedSeconds) || update.timeStudiedSeconds < 0) {
                        throw new Error('timeStudiedSeconds deve ser um inteiro não-negativo');
                    }
                    validUpdate.timeStudiedSeconds = update.timeStudiedSeconds;
                }

                validUpdates.push(validUpdate);
            }

            // Iniciar transação
            await dbRun('BEGIN');

            let updatedCount = 0;
            
            try {
                for (const update of validUpdates) {
                    const setParts = [];
                    const params = [];

                    if (update.status) {
                        setParts.push('status = ?');
                        params.push(update.status);
                    }

                    if (update.questionsResolved !== undefined) {
                        setParts.push('questions_solved = ?');
                        params.push(update.questionsResolved);
                    }

                    if (update.timeStudiedSeconds !== undefined) {
                        setParts.push('time_studied_seconds = ?');
                        params.push(update.timeStudiedSeconds);
                    }

                    if (setParts.length > 0) {
                        // Adicionar timestamp de atualização
                        setParts.push('updated_at = CURRENT_TIMESTAMP');
                        params.push(update.sessionId);

                        const sql = `UPDATE study_sessions SET ${setParts.join(', ')} WHERE id = ?`;
                        const result = await dbRun(sql, params);
                        
                        if (result.changes > 0) {
                            updatedCount++;
                        }
                    }
                }

                // Confirmar transação
                await dbRun('COMMIT');

                logger.info(`BatchUpdate concluído: ${updatedCount}/${validUpdates.length} sessões atualizadas`, {
                    planId,
                    userId,
                    totalUpdates: validUpdates.length,
                    successfulUpdates: updatedCount
                });

                return {
                    success: true,
                    message: `${updatedCount} sessões atualizadas com sucesso`,
                    updatedCount,
                    totalRequested: validUpdates.length
                };

            } catch (error) {
                // Rollback em caso de erro
                await dbRun('ROLLBACK');
                throw error;
            }

        } catch (error) {
            logger.error('Erro no batch update de cronograma:', error, {
                planId,
                userId,
                updateCount: updates?.length
            });
            throw error;
        }
    }

    /**
     * Atualização detalhada em lote (com dados adicionais)
     * POST /api/plans/:planId/batch_update_details
     */
    static async batchUpdateScheduleDetails(planId, userId, updates) {
        try {
            // Validar entrada
            if (!Array.isArray(updates) || updates.length === 0) {
                throw new Error('Lista de atualizações deve ser um array não-vazio');
            }

            if (updates.length > 50) {
                throw new Error('Máximo de 50 atualizações detalhadas por lote permitido');
            }

            // Verificar se o plano pertence ao usuário
            const plan = await dbGet(
                'SELECT id FROM study_plans WHERE id = ? AND user_id = ?', 
                [planId, userId]
            );

            if (!plan) {
                throw new Error('Plano não encontrado ou não autorizado');
            }

            // Validar estrutura de cada update
            const validUpdates = [];
            for (const update of updates) {
                if (!update.sessionId || typeof update.sessionId !== 'number') {
                    throw new Error('sessionId é obrigatório e deve ser número');
                }

                // Verificar se a sessão pertence ao plano
                const session = await dbGet(
                    'SELECT id, session_type FROM study_sessions WHERE id = ? AND study_plan_id = ?',
                    [update.sessionId, planId]
                );

                if (!session) {
                    throw new Error(`Sessão ${update.sessionId} não encontrada no plano`);
                }

                const validUpdate = {
                    sessionId: update.sessionId,
                    sessionType: session.session_type
                };

                // Validar campos detalhados
                if (update.status) {
                    const validStatuses = ['Pendente', 'Concluído', 'Pulado', 'Adiado'];
                    if (!validStatuses.includes(update.status)) {
                        throw new Error(`Status inválido: ${update.status}`);
                    }
                    validUpdate.status = update.status;
                }

                if (update.questionsResolved !== undefined) {
                    if (!Number.isInteger(update.questionsResolved) || update.questionsResolved < 0) {
                        throw new Error('questionsResolved deve ser um inteiro não-negativo');
                    }
                    validUpdate.questionsResolved = update.questionsResolved;
                }

                if (update.timeStudiedSeconds !== undefined) {
                    if (!Number.isInteger(update.timeStudiedSeconds) || update.timeStudiedSeconds < 0) {
                        throw new Error('timeStudiedSeconds deve ser um inteiro não-negativo');
                    }
                    validUpdate.timeStudiedSeconds = update.timeStudiedSeconds;
                }

                if (update.difficulty !== undefined) {
                    if (!Number.isInteger(update.difficulty) || update.difficulty < 1 || update.difficulty > 5) {
                        throw new Error('difficulty deve ser um inteiro entre 1 e 5');
                    }
                    validUpdate.difficulty = update.difficulty;
                }

                if (update.notes && typeof update.notes === 'string') {
                    if (update.notes.length > 1000) {
                        throw new Error('notes não pode ter mais de 1000 caracteres');
                    }
                    validUpdate.notes = update.notes.trim();
                }

                if (update.completed_at && update.status === 'Concluído') {
                    // Validar formato de data
                    const completedDate = new Date(update.completed_at);
                    if (isNaN(completedDate.getTime())) {
                        throw new Error('completed_at deve ser uma data válida');
                    }
                    validUpdate.completed_at = update.completed_at;
                }

                validUpdates.push(validUpdate);
            }

            // Iniciar transação
            await dbRun('BEGIN');

            let updatedCount = 0;
            const updateDetails = [];
            
            try {
                for (const update of validUpdates) {
                    const setParts = [];
                    const params = [];

                    if (update.status) {
                        setParts.push('status = ?');
                        params.push(update.status);
                    }

                    if (update.questionsResolved !== undefined) {
                        setParts.push('questions_solved = ?');
                        params.push(update.questionsResolved);
                    }

                    if (update.timeStudiedSeconds !== undefined) {
                        setParts.push('time_studied_seconds = ?');
                        params.push(update.timeStudiedSeconds);
                    }

                    if (update.difficulty !== undefined) {
                        setParts.push('difficulty_rating = ?');
                        params.push(update.difficulty);
                    }

                    if (update.notes !== undefined) {
                        setParts.push('notes = ?');
                        params.push(update.notes);
                    }

                    if (update.completed_at) {
                        setParts.push('completed_at = ?');
                        params.push(update.completed_at);
                    }

                    if (setParts.length > 0) {
                        // Adicionar timestamp de atualização
                        setParts.push('updated_at = CURRENT_TIMESTAMP');
                        params.push(update.sessionId);

                        const sql = `UPDATE study_sessions SET ${setParts.join(', ')} WHERE id = ?`;
                        const result = await dbRun(sql, params);
                        
                        if (result.changes > 0) {
                            updatedCount++;
                            updateDetails.push({
                                sessionId: update.sessionId,
                                sessionType: update.sessionType,
                                fieldsUpdated: setParts.length - 1 // Excluir o updated_at
                            });
                        }
                    }
                }

                // Confirmar transação
                await dbRun('COMMIT');

                logger.info(`BatchUpdateDetails concluído: ${updatedCount}/${validUpdates.length} sessões atualizadas`, {
                    planId,
                    userId,
                    totalUpdates: validUpdates.length,
                    successfulUpdates: updatedCount,
                    updateDetails
                });

                return {
                    success: true,
                    message: `${updatedCount} sessões atualizadas com detalhes completos`,
                    updatedCount,
                    totalRequested: validUpdates.length,
                    updateDetails
                };

            } catch (error) {
                // Rollback em caso de erro
                await dbRun('ROLLBACK');
                throw error;
            }

        } catch (error) {
            logger.error('Erro no batch update detalhado:', error, {
                planId,
                userId,
                updateCount: updates?.length
            });
            throw error;
        }
    }

    /**
     * Validar dados de entrada para batch operations
     */
    static validateBatchInput(updates, maxUpdates = 100) {
        if (!Array.isArray(updates)) {
            throw new Error('Updates deve ser um array');
        }

        if (updates.length === 0) {
            throw new Error('Lista de atualizações não pode estar vazia');
        }

        if (updates.length > maxUpdates) {
            throw new Error(`Máximo de ${maxUpdates} atualizações por lote permitido`);
        }

        // Verificar duplicatas de sessionId
        const sessionIds = updates.map(u => u.sessionId).filter(id => id !== undefined);
        const uniqueSessionIds = new Set(sessionIds);
        
        if (sessionIds.length !== uniqueSessionIds.size) {
            throw new Error('Não são permitidos sessionIds duplicados no mesmo lote');
        }

        return true;
    }
}

module.exports = BatchUpdateService;