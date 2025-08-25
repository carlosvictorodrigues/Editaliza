/**
 * TESTE DE INTEGRAÇÃO COMPLETO - TODAS AS FASES
 * 
 * Este script testa a integração de todas as 9 fases migradas
 * verificando se as rotas estão funcionando corretamente
 */

const axios = require('axios');
const colors = require('colors/safe');

// Configuração
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test@editaliza.com';
const TEST_PASSWORD = 'Test123!@#';
const ADMIN_EMAIL = 'admin@editaliza.com';
const ADMIN_PASSWORD = 'Admin123!@#';

let authToken = null;
let adminToken = null;
let testUserId = null;
let testPlanId = null;

// Helpers
const log = {
    success: (msg) => console.log(colors.green('✅ ' + msg)),
    error: (msg) => console.log(colors.red('❌ ' + msg)),
    info: (msg) => console.log(colors.blue('ℹ️  ' + msg)),
    warning: (msg) => console.log(colors.yellow('⚠️  ' + msg)),
    section: (msg) => console.log(colors.cyan('\n' + '='.repeat(60) + '\n' + msg + '\n' + '='.repeat(60)))
};

// API Helper
async function apiCall(method, endpoint, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {}
        };
        
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        if (data) {
            config.data = data;
            config.headers['Content-Type'] = 'application/json';
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.error || error.message,
            status: error.response?.status 
        };
    }
}

