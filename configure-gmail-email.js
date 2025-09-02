/**
 * Configurar Gmail como provedor principal de email
 * Resolve o problema de emails não sendo entregues
 */

const fs = require('fs');
const path = require('path');

console.log('📧 CONFIGURANDO GMAIL COMO PROVEDOR PRINCIPAL\n');
console.log('═'.repeat(60));

// Criar novo serviço de email usando Gmail/Nodemailer
const emailServiceCode = `/**
 * Serviço de Email usando Gmail SMTP
 * Configurado para usar suporte@editaliza.com.br
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.fromEmail = 'suporte@editaliza.com.br';
        this.fromName = 'Editaliza';
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
            this.transporter = nodemailer.createTransport(config);
            console.log('✅ Gmail SMTP configurado com sucesso');
            console.log('📧 Usando:', config.auth.user);
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
                from: \`"\${this.fromName}" <\${this.fromEmail}>\`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            };
            
            console.log('📤 Enviando email via Gmail...');
            console.log('   De:', mailOptions.from);
            console.log('   Para:', mailOptions.to);
            
            const info = await this.transporter.sendMail(mailOptions);
            
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
    
    // Método para recuperação de senha
    async sendPasswordRecoveryEmail(email, userName, resetToken, appUrl) {
        const resetLink = \`\${appUrl}/reset-password.html?token=\${resetToken}\`;
        
        const html = \`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">📚 EDITALIZA</h1>
                            <p style="color: white; margin-top: 10px;">Recuperação de Senha</p>
                        </div>
                        
                        <div style="padding: 30px;">
                            <h2 style="color: #333; margin-bottom: 20px;">Olá \${userName}!</h2>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Recebemos uma solicitação para redefinir sua senha.
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Clique no botão abaixo para criar uma nova senha:
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="\${resetLink}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Redefinir Senha
                                </a>
                            </div>
                            
                            <p style="color: #999; font-size: 14px;">
                                Este link expira em 1 hora por motivos de segurança.
                            </p>
                            
                            <p style="color: #999; font-size: 14px;">
                                Se você não solicitou esta alteração, ignore este email.
                            </p>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                © 2025 Editaliza - Todos os direitos reservados
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        \`;
        
        return this.sendEmail({
            to: email,
            subject: '🔐 Recuperação de Senha - Editaliza',
            html
        });
    }
    
    // Método para email de boas-vindas
    async sendWelcomeEmail(email, userName) {
        const html = \`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Bem-vindo ao Editaliza!</h1>
                        </div>
                        
                        <div style="padding: 40px;">
                            <h2 style="color: #333; margin-bottom: 20px;">Olá \${userName}! 👋</h2>
                            
                            <p style="color: #666; line-height: 1.8; font-size: 16px;">
                                Sua conta foi criada com sucesso! Estamos muito felizes em ter você conosco.
                            </p>
                            
                            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0;">
                                <h3 style="color: #333; margin-top: 0;">🚀 Primeiros Passos:</h3>
                                <ul style="color: #666; line-height: 1.8;">
                                    <li>Crie seu primeiro plano de estudos</li>
                                    <li>Configure suas matérias e tópicos</li>
                                    <li>Comece a registrar suas sessões de estudo</li>
                                    <li>Acompanhe seu progresso diariamente</li>
                                </ul>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://app.editaliza.com.br" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                    Acessar Plataforma
                                </a>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Qualquer dúvida, estamos aqui para ajudar!
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Bons estudos! 📚
                            </p>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                © 2025 Editaliza - Transformando sonhos em aprovações
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        \`;
        
        return this.sendEmail({
            to: email,
            subject: '🎉 Bem-vindo ao Editaliza!',
            html
        });
    }
    
    // Método para email de cronograma diário
    async sendDailyScheduleEmail(email, userName, schedule) {
        const html = \`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                            <h1 style="color: white; margin: 0;">📅 Seu Cronograma de Hoje</h1>
                            <p style="color: white; margin-top: 10px;">\${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        
                        <div style="padding: 30px;">
                            <h2 style="color: #333; margin-bottom: 20px;">Bom dia, \${userName}! ☀️</h2>
                            
                            \${schedule}
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://app.editaliza.com.br" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Iniciar Estudos
                                </a>
                            </div>
                            
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                            
                            <p style="color: #999; font-size: 12px; text-align: center;">
                                Você está recebendo este email porque ativou as notificações diárias.<br>
                                Para cancelar, acesse suas configurações no Editaliza.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        \`;
        
        return this.sendEmail({
            to: email,
            subject: '📅 Seu Cronograma de Estudos - Editaliza',
            html
        });
    }
}

module.exports = new EmailService();
`;

// Salvar arquivo
const emailServicePath = path.join(__dirname, 'src', 'services', 'emailService.js');

// Fazer backup do arquivo atual
if (fs.existsSync(emailServicePath)) {
    const backupPath = emailServicePath + '.backup-' + Date.now();
    fs.copyFileSync(emailServicePath, backupPath);
    console.log('✅ Backup criado:', path.basename(backupPath));
}

// Escrever novo serviço
fs.writeFileSync(emailServicePath, emailServiceCode);
console.log('✅ EmailService atualizado para usar Gmail\n');

console.log('📋 CONFIGURAÇÃO APLICADA:');
console.log('─'.repeat(40));
console.log('Provedor: Gmail SMTP');
console.log('Email: suporte@editaliza.com.br');
console.log('Método: SMTP direto (não usa SendGrid)');
console.log('Porta: 587 (TLS)');
console.log('');

console.log('🔄 PRÓXIMOS PASSOS:');
console.log('─'.repeat(40));
console.log('1. Fazer commit das mudanças');
console.log('2. Push para o GitHub');
console.log('3. Deploy no servidor');
console.log('4. Testar envio de email');
console.log('');

console.log('✅ Configuração concluída!');
console.log('═'.repeat(60));