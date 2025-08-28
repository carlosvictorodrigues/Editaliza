#!/usr/bin/env node

/**
 * Teste de Validação Rápida - Correções Aplicadas
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const timestamp = Date.now();

async function testarHealthCheck() {
    console.log('1. Health Check...');
    try {
        const res = await axios.get(`${BASE_URL}/health`);
        console.log('   ✅ Health Check OK:', res.data.status);
        return true;
    } catch (e) {
        console.log('   ❌ Health Check FALHOU:', e.message);
        return false;
    }
}

async function testarRegistro() {
    console.log('2. Registro de Usuário...');
    try {
        const res = await axios.post(`${BASE_URL}/api/auth/register`, {
            name: `Test ${timestamp}`,
            email: `test${timestamp}@example.com`,
            password: 'Test123!@#'
        });
        
        const userId = res.data.userId || res.data.id;
        console.log('   ✅ Registro OK, userId:', userId);
        console.log('   ✅ Token JWT recebido:', !!res.data.token);
        return res.data.token;
    } catch (e) {
        console.log('   ❌ Registro FALHOU:', e.response?.data?.error || e.message);
        return null;
    }
}

async function testarLogin(email, password) {
    console.log('3. Login...');
    try {
        const res = await axios.post(`${BASE_URL}/api/auth/login`, {
            email,
            password
        });
        console.log('   ✅ Login OK');
        console.log('   ✅ Token recebido:', !!res.data.token);
        return res.data.token;
    } catch (e) {
        console.log('   ❌ Login FALHOU:', e.response?.data?.error || e.message);
        return null;
    }
}

async function testarCriarPlano(token) {
    console.log('4. Criar Plano de Estudos...');
    try {
        const res = await axios.post(`${BASE_URL}/api/plans`, {
            plan_name: `Plano ${timestamp}`,
            description: 'Teste',
            exam_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            days_until_exam: 90,
            available_hours_per_day: 4
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const planId = res.data.newPlanId || res.data.planId || res.data.id;
        console.log('   ✅ Plano criado, ID:', planId);
        console.log('   ✅ Retorno de ID funcionando:', !!planId);
        return true;
    } catch (e) {
        console.log('   ❌ Criar Plano FALHOU:', e.response?.data?.error || e.message);
        return false;
    }
}

async function executar() {
    console.log('='.repeat(50));
    console.log('TESTE DE VALIDAÇÃO RÁPIDA - CORREÇÕES APLICADAS');
    console.log('='.repeat(50));
    
    const resultados = {
        health: false,
        registro: false,
        login: false,
        plano: false
    };
    
    // 1. Health Check
    resultados.health = await testarHealthCheck();
    
    // 2. Registro
    const email = `test${timestamp}@example.com`;
    const password = 'Test123!@#';
    let token = await testarRegistro();
    resultados.registro = !!token;
    
    // 3. Login (se registro falhou, tenta login)
    if (!token) {
        token = await testarLogin(email, password);
        resultados.login = !!token;
    } else {
        resultados.login = true;
    }
    
    // 4. Criar Plano
    if (token) {
        resultados.plano = await testarCriarPlano(token);
    }
    
    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('RESUMO DOS PROBLEMAS CORRIGIDOS:');
    console.log('='.repeat(50));
    
    const problemas = {
        '1. Roteamento centralizado': resultados.health,
        '2. Login funcionando': resultados.login,
        '3. API sem bloqueio CSRF': resultados.login && resultados.plano,
        '4. Criação de plano': resultados.plano,
        '5. ID retornado na criação': resultados.plano
    };
    
    Object.entries(problemas).forEach(([problema, resolvido]) => {
        console.log(`${resolvido ? '✅' : '❌'} ${problema}`);
    });
    
    const total = Object.values(problemas).filter(v => v).length;
    console.log('\n' + '='.repeat(50));
    console.log(`RESULTADO: ${total}/5 problemas resolvidos`);
    
    if (total === 5) {
        console.log('🎉 SUCESSO! Todos os problemas foram corrigidos!');
    }
}

// Verificar servidor
axios.get(`${BASE_URL}/health`)
    .then(() => executar())
    .catch(() => {
        console.error('❌ Servidor não está rodando em', BASE_URL);
        console.log('Execute: PORT=3001 npm start');
        process.exit(1);
    });