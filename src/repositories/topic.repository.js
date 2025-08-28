/**
 * Topic Repository - CORRIGIDO
 * Centraliza todas as queries relacionadas a tópicos de estudo
 * CORREÇÃO: Usando apenas colunas que existem na tabela real
 */

const BaseRepository = require('./base.repository');

class TopicRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    /**
     * Cria um novo tópico
     * CORRIGIDO: Usando apenas campos que existem na tabela real
     */
    async createTopic(topicData) {
        const {
            subject_id,
            topic_name,
            description,
            priority_weight,
            difficulty,
            estimated_hours,
            status
        } = topicData;

        const query = `
            INSERT INTO topics (
                subject_id, topic_name, description, priority_weight,
                difficulty, estimated_hours, status,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            subject_id,
            topic_name,
            description || topic_name,
            priority_weight || 3,
            difficulty || 2, // 1=fácil, 2=médio, 3=difícil
            estimated_hours || 2,
            status || 'Pendente'
        ];

        return this.create(query, params);
    }

    /**
     * Cria múltiplos tópicos em lote
     */
    async createBulkTopics(subjectId, topics) {
        return this.transaction(async (repo) => {
            const ids = [];
            for (const topic of topics) {
                const query = `
                    INSERT INTO topics (
                        subject_id, topic_name, description, priority_weight,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING id
                `;
                const result = await repo.create(query, [
                    subjectId,
                    topic.topic_name,
                    topic.description || topic.topic_name,
                    topic.priority_weight || 3
                ]);
                ids.push(result);
            }
            return ids;
        });
    }

    /**
     * Atualiza dados de um tópico
     * CORRIGIDO: Usando apenas campos que existem
     */
    async updateTopic(topicId, updates) {
        const allowedFields = [
            'topic_name', 'description', 'priority_weight',
            'difficulty', 'estimated_hours', 'status',
            'completion_date', 'notes', 'actual_hours'
        ];

        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return 0;
        }

        updateData.updated_at = 'CURRENT_TIMESTAMP';
        
        const { query, params } = this.buildUpdateQuery(
            'topics',
            updateData,
            'id = $1',
            [topicId]
        );

        return this.update(query, params);
    }

    /**
     * Marca tópico como completo
     * CORRIGIDO: Usando campo 'status' em vez de 'completed'
     */
    async markAsCompleted(topicId, completionStats = {}) {
        const query = `
            UPDATE topics 
            SET status = 'Concluído',
                completion_date = CURRENT_DATE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        
        return this.update(query, [topicId]);
    }

    /**
     * Marca tópico como incompleto
     */
    async markAsIncomplete(topicId) {
        const query = `
            UPDATE topics 
            SET status = 'Pendente',
                completion_date = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        return this.update(query, [topicId]);
    }

    /**
     * Busca tópicos por disciplina
     */
    async findBySubjectId(subjectId) {
        const query = `
            SELECT * FROM topics 
            WHERE subject_id = $1 
            ORDER BY priority_weight DESC, topic_name ASC
        `;
        return this.findAll(query, [subjectId]);
    }

    /**
     * Busca tópico por ID
     */
    async findById(topicId) {
        const query = `SELECT * FROM topics WHERE id = $1`;
        return this.findOne(query, [topicId]);
    }

    /**
     * Busca todos os tópicos de um plano
     */
    async findByPlanId(planId) {
        const query = `
            SELECT 
                t.*,
                s.subject_name,
                s.priority_weight as subject_priority
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1
            ORDER BY s.priority_weight DESC, t.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca tópicos pendentes
     */
    async findPendingTopics(planId) {
        const query = `
            SELECT 
                t.*,
                s.subject_name
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1 
                AND t.status != 'Concluído'
            ORDER BY s.priority_weight DESC, t.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca tópicos completados
     */
    async findCompletedTopics(planId) {
        const query = `
            SELECT 
                t.*,
                s.subject_name
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1 
                AND t.status = 'Concluído'
            ORDER BY t.completion_date DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Estatísticas gerais dos tópicos
     * CORRIGIDO: Removido referências a colunas inexistentes
     */
    async getTopicStatistics(planId) {
        const query = `
            SELECT 
                COUNT(*) as total_topics,
                COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_topics,
                COUNT(CASE WHEN status != 'Concluído' THEN 1 END) as pending_topics,
                ROUND(
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0), 2
                ) as completion_percentage
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Progresso por disciplina
     */
    async getProgressBySubject(planId) {
        const query = `
            SELECT 
                s.id as subject_id,
                s.subject_name,
                COUNT(t.id) as total_topics,
                COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) as completed_topics,
                ROUND(
                    COUNT(CASE WHEN t.status = 'Concluído' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(t.id), 0), 2
                ) as progress_percentage
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id, s.subject_name
            ORDER BY progress_percentage DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Deleta um tópico e dados relacionados
     */
    async deleteWithRelatedData(topicId) {
        return this.transaction(async (repo) => {
            // Deletar sessões de estudo relacionadas
            await repo.delete('DELETE FROM study_sessions WHERE topic_id = $1', [topicId]);
            
            // Deletar o tópico
            await repo.delete('DELETE FROM topics WHERE id = $1', [topicId]);
            
            return true;
        });
    }

    /**
     * Deleta todos os tópicos de uma disciplina
     */
    async deleteBySubjectId(subjectId) {
        const query = `DELETE FROM topics WHERE subject_id = $1`;
        return this.delete(query, [subjectId]);
    }

    /**
     * Verifica se tópico existe
     */
    async topicExists(topicId) {
        return super.exists('topics', 'id = $1', [topicId]);
    }

    /**
     * Conta tópicos de uma disciplina
     */
    async countBySubjectId(subjectId) {
        return this.count('topics', 'subject_id = $1', [subjectId]);
    }

    /**
     * Conta tópicos pendentes de um plano
     */
    async countPendingByPlanId(planId) {
        const query = `
            SELECT COUNT(t.id) as count
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1 AND t.status != 'Concluído'
        `;
        const result = await this.findOne(query, [planId]);
        return result.count;
    }

    /**
     * Verifica se tópico pertence ao plano
     */
    async belongsToPlan(topicId, planId) {
        const query = `
            SELECT COUNT(*) as count
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE t.id = $1 AND s.study_plan_id = $2
        `;
        const result = await this.findOne(query, [topicId, planId]);
        return result.count > 0;
    }
}

module.exports = TopicRepository;
