const { createTransport } = require('nodemailer');
const path = require('path');
const EmailProviders = require('./emailProviders');
const { logger } = require('../utils/logger');

class EmailService {
    constructor() {
        this.provider = new EmailProviders();
        this.transporter = null;
        this.isConfigured = false;
        this.initializeTransporter();
    }

    /**
     * Initialize nodemailer transporter with Gmail SMTP
     */
    async initializeTransporter() {
        try {
            this.transporter = await this.provider.initializeTransporter();
            this.isConfigured = !!this.transporter;
            
            if (this.isConfigured) {
                const status = await this.provider.getStatus();
                logger.info('Email service initialized', {
                    provider: status.provider,
                    limits: status.limits
                });
            } else {
                logger.warn('Email service not configured - emails will be simulated');
            }
        } catch (error) {
            logger.error('Failed to initialize email service', null, {
                error: error.message,
                provider: process.env.EMAIL_PROVIDER || 'gmail'
            });
            this.isConfigured = false;
        }
    }

    /**
     * Verify email transporter connection
     */
    async verifyConnection() {
        if (!this.isConfigured || !this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error('Email connection verification failed:', error.message);
            return false;
        }
    }

    /**
     * Generate HTML email template for password recovery
     */
    generatePasswordResetHTML(userName, resetLink, expirationTime = '1 hora') {
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperação de Senha - Editaliza</title>
    <style>
        /* Reset styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #0d0d0d;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(5, 40, 242, 0.08);
            border: 1px solid #e5e7eb;
        }
        
        .header {
            background-color: #ffffff;
            padding: 32px 24px;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .logo-container {
            display: inline-block;
            text-align: center;
            text-decoration: none;
        }
        
        .logo {
            display: inline-block;
            max-width: 200px;
            width: 100%;
            height: auto;
            vertical-align: middle;
            border: 0;
            outline: none;
        }
        
        .logo-fallback {
            font-size: 28px;
            font-weight: 700;
            color: #0528f2;
            text-decoration: none;
            letter-spacing: -0.5px;
            display: inline-block;
            padding: 8px 0;
            margin: 0;
        }
        
        .content {
            padding: 40px 32px;
        }
        
        .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 16px;
        }
        
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            line-height: 1.7;
        }
        
        .cta-container {
            text-align: center;
            margin: 32px 0;
        }
        
        .cta-button {
            display: inline-block;
            background-color: #0528f2;
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            transition: background-color 0.2s ease;
        }
        
        .cta-button:hover {
            background-color: #0420d1;
        }
        
        .expiration-notice {
            background-color: #fef3cd;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 4px;
        }
        
        .expiration-notice p {
            color: #92400e;
            font-weight: 500;
            font-size: 14px;
            margin: 0;
        }
        
        .security-notice {
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 20px;
            margin: 32px 0;
        }
        
        .security-notice h3 {
            color: #374151;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .security-notice p {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
        }
        
        .link-fallback {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
        }
        
        .link-fallback p {
            font-size: 14px;
            color: #475569;
            margin-bottom: 8px;
        }
        
        .link-fallback .link {
            word-break: break-all;
            color: #0528f2;
            font-size: 13px;
            font-family: monospace;
        }
        
        .footer {
            background-color: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
            color: #969696;
            font-size: 13px;
            margin-bottom: 8px;
        }
        
        .footer a {
            color: #0528f2;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .divider {
            height: 1px;
            background-color: #e5e7eb;
            margin: 32px 0;
        }
        
        /* Mobile responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px 0;
            }
            
            .email-container {
                margin: 0 10px;
                border-radius: 6px;
            }
            
            .header {
                padding: 24px 20px;
            }
            
            .content {
                padding: 32px 24px;
            }
            
            .footer {
                padding: 20px 24px;
            }
            
            .greeting {
                font-size: 20px;
            }
            
            .cta-button {
                display: block;
                width: 100%;
                box-sizing: border-box;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <a href="https://www.editaliza.com.br" class="logo-container">
                <!--[if mso]>
                <div class="logo-fallback">Editaliza</div>
                <![endif]-->
                <!--[if !mso]><!-->
                <img src="cid:logo" alt="Editaliza" class="logo" style="display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="logo-fallback" style="display: none;">Editaliza</div>
                <!--<![endif]-->
            </a>
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
            
            <div class="expiration-notice">
                <p><strong>Importante:</strong> Este link expira em ${expirationTime}.</p>
            </div>
            
            <div class="security-notice">
                <h3>Aviso de Segurança</h3>
                <p>
                    Se você não solicitou esta redefinição de senha, pode ignorar este e-mail com segurança. 
                    Sua senha atual permanecerá ativa. Recomendamos verificar a segurança da sua conta fazendo login no sistema.
                </p>
            </div>
            
            <div class="divider"></div>
            
            <div class="link-fallback">
                <p><strong>Problemas com o botão?</strong> Copie e cole o link abaixo no seu navegador:</p>
                <div class="link">${resetLink}</div>
            </div>
        </div>
        
        <div class="footer">
            <p>Esta é uma mensagem automática do sistema Editaliza.</p>
            <p>Para dúvidas, entre em contato com nosso suporte.</p>
            <p>
                <a href="https://www.editaliza.com.br">Acessar Editaliza</a> | 
                <a href="mailto:suporte@editaliza.com">Suporte</a>
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate plain text version for email clients that don't support HTML
     */
    generatePasswordResetText(userName, resetLink, expirationTime = '1 hora') {
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

AVISO DE SEGURANÇA:
Por medida de segurança, recomendamos que você faça login na sua conta 
e verifique suas configurações após redefinir a senha.

---
Esta é uma mensagem automática do sistema Editaliza.
Para suporte: suporte@editaliza.com
Acessar sistema: https://www.editaliza.com.br

Equipe Editaliza
        `.trim();
    }

    /**
     * Send password recovery email
     */
    async sendPasswordRecoveryEmail(email, userName, resetToken, baseUrl = null) {
        try {
            // Use configured APP_URL or default to localhost
            const appUrl = baseUrl || process.env.APP_URL || 'http://localhost:3000';
            const resetLink = `${appUrl}/reset-password.html?token=${resetToken}`;
            const expirationTime = '1 hora';

            // If email service is not configured, simulate sending
            if (!this.isConfigured || !this.transporter) {
                console.log('\n📧 SIMULAÇÃO DE E-MAIL - RECUPERAÇÃO DE SENHA');
                console.log('═'.repeat(50));
                console.log(`Para: ${email}`);
                console.log(`Nome: ${userName || 'Usuário'}`);
                console.log(`Link de recuperação: ${resetLink}`);
                console.log(`Expira em: ${expirationTime}`);
                console.log('═'.repeat(50));
                console.log('ℹ️  Para enviar e-mails reais, configure as variáveis EMAIL_USER e EMAIL_PASS no .env');
                return { success: true, simulated: true };
            }

            // Verify connection before sending
            const isConnected = await this.verifyConnection();
            if (!isConnected) {
                throw new Error('Failed to verify email connection');
            }

            const htmlContent = this.generatePasswordResetHTML(userName, resetLink, expirationTime);
            const textContent = this.generatePasswordResetText(userName, resetLink, expirationTime);

            // Update HTML to use CID for logo
            const htmlWithCid = htmlContent.replace('${logoUrl}', 'cid:logo');
            
            const mailOptions = {
                from: {
                    name: 'Editaliza',
                    address: process.env.EMAIL_USER
                },
                to: email,
                subject: '🔐 Recuperação de Senha - Editaliza',
                text: textContent,
                html: htmlWithCid,
                priority: 'high',
                headers: {
                    'X-Mailer': 'Editaliza Password Recovery System',
                    'X-Priority': '1'
                },
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../public/logotipo.png'),
                    cid: 'logo' // Same CID as referenced in HTML
                }]
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ Email de recuperação enviado com sucesso');
            console.log(`📧 Para: ${email}`);
            console.log(`📝 Message ID: ${result.messageId}`);

            return { 
                success: true, 
                simulated: false,
                messageId: result.messageId 
            };

        } catch (error) {
            console.error('❌ Erro ao enviar email de recuperação:', error.message);
            
            // Log detailed error for debugging but don't expose to client
            if (process.env.NODE_ENV === 'development') {
                console.error('Email error details:', error);
            }

            // Fallback to simulation if email fails
            const resetLink = `${appUrl}/reset-password.html?token=${resetToken}`;
            console.log('\n📧 FALLBACK - SIMULAÇÃO DE E-MAIL');
            console.log('═'.repeat(50));
            console.log(`Para: ${email}`);
            console.log(`Link de recuperação: ${resetLink}`);
            console.log('═'.repeat(50));

            return { 
                success: true, 
                simulated: true, 
                error: error.message 
            };
        }
    }

    /**
     * Generate HTML email template for welcome email
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
        /* Reset styles */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #0d0d0d;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px 0;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 12px rgba(5, 40, 242, 0.08);
            border: 1px solid #e5e7eb;
        }
        
        .header {
            background-color: #ffffff;
            padding: 40px 32px;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .logo-container {
            display: inline-block;
            text-align: center;
            margin-bottom: 8px;
            text-decoration: none;
        }
        
        .logo {
            display: inline-block;
            max-width: 180px;
            width: 100%;
            height: auto;
            vertical-align: middle;
            border: 0;
            outline: none;
        }
        
        .logo-fallback {
            font-size: 32px;
            font-weight: 700;
            color: #0528f2;
            text-decoration: none;
            letter-spacing: -0.5px;
            display: inline-block;
            padding: 8px 0;
            margin: 0;
        }
        
        .header-subtitle {
            color: #6b7280;
            font-size: 16px;
            margin-top: 8px;
        }
        
        .content {
            padding: 40px 32px;
        }
        
        .greeting {
            font-size: 28px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 16px;
            text-align: center;
        }
        
        .welcome-message {
            font-size: 18px;
            color: #4b5563;
            margin-bottom: 32px;
            text-align: center;
            line-height: 1.6;
        }
        
        .features-section {
            margin: 32px 0;
        }
        
        .features-title {
            font-size: 20px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .features-grid {
            display: grid;
            gap: 16px;
            margin-bottom: 32px;
        }
        
        .feature-item {
            display: flex;
            align-items: flex-start;
            padding: 16px;
            background-color: #f8fafc;
            border-radius: 6px;
            border-left: 4px solid #1ad937;
        }
        
        .feature-icon {
            background-color: #1ad937;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
            flex-shrink: 0;
            font-weight: 600;
            font-size: 14px;
        }
        
        .feature-content h4 {
            font-size: 16px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 4px;
        }
        
        .feature-content p {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.5;
        }
        
        .cta-container {
            text-align: center;
            margin: 40px 0;
            padding: 32px 24px;
            background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        
        .cta-title {
            font-size: 18px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 12px;
        }
        
        .cta-subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 24px;
        }
        
        .cta-button {
            display: inline-block;
            background-color: #0528f2;
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.2s ease;
        }
        
        .cta-button:hover {
            background-color: #0420d1;
        }
        
        .tips-section {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            margin: 32px 0;
        }
        
        .tips-title {
            font-size: 16px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
        }
        
        .tips-list {
            list-style: none;
            padding: 0;
        }
        
        .tips-list li {
            font-size: 14px;
            color: #4b5563;
            margin-bottom: 8px;
            padding-left: 20px;
            position: relative;
        }
        
        .tips-list li:before {
            content: '✓';
            color: #1ad937;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .footer {
            background-color: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer p {
            color: #969696;
            font-size: 13px;
            margin-bottom: 8px;
        }
        
        .footer a {
            color: #0528f2;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .divider {
            height: 1px;
            background-color: #e5e7eb;
            margin: 32px 0;
        }
        
        /* Mobile responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px 0;
            }
            
            .email-container {
                margin: 0 10px;
                border-radius: 6px;
            }
            
            .header {
                padding: 32px 24px;
            }
            
            .logo {
                max-width: 160px;
            }
            
            .logo-fallback {
                font-size: 28px;
            }
            
            .content {
                padding: 32px 24px;
            }
            
            .footer {
                padding: 20px 24px;
            }
            
            .greeting {
                font-size: 24px;
            }
            
            .welcome-message {
                font-size: 16px;
            }
            
            .cta-container {
                padding: 24px 16px;
            }
            
            .cta-button {
                display: block;
                width: 100%;
                box-sizing: border-box;
            }
            
            .feature-item {
                flex-direction: column;
                text-align: center;
            }
            
            .feature-icon {
                margin: 0 auto 12px auto;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <a href="https://www.editaliza.com.br" class="logo-container">
                <!--[if mso]>
                <div class="logo-fallback">Editaliza</div>
                <![endif]-->
                <!--[if !mso]><!-->
                <img src="cid:logo" alt="Editaliza" class="logo" style="display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="logo-fallback" style="display: none;">Editaliza</div>
                <!--<![endif]-->
            </a>
            <div class="header-subtitle">Sua jornada rumo à aprovação começa aqui</div>
        </div>
        
        <div class="content">
            <h1 class="greeting">Bem-vindo${userName ? `, ${userName}` : ''}!</h1>
            
            <p class="welcome-message">
                É um prazer tê-lo conosco! Você acaba de dar o primeiro passo rumo ao seu sucesso em concursos públicos.
            </p>
            
            <div class="features-section">
                <h2 class="features-title">O que você pode fazer no Editaliza:</h2>
                
                <div class="features-grid">
                    <div class="feature-item">
                        <div class="feature-icon">📚</div>
                        <div class="feature-content">
                            <h4>Cronograma Personalizado</h4>
                            <p>Crie e gerencie seus estudos com horários adaptados à sua rotina</p>
                        </div>
                    </div>
                    
                    <div class="feature-item">
                        <div class="feature-icon">📊</div>
                        <div class="feature-content">
                            <h4>Acompanhe seu Progresso</h4>
                            <p>Monitore sua evolução com relatórios detalhados e estatísticas</p>
                        </div>
                    </div>
                    
                    <div class="feature-item">
                        <div class="feature-icon">🎯</div>
                        <div class="feature-content">
                            <h4>Metas Inteligentes</h4>
                            <p>Defina objetivos alcançáveis e mantenha-se motivado</p>
                        </div>
                    </div>
                    
                    <div class="feature-item">
                        <div class="feature-icon">⏰</div>
                        <div class="feature-content">
                            <h4>Lembretes Automáticos</h4>
                            <p>Nunca perca uma sessão de estudos com nossas notificações</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="cta-container">
                <h3 class="cta-title">Pronto para começar?</h3>
                <p class="cta-subtitle">Acesse sua conta e configure seu primeiro cronograma de estudos</p>
                <a href="https://www.editaliza.com.br" class="cta-button">Começar a Estudar</a>
            </div>
            
            <div class="tips-section">
                <h3 class="tips-title">💡 Dicas para começar bem:</h3>
                <ul class="tips-list">
                    <li>Complete seu perfil para receber recomendações personalizadas</li>
                    <li>Configure suas matérias e defina o tempo disponível para estudos</li>
                    <li>Ative as notificações para não perder nenhuma sessão</li>
                    <li>Use a funcionalidade de cronômetro para manter o foco</li>
                    <li>Acompanhe seu progresso diariamente para manter a motivação</li>
                </ul>
            </div>
            
            <div class="divider"></div>
            
            <p style="text-align: center; color: #6b7280; font-size: 14px;">
                <strong>Precisa de ajuda?</strong> Nossa equipe de suporte está sempre disponível para auxiliá-lo.
            </p>
        </div>
        
        <div class="footer">
            <p>Você está recebendo este e-mail porque se cadastrou no Editaliza.</p>
            <p>Para suporte técnico ou dúvidas, entre em contato conosco.</p>
            <p>
                <a href="https://www.editaliza.com.br">Acessar Editaliza</a> | 
                <a href="mailto:suporte@editaliza.com">Suporte</a> |
                <a href="https://www.editaliza.com.br/profile.html">Configurações</a>
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate plain text version for welcome email
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

⏰ Lembretes Automáticos
   Nunca perca uma sessão de estudos com nossas notificações

PRONTO PARA COMEÇAR?
Acesse sua conta e configure seu primeiro cronograma de estudos:
https://www.editaliza.com.br

DICAS PARA COMEÇAR BEM:
✓ Complete seu perfil para receber recomendações personalizadas
✓ Configure suas matérias e defina o tempo disponível para estudos
✓ Ative as notificações para não perder nenhuma sessão
✓ Use a funcionalidade de cronômetro para manter o foco
✓ Acompanhe seu progresso diariamente para manter a motivação

PRECISA DE AJUDA?
Nossa equipe de suporte está sempre disponível para auxiliá-lo.

---
Você está recebendo este e-mail porque se cadastrou no Editaliza.
Para suporte: suporte@editaliza.com
Acessar sistema: https://www.editaliza.com.br

Equipe Editaliza
        `.trim();
    }

    /**
     * Send welcome email for new registrations
     */
    async sendWelcomeEmail(email, userName) {
        try {
            // If email service is not configured, simulate sending
            if (!this.isConfigured || !this.transporter) {
                console.log('\n📧 SIMULAÇÃO DE E-MAIL - BEM-VINDO');
                console.log('═'.repeat(50));
                console.log(`Para: ${email}`);
                console.log(`Nome: ${userName || 'Usuário'}`);
                console.log('Tipo: E-mail de boas-vindas');
                console.log('═'.repeat(50));
                console.log('ℹ️  Para enviar e-mails reais, configure as variáveis EMAIL_USER e EMAIL_PASS no .env');
                return { success: true, simulated: true };
            }

            // Verify connection before sending
            const isConnected = await this.verifyConnection();
            if (!isConnected) {
                throw new Error('Failed to verify email connection');
            }

            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const htmlContent = this.generateWelcomeHTML(userName, email);
            const textContent = this.generateWelcomeText(userName, email);
            
            // Update HTML to use CID for logo
            const htmlWithCid = htmlContent.replace('${logoUrl}', 'cid:logo');

            const mailOptions = {
                from: {
                    name: 'Equipe Editaliza',
                    address: process.env.EMAIL_USER
                },
                to: email,
                subject: '🎉 Bem-vindo ao Editaliza - Sua jornada começa agora!',
                text: textContent,
                html: htmlWithCid,
                priority: 'normal',
                headers: {
                    'X-Mailer': 'Editaliza Welcome System',
                    'List-Unsubscribe': '<mailto:unsubscribe@editaliza.com>'
                },
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../public/logotipo.png'),
                    cid: 'logo' // Same CID as referenced in HTML
                }]
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log('✅ Email de boas-vindas enviado com sucesso');
            console.log(`📧 Para: ${email}`);
            console.log(`📝 Message ID: ${result.messageId}`);

            return { 
                success: true, 
                simulated: false,
                messageId: result.messageId 
            };

        } catch (error) {
            console.error('❌ Erro ao enviar email de boas-vindas:', error.message);
            
            // Log detailed error for debugging but don't expose to client
            if (process.env.NODE_ENV === 'development') {
                console.error('Welcome email error details:', error);
            }

            // Fallback to simulation if email fails
            console.log('\n📧 FALLBACK - SIMULAÇÃO DE E-MAIL');
            console.log('═'.repeat(50));
            console.log(`Para: ${email}`);
            console.log('Tipo: E-mail de boas-vindas');
            console.log('═'.repeat(50));

            return { 
                success: true, 
                simulated: true, 
                error: error.message 
            };
        }
    }

