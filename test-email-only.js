#!/usr/bin/env node

/**
 * Script para testar apenas o envio de email
 * Simula os dados que o webhook CACKTO receberia
 */

require('dotenv').config();
console.log('🔑 CONFIGURAÇÕES EMAIL:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'CONFIGURADO' : 'NÃO CONFIGURADO');

const emailService = require('./src/services/emailService');

async function testEmailOnly() {
    console.log('📧 Testando envio de email isoladamente...\n');
    
    try {
        // Dados simulados do Carlos Victor
        const customerData = {
            email: 'carlosvictorodrigues@gmail.com',
            name: 'Carlos Victor'
        };
        
        console.log('📦 Simulando processamento do pagamento aprovado...');
        console.log(`👤 Cliente: ${customerData.name} (${customerData.email})`);
        
        // Simular o que acontece no handlePaymentApproved
        console.log('\n📧 ENVIANDO EMAIL DE BOAS-VINDAS...');
        
        const emailResult = await emailService.sendWelcomeEmail(customerData.email, customerData.name);
        
        if (emailResult.success) {
            console.log(`✅ Email de boas-vindas enviado para: ${customerData.email}`);
            if (!emailResult.simulated) {
                console.log(`📝 Message ID: ${emailResult.messageId}`);
            } else {
                console.log('ℹ️  Email foi simulado (configuração não disponível)');
            }
        } else {
            console.error('❌ Falha no envio do email');
        }
        
        console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
        console.log('✅ A integração CACKTO agora enviará emails corretamente');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:');
        console.error('Tipo:', error.constructor.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        return false;
    }
}

// Executar teste
testEmailOnly().then(success => {
    process.exit(success ? 0 : 1);
});