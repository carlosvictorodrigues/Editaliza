const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAuthenticationFlow() {
    console.log('🧪 Testando fluxo completo de autenticação...\n');
    
    try {
        // Test login with correct password
        console.log('1️⃣ Testando login com c@c.com e senha correta...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'c@c.com',
            password: 'senha123456'
        }, {
            validateStatus: () => true
        });
        
        if (loginResponse.status === 200) {
            console.log('   ✅ Login bem-sucedido!');
            console.log('   Token:', loginResponse.data.token?.substring(0, 50) + '...');
            
            const token = loginResponse.data.token;
            
            // Test protected route
            console.log('\n2️⃣ Testando rota protegida /api/user/profile...');
            const profileResponse = await axios.get(`${BASE_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` },
                validateStatus: () => true
            });
            
            if (profileResponse.status === 200) {
                console.log('   ✅ Rota protegida acessada com sucesso!');
                console.log('   Usuário:', profileResponse.data.email);
            } else {
                console.log(`   ❌ Erro ao acessar rota protegida: ${profileResponse.status}`);
                console.log('   Resposta:', profileResponse.data);
            }
            
            // Test subjects route
            console.log('\n3️⃣ Testando rota de subjects /api/plans/20/subjects...');
            const subjectsResponse = await axios.get(`${BASE_URL}/api/plans/20/subjects`, {
                headers: { 'Authorization': `Bearer ${token}` },
                validateStatus: () => true,
                timeout: 5000
            });
            
            if (subjectsResponse.status === 200) {
                console.log('   ✅ Rota de subjects acessada com sucesso!');
                console.log('   Total de subjects:', subjectsResponse.data.length);
            } else {
                console.log(`   ❌ Erro ao acessar subjects: ${subjectsResponse.status}`);
                console.log('   Resposta:', subjectsResponse.data);
            }
            
        } else {
            console.log(`   ❌ Falha no login: ${loginResponse.status}`);
            console.log('   Erro:', loginResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Erro durante teste:', error.message);
    }
    
    console.log('\n✅ Teste concluído!');
}

// Execute test
testAuthenticationFlow();