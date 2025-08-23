const fetch = require('node-fetch');

async function testCreatePlan() {
    const baseUrl = 'http://localhost:3000';
    
    try {
        // 1. Fazer login
        console.log('🔐 Fazendo login...');
        const loginResponse = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'teste@editaliza.com',
                password: 'teste123'
            })
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginData.token) {
            console.error('❌ Erro no login:', loginData);
            return;
        }
        
        console.log('✅ Login bem-sucedido!');
        const token = loginData.token;
        
        // 2. Criar plano de estudos
        console.log('\n📚 Criando plano de estudos...');
        const planResponse = await fetch(`${baseUrl}/plans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                plan_name: 'Plano de Teste PostgreSQL',
                exam_date: '2025-12-31'
            })
        });
        
        const planData = await planResponse.json();
        
        if (planResponse.ok) {
            console.log('✅ Plano criado com sucesso!', planData);
        } else {
            console.error('❌ Erro ao criar plano:', planData);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testCreatePlan();