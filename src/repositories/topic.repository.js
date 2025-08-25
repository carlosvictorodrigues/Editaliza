/**
 * Topic Repository
 * Centraliza todas as queries relacionadas a tópicos de estudo
 * FASE 3 - Criado manualmente com contexto de negócio adequado
 */

const BaseRepository = require('./base.repository');

class TopicRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    // ======================== CRIAÇÃO E ATUALIZAÇÃO ========================

    /**
     * Cria um novo tópico
     */
    async createTopic(topicData) {
        const {
            subject_id,
            topic_name,
            description,
            priority_weight,
            difficulty_level,
            estimated_hours,
            status
        } = topicData;

        const query = `
            INSERT INTO topics (
                subject_id, topic_name, description, priority_weight,
                difficulty_level, estimated_hours, status, completed,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            subject_id,
            topic_name,
            description || topic_name,
            priority_weight || 1,
            difficulty_level || 'medium',
            estimated_hours || 2,
            status || 'pending',
            0
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
                    topic.priority_weight || 1
                ]);
                ids.push(result);
            }
            return ids;
        });
    }

    /**
     * Atualiza dados de um tópico
     */
    async updateTopic(topicId, updates) {
        const allowedFields = [
            'topic_name', 'description', 'priority_weight',
            'difficulty_level', 'estimated_hours', 'status',
            'completed', 'completion_date', 'notes',
            'total_questions', 'correct_questions'
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
     */
    async markAsCompleted(topicId, completionStats = {}) {
        const query = `
            UPDATE topics 
            SET completed = 1,
                status = 'completed',
                completion_date = CURRENT_DATE,
                total_questions = COALESCE($2, total_questions),
                correct_questions = COALESCE($3, correct_questions),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        
        return this.update(query, [
            topicId,
            completionStats.totalQuestions || null,
            completionStats.correctQuestions || null
        ]);
    }

    /**
     * Marca tópico como incompleto
     */
    async markAsIncomplete(topicId) {
        const query = `
            UPDATE topics 
            SET completed = 0,
                status = 'pending',
                completion_date = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        return this.update(query, [topicId]);
    }

    /**
     * Atualiza estatísticas de questões
     */
    async updateQuestionStats(topicId, totalQuestions, correctQuestions) {
        const query = `
            UPDATE topics 
            SET total_questions = $2,
                correct_questions = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        return this.update(query, [topicId, totalQuestions, correctQuestions]);
    }

    // ======================== BUSCA E LISTAGEM ========================

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
                AND t.status != 'completed'
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
                AND t.status = 'completed'
            ORDER BY t.completion_date DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca tópicos por prioridade
     */
    async findHighPriorityTopics(planId, limit = 10) {
        const query = `
            SELECT 
                t.*,
                s.subject_name,
                (s.priority_weight * t.priority_weight) as combined_priority
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1 
                AND t.status != 'completed'
            ORDER BY combined_priority DESC
            LIMIT $2
        `;
        return this.findAll(query, [planId, limit]);
    }

    /**
     * Busca tópicos com estatísticas
     */
    async findWithStatistics(subjectId) {
        const query = `
            SELECT 
                t.*,
                COALESCE(ss.study_time_seconds, 0) as total_study_time,
                COALESCE(ss.sessions_count, 0) as sessions_count,
                ROUND(
                    t.correct_questions * 100.0 / 
                    NULLIF(t.total_questions, 0), 2
                ) as accuracy_percentage
            FROM topics t
            LEFT JOIN (
                SELECT 
                    topic_id,
                    SUM(time_studied_seconds) as study_time_seconds,
                    COUNT(*) as sessions_count
                FROM study_sessions
                WHERE topic_id IS NOT NULL
                GROUP BY topic_id
            ) ss ON t.id = ss.topic_id
            WHERE t.subject_id = $1
            ORDER BY t.priority_weight DESC
        `;
        return this.findAll(query, [subjectId]);
    }

    // ======================== ESTATÍSTICAS ========================

    /**
     * Estatísticas gerais dos tópicos
     */
    async getTopicStatistics(planId) {
        const query = `
            SELECT 
                COUNT(*) as total_topics,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_topics,
                COUNT(CASE WHEN completed = 0 THEN 1 END) as pending_topics,
                ROUND(
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(*), 0), 2
                ) as completion_percentage,
                SUM(total_questions) as total_questions,
                SUM(correct_questions) as correct_questions,
                ROUND(
                    SUM(correct_questions) * 100.0 / 
                    NULLIF(SUM(total_questions), 0), 2
                ) as overall_accuracy
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
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_topics,
                ROUND(
                    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / 
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
     * Tópicos mais difíceis (menor taxa de acerto)
     */
    async findMostDifficultTopics(planId, limit = 5) {
        const query = `
            SELECT 
                t.*,
                s.subject_name,
                ROUND(
                    t.correct_questions * 100.0 / 
                    NULLIF(t.total_questions, 0), 2
                ) as accuracy_percentage
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = $1 
                AND t.total_questions > 0
            ORDER BY accuracy_percentage ASC
            LIMIT $2
        `;
        return this.findAll(query, [planId, limit]);
    }

    // ======================== RETA FINAL ========================

    /**
     * Adiciona tópico à lista de excluídos da reta final
     */
    async excludeFromRetaFinal(planId, topicId, reason = 'manual') {
        // Buscar subject_id do tópico
        const topic = await this.findOne(
            'SELECT subject_id FROM topics WHERE id = $1',
            [topicId]
        );

        if (!topic) {
            throw new Error('Tópico não encontrado');
        }

        const query = `
            INSERT INTO reta_final_excluded_topics 
                (plan_id, subject_id, topic_id, reason, created_at)
            VALUES 
                ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (plan_id, topic_id) DO UPDATE SET
                reason = EXCLUDED.reason,
                created_at = CURRENT_TIMESTAMP
        `;
        
        return this.create(query, [planId, topic.subject_id, topicId, reason]);
    }

    /**
     * Remove tópico da lista de excluídos
     */
    async includeInRetaFinal(planId, topicId) {
        const query = `
            DELETE FROM reta_final_excluded_topics 
            WHERE plan_id = $1 AND topic_id = $2
        `;
        return this.delete(query, [planId, topicId]);
    }

    /**
     * Limpa todos os tópicos excluídos
     */
    async clearExcludedTopics(planId) {
        const query = `DELETE FROM reta_final_excluded_topics WHERE plan_id = $1`;
        return this.delete(query, [planId]);
    }

    /**
     * Busca tópicos excluídos da reta final
     */
    async getExcludedTopics(planId) {
        const query = `
            SELECT 
                e.*,
                t.topic_name,
                t.priority_weight,
                s.subject_name
            FROM reta_final_excluded_topics e
            JOIN topics t ON e.topic_id = t.id
            JOIN subjects s ON t.subject_id = s.id
            WHERE e.plan_id = $1
            ORDER BY s.priority_weight DESC, t.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    // ======================== DELEÇÃO ========================

    /**
     * Deleta um tópico e dados relacionados
     */
    async deleteWithRelatedData(topicId) {
        return this.transaction(async (repo) => {
            // Deletar sessões de estudo relacionadas
            await repo.delete('DELETE FROM study_sessions WHERE topic_id = $1', [topicId]);
            
            // Deletar exclusões da reta final
            await repo.delete('DELETE FROM reta_final_excluded_topics WHERE topic_id = $1', [topicId]);
            
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

    // ======================== VALIDAÇÃO ========================

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
            WHERE s.study_plan_id = $1 AND t.status != 'completed'
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