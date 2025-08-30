/**
 * TESTE COMPLETO DO SISTEMA CORRIGIDO
 * Testa toda a funcionalidade principal do Editaliza
 */

const colors = require('colors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3001';
let authToken = null;
let userId = null;
let planId = null;
let subjectId = null;

// Função auxiliar para requisições HTTP
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

// TESTE 1: Login
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
        console.log(`   User ID: ${userId}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro no login:'.red, error.message);
        return false;
    }
}

// TESTE 2: Criar plano de estudos
async function testCreatePlan() {
    console.log('\n📋 TESTE 2: Criar plano de estudos'.yellow);
    
    try {
        const response = await makeRequest('/api/plans', {
            method: 'POST',
            body: JSON.stringify({
                plan_name: 'Concurso Federal - Teste Sistema',
                exam_date: '2025-12-31'
            })
        });
        
        // Procurar o ID em diferentes lugares da resposta
        planId = response.id || response.planId || response.plan_id;
        
        if (!planId && response.message) {
            // Se não retornou ID, buscar planos para pegar o último criado
            const plans = await makeRequest('/api/plans');
            if (plans && plans.length > 0) {
                planId = plans[0].id;
            }
        }
        
        console.log('✅ Plano criado com sucesso'.green);
        console.log(`   Plan ID: ${planId}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar plano:'.red, error.message);
        return false;
    }
}

// TESTE 3: Criar disciplina com tópicos
async function testCreateSubject() {
    console.log('\n📋 TESTE 3: Criar disciplina com tópicos'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/subjects_with_topics`, {
            method: 'POST',
            body: JSON.stringify({
                subject_name: 'Português',
                priority_weight: 5,
                topics_list: 'Interpretação de Texto\nGramática\nRedação\nOrtografia\nSintaxe'
            })
        });
        
        subjectId = response.subjectId;
        
        console.log('✅ Disciplina criada com sucesso'.green);
        console.log(`   Subject ID: ${subjectId}`);
        console.log(`   Tópicos criados: ${response.topicIds?.length || 'N/A'}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar disciplina:'.red, error.message);
        return false;
    }
}

// TESTE 4: Criar segunda disciplina
async function testCreateSecondSubject() {
    console.log('\n📋 TESTE 4: Criar segunda disciplina'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/subjects_with_topics`, {
            method: 'POST',
            body: JSON.stringify({
                subject_name: 'Matemática',
                priority_weight: 4,
                topics_list: 'Álgebra\nGeometria\nTrigonometria\nEstatística\nProbabilidade'
            })
        });
        
        console.log('✅ Segunda disciplina criada'.green);
        console.log(`   Subject ID: ${response.subjectId}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao criar segunda disciplina:'.red, error.message);
        return false;
    }
}

