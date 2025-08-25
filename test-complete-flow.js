#!/usr/bin/env node

/**
 * Script para testar o fluxo completo do sistema
 * Cria usuário, faz login, cria plano e testa funcionalidades
 */

const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    email: `test_${Date.now()}@example.com`,
    password: 'Test123456!',
    name: 'Usuário Teste'
};

let authToken = null;
let userId = null;
let planId = null;
let csrfToken = null;

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.error(`${colors.red}❌${colors.reset} ${msg}`),
    step: (msg) => console.log(`\n${colors.magenta}▶${colors.reset} ${msg}`)
};

// Cliente HTTP configurado
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para adicionar token e CSRF
api.interceptors.request.use(config => {
    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});

// Interceptor para logging
api.interceptors.response.use(
    response => {
        log.success(`${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
    },
    error => {
        const status = error.response?.status || 'NETWORK ERROR';
        const message = error.response?.data?.error || error.message;
        log.error(`${error.config.method.toUpperCase()} ${error.config.url} - ${status}: ${message}`);
        return Promise.reject(error);
    }
);

async function getCsrfToken() {
    log.step('Obtendo CSRF Token...');
    
    try {
        const response = await api.get('/api/auth/csrf-token');
        csrfToken = response.data.csrfToken;
        log.success(`CSRF Token obtido: ${csrfToken.substring(0, 20)}...`);
        return true;
    } catch (error) {
        log.warning('CSRF token não disponível - continuando sem ele');
        return true; // Continuar mesmo sem CSRF em desenvolvimento
    }
}

async function testHealthCheck() {
    log.step('Testando Health Check...');
    
    try {
        const response = await api.get('/health');
        log.success(`Servidor online: ${response.data.status || 'OK'}`);
        log.info(`Versão: ${response.data.version}`);
        log.info(`Uptime: ${response.data.uptime}s`);
        return true;
    } catch (error) {
        log.error('Servidor offline!');
        return false;
    }
}

async function testRegistration() {
    log.step('Testando Registro de Usuário...');
    
    try {
        const response = await api.post('/api/auth/register', {
            email: TEST_USER.email,
            password: TEST_USER.password,
            name: TEST_USER.name
        });
        
        if (response.data.token) {
            authToken = response.data.token;
            userId = response.data.user?.id;
            log.success(`Usuário registrado: ${TEST_USER.email}`);
            log.info(`Token recebido: ${authToken.substring(0, 20)}...`);
            return true;
        }
        
        log.warning('Registro sem token - tentando login');
        return false;
        
    } catch (error) {
        if (error.response?.data?.error?.includes('já cadastrado')) {
            log.warning('Usuário já existe - tentando login');
            return false;
        }
        throw error;
    }
}

async function testLogin() {
    log.step('Testando Login...');
    
    try {
        const response = await api.post('/api/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
        
        authToken = response.data.token;
        userId = response.data.user?.id;
        
        log.success('Login realizado com sucesso');
        log.info(`User ID: ${userId}`);
        log.info(`Token: ${authToken.substring(0, 20)}...`);
        return true;
        
    } catch (error) {
        log.error('Falha no login');
        return false;
    }
}

async function testProfile() {
    log.step('Testando Perfil de Usuário...');
    
    try {
        const response = await api.get('/api/users/profile');
        
        log.success('Perfil carregado');
        log.info(`Nome: ${response.data.name}`);
        log.info(`Email: ${response.data.email}`);
        log.info(`ID: ${response.data.id}`);
        
        // Atualizar perfil
        const updateResponse = await api.patch('/api/users/profile', {
            institution: 'Universidade Teste',
            education_level: 'Superior Completo',
            study_area: 'Tecnologia'
        });
        
        log.success('Perfil atualizado');
        return true;
        
    } catch (error) {
        log.error('Falha ao acessar perfil');
        return false;
    }
}

async function testCreatePlan() {
    log.step('Criando Plano de Estudos...');
    
    try {
        const examDate = new Date();
        examDate.setMonth(examDate.getMonth() + 6); // 6 meses no futuro
        
        const response = await api.post('/api/plans', {
            plan_name: 'Concurso Teste 2025',
            exam_date: examDate.toISOString().split('T')[0],
            daily_study_hours: 3,
            days_per_week: 5,
            notification_time: '08:00',
            daily_question_goal: 50,
            weekly_question_goal: 250,
            has_essay: true,
            essay_frequency: 'weekly'
        });
        
        planId = response.data.id || response.data.plan?.id;
        
        log.success(`Plano criado com ID: ${planId}`);
        log.info(`Nome: Concurso Teste 2025`);
        log.info(`Data da prova: ${examDate.toLocaleDateString()}`);
        return true;
        
    } catch (error) {
        log.error('Falha ao criar plano');
        return false;
    }
}

async function testAddSubjectsAndTopics() {
    log.step('Adicionando Disciplinas e Tópicos...');
    
    if (!planId) {
        log.error('Plan ID não encontrado');
        return false;
    }
    
    try {
        // Criar disciplinas com tópicos
        const subjects = [
            {
                subject_name: 'Português',
                priority: 1,
                topics: [
                    { name: 'Ortografia', priority_level: 1, total_questions: 100 },
                    { name: 'Gramática', priority_level: 1, total_questions: 150 },
                    { name: 'Interpretação de Texto', priority_level: 2, total_questions: 200 }
                ]
            },
            {
                subject_name: 'Matemática',
                priority: 2,
                topics: [
                    { name: 'Álgebra', priority_level: 1, total_questions: 120 },
                    { name: 'Geometria', priority_level: 2, total_questions: 80 },
                    { name: 'Estatística', priority_level: 3, total_questions: 100 }
                ]
            },
            {
                subject_name: 'Informática',
                priority: 3,
                topics: [
                    { name: 'Hardware', priority_level: 2, total_questions: 50 },
                    { name: 'Software', priority_level: 1, total_questions: 75 },
                    { name: 'Redes', priority_level: 3, total_questions: 60 }
                ]
            }
        ];
        
        for (const subject of subjects) {
            const response = await api.post(`/api/plans/${planId}/subjects_with_topics`, subject);
            log.success(`Disciplina criada: ${subject.subject_name} com ${subject.topics.length} tópicos`);
        }
        
        return true;
        
    } catch (error) {
        log.error('Falha ao adicionar disciplinas');
        return false;
    }
}

async function testGenerateSchedule() {
    log.step('Gerando Cronograma de Estudos...');
    
    if (!planId) {
        log.error('Plan ID não encontrado');
        return false;
    }
    
    try {
        // Configurar horários de estudo
        const studyHours = {
            monday: { start: '08:00', end: '11:00' },
            tuesday: { start: '08:00', end: '11:00' },
            wednesday: { start: '08:00', end: '11:00' },
            thursday: { start: '08:00', end: '11:00' },
            friday: { start: '08:00', end: '11:00' },
            saturday: { start: '09:00', end: '12:00' },
            sunday: null
        };
        
        const response = await api.post(`/api/plans/${planId}/generate`, {
            daily_question_goal: 50,
            weekly_question_goal: 250,
            session_duration_minutes: 60,
            has_essay: true,
            reta_final_mode: false,
            study_hours_per_day: studyHours
        });
        
        log.success('Cronograma gerado com sucesso!');
        log.info(`Sessões criadas: ${response.data.performance?.sessionsCreated || 'N/A'}`);
        log.info(`Tópicos processados: ${response.data.performance?.topicsProcessed || 'N/A'}`);
        log.info(`Mensagem: ${response.data.message}`);
        
        return true;
        
    } catch (error) {
        log.error('Falha ao gerar cronograma');
        return false;
    }
}

async function testGetSessions() {
    log.step('Verificando Sessões de Estudo...');
    
    if (!planId) {
        log.error('Plan ID não encontrado');
        return false;
    }
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.get(`/api/sessions/by-date/${planId}`, {
            params: { date: today }
        });
        
        const sessions = response.data.sessions || response.data;
        log.success(`${sessions.length} sessões encontradas para hoje`);
        
        if (sessions.length > 0) {
            sessions.slice(0, 3).forEach(session => {
                log.info(`- ${session.subject_name}: ${session.topic_name} (${session.duration_minutes}min)`);
            });
        }
        
        return true;
        
    } catch (error) {
        log.error('Falha ao buscar sessões');
        return false;
    }
}

async function testStatistics() {
    log.step('Testando Estatísticas...');
    
    if (!planId) {
        log.error('Plan ID não encontrado');
        return false;
    }
    
    try {
        const response = await api.get(`/api/plans/${planId}/statistics`);
        
        log.success('Estatísticas carregadas');
        log.info(`Total de tópicos: ${response.data.total_topics || 0}`);
        log.info(`Tópicos completados: ${response.data.completed_topics || 0}`);
        log.info(`Progresso geral: ${response.data.overall_progress || 0}%`);
        log.info(`Streak atual: ${response.data.current_streak || 0} dias`);
        
        return true;
        
    } catch (error) {
        log.error('Falha ao buscar estatísticas');
        return false;
    }
}

async function testGamification() {
    log.step('Testando Gamificação...');
    
    if (!planId) {
        log.error('Plan ID não encontrado');
        return false;
    }
    
    try {
        const response = await api.get(`/api/plans/${planId}/gamification`);
        
        log.success('Dados de gamificação carregados');
        log.info(`Nível atual: ${response.data.concurseiroLevel || 'Iniciante'}`);
        log.info(`XP: ${response.data.experiencePoints || 0}`);
        log.info(`Conquistas: ${response.data.achievements?.length || 0}`);
        log.info(`Streak: ${response.data.studyStreak || 0} dias`);
        
        return true;
        
    } catch (error) {
        log.error('Falha ao buscar gamificação');
        return false;
    }
}

async function testCleanup() {
    log.step('Limpando dados de teste...');
    
    try {
        if (planId) {
            await api.delete(`/api/plans/${planId}`);
            log.success('Plano de teste removido');
        }
        
        // Nota: Não podemos deletar o usuário via API normalmente
        log.info(`Usuário de teste criado: ${TEST_USER.email}`);
        log.warning('Remova manualmente se necessário');
        
        return true;
        
    } catch (error) {
        log.warning('Limpeza parcial - alguns dados podem permanecer');
        return true;
    }
}

async function runCompleteFlow() {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}🧪 TESTE COMPLETO DO SISTEMA EDITALIZA${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    const tests = [
        { name: 'Health Check', fn: testHealthCheck, critical: true },
        { name: 'CSRF Token', fn: getCsrfToken, critical: false },
        { name: 'Registro', fn: testRegistration, critical: false },
        { name: 'Login', fn: testLogin, critical: true },
        { name: 'Perfil', fn: testProfile, critical: false },
        { name: 'Criar Plano', fn: testCreatePlan, critical: true },
        { name: 'Adicionar Disciplinas', fn: testAddSubjectsAndTopics, critical: true },
        { name: 'Gerar Cronograma', fn: testGenerateSchedule, critical: false },
        { name: 'Buscar Sessões', fn: testGetSessions, critical: false },
        { name: 'Estatísticas', fn: testStatistics, critical: false },
        { name: 'Gamificação', fn: testGamification, critical: false },
        { name: 'Limpeza', fn: testCleanup, critical: false }
    ];
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            
            if (result) {
                passed++;
            } else if (test.critical) {
                failed++;
                log.error(`Teste crítico falhou: ${test.name}`);
                break;
            } else {
                failed++;
            }
            
        } catch (error) {
            failed++;
            log.error(`Erro no teste ${test.name}: ${error.message}`);
            
            if (test.critical) {
                log.error('Teste crítico falhou - abortando');
                break;
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.magenta}📊 RESULTADO DOS TESTES${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`⏭️ Pulado: ${skipped}`);
    
    const total = passed + failed;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
    
    console.log(`\n📈 Taxa de sucesso: ${percentage}%`);
    
    if (percentage >= 80) {
        console.log(`\n${colors.green}🎉 SISTEMA FUNCIONANDO ADEQUADAMENTE!${colors.reset}`);
    } else if (percentage >= 50) {
        console.log(`\n${colors.yellow}⚠️ SISTEMA PARCIALMENTE FUNCIONAL${colors.reset}`);
    } else {
        console.log(`\n${colors.red}❌ SISTEMA COM PROBLEMAS CRÍTICOS${colors.reset}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Informações do teste
    if (authToken) {
        console.log('📝 Informações do Teste:');
        console.log(`  Email: ${TEST_USER.email}`);
        console.log(`  Senha: ${TEST_USER.password}`);
        console.log(`  Token: ${authToken.substring(0, 30)}...`);
        console.log(`  User ID: ${userId}`);
        console.log(`  Plan ID: ${planId}`);
    }
}

// Executar testes
runCompleteFlow().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});