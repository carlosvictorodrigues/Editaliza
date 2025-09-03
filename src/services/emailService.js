/**
 * Serviço de Email usando Gmail SMTP com Templates Padronizados
 * Configurado para usar suporte@editaliza.com.br
 */

const nodemailer = require('nodemailer');
const emailTemplates = require('../templates/emailTemplates');

class EmailService {
    constructor() {
        this.transporter = null;
        this.fromEmail = 'suporte@editaliza.com.br';
        this.fromName = 'Editaliza';
        this.templates = emailTemplates;
        this.initializeTransporter();
    }
    
    initializeTransporter() {
        // Primeiro tenta porta 465 (SSL direto) que às vezes não é bloqueada
        const configSSL = {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // SSL direto
            auth: {
                user: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
                pass: process.env.EMAIL_PASS
            },
            debug: true,
            logger: true,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
            tls: {
                rejectUnauthorized: false // Temporário para teste
            }
        };
        
        // Configuração alternativa com porta 587 (STARTTLS)
        const configTLS = {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
                pass: process.env.EMAIL_PASS
            },
            debug: true,
            logger: true,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        };
        
        if (!configSSL.auth.pass) {
            console.warn('⚠️ EMAIL_PASS não configurado - emails serão simulados');
            return;
        }
        
        try {
            console.log('🔧 Tentando conexão SSL na porta 465...');
            this.transporter = nodemailer.createTransport(configSSL);
            
            // Adicionar listeners para debug
            this.transporter.on('error', (err) => {
                console.error('❌ Erro no transporter SSL:', err.message);
                
                // Tentar fallback para porta 587
                console.log('🔧 Tentando fallback para porta 587...');
                try {
                    this.transporter = nodemailer.createTransport(configTLS);
                    console.log('✅ Gmail SMTP configurado com porta 587');
                } catch (tlsError) {
                    console.error('❌ Ambas as portas falharam:', tlsError.message);
                }
            });
            
            this.transporter.on('idle', () => {
                console.log('📧 Transporter está idle');
            });
            
            console.log('✅ Gmail SMTP configurado (tentando porta 465 SSL)');
            console.log('📧 Usando:', configSSL.auth.user);
            console.log('🔧 Debug habilitado com timeouts de 10s');
        } catch (error) {
            console.error('❌ Erro ao configurar Gmail:', error.message);
            
            // Tentar porta 587 como fallback
            try {
                console.log('🔧 Tentando porta 587 como fallback...');
                this.transporter = nodemailer.createTransport(configTLS);
                console.log('✅ Gmail SMTP configurado com porta 587');
            } catch (fallbackError) {
                console.error('❌ Fallback também falhou:', fallbackError.message);
            }
        }
    }
    
    async sendEmail(options) {
        console.log('📧 sendEmail chamado com opções:', {
            to: options.to,
            subject: options.subject,
            hasHtml: !!options.html,
            hasText: !!options.text
        });
        
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
            
            console.log('📤 Iniciando envio de email via Gmail...');
            console.log('   De:', mailOptions.from);
            console.log('   Para:', mailOptions.to);
            console.log('   Timestamp:', new Date().toISOString());
            
            // Adicionar timeout para sendMail
            const sendPromise = this.transporter.sendMail(mailOptions);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout ao enviar email (10s)')), 10000);
            });
            
            const info = await Promise.race([sendPromise, timeoutPromise]);
            
            console.log('✅ Email enviado com sucesso!');
            console.log('   Message ID:', info.messageId);
            console.log('   Response:', info.response);
            
            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
                provider: 'Gmail SMTP'
            };
        } catch (error) {
            console.error('❌ Erro ao enviar email:', error.message);
            console.error('   Stack:', error.stack);
            
            if (error.code === 'EAUTH') {
                console.log('💡 Possível solução:');
                console.log('   1. Verifique se a senha de app está correta');
                console.log('   2. Gere nova senha em: https://myaccount.google.com/apppasswords');
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Método compatível com SendGrid API
    async send(msg) {
        return this.sendEmail({
            to: msg.to,
            subject: msg.subject,
            text: msg.text,
            html: msg.html
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
}

module.exports = new EmailService();