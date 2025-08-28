/**
 * Session Repository - CORRIGIDO
 * Centraliza todas as queries relacionadas a sessões de estudo
 */

const BaseRepository = require('./base.repository');

class SessionRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    /**
     * Busca sessões por plano
     */
    async findByPlanId(planId) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
            ORDER BY session_date ASC
        `;
        return this.findAll(query, [planId]);
    }

    /**
     * Conta sessões atrasadas
     */
    async countOverdueSessions(planId, currentDate) {
        const query = `
            SELECT COUNT(*) as count
            FROM study_sessions 
            WHERE study_plan_id = $1 
                AND session_date < $2
                AND status = 'Pendente'
        `;
        const result = await this.findOne(query, [planId, currentDate]);
        return result ? result.count : 0;
    }

    /**
     * Busca sessões atrasadas
     */
    async findOverdueSessions(planId, currentDate) {
        const query = `
            SELECT * FROM study_sessions 
            WHERE study_plan_id = $1 
                AND session_date < $2
                AND status = 'Pendente'
            ORDER BY session_date ASC
        `;
        return this.findAll(query, [planId, currentDate]);
    }

    /**
     * Cria nova sessão
     */
    async createSession(sessionData) {
        const {
            study_plan_id, session_date, session_type,
            subject_name, topic_id, status, duration_minutes
        } = sessionData;

        const query = `
            INSERT INTO study_sessions (
                study_plan_id, session_date, session_type,
                subject_name, topic_id, status, duration_minutes,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id
        `;

        const params = [
            study_plan_id,
            session_date,
            session_type || 'Novo Tópico',
            subject_name,
            topic_id,
            status || 'Pendente',
            duration_minutes || 50
        ];

        return this.create(query, params);
    }

    /**
     * Atualiza status da sessão
     */
    async updateSessionStatus(sessionId, status) {
        const query = `
            UPDATE study_sessions 
            SET status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        return this.update(query, [sessionId, status]);
    }

    /**
     * Deleta sessões de um plano
     */
    async deleteByPlanId(planId) {
        const query = `DELETE FROM study_sessions WHERE study_plan_id = $1`;
        return this.delete(query, [planId]);
    }
}

module.exports = SessionRepository;
