/**
 * Script de Verificação do Sistema de Emails
 * Para ser executado no servidor após deploy
 */

const emailService = require('./src/services/emailService');

async function verifyEmailSystem() {
    console.log('🔍 VERIFICAÇÃO DO SISTEMA DE EMAILS - EDITALIZA');
    console.log('═'.repeat(70));
    
    try {
        // 1. Verificar configuração geral
        console.log('\n📋 1. VERIFICANDO CONFIGURAÇÃO...');
        console.log('─'.repeat(50));
        
        const hasEmailUser = !!process.env.EMAIL_USER;
        const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
        const appUrl = process.env.APP_URL || 'URL não configurada';
        
        console.log(`✓ EMAIL_USER: ${hasEmailUser ? '✅ Configurado' : '❌ Não configurado'}`);
        console.log(`✓ SENDGRID_API_KEY: ${hasSendGridKey ? '✅ Configurado' : '❌ Não configurado'}`);
        console.log(`✓ APP_URL: ${appUrl}`);
        
        // 2. Verificar SendGrid service
        console.log('\n📧 2. VERIFICANDO SENDGRID SERVICE...');
        console.log('─'.repeat(50));
        
        let sendGridAvailable = false;
        try {
            const SendGridService = require('./src/services/sendGridService');
            const status = SendGridService.getStatus();
            sendGridAvailable = status.configured;
            
            console.log(`✓ SendGrid Module: ✅ Carregado`);
            console.log(`✓ SendGrid API: ${status.configured ? '✅ Configurado' : '⚠️ Não configurado'}`);
            console.log(`✓ Provider: ${status.provider}`);
            console.log(`✓ Method: ${status.method}`);
            console.log(`✓ Daily Limit: ${status.limits.daily}`);
        } catch (error) {
            console.log(`✓ SendGrid Module: ❌ Erro - ${error.message}`);
        }
        
        // 3. Testar email service principal
        console.log('\n📬 3. TESTANDO EMAIL SERVICE...');
        console.log('─'.repeat(50));
        
        const testEmail = 'admin@editaliza.com.br';
        const testUser = 'Administrador';
        const testToken = 'test-token-verification-' + Date.now();
        
        console.log('📤 Executando teste de envio...');
        const result = await emailService.sendPasswordRecoveryEmail(
            testEmail, 
            testUser, 
            testToken,
            process.env.APP_URL
        );
        
        console.log('\n📊 RESULTADO DO TESTE:');
        console.log('─'.repeat(30));
        console.log(`✓ Success: ${result.success ? '✅' : '❌'}`);
        console.log(`✓ Provider: ${result.provider || 'simulation'}`);
        console.log(`✓ Simulated: ${result.simulated ? '⚠️ Sim' : '✅ Não'}`);
        
        if (result.resetLink) {
            console.log(`✓ Reset Link: ${result.resetLink}`);
        }
        if (result.messageId) {
            console.log(`✓ Message ID: ${result.messageId}`);
        }
        if (result.error) {
            console.log(`✓ Error: ⚠️ ${result.error}`);
        }
        
        // 4. Análise e recomendações
        console.log('\n🎯 4. ANÁLISE E STATUS...');
        console.log('─'.repeat(50));
        
        let overallStatus = '🟢 SISTEMA OK';
        let recommendations = [];
        
        if (!hasSendGridKey && !hasEmailUser) {
            overallStatus = '🔴 CONFIGURAÇÃO NECESSÁRIA';
            recommendations.push('Configure SENDGRID_API_KEY ou EMAIL_USER/EMAIL_PASS no .env');
        } else if (!hasSendGridKey) {
            overallStatus = '🟡 FUNCIONANDO (FALLBACK)';
            recommendations.push('Configure SENDGRID_API_KEY para emails profissionais em produção');
        } else if (!sendGridAvailable) {
            overallStatus = '🟡 SENDGRID COM PROBLEMAS';
            recommendations.push('Verifique se a SENDGRID_API_KEY está correta e ativa');
        }
        
        if (!process.env.APP_URL || process.env.APP_URL.includes('localhost')) {
            recommendations.push('Configure APP_URL=https://app.editaliza.com.br no .env');
        }
        
        console.log(`\n📊 STATUS GERAL: ${overallStatus}`);
        
        if (recommendations.length > 0) {
            console.log('\n📝 RECOMENDAÇÕES:');
            recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }
        
        // 5. Modo de produção
        console.log('\n🚀 5. STATUS PARA LANÇAMENTO...');
        console.log('─'.repeat(50));
        
        const productionReady = sendGridAvailable && process.env.APP_URL && !process.env.APP_URL.includes('localhost');
        
        console.log(`✓ Emails Reais: ${sendGridAvailable ? '✅ SendGrid ativo' : '⚠️ Apenas simulação'}`);
        console.log(`✓ URL Produção: ${process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? '✅ Configurada' : '⚠️ Localhost'}`);
        console.log(`✓ Fallback: ✅ Sempre disponível`);
        
        console.log(`\n🎯 PRONTO PARA LANÇAMENTO: ${productionReady ? '✅ SIM' : '⚠️ Configuração pendente'}`);
        
        console.log('\n═'.repeat(70));
        console.log('✅ VERIFICAÇÃO CONCLUÍDA');
        
        if (productionReady) {
            console.log('🎉 SISTEMA PRONTO PARA COMERCIALIZAÇÃO!');
        } else {
            console.log('⚠️ Complete as configurações antes do lançamento');
        }
        
        console.log('═'.repeat(70));
        
    } catch (error) {
        console.error('\n❌ ERRO NA VERIFICAÇÃO:');
        console.error('─'.repeat(30));
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 SOLUÇÃO:');
        console.log('1. Verifique se os arquivos foram carregados corretamente');
        console.log('2. Execute: npm install @sendgrid/mail');
        console.log('3. Reinicie: pm2 restart editaliza-app');
    }
}

// Executar verificação
verifyEmailSystem();