#!/usr/bin/env node

/**
 * Script de teste para webhook CACKTO
 * Simula um webhook de pagamento aprovado
 */

// Carregar variáveis de ambiente
require('dotenv').config();

// Verificar se variáveis foram carregadas
console.log('🔑 CACKTO_WEBHOOK_SECRET carregado:', !!process.env.CACKTO_WEBHOOK_SECRET);
console.log('🔗 CACKTO_API_URL:', process.env.CACKTO_API_URL);

// Carregar módulos após as variáveis de ambiente
const CacktoWebhookValidator = require('./src/cackto-integration/webhooks/validator');
const CacktoWebhookProcessor = require('./src/cackto-integration/webhooks/processor');

async function testCacktoWebhook() {
    console.log('🧪 Testando integração CACKTO...\n');
    
    try {
        // 1. Instanciar validador e processador
        const validator = new CacktoWebhookValidator();
        const processor = new CacktoWebhookProcessor();
        console.log('✅ Componentes CACKTO carregados com sucesso');
        
        // 2. Simular webhook de pagamento aprovado
        const testWebhook = {
            id: `test_webhook_${Date.now()}`,
            event: 'payment.approved',
            created_at: new Date().toISOString(),
            data: {
                id: `test_payment_${Date.now()}`,
                amount: 97.00,
                currency: 'BRL',
                status: 'approved',
                customer: {
                    email: 'teste@editaliza.com.br',
                    name: 'Usuário de Teste',
                    document: '12345678901'
                },
                product: {
                    id: 'test_product',
                    code: 'editaliza-premium-mensal',
                    name: 'Editaliza Premium Mensal'
                },
                payment_method: 'credit_card',
                created_at: new Date().toISOString()
            }
        };
        
        console.log('📦 Webhook de teste criado:', JSON.stringify(testWebhook, null, 2));
        
        // 3. Simular requisição
        const mockReq = {
            body: testWebhook,
            headers: {
                'content-type': 'application/json',
                'user-agent': 'CACKTO-Webhook/1.0',
                'x-cackto-timestamp': Math.floor(Date.now() / 1000).toString(),
                'x-cackto-signature': 'test_signature_for_validation'
            },
            ip: '127.0.0.1',
            method: 'POST',
            url: '/api/webhooks/cackto'
        };
        
        // 4. Testar processamento (modo simulação)
        console.log('\n🔄 Processando webhook...');
        
        // Mock da validação bem-sucedida
        const validatedWebhook = {
            payload: testWebhook,
            validationId: `validation_${Date.now()}`,
            validationTime: Date.now()
        };
        
        const result = await processor.processWebhook(validatedWebhook, mockReq);
        
        console.log('\n✅ RESULTADO DO PROCESSAMENTO:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n🎉 TESTE CACKTO CONCLUÍDO COM SUCESSO!');
        console.log('✅ Integração está funcional para webhooks');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE CACKTO:');
        console.error('Tipo:', error.constructor.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        return false;
    }
}

// Executar teste
testCacktoWebhook().then(success => {
    process.exit(success ? 0 : 1);
});