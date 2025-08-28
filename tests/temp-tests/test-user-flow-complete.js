#!/usr/bin/env node

/**
 * TESTE COMPLETO DO FLUXO DE USUÁRIO - SISTEMA EDITALIZA
 * Este script simula um usuário real usando o sistema do início ao fim
 */

const axios = require('axios');
const colors = require('colors/safe');

// Configuração
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    email: `test_${Date.now()}@editaliza.com`,
    password: 'Test@2024!',
    name: 'Usuário Teste Completo'
};

// Cliente HTTP configurado
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Variáveis globais para armazenar dados do teste
let authToken = null;
let csrfToken = null;
let userId = null;
let planId = null;
let sessionIds = [];
let stats = {
    passed: 0,
    failed: 0,
    steps: []
};

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});

// Funções auxiliares
function logStep(step, success, details = '') {
    const status = success ? '✅' : '❌';
    const color = success ? colors.green : colors.red;
    console.log(color(`${status} ${step}`));
    if (details) console.log(colors.gray(`   ${details}`));
    
    stats.steps.push({ step, success, details });
    if (success) stats.passed++;
    else stats.failed++;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ETAPA 1: CRIAR CONTA E LOGIN
async function testAccountCreation() {
    console.log(colors.cyan('\n🔹 ETAPA 1: CRIAR CONTA E LOGIN\n'));
    
    try {
        // Obter CSRF token
        const csrfRes = await api.get('/api/auth/csrf-token');
        csrfToken = csrfRes.data.csrfToken;
        logStep('Obter CSRF token', true, `Token: ${csrfToken.substring(0, 10)}...`);
        
        // Registrar usuário
        const registerRes = await api.post('/api/auth/register', {
            ...TEST_USER,
            confirmPassword: TEST_USER.password
        });
        logStep('Criar conta de usuário', true, `Email: ${TEST_USER.email}`);
        
        // Fazer login
        const loginRes = await api.post('/api/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        authToken = loginRes.data.token;
        userId = loginRes.data.user.id;
        logStep('Fazer login', true, `User ID: ${userId}, Token recebido`);
        
        // Verificar acesso a rota protegida
        const meRes = await api.get('/api/auth/me');
        logStep('Acessar rota protegida', true, `Usuário: ${meRes.data.user.name}`);
        
        return true;
    } catch (error) {
        logStep('Criar conta/login', false, error.message);
        return false;
    }
}

// ETAPA 2: CRIAR PLANO DE ESTUDOS
async function testPlanCreation() {
    console.log(colors.cyan('\n🔹 ETAPA 2: CRIAR PLANO DE ESTUDOS\n'));
    
    try {
        // Criar plano base
        const planRes = await api.post('/api/plans', {
            plan_name: 'Plano Teste Completo - Concurso TRF',
            exam_date: '2025-06-15',
            daily_question_goal: 30,
            weekly_question_goal: 150
        });
        
        planId = planRes.data.newPlanId || planRes.data.planId || planRes.data.id;
        logStep('Criar plano de estudos', true, `Plan ID: ${planId}`);
        
        // Adicionar disciplinas e tópicos
        const subjects = [
            {
                name: 'Português',
                weight: 3,
                topics: [
                    { name: 'Ortografia e Acentuação', priority: 'alta' },
                    { name: 'Concordância Verbal', priority: 'alta' },
                    { name: 'Interpretação de Texto', priority: 'media' }
                ]
            },
            {
                name: 'Matemática',
                weight: 2,
                topics: [
                    { name: 'Raciocínio Lógico', priority: 'alta' },
                    { name: 'Porcentagem', priority: 'media' },
                    { name: 'Regra de Três', priority: 'baixa' }
                ]
            },
            {
                name: 'Direito Constitucional',
                weight: 4,
                topics: [
                    { name: 'Direitos Fundamentais', priority: 'alta' },
                    { name: 'Organização do Estado', priority: 'alta' },
                    { name: 'Processo Legislativo', priority: 'media' }
                ]
            }
        ];
        
        for (const subject of subjects) {
            // Adicionar disciplina
            const subjectRes = await api.post('/api/subjects', {
                plan_id: planId,
                subject_name: subject.name,
                weight: subject.weight
            });
            
            const subjectId = subjectRes.data.id || subjectRes.data.subjectId;
            logStep(`Adicionar disciplina: ${subject.name}`, true, `Weight: ${subject.weight}`);
            
            // Adicionar tópicos
            for (const topic of subject.topics) {
                await api.post('/api/topics', {
                    subject_id: subjectId,
                    topic_name: topic.name,
                    priority: topic.priority,
                    complexity: 'medio',
                    estimated_hours: 10
                });
                logStep(`  - Tópico: ${topic.name}`, true, `Prioridade: ${topic.priority}`);
            }
        }
        
        return true;
    } catch (error) {
        logStep('Criar plano/disciplinas', false, error.response?.data?.error || error.message);
        return false;
    }
}

// ETAPA 3: GERAR CRONOGRAMA
async function testScheduleGeneration() {
    console.log(colors.cyan('\n🔹 ETAPA 3: GERAR CRONOGRAMA\n'));
    
    if (!planId) {
        logStep('Gerar cronograma', false, 'Plan ID não disponível');
        return false;
    }
    
    try {
        // Gerar cronograma
        const generateRes = await api.post(`/api/plans/${planId}/generate`);
        
        logStep('Gerar cronograma', true, 
            `Sessões criadas: ${generateRes.data.sessionsCreated || 'múltiplas'}`);
        
        // Buscar sessões geradas
        const sessionsRes = await api.get(`/api/schedules?planId=${planId}`);
        sessionIds = sessionsRes.data.map(s => s.id).slice(0, 5); // Pegar primeiras 5
        
        logStep('Verificar sessões criadas', true, 
            `Total: ${sessionsRes.data.length} sessões`);
        
        return true;
    } catch (error) {
        logStep('Gerar cronograma', false, error.response?.data?.error || error.message);
        return false;
    }
}

// ETAPA 4: VERIFICAR INTERFACE
async function testInterfacePages() {
    console.log(colors.cyan('\n🔹 ETAPA 4: VERIFICAR INTERFACE (HOME E CRONOGRAMA)\n'));
    
    try {
        // Verificar home.html
        const homeRes = await api.get('/home.html', {
            headers: { 'Accept': 'text/html' }
        });
        
        const homeHasCards = homeRes.data.includes('card') || 
                            homeRes.data.includes('plano') ||
                            homeRes.data.includes('dashboard');
        
        logStep('Verificar home.html', homeHasCards, 
            `Tamanho: ${homeRes.data.length} bytes, Cards: ${homeHasCards ? 'Sim' : 'Não'}`);
        
        // Verificar cronograma.html
        const cronogramaRes = await api.get('/cronograma.html', {
            headers: { 'Accept': 'text/html' }
        });
        
        const cronogramaHasSchedule = cronogramaRes.data.includes('sessão') || 
                                      cronogramaRes.data.includes('cronograma') ||
                                      cronogramaRes.data.includes('calendar');
        
        logStep('Verificar cronograma.html', cronogramaHasSchedule, 
            `Tamanho: ${cronogramaRes.data.length} bytes, Cronograma: ${cronogramaHasSchedule ? 'Sim' : 'Não'}`);
        
        return homeHasCards && cronogramaHasSchedule;
    } catch (error) {
        logStep('Verificar interface', false, error.message);
        return false;
    }
}

// ETAPA 5: MARCAR SESSÕES COMO CONCLUÍDAS
async function testSessionCompletion() {
    console.log(colors.cyan('\n🔹 ETAPA 5: MARCAR SESSÕES COMO CONCLUÍDAS\n'));
    
    if (!sessionIds.length) {
        logStep('Marcar sessões', false, 'Nenhuma sessão disponível');
        return false;
    }
    
    try {
        let completedCount = 0;
        
        for (const sessionId of sessionIds.slice(0, 3)) {
            const completeRes = await api.patch(`/api/sessions/${sessionId}/complete`, {
                completed: true,
                performance: 85,
                notes: 'Sessão completada com sucesso'
            });
            
            completedCount++;
            logStep(`Marcar sessão ${sessionId} como concluída`, true, 
                `Performance: 85%`);
            
            await sleep(100); // Pequena pausa entre requisições
        }
        
        logStep('Total de sessões marcadas', true, `${completedCount}/3 concluídas`);
        
        return completedCount >= 3;
    } catch (error) {
        logStep('Marcar sessões como concluídas', false, 
            error.response?.data?.error || error.message);
        return false;
    }
}

// ETAPA 6: VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO
async function testStatisticsAndGamification() {
    console.log(colors.cyan('\n🔹 ETAPA 6: VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO\n'));
    
    try {
        // Buscar estatísticas do usuário
        const statsRes = await api.get('/api/stats/user');
        const stats = statsRes.data;
        
        logStep('Obter estatísticas do usuário', true, 
            `XP: ${stats.xp || 0}, Nível: ${stats.level || 1}`);
        
        // Verificar progresso
        const progressRes = await api.get(`/api/progress?planId=${planId}`);
        const progress = progressRes.data;
        
        logStep('Verificar progresso do plano', true, 
            `Conclusão: ${progress.percentage || 0}%`);
        
        // Verificar achievements
        const achievementsRes = await api.get('/api/achievements');
        const achievements = achievementsRes.data;
        
        logStep('Verificar conquistas', true, 
            `Total: ${achievements.length || 0} conquistas`);
        
        // Verificar gamificação funcionando
        const hasGamification = (stats.xp > 0) || 
                               (progress.percentage > 0) || 
                               (achievements.length > 0);
        
        logStep('Sistema de gamificação', hasGamification, 
            hasGamification ? 'Funcionando' : 'Não detectado');
        
        return true;
    } catch (error) {
        // Gamificação pode não estar totalmente implementada
        logStep('Estatísticas/Gamificação', false, 
            'Endpoints não disponíveis ou erro: ' + error.message);
        return false;
    }
}

// EXECUTAR TESTE COMPLETO
async function runCompleteTest() {
    console.log(colors.yellow.bold('\n' + '='.repeat(60)));
    console.log(colors.yellow.bold('🚀 TESTE COMPLETO DO FLUXO DE USUÁRIO - EDITALIZA'));
    console.log(colors.yellow.bold('='.repeat(60)));
    console.log(colors.gray(`Servidor: ${BASE_URL}`));
    console.log(colors.gray(`Horário: ${new Date().toLocaleString('pt-BR')}`));
    
    // Executar todas as etapas
    const results = [];
    
    results.push(await testAccountCreation());
    results.push(await testPlanCreation());
    results.push(await testScheduleGeneration());
    results.push(await testInterfacePages());
    results.push(await testSessionCompletion());
    results.push(await testStatisticsAndGamification());
    
    // Relatório final
    console.log(colors.yellow.bold('\n' + '='.repeat(60)));
    console.log(colors.yellow.bold('📊 RELATÓRIO FINAL'));
    console.log(colors.yellow.bold('='.repeat(60)));
    
    const totalSteps = stats.passed + stats.failed;
    const successRate = ((stats.passed / totalSteps) * 100).toFixed(1);
    
    console.log(colors.cyan(`\n📈 Taxa de Sucesso: ${successRate}%`));
    console.log(colors.green(`✅ Passos bem-sucedidos: ${stats.passed}/${totalSteps}`));
    console.log(colors.red(`❌ Passos com falha: ${stats.failed}/${totalSteps}`));
    
    // Resumo por etapa
    console.log(colors.yellow('\n📋 Resumo por Etapa:'));
    const etapas = [
        'Criar conta e login',
        'Criar plano de estudos',
        'Gerar cronograma',
        'Verificar interface',
        'Marcar sessões concluídas',
        'Estatísticas e gamificação'
    ];
    
    results.forEach((result, index) => {
        const status = result ? colors.green('✅ PASSOU') : colors.red('❌ FALHOU');
        console.log(`  ${index + 1}. ${etapas[index]}: ${status}`);
    });
    
    // Dados criados
    console.log(colors.yellow('\n🗂️ Dados Criados no Teste:'));
    console.log(colors.gray(`  • Email: ${TEST_USER.email}`));
    console.log(colors.gray(`  • User ID: ${userId || 'N/A'}`));
    console.log(colors.gray(`  • Plan ID: ${planId || 'N/A'}`));
    console.log(colors.gray(`  • Sessões: ${sessionIds.length} criadas`));
    
    // Conclusão
    const allPassed = results.every(r => r === true);
    if (allPassed) {
        console.log(colors.green.bold('\n🎉 TESTE COMPLETO BEM-SUCEDIDO!'));
        console.log(colors.green('O sistema está funcionando perfeitamente de ponta a ponta!'));
    } else if (successRate >= 70) {
        console.log(colors.yellow.bold('\n⚠️ TESTE PARCIALMENTE BEM-SUCEDIDO'));
        console.log(colors.yellow('O sistema está funcional mas alguns recursos precisam de ajustes.'));
    } else {
        console.log(colors.red.bold('\n❌ TESTE FALHOU'));
        console.log(colors.red('O sistema apresenta problemas críticos que precisam ser corrigidos.'));
    }
    
    console.log(colors.yellow.bold('\n' + '='.repeat(60) + '\n'));
}

// Executar teste
runCompleteTest().catch(error => {
    console.error(colors.red.bold('\n❌ ERRO FATAL NO TESTE:'), error.message);
    process.exit(1);
});