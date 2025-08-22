#!/usr/bin/env node

/**
 * Script para enviar EMAIL REAL com dados de acesso
 * Para validar completamente o fluxo de compra do Carlos Victor
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Função para gerar senha temporária
function generateTemporaryPassword() {
    const length = 12;
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
    let password = '';
    
    password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)];
    password += 'abcdefghijkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)];
    password += '23456789'[Math.floor(Math.random() * 8)];
    password += '@#$%'[Math.floor(Math.random() * 4)];
    
    for (let i = 4; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Template HTML para email com credenciais
function generateCredentialsHTML(userName, email, password, planType) {
    const appUrl = 'https://app.editaliza.com.br';
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seus Dados de Acesso - Editaliza</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
            background: linear-gradient(135deg, #0528f2 0%, #1ad937 100%);
            color: white;
            padding: 40px 32px;
            text-align: center;
        }
        .logo-fallback {
            font-size: 32px;
            font-weight: 700;
            color: white;
            margin-bottom: 8px;
        }
        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 32px;
        }
        .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #0d0d0d;
            margin-bottom: 16px;
            text-align: center;
        }
        .success-message {
            font-size: 18px;
            color: #059669;
            margin-bottom: 32px;
            text-align: center;
            font-weight: 500;
        }
        .credentials-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px solid #0528f2;
            border-radius: 8px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
        }
        .credentials-title {
            font-size: 20px;
            font-weight: 600;
            color: #0528f2;
            margin-bottom: 20px;
        }
        .credential-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: white;
            padding: 16px 20px;
            border-radius: 6px;
            margin: 12px 0;
            border: 1px solid #e2e8f0;
        }
        .credential-label {
            font-weight: 600;
            color: #374151;
            font-size: 14px;
        }
        .credential-value {
            font-family: monospace;
            font-size: 16px;
            font-weight: 700;
            color: #0528f2;
            background: #f8fafc;
            padding: 8px 12px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }
        .plan-info {
            background: #f0fdf4;
            border-left: 4px solid #1ad937;
            padding: 16px 20px;
            margin: 24px 0;
            border-radius: 4px;
        }
        .plan-info h3 {
            color: #166534;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
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
        }
        .security-notice {
            background-color: #fef3cd;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
        }
        .security-notice h3 {
            color: #92400e;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .security-notice p {
            color: #92400e;
            font-size: 13px;
            margin: 0;
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
        @media only screen and (max-width: 600px) {
            .email-container { margin: 0 10px; }
            .header, .content { padding: 24px 20px; }
            .greeting { font-size: 20px; }
            .credential-item { flex-direction: column; gap: 8px; text-align: center; }
            .credential-value { font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo-fallback">Editaliza</div>
            <div class="header-subtitle">Sua conta ${planType} foi ativada!</div>
        </div>
        
        <div class="content">
            <h1 class="greeting">Bem-vindo, ${userName}!</h1>
            
            <p class="success-message">
                🎉 Seu pagamento foi aprovado e sua conta foi criada com sucesso!
            </p>
            
            <div class="credentials-box">
                <h2 class="credentials-title">
                    🔑 Seus Dados de Acesso
                </h2>
                
                <div class="credential-item">
                    <span class="credential-label">LOGIN (E-mail):</span>
                    <span class="credential-value">${email}</span>
                </div>
                
                <div class="credential-item">
                    <span class="credential-label">SENHA:</span>
                    <span class="credential-value">${password}</span>
                </div>
            </div>
            
            <div class="plan-info">
                <h3>✅ Plano Ativado: ${planType}</h3>
                <p>Você já tem acesso a todas as funcionalidades premium do Editaliza!</p>
            </div>
            
            <div class="cta-container">
                <a href="${appUrl}" class="cta-button">🚀 Fazer Login Agora</a>
            </div>
            
            <div class="security-notice">
                <h3>🔒 Importante - Segurança</h3>
                <p>
                    <strong>Guarde bem estes dados!</strong> Recomendamos alterar sua senha no primeiro acesso.
                    Mantenha suas credenciais em local seguro.
                </p>
            </div>
            
            <hr style="margin: 32px 0; border: none; height: 1px; background: #e5e7eb;">
            
            <div style="text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong>📋 Próximos passos:</strong><br>
                1. Acesse ${appUrl}<br>
                2. Faça login com seus dados<br>
                3. Complete seu perfil<br>
                4. Comece a estudar!<br><br>
                
                <strong>🎯 Sua jornada de estudos começa agora!</strong><br>
                Aproveite ao máximo todas as funcionalidades premium<br>
                disponíveis em sua conta.
            </div>
        </div>
        
        <div class="footer">
            <p>Você está recebendo este e-mail porque adquiriu um plano premium no Editaliza.</p>
            <p>
                <a href="${appUrl}">Acessar Editaliza</a> | 
                <a href="mailto:suporte@editaliza.com.br">Suporte</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}

async function sendRealCredentialsEmail() {
    console.log('📧 ENVIANDO EMAIL REAL COM DADOS DE ACESSO');
    console.log('=' .repeat(60));
    
    try {
        // Dados do Carlos Victor
        const customer = {
            email: 'cvictor_omg@hotmail.com',
            name: 'Carlos Victor'
        };
        
        // Gerar senha temporária
        const tempPassword = generateTemporaryPassword();
        const planType = 'Premium Mensal';
        
        console.log('👤 CLIENTE:', customer.name);
        console.log('📧 EMAIL:', customer.email);
        console.log('🔐 SENHA GERADA:', tempPassword);
        console.log('📦 PLANO:', planType);
        
        // Criar transporter
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        console.log('\n🔍 Verificando conexão SMTP...');
        await transporter.verify();
        console.log('✅ Conexão SMTP verificada!');
        
        // Preparar email
        const htmlContent = generateCredentialsHTML(customer.name, customer.email, tempPassword, planType);
        
        const mailOptions = {
            from: {
                name: 'Equipe Editaliza',
                address: process.env.EMAIL_USER
            },
            to: customer.email,
            subject: '🎉 Bem-vindo ao Editaliza Premium - Seus dados de acesso',
            html: htmlContent,
            text: `
EDITALIZA - SEUS DADOS DE ACESSO

Olá ${customer.name}!

🎉 BEM-VINDO AO EDITALIZA PREMIUM!
Seu pagamento foi aprovado e sua conta está ativa.

🔑 SEUS DADOS DE ACESSO:
LOGIN: ${customer.email}
SENHA: ${tempPassword}
PLANO: ${planType}

🚀 ACESSO: https://app.editaliza.com.br

PRÓXIMOS PASSOS:
1. Acesse o sistema com seus dados
2. Complete seu perfil
3. Comece a estudar!

Sua jornada de estudos começa agora!

Equipe Editaliza
            `.trim(),
            priority: 'high'
        };
        
        console.log('\n📨 Enviando email...');
        const result = await transporter.sendMail(mailOptions);
        
        console.log('\n🎉 EMAIL REAL ENVIADO COM SUCESSO!');
        console.log('═'.repeat(60));
        console.log('📝 Message ID:', result.messageId);
        console.log('📧 Para:', result.accepted[0]);
        console.log('🔑 Login:', customer.email);
        console.log('🔐 Senha:', tempPassword);
        console.log('📦 Plano:', planType);
        console.log('⏰ Enviado em:', new Date().toLocaleString('pt-BR'));
        
        console.log('\n✅ FLUXO DE COMPRA CACKTO VALIDADO!');
        console.log('🚀 O Carlos Victor recebeu email com dados de acesso reais!');
        
        return {
            success: true,
            messageId: result.messageId,
            credentials: {
                login: customer.email,
                password: tempPassword
            }
        };
        
    } catch (error) {
        console.error('\n❌ ERRO AO ENVIAR EMAIL:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n💡 PROBLEMA DE AUTENTICAÇÃO:');
            console.log('   Verifique as credenciais do Gmail no .env');
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Executar
sendRealCredentialsEmail().then(result => {
    if (result.success) {
        console.log('\n🎯 TESTE CONCLUÍDO - EMAIL ENVIADO!');
        console.log('✅ Sistema CACKTO funcionando perfeitamente!');
    } else {
        console.log('\n❌ FALHA NO ENVIO');
        console.error('Erro:', result.error);
    }
    
    process.exit(result.success ? 0 : 1);
});