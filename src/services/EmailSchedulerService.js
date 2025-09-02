const cron = require('node-cron');
const crypto = require('crypto');

class EmailSchedulerService {
    constructor(db, emailService) {
        this.db = db;
        this.emailService = emailService;
        this.jobs = new Map();
    }

    /**
     * Inicializa o scheduler de emails
     */
    async initialize() {
        console.log('📧 Iniciando Email Scheduler Service...');
        
        // Agendar envio diário às 6h (horário de Brasília)
        this.scheduleDailyEmails();
        
        // Agendar resumo semanal às segundas-feiras às 7h
        this.scheduleWeeklyEmails();
        
        console.log('✅ Email Scheduler Service iniciado');
    }

    /**
     * Agenda envio de emails diários
     */
    scheduleDailyEmails() {
        // Executa todos os dias às 6h
        const dailyJob = cron.schedule('0 6 * * *', async () => {
            console.log('🌅 Iniciando envio de emails diários...');
            await this.sendDailyScheduleEmails();
        }, {
            timezone: 'America/Sao_Paulo'
        });
        
        this.jobs.set('daily', dailyJob);
    }

    /**
     * Agenda envio de emails semanais
     */
    scheduleWeeklyEmails() {
        // Executa toda segunda-feira às 7h
        const weeklyJob = cron.schedule('0 7 * * 1', async () => {
            console.log('📊 Iniciando envio de resumo semanal...');
            await this.sendWeeklyReportEmails();
        }, {
            timezone: 'America/Sao_Paulo'
        });
        
        this.jobs.set('weekly', weeklyJob);
    }

    /**
     * Envia emails com cronograma diário
     */
    async sendDailyScheduleEmails() {
        try {
            // Buscar planos ativos que optaram por receber emails diários
            const query = `
                SELECT DISTINCT
                    u.id as user_id,
                    u.email,
                    u.name,
                    sp.id as plan_id,
                    sp.plan_name,
                    sp.unsubscribe_token,
                    sp.email_time,
                    sp.email_daily_schedule
                FROM study_plans sp
                INNER JOIN users u ON sp.user_id = u.id
                WHERE sp.email_daily_schedule = true
                AND sp.is_active = true
                AND DATE(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') > DATE(COALESCE(sp.last_email_sent, '2000-01-01'))
                ORDER BY u.id
            `;
            
            const result = await this.db.query(query);
            const plans = result.rows;
            
            console.log(`📬 Enviando cronograma diário para ${plans.length} planos ativos`);
            
            for (const plan of plans) {
                try {
                    await this.sendDailyScheduleEmail(plan);
                    
                    // Atualizar timestamp do último envio no plano
                    await this.db.query(
                        'UPDATE study_plans SET last_email_sent = CURRENT_TIMESTAMP WHERE id = $1',
                        [plan.plan_id]
                    );
                    
                    // Registrar no log
                    await this.logEmailSent(plan.user_id, 'daily_schedule', 'Seu cronograma de estudos para hoje 📚');
                    
                } catch (error) {
                    console.error(`Erro ao enviar email para ${plan.email}:`, error);
                    await this.logEmailError(plan.user_id, 'daily_schedule', error.message);
                }
            }
            
            console.log('✅ Emails diários enviados');
            
        } catch (error) {
            console.error('Erro ao enviar emails diários:', error);
        }
    }

    /**
     * Envia email com cronograma diário para um plano
     */
    async sendDailyScheduleEmail(plan) {
        // Buscar cronograma do dia para o plano
        const schedule = await this.getPlanDailySchedule(plan.plan_id);
        
        // Buscar estatísticas de progresso do plano
        const stats = await this.getPlanProgressStats(plan.plan_id);
        
        // Gerar mensagem motivacional
        const motivation = this.getMotivationalMessage(stats);
        
        // Gerar link de unsubscribe
        const unsubscribeUrl = `https://app.editaliza.com.br/api/emails/unsubscribe?token=${plan.unsubscribe_token}`;
        
        // Montar conteúdo do email
        const emailContent = this.buildDailyEmailContent({
            userName: plan.name,
            planName: plan.plan_name,
            schedule,
            stats,
            motivation,
            unsubscribeUrl,
            planId: plan.plan_id
        });
        
        // Enviar email usando o email de suporte
        await this.emailService.sendEmail({
            from: 'Editaliza <suporte@editaliza.com.br>',
            to: plan.email,
            subject: `📚 ${plan.plan_name} - Seu cronograma de hoje`,
            html: emailContent
        });
    }

