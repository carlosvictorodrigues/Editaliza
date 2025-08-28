/**
 * TESTE COM AUTENTICAÇÃO COMPLETA
 * Para fazer requisições HTTP autenticadas e ver os logs do servidor
 */

const axios = require('axios');

const client = axios.create({
    baseURL: 'http://localhost:3000',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
});

async function testWithAuth() {
    try {
        console.log('🧪 TESTE COM AUTENTICAÇÃO COMPLETA\n');
        
        // 1. Criar usuário
        console.log('1. Criando usuário...');
        const userEmail = `test_auth_${Date.now()}@editaliza.com`;
        
        const registerResponse = await client.post('/api/auth/register', {
            email: userEmail,
            password: 'Test@123456',
            name: 'Teste Auth',
            phone: '11999999999'
        });
        
        const token = registerResponse.data.token;
        const userId = registerResponse.data.user.id;
        
        console.log('✅ Usuário criado:', userId);
        console.log('🔑 Token obtido:', token.substring(0, 50) + '...');
        
        // 2. Fazer requisição autenticada para criar plano
        console.log('\n2. Criando plano com token válido...');
        
        const planData = {
            plan_name: 'Teste Auth Completo',
            exam_date: '2025-11-25',
            description: 'Teste com autenticação válida'
        };
        
        console.log('📝 Dados do plano:', JSON.stringify(planData, null, 2));
        console.log('📡 Fazendo requisição para /api/plans...');
        
        const planResponse = await client.post('/api/plans', planData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ SUCESSO! Status:', planResponse.status);
        console.log('📤 Resposta:', JSON.stringify(planResponse.data, null, 2));
        
        const planId = planResponse.data.newPlanId || planResponse.data.id;
        console.log('🆔 Plan ID:', planId);
        
        return { success: true, planId, token };
        
    } catch (error) {
        console.error('❌ ERRO CAPTURADO:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.response?.data?.message || error.message);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        
        return { success: false, error };
    }
}

// Executar teste
testWithAuth().then(result => {
    if (result.success) {
        console.log('\n🎉 TESTE PASSOU! O problema foi resolvido.');
    } else {
        console.log('\n💥 TESTE FALHOU. Problema ainda existe.');
    }
    process.exit(0);
});