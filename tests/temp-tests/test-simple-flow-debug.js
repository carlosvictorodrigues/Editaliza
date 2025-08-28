/**
 * TESTE SIMPLES DE DEBUG - FOCO NOS PROBLEMAS ESPECÍFICOS
 * 
 * Teste isolado para identificar e corrigir os erros específicos:
 * 1. plan_name vs name
 * 2. exam_date formato
 * 3. Rotas corretas da API
 */

const axios = require('axios');

// Configurações
const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Cliente HTTP
const client = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

let authToken = null;
let userId = null;
let planId = null;

// Interceptor para adicionar token
client.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

function log(message, type = 'info') {
    const colors = {
        success: '\x1b[32m✅',
        error: '\x1b[31m❌',
        info: '\x1b[34mℹ️',
        test: '\x1b[35m🧪',
        reset: '\x1b[0m'
    };
    
    console.log(`${colors[type]} ${message}${colors.reset}`);
}

async function test1_CreateUser() {
    log('=== TESTE 1: CRIAÇÃO DE USUÁRIO ===');
    
    const testUser = {
        email: `test_debug_${Date.now()}@editaliza.com`,
        password: 'Test@123456',
        name: 'Teste Debug',
        phone: '11999999999'
    };
    
    try {
        log('Criando usuário...', 'test');
        const response = await client.post('/api/auth/register', testUser);
        
        if (response.status === 201 && response.data.token) {
            authToken = response.data.token;
            userId = response.data.user.id;
            log(`Usuário criado! ID: ${userId}`, 'success');
            return true;
        } else {
            log(`Resposta inesperada: ${response.status}`, 'error');
            console.log('Response data:', response.data);
            return false;
        }
    } catch (error) {
        log(`Erro: ${error.response?.data?.message || error.message}`, 'error');
        console.log('Error details:', error.response?.data || error.message);
        return false;
    }
}

async function test2_CreatePlan() {
    log('=== TESTE 2: CRIAÇÃO DE PLANO ===');
    
    try {
        log('Criando plano com parâmetros corretos...', 'test');
        
        // Data em formato YYYY-MM-DD
        const examDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const planData = {
            plan_name: 'Plano de Teste - Debug',
            description: 'Teste para verificar criação de plano',
            exam_date: examDate,
            daily_study_hours: 4
        };
        
        log(`Dados do plano:`, 'info');
        console.log(JSON.stringify(planData, null, 2));
        
        const response = await client.post('/api/plans', planData);
        
        if (response.status === 201) {
            planId = response.data.newPlanId || response.data.id || response.data.plan_id;
            log(`Plano criado! ID: ${planId}`, 'success');
            return true;
        } else {
            log(`Status inesperado: ${response.status}`, 'error');
            console.log('Response data:', response.data);
            return false;
        }
    } catch (error) {
        log(`Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'error');
        console.log('Error response:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.log('Validation details:', error.response.data.details);
        }
        return false;
    }
}

async function test3_CreateSubject() {
    log('=== TESTE 3: CRIAÇÃO DE DISCIPLINA ===');
    
    if (!planId) {
        log('Plano não foi criado, pulando teste', 'error');
        return false;
    }
    
    try {
        log('Criando disciplina...', 'test');
        
        const subjectData = {
            subject_name: 'Matemática',
            priority_weight: 5,
            topics_list: 'Álgebra\nGeometria\nTrigonometria'
        };
        
        log(`Dados da disciplina:`, 'info');
        console.log(JSON.stringify(subjectData, null, 2));
        
        const response = await client.post(`/api/plans/${planId}/subjects_with_topics`, subjectData);
        
        if (response.status === 201) {
            log('Disciplina criada com sucesso!', 'success');
            console.log('Response:', response.data);
            return true;
        } else {
            log(`Status inesperado: ${response.status}`, 'error');
            console.log('Response data:', response.data);
            return false;
        }
    } catch (error) {
        log(`Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'error');
        console.log('Error response:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.log('Validation details:', error.response.data.details);
        }
        return false;
    }
}

async function test4_GenerateSchedule() {
    log('=== TESTE 4: GERAÇÃO DE CRONOGRAMA ===');
    
    if (!planId) {
        log('Plano não foi criado, pulando teste', 'error');
        return false;
    }
    
    try {
        log('Gerando cronograma...', 'test');
        
        const scheduleData = {
            daily_question_goal: 50,
            weekly_question_goal: 350,
            session_duration_minutes: 50,
            study_hours_per_day: {
                monday: 4,
                tuesday: 4,
                wednesday: 4,
                thursday: 4,
                friday: 4,
                saturday: 0,
                sunday: 0
            },
            has_essay: false,
            reta_final_mode: false
        };
        
        log(`Dados do cronograma:`, 'info');
        console.log(JSON.stringify(scheduleData, null, 2));
        
        const response = await client.post(`/api/plans/${planId}/generate`, scheduleData);
        
        if (response.status === 200 || response.status === 201) {
            log('Cronograma gerado com sucesso!', 'success');
            console.log('Response:', response.data);
            return true;
        } else {
            log(`Status inesperado: ${response.status}`, 'error');
            console.log('Response data:', response.data);
            return false;
        }
    } catch (error) {
        log(`Erro: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'error');
        console.log('Error response:', error.response?.data || error.message);
        if (error.response?.data?.details) {
            console.log('Validation details:', error.response.data.details);
        }
        return false;
    }
}

async function runTests() {
    console.log('\n🧪 TESTE SIMPLES DE DEBUG - VERIFICAR PROBLEMAS ESPECÍFICOS\n');
    
    const results = [];
    
    // Teste 1: Criar usuário
    const test1Result = await test1_CreateUser();
    results.push({ name: 'Criar Usuário', passed: test1Result });
    
    if (!test1Result) {
        log('Parando testes - falha na criação de usuário', 'error');
        return;
    }
    
    // Teste 2: Criar plano
    const test2Result = await test2_CreatePlan();
    results.push({ name: 'Criar Plano', passed: test2Result });
    
    // Teste 3: Criar disciplina
    const test3Result = await test3_CreateSubject();
    results.push({ name: 'Criar Disciplina', passed: test3Result });
    
    // Teste 4: Gerar cronograma
    const test4Result = await test4_GenerateSchedule();
    results.push({ name: 'Gerar Cronograma', passed: test4Result });
    
    // Relatório
    console.log('\n📊 RELATÓRIO DE RESULTADOS:');
    console.log('=' * 40);
    
    results.forEach((result, index) => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} Teste ${index + 1}: ${result.name}`);
    });
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    console.log(`\nResumo: ${passed}/${total} testes passaram`);
}

// Verificar se servidor está rodando
async function checkServer() {
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        return response.status === 200;
    } catch {
        return false;
    }
}

// Executar
(async () => {
    const serverOnline = await checkServer();
    
    if (!serverOnline) {
        console.log('❌ Servidor não está respondendo');
        console.log('Por favor, inicie o servidor com: npm start');
        process.exit(1);
    }
    
    console.log('✅ Servidor online!');
    await runTests();
})();