/**
 * TOPICS CONTROLLER - FASE 4 MIGRATION  
 * Controller para gerenciar tópicos com operações BATCH críticas
 * 
 * OPERAÇÕES SUPER CRÍTICAS:
 * - batch_update: Atualização EM LOTE com SQL dinâmico e transações
 * - batch_update_details: Atualização de detalhes em lote
 * - Validações de ownership aninhadas profundas (3 níveis)
 * - CASCADE deletes manuais com transações atômicas
 */

const { dbGet, dbAll, dbRun } = require('../config/database.wrapper');

class TopicsController {
    /**
     * GET /api/subjects/:subjectId/topics
     * CRÍTICO: Listagem de tópicos com validação de ownership
     * 
     * Features críticas:
     * - Validação de ownership aninhada
     * - Parsing de priority_weight para int
     * - Cache headers para performance
     */
    async getTopicsBySubject(req, res) {
        const subjectId = req.params.subjectId;
        
        try {
            // Validação de ownership aninhada (subject -> plan -> user)
            const subject = await dbGet(`
                SELECT s.id FROM subjects s 
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [subjectId, req.user.id]);
            
            if (!subject) {
                return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });
            }

            // Buscar tópicos com campos essenciais
            const rows = await dbAll(
                'SELECT id, topic_name, topic_name as description, status, completion_date, priority_weight FROM topics WHERE subject_id = ? ORDER BY id ASC', 
                [subjectId]
            );
            
            // Parsing crítico do priority_weight para int (preservando lógica original)
            rows.forEach(r => r.priority_weight = parseInt(r.priority_weight, 10) || 3);
            
            // Cache headers para performance
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            res.json(rows);
            
        } catch (error) {
            console.error('Erro ao buscar tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao buscar tópicos' });
        }
    }

    /**
     * PATCH /api/topics/batch_update
     * SUPER CRÍTICO: Atualização EM LOTE com SQL dinâmico 🔥🔥🔥
     * 
     * Features EXTREMAMENTE críticas:
     * - Validação robusta de priority_weight com parsing
     * - Construção dinâmica de SQL baseado nos campos presentes
     * - Transação atômica para múltiplas atualizações
     * - Logging detalhado para debug e auditoria
     * - Validação de ownership para cada tópico
     * 
     * ATENÇÃO: CORE DO SISTEMA - NÃO PODE QUEBRAR ⚠️⚠️⚠️
     */
    async batchUpdateTopics(req, res) {
        const { topics } = req.body;

        try {
            // TRANSAÇÃO ATÔMICA CRÍTICA
            await dbRun('BEGIN');
            
            for (const topic of topics) {
                const { id, status, completion_date, description } = topic;
                let { priority_weight } = topic;
                
                // Log para depurar o valor recebido (preservando logs originais)
                if (priority_weight !== undefined) {
                    console.log(`[DEBUG] Recebido priority_weight para tópico ${id}:`, priority_weight, `(Tipo: ${typeof priority_weight})`);
                }

                // Validação manual ROBUSTA para o peso do tópico
                if (priority_weight !== undefined) {
                    const parsedWeight = parseInt(priority_weight, 10);
                    if (isNaN(parsedWeight) || parsedWeight < 1 || parsedWeight > 5) {
                        console.error(`[VALIDATION] Peso de prioridade inválido para o tópico ${id}: recebido '${priority_weight}'. A atualização do peso será ignorada.`);
                        priority_weight = undefined; // Ignorar atualização deste campo
                    } else {
                        priority_weight = parsedWeight; // Usar o valor numérico validado
                    }
                }

                // CONSTRUÇÃO DINÂMICA DE SQL baseada nos campos presentes
                const updates = [];
                const values = [];
                
                if (status !== undefined) {
                    updates.push('status = ?');
                    values.push(status);
                }
                
                if (completion_date !== undefined) {
                    updates.push('completion_date = ?');
                    const completionDate = status === 'Concluído' ? completion_date : null;
                    values.push(completionDate);
                }
                
                if (description !== undefined && String(description).trim().length > 0) {
                    updates.push('description = ?');
                    values.push(String(description).trim());
                }
                
                if (priority_weight !== undefined) {
                    const parsed = parseInt(priority_weight, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                        updates.push('priority_weight = ?');
                        values.push(parsed);
                    }
                }
                
                if (updates.length === 0) {
                    continue; // Pular se não há nada para atualizar
                }
                
                values.push(id);
                values.push(req.user.id);
                
                // SQL com validação de ownership aninhada PROFUNDA (3 níveis)
                const sql = `
                    UPDATE topics 
                    SET ${updates.join(', ')}
                    WHERE id = ? AND subject_id IN (
                        SELECT id FROM subjects WHERE study_plan_id IN (
                            SELECT id FROM study_plans WHERE user_id = ?
                        )
                    )
                `;
                
                const result = await dbRun(sql, values);
                
                // Logging detalhado para auditoria (preservando logs originais)
                console.log(`[DEBUG] Update tópico ${id}: fields=${updates.join(', ')}, values=${JSON.stringify(values)}; changes=${result.changes}`);
            }
            
            await dbRun('COMMIT');
            res.json({ message: 'Progresso dos tópicos atualizado com sucesso!' });
            
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao atualizar os tópicos.' });
        }
    }

    /**
     * PATCH /api/topics/batch_update_details
     * SUPER CRÍTICO: Atualização EM LOTE de detalhes 🔥🔥🔥  
     * 
     * Features EXTREMAMENTE críticas:
     * - Foco em description e priority_weight
     * - Construção dinâmica de SQL
     * - Transação atômica
     * - Validação de ownership aninhada profunda
     * 
     * ATENÇÃO: CORE DO SISTEMA - NÃO PODE QUEBRAR ⚠️⚠️⚠️
     */
    async batchUpdateTopicsDetails(req, res) {
        const { topics } = req.body;
        const userId = req.user.id;

        try {
            // TRANSAÇÃO ATÔMICA CRÍTICA
            await dbRun('BEGIN');

            for (const topic of topics) {
                const { id, description, priority_weight } = topic;

                // CONSTRUÇÃO DINÂMICA DE SQL baseada nos campos presentes
                const updates = [];
                const values = [];

                if (description !== undefined && String(description).trim().length > 0) {
                    updates.push('description = ?');
                    values.push(String(description).trim());
                }
                
                if (priority_weight !== undefined) {
                    updates.push('priority_weight = ?');
                    values.push(priority_weight);
                }

                if (updates.length === 0) {
                    continue; // Pular se não há nada para atualizar
                }

                values.push(id);
                values.push(userId);

                // SQL com validação de ownership aninhada PROFUNDA (3 níveis)
                const sql = `
                    UPDATE topics
                    SET ${updates.join(', ')}
                    WHERE id = ? AND subject_id IN (
                        SELECT id FROM subjects WHERE study_plan_id IN (
                            SELECT id FROM study_plans WHERE user_id = ?
                        )
                    )
                `;

                const result = await dbRun(sql, values);
                
                // Logging detalhado para auditoria (preservando logs originais)
                console.log(`[DEBUG] Update tópico ${id} (details): fields=${updates.join(', ')}, values=${JSON.stringify(values)}; changes=${result.changes}`);
            }

            await dbRun('COMMIT');
            res.json({ message: 'Tópicos atualizados com sucesso!' });
            
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos em lote:', error);
            res.status(500).json({ 'error': 'Erro ao atualizar os tópicos.' });
        }
    }

    /**
     * PATCH /api/topics/:topicId
     * CRÍTICO: Atualizar tópico individual com SQL condicional
     * 
     * Features críticas:
     * - SQL dinâmico baseado na presença de priority_weight
     * - Validação de ownership aninhada profunda
     */
    async updateTopic(req, res) {
        const { description, priority_weight } = req.body;
        const topicId = req.params.topicId;
        
        // CONSTRUÇÃO DINÂMICA DE SQL baseada nos campos presentes
        let sql, params;
        
        if (priority_weight !== undefined) {
            sql = `
                UPDATE topics SET description = ?, priority_weight = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `;
            params = [description, priority_weight, topicId, req.user.id];
        } else {
            sql = `
                UPDATE topics SET description = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `;
            params = [description, topicId, req.user.id];
        }
        
        try {
            const result = await dbRun(sql, params);
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Tópico não encontrado ou não autorizado.' });
            }
            
            res.json({ message: 'Tópico atualizado com sucesso!' });
            
        } catch (error) {
            console.error('Erro ao atualizar tópico:', error);
            res.status(500).json({ error: 'Erro ao atualizar tópico' });
        }
    }

    /**
     * DELETE /api/topics/:topicId
     * CRÍTICO: Exclusão de tópico com CASCADE e transação
     * 
     * Features críticas:
     * - DELETE CASCADE de study_sessions
     * - Transação atômica
     * - Validação ownership com triple JOIN
     * - Logging detalhado para auditoria
     */
    async deleteTopic(req, res) {
        const topicId = req.params.topicId;
        
        try {
            console.log(`[DELETE_TOPIC] Tentando excluir tópico ${topicId} para usuário ${req.user.id}`);
            
            // Validação de ownership com TRIPLE JOIN
            const topic = await dbGet(`
                SELECT t.id FROM topics t 
                JOIN subjects s ON t.subject_id = s.id
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE t.id = ? AND sp.user_id = ?
            `, [topicId, req.user.id]);
            
            console.log(`[DELETE_TOPIC] Resultado da consulta:`, topic);
            
            if (!topic) {
                console.log(`[DELETE_TOPIC] Tópico ${topicId} não encontrado para usuário ${req.user.id}`);
                return res.status(404).json({ error: 'Tópico não encontrado ou não autorizado.' });
            }

            // TRANSAÇÃO ATÔMICA PARA CASCADE DELETE
            await dbRun('BEGIN');
            
            // CASCADE DELETE manual (ordem crítica):
            // 1. Deletar sessions associadas ao tópico
            await dbRun('DELETE FROM study_sessions WHERE topic_id = ?', [topicId]);
            
            // 2. Deletar o tópico
            await dbRun('DELETE FROM topics WHERE id = ?', [topicId]);
            
            await dbRun('COMMIT');
            res.json({ message: 'Tópico e sessões associadas foram apagados com sucesso' });
            
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar tópico:', error);
            res.status(500).json({ 'error': 'Erro ao apagar tópico' });
        }
    }

    /**
     * POST /api/subjects/:subjectId/topics
     * Criar novo tópico para uma disciplina
     */
    async createTopicForSubject(req, res) {
        const { subjectId } = req.params;
        const { topic_description, weight = 3, subject_id } = req.body;
        
        try {
            // Validar ownership da disciplina
            const subject = await dbGet(
                `SELECT s.* FROM subjects s 
                 JOIN study_plans p ON s.study_plan_id = p.id 
                 WHERE s.id = ? AND p.user_id = ?`,
                [subject_id || subjectId, req.user.id]
            );
            
            if (!subject) {
                return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada' });
            }
            
            // Inserir tópico
            const result = await dbRun(
                `INSERT INTO topics (subject_id, topic_name, priority_weight, status, created_at) 
                 VALUES (?, ?, ?, 'Pendente', NOW())`,
                [subject_id || subjectId, topic_description, weight]
            );
            
            res.status(201).json({
                topic: {
                    id: result.lastID,
                    subject_id: subject_id || subjectId,
                    topic_name: topic_description,
                    priority_weight: weight,
                    status: 'Pendente'
                }
            });
            
        } catch (error) {
            console.error('Erro ao criar tópico:', error);
            res.status(500).json({ error: 'Erro ao criar tópico' });
        }
    }
}

module.exports = new TopicsController();