    /**
     * Busca o cronograma do dia para o usuário
     */
    async getUserDailySchedule(userId) {
        const query = `
            SELECT 
                t.name as topic_name,
                s.name as subject_name,
                sc.scheduled_date,
                sc.session_type,
                sc.estimated_duration_minutes,
                CASE 
                    WHEN ses.status = 'Concluído' THEN true
                    ELSE false
                END as completed
            FROM schedules sc
            INNER JOIN topics t ON sc.topic_id = t.id
            INNER JOIN subjects s ON t.subject_id = s.id
            INNER JOIN study_plans sp ON sc.study_plan_id = sp.id
            LEFT JOIN sessions ses ON ses.schedule_id = sc.id
            WHERE sp.user_id = $1
            AND DATE(sc.scheduled_date) = CURRENT_DATE
            ORDER BY sc.scheduled_date ASC
        `;
        
        const result = await this.db.query(query, [planId]);
        return result.rows;
    }

    /**
     * Busca estatísticas de progresso do usuário
     */
    async getUserProgressStats(userId) {
        const query = `
            WITH plan_stats AS (
                SELECT 
                    sp.id as plan_id,
                    sp.plan_name,
                    COUNT(DISTINCT t.id) as total_topics,
                    COUNT(DISTINCT CASE WHEN ses.status = 'Concluído' THEN t.id END) as completed_topics,
                    AVG(CASE WHEN ses.status = 'Concluído' THEN ses.time_studied_seconds END) as avg_study_time
                FROM study_plans sp
                LEFT JOIN schedules sc ON sc.study_plan_id = sp.id
                LEFT JOIN topics t ON sc.topic_id = t.id
                LEFT JOIN sessions ses ON ses.schedule_id = sc.id
                WHERE sp.user_id = $1
                AND sp.is_active = true
                GROUP BY sp.id, sp.plan_name
            ),
            recent_activity AS (
                SELECT 
                    COUNT(DISTINCT DATE(ses.session_date)) as study_days_last_week,
                    COUNT(DISTINCT ses.id) as sessions_last_week,
                    SUM(ses.time_studied_seconds) / 3600.0 as hours_last_week
                FROM sessions ses
                INNER JOIN schedules sc ON ses.schedule_id = sc.id
                INNER JOIN study_plans sp ON sc.study_plan_id = sp.id
                WHERE sp.user_id = $1
                AND ses.session_date >= CURRENT_DATE - INTERVAL '7 days'
                AND ses.status = 'Concluído'
            )
            SELECT 
                ps.*,
                ra.*,
                ROUND((ps.completed_topics::numeric / NULLIF(ps.total_topics, 0)) * 100, 1) as progress_percentage
            FROM plan_stats ps
            CROSS JOIN recent_activity ra
            LIMIT 1
        `;
        
        const result = await this.db.query(query, [planId]);
        return result.rows[0] || {};
    }

    /**
     * Gera mensagem motivacional baseada no progresso
     */
    getMotivationalMessage(stats) {
        const messages = {
            high: [
                "🚀 Você está arrasando! Continue assim!",
                "💪 Seu progresso está incrível! Mantenha o ritmo!",
                "🌟 Você é uma máquina de estudar! Continue brilhando!",
                "🎯 Foco total! Você está no caminho certo!"
            ],
            medium: [
                "📈 Bom progresso! Hoje é dia de acelerar!",
                "💡 Continue firme! Cada sessão conta!",
                "🎓 Você está evoluindo! Vamos manter o momentum!",
                "⭐ Ótimo trabalho! Hoje vamos dar mais um passo!"
            ],
            low: [
                "🌅 Novo dia, novas oportunidades! Vamos começar!",
                "💫 Hoje é o dia perfeito para retomar os estudos!",
                "🔥 Reacenda sua motivação! Você consegue!",
                "🌱 Pequenos passos levam a grandes conquistas!"
            ],
            new: [
                "🎉 Bem-vindo! Hoje começamos sua jornada!",
                "🚀 Preparado para decolar? Vamos começar!",
                "📚 Sua aprovação começa hoje! Vamos lá!",
                "✨ O primeiro passo é sempre o mais importante!"
            ]
        };
        
        let category = 'new';
        if (stats.progress_percentage >= 70) category = 'high';
        else if (stats.progress_percentage >= 40) category = 'medium';
        else if (stats.progress_percentage > 0) category = 'low';
        
        const categoryMessages = messages[category];
        return categoryMessages[Math.floor(Math.random() * categoryMessages.length)];
    }