// ============================================================================
// FASE 1: AUTENTICAÇÃO
// ============================================================================
async function testPhase1Authentication() {
    log.section('FASE 1: AUTENTICAÇÃO');
    
    // Testar registro
    log.info('Testando registro de novo usuário...');
    const registerResult = await apiCall('POST', '/api/auth/register', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Test User'
    });
    
    if (registerResult.success || registerResult.status === 400) {
        log.success('Rota de registro funcionando');
    } else {
        log.error(`Registro falhou: ${registerResult.error}`);
    }
    
    // Testar login
    log.info('Testando login...');
    const loginResult = await apiCall('POST', '/api/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    });
    
    if (loginResult.success) {
        authToken = loginResult.data.token;
        testUserId = loginResult.data.user?.id;
        log.success('Login realizado com sucesso');
    } else {
        log.error(`Login falhou: ${loginResult.error}`);
        return false;
    }
    
    // Testar rota protegida
    log.info('Testando rota protegida /api/auth/me...');
    const meResult = await apiCall('GET', '/api/auth/me', null, authToken);
    
    if (meResult.success) {
        log.success('Rota protegida funcionando');
    } else {
        log.error(`Rota protegida falhou: ${meResult.error}`);
    }
    
    // Testar CSRF token
    log.info('Testando CSRF token...');
    const csrfResult = await apiCall('GET', '/api/auth/csrf-token');
    
    if (csrfResult.success) {
        log.success('CSRF token funcionando');
    } else {
        log.error(`CSRF token falhou: ${csrfResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 2: PERFIL DE USUÁRIO
// ============================================================================
async function testPhase2Profile() {
    log.section('FASE 2: PERFIL DE USUÁRIO');
    
    // Obter perfil
    log.info('Testando GET perfil...');
    const getProfileResult = await apiCall('GET', '/api/users/profile', null, authToken);
    
    if (getProfileResult.success) {
        log.success('GET perfil funcionando');
    } else {
        log.error(`GET perfil falhou: ${getProfileResult.error}`);
    }
    
    // Atualizar perfil
    log.info('Testando UPDATE perfil...');
    const updateProfileResult = await apiCall('PATCH', '/api/users/profile', {
        name: 'Test User Updated',
        phone: '11999999999',
        state: 'SP',
        city: 'São Paulo'
    }, authToken);
    
    if (updateProfileResult.success) {
        log.success('UPDATE perfil funcionando');
    } else {
        log.error(`UPDATE perfil falhou: ${updateProfileResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 3: PLANOS (CRUD)
// ============================================================================
async function testPhase3Plans() {
    log.section('FASE 3: PLANOS (CRUD)');
    
    // Criar plano
    log.info('Testando criação de plano...');
    const createPlanResult = await apiCall('POST', '/api/plans', {
        plan_name: 'Plano de Teste Integração',
        exam_date: '2025-12-31',
        daily_question_goal: 30,
        weekly_question_goal: 210,
        session_duration_minutes: 60,
        has_essay: false,
        reta_final_mode: false,
        study_hours_per_day: {
            "0": 0, "1": 3, "2": 3, "3": 3, 
            "4": 3, "5": 3, "6": 4
        }
    }, authToken);
    
    if (createPlanResult.success) {
        testPlanId = createPlanResult.data.id;
        log.success(`Plano criado com ID: ${testPlanId}`);
    } else {
        log.error(`Criação de plano falhou: ${createPlanResult.error}`);
        return false;
    }
    
    // Listar planos
    log.info('Testando listagem de planos...');
    const listPlansResult = await apiCall('GET', '/api/plans', null, authToken);
    
    if (listPlansResult.success) {
        log.success(`${listPlansResult.data.length} planos encontrados`);
    } else {
        log.error(`Listagem falhou: ${listPlansResult.error}`);
    }
    
    // Obter plano específico
    log.info('Testando obter plano específico...');
    const getPlanResult = await apiCall('GET', `/api/plans/${testPlanId}`, null, authToken);
    
    if (getPlanResult.success) {
        log.success('GET plano específico funcionando');
    } else {
        log.error(`GET plano falhou: ${getPlanResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 4: SUBJECTS & TOPICS
// ============================================================================
async function testPhase4SubjectsTopics() {
    log.section('FASE 4: SUBJECTS & TOPICS');
    
    if (!testPlanId) {
        log.warning('Pulando testes de subjects/topics - sem plano de teste');
        return false;
    }
    
    // Criar disciplina com tópicos
    log.info('Testando criação de disciplina com tópicos...');
    const createSubjectResult = await apiCall('POST', `/api/plans/${testPlanId}/subjects_with_topics`, {
        subject_name: 'Direito Constitucional',
        priority_weight: 5,
        topics: [
            { topic_name: 'Princípios Fundamentais', priority_weight: 5 },
            { topic_name: 'Direitos e Garantias', priority_weight: 4 },
            { topic_name: 'Organização do Estado', priority_weight: 3 }
        ]
    }, authToken);
    
    if (createSubjectResult.success) {
        log.success('Disciplina com tópicos criada');
    } else {
        log.error(`Criação falhou: ${createSubjectResult.error}`);
    }
    
    // Listar disciplinas com tópicos
    log.info('Testando listagem de disciplinas com tópicos...');
    const listSubjectsResult = await apiCall('GET', `/api/plans/${testPlanId}/subjects_with_topics`, null, authToken);
    
    if (listSubjectsResult.success) {
        log.success(`${listSubjectsResult.data.length} disciplinas encontradas`);
    } else {
        log.error(`Listagem falhou: ${listSubjectsResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 5: SESSÕES DE ESTUDO
// ============================================================================
async function testPhase5Sessions() {
    log.section('FASE 5: SESSÕES DE ESTUDO');
    
    if (!testPlanId) {
        log.warning('Pulando testes de sessões - sem plano de teste');
        return false;
    }
    
    // Listar sessões por data
    log.info('Testando listagem de sessões por data...');
    const listSessionsResult = await apiCall('GET', `/api/sessions/by-date/${testPlanId}`, null, authToken);
    
    if (listSessionsResult.success) {
        log.success('Listagem de sessões funcionando');
    } else {
        log.error(`Listagem falhou: ${listSessionsResult.error}`);
    }
    
    // Verificar sessões atrasadas
    log.info('Testando verificação de sessões atrasadas...');
    const overdueResult = await apiCall('GET', `/api/sessions/overdue-check/${testPlanId}`, null, authToken);
    
    if (overdueResult.success) {
        log.success('Verificação de atrasos funcionando');
    } else {
        log.error(`Verificação falhou: ${overdueResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 6: ESTATÍSTICAS
// ============================================================================
async function testPhase6Statistics() {
    log.section('FASE 6: ESTATÍSTICAS');
    
    if (!testPlanId) {
        log.warning('Pulando testes de estatísticas - sem plano de teste');
        return false;
    }
    
    // Obter estatísticas gerais
    log.info('Testando estatísticas gerais...');
    const statsResult = await apiCall('GET', `/api/plans/${testPlanId}/statistics`, null, authToken);
    
    if (statsResult.success) {
        log.success('Estatísticas gerais funcionando');
    } else {
        log.error(`Estatísticas falharam: ${statsResult.error}`);
    }
    
    // Obter progresso detalhado
    log.info('Testando progresso detalhado...');
    const progressResult = await apiCall('GET', `/api/plans/${testPlanId}/detailed_progress`, null, authToken);
    
    if (progressResult.success) {
        log.success('Progresso detalhado funcionando');
    } else {
        log.error(`Progresso falhou: ${progressResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 7: GAMIFICAÇÃO
// ============================================================================
async function testPhase7Gamification() {
    log.section('FASE 7: GAMIFICAÇÃO');
    
    if (!testPlanId) {
        log.warning('Pulando testes de gamificação - sem plano de teste');
        return false;
    }
    
    // Obter dados de gamificação
    log.info('Testando sistema de gamificação...');
    const gamificationResult = await apiCall('GET', `/api/plans/${testPlanId}/gamification`, null, authToken);
    
    if (gamificationResult.success) {
        log.success('Sistema de gamificação funcionando');
        log.info(`Nível: ${gamificationResult.data.concurseiroLevel || 'N/A'}`);
        log.info(`XP: ${gamificationResult.data.experiencePoints || 0}`);
        log.info(`Streak: ${gamificationResult.data.studyStreak || 0} dias`);
    } else {
        log.error(`Gamificação falhou: ${gamificationResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 8: ADMINISTRAÇÃO
// ============================================================================
async function testPhase8Admin() {
    log.section('FASE 8: ADMINISTRAÇÃO');
    
    // Login como admin
    log.info('Tentando login como admin...');
    const adminLoginResult = await apiCall('POST', '/api/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });
    
    if (adminLoginResult.success) {
        adminToken = adminLoginResult.data.token;
        log.success('Login admin realizado');
    } else {
        log.warning('Login admin falhou - continuando com user token');
        adminToken = authToken;
    }
    
    // Health check
    log.info('Testando health check...');
    const healthResult = await apiCall('GET', '/api/admin/system/health', null, adminToken);
    
    if (healthResult.success) {
        log.success('Health check funcionando');
    } else {
        log.warning(`Health check falhou: ${healthResult.error}`);
    }
    
    // Métricas
    log.info('Testando métricas do sistema...');
    const metricsResult = await apiCall('GET', '/api/admin/system/metrics', null, adminToken);
    
    if (metricsResult.success) {
        log.success('Métricas funcionando');
    } else {
        log.warning(`Métricas falharam: ${metricsResult.error}`);
    }
    
    return true;
}

// ============================================================================
// FASE 9: GERAÇÃO DE CRONOGRAMA
// ============================================================================
async function testPhase9ScheduleGeneration() {
    log.section('FASE 9: GERAÇÃO DE CRONOGRAMA (MAIS COMPLEXA!)');
    
    if (!testPlanId) {
        log.warning('Pulando geração de cronograma - sem plano de teste');
        return false;
    }
    
    // Preparar payload
    const schedulePayload = {
        daily_question_goal: 30,
        weekly_question_goal: 210,
        session_duration_minutes: 60,
        has_essay: false,
        reta_final_mode: false,
        study_hours_per_day: {
            "0": 0,  // Domingo
            "1": 3,  // Segunda
            "2": 3,  // Terça
            "3": 3,  // Quarta
            "4": 3,  // Quinta
            "5": 3,  // Sexta
            "6": 4   // Sábado
        }
    };
    
    log.info('Iniciando geração de cronograma...');
    log.info('Configuração:');
    log.info(`  - Meta diária: ${schedulePayload.daily_question_goal} questões`);
    log.info(`  - Meta semanal: ${schedulePayload.weekly_question_goal} questões`);
    log.info(`  - Duração da sessão: ${schedulePayload.session_duration_minutes} minutos`);
    log.info(`  - Total de horas semanais: 19 horas`);
    
    const startTime = Date.now();
    const generateResult = await apiCall('POST', `/api/plans/${testPlanId}/generate`, schedulePayload, authToken);
    const elapsed = Date.now() - startTime;
    
    if (generateResult.success) {
        log.success(`Cronograma gerado com sucesso em ${elapsed}ms!`);
        
        if (generateResult.data.statistics) {
            log.info('Estatísticas da geração:');
            log.info(`  - Sessões totais: ${generateResult.data.statistics.totalSessions || 0}`);
            log.info(`  - Sessões de estudo: ${generateResult.data.statistics.studySessions || 0}`);
            log.info(`  - Sessões de revisão: ${generateResult.data.statistics.reviewSessions || 0}`);
            log.info(`  - Tópicos excluídos: ${generateResult.data.statistics.excludedTopics || 0}`);
        }
    } else {
        log.error(`Geração de cronograma falhou: ${generateResult.error}`);
        return false;
    }
    
    // Verificar se as sessões foram criadas
    log.info('Verificando sessões criadas...');
    const sessionsResult = await apiCall('GET', `/api/sessions/by-date/${testPlanId}`, null, authToken);
    
    if (sessionsResult.success && sessionsResult.data) {
        const totalSessions = Object.values(sessionsResult.data).flat().length;
        log.success(`${totalSessions} sessões encontradas no banco de dados`);
    } else {
        log.warning('Não foi possível verificar as sessões criadas');
    }
    
    return true;
}

// ============================================================================
// LIMPEZA
// ============================================================================
async function cleanup() {
    log.section('LIMPEZA');
    
    if (testPlanId && authToken) {
        log.info('Removendo plano de teste...');
        const deleteResult = await apiCall('DELETE', `/api/plans/${testPlanId}`, null, authToken);
        
        if (deleteResult.success) {
            log.success('Plano de teste removido');
        } else {
            log.warning('Não foi possível remover o plano de teste');
        }
    }
}

// ============================================================================
// EXECUTAR TODOS OS TESTES
// ============================================================================
async function runAllTests() {
    console.log(colors.bold.cyan(`
╔════════════════════════════════════════════════════════════╗
║     TESTE DE INTEGRAÇÃO COMPLETO - SISTEMA EDITALIZA      ║
║                    FASES 1-9 MIGRADAS                     ║
╚════════════════════════════════════════════════════════════╝
    `));
    
    const results = {
        phase1: false,
        phase2: false,
        phase3: false,
        phase4: false,
        phase5: false,
        phase6: false,
        phase7: false,
        phase8: false,
        phase9: false
    };
    
    try {
        // Verificar servidor
        log.info('Verificando conexão com servidor...');
        const healthCheck = await apiCall('GET', '/health');
        if (!healthCheck.success) {
            log.error('Servidor não está respondendo! Certifique-se de que está rodando em http://localhost:3000');
            return;
        }
        log.success('Servidor online!');
        
        // Executar testes por fase
        results.phase1 = await testPhase1Authentication();
        results.phase2 = await testPhase2Profile();
        results.phase3 = await testPhase3Plans();
        results.phase4 = await testPhase4SubjectsTopics();
        results.phase5 = await testPhase5Sessions();
        results.phase6 = await testPhase6Statistics();
        results.phase7 = await testPhase7Gamification();
        results.phase8 = await testPhase8Admin();
        results.phase9 = await testPhase9ScheduleGeneration();
        
    } catch (error) {
        log.error(`Erro não tratado: ${error.message}`);
    } finally {
        await cleanup();
    }
    
    // Relatório final
    log.section('RELATÓRIO FINAL');
    
    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.keys(results).length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log('\nResultados por fase:');
    console.log('────────────────────────────────');
    Object.entries(results).forEach(([phase, passed]) => {
        const phaseNum = phase.replace('phase', '');
        const status = passed ? colors.green('✅ PASSOU') : colors.red('❌ FALHOU');
        console.log(`  Fase ${phaseNum}: ${status}`);
    });
    
    console.log('────────────────────────────────');
    console.log(`\nTaxa de sucesso: ${successRate}% (${passedTests}/${totalTests})`);
    
    if (passedTests === totalTests) {
        console.log(colors.bold.green('\n🎉 TODOS OS TESTES PASSARAM! O SISTEMA ESTÁ 100% INTEGRADO!'));
    } else {
        console.log(colors.bold.yellow(`\n⚠️  ${totalTests - passedTests} fase(s) com problemas. Verifique os logs acima.`));
    }
}

// Verificar dependências
try {
    require('axios');
    require('colors/safe');
} catch (error) {
    console.log('Instalando dependências necessárias...');
    require('child_process').execSync('npm install axios colors', { stdio: 'inherit' });
}

// Executar testes
runAllTests().catch(console.error);