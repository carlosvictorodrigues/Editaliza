/**
 * Subject Repository
 * Centraliza todas as queries relacionadas a disciplinas
 * FASE 3 - Criado manualmente com contexto de negócio adequado
 */

const BaseRepository = require('./base.repository');

class SubjectRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    // ======================== CRIAÇÃO E ATUALIZAÇÃO ========================

    /**
     * Cria uma nova disciplina
     */
    async createSubject(subjectData) {
        const {
            study_plan_id,
            subject_name,
            priority_weight,
            study_percentage,
            difficulty_level
        } = subjectData;

        const query = `
            INSERT INTO subjects (
                study_plan_id, subject_name, priority_weight,
                study_percentage, difficulty_level,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            study_plan_id,
            subject_name,
            priority_weight || 1,
            study_percentage || 0,
            difficulty_level || 'medium'
        ];

        return this.create(query, params);
    }

    /**
     * Cria múltiplas disciplinas em lote
     */
    async createBulkSubjects(planId, subjects) {
        return this.transaction(async (repo) => {
            const ids = [];
            for (const subject of subjects) {
                const query = `
                    INSERT INTO subjects (
                        study_plan_id, subject_name, priority_weight,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING id
                `;
                const result = await repo.create(query, [
                    planId,
                    subject.subject_name,
                    subject.priority_weight || 1
                ]);
                ids.push(result);
            }
            return ids;
        });
    }

    /**
     * Atualiza dados de uma disciplina
     */
    async updateSubject(subjectId, planId, updates) {
        const allowedFields = [
            'subject_name', 'priority_weight', 'study_percentage',
            'difficulty_level', 'notes'
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
            'subjects',
            updateData,
            'id = $1 AND study_plan_id = $2',
            [subjectId, planId]
        );

        return this.update(query, params);
    }

    /**
     * Atualiza peso/prioridade da disciplina
     */
    async updatePriority(subjectId, planId, newPriority) {
        const query = `
            UPDATE subjects 
            SET priority_weight = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND study_plan_id = $2
        `;
        return this.update(query, [subjectId, planId, newPriority]);
    }

    /**
     * Atualiza percentual de estudo
     */
    async updateStudyPercentage(subjectId, planId, percentage) {
        const query = `
            UPDATE subjects 
            SET study_percentage = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND study_plan_id = $2
        `;
        return this.update(query, [subjectId, planId, percentage]);
    }

    // ======================== BUSCA E LISTAGEM ========================

    /**
     * Busca todas as disciplinas de um plano
     */
    async findByPlanId(planId) {
        const query = `
            SELECT * FROM subjects 
            WHERE study_plan_id = $1 
            ORDER BY priority_weight DESC, subject_name ASC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca disciplina por ID validando ownership
     */
    async findByIdAndPlan(subjectId, planId) {
        const query = `
            SELECT * FROM subjects 
            WHERE id = $1 AND study_plan_id = $2
        `;
        return this.findOne(query, [subjectId, planId]);
    }

    /**
     * Busca disciplinas com seus tópicos
     */
    async findWithTopics(planId) {
        const query = `
            SELECT 
                s.id as subject_id,
                s.subject_name,
                s.priority_weight,
                s.study_percentage,
                s.difficulty_level,
                COUNT(t.id) as topics_count,
                COUNT(CASE WHEN t.completed = 1 THEN 1 END) as completed_topics
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id, s.subject_name, s.priority_weight, 
                     s.study_percentage, s.difficulty_level
            ORDER BY s.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca disciplinas com estatísticas de progresso
     */
    async findWithProgress(planId) {
        const query = `
            SELECT 
                s.*,
                COUNT(t.id) as total_topics,
                COUNT(CASE WHEN t.completed = 1 THEN 1 END) as completed_topics,
                ROUND(
                    COUNT(CASE WHEN t.completed = 1 THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(t.id), 0), 2
                ) as progress_percentage,
                SUM(t.total_questions) as total_questions,
                SUM(t.correct_questions) as correct_questions,
                ROUND(
                    SUM(t.correct_questions) * 100.0 / 
                    NULLIF(SUM(t.total_questions), 0), 2
                ) as accuracy_percentage
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id
            ORDER BY s.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca disciplinas ordenadas por prioridade
     */
    async findByPriority(planId) {
        const query = `
            SELECT 
                s.*,
                COUNT(t.id) as topics_count
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id
            ORDER BY s.priority_weight DESC, topics_count DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca disciplina por nome
     */
    async findByName(planId, subjectName) {
        const query = `
            SELECT * FROM subjects 
            WHERE study_plan_id = $1 AND subject_name = $2
        `;
        return this.findOne(query, [planId, subjectName]);
    }

    // ======================== ESTATÍSTICAS ========================

    /**
     * Estatísticas gerais das disciplinas
     */
    async getSubjectStatistics(planId) {
        const query = `
            SELECT 
                COUNT(DISTINCT s.id) as total_subjects,
                COUNT(DISTINCT t.id) as total_topics,
                COUNT(DISTINCT CASE WHEN t.completed = 1 THEN t.id END) as completed_topics,
                AVG(s.priority_weight) as avg_priority,
                SUM(s.study_percentage) as total_percentage,
                MAX(s.priority_weight) as max_priority,
                MIN(s.priority_weight) as min_priority
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
        `;
        return this.findOne(query, [planId]);
    }

    /**
     * Distribuição de tópicos por disciplina
     */
    async getTopicDistribution(planId) {
        const query = `
            SELECT 
                s.subject_name,
                s.priority_weight,
                COUNT(t.id) as topics_count,
                COUNT(CASE WHEN t.completed = 1 THEN 1 END) as completed_count,
                ROUND(
                    COUNT(t.id) * 100.0 / 
                    SUM(COUNT(t.id)) OVER (), 2
                ) as percentage_of_total
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id, s.subject_name, s.priority_weight
            ORDER BY topics_count DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Calcula tempo de estudo por disciplina
     */
    async getStudyTimeDistribution(planId) {
        const query = `
            SELECT 
                s.id,
                s.subject_name,
                s.priority_weight,
                COALESCE(SUM(ss.time_studied_seconds), 0) as total_time_seconds,
                COALESCE(AVG(ss.time_studied_seconds), 0) as avg_time_per_session,
                COUNT(DISTINCT ss.id) as total_sessions
            FROM subjects s
            LEFT JOIN study_sessions ss ON s.subject_name = ss.subject_name
            WHERE s.study_plan_id = $1 
                AND (ss.study_plan_id = $1 OR ss.study_plan_id IS NULL)
            GROUP BY s.id, s.subject_name, s.priority_weight
            ORDER BY total_time_seconds DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Busca disciplinas que precisam de mais atenção
     */
    async findNeedingAttention(planId, thresholdPercentage = 30) {
        const query = `
            SELECT 
                s.*,
                COUNT(t.id) as total_topics,
                COUNT(CASE WHEN t.completed = 1 THEN 1 END) as completed_topics,
                ROUND(
                    COUNT(CASE WHEN t.completed = 1 THEN 1 END) * 100.0 / 
                    NULLIF(COUNT(t.id), 0), 2
                ) as progress_percentage
            FROM subjects s
            LEFT JOIN topics t ON s.id = t.subject_id
            WHERE s.study_plan_id = $1
            GROUP BY s.id
            HAVING COUNT(CASE WHEN t.completed = 1 THEN 1 END) * 100.0 / 
                   NULLIF(COUNT(t.id), 0) < $2
            ORDER BY s.priority_weight DESC
        `;
        return this.findAll(query, [planId, thresholdPercentage]);
    }

    // ======================== DELEÇÃO ========================

    /**
     * Deleta uma disciplina e todos os dados relacionados
     */
    async deleteWithRelatedData(subjectId, planId) {
        return this.transaction(async (repo) => {
            // Verificar ownership
            const subject = await repo.findOne(
                'SELECT id FROM subjects WHERE id = $1 AND study_plan_id = $2',
                [subjectId, planId]
            );

            if (!subject) {
                throw new Error('Disciplina não encontrada ou não autorizada');
            }

            // Deletar em ordem para respeitar foreign keys
            await repo.delete(
                'DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = $1)',
                [subjectId]
            );
            await repo.delete('DELETE FROM topics WHERE subject_id = $1', [subjectId]);
            await repo.delete('DELETE FROM subjects WHERE id = $1', [subjectId]);

            return true;
        });
    }

    /**
     * Deleta todas as disciplinas de um plano
     */
    async deleteByPlanId(planId) {
        const query = `DELETE FROM subjects WHERE study_plan_id = $1`;
        return this.delete(query, [planId]);
    }

    // ======================== VALIDAÇÃO ========================

    /**
     * Verifica se disciplina existe
     */
    async subjectExists(subjectId, planId) {
        return super.exists(
            'subjects',
            'id = $1 AND study_plan_id = $2',
            [subjectId, planId]
        );
    }

    /**
     * Conta disciplinas de um plano
     */
    async countByPlanId(planId) {
        return this.count('subjects', 'study_plan_id = $1', [planId]);
    }

    /**
     * Verifica se nome de disciplina já existe no plano
     */
    async nameExists(planId, subjectName) {
        return this.exists(
            'subjects',
            'study_plan_id = $1 AND subject_name = $2',
            [planId, subjectName]
        );
    }

    /**
     * Calcula total de tópicos de todas as disciplinas
     */
    async getTotalTopicsCount(planId) {
        const query = `
            SELECT COUNT(t.id) as total 
            FROM topics t 
            JOIN subjects s ON t.subject_id = s.id 
            WHERE s.study_plan_id = $1
        `;
        const result = await this.findOne(query, [planId]);
        return result.total;
    }

    // ======================== RETA FINAL ========================

    /**
     * Busca tópicos excluídos da reta final
     */
    async getExcludedTopics(planId) {
        const query = `
            SELECT 
                e.*,
                t.topic_name,
                t.priority_weight,
                s.subject_name,
                s.priority_weight as subject_priority
            FROM reta_final_excluded_topics e
            LEFT JOIN topics t ON t.id = e.topic_id
            LEFT JOIN subjects s ON s.id = COALESCE(e.subject_id, t.subject_id)
            WHERE e.plan_id = $1
            ORDER BY s.priority_weight DESC, t.priority_weight DESC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Recalcula percentuais de estudo
     */
    async recalculateStudyPercentages(planId) {
        return this.transaction(async (repo) => {
            // Buscar total de pesos
            const totalWeight = await repo.findOne(
                'SELECT SUM(priority_weight) as total FROM subjects WHERE study_plan_id = $1',
                [planId]
            );

            if (!totalWeight.total || totalWeight.total === 0) {
                return 0;
            }

            // Atualizar percentuais
            const query = `
                UPDATE subjects 
                SET study_percentage = ROUND(priority_weight * 100.0 / $2, 2),
                    updated_at = CURRENT_TIMESTAMP
                WHERE study_plan_id = $1
            `;
            
            return repo.update(query, [planId, totalWeight.total]);
        });
    }
}

module.exports = SubjectRepository;