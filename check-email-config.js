#!/usr/bin/env node

require('dotenv').config();
const emailService = require('./src/services/emailService');

async function checkEmailConfig() {
    console.log('🔍 VERIFICANDO CONFIGURAÇÃO DE EMAIL\n');
    
    // Mostrar variáveis de ambiente
    console.log('📋 VARIÁVEIS DE AMBIENTE:');
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'NÃO DEFINIDO');
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'NÃO DEFINIDO');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}****` : 'NÃO DEFINIDO');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0, 4)}****` : 'NÃO DEFINIDO');
    
    // Verificar status do serviço
    console.log('\n📧 STATUS DO EMAIL SERVICE:');
    const status = emailService.getStatus();
    console.log('Configurado:', status.configured);
    console.log('Pronto:', status.ready);
    console.log('Provider:', status.provider);
    console.log('Host:', status.host);
    console.log('Port:', status.port);
    console.log('User:', status.user);
    
    // Testar conexão
    console.log('\n🔗 TESTANDO CONEXÃO:');
    try {
        const canConnect = await emailService.verifyConnection();
        console.log('Conexão OK:', canConnect);
        
        if (canConnect) {
            console.log('\n✅ EMAIL CONFIGURADO E FUNCIONANDO!');
            console.log('O próximo webhook CACKTO enviará emails reais.');
        } else {
            console.log('\n⚠️  EMAIL CONFIGURADO MAS COM PROBLEMA DE CONEXÃO');
            console.log('Verifique as credenciais no .env');
        }
    } catch (error) {
        console.log('❌ Erro na conexão:', error.message);
    }
}

checkEmailConfig();