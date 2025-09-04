const db = require('../config/database');
const Logger = require('../utils/logger');

class PreferencesController {
    /**
     * Busca as preferências de email do usuário
     */
    async getEmailPreferences(req, res) {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        try {
            // Buscar preferências existentes
            const result = await db.query(
                `SELECT email_daily_schedule, email_weekly_summary, email_study_reminders 
                 FROM user_email_preferences 
                 WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                // Se não existir, criar com valores padrão
                const insertResult = await db.query(
                    `INSERT INTO user_email_preferences 
                     (user_id, email_daily_schedule, email_weekly_summary, email_study_reminders) 
                     VALUES ($1, true, true, false)
                     RETURNING email_daily_schedule, email_weekly_summary, email_study_reminders`,
                    [userId]
                );
                
                return res.json(insertResult.rows[0]);
            }

            res.json(result.rows[0]);
        } catch (error) {
            Logger.error('Erro ao buscar preferências de email:', error);
            res.status(500).json({ error: 'Erro ao buscar preferências' });
        }
    }

    /**
     * Atualiza as preferências de email do usuário
     */
    async updateEmailPreferences(req, res) {
        const userId = req.user?.id;
        const { email_daily_schedule, email_weekly_summary, email_study_reminders } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        try {
            // Verificar se já existe registro
            const existsResult = await db.query(
                'SELECT id FROM user_email_preferences WHERE user_id = $1',
                [userId]
            );

            let result;
            if (existsResult.rows.length === 0) {
                // Inserir novo registro
                result = await db.query(
                    `INSERT INTO user_email_preferences 
                     (user_id, email_daily_schedule, email_weekly_summary, email_study_reminders) 
                     VALUES ($1, $2, $3, $4)
                     RETURNING email_daily_schedule, email_weekly_summary, email_study_reminders`,
                    [userId, email_daily_schedule, email_weekly_summary, email_study_reminders]
                );
            } else {
                // Atualizar registro existente
                result = await db.query(
                    `UPDATE user_email_preferences 
                     SET email_daily_schedule = $2, 
                         email_weekly_summary = $3, 
                         email_study_reminders = $4,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1
                     RETURNING email_daily_schedule, email_weekly_summary, email_study_reminders`,
                    [userId, email_daily_schedule, email_weekly_summary, email_study_reminders]
                );
            }

            Logger.info(`Preferências de email atualizadas para usuário ${userId}`);
            res.json(result.rows[0]);
        } catch (error) {
            Logger.error('Erro ao atualizar preferências de email:', error);
            res.status(500).json({ error: 'Erro ao atualizar preferências' });
        }
    }

    /**
     * Atualiza uma preferência específica
     */
    async updateSinglePreference(req, res) {
        const userId = req.user?.id;
        const { preference } = req.params;
        const { value } = req.body;
        
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        const allowedPreferences = ['email_daily_schedule', 'email_weekly_summary', 'email_study_reminders'];
        if (!allowedPreferences.includes(preference)) {
            return res.status(400).json({ error: 'Preferência inválida' });
        }

        try {
            // Verificar se já existe registro
            const existsResult = await db.query(
                'SELECT id FROM user_email_preferences WHERE user_id = $1',
                [userId]
            );

            if (existsResult.rows.length === 0) {
                // Criar registro com valores padrão e atualizar a preferência específica
                const defaults = {
                    email_daily_schedule: true,
                    email_weekly_summary: true,
                    email_study_reminders: false
                };
                defaults[preference] = value;
                
                await db.query(
                    `INSERT INTO user_email_preferences 
                     (user_id, email_daily_schedule, email_weekly_summary, email_study_reminders) 
                     VALUES ($1, $2, $3, $4)`,
                    [userId, defaults.email_daily_schedule, defaults.email_weekly_summary, defaults.email_study_reminders]
                );
            } else {
                // Atualizar apenas a preferência específica
                await db.query(
                    `UPDATE user_email_preferences 
                     SET ${preference} = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1`,
                    [userId, value]
                );
            }

            Logger.info(`Preferência ${preference} atualizada para usuário ${userId}: ${value}`);
            res.json({ [preference]: value });
        } catch (error) {
            Logger.error(`Erro ao atualizar preferência ${preference}:`, error);
            res.status(500).json({ error: 'Erro ao atualizar preferência' });
        }
    }
}

module.exports = new PreferencesController();