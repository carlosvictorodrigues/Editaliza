/**
 * Ativar Gmail SMTP como provedor de email principal
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function activateGmailSMTP() {
    console.log('📧 ATIVANDO GMAIL SMTP COMO PROVEDOR PRINCIPAL\n');
    console.log('═'.repeat(60));
    
    // Verificar configuração atual
    console.log('📋 Configuração atual no .env:\n');
    console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Não configurado');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***configurado***' : 'Não configurado');
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'Não configurado');
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'Não configurado');
    
    // Criar novo emailService que usa Gmail
    const gmailServiceCode = `/**
 * Serviço de Email usando Gmail SMTP
 * Configurado para usar enquanto SendGrid está com problemas
 */

const { createTransport } = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }
    
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
            this.transporter = createTransport(config);
            console.log('✅ Gmail SMTP configurado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao configurar Gmail:', error.message);
        }
    }
    
    async sendEmail(options) {
        if (!this.transporter) {
            console.log('⚠️ Email simulado (SMTP não configurado)');
            console.log('Para:', options.to);
            console.log('Assunto:', options.subject);
            return { success: true, simulated: true };
        }
        
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER || 'suporte@editaliza.com.br',
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            
            return {
                success: true,
                messageId: info.messageId,
                response: info.response,
                provider: 'Gmail SMTP'
            };
        } catch (error) {
            console.error('❌ Erro ao enviar email:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async sendPasswordRecoveryEmail(email, userName, resetToken, appUrl) {
        const resetLink = \`\${appUrl}/reset-password.html?token=\${resetToken}\`;
        
        const html = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Recuperação de Senha - Editaliza</h2>
                <p>Olá \${userName},</p>
                <p>Recebemos uma solicitação para redefinir sua senha.</p>
                <p>Clique no link abaixo para criar uma nova senha:</p>
                <a href="\${resetLink}" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">
                    Redefinir Senha
                </a>
                <p>Este link expira em 1 hora.</p>
                <p>Se você não solicitou esta alteração, ignore este email.</p>
            </div>
        \`;
        
        return this.sendEmail({
            to: email,
            subject: '🔐 Recuperação de Senha - Editaliza',
            html
        });
    }
    
    async sendWelcomeEmail(email, userName) {
        const html = \`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Bem-vindo ao Editaliza!</h2>
                <p>Olá \${userName},</p>
                <p>Sua conta foi criada com sucesso!</p>
                <p>Comece agora a organizar seus estudos e alcançar a aprovação.</p>
                <a href="https://app.editaliza.com.br" style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">
                    Acessar Plataforma
                </a>
            </div>
        \`;
        
        return this.sendEmail({
            to: email,
            subject: '🎉 Bem-vindo ao Editaliza!',
            html
        });
    }
}

module.exports = new EmailService();
`;
    
    // Salvar backup do emailService atual
    const emailServicePath = path.join(__dirname, 'src', 'services', 'emailService.js');
    const backupPath = emailServicePath + '.sendgrid-backup';
    
    if (fs.existsSync(emailServicePath)) {
        fs.copyFileSync(emailServicePath, backupPath);
        console.log('\n✅ Backup criado:', backupPath);
    }
    
    // Escrever novo emailService
    fs.writeFileSync(emailServicePath, gmailServiceCode);
    console.log('✅ EmailService atualizado para usar Gmail SMTP');
    
    // Testar envio
    console.log('\n📧 TESTANDO ENVIO VIA GMAIL...\n');
    
    const emailService = require('./src/services/emailService');
    
    const result = await emailService.sendEmail({
        to: 'carlosvictorodrigues@gmail.com',
        subject: '✅ Gmail SMTP Ativado - Editaliza',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #667eea;">✅ Sistema de Email Reconfigurado</h2>
                <p>O sistema agora está usando <strong>Gmail SMTP</strong> para envio de emails.</p>
                <p>SendGrid foi temporariamente desativado devido aos problemas de processamento.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Enviado via Gmail SMTP<br>
                    ${new Date().toLocaleString('pt-BR')}
                </p>
            </div>
        `
    });
    
    if (result.success && !result.simulated) {
        console.log('✅ EMAIL ENVIADO COM SUCESSO VIA GMAIL!');
        console.log('Message ID:', result.messageId);
        console.log('Provider:', result.provider);
        console.log('\n📧 Verifique: carlosvictorodrigues@gmail.com');
    } else if (result.simulated) {
        console.log('⚠️ Email simulado - configure EMAIL_PASS no .env');
    } else {
        console.log('❌ Erro ao enviar:', result.error);
    }
    
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('─'.repeat(40));
    console.log('1. Reinicie o servidor: pm2 restart editaliza-app');
    console.log('2. Os emails agora serão enviados via Gmail');
    console.log('3. Resolva o problema do SendGrid com o suporte deles');
    
    console.log('═'.repeat(60));
}

activateGmailSMTP();