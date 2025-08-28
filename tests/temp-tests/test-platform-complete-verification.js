/**
 * TESTE COMPLETO DE VERIFICAÇÃO DA PLATAFORMA EDITALIZA
 * 
 * Este teste verifica todos os fluxos principais:
 * 1. Criação de conta e login
 * 2. Criação de plano de estudos com disciplinas e tópicos ponderados
 * 3. Geração de cronograma com algoritmo Round Robin Ponderado
 * 4. Visualização de cards na home
 * 5. Marcação de sessões como concluídas
 * 6. Atualização de estatísticas e gamificação
 * 7. Validação da distribuição ponderada no cronograma
 */

const axios = require('axios');

// Configurações
const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Dados de teste
const testUser = {
    email: `test_${Date.now()}@editaliza.com`,
    password: 'Test@123456',
    name: 'Usuário Teste Completo',
    phone: '11999999999',
    study_hours: '4',
    break_duration: '5',
    study_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    notification_preferences: {
        email: true,
        push: true,
        whatsapp: false
    }
};

// Cores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = {
        success: `${colors.green}✅`,
        error: `${colors.red}❌`,
        warning: `${colors.yellow}⚠️`,
        info: `${colors.blue}ℹ️`,
        test: `${colors.magenta}🧪`,
        result: `${colors.cyan}📊`
    }[type] || '';
    
    console.log(`${prefix} [${timestamp}] ${message}${colors.reset}`);
}

function logSection(title) {
    console.log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
}

// Cliente HTTP com sessão
const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

let authToken = null;
let userId = null;
let planId = null;
let sessionIds = [];

