/**
 * SendGrid Email Service - HTTP API (bypasses SMTP blocks)
 * Solução para servidores com portas SMTP bloqueadas
 */

const sgMail = require('@sendgrid/mail');

class SendGridService {
    constructor() {
        this.isConfigured = false;
        this.initialize();
    }

    /**
     * Initialize SendGrid API
     */
    initialize() {
        const apiKey = process.env.SENDGRID_API_KEY;
        
        if (apiKey && apiKey.startsWith('SG.')) {
            sgMail.setApiKey(apiKey);
            this.isConfigured = true;
            console.log('✅ SendGrid API initialized successfully');
        } else {
            console.log('⚠️ SendGrid not configured - will fallback to simulation');
            this.isConfigured = false;
        }
    }

    /**
     * Send password recovery email via SendGrid API
     */
    async sendPasswordRecoveryEmail(email, userName, resetToken, baseUrl = null) {
        try {
            const appUrl = baseUrl || process.env.APP_URL || 'https://app.editaliza.com.br';
            const resetLink = `${appUrl}/reset-password.html?token=${resetToken}`;
            const expirationTime = '1 hora';

            // If SendGrid is not configured, simulate
            if (!this.isConfigured) {
                console.log('\n🚀 RECUPERAÇÃO DE SENHA - LINK MANUAL 🚀');
                console.log('═'.repeat(80));
                console.log(`📧 DESTINATÁRIO: ${email}`);
                console.log(`👤 NOME: ${userName || 'Usuário'}`);
                console.log(`🔗 LINK DE RECUPERAÇÃO:`);
                console.log(`   ${resetLink}`);
                console.log(`⏰ EXPIRA EM: ${expirationTime}`);
                console.log('═'.repeat(80));
                console.log('✅ INSTRUÇÃO: Envie este link manualmente para o usuário');
                console.log('🔧 Para automatizar: Configure SENDGRID_API_KEY no .env');
                console.log('═'.repeat(80));
                return { success: true, simulated: true, resetLink };
            }

            // Prepare email content
            const msg = {
                to: email,
                from: {
                    email: 'contato@editaliza.com.br',
                    name: 'Editaliza'
                },
                subject: '🔐 Recuperação de Senha - Editaliza',
                text: this.generatePasswordResetText(userName, resetLink, expirationTime),
                html: this.generatePasswordResetHTML(userName, resetLink, expirationTime)
            };

            // Send via SendGrid API
            const response = await sgMail.send(msg);
            
            console.log('✅ Email de recuperação enviado com sucesso via SendGrid');
            console.log(`📧 Para: ${email}`);
            console.log(`📝 Message ID: ${response[0].headers['x-message-id']}`);

            return { 
                success: true, 
                simulated: false,
                messageId: response[0].headers['x-message-id']
            };

        } catch (error) {
            console.error('❌ Erro ao enviar email via SendGrid:', error.message);
            
            // Fallback to simulation on error
            const appUrl = baseUrl || process.env.APP_URL || 'https://app.editaliza.com.br';
            const resetLink = `${appUrl}/reset-password.html?token=${resetToken}`;
            
            console.log('\n📧 FALLBACK - LINK MANUAL DE RECUPERAÇÃO');
            console.log('═'.repeat(80));
            console.log(`📧 DESTINATÁRIO: ${email}`);
            console.log(`🔗 LINK: ${resetLink}`);
            console.log('═'.repeat(80));

            return { 
                success: true, 
                simulated: true, 
                error: error.message,
                resetLink
            };
        }
    }

    /**
     * Send welcome email via SendGrid API
     */
    async sendWelcomeEmail(email, userName) {
        try {
            if (!this.isConfigured) {
                console.log('\n🎉 EMAIL DE BOAS-VINDAS - SIMULADO');
                console.log('═'.repeat(50));
                console.log(`📧 Para: ${email}`);
                console.log(`👤 Nome: ${userName || 'Usuário'}`);
                console.log('🔧 Para envio real: Configure SENDGRID_API_KEY');
                console.log('═'.repeat(50));
                return { success: true, simulated: true };
            }

            const msg = {
                to: email,
                from: {
                    email: 'suporte@editaliza.com.br',
                    name: 'Equipe Editaliza'
                },
                subject: '🎉 Bem-vindo ao Editaliza - Sua jornada começa agora!',
                text: this.generateWelcomeText(userName, email),
                html: this.generateWelcomeHTML(userName, email)
            };

            const response = await sgMail.send(msg);
            
            console.log('✅ Email de boas-vindas enviado via SendGrid');
            console.log(`📧 Para: ${email}`);

            return { 
                success: true, 
                simulated: false,
                messageId: response[0].headers['x-message-id']
            };

        } catch (error) {
            console.error('❌ Erro ao enviar email de boas-vindas:', error.message);
            
            console.log('\n🎉 FALLBACK - BOAS-VINDAS SIMULADO');
            console.log('═'.repeat(50));
            console.log(`📧 Para: ${email}`);
            console.log('═'.repeat(50));

            return { 
                success: true, 
                simulated: true, 
                error: error.message 
            };
        }
    }

