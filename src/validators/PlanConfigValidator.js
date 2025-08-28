/**
 * Plan Config Validator - CRIADO
 * Valida configurações de plano
 */

class PlanConfigValidator {
    static validate(config) {
        const errors = [];

        // Validar planId
        if (!config.planId || isNaN(config.planId) || config.planId <= 0) {
            errors.push('ID do plano inválido');
        }

        // Validar userId
        if (!config.userId || isNaN(config.userId) || config.userId <= 0) {
            errors.push('ID do usuário inválido');
        }

        // Validar study_hours_per_day
        if (!config.study_hours_per_day || typeof config.study_hours_per_day !== 'object') {
            errors.push('Configuração de horas de estudo inválida');
        } else {
            const totalHours = Object.values(config.study_hours_per_day)
                .reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
            if (totalHours === 0) {
                errors.push('Deve haver pelo menos algumas horas de estudo definidas');
            }
        }

        // Validar metas
        if (config.daily_question_goal && (isNaN(config.daily_question_goal) || config.daily_question_goal < 0)) {
            errors.push('Meta diária de questões inválida');
        }

        if (config.weekly_question_goal && (isNaN(config.weekly_question_goal) || config.weekly_question_goal < 0)) {
            errors.push('Meta semanal de questões inválida');
        }

        if (config.session_duration_minutes && (isNaN(config.session_duration_minutes) || config.session_duration_minutes <= 0)) {
            errors.push('Duração da sessão inválida');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    static sanitize(config) {
        return {
            planId: parseInt(config.planId, 10) || 0,
            userId: parseInt(config.userId, 10) || 0,
            daily_question_goal: parseInt(config.daily_question_goal, 10) || 50,
            weekly_question_goal: parseInt(config.weekly_question_goal, 10) || 300,
            session_duration_minutes: parseInt(config.session_duration_minutes, 10) || 50,
            study_hours_per_day: config.study_hours_per_day || {},
            has_essay: Boolean(config.has_essay),
            reta_final_mode: Boolean(config.reta_final_mode)
        };
    }
}

module.exports = PlanConfigValidator;
