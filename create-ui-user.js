const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function createUIUser() {
    console.log('🧪 Criando usuário ui@ui.com...\n');
    
    try {
        // Register ui@ui.com user
        console.log('1️⃣ Registrando usuário ui@ui.com...');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
            email: 'ui@ui.com',
            password: '123456',
            name: 'UI Test User'
        }, {
            validateStatus: () => true
        });
        
        if (registerResponse.status === 201 || registerResponse.status === 200) {
            console.log('   ✅ Usuário ui@ui.com criado com sucesso!');
            console.log('   ID:', registerResponse.data.userId);
        } else if (registerResponse.data?.error?.includes('já está em uso')) {
            console.log('   ⚠️ Usuário já existe');
        } else {
            console.log('   ❌ Erro ao criar usuário:', registerResponse.data);
        }
        
        // Try to login
        console.log('\n2️⃣ Testando login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'ui@ui.com',
            password: '123456'
        }, {
            validateStatus: () => true
        });
        
        if (loginResponse.status === 200) {
            console.log('   ✅ Login funcionando!');
            console.log('   Token:', loginResponse.data.token?.substring(0, 50) + '...');
            console.log('\n✅ Usuário ui@ui.com pronto para uso!');
            console.log('📝 Credenciais:');
            console.log('   Email: ui@ui.com');
            console.log('   Senha: 123456');
        } else {
            console.log('   ❌ Login falhou:', loginResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

// Execute
createUIUser();