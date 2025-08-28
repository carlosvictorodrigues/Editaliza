/**
 * DEBUG SCRIPT - Testar API de Subjects
 * Script para gerar token válido e testar os endpoints de subjects
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configurações
const JWT_SECRET = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
const BASE_URL = 'http://localhost:3000';

// Gerar token válido para teste
function generateTestToken() {
    const payload = {
        id: 1,
        email: 'test@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora
    };
    
    return jwt.sign(payload, JWT_SECRET);
}

async function testSubjectsAPI() {
    console.log('🔧 DEBUG: Testando API de Subjects...');
    console.log('=' .repeat(50));
    
    const token = generateTestToken();
    console.log('✅ Token gerado:', token.substring(0, 50) + '...');
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    const tests = [
        {
            name: 'Health Check',
            method: 'GET',
            url: `${BASE_URL}/health`,
            headers: {}
        },
        {
            name: 'GET /api/subjects (básica)',
            method: 'GET',
            url: `${BASE_URL}/api/subjects`,
            headers: {}
        },
        {
            name: 'GET /api/plans/20/subjects',
            method: 'GET',
            url: `${BASE_URL}/api/plans/20/subjects`,
            headers
        },
        {
            name: 'GET /api/plans/20/subjects_with_topics',
            method: 'GET',
            url: `${BASE_URL}/api/plans/20/subjects_with_topics`,
            headers
        }
    ];
    
    for (const test of tests) {
        console.log(`\n🧪 Testando: ${test.name}`);
        console.log(`   ${test.method} ${test.url}`);
        
        try {
            const config = {
                method: test.method,
                url: test.url,
                headers: test.headers,
                timeout: 5000,
                validateStatus: () => true // Não lançar erro para status codes
            };
            
            if (test.data) {
                config.data = test.data;
            }
            
            const response = await axios(config);
            
            console.log(`   Status: ${response.status}`);
            console.log(`   Headers: Content-Type=${response.headers['content-type']}`);
            
            if (response.status >= 400) {
                console.log(`   ❌ Erro: ${JSON.stringify(response.data, null, 2)}`);
            } else {
                console.log(`   ✅ Sucesso: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
            }
            
        } catch (error) {
            console.log(`   ❌ Erro de rede: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }
        
        // Aguardar um pouco entre requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🏁 Testes concluídos!');
}

// Executar se chamado diretamente
if (require.main === module) {
    testSubjectsAPI().catch(console.error);
}

module.exports = { generateTestToken, testSubjectsAPI };