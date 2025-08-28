const axios = require('axios');

(async () => {
    try {
        // Registrar novo usuário para evitar rate limit
        const timestamp = Date.now();
        const testEmail = `test${timestamp}@editaliza.com`;
        
        const register = await axios.post('http://localhost:3000/api/auth/register', {
            email: testEmail,
            password: '123456789',
            name: 'Teste User'
        });
        
        console.log('✅ Registro OK - Token:', register.data.token ? 'GERADO' : 'FALHADO');
        
        const token = register.data.token;
        
        // Criar plano
        const plan = await axios.post('http://localhost:3000/api/plans', {
            plan_name: 'Teste Quick', 
            exam_date: '2025-12-31'
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        console.log('✅ Resultado da criação do plano:');
        console.log(JSON.stringify(plan.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
})();