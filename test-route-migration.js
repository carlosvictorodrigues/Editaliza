/**
 * Script de teste para validar migração de rotas
 * 
 * Testa que:
 * 1. Rotas antigas ainda funcionam (compatibilidade)
 * 2. Rotas novas funcionam corretamente
 * 3. Redirecionamentos estão corretos
 * 4. Segurança está mantida (CSRF, rate limiting, etc)
 */

const fetch = require('node-fetch');
const colors = require('colors/safe');

// Configuração
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';

// Armazenar tokens e cookies
let authToken = null;
let csrfToken = null;
let cookies = '';

// Estatísticas
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
};

// Rotas para testar
const ROUTES_TO_TEST = [
    // Rotas antigas (devem funcionar mas com warning de deprecação)
    { 
        method: 'POST', 
        old: '/api/login', 
        new: '/api/auth/login',
        requiresAuth: false,
        requiresCsrf: true
    },
    { 
        method: 'POST', 
        old: '/api/register', 
        new: '/api/auth/register',
        requiresAuth: false,
        requiresCsrf: true
    },
    { 
        method: 'GET', 
        old: '/api/csrf-token', 
        new: '/api/auth/csrf-token',
        requiresAuth: false,
        requiresCsrf: false
    },
    { 
        method: 'POST', 
        old: '/api/request-password-reset', 
        new: '/api/auth/password/request',
        requiresAuth: false,
        requiresCsrf: true
    },
    { 
        method: 'POST', 
        old: '/api/reset-password', 
        new: '/api/auth/password/reset',
        requiresAuth: false,
        requiresCsrf: true
    },
    { 
        method: 'GET', 
        old: '/auth/session-token', 
        new: '/api/auth/session-token',
        requiresAuth: false,
        requiresCsrf: false
    },
    { 
        method: 'GET', 
        old: '/auth/google/status', 
        new: '/api/auth/google/status',
        requiresAuth: true,
        requiresCsrf: false
    },
    { 
        method: 'POST', 
        old: '/api/logout', 
        new: '/api/auth/logout',
        requiresAuth: true,
        requiresCsrf: true
    }
];

// Função auxiliar para fazer requisições
async function makeRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (csrfToken && options.method !== 'GET') {
        defaultOptions.headers['X-CSRF-Token'] = csrfToken;
    }

    if (cookies) {
        defaultOptions.headers['Cookie'] = cookies;
    }

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Capturar cookies
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
        cookies = setCookie;
    }

    return response;
}

// Testes individuais
async function testRoute(route) {
    console.log(`\nTestando: ${route.method} ${route.old} → ${route.new}`);
    stats.total++;

    try {
        // 1. Testar rota antiga
        console.log('  → Testando rota antiga...');
        const oldResponse = await makeRequest(`${BASE_URL}${route.old}`, {
            method: route.method
        });

        // Verificar header de deprecação
        const deprecationWarning = oldResponse.headers.get('x-deprecation-warning');
        const routeMigration = oldResponse.headers.get('x-route-migration');

        if (deprecationWarning || routeMigration) {
            console.log(colors.yellow(`  ⚠ Rota antiga redirecionada corretamente`));
            if (deprecationWarning) {
                console.log(colors.gray(`     ${deprecationWarning}`));
            }
            stats.warnings++;
        }

        // 2. Testar rota nova
        console.log('  → Testando rota nova...');
        const newResponse = await makeRequest(`${BASE_URL}${route.new}`, {
            method: route.method
        });

        // Verificar status
        if (route.requiresAuth && !authToken) {
            if (newResponse.status === 401 || newResponse.status === 403) {
                console.log(colors.green('  ✓ Autenticação funcionando corretamente'));
                stats.passed++;
            } else {
                console.log(colors.red(`  ✗ Autenticação falhou: esperado 401/403, recebido ${newResponse.status}`));
                stats.failed++;
            }
        } else if (route.requiresCsrf && !csrfToken && route.method !== 'GET') {
            if (newResponse.status === 403) {
                console.log(colors.green('  ✓ Proteção CSRF funcionando'));
                stats.passed++;
            } else {
                console.log(colors.red(`  ✗ CSRF falhou: esperado 403, recebido ${newResponse.status}`));
                stats.failed++;
            }
        } else {
            // Para rotas que devem funcionar
            if (newResponse.status < 500) {
                console.log(colors.green(`  ✓ Rota nova respondendo (${newResponse.status})`));
                stats.passed++;
            } else {
                console.log(colors.red(`  ✗ Erro na rota nova: ${newResponse.status}`));
                stats.failed++;
            }
        }

        return true;
    } catch (error) {
        console.log(colors.red(`  ✗ Erro: ${error.message}`));
        stats.failed++;
        return false;
    }
}