    /**
     * Monta o conteúdo HTML do email diário
     */
    buildDailyEmailContent({ userName, planName, schedule, stats, motivation, unsubscribeUrl, planId }) {
        const scheduleHtml = schedule.length > 0 
            ? schedule.map(item => `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; align-items: center;">
                            ${item.completed 
                                ? '<span style="color: #10b981; margin-right: 8px;">✅</span>' 
                                : '<span style="color: #6b7280; margin-right: 8px;">⏰</span>'
                            }
                            <div>
                                <strong style="color: #1f2937;">${item.topic_name}</strong><br>
                                <span style="color: #6b7280; font-size: 14px;">
                                    ${item.subject_name} • ${item.session_type} • ${item.estimated_duration_minutes} min
                                </span>
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td style="padding: 20px; text-align: center; color: #6b7280;">
                        Nenhuma sessão agendada para hoje. Que tal revisar algum conteúdo?
                    </td>
                </tr>
            `;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Seu cronograma de estudos</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <!-- Header com Logo -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; position: relative;">
                        <!-- Logo Editaliza -->
                        <div style="margin-bottom: 20px;">
                            <div style="display: inline-block; padding: 10px 20px; background: rgba(255,255,255,0.15); border-radius: 8px;">
                                <span style="font-size: 24px; font-weight: bold; letter-spacing: -1px;">
                                    📚 EDITALIZA
                                </span>
                            </div>
                        </div>
                        <h1 style="margin: 0; font-size: 26px; font-weight: 600;">Bom dia, ${userName}! ☀️</h1>
                        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${planName}</p>
                        <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.95;">${motivation}</p>
                    </div>
                    
                    <!-- Stats -->
                    <div style="background: white; padding: 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 15px 0;">📊 Seu progresso</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #667eea;">
                                    ${stats.progress_percentage || 0}%
                                </div>
                                <div style="color: #6b7280; font-size: 14px;">Progresso Total</div>
                            </div>
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #10b981;">
                                    ${stats.study_days_last_week || 0}
                                </div>
                                <div style="color: #6b7280; font-size: 14px;">Dias estudados (7d)</div>
                            </div>
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">
                                    ${Math.round(stats.hours_last_week || 0)}h
                                </div>
                                <div style="color: #6b7280; font-size: 14px;">Horas estudadas (7d)</div>
                            </div>
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">
                                    ${stats.completed_topics || 0}/${stats.total_topics || 0}
                                </div>
                                <div style="color: #6b7280; font-size: 14px;">Tópicos concluídos</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Schedule -->
                    <div style="background: white; padding: 20px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 15px 0;">📅 Cronograma de hoje</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            ${scheduleHtml}
                        </table>
                    </div>
                    
                    <!-- CTA -->
                    <div style="background: white; padding: 30px; text-align: center; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                        <a href="https://app.editaliza.com.br/checklist.html" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                            🎯 Começar a estudar agora
                        </a>
                        <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
                            <a href="https://app.editaliza.com.br/plan.html?id=${planId}" style="color: #667eea; text-decoration: none; font-weight: 500;">📅 Ver cronograma completo</a>
                            <span style="margin: 0 10px; color: #d1d5db;">|</span>
                            <a href="https://app.editaliza.com.br/dashboard.html" style="color: #667eea; text-decoration: none; font-weight: 500;">📋 Dashboard</a>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
                        <div style="margin-bottom: 15px;">
                            <a href="https://app.editaliza.com.br" style="text-decoration: none;">
                                <span style="color: #667eea; font-weight: bold; font-size: 14px;">📚 EDITALIZA</span>
                            </a>
                            <p style="color: #9ca3af; font-size: 11px; margin: 5px 0 0 0;">Sua aprovação começa aqui</p>
                        </div>
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">
                            Você está recebendo este email porque ativou notificações para o plano "${planName}".<br>
                            <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">
                                Descadastrar emails deste plano
                            </a>
                            <span style="margin: 0 5px; color: #d1d5db;">|</span>
                            <a href="https://app.editaliza.com.br/plan-settings.html?id=${planId}" style="color: #6b7280; text-decoration: underline;">
                                Configurar preferências
                            </a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Envia emails com resumo semanal
     */
    async sendWeeklyReportEmails() {
        // Implementação similar ao daily, mas com estatísticas semanais
        console.log('📊 Resumo semanal será implementado em breve');
    }

    /**
     * Cria preferências de email para um novo usuário
     */
    async createEmailPreferences(userId) {
        const unsubscribeToken = crypto.randomBytes(32).toString('hex');
        
        const query = `
            INSERT INTO email_preferences (
                user_id, 
                unsubscribe_token,
                daily_schedule,
                weekly_summary,
                study_reminders,
                achievement_notifications
            ) VALUES ($1, $2, true, true, true, true)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING *
        `;
        
        const result = await this.db.query(query, [userId, unsubscribeToken]);
        return result.rows[0];
    }

    /**
     * Atualiza preferências de email
     */
    async updateEmailPreferences(userId, preferences) {
        const query = `
            UPDATE email_preferences
            SET 
                daily_schedule = COALESCE($2, daily_schedule),
                weekly_summary = COALESCE($3, weekly_summary),
                study_reminders = COALESCE($4, study_reminders),
                achievement_notifications = COALESCE($5, achievement_notifications),
                email_time = COALESCE($6, email_time),
                timezone = COALESCE($7, timezone),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            RETURNING *
        `;
        
        const result = await this.db.query(query, [
            userId,
            preferences.dailySchedule,
            preferences.weeklySummary,
            preferences.studyReminders,
            preferences.achievementNotifications,
            preferences.emailTime,
            preferences.timezone
        ]);
        
        return result.rows[0];
    }

    /**
     * Descadastra usuário via token
     */
    async unsubscribeByToken(token, emailType = 'all') {
        const query = emailType === 'all' 
            ? `UPDATE email_preferences 
               SET daily_schedule = false, weekly_summary = false, study_reminders = false
               WHERE unsubscribe_token = $1
               RETURNING user_id`
            : `UPDATE email_preferences 
               SET ${emailType} = false
               WHERE unsubscribe_token = $1
               RETURNING user_id`;
        
        const result = await this.db.query(query, [token]);
        return result.rows[0];
    }

    /**
     * Registra email enviado no log
     */
    async logEmailSent(userId, emailType, subject) {
        const query = `
            INSERT INTO email_logs (user_id, email_type, subject, status)
            VALUES ($1, $2, $3, 'sent')
        `;
        
        await this.db.query(query, [userId, emailType, subject]);
    }

    /**
     * Registra erro no envio de email
     */
    async logEmailError(userId, emailType, errorMessage) {
        const query = `
            INSERT INTO email_logs (user_id, email_type, status, error_message)
            VALUES ($1, $2, 'failed', $3)
        `;
        
        await this.db.query(query, [userId, emailType, errorMessage]);
    }

    /**
     * Envia email de teste imediatamente
     */
    async sendTestEmail(userId) {
        const user = await this.db.query(
            `SELECT u.*, ep.unsubscribe_token 
             FROM users u 
             LEFT JOIN email_preferences ep ON u.id = ep.user_id 
             WHERE u.id = $1`,
            [userId]
        );
        
        if (user.rows.length > 0) {
            await this.sendDailyScheduleEmail(user.rows[0]);
            return true;
        }
        
        return false;
    }

    /**
     * Para todos os jobs agendados
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('📧 Email Scheduler Service parado');
    }
}

module.exports = EmailSchedulerService;