// TESTE 5: Configurar plano
async function testConfigurePlan() {
    console.log('\n📋 TESTE 5: Configurar plano de estudos'.yellow);
    
    try {
        // Formato correto: índices numéricos (0=domingo, 1=segunda, etc)
        const studyHours = {
            '0': 4,  // Domingo
            '1': 2,  // Segunda
            '2': 2,  // Terça
            '3': 3,  // Quarta
            '4': 2,  // Quinta
            '5': 3,  // Sexta
            '6': 4   // Sábado
        };
        
        const response = await makeRequest(`/api/plans/${planId}/settings`, {
            method: 'PUT',
            body: JSON.stringify({
                daily_question_goal: 50,
                weekly_question_goal: 350,
                session_duration_minutes: 60,
                study_hours_per_day: studyHours,
                has_essay: false,
                reta_final_mode: false
            })
        });
        
        console.log('✅ Configurações salvas'.green);
        console.log(`   Total horas semanais: ${Object.values(studyHours).reduce((a,b) => a+b, 0)}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao configurar:'.red, error.message);
        return false;
    }
}

// TESTE 6: Gerar cronograma
async function testGenerateSchedule() {
    console.log('\n📋 TESTE 6: Gerar cronograma'.yellow);
    
    try {
        // Formato correto para generateSchedule
        const studyHours = {
            '0': 4,  // Domingo
            '1': 2,  // Segunda
            '2': 2,  // Terça
            '3': 3,  // Quarta
            '4': 2,  // Quinta
            '5': 3,  // Sexta
            '6': 4   // Sábado
        };
        
        const response = await makeRequest(`/api/plans/${planId}/generate`, {
            method: 'POST',
            body: JSON.stringify({
                daily_question_goal: 50,
                weekly_question_goal: 350,
                session_duration_minutes: 60,
                study_hours_per_day: studyHours,
                has_essay: false,
                reta_final_mode: false
            })
        });
        
        console.log('✅ Cronograma gerado com sucesso'.green);
        console.log(`   Sessões criadas: ${response.statistics?.totalSessions || response.performance?.sessionsCreated || 'N/A'}`);
        console.log(`   Mensagem: ${response.message}`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao gerar cronograma:'.red, error.message);
        return false;
    }
}

// TESTE 7: Verificar sessões
async function testGetSessions() {
    console.log('\n📋 TESTE 7: Verificar sessões criadas'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/schedule`);
        
        console.log('✅ Sessões recuperadas'.green);
        console.log(`   Total: ${response.length} sessões`);
        
        if (response.length > 0) {
            const firstSession = response[0];
            console.log("Primeira sessão:");
            console.log(`     - Data: ${firstSession.session_date}`);
            console.log(`     - Disciplina: ${firstSession.subject_name || 'N/A'}`);
            console.log(`     - Status: ${firstSession.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao buscar sessões:'.red, error.message);
        return false;
    }
}

// TESTE 8: Estatísticas
async function testGetStatistics() {
    console.log('\n📋 TESTE 8: Obter estatísticas'.yellow);
    
    try {
        const response = await makeRequest(`/api/plans/${planId}/statistics`);
        
        console.log('✅ Estatísticas obtidas'.green);
        console.log(`   Total de horas: ${response.totalHours || 0}`);
        console.log(`   Sessões completas: ${response.completedSessions || 0}`);
        console.log(`   Taxa de conclusão: ${response.completionRate || 0}%`);
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:'.red, error.message);
        return false;
    }
}

// Executar todos os testes
async function runAllTests() {
    console.log('========================================'.cyan);
    console.log('    TESTE COMPLETO DO SISTEMA'.cyan);
    console.log('========================================'.cyan);
    
    const results = [];
    
    // Executar testes em sequência
    results.push({ name: 'Login', passed: await testLogin() });
    if (!results[0].passed) {
        console.log('\n❌ Abortando: falha no login'.red);
        return;
    }
    
    results.push({ name: 'Criar Plano', passed: await testCreatePlan() });
    if (!results[1].passed) {
        console.log('\n❌ Abortando: falha ao criar plano'.red);
        return;
    }
    
    results.push({ name: 'Criar Disciplina 1', passed: await testCreateSubject() });
    results.push({ name: 'Criar Disciplina 2', passed: await testCreateSecondSubject() });
    results.push({ name: 'Configurar Plano', passed: await testConfigurePlan() });
    results.push({ name: 'Gerar Cronograma', passed: await testGenerateSchedule() });
    results.push({ name: 'Verificar Sessões', passed: await testGetSessions() });
    results.push({ name: 'Estatísticas', passed: await testGetStatistics() });
    
    // Resumo
    console.log('\n========================================'.cyan);
    console.log('           RESUMO DOS TESTES'.cyan);
    console.log('========================================'.cyan);
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    results.forEach(result => {
        const status = result.passed ? '✅ PASSOU'.green : '❌ FALHOU'.red;
        console.log(`${result.name.padEnd(20)} : ${status}`);
    });
    
    console.log('\n----------------------------------------');
    console.log(`Total: ${passed}/${total} testes passaram`.yellow);
    
    if (passed === total) {
        console.log('\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!'.green.bold);
        console.log('✅ Todos os componentes estão operacionais'.green);
    } else {
        console.log('\n⚠️  Alguns componentes precisam de correção'.red.bold);
    }
}

// Executar
console.log('Aguardando servidor inicializar...\n');
setTimeout(() => {
    runAllTests().catch(error => {
        console.error('Erro fatal:'.red, error);
    });
}, 2000);