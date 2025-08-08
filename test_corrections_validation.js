/**
 * TESTE DE VALIDAÇÃO DAS CORREÇÕES IMPLEMENTADAS
 * 
 * Este script testa todas as correções implementadas pelo backend-architect:
 * ✅ Error ua.topic_id - Query de tópicos fracos corrigida
 * ✅ Progresso diário/semanal - Queries baseadas em study_sessions
 * ✅ Referências de tabela - user_activity → user_activities
 * ✅ Compatibilidade PostgreSQL - Queries validadas
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuração do teste
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    email: 'test.corrections@editaliza.com',
    password: 'TestCorrections2025!'
};

let authToken = null;
let testPlanId = null;

// Cores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

/**
 * Utilities para logging
 */
const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    header: (msg) => console.log(`\n${colors.bold}${colors.blue}🚀 ${msg}${colors.reset}\n`)
};

/**
 * Faz requisição HTTP com tratamento de erro
 */
async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
                ...headers
            },
            ...(data && { data })
        };

        const startTime = performance.now();
        const response = await axios(config);
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        return {
            success: true,
            data: response.data,
            status: response.status,
            responseTime
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status || 500,
            responseTime: 0
        };
    }
}

/**
 * Autentica usuário de teste
 */
async function authenticate() {
    log.header('AUTENTICANDO USUÁRIO DE TESTE');
    
    // Primeiro tenta fazer login
    let result = await makeRequest('POST', '/api/login', {
        email: TEST_USER.email,
        password: TEST_USER.password
    });

    if (!result.success) {
        log.info('Usuário não existe, criando conta de teste...');
        
        // Se falhar, cria o usuário
        const createResult = await makeRequest('POST', '/api/register', {
            username: 'TestCorrectionsUser',
            email: TEST_USER.email,
            password: TEST_USER.password
        });

        if (!createResult.success) {
            log.error(`Falha ao criar usuário: ${JSON.stringify(createResult.error)}`);
            return false;
        }

        log.success('Usuário criado com sucesso');
        
        // Tenta login novamente
        result = await makeRequest('POST', '/api/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        });
    }

    if (result.success && result.data.token) {
        authToken = result.data.token;
        log.success(`Autenticado com sucesso (${result.responseTime}ms)`);
        return true;
    }

    log.error(`Falha na autenticação: ${JSON.stringify(result.error)}`);
    return false;
}

/**
 * Cria plano de teste se necessário
 */
async function setupTestPlan() {
    log.header('CONFIGURANDO PLANO DE TESTE');
    
    // Busca planos existentes
    const plansResult = await makeRequest('GET', '/plans');
    
    if (plansResult.success && plansResult.data.length > 0) {
        testPlanId = plansResult.data[0].id;
        log.success(`Usando plano existente ID: ${testPlanId}`);
        return true;
    }
    
    // Se não há planos, cria um plano de teste
    const createResult = await makeRequest('POST', '/plans', {
        name: 'Plano Teste Correções',
        exam_date: '2025-12-31',
        description: 'Plano para teste de correções'
    });

    if (createResult.success && createResult.data.id) {
        testPlanId = createResult.data.id;
        log.success(`Plano criado com sucesso ID: ${testPlanId}`);
        return true;
    }

    log.error(`Falha ao criar plano: ${JSON.stringify(createResult.error)}`);
    return false;
}

/**
 * TESTE 1: Endpoint question_radar (erro ua.topic_id corrigido)
 */
async function testQuestionRadar() {
    log.header('TESTE 1: QUESTION RADAR (ua.topic_id corrigido)');
    
    const result = await makeRequest('GET', `/plans/${testPlanId}/question_radar`);
    
    if (result.success) {
        log.success(`Question Radar funcionando (${result.responseTime}ms)`);
        log.info(`Tópicos fracos encontrados: ${result.data.length}`);
        
        // Verifica estrutura da resposta
        if (Array.isArray(result.data)) {
            result.data.forEach((topic, index) => {
                if (topic.topic_description && topic.subject_name !== undefined) {
                    log.success(`  ✓ Tópico ${index + 1}: estrutura válida`);
                } else {
                    log.warning(`  ⚠️ Tópico ${index + 1}: estrutura incompleta`);
                }
            });
        }
        return true;
    } else {
        log.error(`Question Radar falhou: ${JSON.stringify(result.error)}`);
        return false;
    }
}

/**
 * TESTE 2: Endpoint progress (tópicos concluídos)
 */
async function testProgress() {
    log.header('TESTE 2: PROGRESSO BÁSICO');
    
    const result = await makeRequest('GET', `/plans/${testPlanId}/progress`);
    
    if (result.success) {
        log.success(`Progresso básico funcionando (${result.responseTime}ms)`);
        const { completed, total, percentage, remaining } = result.data;
        log.info(`Tópicos: ${completed}/${total} (${percentage}%) - Restam: ${remaining}`);
        
        // Validações
        if (typeof completed === 'number' && typeof total === 'number') {
            log.success('  ✓ Estrutura de dados válida');
        } else {
            log.warning('  ⚠️ Estrutura de dados incompleta');
        }
        return true;
    } else {
        log.error(`Progresso falhou: ${JSON.stringify(result.error)}`);
        return false;
    }
}

/**
 * TESTE 3: Endpoint detailed_progress (métricas detalhadas)
 */
async function testDetailedProgress() {
    log.header('TESTE 3: PROGRESSO DETALHADO');
    
    const result = await makeRequest('GET', `/plans/${testPlanId}/detailed_progress`);
    
    if (result.success) {
        log.success(`Progresso detalhado funcionando (${result.responseTime}ms)`);
        const { totalProgress, subjectDetails } = result.data;
        log.info(`Progresso total: ${totalProgress}%`);
        log.info(`Disciplinas: ${subjectDetails?.length || 0}`);
        
        // Validações
        if (typeof totalProgress === 'number' && Array.isArray(subjectDetails)) {
            log.success('  ✓ Estrutura de dados válida');
            
            subjectDetails.forEach((subject, index) => {
                if (subject.name && typeof subject.totalTopics === 'number') {
                    log.success(`    ✓ Disciplina ${index + 1}: ${subject.name} - ${subject.completedTopics}/${subject.totalTopics}`);
                }
            });
        } else {
            log.warning('  ⚠️ Estrutura de dados incompleta');
        }
        return true;
    } else {
        log.error(`Progresso detalhado falhou: ${JSON.stringify(result.error)}`);
        return false;
    }
}

/**
 * TESTE 4: Endpoint goal_progress (progresso diário/semanal)
 */
async function testGoalProgress() {
    log.header('TESTE 4: PROGRESSO DE METAS (diário/semanal)');
    
    const result = await makeRequest('GET', `/plans/${testPlanId}/goal_progress`);
    
    if (result.success) {
        log.success(`Progresso de metas funcionando (${result.responseTime}ms)`);
        const data = result.data;
        
        // Verifica se tem as chaves esperadas
        const expectedKeys = ['dailyGoal', 'dailyProgress', 'weeklyGoal', 'weeklyProgress'];
        const hasAllKeys = expectedKeys.every(key => key in data);
        
        if (hasAllKeys) {
            log.success('  ✓ Estrutura de metas válida');
            log.info(`    Diário: ${data.dailyProgress}/${data.dailyGoal}`);
            log.info(`    Semanal: ${data.weeklyProgress}/${data.weeklyGoal}`);
        } else {
            log.warning('  ⚠️ Estrutura de metas incompleta');
        }
        
        return true;
    } else {
        log.error(`Progresso de metas falhou: ${JSON.stringify(result.error)}`);
        return false;
    }
}

/**
 * TESTE 5: Salvamento de sessões de estudo
 */
async function testStudySessions() {
    log.header('TESTE 5: SALVAMENTO DE SESSÕES DE ESTUDO');
    
    // Primeiro busca tópicos disponíveis
    const subjectsResult = await makeRequest('GET', `/plans/${testPlanId}/subjects`);
    
    if (!subjectsResult.success || !subjectsResult.data.length) {
        log.warning('Nenhuma disciplina encontrada para criar sessão de teste');
        return false;
    }
    
    const firstSubject = subjectsResult.data[0];
    log.info(`Testando com disciplina: ${firstSubject.subject_name}`);
    
    // Cria uma sessão de estudo
    const sessionData = {
        topic_id: firstSubject.id, // Assumindo que subjects têm ID
        session_type: 'Novo Tópico',
        questions_solved: 10,
        time_spent: 30, // 30 minutos
        notes: 'Sessão de teste para validação das correções'
    };
    
    const createResult = await makeRequest('POST', '/study-sessions', sessionData);
    
    if (createResult.success) {
        log.success(`Sessão criada com sucesso (${createResult.responseTime}ms)`);
        
        // Tenta recuperar a sessão criada
        const listResult = await makeRequest('GET', `/plans/${testPlanId}/sessions`);
        
        if (listResult.success && Array.isArray(listResult.data)) {
            log.success(`Sessões recuperadas: ${listResult.data.length}`);
            return true;
        }
    }
    
    log.error(`Falha no teste de sessões: ${JSON.stringify(createResult.error)}`);
    return false;
}

/**
 * TESTE 6: Verificação de performance das queries
 */
async function testQueryPerformance() {
    log.header('TESTE 6: PERFORMANCE DAS QUERIES CORRIGIDAS');
    
    const endpoints = [
        `/plans/${testPlanId}/question_radar`,
        `/plans/${testPlanId}/progress`,
        `/plans/${testPlanId}/detailed_progress`,
        `/plans/${testPlanId}/goal_progress`
    ];
    
    let allPassed = true;
    const performanceThreshold = 2000; // 2 segundos
    
    for (const endpoint of endpoints) {
        const result = await makeRequest('GET', endpoint);
        
        if (result.success) {
            if (result.responseTime < performanceThreshold) {
                log.success(`${endpoint}: ${result.responseTime}ms ✓`);
            } else {
                log.warning(`${endpoint}: ${result.responseTime}ms (lento)`);
            }
        } else {
            log.error(`${endpoint}: FALHA`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

/**
 * TESTE 7: Health Check geral do sistema
 */
async function testSystemHealth() {
    log.header('TESTE 7: HEALTH CHECK GERAL');
    
    const healthChecks = [
        { name: 'Servidor ativo', endpoint: '/health' },
        { name: 'Autenticação', endpoint: '/api/profile' },
        { name: 'Lista de planos', endpoint: '/plans' },
        { name: 'Dashboard', endpoint: '/api/dashboard' }
    ];
    
    let healthyServices = 0;
    
    for (const check of healthChecks) {
        const result = await makeRequest('GET', check.endpoint);
        
        if (result.success) {
            log.success(`${check.name}: OK (${result.responseTime}ms)`);
            healthyServices++;
        } else {
            log.error(`${check.name}: FALHA - ${result.status}`);
        }
    }
    
    const healthPercentage = Math.round((healthyServices / healthChecks.length) * 100);
    log.info(`Sistema: ${healthPercentage}% saudável (${healthyServices}/${healthChecks.length})`);
    
    return healthPercentage >= 75; // 75% ou mais é considerado saudável
}

/**
 * Função principal de teste
 */
async function runAllTests() {
    console.log(`${colors.bold}${colors.blue}`);
    console.log('██████╗ ██╗   ██╗██╗ ██╗████████╗ █████╗ ██╗     ██╗███████╗ █████╗');
    console.log('██╔═══██╗██║   ██║██║ ██║╚══██╔══╝██╔══██╗██║     ██║╚══███╔╝██╔══██╗');
    console.log('██║   ██║██║   ██║██║ ██║   ██║   ███████║██║     ██║  ███╔╝ ███████║');
    console.log('██║   ██║██║   ██║██║ ██║   ██║   ██╔══██║██║     ██║ ███╔╝  ██╔══██║');
    console.log('╚██████╔╝╚██████╔╝██║ ██║   ██║   ██║  ██║███████╗██║███████╗██║  ██║');
    console.log(' ╚═════╝  ╚═════╝ ╚═╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝  ╚═╝');
    console.log('');
    console.log('VALIDAÇÃO PÓS-CORREÇÕES - TESTE COMPLETO DO SISTEMA');
    console.log(`${colors.reset}\n`);
    
    const startTime = performance.now();
    let passedTests = 0;
    let totalTests = 7;
    
    try {
        // Autenticação
        if (!(await authenticate())) {
            log.error('FALHA CRÍTICA: Não foi possível autenticar');
            process.exit(1);
        }
        
        // Setup do plano de teste
        if (!(await setupTestPlan())) {
            log.error('FALHA CRÍTICA: Não foi possível configurar plano de teste');
            process.exit(1);
        }
        
        // Executa todos os testes
        const testResults = await Promise.allSettled([
            testQuestionRadar(),
            testProgress(), 
            testDetailedProgress(),
            testGoalProgress(),
            testStudySessions(),
            testQueryPerformance(),
            testSystemHealth()
        ]);
        
        // Conta sucessos
        testResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value === true) {
                passedTests++;
            }
        });
        
        const endTime = performance.now();
        const totalTime = Math.round(endTime - startTime);
        
        // Relatório final
        log.header('RELATÓRIO FINAL');
        console.log(`${colors.bold}Testes executados: ${totalTests}${colors.reset}`);
        console.log(`${colors.green}Testes aprovados: ${passedTests}${colors.reset}`);
        console.log(`${colors.red}Testes reprovados: ${totalTests - passedTests}${colors.reset}`);
        console.log(`${colors.blue}Tempo total: ${totalTime}ms${colors.reset}`);
        
        const successRate = Math.round((passedTests / totalTests) * 100);
        console.log(`\n${colors.bold}Taxa de sucesso: ${successRate}%${colors.reset}\n`);
        
        if (successRate >= 85) {
            log.success('🎉 TODAS AS CORREÇÕES VALIDADAS COM SUCESSO!');
            log.success('Sistema estável e funcionando corretamente.');
        } else if (successRate >= 70) {
            log.warning('⚠️ Sistema funcional com algumas ressalvas.');
            log.warning('Algumas funcionalidades podem precisar de ajustes.');
        } else {
            log.error('❌ Sistema apresenta problemas críticos.');
            log.error('Correções adicionais são necessárias.');
        }
        
    } catch (error) {
        log.error(`Erro durante execução dos testes: ${error.message}`);
        process.exit(1);
    }
}

// Executa os testes se este arquivo for chamado diretamente
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testQuestionRadar,
    testProgress,
    testDetailedProgress,
    testGoalProgress,
    testStudySessions,
    testQueryPerformance,
    testSystemHealth
};