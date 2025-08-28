/**
 * Teste específico para verificar retorno do ID do plano
 */

const axios = require('axios');

async function testPlanCreation() {
    try {
        console.log('1. Fazendo login...');
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'teste.sistema@editaliza.com',
            password: '123456789'
        });
        
        console.log('✅ Login realizado');
        const token = loginResponse.data.token;
        
        console.log('2. Criando plano...');
        const planResponse = await axios.post('http://localhost:3000/api/plans', {
            plan_name: 'Debug Plan ID',
            exam_date: '2025-12-31'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('✅ Plano criado');
        console.log('📊 Resposta completa:', JSON.stringify(planResponse.data, null, 2));
        
        // Verificar se tem newPlanId
        if (planResponse.data.newPlanId) {
            console.log('✅ newPlanId encontrado:', planResponse.data.newPlanId);
        } else {
            console.log('❌ newPlanId NÃO encontrado na resposta');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

testPlanCreation();