/**
 * Serviço de Manutenção de Assinaturas
 * 
 * Responsável por:
 * - Marcar planos expirados
 * - Enviar notificações de expiração próxima
 * - Limpar dados de planos antigos
 * - Gerar relatórios de status
 */

const { dbRun, dbAll } = require('../config/database');
const emailService = require('./emailService');
const cron = require('node-cron');

class SubscriptionMaintenanceService {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Inicia o job de manutenção diário
     */
    startDailyMaintenance() {
        // Executar todos os dias às 2:00 AM (horário de Brasília)
        cron.schedule('0 2 * * *', async () => {
            console.log('[SUBSCRIPTION MAINTENANCE] Iniciando manutenção diária...');
            await this.runMaintenance();
        }, {
            timezone: 'America/Sao_Paulo'
        });

        console.log('[SUBSCRIPTION MAINTENANCE] Job de manutenção agendado para 02:00 AM diariamente');
    }

    /**
     * Executa todas as tarefas de manutenção
     */
    async runMaintenance() {
        if (this.isRunning) {
            console.log('[SUBSCRIPTION MAINTENANCE] Job já em execução, pulando...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            const results = {
                expired: await this.markExpiredPlans(),
                expiringSoon: await this.notifyExpiringPlans(),
                expiringToday: await this.notifyExpiringToday(),
                timestamp: new Date().toISOString()
            };

            this.lastRun = results;
            const duration = Date.now() - startTime;

            console.log(`[SUBSCRIPTION MAINTENANCE] Manutenção concluída em ${duration}ms`, results);
            
            return results;

        } catch (error) {
            console.error('[SUBSCRIPTION MAINTENANCE] Erro durante manutenção:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Marca planos expirados
     */
    async markExpiredPlans() {
        try {
            // Marcar planos expirados
            const result = await dbRun(`
                UPDATE users 
                SET plan_status = 'expired',
                    updated_at = NOW()
                WHERE plan_expiry < NOW() 
                AND plan_status = 'active'
            `);

            const count = result.changes || 0;

            if (count > 0) {
                console.log(`[SUBSCRIPTION MAINTENANCE] ${count} planos marcados como expirados`);
                
                // Buscar usuários que acabaram de expirar para notificação
                const expiredUsers = await dbAll(`
                    SELECT email, name, plan_type
                    FROM users
                    WHERE plan_status = 'expired'
                    AND DATE(updated_at) = CURRENT_DATE
                `);

                // Enviar email de expiração
                for (const user of expiredUsers) {
                    await this.sendExpiredNotification(user);
                }
            }

            return count;

        } catch (error) {
            console.error('[SUBSCRIPTION MAINTENANCE] Erro ao marcar planos expirados:', error);
            throw error;
        }
    }

    /**
     * Notifica planos expirando em breve (3, 7 dias)
     */
    async notifyExpiringPlans() {
        try {
            // Buscar planos expirando em 7 dias
            const expiring7Days = await dbAll(`
                SELECT email, name, plan_type, plan_expiry,
                       EXTRACT(DAY FROM (plan_expiry - NOW())) as days_remaining
                FROM users
                WHERE plan_status = 'active'
                AND DATE(plan_expiry) = CURRENT_DATE + INTERVAL '7 days'
            `);

            // Buscar planos expirando em 3 dias
            const expiring3Days = await dbAll(`
                SELECT email, name, plan_type, plan_expiry,
                       EXTRACT(DAY FROM (plan_expiry - NOW())) as days_remaining
                FROM users
                WHERE plan_status = 'active'
                AND DATE(plan_expiry) = CURRENT_DATE + INTERVAL '3 days'
            `);

            let totalNotified = 0;

            // Enviar notificações de 7 dias
            for (const user of expiring7Days) {
                await this.sendExpiringNotification(user, 7);
                totalNotified++;
            }

            // Enviar notificações de 3 dias
            for (const user of expiring3Days) {
                await this.sendExpiringNotification(user, 3);
                totalNotified++;
            }

            if (totalNotified > 0) {
                console.log(`[SUBSCRIPTION MAINTENANCE] ${totalNotified} notificações de expiração enviadas`);
            }

            return totalNotified;

        } catch (error) {
            console.error('[SUBSCRIPTION MAINTENANCE] Erro ao notificar planos expirando:', error);
            throw error;
        }
    }

    /**
     * Notifica planos expirando hoje
     */
    async notifyExpiringToday() {
        try {
            const expiringToday = await dbAll(`
                SELECT email, name, plan_type
                FROM users
                WHERE plan_status = 'active'
                AND DATE(plan_expiry) = CURRENT_DATE
            `);

            for (const user of expiringToday) {
                await this.sendLastDayNotification(user);
            }

            if (expiringToday.length > 0) {
                console.log(`[SUBSCRIPTION MAINTENANCE] ${expiringToday.length} usuários expirando hoje notificados`);
            }

            return expiringToday.length;

        } catch (error) {
            console.error('[SUBSCRIPTION MAINTENANCE] Erro ao notificar expiração hoje:', error);
            throw error;
        }
    }

    /**
     * Envia notificação de plano expirado
     */
    async sendExpiredNotification(user) {
        const emailContent = `
            <h2>Seu plano expirou 😔</h2>
            <p>Olá ${user.name},</p>
            <p>Seu plano ${this.getPlanName(user.plan_type)} expirou.</p>
            <p>Para continuar aproveitando todos os recursos do Editaliza, renove seu plano:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.editaliza.com.br/plans.html" 
                   style="background: #0528f2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                    Renovar Plano
                </a>
            </div>
        `;

        try {
            await emailService.sendEmail({
                to: user.email,
                subject: 'Seu plano Editaliza expirou',
                html: emailService.templates.baseTemplate(emailContent)
            });
        } catch (error) {
            console.error(`[SUBSCRIPTION MAINTENANCE] Erro ao enviar email para ${user.email}:`, error);
        }
    }

    /**
     * Envia notificação de plano expirando
     */
    async sendExpiringNotification(user, daysRemaining) {
        const urgency = daysRemaining <= 3 ? '⚠️ URGENTE: ' : '';
        
        const emailContent = `
            <h2>${urgency}Seu plano expira em ${daysRemaining} dias</h2>
            <p>Olá ${user.name},</p>
            <p>Seu plano ${this.getPlanName(user.plan_type)} expira em <strong>${daysRemaining} dias</strong>.</p>
            <p>Renove agora para não perder o acesso aos seus estudos:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.editaliza.com.br/plans.html" 
                   style="background: #0528f2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                    Renovar Agora
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                💡 Dica: Ao renovar com antecedência, você garante acesso ininterrupto aos seus estudos.
            </p>
        `;

        try {
            await emailService.sendEmail({
                to: user.email,
                subject: `${urgency}Seu plano expira em ${daysRemaining} dias`,
                html: emailService.templates.baseTemplate(emailContent)
            });
        } catch (error) {
            console.error(`[SUBSCRIPTION MAINTENANCE] Erro ao enviar notificação para ${user.email}:`, error);
        }
    }

    /**
     * Envia notificação de último dia
     */
    async sendLastDayNotification(user) {
        const emailContent = `
            <h2>🚨 ÚLTIMO DIA do seu plano!</h2>
            <p>Olá ${user.name},</p>
            <p>Hoje é o <strong>ÚLTIMO DIA</strong> do seu plano ${this.getPlanName(user.plan_type)}!</p>
            <p>Renove AGORA para não perder o acesso:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.editaliza.com.br/plans.html" 
                   style="background: #ff0000; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 18px;">
                    RENOVAR URGENTE
                </a>
            </div>
            <p style="color: #ff0000; font-weight: bold;">
                ⏰ Após a meia-noite, seu acesso será suspenso!
            </p>
        `;

        try {
            await emailService.sendEmail({
                to: user.email,
                subject: '🚨 ÚLTIMO DIA - Seu plano expira hoje!',
                html: emailService.templates.baseTemplate(emailContent)
            });
        } catch (error) {
            console.error(`[SUBSCRIPTION MAINTENANCE] Erro ao enviar alerta de último dia para ${user.email}:`, error);
        }
    }

    /**
     * Retorna nome amigável do plano
     */
    getPlanName(planType) {
        const plans = {
            'mensal': 'Plano Mensal',
            'semestral': 'Plano Semestral',
            'anual': 'Plano Anual'
        };
        return plans[planType] || 'Plano';
    }

    /**
     * Retorna status do serviço
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: '02:00 AM (America/Sao_Paulo)'
        };
    }
}

// Criar instância singleton
const subscriptionMaintenanceService = new SubscriptionMaintenanceService();

module.exports = subscriptionMaintenanceService;