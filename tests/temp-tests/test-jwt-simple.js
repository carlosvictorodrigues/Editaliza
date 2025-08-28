/**
 * Simple JWT Authentication Test
 * 
 * This script isolates the JWT authentication issue by testing:
 * 1. Basic login to get a token
 * 2. Token validation with detailed debugging
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `test_simple_${Date.now()}@editaliza.test`;
const TEST_PASSWORD = 'TestPassword123!';

async function testJWTIssue() {
    console.log('🔐 JWT Authentication Debug Test\n');
    
    try {
        // 1. Register user
        console.log('1. Registrando usuário de teste...');
        
        try {
            await axios.post(`${BASE_URL}/api/auth/register`, {
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                name: 'Test User'
            });
            console.log('✅ Usuário registrado');
        } catch (error) {
            if (error.response?.data?.error?.includes('já está em uso')) {
                console.log('⚠️  Usuário já existe, continuando...');
            } else {
                throw error;
            }
        }
        
        // 2. Login to get token
        console.log('\n2. Fazendo login para obter token...');
        
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Token obtido');
        console.log(`Token: ${token.substring(0, 50)}...`);
        
        // 3. Decode token to analyze
        console.log('\n3. Analisando estrutura do token...');
        const decoded = jwt.decode(token, { complete: true });
        console.log('Header:', JSON.stringify(decoded.header, null, 2));
        console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
        
        // 4. Manually verify token using the same secret and options as the middleware
        console.log('\n4. Verificando token manualmente...');
        const JWT_SECRET = process.env.JWT_SECRET || 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
        console.log(`JWT_SECRET (first 20 chars): ${JWT_SECRET.substring(0, 20)}...`);
        
        try {
            const manualVerify = jwt.verify(token, JWT_SECRET, {
                issuer: 'editaliza',
                algorithms: ['HS256']
            });
            console.log('✅ Token válido na verificação manual');
            console.log('Payload verificado:', JSON.stringify(manualVerify, null, 2));
        } catch (error) {
            console.log('❌ Erro na verificação manual:', error.message);
            console.log('Erro completo:', error);
        }
        
        // 5. Test token validation through API
        console.log('\n5. Testando validação via API...');
        
        try {
            const verifyResponse = await axios.get(`${BASE_URL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000  // 10 second timeout
            });
            
            console.log('✅ Token válido via API');
            console.log('Resposta:', JSON.stringify(verifyResponse.data, null, 2));
            
        } catch (error) {
            console.log('❌ Erro na validação via API:', error.response?.data?.error || error.message);
            
            if (error.response?.data) {
                console.log('Resposta completa:', JSON.stringify(error.response.data, null, 2));
            }
            
            // Additional debugging for JWT errors
            if (error.code === 'ECONNABORTED') {
                console.log('⏰ Request timed out - servidor pode estar travado na validação');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();
    testJWTIssue();
}

module.exports = { testJWTIssue };