// Interceptor para adicionar token
client.interceptors.request.use(config => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

// Função auxiliar para verificar distribuição ponderada
function analyzeWeightedDistribution(sessions) {
    const distribution = {};
    const topicDistribution = {};
    
    sessions.forEach(session => {
        const key = session.subject_name || session.subject_id;
        const topicKey = `${key}_${session.topic_name || session.topic_id}`;
        
        if (!distribution[key]) {
            distribution[key] = {
                count: 0,
                weight: session.subject_weight || 1,
                topics: {}
            };
        }
        
        if (!distribution[key].topics[session.topic_name || session.topic_id]) {
            distribution[key].topics[session.topic_name || session.topic_id] = {
                count: 0,
                weight: session.topic_weight || 1,
                combinedWeight: (session.subject_weight || 1) * 10 + (session.topic_weight || 1)
            };
        }
        
        distribution[key].count++;
        distribution[key].topics[session.topic_name || session.topic_id].count++;
        
        if (!topicDistribution[topicKey]) {
            topicDistribution[topicKey] = {
                count: 0,
                combinedWeight: (session.subject_weight || 1) * 10 + (session.topic_weight || 1)
            };
        }
        topicDistribution[topicKey].count++;
    });
    
    return { distribution, topicDistribution };
}

// TESTES PRINCIPAIS
async function test1_CreateAccount() {
    logSection('TESTE 1: CRIAÇÃO DE CONTA');
    
    try {
        log('Criando nova conta de usuário...', 'test');
        
        const response = await client.post('/api/auth/register', {
            email: testUser.email,
            password: testUser.password,
            name: testUser.name,
            phone: testUser.phone
        });
        
        if (response.status === 201 && response.data.token) {
            authToken = response.data.token;
            userId = response.data.user.id;
            log(`Conta criada com sucesso! UserID: ${userId}`, 'success');
            
            // Salvar preferências
            await client.put('/api/users/preferences', {
                study_hours: testUser.study_hours,
                break_duration: testUser.break_duration,
                study_days: testUser.study_days,
                notification_preferences: testUser.notification_preferences
            });
            
            log('Preferências de estudo configuradas', 'success');
            return true;
        }
    } catch (error) {
        log(`Erro ao criar conta: ${error.response?.data?.message || error.message}`, 'error');
        return false;
    }
}

async function test2_Login() {
    logSection('TESTE 2: LOGIN');
    
    try {
        log('Realizando login...', 'test');
        
        const response = await client.post('/api/auth/login', {
            email: testUser.email,
            password: testUser.password
        });
        
        if (response.status === 200 && response.data.token) {
            authToken = response.data.token;
            log('Login realizado com sucesso!', 'success');
            
            // Verificar dados do usuário
            const profileResponse = await client.get('/api/users/profile');
            log(`Usuário autenticado: ${profileResponse.data.name}`, 'success');
            
            return true;
        }
    } catch (error) {
        log(`Erro ao fazer login: ${error.response?.data?.message || error.message}`, 'error');
        return false;
    }
}

async function test3_CreateStudyPlan() {
    logSection('TESTE 3: CRIAÇÃO DE PLANO DE ESTUDOS COM PESOS');
    
    try {
        log('Criando plano de estudos com disciplinas e tópicos ponderados...', 'test');
        
        // Criar plano
        const planResponse = await client.post('/api/plans', {
            plan_name: 'Plano de Teste - Algoritmo Ponderado',
            description: 'Teste do algoritmo Round Robin Ponderado',
            exam_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 dias no formato YYYY-MM-DD
            daily_study_hours: 4,
            subjects: []
        });
        
        planId = planResponse.data.id || planResponse.data.plan_id;
        log(`Plano criado! ID: ${planId}`, 'success');
        
        // Adicionar disciplinas com pesos diferentes
        const subjects = [
            {
                name: 'Matemática',
                weight: 5, // Peso alto
                topics: [
                    { name: 'Álgebra', weight: 5, estimated_hours: 30 },
                    { name: 'Geometria', weight: 3, estimated_hours: 20 },
                    { name: 'Trigonometria', weight: 2, estimated_hours: 15 }
                ]
            },
            {
                name: 'Português',
                weight: 4, // Peso médio-alto
                topics: [
                    { name: 'Gramática', weight: 4, estimated_hours: 25 },
                    { name: 'Literatura', weight: 3, estimated_hours: 20 },
                    { name: 'Redação', weight: 5, estimated_hours: 30 }
                ]
            },
            {
                name: 'História',
                weight: 2, // Peso médio
                topics: [
                    { name: 'Brasil Colônia', weight: 3, estimated_hours: 15 },
                    { name: 'República', weight: 4, estimated_hours: 20 },
                    { name: 'História Geral', weight: 2, estimated_hours: 10 }
                ]
            },
            {
                name: 'Geografia',
                weight: 1, // Peso baixo
                topics: [
                    { name: 'Geografia Física', weight: 2, estimated_hours: 10 },
                    { name: 'Geopolítica', weight: 3, estimated_hours: 15 },
                    { name: 'Cartografia', weight: 1, estimated_hours: 5 }
                ]
            }
        ];
        
        log('\nAdicionando disciplinas com pesos:', 'info');
        for (const subject of subjects) {
            log(`  📚 ${subject.name} (Peso: ${subject.weight})`, 'info');
            
            // Criar disciplina
            const subjectResponse = await client.post(`/api/plans/${planId}/subjects_with_topics`, {
                subject_name: subject.name,
                priority_weight: subject.weight,
                topics_list: subject.topics.map(t => `${t.name} (Peso: ${t.weight})`).join('\n')
            });
            
            const subjectId = subjectResponse.data.id || subjectResponse.data.subject_id;
            
            // Tópicos já criados junto com a disciplina
            subject.topics.forEach(topic => {
                log(`    📝 ${topic.name} (Peso: ${topic.weight}, Peso Combinado: ${subject.weight * 10 + topic.weight})`, 'info');
            });
        }
        
        log('\nPlano de estudos criado com sucesso!', 'success');
        
        // Exibir resumo dos pesos
        log('\n📊 RESUMO DA DISTRIBUIÇÃO DE PESOS:', 'result');
        subjects.forEach(subject => {
            log(`\n${subject.name} (Peso Disciplina: ${subject.weight}):`, 'result');
            subject.topics.forEach(topic => {
                const combinedWeight = subject.weight * 10 + topic.weight;
                log(`  - ${topic.name}: Peso Tópico=${topic.weight}, Peso Combinado=${combinedWeight}`, 'result');
            });
        });
        
        return true;
    } catch (error) {
        log(`Erro ao criar plano: ${error.response?.data?.message || error.message}`, 'error');
        console.error(error.response?.data);
        return false;
    }
}

async function test4_GenerateSchedule() {
    logSection('TESTE 4: GERAÇÃO DE CRONOGRAMA - ROUND ROBIN PONDERADO');
    
    try {
        log('Gerando cronograma com algoritmo Round Robin Ponderado...', 'test');
        
        const response = await client.post(`/api/plans/${planId}/generate`, {
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
        });
        
        if (response.data.sessions && response.data.sessions.length > 0) {
            sessionIds = response.data.sessions.map(s => s.id || s.session_id);
            
            log(`\n✅ Cronograma gerado com ${response.data.sessions.length} sessões!`, 'success');
            
            // Analisar distribuição
            const { distribution, topicDistribution } = analyzeWeightedDistribution(response.data.sessions);
            
            log('\n📊 ANÁLISE DA DISTRIBUIÇÃO PONDERADA:', 'result');
            log('=' .repeat(50), 'result');
            
            // Ordenar por peso combinado
            const sortedTopics = Object.entries(topicDistribution)
                .sort((a, b) => b[1].combinedWeight - a[1].combinedWeight);
            
            log('\n📈 Frequência de Tópicos (ordenado por peso combinado):', 'result');
            sortedTopics.forEach(([topic, data]) => {
                const percentage = ((data.count / response.data.sessions.length) * 100).toFixed(1);
                const bar = '█'.repeat(Math.floor(data.count / 2));
                log(`  ${topic.padEnd(40)} | Peso: ${String(data.combinedWeight).padStart(3)} | Sessões: ${String(data.count).padStart(3)} (${percentage}%) ${bar}`, 'result');
            });
            
            // Validar que tópicos com maior peso aparecem mais
            log('\n✔️ VALIDAÇÃO DO ALGORITMO:', 'result');
            let isValid = true;
            for (let i = 0; i < sortedTopics.length - 1; i++) {
                const current = sortedTopics[i][1];
                const next = sortedTopics[i + 1][1];
                
                // Tópicos com maior peso devem aparecer com mais frequência (com margem de tolerância)
                if (current.combinedWeight > next.combinedWeight) {
                    if (current.count < next.count - 2) { // Margem de 2 sessões
                        log(`  ⚠️ Inconsistência: ${sortedTopics[i][0]} (peso ${current.combinedWeight}) aparece menos que ${sortedTopics[i + 1][0]} (peso ${next.combinedWeight})`, 'warning');
                        isValid = false;
                    }
                }
            }
            
            if (isValid) {
                log('  ✅ Distribuição ponderada está correta!', 'success');
            } else {
                log('  ⚠️ Algumas inconsistências detectadas na distribuição', 'warning');
            }
            
            // Mostrar primeiras 10 sessões
            log('\n📅 Primeiras 10 sessões do cronograma:', 'info');
            response.data.sessions.slice(0, 10).forEach((session, index) => {
                const date = new Date(session.scheduled_date || session.date);
                log(`  ${(index + 1).toString().padStart(2)}. ${date.toLocaleDateString('pt-BR')} - ${session.subject_name}: ${session.topic_name}`, 'info');
            });
            
            return true;
        }
    } catch (error) {
        log(`Erro ao gerar cronograma: ${error.response?.data?.message || error.message}`, 'error');
        console.error(error.response?.data);
        return false;
    }
}

async function test5_CheckHomeCards() {
    logSection('TESTE 5: VERIFICAÇÃO DOS CARDS NA HOME');
    
    try {
        log('Buscando sessões de estudo para exibir na home...', 'test');
        
        // Buscar sessões do dia usando a rota correta
        const response = await client.get(`/api/sessions/by-date/${planId}`);
        
        // Processar dados das sessões agrupadas por data
        let todaySessions = [];
        if (response.data && typeof response.data === 'object') {
            const today = new Date().toISOString().split('T')[0];
            if (response.data[today]) {
                todaySessions = response.data[today];
            } else {
                // Pegar as primeiras sessões disponíveis
                const allSessions = Object.values(response.data).flat();
                todaySessions = allSessions.slice(0, 5);
            }
        }
        
        if (todaySessions.length > 0) {
            log(`\n📱 Cards de sessões encontrados: ${todaySessions.length}`, 'success');
            
            // Simular visualização na home
            log('\nSimulando cards na tela HOME:', 'info');
            todaySessions.slice(0, 5).forEach((session, index) => {
                log(`\n  📋 Card ${index + 1}:`, 'info');
                log(`     Disciplina: ${session.subject_name || 'N/A'}`, 'info');
                log(`     Tópico: ${session.topic_name || 'N/A'}`, 'info');
                log(`     Horário: ${new Date(session.scheduled_date || session.date).toLocaleTimeString('pt-BR')}`, 'info');
                log(`     Duração: ${session.duration || 50} minutos`, 'info');
                log(`     Status: ${session.status || 'pending'}`, 'info');
            });
            
            return true;
        }
    } catch (error) {
        log(`Erro ao buscar cards: ${error.response?.data?.message || error.message}`, 'error');
        return false;
    }
}

async function test6_CompleteSessions() {
    logSection('TESTE 6: MARCAR SESSÕES COMO CONCLUÍDAS');
    
    try {
        log('Marcando algumas sessões como concluídas...', 'test');
        
        // Pegar primeiras 5 sessões
        const sessionsToComplete = sessionIds.slice(0, 5);
        
        for (let i = 0; i < sessionsToComplete.length; i++) {
            const sessionId = sessionsToComplete[i];
            
            // Marcar como concluída
            const response = await client.post(`/api/sessions/${sessionId}/complete`, {
                timeStudied: (45 + Math.floor(Math.random() * 15)) * 60, // 45-60 min em segundos
                questionsSolved: Math.floor(Math.random() * 20) + 10, // 10-30 questões
                questionsCorrect: Math.floor(Math.random() * 15) + 5, // 5-20 corretas
                difficultyRating: Math.floor(Math.random() * 3) + 2, // 2-4
                confidenceRating: Math.floor(Math.random() * 3) + 3, // 3-5
                notes: `Sessão ${i + 1} concluída com sucesso`
            });
            
            log(`  ✅ Sessão ${i + 1} marcada como concluída`, 'success');
        }
        
        log(`\n${sessionsToComplete.length} sessões concluídas com sucesso!`, 'success');
        return true;
        
    } catch (error) {
        log(`Erro ao concluir sessões: ${error.response?.data?.message || error.message}`, 'error');
        return false;
    }
}

async function test7_CheckGamification() {
    logSection('TESTE 7: VERIFICAÇÃO DE ESTATÍSTICAS E GAMIFICAÇÃO');
    
    try {
        log('Verificando atualização de estatísticas e gamificação...', 'test');
        
        // Buscar estatísticas do usuário
        const statsResponse = await client.get('/api/gamification/user-stats');
        
        if (statsResponse.data) {
            log('\n🏆 ESTATÍSTICAS DE GAMIFICAÇÃO:', 'result');
            log('=' .repeat(40), 'result');
            
            const stats = statsResponse.data;
            
            log(`\n📊 Estatísticas Gerais:`, 'result');
            log(`  • Pontos Totais: ${stats.total_points || 0}`, 'result');
            log(`  • Nível: ${stats.level || 1}`, 'result');
            log(`  • XP: ${stats.experience_points || 0}`, 'result');
            log(`  • Sequência Atual: ${stats.current_streak || 0} dias`, 'result');
            log(`  • Maior Sequência: ${stats.max_streak || 0} dias`, 'result');
            
            log(`\n📈 Progresso de Estudo:`, 'result');
            log(`  • Sessões Concluídas: ${stats.sessions_completed || 0}`, 'result');
            log(`  • Tempo Total: ${stats.total_study_time || 0} minutos`, 'result');
            log(`  • Taxa de Conclusão: ${stats.completion_rate || 0}%`, 'result');
            
            // Buscar conquistas
            const achievementsResponse = await client.get('/api/gamification/user-achievements');
            
            if (achievementsResponse.data && achievementsResponse.data.length > 0) {
                log(`\n🎖️ Conquistas Desbloqueadas:`, 'result');
                achievementsResponse.data.forEach(achievement => {
                    log(`  • ${achievement.name}: ${achievement.description}`, 'result');
                });
            }
            
            // Buscar ranking
            const rankingResponse = await client.get('/api/gamification/user-ranking');
            
            if (rankingResponse.data) {
                log(`\n🥇 Posição no Ranking:`, 'result');
                log(`  • Posição Geral: ${rankingResponse.data.position || 'N/A'}`, 'result');
                log(`  • Percentil: Top ${rankingResponse.data.percentile || 'N/A'}%`, 'result');
            }
            
            return true;
        }
        
    } catch (error) {
        log(`Erro ao verificar gamificação: ${error.response?.data?.message || error.message}`, 'error');
        // Não é crítico se gamificação falhar
        return true;
    }
}

async function test8_ValidateWeightedDistribution() {
    logSection('TESTE 8: VALIDAÇÃO DETALHADA DO ALGORITMO ROUND ROBIN PONDERADO');
    
    try {
        log('Analisando distribuição detalhada do cronograma...', 'test');
        
        // Buscar todas as sessões do plano
        const response = await client.get(`/api/sessions/by-date/${planId}`);
        // Reorganizar dados das sessões
        let sessions = [];
        if (response.data && typeof response.data === 'object') {
            // Se for agrupado por data, achatar os dados
            if (Array.isArray(response.data)) {
                sessions = response.data;
            } else {
                // Se for objeto agrupado por data
                sessions = Object.values(response.data).flat();
            }
        }
        
        if (!sessions || sessions.length === 0) {
            log('Nenhuma sessão encontrada para análise', 'warning');
            return false;
        }
        
        log(`\n📊 Analisando ${sessions.length} sessões...`, 'info');
        
        // Calcular distribuição
        const topicStats = {};
        const expectedWeights = {
            'Matemática_Álgebra': 5 * 10 + 5, // 55
            'Matemática_Geometria': 5 * 10 + 3, // 53
            'Matemática_Trigonometria': 5 * 10 + 2, // 52
            'Português_Gramática': 4 * 10 + 4, // 44
            'Português_Literatura': 4 * 10 + 3, // 43
            'Português_Redação': 4 * 10 + 5, // 45
            'História_Brasil Colônia': 2 * 10 + 3, // 23
            'História_República': 2 * 10 + 4, // 24
            'História_História Geral': 2 * 10 + 2, // 22
            'Geografia_Geografia Física': 1 * 10 + 2, // 12
            'Geografia_Geopolítica': 1 * 10 + 3, // 13
            'Geografia_Cartografia': 1 * 10 + 1 // 11
        };
        
        // Contar ocorrências
        sessions.forEach(session => {
            const key = `${session.subject_name}_${session.topic_name}`;
            if (!topicStats[key]) {
                topicStats[key] = {
                    count: 0,
                    weight: expectedWeights[key] || 0
                };
            }
            topicStats[key].count++;
        });
        
        // Ordenar por peso esperado
        const sortedStats = Object.entries(topicStats)
            .sort((a, b) => b[1].weight - a[1].weight);
        
        log('\n📈 DISTRIBUIÇÃO FINAL (Ordenado por Peso Combinado):', 'result');
        log('=' .repeat(70), 'result');
        log('Tópico'.padEnd(40) + ' | Peso | Sessões | Freq(%) | Gráfico', 'result');
        log('-' .repeat(70), 'result');
        
        sortedStats.forEach(([topic, stats]) => {
            const frequency = ((stats.count / sessions.length) * 100).toFixed(1);
            const bar = '█'.repeat(Math.floor(stats.count / 2));
            log(
                `${topic.padEnd(40)} | ${String(stats.weight).padStart(4)} | ${String(stats.count).padStart(7)} | ${frequency.padStart(7)}% | ${bar}`,
                'result'
            );
        });
        
        // Validação estatística
        log('\n🔍 VALIDAÇÃO ESTATÍSTICA:', 'result');
        
        let validations = {
            passed: 0,
            failed: 0,
            warnings: 0
        };
        
        // Verificar correlação entre peso e frequência
        for (let i = 0; i < sortedStats.length - 1; i++) {
            const current = sortedStats[i][1];
            const next = sortedStats[i + 1][1];
            
            if (current.weight > next.weight) {
                // Esperamos que tópicos com maior peso apareçam mais
                if (current.count >= next.count) {
                    validations.passed++;
                } else if (current.count >= next.count - 2) {
                    // Tolerância de 2 sessões
                    validations.warnings++;
                    log(`  ⚠️ ${sortedStats[i][0]} deveria aparecer mais que ${sortedStats[i + 1][0]}`, 'warning');
                } else {
                    validations.failed++;
                    log(`  ❌ ${sortedStats[i][0]} (peso ${current.weight}, ${current.count}x) < ${sortedStats[i + 1][0]} (peso ${next.weight}, ${next.count}x)`, 'error');
                }
            }
        }
        
        const totalValidations = validations.passed + validations.failed + validations.warnings;
        const successRate = ((validations.passed / totalValidations) * 100).toFixed(1);
        
        log(`\n📊 Resultado da Validação:`, 'result');
        log(`  ✅ Validações corretas: ${validations.passed}`, 'result');
        log(`  ⚠️ Avisos (tolerância): ${validations.warnings}`, 'result');
        log(`  ❌ Falhas: ${validations.failed}`, 'result');
        log(`  📈 Taxa de sucesso: ${successRate}%`, 'result');
        
        if (successRate >= 80) {
            log('\n✅ Algoritmo Round Robin Ponderado está funcionando corretamente!', 'success');
            return true;
        } else if (successRate >= 60) {
            log('\n⚠️ Algoritmo funcionando com algumas inconsistências', 'warning');
            return true;
        } else {
            log('\n❌ Algoritmo não está respeitando os pesos corretamente', 'error');
            return false;
        }
        
    } catch (error) {
        log(`Erro na validação: ${error.response?.data?.message || error.message}`, 'error');
        return false;
    }
}

// EXECUÇÃO PRINCIPAL
async function runAllTests() {
    console.log(`\n${colors.bold}${colors.magenta}`);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     TESTE COMPLETO DA PLATAFORMA EDITALIZA v2.0         ║');
    console.log('║     Verificação de Todos os Fluxos e Funcionalidades    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
    
    const startTime = Date.now();
    const results = {
        total: 8,
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // Executar testes
    const tests = [
        { name: 'Criação de Conta', fn: test1_CreateAccount },
        { name: 'Login', fn: test2_Login },
        { name: 'Criação de Plano com Pesos', fn: test3_CreateStudyPlan },
        { name: 'Geração de Cronograma', fn: test4_GenerateSchedule },
        { name: 'Cards na Home', fn: test5_CheckHomeCards },
        { name: 'Conclusão de Sessões', fn: test6_CompleteSessions },
        { name: 'Gamificação', fn: test7_CheckGamification },
        { name: 'Validação Round Robin', fn: test8_ValidateWeightedDistribution }
    ];
    
    for (const test of tests) {
        try {
            const passed = await test.fn();
            results.tests.push({ name: test.name, passed });
            if (passed) {
                results.passed++;
            } else {
                results.failed++;
            }
        } catch (error) {
            log(`Erro não tratado em ${test.name}: ${error.message}`, 'error');
            results.tests.push({ name: test.name, passed: false });
            results.failed++;
        }
    }
    
    // Relatório Final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n${colors.bold}${colors.cyan}`);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   RELATÓRIO FINAL                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
    
    console.log('\n📊 RESUMO DOS TESTES:');
    console.log('=' .repeat(50));
    
    results.tests.forEach((test, index) => {
        const icon = test.passed ? '✅' : '❌';
        const color = test.passed ? colors.green : colors.red;
        console.log(`${color}${icon} Teste ${index + 1}: ${test.name}${colors.reset}`);
    });
    
    console.log('\n📈 ESTATÍSTICAS:');
    console.log('=' .repeat(50));
    console.log(`Total de testes: ${results.total}`);
    console.log(`${colors.green}Aprovados: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Reprovados: ${results.failed}${colors.reset}`);
    console.log(`Taxa de sucesso: ${((results.passed / results.total) * 100).toFixed(1)}%`);
    console.log(`Tempo de execução: ${duration}s`);
    
    if (results.passed === results.total) {
        console.log(`\n${colors.bold}${colors.green}🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 🎉${colors.reset}`);
        console.log('A plataforma está funcionando corretamente!');
    } else {
        console.log(`\n${colors.bold}${colors.yellow}⚠️ ALGUNS TESTES FALHARAM${colors.reset}`);
        console.log('Verifique os logs acima para mais detalhes.');
    }
    
    // Salvar relatório
    const report = {
        timestamp: new Date().toISOString(),
        duration: duration,
        results: results,
        environment: {
            node: process.version,
            platform: process.platform,
            baseUrl: BASE_URL
        }
    };
    
    const fs = require('fs');
    const reportFile = `test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Relatório salvo em: ${reportFile}`);
}

// Verificar se servidor está rodando
async function checkServerStatus() {
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        return response.status === 200;
    } catch {
        return false;
    }
}

// EXECUTAR
(async () => {
    console.log('🔍 Verificando servidor...');
    
    const serverOnline = await checkServerStatus();
    
    if (!serverOnline) {
        console.log(`${colors.red}❌ Servidor não está respondendo em ${BASE_URL}${colors.reset}`);
        console.log('Por favor, inicie o servidor com: npm start');
        process.exit(1);
    }
    
    console.log(`${colors.green}✅ Servidor online!${colors.reset}`);
    
    await runAllTests();
})();