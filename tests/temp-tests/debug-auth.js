/**
 * Script para debugar problemas específicos de autenticação
 */

const axios = require('axios');

async function testAuthEndpoints() {
    const client = axios.create({
        baseURL: 'http://localhost:3001',
        validateStatus: () => true
    });

    console.log('🔍 Testando endpoints de autenticação...\n');

    try {
        // 1. Teste de registro
        console.log('1. Testando registro...');
        const registerResponse = await client.post('/api/auth/register', {
            email: `test_${Date.now()}@example.com`,
            password: 'TestPassword123@',
            confirmPassword: 'TestPassword123@',
            name: 'Test User'
        });

        console.log(`   Status: ${registerResponse.status}`);
        console.log(`   Data:`, JSON.stringify(registerResponse.data, null, 2));
        
        if (registerResponse.status === 500) {
            console.log('❌ Erro interno no registro');
            return;
        }

    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    testAuthEndpoints();
}

module.exports = { testAuthEndpoints };