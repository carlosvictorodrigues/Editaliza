/**
 * Script para enviar email de teste
 */

const emailService = require('./src/services/emailService');

async function sendTestEmail() {
    console.log('📧 Enviando email de teste para carlosvictorodrigues@gmail.com...\n');
    
    try {
        // Teste 1: Email de recuperação de senha
        console.log('1️⃣ Testando email de recuperação de senha...');
        const result1 = await emailService.sendPasswordRecoveryEmail(
            'carlosvictorodrigues@gmail.com',
            'Carlos Victor',
            'test-token-' + Date.now(),
            'https://app.editaliza.com.br'
        );
        
        console.log('Resultado:', result1);
        console.log('─'.repeat(50));
        
        // Teste 2: Email de boas-vindas
        console.log('\n2️⃣ Testando email de boas-vindas...');
        const result2 = await emailService.sendWelcomeEmail(
            'carlosvictorodrigues@gmail.com',
            'Carlos Victor'
        );
        
        console.log('Resultado:', result2);
        console.log('─'.repeat(50));
        
        // Resumo
        console.log('\n📊 RESUMO DOS TESTES:');
        console.log('─'.repeat(30));
        
        if (result1.success && !result1.simulated) {
            console.log('✅ Email de recuperação: ENVIADO via', result1.provider);
        } else if (result1.simulated) {
            console.log('⚠️ Email de recuperação: SIMULADO (configure SendGrid)');
        } else {
            console.log('❌ Email de recuperação: FALHOU');
        }
        
        if (result2.success && !result2.simulated) {
            console.log('✅ Email de boas-vindas: ENVIADO via', result2.provider);
        } else if (result2.simulated) {
            console.log('⚠️ Email de boas-vindas: SIMULADO (configure SendGrid)');
        } else {
            console.log('❌ Email de boas-vindas: FALHOU');
        }
        
        if ((result1.success && !result1.simulated) || (result2.success && !result2.simulated)) {
            console.log('\n🎉 Sucesso! Verifique sua caixa de entrada (incluindo spam)');
        } else {
            console.log('\n⚠️ Emails em modo simulação. Para envio real, configure SENDGRID_API_KEY');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Executar
sendTestEmail();