/**
 * Test Plans Route with Authentication
 * 
 * This script tests accessing the plans route with a JWT token
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `test_plans_${Date.now()}@editaliza.test`;
const TEST_PASSWORD = 'TestPassword123!';

async function testPlansAuth() {
    console.log('🔐 Testing Plans Route Authentication\n');
    
    try {
        // 1. Register and login to get token
        console.log('1. Registrando usuário...');
        await axios.post(`${BASE_URL}/api/auth/register`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            name: 'Test User'
        });

        console.log('2. Fazendo login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        const token = loginResponse.data.token;
        console.log('✅ Token obtido');

        // 2. Test plans route
        console.log('3. Testando rota de planos...');
        
        const plansResponse = await axios.get(`${BASE_URL}/api/plans`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 5000
        });

        console.log('✅ Rota de planos acessível');
        console.log(`Planos encontrados: ${plansResponse.data.length || 0}`);
        
        if (plansResponse.data.length > 0) {
            console.log('Primeiro plano:', plansResponse.data[0]);
        }

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.log('❌ Timeout na rota de planos - middleware ainda tem problemas');
        } else {
            console.log('❌ Erro:', error.response?.data?.error || error.message);
        }
    }
}

// Run the test
if (require.main === module) {
    require('dotenv').config();
    testPlansAuth();
}

module.exports = { testPlansAuth };