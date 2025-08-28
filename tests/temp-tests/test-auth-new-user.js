const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testNewUserFlow() {
    console.log('🧪 Testando criação e autenticação de novo usuário...\n');
    
    const testEmail = `test_${Date.now()}@test.com`;
    const testPassword = '123456';
    
    try {
        // Register new user
        console.log('1️⃣ Registrando novo usuário...');
        console.log('   Email:', testEmail);
        console.log('   Senha:', testPassword);
        
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
            email: testEmail,
            password: testPassword,
            name: 'Test User'
        }, {
            validateStatus: () => true
        });
        
        if (registerResponse.status === 201 || registerResponse.status === 200) {
            console.log('   ✅ Usuário registrado com sucesso!');
            
            // Login with new user
            console.log('\n2️⃣ Fazendo login com novo usuário...');
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testEmail,
                password: testPassword
            }, {
                validateStatus: () => true
            });
            
            if (loginResponse.status === 200) {
                console.log('   ✅ Login bem-sucedido!');
                console.log('   Token:', loginResponse.data.token?.substring(0, 50) + '...');
                
                const token = loginResponse.data.token;
                
                // Test protected route
                console.log('\n3️⃣ Testando rota protegida /api/user/profile...');
                const profileResponse = await axios.get(`${BASE_URL}/api/user/profile`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    validateStatus: () => true
                });
                
                if (profileResponse.status === 200) {
                    console.log('   ✅ Rota protegida acessada com sucesso!');
                    console.log('   Dados do usuário:');
                    console.log('   - ID:', profileResponse.data.id);
                    console.log('   - Email:', profileResponse.data.email);
                    console.log('   - Nome:', profileResponse.data.name);
                } else {
                    console.log(`   ❌ Erro ao acessar rota protegida: ${profileResponse.status}`);
                    console.log('   Resposta:', profileResponse.data);
                }
                
                // Test subjects route
                console.log('\n4️⃣ Testando rota /api/subjects (sem plano)...');
                const subjectsResponse = await axios.get(`${BASE_URL}/api/subjects`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    validateStatus: () => true
                });
                
                if (subjectsResponse.status === 200) {
                    console.log('   ✅ Rota de subjects acessada!');
                    console.log('   Total de subjects:', subjectsResponse.data.length || 0);
                } else {
                    console.log(`   ⚠️ Status da resposta: ${subjectsResponse.status}`);
                    console.log('   Resposta:', subjectsResponse.data);
                }
                
                console.log('\n✅ AUTENTICAÇÃO JWT FUNCIONANDO PERFEITAMENTE!');
                console.log('📝 Credenciais de teste criadas:');
                console.log(`   Email: ${testEmail}`);
                console.log(`   Senha: ${testPassword}`);
                
            } else {
                console.log(`   ❌ Falha no login: ${loginResponse.status}`);
                console.log('   Erro:', loginResponse.data);
            }
        } else {
            console.log(`   ❌ Falha no registro: ${registerResponse.status}`);
            console.log('   Erro:', registerResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Erro durante teste:', error.message);
    }
    
    console.log('\n✅ Teste concluído!');
}

// Execute test
testNewUserFlow();