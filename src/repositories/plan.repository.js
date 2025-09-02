/**
 * Plan Repository - CORRIGIDO
 * Centraliza todas as queries relacionadas a planos de estudo
 * CORREÇÃO: Usando apenas colunas que existem na tabela real
 */

const BaseRepository = require('./base.repository');

class PlanRepository extends BaseRepository {
    constructor(db) {
        super(db);
        console.log('[PLAN_REPOSITORY] Inicializado com db:', {
            hasRun: typeof db.run,
            hasGet: typeof db.get, 
            hasAll: typeof db.all,
            constructor: db.constructor.name
        });
    }

    /**
     * Lista todos os planos de um usuário
     * CORRIGIDO: Usando apenas campos que existem
     */
    async findByUserId(userId) {
        // VALIDAÇÃO DE SEGURANÇA
        const userIdInt = parseInt(userId, 10);
        if (isNaN(userIdInt) || userIdInt <= 0) {
            console.error(`[PLAN_REPO] ERRO CRÍTICO: userId inválido: ${userId}`);
            throw new Error('ID de usuário inválido');
        }
        
        const query = `
            SELECT 
                id, user_id, plan_name, exam_date, 
                study_hours_per_day, daily_question_goal, weekly_question_goal,
                session_duration_minutes, review_mode, postponement_count,
                has_essay, reta_final_mode, created_at
            FROM study_plans 
            WHERE user_id = $1 
            ORDER BY id DESC
        `;
        
        console.log(`[PLAN_REPO] Executando findByUserId para usuário ${userIdInt}`);
        console.log(`[PLAN_REPO] Query: ${query}`);
        console.log(`[PLAN_REPO] Parâmetros: [${userIdInt}]`);
        
        // A cláusula "WHERE user_id = $1" no SQL garante que apenas os planos
        // do usuário correto serão retornados. A validação extra em JS é redundante.
        const results = await this.findAll(query, [userIdInt]);
        
        console.log(`[PLAN_REPO] Resultados encontrados: ${results.length} planos`);
        return results;
    }

    /**
     * Busca um plano específico validando ownership
     */
    async findByIdAndUser(planId, userId) {
        const query = `
            SELECT 
                id, user_id, plan_name, exam_date, 
                study_hours_per_day, daily_question_goal, weekly_question_goal,
                session_duration_minutes, review_mode, postponement_count,
                has_essay, reta_final_mode, created_at
            FROM study_plans 
            WHERE id = $1 AND user_id = $2
        `;
        return this.findOne(query, [planId, userId]);
    }

    /**
     * Alias para findByIdAndUser (para compatibilidade)
     */
    async findByIdAndUserId(planId, userId) {
        return this.findByIdAndUser(planId, userId);
    }

    /**
     * Busca plano apenas por ID (sem validação de usuário)
     */
    async findById(planId) {
        const query = `SELECT * FROM study_plans WHERE id = $1`;
        return this.findOne(query, [planId]);
    }

    /**
     * Cria um novo plano de estudos
     * CORRIGIDO: Usando apenas campos que existem na tabela real
     */
    async createPlan(planData) {
        console.log('[PLAN_REPOSITORY] createPlan chamado com:', planData);
        
        const {
            user_id, plan_name, exam_date,
            daily_question_goal, weekly_question_goal, 
            session_duration_minutes, review_mode,
            has_essay, reta_final_mode, study_hours_per_day,
            email_daily_schedule, email_weekly_summary, email_study_reminders
        } = planData;

        // Gerar token único para unsubscribe
        const crypto = require('crypto');
        const unsubscribe_token = crypto.randomBytes(32).toString('hex');
        
        const query = `
            INSERT INTO study_plans (
                user_id, plan_name, exam_date,
                daily_question_goal, weekly_question_goal,
                session_duration_minutes, review_mode,
                has_essay, reta_final_mode, study_hours_per_day,
                email_daily_schedule, email_weekly_summary, email_study_reminders,
                unsubscribe_token, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            user_id, 
            plan_name, 
            exam_date,
            daily_question_goal || 50,
            weekly_question_goal || 300,
            session_duration_minutes || 50,
            review_mode || 'completo',
            has_essay || false,
            reta_final_mode || false,
            study_hours_per_day ? JSON.stringify(study_hours_per_day) : '{"0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 0}',
            email_daily_schedule !== undefined ? email_daily_schedule : true,
            email_weekly_summary !== undefined ? email_weekly_summary : true,
            email_study_reminders !== undefined ? email_study_reminders : true,
            unsubscribe_token
        ];

        const result = await this.create(query, params);
        console.log('[PLAN_REPOSITORY] create retornou:', result);
        
        // Para RETURNING id, result será um objeto { id: X }
        // Retornar o objeto completo para que o controller extraia o id
        return result;
    }

    /**
     * Atualiza configurações do plano
     * CORRIGIDO: Usando apenas campos que existem
     */
    async updatePlanSettings(planId, userId, settings) {
        const allowedFields = [
            'study_hours_per_day', 'daily_question_goal', 'weekly_question_goal', 
            'session_duration_minutes', 'review_mode', 'has_essay', 'reta_final_mode'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                updates[field] = settings[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return 0;
        }

        // Converter study_hours_per_day para JSON se necessário
        if (updates.study_hours_per_day && typeof updates.study_hours_per_day === 'object') {
            updates.study_hours_per_day = JSON.stringify(updates.study_hours_per_day);
        }

        // Remover updated_at pois a coluna não existe na tabela
        // updates.updated_at = 'CURRENT_TIMESTAMP';
        
        const { query, params } = this.buildUpdateQuery(
            'study_plans',
            updates,
            'id = $1 AND user_id = $2',
            [planId, userId]
        );

        return this.update(query, params);
    }

    /**
     * Deleta um plano e todos os dados relacionados
     */
    async deletePlanWithRelatedData(planId, userId) {
        return this.transaction(async (repo) => {
            // Verificar ownership
            const plan = await repo.findOne(
                'SELECT id FROM study_plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            );

            if (!plan) {
                throw new Error('Plano não encontrado ou não autorizado');
            }

            // Deletar em ordem para respeitar foreign keys
            await repo.delete('DELETE FROM study_sessions WHERE study_plan_id = $1', [planId]);
            await repo.delete('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = $1)', [planId]);
            await repo.delete('DELETE FROM subjects WHERE study_plan_id = $1', [planId]);
            await repo.delete('DELETE FROM study_plans WHERE id = $1', [planId]);

            return true;
        });
    }

    /**
     * Conta total de planos de um usuário
     */
    async countUserPlans(userId) {
        return this.count('study_plans', 'user_id = $1', [userId]);
    }

    /**
     * Verifica se usuário é dono do plano
     */
    async userOwnsPlan(planId, userId) {
        return this.exists('study_plans', 'id = $1 AND user_id = $2', [planId, userId]);
    }

    /**
     * Atualiza data do exame
     */
    async updateExamDate(planId, userId, newExamDate) {
        const query = `
            UPDATE study_plans 
            SET exam_date = $3
            WHERE id = $1 AND user_id = $2
        `;
        return this.update(query, [planId, userId, newExamDate]);
    }
}

module.exports = PlanRepository;
