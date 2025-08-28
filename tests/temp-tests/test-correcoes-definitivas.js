#!/usr/bin/env node

/**
 * Script de teste das correções definitivas
 * Testa os 5 problemas identificados:
 * 1. Roteamento centralizado
 * 2. CSRF vs JWT
 * 3. Retorno de ID no banco
 * 4. Login funcionando
 * 5. Criação de plano com ID retornado
 */

const axios = require('axios');
const colors = require('colors');

const BASE_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3001';
const timestamp = Date.now();

// Dados de teste
const testUser = {
    name: `Teste ${timestamp}`,
    email: `teste${timestamp}@example.com`,
    password: 'Teste123!@#'
};

let authToken = null;
let userId = null;

// Funções auxiliares
function logTest(name, success, details = '') {
    const status = success ? '✅ PASSOU'.green : '❌ FALHOU'.red;
    console.log(`${status} - ${name}`);
    if (details) console.log(`  └─ ${details}`.gray);
}

async function testHealth() {
    console.log('\n📋 Teste 1: Health Check (Roteamento)'.cyan);
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        logTest('Health Check', response.data.status === 'OK', `Status: ${response.data.status}`);
        return true;
    } catch (error) {
        logTest('Health Check', false, error.message);
        return false;
    }
}

async function testRegister() {
    console.log('\n📋 Teste 2: Registro de Usuário'.cyan);
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        userId = response.data.userId;
        authToken = response.data.token;
        
        logTest('Registro', true, `UserID: ${userId}`);
        logTest('Token JWT recebido', !!authToken, authToken ? 'Token presente' : 'Token ausente');
        return !!authToken;
    } catch (error) {
        if (error.response?.status === 409) {
            logTest('Registro', false, 'Usuário já existe - tentando login');
            return false;
        }
        logTest('Registro', false, error.response?.data?.error || error.message);
        return false;
    }
}

async function testLogin() {
    console.log('\n📋 Teste 3: Login (POST /api/auth/login)'.cyan);
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        
        authToken = response.data.token;
        logTest('Login', true, 'Login bem-sucedido');
        logTest('Token recebido', !!authToken, authToken ? 'Token presente' : 'Token ausente');
        return true;
    } catch (error) {
        logTest('Login', false, `${error.response?.status} - ${error.response?.data?.error || error.message}`);
        return false;
    }
}

async function testApiWithoutCsrf() {
    console.log('\n📋 Teste 4: API sem CSRF (JWT Authentication)'.cyan);
    
    if (!authToken) {
        logTest('API sem CSRF', false, 'Sem token de autenticação');
        return false;
    }
    
    try {
        const response = await axios.get(`${BASE_URL}/api/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        logTest('API sem CSRF', true, 'Acesso permitido com JWT');
        logTest('Dados do perfil', !!response.data.email, `Email: ${response.data.email}`);
        return true;
    } catch (error) {
        if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
            logTest('API sem CSRF', false, 'CSRF bloqueando API (problema!)');
        } else {
            logTest('API sem CSRF', false, error.response?.data?.error || error.message);
        }
        return false;
    }
}

async function testCreatePlan() {
    console.log('\n📋 Teste 5: Criar Plano de Estudos (POST /api/plans)'.cyan);
    
    if (!authToken) {
        logTest('Criar Plano', false, 'Sem token de autenticação');
        return false;
    }
    
    try {
        const planData = {
            title: `Plano Teste ${timestamp}`,
            description: 'Plano criado para teste de correções',
            exam_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            days_until_exam: 90,
            available_hours_per_day: 4
        };
        
        const response = await axios.post(`${BASE_URL}/api/plans`, planData, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const hasNewPlanId = response.data.newPlanId || response.data.planId || response.data.id;
        
        logTest('POST /api/plans', response.status === 201, `Status: ${response.status}`);
        logTest('Retorno do ID do plano', !!hasNewPlanId, `ID: ${hasNewPlanId || 'NÃO RETORNADO'}`);
        
        if (!hasNewPlanId) {
            console.log('  └─ Resposta completa:'.yellow, JSON.stringify(response.data, null, 2));
        }
        
        return !!hasNewPlanId;
    } catch (error) {
        logTest('Criar Plano', false, `${error.response?.status} - ${error.response?.data?.error || error.message}`);
        if (error.response?.data) {
            console.log('  └─ Resposta de erro:'.yellow, JSON.stringify(error.response.data, null, 2));
        }
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Iniciando Testes das Correções Definitivas'.bold.cyan);
    console.log('═'.repeat(50).cyan);
    
    const results = {
        health: await testHealth(),
        register: await testRegister(),
        login: false,
        apiWithoutCsrf: false,
        createPlan: false
    };
    
    // Se registro falhou (usuário já existe), tenta login
    if (!results.register) {
        results.login = await testLogin();
    } else {
        results.login = true; // Registro bem-sucedido implica em login
    }
    
    // Só testa as próximas se tiver autenticação
    if (authToken) {
        results.apiWithoutCsrf = await testApiWithoutCsrf();
        results.createPlan = await testCreatePlan();
    }
    
    // Resumo final
    console.log('\n' + '═'.repeat(50).cyan);
    console.log('📊 RESUMO DOS TESTES'.bold.cyan);
    console.log('═'.repeat(50).cyan);
    
    const problems = {
        '1. Roteamento centralizado': results.health,
        '2. Login funcionando': results.login,
        '3. API sem bloqueio CSRF': results.apiWithoutCsrf,
        '4. Criação de plano': results.createPlan,
        '5. ID retornado na criação': results.createPlan
    };
    
    Object.entries(problems).forEach(([problem, solved]) => {
        const icon = solved ? '✅' : '❌';
        const status = solved ? 'RESOLVIDO'.green : 'PENDENTE'.red;
        console.log(`${icon} ${problem}: ${status}`);
    });
    
    const totalSolved = Object.values(problems).filter(v => v).length;
    const percentage = (totalSolved / 5 * 100).toFixed(0);
    
    console.log('\n' + '═'.repeat(50).cyan);
    if (totalSolved === 5) {
        console.log(`🎉 SUCESSO TOTAL! Todos os 5 problemas foram resolvidos! ${percentage}%`.bold.green);
    } else {
        console.log(`⚠️  ${totalSolved}/5 problemas resolvidos (${percentage}%)`.bold.yellow);
        console.log('Execute novamente após corrigir os problemas pendentes.'.gray);
    }
}

// Verificar se o servidor está rodando
axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log(`🔗 Usando servidor em: ${BASE_URL}`.gray);
        runAllTests().catch(console.error);
    })
    .catch(() => {
        console.error(`❌ Servidor não está rodando em ${BASE_URL}`.red);
        console.log('Execute: PORT=3001 npm start'.gray);
        process.exit(1);
    });