/**
 * Comprehensive Authentication Flow Test
 * 
 * This script tests the complete authentication flow:
 * 1. Register a user
 * 2. Login and get JWT token
 * 3. Test protected routes with the token
 * 4. Verify token validation
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = `test_${Date.now()}@editaliza.test`;
const TEST_PASSWORD = 'TestPassword123!';

// Console colors for better output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(color, message) {
    console.log(`${color}${message}${colors.reset}`);
}

async function testAuthFlow() {
    console.log(`${colors.bold}🔐 TESTE COMPLETO DE AUTENTICAÇÃO${colors.reset}\n`);
    
    let authToken = null;
    
    try {
        // ==========================================
        // 1. TEST SERVER HEALTH
        // ==========================================
        log(colors.blue, '📡 1. Testando conectividade do servidor...');
        
        try {
            const healthResponse = await axios.get(`${BASE_URL}/health`);
            log(colors.green, `✅ Servidor conectado: ${healthResponse.data.status}`);
        } catch (error) {
            log(colors.red, `❌ Servidor não está rodando. Inicie com: npm run dev`);
            return;
        }
        
        // ==========================================
        // 2. TEST AUTH ROUTES
        // ==========================================
        log(colors.blue, '\n📡 2. Testando rotas de autenticação...');
        
        try {
            const authTestResponse = await axios.get(`${BASE_URL}/api/auth/test`);
            log(colors.green, `✅ Rotas auth funcionando: ${authTestResponse.data.message}`);
        } catch (error) {
            log(colors.red, `❌ Erro nas rotas auth: ${error.response?.data?.error || error.message}`);
            return;
        }
        
        // ==========================================
        // 3. TEST USER REGISTRATION
        // ==========================================
        log(colors.blue, '\n👤 3. Testando registro de usuário...');
        log(colors.yellow, `   Email: ${TEST_EMAIL}`);
        
        try {
            const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                name: 'Test User'
            });
            
            log(colors.green, `✅ Usuário registrado: ${registerResponse.data.message}`);
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            if (errorMsg.includes('já está em uso')) {
                log(colors.yellow, `⚠️  Usuário já existe, prosseguindo para login`);
            } else {
                log(colors.red, `❌ Erro no registro: ${errorMsg}`);
                return;
            }
        }
        
        // ==========================================
        // 4. TEST USER LOGIN
        // ==========================================
        log(colors.blue, '\n🔑 4. Testando login de usuário...');
        
        try {
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            });
            
            authToken = loginResponse.data.token;
            log(colors.green, `✅ Login realizado com sucesso`);
            log(colors.yellow, `   Token gerado: ${authToken.substring(0, 50)}...`);
            log(colors.yellow, `   Usuário: ${loginResponse.data.user.email}`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            log(colors.red, `❌ Erro no login: ${errorMsg}`);
            
            // Log detailed error information
            if (error.response?.data) {
                console.log('\n🔍 Detalhes do erro:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
            return;
        }
        
        // ==========================================
        // 5. TEST TOKEN VALIDATION
        // ==========================================
        log(colors.blue, '\n🛡️ 5. Testando validação do token...');
        
        if (!authToken) {
            log(colors.red, '❌ Não foi possível obter token do login');
            return;
        }
        
        try {
            const verifyResponse = await axios.get(`${BASE_URL}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            log(colors.green, `✅ Token válido`);
            log(colors.yellow, `   Usuário autenticado: ${verifyResponse.data.user.email}`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            log(colors.red, `❌ Erro na validação do token: ${errorMsg}`);
            
            // Log detailed JWT error information
            if (error.response?.data) {
                console.log('\n🔍 Detalhes do erro JWT:');
                console.log(JSON.stringify(error.response.data, null, 2));
            }
            
            console.log('\n🔍 Debug do Token:');
            console.log(`Token: ${authToken}`);
            
            // Try to decode token without verification
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(authToken, { complete: true });
                console.log('Token decodificado:', JSON.stringify(decoded, null, 2));
            } catch (decodeError) {
                console.log('Erro ao decodificar token:', decodeError.message);
            }
            
            return;
        }
        
        // ==========================================
        // 6. TEST PROTECTED ROUTES
        // ==========================================
        log(colors.blue, '\n🔒 6. Testando rotas protegidas...');
        
        // Test profile route
        try {
            const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            log(colors.green, `✅ Rota de perfil acessível`);
            log(colors.yellow, `   Perfil: ${profileResponse.data.email}`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            log(colors.red, `❌ Erro ao acessar perfil: ${errorMsg}`);
        }
        
        // Test plans route (if exists)
        try {
            const plansResponse = await axios.get(`${BASE_URL}/api/plans`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            log(colors.green, `✅ Rota de planos acessível`);
            log(colors.yellow, `   Planos encontrados: ${plansResponse.data.length || 0}`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            if (error.response?.status === 401) {
                log(colors.red, `❌ Erro de autenticação na rota de planos: ${errorMsg}`);
            } else {
                log(colors.yellow, `⚠️  Rota de planos não acessível: ${errorMsg}`);
            }
        }
        
        // ==========================================
        // 7. TEST TOKEN REFRESH
        // ==========================================
        log(colors.blue, '\n🔄 7. Testando refresh de token...');
        
        try {
            const refreshResponse = await axios.post(`${BASE_URL}/api/auth/refresh`, {
                token: authToken
            });
            
            log(colors.green, `✅ Token refreshed com sucesso`);
            log(colors.yellow, `   Novo token: ${refreshResponse.data.token.substring(0, 50)}...`);
            
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message;
            log(colors.yellow, `⚠️  Refresh de token não funcionou: ${errorMsg}`);
        }
        
        // ==========================================
        // SUMMARY
        // ==========================================
        log(colors.bold, '\n📊 RESUMO DOS TESTES:');
        log(colors.green, '✅ Testes básicos passaram');
        log(colors.blue, '🔐 Fluxo de autenticação testado');
        
        if (authToken) {
            log(colors.green, '✅ Token JWT gerado e validado com sucesso');
            console.log('\n🎉 AUTENTICAÇÃO FUNCIONANDO CORRETAMENTE!');
        } else {
            log(colors.red, '❌ Problemas com geração/validação de token JWT');
            console.log('\n⚠️  AUTENTICAÇÃO PRECISA SER CORRIGIDA');
        }
        
    } catch (error) {
        log(colors.red, `❌ Erro inesperado: ${error.message}`);
        console.error(error);
    }
}

// Execute the test
if (require.main === module) {
    testAuthFlow();
}

module.exports = { testAuthFlow };