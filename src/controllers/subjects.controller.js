/**
 * SUBJECTS CONTROLLER - FASE 4 MIGRATION
 * Controller para gerenciar disciplinas com operações transacionais críticas
 * 
 * OPERAÇÕES CRÍTICAS:
 * - Criação de disciplina + tópicos em lote (transação atômica)
 * - Atualização com validação de ownership aninhada
 * - Exclusão CASCADE (subjects -> topics -> sessions)
 * - Listagem otimizada com JOINs complexos
 */

const { dbGet, dbAll, dbRun } = require('../config/database.wrapper');

class SubjectsController {
    /**
     * POST /api/plans/:planId/subjects_with_topics
     * CRÍTICO: Criação de disciplina + múltiplos tópicos em UMA transação atômica
     * 
     * Features críticas:
     * - Validação de ownership do plano
     * - Parsing da lista de tópicos (split por \n)
     * - Inserção em lote com peso padrão 3
     * - Transação BEGIN/COMMIT/ROLLBACK garantindo consistência
     */
    async createSubjectWithTopics(req, res) {
        const { subject_name, priority_weight, topics_list } = req.body;
        const planId = req.params.planId;
        
        try {
            // Validação de ownership do plano
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) {
                return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
            }

            // Parsing da lista de tópicos - mantendo lógica original
            const topics = topics_list.split('\n').map(t => t.trim()).filter(t => t !== '');
            
            // TRANSAÇÃO ATÔMICA CRÍTICA
            await dbRun('BEGIN');
            
            // Inserir disciplina
            const result = await dbRun(
                'INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)', 
                [planId, subject_name, priority_weight]
            );
            const subjectId = result.lastID;
            
            // Inserir tópicos em lote se existirem
            if (topics.length > 0) {
                // Use dbRun para cada tópico - PostgreSQL otimiza com connection pooling
                for (const topic of topics) {
                    // Tópicos novos recebem peso padrão 3, editável depois
                    await dbRun(
                        'INSERT INTO topics (subject_id, topic_name, priority_weight) VALUES (?,?,?)', 
                        [subjectId, topic.substring(0, 500), 3]
                    );
                }
            }
            
            await dbRun('COMMIT');
            res.status(201).json({ message: 'Disciplina e tópicos adicionados com sucesso!' });
            
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao criar disciplina:', error);
            res.status(500).json({ 'error': 'Erro ao criar a disciplina e tópicos.' });
        }
    }

    /**
     * PATCH /api/subjects/:subjectId
     * CRÍTICO: Atualização com validação de ownership aninhada
     * 
     * Features críticas:
     * - Validação multi-nível (subject -> plan -> user)
     * - Atualização condicional baseada em changes
     */
    async updateSubject(req, res) {
        const { subject_name, priority_weight } = req.body;
        const subjectId = req.params.subjectId;
        
        const sql = `
            UPDATE subjects SET subject_name = ?, priority_weight = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
        `;
        
        try {
            const result = await dbRun(sql, [subject_name, priority_weight, subjectId, req.user.id]);
            
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });
            }
            
            res.json({ message: 'Disciplina atualizada com sucesso!' });
            
        } catch (error) {
            console.error('Erro ao atualizar disciplina:', error);
            res.status(500).json({ error: 'Erro ao atualizar disciplina' });
        }
    }

    /**
     * DELETE /api/subjects/:subjectId  
     * CRÍTICO: Exclusão CASCADE com transação atômica
     * 
     * Features críticas:
     * - CASCADE DELETE: sessions -> topics -> subject
     * - Transação atômica garantindo integridade referencial
     * - Validação de ownership com JOIN complexo
     */
    async deleteSubject(req, res) {
        const subjectId = req.params.subjectId;
        
        console.log(`[DELETE /api/subjects/:subjectId] Deleting subject with id: ${subjectId}`);
        
        try {
            // Validação de ownership com JOIN complexo
            const subject = await dbGet(`
                SELECT s.id FROM subjects s 
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [subjectId, req.user.id]);
            
            if (!subject) {
                return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });
            }

            // TRANSAÇÃO ATÔMICA PARA CASCADE DELETE
            await dbRun('BEGIN');
            
            // CASCADE DELETE manual (ordem crítica):
            // 1. Deletar sessions associadas aos tópicos
            await dbRun(
                'DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = ?)', 
                [subjectId]
            );
            
            // 2. Deletar tópicos da disciplina  
            await dbRun('DELETE FROM topics WHERE subject_id = ?', [subjectId]);
            
            // 3. Deletar a disciplina
            await dbRun('DELETE FROM subjects WHERE id = ?', [subjectId]);
            
            await dbRun('COMMIT');
            res.json({ message: 'Disciplina e todos os seus dados foram apagados com sucesso' });
            
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar disciplina:', error);
            res.status(500).json({ 'error': 'Erro ao apagar disciplina' });
        }
    }

    /**
     * GET /api/plans/:planId/subjects_with_topics
     * CRÍTICO: Listagem otimizada com JOIN complexo e agrupamento
     * 
     * Features críticas:
     * - Query otimizada com JOIN múltiplo
     * - Agrupamento de tópicos por disciplina
     * - Cache headers para performance
     */
    async getSubjectsWithTopics(req, res) {
        const { planId } = req.params;
        const { id: userId } = req.user;
        
        try {
            // Validação de ownership do plano
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
            }

            // Query otimizada com JOIN complexo para buscar disciplinas e tópicos
            const sql = `
                SELECT 
                    s.id as subject_id, 
                    s.subject_name, 
                    s.priority_weight as subject_priority_weight,
                    t.id as topic_id,
                    t.topic_name,
                    t.status,
                    t.completion_date,
                    t.priority_weight as topic_priority_weight,
                    t.description
                FROM subjects s
                LEFT JOIN topics t ON s.id = t.subject_id
                WHERE s.study_plan_id = ?
                ORDER BY s.subject_name ASC, t.topic_name ASC
            `;
            
            const rows = await dbAll(sql, [planId]);
            
            // Agrupamento de tópicos por disciplina (lógica original preservada)
            const subjectsMap = new Map();
            
            rows.forEach(row => {
                if (!subjectsMap.has(row.subject_id)) {
                    subjectsMap.set(row.subject_id, {
                        id: row.subject_id,
                        subject_name: row.subject_name,
                        priority_weight: parseInt(row.subject_priority_weight, 10) || 3,
                        topics: []
                    });
                }
                
                if (row.topic_id) {
                    subjectsMap.get(row.subject_id).topics.push({
                        id: row.topic_id,
                        topic_name: row.topic_name,
                        status: row.status,
                        completion_date: row.completion_date,
                        priority_weight: parseInt(row.topic_priority_weight, 10) || 3,
                        description: row.description
                    });
                }
            });
            
            const result = Array.from(subjectsMap.values());
            
            // Cache headers para performance
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            res.json(result);
            
        } catch (error) {
            console.error('Erro ao buscar disciplinas com tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao buscar disciplinas e tópicos' });
        }
    }
}

module.exports = new SubjectsController();