    /**
     * Send test email to verify configuration
     */
    async sendTestEmail(email) {
        if (!this.isConfigured || !this.transporter) {
            throw new Error('Email service not configured');
        }

        try {
            const testMailOptions = {
                from: {
                    name: 'Editaliza',
                    address: process.env.EMAIL_USER
                },
                to: email,
                subject: '✅ Teste de Configuração - Editaliza',
                text: 'Este é um e-mail de teste para verificar se a configuração está funcionando corretamente.',
                html: `
                    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background-color: #0528f2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h2 style="margin: 0; font-size: 24px;">✅ Configuração Funcionando!</h2>
                        </div>
                        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="color: #4b5563; line-height: 1.6;">Este é um e-mail de teste do sistema Editaliza.</p>
                            <p style="color: #4b5563; line-height: 1.6;">Se você recebeu esta mensagem, a configuração de e-mail está funcionando corretamente.</p>
                            <hr style="border: none; height: 1px; background-color: #e5e7eb; margin: 20px 0;">
                            <p style="color: #969696; font-size: 13px; text-align: center;">Sistema Editaliza - E-mail de Teste</p>
                        </div>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(testMailOptions);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            throw new Error(`Test email failed: ${error.message}`);
        }
    }

    /**
     * Get email service status
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            ready: this.isConfigured && this.transporter !== null,
            provider: 'Gmail SMTP',
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            user: process.env.EMAIL_USER || 'Not configured'
        };
    }
}

// Create a singleton instance
const emailService = new EmailService();

module.exports = emailService;