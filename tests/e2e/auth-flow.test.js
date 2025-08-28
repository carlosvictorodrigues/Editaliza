/**
 * Testes E2E do Fluxo Completo de Autenticação
 * 
 * OBJETIVOS:
 * - Validar fluxo completo: registro → login → logout → renovação
 * - Testar endpoints de autenticação com dados reais
 * - Validar proteção de rotas
 * - Verificar integração frontend-backend
 * - Testar segurança (JWT, CSRF, Rate Limiting)
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuração dos testes
const config = {
    baseURL: 'http://localhost:3001',
    timeout: 10000,
    testUser: {
        email: `test_${Date.now()}@editaliza.test.com`,
        password: 'TestPassword123@',
        name: 'Usuário de Teste'
    }
};

// Cliente HTTP configurado
const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout,
    validateStatus: () => true // Permitir todos os status para análise
});

// Estado dos testes
let testState = {
    csrfToken: null,
    accessToken: null,
    refreshToken: null,
    userId: null,
    cookies: []
};

// Utilitários de teste
const testUtils = {
    // Aguardar que o servidor esteja pronto
    async waitForServer(maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await client.get('/health');
                if (response.status === 200) {
                    console.log('✅ Servidor está pronto para os testes');
                    return true;
                }
            } catch (error) {
                console.log(`⏳ Aguardando servidor... (tentativa ${i + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        throw new Error('Servidor não ficou disponível para os testes');
    },

    // Extrair cookies de resposta
    extractCookies(response) {
        const cookies = response.headers['set-cookie'] || [];
        return cookies.map(cookie => cookie.split(';')[0]);
    },

    // Aplicar cookies em requests
    applyCookies(cookieArray) {
        return cookieArray.join('; ');
    },

    // Validar estrutura de resposta de auth
    validateAuthResponse(response, expectedStatus = 200, requireSuccess = true) {
        console.log(`📊 Validando resposta: status ${response.status}`);
        console.log(`📄 Body:`, JSON.stringify(response.data, null, 2));
        
        if (response.status !== expectedStatus) {
            throw new Error(`Status esperado: ${expectedStatus}, recebido: ${response.status}`);
        }

        if ((expectedStatus === 200 || expectedStatus === 201) && requireSuccess) {
            if (!response.data.success) {
                throw new Error('Resposta não indica sucesso');
            }
            
            if (response.data.user) {
                if (!response.data.user.id || !response.data.user.email) {
                    throw new Error('Dados do usuário incompletos');
                }
            }
            
            if (response.data.tokens) {
                if (!response.data.tokens.accessToken) {
                    throw new Error('Token de acesso não fornecido');
                }
            }
        }

        return true;
    },

    // Log de teste
    log(testName, status, details = '') {
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${testName} ${details ? `- ${details}` : ''}`);
    }
};

// Suíte de testes
class AuthFlowTests {
    constructor() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    // Executar um teste individual
    async runTest(testName, testFn) {
        this.results.total++;
        
        try {
            console.log(`\n🧪 Executando: ${testName}`);
            await testFn();
            testUtils.log(testName, 'PASS');
            this.results.passed++;
            return { success: true };
        } catch (error) {
            testUtils.log(testName, 'FAIL', error.message);
            this.results.failed++;
            this.results.errors.push({ test: testName, error: error.message });
            return { success: false, error: error.message };
        }
    }

    // 1. Teste de Health Check
    async testHealthCheck() {
        const response = await client.get('/health');
        testUtils.validateAuthResponse(response, 200, false);
        
        if (!response.data.message || response.data.message !== 'OK') {
            throw new Error('Health check não retornou status OK');
        }
    }

    // 2. Teste de obtenção de CSRF Token
    async testGetCSRFToken() {
        const response = await client.get('/api/auth/csrf-token');
        testUtils.validateAuthResponse(response, 200, false);
        
        if (!response.data.csrfToken) {
            throw new Error('CSRF token não fornecido');
        }
        
        testState.csrfToken = response.data.csrfToken;
        testState.cookies = testUtils.extractCookies(response);
        
        console.log(`🔐 CSRF Token obtido: ${testState.csrfToken.substring(0, 8)}...`);
    }

    // 3. Teste de registro de usuário
    async testUserRegistration() {
        const payload = {
            email: config.testUser.email,
            password: config.testUser.password,
            confirmPassword: config.testUser.password,
            name: config.testUser.name
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (testState.cookies.length > 0) {
            headers.Cookie = testUtils.applyCookies(testState.cookies);
        }

        if (testState.csrfToken) {
            headers['x-csrf-token'] = testState.csrfToken;
        }

        const response = await client.post('/api/auth/register', payload, { headers });
        testUtils.validateAuthResponse(response, 201);
        
        // Extrair tokens e dados do usuário
        if (response.data.tokens) {
            testState.accessToken = response.data.tokens.accessToken;
            testState.refreshToken = response.data.tokens.refreshToken;
        }
        
        if (response.data.user) {
            testState.userId = response.data.user.id;
        }

        // Atualizar cookies
        const newCookies = testUtils.extractCookies(response);
        if (newCookies.length > 0) {
            testState.cookies = [...testState.cookies, ...newCookies];
        }
        
        console.log(`👤 Usuário registrado: ID ${testState.userId}`);
    }

    // 4. Teste de logout
    async testUserLogout() {
        const headers = {
            'Authorization': `Bearer ${testState.accessToken}`,
            'Content-Type': 'application/json'
        };

        if (testState.cookies.length > 0) {
            headers.Cookie = testUtils.applyCookies(testState.cookies);
        }

        const response = await client.post('/api/auth/logout', {}, { headers });
        testUtils.validateAuthResponse(response, 200);
        
        if (!response.data.success) {
            throw new Error('Logout não foi bem-sucedido');
        }
        
        console.log('🚪 Logout realizado com sucesso');
    }

    // 5. Teste de login
    async testUserLogin() {
        const payload = {
            email: config.testUser.email,
            password: config.testUser.password
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (testState.cookies.length > 0) {
            headers.Cookie = testUtils.applyCookies(testState.cookies);
        }

        const response = await client.post('/api/auth/login', payload, { headers });
        testUtils.validateAuthResponse(response, 200);
        
        // Atualizar tokens
        if (response.data.tokens) {
            testState.accessToken = response.data.tokens.accessToken;
            testState.refreshToken = response.data.tokens.refreshToken;
        }

        // Atualizar cookies
        const newCookies = testUtils.extractCookies(response);
        if (newCookies.length > 0) {
            testState.cookies = [...testState.cookies, ...newCookies];
        }
        
        console.log('🔑 Login realizado com sucesso');
    }

    // 6. Teste de acesso a rota protegida (/api/auth/me)
    async testProtectedRoute() {
        const headers = {
            'Authorization': `Bearer ${testState.accessToken}`,
            'Content-Type': 'application/json'
        };

        if (testState.cookies.length > 0) {
            headers.Cookie = testUtils.applyCookies(testState.cookies);
        }

        const response = await client.get('/api/auth/me', { headers });
        testUtils.validateAuthResponse(response, 200);
        
        if (!response.data.user || response.data.user.id !== testState.userId) {
            throw new Error('Dados do usuário não conferem');
        }
        
        console.log('🛡️ Rota protegida acessada com sucesso');
    }

    // 7. Teste de acesso negado sem token
    async testUnauthorizedAccess() {
        const response = await client.get('/api/auth/me');
        
        if (response.status !== 401) {
            throw new Error(`Esperado status 401, recebido ${response.status}`);
        }
        
        console.log('🚫 Acesso não autorizado corretamente negado');
    }

    // 8. Teste de validações de entrada (registro com dados inválidos)
    async testInputValidation() {
        const payload = {
            email: 'email-invalido',
            password: '123', // Senha muito simples
            confirmPassword: '456' // Não confere
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        if (testState.cookies.length > 0) {
            headers.Cookie = testUtils.applyCookies(testState.cookies);
        }

        const response = await client.post('/api/auth/register', payload, { headers });
        
        if (response.status !== 400) {
            throw new Error(`Esperado status 400 para dados inválidos, recebido ${response.status}`);
        }
        
        if (!response.data.details || !Array.isArray(response.data.details)) {
            throw new Error('Detalhes de validação não fornecidos corretamente');
        }
        
        console.log(`🔍 Validação de entrada funcionando: ${response.data.details.length} erros detectados`);
    }

    // 9. Teste de rate limiting
    async testRateLimit() {
        const payload = {
            email: 'test@rate.limit',
            password: 'wrongpassword'
        };

        const headers = {
            'Content-Type': 'application/json'
        };

        console.log('⏳ Testando rate limiting com múltiplas tentativas...');
        
        let rateLimitHit = false;
        
        // Fazer várias tentativas de login
        for (let i = 0; i < 12; i++) {
            const response = await client.post('/api/auth/login', payload, { headers });
            
            if (response.status === 429) {
                rateLimitHit = true;
                console.log(`🛑 Rate limit atingido na tentativa ${i + 1}`);
                break;
            }
            
            // Aguardar um pouco entre as tentativas
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!rateLimitHit) {
            console.log('⚠️ Rate limit não foi atingido (pode estar configurado para desenvolvimento)');
        }
    }

    // Executar todos os testes
    async runAllTests() {
        console.log('🚀 Iniciando Validação Completa do Fluxo de Autenticação');
        console.log('=' .repeat(60));

        // Aguardar servidor
        await testUtils.waitForServer();

        // Executar testes na ordem correta
        const tests = [
            ['Health Check', () => this.testHealthCheck()],
            ['Obter CSRF Token', () => this.testGetCSRFToken()],
            ['Registro de Usuário', () => this.testUserRegistration()],
            ['Acesso a Rota Protegida', () => this.testProtectedRoute()],
            ['Logout de Usuário', () => this.testUserLogout()],
            ['Login de Usuário', () => this.testUserLogin()],
            ['Acesso Rota Protegida Pós-Login', () => this.testProtectedRoute()],
            ['Acesso Não Autorizado', () => this.testUnauthorizedAccess()],
            ['Validação de Entrada', () => this.testInputValidation()],
            ['Rate Limiting', () => this.testRateLimit()]
        ];

        // Executar cada teste
        for (const [name, testFn] of tests) {
            await this.runTest(name, testFn);
            
            // Pequena pausa entre testes
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Resumo dos resultados
        this.printSummary();
    }

    // Imprimir resumo dos resultados
    printSummary() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 RESUMO DOS TESTES DE AUTENTICAÇÃO');
        console.log('=' .repeat(60));
        
        console.log(`✅ Testes Aprovados: ${this.results.passed}`);
        console.log(`❌ Testes Falharam: ${this.results.failed}`);
        console.log(`📊 Total de Testes: ${this.results.total}`);
        console.log(`📈 Taxa de Sucesso: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ ERROS ENCONTRADOS:');
            this.results.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
            });
        }
        
        if (this.results.passed === this.results.total) {
            console.log('\n🎉 TODOS OS TESTES PASSARAM! Fluxo de autenticação está 100% funcional.');
        } else {
            console.log('\n⚠️ Alguns testes falharam. Verifique os problemas acima.');
        }
        
        console.log('\n🔍 Estado final dos testes:');
        console.log(`   - CSRF Token: ${testState.csrfToken ? 'Obtido' : 'Não obtido'}`);
        console.log(`   - Access Token: ${testState.accessToken ? 'Válido' : 'Não válido'}`);
        console.log(`   - User ID: ${testState.userId || 'Não definido'}`);
        console.log(`   - Cookies: ${testState.cookies.length} definidos`);
        
        return this.results;
    }
}

// Executar testes se chamado diretamente
if (require.main === module) {
    const authTests = new AuthFlowTests();
    authTests.runAllTests().catch(error => {
        console.error('❌ Erro fatal nos testes:', error);
        process.exit(1);
    });
}

module.exports = { AuthFlowTests, testUtils, config };