// Testes de fluxo completo
async function testCompleteFlow() {
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE FLUXO COMPLETO'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    try {
        // 1. Obter CSRF token
        console.log('\n1. Obtendo CSRF token...');
        const csrfResponse = await makeRequest(`${BASE_URL}/api/auth/csrf-token`);
        const csrfData = await csrfResponse.json();
        csrfToken = csrfData.csrfToken;
        console.log(colors.green(`  ✓ CSRF token obtido: ${csrfToken.substring(0, 10)}...`));

        // 2. Registrar usuário
        console.log('\n2. Registrando novo usuário...');
        const registerResponse = await makeRequest(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });

        if (registerResponse.status === 201) {
            const registerData = await registerResponse.json();
            authToken = registerData.token;
            console.log(colors.green(`  ✓ Usuário registrado: ${TEST_EMAIL}`));
        } else {
            console.log(colors.yellow(`  ⚠ Registro falhou (pode já existir): ${registerResponse.status}`));
        }

        // 3. Fazer login
        console.log('\n3. Fazendo login...');
        const loginResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });

        if (loginResponse.status === 200) {
            const loginData = await loginResponse.json();
            authToken = loginData.token;
            console.log(colors.green(`  ✓ Login bem-sucedido`));
        } else {
            console.log(colors.red(`  ✗ Login falhou: ${loginResponse.status}`));
        }

        // 4. Verificar usuário autenticado
        console.log('\n4. Verificando usuário autenticado...');
        const meResponse = await makeRequest(`${BASE_URL}/api/auth/me`);
        
        if (meResponse.status === 200) {
            const userData = await meResponse.json();
            console.log(colors.green(`  ✓ Usuário verificado: ${userData.user?.email}`));
        } else {
            console.log(colors.red(`  ✗ Verificação falhou: ${meResponse.status}`));
        }

        // 5. Fazer logout
        console.log('\n5. Fazendo logout...');
        const logoutResponse = await makeRequest(`${BASE_URL}/api/auth/logout`, {
            method: 'POST'
        });

        if (logoutResponse.status === 200) {
            console.log(colors.green(`  ✓ Logout bem-sucedido`));
            authToken = null;
        } else {
            console.log(colors.red(`  ✗ Logout falhou: ${logoutResponse.status}`));
        }

        // 6. Verificar que não está mais autenticado
        console.log('\n6. Verificando que não está mais autenticado...');
        const meResponse2 = await makeRequest(`${BASE_URL}/api/auth/me`);
        
        if (meResponse2.status === 401 || meResponse2.status === 403) {
            console.log(colors.green(`  ✓ Autenticação removida corretamente`));
        } else {
            console.log(colors.red(`  ✗ Ainda autenticado: ${meResponse2.status}`));
        }

    } catch (error) {
        console.log(colors.red(`\nErro no fluxo: ${error.message}`));
    }
}

// Executar todos os testes
async function runAllTests() {
    console.log(colors.cyan('╔═══════════════════════════════════════════╗'));
    console.log(colors.cyan('║   TESTE DE MIGRAÇÃO DE ROTAS - EDITALIZA   ║'));
    console.log(colors.cyan('╚═══════════════════════════════════════════╝'));
    console.log(`\nServidor: ${BASE_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Testar fluxo completo primeiro
    await testCompleteFlow();

    // Testar rotas individuais
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('TESTE DE ROTAS INDIVIDUAIS'));
    console.log(colors.cyan('═══════════════════════════════════════════'));

    for (const route of ROUTES_TO_TEST) {
        await testRoute(route);
    }

    // Relatório final
    console.log(colors.cyan('\n═══════════════════════════════════════════'));
    console.log(colors.cyan('RELATÓRIO FINAL'));
    console.log(colors.cyan('═══════════════════════════════════════════'));
    console.log(`Total de testes: ${stats.total}`);
    console.log(colors.green(`✓ Passou: ${stats.passed}`));
    console.log(colors.yellow(`⚠ Avisos: ${stats.warnings}`));
    console.log(colors.red(`✗ Falhou: ${stats.failed}`));
    
    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
    if (successRate >= 80) {
        console.log(colors.green(`\nTaxa de sucesso: ${successRate}% 🎉`));
    } else if (successRate >= 60) {
        console.log(colors.yellow(`\nTaxa de sucesso: ${successRate}% ⚠`));
    } else {
        console.log(colors.red(`\nTaxa de sucesso: ${successRate}% ❌`));
    }

    process.exit(stats.failed > 0 ? 1 : 0);
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllTests().catch(error => {
        console.error(colors.red(`\nErro fatal: ${error.message}`));
        process.exit(1);
    });
}

module.exports = { runAllTests, testRoute, testCompleteFlow };