/**
 * Serviço de Email com Templates Padronizados
 * Utiliza Gmail SMTP e templates visuais do Editaliza
 */

const nodemailer = require('nodemailer');
const emailTemplates = require('../templates/emailTemplates');

class EmailServiceWithTemplates {
    constructor() {
        this.transporter = null;
        this.fromEmail = 'suporte@editaliza.com.br';
        this.fromName = 'Editaliza';
        this.templates = emailTemplates;
        this.initializeTransporter();
    }
    
    /**
     * Inicializa o transporter do Gmail
     */
    initializeTransporter() {
        const config = {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
                pass: process.env.EMAIL_PASS
            }
        };
        
        if (!config.auth.pass) {
            console.warn('⚠️ EMAIL_PASS não configurado - emails serão simulados');
            return;
        }
        
        try {
            this.transporter = nodemailer.createTransport(config);
            console.log('✅ Gmail SMTP configurado com templates padronizados');
            console.log('📧 Usando:', config.auth.user);
        } catch (error) {
            console.error('❌ Erro ao configurar Gmail:', error.message);
        }
    }
    
    /**
     * Envia email genérico
     */
    async sendEmail(options) {
        if (!this.transporter) {
            console.log('⚠️ Email simulado (SMTP não configurado)');
            console.log('Para:', options.to);
            console.log('Assunto:', options.subject);
            return { success: true, simulated: true };
        }
        
        try {
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: options.to,
                subject: options.subject,
                text: options.text || this.extractTextFromHtml(options.html),
                html: options.html
            };
            
            console.log('📤 Enviando email via Gmail...');
            console.log('   Para:', mailOptions.to);
            console.log('   Assunto:', mailOptions.subject);
            
            const info = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ Email enviado com sucesso!');
            console.log('   Message ID:', info.messageId);
            
            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
                provider: 'Gmail SMTP'
            };
        } catch (error) {
            console.error('❌ Erro ao enviar email:', error.message);
            
            if (error.code === 'EAUTH') {
                console.log('💡 Verifique a senha de app do Gmail');
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Email de Boas-vindas
     */
    async sendWelcomeEmail(email, userName) {
        const html = this.templates.welcomeEmail(userName);
        
        return this.sendEmail({
            to: email,
            subject: '🎉 Bem-vindo ao Editaliza!',
            html
        });
    }
    
    /**
     * Email de Recuperação de Senha
     */
    async sendPasswordRecoveryEmail(email, userName, resetToken, appUrl) {
        const resetLink = `${appUrl || 'https://app.editaliza.com.br'}/reset-password.html?token=${resetToken}`;
        const html = this.templates.passwordRecoveryEmail(userName, resetLink, '1 hora');
        
        return this.sendEmail({
            to: email,
            subject: '🔐 Recuperação de Senha - Editaliza',
            html
        });
    }
    
    /**
     * Email de Cronograma Diário
     */
    async sendDailyScheduleEmail(email, userName, scheduleData) {
        // Formatar o cronograma
        let scheduleHtml = '';
        
        if (scheduleData.topics && scheduleData.topics.length > 0) {
            scheduleHtml = `
                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">
                        📝 Tópicos para Hoje
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #666;">
                        ${scheduleData.topics.map(topic => `
                            <li style="margin: 8px 0;">
                                <strong>${topic.subject}:</strong> ${topic.name}
                                ${topic.duration ? ` (${topic.duration} min)` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            scheduleHtml = this.templates.infoCard(
                'Agenda Livre',
                'Você não tem tópicos programados para hoje. Que tal revisar conteúdos anteriores?',
                '📖',
                '#fff3e0'
            );
        }
        
        const stats = {
            streak: scheduleData.streak || 0,
            todayGoal: scheduleData.todayGoal || 3,
            unsubscribeToken: scheduleData.unsubscribeToken
        };
        
        const html = this.templates.dailyScheduleEmail(userName, scheduleHtml, stats);
        
        return this.sendEmail({
            to: email,
            subject: '📅 Seu Cronograma de Estudos - Editaliza',
            html
        });
    }
    
    /**
     * Email de Resumo Semanal
     */
    async sendWeeklyReportEmail(email, userName, weekData) {
        const html = this.templates.weeklyReportEmail(userName, weekData);
        
        return this.sendEmail({
            to: email,
            subject: '📊 Seu Resumo Semanal - Editaliza',
            html
        });
    }
    
    /**
     * Email de Lembrete de Estudo
     */
    async sendStudyReminderEmail(email, userName, sessionInfo) {
        const html = this.templates.studyReminderEmail(userName, sessionInfo);
        
        return this.sendEmail({
            to: email,
            subject: '⏰ Hora de Estudar - Editaliza',
            html
        });
    }
    
    /**
     * Email de Conquista/Achievement
     */
    async sendAchievementEmail(email, userName, achievement) {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: #333; font-size: 28px; font-weight: 700; text-align: center;">
                Nova Conquista Desbloqueada! 🏆
            </h1>
            
            <p style="margin: 0 0 30px 0; color: #666; font-size: 14px; line-height: 1.6;">
                Parabéns, <strong>${userName}</strong>!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; padding: 30px; background: linear-gradient(135deg, #ffd700, #ffed4e); border-radius: 50%; font-size: 48px;">
                    ${achievement.icon || '🏅'}
                </div>
            </div>
            
            <h2 style="margin: 20px 0 10px 0; color: #333; font-size: 20px; font-weight: 600; text-align: center;">
                ${achievement.title}
            </h2>
            
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
                ${achievement.description}
            </p>
            
            ${this.templates.actionButton('Ver Todas as Conquistas', 'https://app.editaliza.com.br/conquistas')}
        `;
        
        const html = this.templates.baseTemplate(content, {
            preheader: `Você desbloqueou: ${achievement.title}`,
            showSocialLinks: true
        });
        
        return this.sendEmail({
            to: email,
            subject: `🏆 ${achievement.title} - Conquista Desbloqueada!`,
            html
        });
    }
    
    /**
     * Email de Notificação Genérica
     */
    async sendNotificationEmail(email, userName, notification) {
        const content = `
            <h1 style="margin: 0 0 10px 0; color: #333; font-size: 26px; font-weight: 700;">
                ${notification.title}
            </h1>
            
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px; line-height: 1.6;">
                Olá <strong>${userName}</strong>,
            </p>
            
            <div style="color: #666; font-size: 14px; line-height: 1.8;">
                ${notification.message}
            </div>
            
            ${notification.actionUrl ? 
                this.templates.actionButton(
                    notification.actionText || 'Ver Mais',
                    notification.actionUrl
                ) : ''
            }
        `;
        
        const html = this.templates.baseTemplate(content, {
            preheader: notification.preheader || notification.title,
            showSocialLinks: false
        });
        
        return this.sendEmail({
            to: email,
            subject: notification.subject || notification.title,
            html
        });
    }
    
    /**
     * Extrai texto do HTML para versão texto do email
     */
    extractTextFromHtml(html) {
        if (!html) return '';
        
        return html
            .replace(/<style[^>]*>.*?<\/style>/gs, '')
            .replace(/<script[^>]*>.*?<\/script>/gs, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    /**
     * Método para testar todos os templates
     */
    async testAllTemplates(testEmail = 'carlosvictorodrigues@gmail.com') {
        console.log('🧪 Testando todos os templates de email...\n');
        
        const testData = {
            userName: 'Carlos Victor',
            email: testEmail
        };
        
        // 1. Boas-vindas
        console.log('1️⃣ Enviando email de boas-vindas...');
        await this.sendWelcomeEmail(testData.email, testData.userName);
        
        // 2. Recuperação de senha
        console.log('2️⃣ Enviando email de recuperação de senha...');
        await this.sendPasswordRecoveryEmail(
            testData.email,
            testData.userName,
            'test-token-123',
            'https://app.editaliza.com.br'
        );
        
        // 3. Cronograma diário
        console.log('3️⃣ Enviando email de cronograma diário...');
        await this.sendDailyScheduleEmail(testData.email, testData.userName, {
            topics: [
                { subject: 'Direito Constitucional', name: 'Direitos Fundamentais', duration: 45 },
                { subject: 'Português', name: 'Concordância Verbal', duration: 30 }
            ],
            streak: 7,
            todayGoal: 3
        });
        
        // 4. Resumo semanal
        console.log('4️⃣ Enviando email de resumo semanal...');
        await this.sendWeeklyReportEmail(testData.email, testData.userName, {
            startDate: '01/09',
            endDate: '07/09',
            totalHours: 24.5,
            topicsCompleted: 18,
            bestDay: { name: 'Quarta-feira', hours: 5.5 },
            improvement: 'Você estudou 20% mais que a semana passada!'
        });
        
        // 5. Lembrete de estudo
        console.log('5️⃣ Enviando email de lembrete de estudo...');
        await this.sendStudyReminderEmail(testData.email, testData.userName, {
            subject: 'Matemática',
            topic: 'Probabilidade e Estatística',
            duration: 60
        });
        
        // 6. Conquista
        console.log('6️⃣ Enviando email de conquista...');
        await this.sendAchievementEmail(testData.email, testData.userName, {
            title: 'Primeira Semana Completa!',
            description: 'Você completou 7 dias consecutivos de estudo. Continue assim!',
            icon: '🔥'
        });
        
        console.log('\n✅ Todos os templates foram enviados!');
        console.log(`📧 Verifique a caixa de entrada: ${testEmail}`);
    }
}

module.exports = new EmailServiceWithTemplates();