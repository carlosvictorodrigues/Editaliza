/**
 * TESTE COMPLETO DAS CORREÇÕES DO SISTEMA
 * Testa: criação de disciplinas, tópicos e geração de cronograma
 */

const colors = require('colors');
// Para Node.js < 18, usar node-fetch
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3001';
let authToken = null;
let userId = null;
let planId = null;
let subjectId = null;

// Função para fazer requisições HTTP
async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (authToken) {
        defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.error(`❌ Erro na requisição ${url}:`.red, data);
        throw new Error(data.error || 'Erro na requisição');
    }
    
    return data;
}

// 1. Login
async function testLogin() {
    console.log('\n📋 TESTE 1: Login'.yellow);
    
    try {
        const response = await makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'ui-test-user@editaliza.com',
                password: 'testpass123'
            })
        });
        
        authToken = response.token;
        userId = response.user.id;
        
        console.log('✅ Login realizado com sucesso'.green);
        console.log(`   Token: ${authToken.substring(0, 20)}...`);
        console.log(`   User ID: ${userId}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro no login:'.red, error.message);
        return false;
    }
}

// 2. Obter plano existente ou criar novo
async function testGetOrCreatePlan() {
    console.log('\n📋 TESTE 2: Obter ou criar plano'.yellow);
    
    try {
        // Tentar buscar planos existentes
        const plans = await makeRequest('/api/plans');
        
        if (plans.length > 0) {
            planId = plans[0].id;
            console.log(`✅ Usando plano existente: ID ${planId}`.green);
        } else {
            // Criar novo plano
            const newPlan = await makeRequest('/api/plans', {
                method: 'POST',
                body: JSON.stringify({
                    plan_name: 'Plano de Teste - Correções',
                    exam_date: '2025-12-31'
                })
            });
            
            planId = newPlan.planId;
            console.log(`✅ Plano criado: ID ${planId}`.green);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao obter/criar plano:'.red, error.message);
        return false;
    }
}

// 3. Testar criação de disciplina com tópicos
async function testCreateSubjectWithTopics() {
    console.log('\n📋 TESTE 3: Criar disciplina com tópicos'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/subjects_with_topics`, {
            method: 'POST',
            body: JSON.stringify({
                subject_name: 'Português - Teste',
                priority_weight: 5,
                topics_list: 'Interpretação de Texto\nGramática\nRedação\nOrtografia'
            })
        });
        
        console.log('✅ Disciplina criada com sucesso'.green);
        console.log(`   Subject ID: ${response.subjectId}`);
        console.log(`   Tópicos criados: ${response.topicIds.length}`);
        
        subjectId = response.subjectId;
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar disciplina:'.red, error.message);
        return false;
    }
}

// 4. Configurar horas de estudo
async function testConfigureStudyHours() {
    console.log('\n📋 TESTE 4: Configurar horas de estudo'.yellow);
    
    try {
        const studyHours = {
            monday: 2,
            tuesday: 2,
            wednesday: 3,
            thursday: 2,
            friday: 3,
            saturday: 4,
            sunday: 4
        };
        
        const response = await makeRequest(`/api/plans/${planId}/settings`, {
            method: 'PUT',
            body: JSON.stringify({
                daily_question_goal: 50,
                weekly_question_goal: 300,
                session_duration_minutes: 60,
                study_hours_per_day: studyHours,
                has_essay: false,
                reta_final_mode: false
            })
        });
        
        console.log('✅ Configurações salvas com sucesso'.green);
        console.log(`   Total horas semanais: ${Object.values(studyHours).reduce((a,b) => a+b, 0)}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao configurar horas:'.red, error.message);
        return false;
    }
}

// 5. Testar geração de cronograma
async function testGenerateSchedule() {
    console.log('\n📋 TESTE 5: Gerar cronograma'.yellow);
    
    try {
        const studyHours = {
            monday: 2,
            tuesday: 2,
            wednesday: 3,
            thursday: 2,
            friday: 3,
            saturday: 4,
            sunday: 4
        };
        
        console.log('   Enviando configurações de geração...');
        
        const response = await makeRequest(`/api/plans/${planId}/generate`, {
            method: 'POST',
            body: JSON.stringify({
                daily_question_goal: 50,
                weekly_question_goal: 300,
                session_duration_minutes: 60,
                study_hours_per_day: studyHours,
                has_essay: false,
                reta_final_mode: false
            })
        });
        
        console.log('✅ Cronograma gerado com sucesso'.green);
        console.log(`   Mensagem: ${response.message}`);
        console.log(`   Sessões criadas: ${response.statistics?.totalSessions || response.performance?.sessionsCreated}`);
        console.log(`   Tempo de geração: ${response.performance?.executionTime || response.generationTime}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao gerar cronograma:'.red, error.message);
        return false;
    }
}

// 6. Verificar sessões criadas
async function testVerifySessions() {
    console.log('\n📋 TESTE 6: Verificar sessões criadas'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/schedule`);
        
        console.log('✅ Sessões recuperadas com sucesso'.green);
        console.log(`   Total de sessões: ${response.length}`);
        
        if (response.length > 0) {
            console.log("Primeira sessão:");
            console.log(`     - Data: ${response[0].session_date}`);
            console.log(`     - Disciplina: ${response[0].subject_name}`);
            console.log(`     - Status: ${response[0].status}`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao verificar sessões:'.red, error.message);
        return false;
    }
}

// Executar todos os testes
async function runAllTests() {
    console.log('========================================'.cyan);
    console.log('    TESTE COMPLETO DO SISTEMA CORRIGIDO'.cyan);
    console.log('========================================'.cyan);
    
    const results = {
        login: false,
        plan: false,
        subject: false,
        settings: false,
        schedule: false,
        sessions: false
    };
    
    // Executar testes em sequência
    results.login = await testLogin();
    if (!results.login) {
        console.log('\n❌ Teste abortado: falha no login'.red);
        return;
    }
    
    results.plan = await testGetOrCreatePlan();
    if (!results.plan) {
        console.log('\n❌ Teste abortado: falha ao obter/criar plano'.red);
        return;
    }
    
    results.subject = await testCreateSubjectWithTopics();
    results.settings = await testConfigureStudyHours();
    results.schedule = await testGenerateSchedule();
    results.sessions = await testVerifySessions();
    
    // Resumo dos resultados
    console.log('\n========================================'.cyan);
    console.log('           RESUMO DOS TESTES'.cyan);
    console.log('========================================'.cyan);
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? '✅ PASSOU'.green : '❌ FALHOU'.red;
        console.log(`${test.padEnd(15)} : ${status}`);
    });
    
    console.log('\n----------------------------------------');
    console.log(`Total: ${passed}/${total} testes passaram`.yellow);
    
    if (passed === total) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema funcionando corretamente.'.green.bold);
    } else {
        console.log('\n⚠️  Alguns testes falharam. Verifique os logs acima.'.red.bold);
    }
}

// Executar
console.log('Iniciando testes em 2 segundos...');
console.log('Certifique-se de que o servidor está rodando na porta 3000\n');

setTimeout(() => {
    runAllTests().catch(error => {
        console.error('Erro fatal:'.red, error);
    });
}, 2000);