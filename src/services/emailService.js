/**
 * Serviço de Email com fallback para SMTP.
 * Prioriza o envio via Gmail API Service e usa SMTP apenas se o primeiro não estiver configurado.
 */

const nodemailer = require('nodemailer');
const emailTemplates = require('../templates/emailTemplates');
const gmailApiService = require('./gmailApiService'); // Importa o novo serviço

class EmailService {
    constructor() {
        this.transporter = null;
        this.fromEmail = 'suporte@editaliza.com.br';
        this.fromName = 'Editaliza';
        this.templates = emailTemplates;
        
        this.initializeSmtpFallback();
    }
    
    initializeSmtpFallback() {
        if (gmailApiService.gmail) {
            console.info('✅ Usando Gmail API Service. O fallback SMTP não foi inicializado.');
            return;
        }

        console.warn('⚠️ Gmail API Service não está configurado. Tentando inicializar fallback SMTP...');

        const configTLS = {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
                pass: process.env.EMAIL_PASS
            }
        };
        
        if (!configTLS.auth.pass) {
            console.warn('⚠️ EMAIL_PASS não configurado para o fallback SMTP. Emails serão simulados.');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport(configTLS);
            console.info('✅ Fallback SMTP configurado com sucesso (porta 587).');
        } catch (error) {
            console.error('❌ Falha ao configurar o fallback SMTP:', error.message);
        }
    }
    
    async sendEmail(options) {
        if (gmailApiService.gmail) {
            return gmailApiService.sendEmail(options);
        }

        if (this.transporter) {
            console.warn('📤 Enviando via fallback SMTP...');
            try {
                const info = await this.transporter.sendMail({
                    from: `"${this.fromName}" <${this.fromEmail}>`,
                    ...options
                });
                console.info('✅ Email enviado com sucesso via fallback SMTP!');
                return { success: true, messageId: info.messageId, provider: 'Gmail SMTP Fallback' };
            } catch (error) {
                console.error('❌ Erro ao enviar email via fallback SMTP:', error.message);
                return { success: false, error: error.message, provider: 'Gmail SMTP Fallback' };
            }
        }

        console.warn('⚠️ Nenhum serviço de email configurado. Simulando envio.');
        return { success: true, simulated: true, provider: 'None' };
    }

    async send(msg) {
        return this.sendEmail(msg);
    }
    
    async sendPasswordRecoveryEmail(email, userName, resetToken, appUrl) {
        const resetLink = `${appUrl || 'https://app.editaliza.com.br'}/reset-password.html?token=${resetToken}`;
        const html = this.templates.passwordRecoveryEmail(userName, resetLink, '1 hora');
        return this.sendEmail({ to: email, subject: '🔐 Recuperação de Senha - Editaliza', html });
    }
    
    async sendWelcomeEmail(email, userName) {
        const html = this.templates.welcomeEmail(userName);
        return this.sendEmail({ to: email, subject: '🎉 Bem-vindo ao Editaliza!', html });
    }
    
    async sendDailyScheduleEmail(email, userName, scheduleData) {
        let scheduleHtml = '';
        if (scheduleData.topics && scheduleData.topics.length > 0) {
            const topicsHtml = scheduleData.topics.map(topic => {
                const duration = topic.duration ? ` (${topic.duration} min)` : '';
                return `<li style="margin: 8px 0;"><strong>${topic.subject}:</strong> ${topic.name}${duration}</li>`;
            }).join('');
            scheduleHtml = 
                '<div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">' + 
                '<h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">📝 Tópicos para Hoje</h3>' + 
                `<ul style="margin: 0; padding-left: 20px; color: #666;">${topicsHtml}</ul>` + 
                '</div>';
        } else {
            scheduleHtml = this.templates.infoCard('Agenda Livre', 'Você não tem tópicos programados para hoje. Que tal revisar conteúdos anteriores?', '📖', '#fff3e0');
        }
        const stats = { streak: scheduleData.streak || 0, todayGoal: scheduleData.todayGoal || 3, unsubscribeToken: scheduleData.unsubscribeToken };
        const html = this.templates.dailyScheduleEmail(userName, scheduleHtml, stats);
        return this.sendEmail({ to: email, subject: '📅 Seu Cronograma de Estudos - Editaliza', html });
    }
    
    async sendWeeklyReportEmail(email, userName, weekData) {
        const html = this.templates.weeklyReportEmail(userName, weekData);
        return this.sendEmail({ to: email, subject: '📊 Seu Resumo Semanal - Editaliza', html });
    }
    
    async sendStudyReminderEmail(email, userName, sessionInfo) {
        const html = this.templates.studyReminderEmail(userName, sessionInfo);
        return this.sendEmail({ to: email, subject: '⏰ Hora de Estudar - Editaliza', html });
    }
    
    async sendAchievementEmail(email, userName, achievement) {
        const content = 
            '<h1 style="margin: 0 0 10px 0; color: #333; font-size: 28px; font-weight: 700; text-align: center;">Nova Conquista Desbloqueada! 🏆</h1>' + 
            `<p style="margin: 0 0 30px 0; color: #666; font-size: 14px; line-height: 1.6;">Parabéns, <strong>${userName}</strong>!</p>` + 
            `<div style="text-align: center; margin: 30px 0;"><div style="display: inline-block; padding: 30px; background: linear-gradient(135deg, #ffd700, #ffed4e); border-radius: 50%; font-size: 48px;">${achievement.icon || '🏅'}</div></div>` + 
            `<h2 style="margin: 20px 0 10px 0; color: #333; font-size: 20px; font-weight: 600; text-align: center;">${achievement.title}</h2>` + 
            `<p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">${achievement.description}</p>` + 
            this.templates.actionButton('Ver Todas as Conquistas', 'https://app.editaliza.com.br/conquistas');
        
        const html = this.templates.baseTemplate(content, { preheader: `Você desbloqueou: ${achievement.title}`, showSocialLinks: true });
        return this.sendEmail({ to: email, subject: `🏆 ${achievement.title} - Conquista Desbloqueada!`, html });
    }
    
    extractTextFromHtml(html) {
        if (!html) return '';
        return html.replace(/<style[^>]*>.*?<\/style>/gs, '').replace(/<script[^>]*>.*?<\/script>/gs, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
}

module.exports = new EmailService();