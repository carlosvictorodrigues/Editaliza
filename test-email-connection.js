// Script para testar conexão com Gmail SMTP
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailConnection() {
    console.log('🔍 Testando conexão com servidor de email...\n');
    
    // Configurações atuais
    const config = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    };
    
    console.log('📧 Configuração:');
    console.log(`  Host: ${config.host}`);
    console.log(`  Porta: ${config.port}`);
    console.log(`  Usuário: ${config.auth.user}`);
    console.log(`  Senha: ${config.auth.pass ? '****' + config.auth.pass.slice(-4) : 'NÃO CONFIGURADA'}`);
    console.log();
    
    if (!config.auth.user || !config.auth.pass) {
        console.error('❌ EMAIL_USER ou EMAIL_PASS não configurados no .env');
        return;
    }
    
    try {
        // Criar transporter
        console.log('🔄 Criando transporter...');
        const transporter = nodemailer.createTransport(config);
        
        // Verificar conexão
        console.log('🔄 Verificando conexão...');
        await transporter.verify();
        
        console.log('✅ Conexão com servidor de email estabelecida com sucesso!');
        
        // Tentar enviar email de teste
        console.log('\n📨 Enviando email de teste...');
        const info = await transporter.sendMail({
            from: `"Editaliza Test" <${config.auth.user}>`,
            to: config.auth.user, // enviar para si mesmo
            subject: 'Teste de Conexão SMTP ✅',
            text: 'Este é um email de teste do sistema Editaliza.',
            html: '<b>Este é um email de teste do sistema Editaliza.</b>'
        });
        
        console.log('✅ Email enviado com sucesso!');
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response);
        
    } catch (error) {
        console.error('❌ Erro ao conectar/enviar email:');
        console.error('   Tipo:', error.code || error.name);
        console.error('   Mensagem:', error.message);
        
        if (error.code === 'ECONNECTION') {
            console.log('\n💡 Possíveis soluções:');
            console.log('   1. Verifique se a porta 587 está liberada no firewall');
            console.log('   2. Verifique se o servidor tem acesso à internet');
            console.log('   3. Tente usar a porta 465 com secure: true');
        } else if (error.code === 'EAUTH') {
            console.log('\n💡 Possíveis soluções:');
            console.log('   1. Gere uma nova senha de app no Google');
            console.log('   2. Verifique se a verificação em 2 etapas está ativa');
            console.log('   3. Acesse: https://myaccount.google.com/apppasswords');
        } else if (error.message.includes('timeout')) {
            console.log('\n💡 Possíveis soluções:');
            console.log('   1. Problema de conectividade de rede');
            console.log('   2. Firewall bloqueando a conexão');
            console.log('   3. Tente aumentar o timeout na configuração');
        }
    }
}

testEmailConnection();