    /**
     * Test SendGrid configuration
     */
    async sendTestEmail(email) {
        if (!this.isConfigured) {
            throw new Error('SendGrid not configured');
        }

        try {
            const msg = {
                to: email,
                from: {
                    email: 'contato@editaliza.com.br',
                    name: 'Editaliza'
                },
                subject: '✅ Teste SendGrid - Editaliza',
                text: 'Este é um email de teste do sistema Editaliza usando SendGrid API.',
                html: `
                    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background-color: #0528f2; color: white; padding: 20px; text-align: center; border-radius: 8px;">
                            <h2 style="margin: 0;">✅ SendGrid Funcionando!</h2>
                        </div>
                        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; margin-top: 0;">
                            <p>Este é um email de teste do sistema Editaliza usando SendGrid API.</p>
                            <p>Se você recebeu esta mensagem, o SendGrid está configurado corretamente.</p>
                        </div>
                    </div>
                `
            };

            const response = await sgMail.send(msg);
            return { success: true, messageId: response[0].headers['x-message-id'] };

        } catch (error) {
            throw new Error(`SendGrid test failed: ${error.message}`);
        }
    }

    /**
     * Generate HTML template for password reset
     */
    generatePasswordResetHTML(userName, resetLink, expirationTime) {
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha - Editaliza</title>
    <style>
        body { font-family: Inter, sans-serif; line-height: 1.6; color: #0d0d0d; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(5, 40, 242, 0.08); }
        .header { background: #0528f2; color: white; padding: 32px 24px; text-align: center; }
        .logo { font-size: 24px; font-weight: 700; margin: 0; }
        .content { padding: 40px 32px; }
        .greeting { font-size: 24px; font-weight: 600; margin-bottom: 16px; }
        .message { font-size: 16px; color: #4b5563; margin-bottom: 32px; line-height: 1.7; }
        .cta-button { display: inline-block; background: #0528f2; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; text-align: center; }
        .cta-container { text-align: center; margin: 32px 0; }
        .warning { background: #fef3cd; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; }
        .warning p { color: #92400e; font-weight: 500; font-size: 14px; margin: 0; }
        .footer { background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { color: #969696; font-size: 13px; margin: 8px 0; }
        @media (max-width: 600px) { .content { padding: 24px 20px; } .cta-button { display: block; width: 100%; box-sizing: border-box; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">Editaliza</h1>
        </div>
        
        <div class="content">
            <h1 class="greeting">Recuperação de Senha</h1>
            
            <p class="message">
                Olá${userName ? `, ${userName}` : ''}! Recebemos uma solicitação para redefinir a senha da sua conta no Editaliza.
            </p>
            
            <p class="message">
                Para sua segurança, você pode redefinir sua senha clicando no botão abaixo:
            </p>
            
            <div class="cta-container">
                <a href="${resetLink}" class="cta-button">Redefinir Senha</a>
            </div>
            
            <div class="warning">
                <p><strong>Importante:</strong> Este link expira em ${expirationTime}.</p>
            </div>
            
            <p class="message">
                <strong>Link alternativo:</strong><br>
                <small style="word-break: break-all; color: #0528f2;">${resetLink}</small>
            </p>
        </div>
        
        <div class="footer">
            <p>Esta é uma mensagem automática do sistema Editaliza.</p>
            <p>Para dúvidas: <a href="mailto:contato@editaliza.com.br">contato@editaliza.com.br</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate text version for password reset
     */
    generatePasswordResetText(userName, resetLink, expirationTime) {
        return `
EDITALIZA - Recuperação de Senha

Olá${userName ? `, ${userName}` : ''}!

Recebemos uma solicitação para redefinir a senha da sua conta no Editaliza.

Para redefinir sua senha, acesse o link abaixo:
${resetLink}

IMPORTANTE:
- Este link expira em ${expirationTime}
- Se você não solicitou esta redefinição, ignore este e-mail
- Sua senha permanecerá inalterada se você não acessar o link

---
Esta é uma mensagem automática do sistema Editaliza.
Para suporte: contato@editaliza.com.br
        `.trim();
    }

    /**
     * Generate HTML template for welcome email
     */
    generateWelcomeHTML(userName, userEmail) {
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bem-vindo ao Editaliza</title>
    <style>
        body { font-family: Inter, sans-serif; line-height: 1.6; color: #0d0d0d; background-color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(5, 40, 242, 0.08); }
        .header { background: #0528f2; color: white; padding: 40px 32px; text-align: center; }
        .logo { font-size: 28px; font-weight: 700; margin: 0; }
        .subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 8px 0 0 0; }
        .content { padding: 40px 32px; }
        .greeting { font-size: 28px; font-weight: 600; margin-bottom: 16px; text-align: center; }
        .message { font-size: 18px; color: #4b5563; margin-bottom: 32px; text-align: center; line-height: 1.6; }
        .feature { display: flex; align-items: flex-start; padding: 16px; background: #f8fafc; border-radius: 6px; margin: 16px 0; }
        .feature-icon { background: #1ad937; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; font-size: 16px; }
        .cta-container { text-align: center; margin: 40px 0; padding: 32px 24px; background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%); border-radius: 8px; }
        .cta-button { display: inline-block; background: #0528f2; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; }
        .footer { background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { color: #969696; font-size: 13px; margin: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="logo">Editaliza</h1>
            <p class="subtitle">Sua jornada rumo à aprovação começa aqui</p>
        </div>
        
        <div class="content">
            <h1 class="greeting">Bem-vindo${userName ? `, ${userName}` : ''}!</h1>
            
            <p class="message">
                É um prazer tê-lo conosco! Você acaba de dar o primeiro passo rumo ao seu sucesso em concursos públicos.
            </p>
            
            <div class="feature">
                <div class="feature-icon">📚</div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">Cronograma Personalizado</h4>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Crie e gerencie seus estudos com horários adaptados à sua rotina</p>
                </div>
            </div>
            
            <div class="feature">
                <div class="feature-icon">📊</div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">Acompanhe seu Progresso</h4>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Monitore sua evolução com relatórios detalhados e estatísticas</p>
                </div>
            </div>
            
            <div class="feature">
                <div class="feature-icon">🎯</div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">Metas Inteligentes</h4>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Defina objetivos alcançáveis e mantenha-se motivado</p>
                </div>
            </div>
            
            <div class="cta-container">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">Pronto para começar?</h3>
                <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Acesse sua conta e configure seu primeiro cronograma</p>
                <a href="https://app.editaliza.com.br" class="cta-button">Começar a Estudar</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Você está recebendo este e-mail porque se cadastrou no Editaliza.</p>
            <p>Para suporte: <a href="mailto:suporte@editaliza.com.br">suporte@editaliza.com.br</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate text version for welcome email
     */
    generateWelcomeText(userName, userEmail) {
        return `
EDITALIZA - Bem-vindo!

Olá${userName ? `, ${userName}` : ''}!

É um prazer tê-lo conosco! Você acaba de dar o primeiro passo rumo ao seu sucesso em concursos públicos.

O QUE VOCÊ PODE FAZER NO EDITALIZA:

📚 Cronograma Personalizado
   Crie e gerencie seus estudos com horários adaptados à sua rotina

📊 Acompanhe seu Progresso  
   Monitore sua evolução com relatórios detalhados e estatísticas

🎯 Metas Inteligentes
   Defina objetivos alcançáveis e mantenha-se motivado

PRONTO PARA COMEÇAR?
Acesse: https://app.editaliza.com.br

---
Para suporte: contato@editaliza.com.br
Equipe Editaliza
        `.trim();
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            provider: 'SendGrid API',
            configured: this.isConfigured,
            ready: this.isConfigured,
            method: 'HTTP API (bypasses SMTP blocks)',
            limits: {
                daily: this.isConfigured ? '100 emails/day (free tier)' : 'unlimited (simulation)',
                perSecond: 10
            }
        };
    }
}

module.exports = new SendGridService();