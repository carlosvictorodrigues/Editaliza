/**
 * TESTE COMPARATIVO - PROFILE vs PROFILE-TEST
 * Identifica se o problema está na importação do controller
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TIMEOUT = 3000; // 3 segundos

async function testeComparativo() {
    console.log('🔍 TESTE COMPARATIVO - PROFILE ROUTES');
    
    let token = null;
    
    try {
        // 1. Fazer login primeiro
        console.log('\n1️⃣ Fazendo login...');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'teste.diagnostico@email.com',
            password: 'senha123'
        }, { timeout: 5000 });
        
        token = loginResponse.data.token;
        console.log(`✅ Login OK!`);
        
        const headers = {
            'Authorization': `Bearer ${token}`
        };
        
        // 2. Testar rota ORIGINAL /api/profile
        console.log('\n2️⃣ Testando /api/profile (ORIGINAL - com controller import)...');
        try {
            const startTime = Date.now();
            const response = await axios.get(`${BASE_URL}/api/profile`, {
                headers,
                timeout: TIMEOUT
            });
            const endTime = Date.now();
            console.log(`✅ ORIGINAL funcionou! ${endTime - startTime}ms`);
            console.log(`📋 Response:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log(`❌ ORIGINAL travou (timeout ${TIMEOUT}ms)`);
            } else {
                console.log(`❌ ORIGINAL erro: ${error.message}`);
            }
        }
        
        // 3. Testar rota DE TESTE /api/profile-test  
        console.log('\n3️⃣ Testando /api/profile-test (SEM controller import)...');
        try {
            const startTime = Date.now();
            const response = await axios.get(`${BASE_URL}/api/profile-test`, {
                headers,
                timeout: TIMEOUT
            });
            const endTime = Date.now();
            console.log(`✅ TESTE funcionou! ${endTime - startTime}ms`);
            console.log(`📋 Response:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.log(`❌ TESTE travou (timeout ${TIMEOUT}ms)`);
            } else {
                console.log(`❌ TESTE erro: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.log(`💥 ERRO NO LOGIN: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 CONCLUSÕES:');
    console.log('- Se ORIGINAL trava mas TESTE funciona = problema no controller');
    console.log('- Se ambos travam = problema no middleware de auth');
    console.log('- Se ambos funcionam = problema foi temporário');
    console.log('='.repeat(50));
}

if (require.main === module) {
    testeComparativo().catch(console.error);
}

module.exports = { testeComparativo };