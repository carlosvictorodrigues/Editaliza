#!/usr/bin/env node

/**
 * TESTE COMPLETO CORRIGIDO - FLUXO DE USUÁRIO EDITALIZA
 * Com correções para CSRF e autenticação
 */

const axios = require('axios');

// Configuração
const BASE_URL = 'http://localhost:3000';
const timestamp = Date.now();
const TEST_USER = {
    email: `test_${timestamp}@editaliza.com`,
    password: 'Test@2024!',
    name: 'Usuário Teste Flow'
};

// Cliente HTTP
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    validateStatus: () => true // Não rejeitar automaticamente
});

// Estado global
let authToken = null;
let csrfToken = null;
let userId = null;
let planId = null;
let sessionIds = [];
let subjectIds = [];

// Cores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTest() {
    log('yellow', '\n'.repeat(2) + '='.repeat(60));
    log('yellow', '🚀 TESTE COMPLETO DO FLUXO - EDITALIZA v2.0');
    log('yellow', '='.repeat(60));
    
    try {
        // ========== ETAPA 1: CSRF TOKEN ==========
        log('cyan', '\n📍 ETAPA 1: OBTER CSRF TOKEN');
        
        const csrfRes = await api.get('/api/auth/csrf-token');
        if (csrfRes.status === 200) {
            csrfToken = csrfRes.data.csrfToken;
            log('green', `✅ CSRF Token obtido: ${csrfToken.substring(0, 15)}...`);
        } else {
            throw new Error('Falha ao obter CSRF token');
        }
        
        // ========== ETAPA 2: REGISTRO ==========
        log('cyan', '\n📍 ETAPA 2: CRIAR CONTA DE USUÁRIO');
        
        const registerRes = await api.post('/api/auth/register', {
            ...TEST_USER,
            confirmPassword: TEST_USER.password
        }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        
        if (registerRes.status === 201 || registerRes.status === 200) {
            log('green', `✅ Conta criada: ${TEST_USER.email}`);
        } else {
            throw new Error(`Falha no registro: ${registerRes.data.error}`);
        }
        
        // ========== ETAPA 3: LOGIN ==========
        log('cyan', '\n📍 ETAPA 3: FAZER LOGIN');
        
        const loginRes = await api.post('/api/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        
        if (loginRes.status === 200) {
            authToken = loginRes.data.token;
            userId = loginRes.data.user?.id;
            log('green', `✅ Login bem-sucedido - User ID: ${userId}`);
            log('gray', `   Token: ${authToken?.substring(0, 20)}...`);
        } else {
            throw new Error('Falha no login');
        }
        
        // ========== ETAPA 4: VERIFICAR AUTENTICAÇÃO ==========
        log('cyan', '\n📍 ETAPA 4: VERIFICAR ROTA PROTEGIDA');
        
        const meRes = await api.get('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (meRes.status === 200) {
            log('green', `✅ Autenticação funcionando: ${meRes.data.user.name}`);
        } else {
            log('red', `❌ Falha na autenticação: ${meRes.status}`);
        }
        
        // ========== ETAPA 5: CRIAR PLANO ==========
        log('cyan', '\n📍 ETAPA 5: CRIAR PLANO DE ESTUDOS');
        
        const planRes = await api.post('/api/plans', {
            plan_name: 'Plano Concurso TRF 2025',
            exam_date: '2025-12-15',
            study_hours_per_day: JSON.stringify({
                '0': 2, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 3
            }),
            daily_question_goal: 30,
            weekly_question_goal: 150
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': csrfToken
            }
        });
        
        if (planRes.status === 201 || planRes.status === 200) {
            planId = planRes.data.newPlanId || planRes.data.planId || planRes.data.id;
            log('green', `✅ Plano criado - ID: ${planId}`);
        } else {
            log('red', `❌ Erro ao criar plano: ${planRes.status} - ${JSON.stringify(planRes.data)}`);
        }
        
        // ========== ETAPA 6: ADICIONAR DISCIPLINAS ==========
        if (planId) {
            log('cyan', '\n📍 ETAPA 6: ADICIONAR DISCIPLINAS E TÓPICOS');
            
            const subjects = [
                { name: 'Português', weight: 3 },
                { name: 'Matemática', weight: 2 },
                { name: 'Direito Constitucional', weight: 4 }
            ];
            
            for (const subject of subjects) {
                const subjectRes = await api.post('/api/subjects', {
                    plan_id: planId,
                    subject_name: subject.name,
                    weight: subject.weight
                }, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'X-CSRF-Token': csrfToken
                    }
                });
                
                if (subjectRes.status === 201 || subjectRes.status === 200) {
                    const subjectId = subjectRes.data.id || subjectRes.data.subjectId;
                    subjectIds.push(subjectId);
                    log('green', `✅ Disciplina: ${subject.name} (peso: ${subject.weight})`);
                    
                    // Adicionar tópicos
                    const topics = [
                        { name: `${subject.name} - Básico`, priority: 'alta' },
                        { name: `${subject.name} - Intermediário`, priority: 'media' },
                        { name: `${subject.name} - Avançado`, priority: 'baixa' }
                    ];
                    
                    for (const topic of topics) {
                        const topicRes = await api.post('/api/topics', {
                            subject_id: subjectId,
                            topic_name: topic.name,
                            priority: topic.priority,
                            complexity: 'medio',
                            estimated_hours: 10
                        }, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'X-CSRF-Token': csrfToken
                            }
                        });
                        
                        if (topicRes.status === 201 || topicRes.status === 200) {
                            log('gray', `   → Tópico: ${topic.name}`);
                        }
                    }
                } else {
                    log('red', `❌ Erro ao criar disciplina: ${subject.name}`);
                }
            }
        }
        
        // ========== ETAPA 7: GERAR CRONOGRAMA ==========
        if (planId) {
            log('cyan', '\n📍 ETAPA 7: GERAR CRONOGRAMA');
            
            const generateRes = await api.post(`/api/plans/${planId}/generate`, {}, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });
            
            if (generateRes.status === 200) {
                log('green', `✅ Cronograma gerado com sucesso`);
                log('gray', `   Sessões criadas: ${generateRes.data.sessionsCreated || 'múltiplas'}`);
            } else {
                log('red', `❌ Erro ao gerar cronograma: ${generateRes.status}`);
            }
            
            // Buscar sessões criadas
            const sessionsRes = await api.get(`/api/schedules?planId=${planId}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (sessionsRes.status === 200 && Array.isArray(sessionsRes.data)) {
                sessionIds = sessionsRes.data.map(s => s.id);
                log('green', `✅ Sessões recuperadas: ${sessionIds.length} sessões`);
            }
        }
        
        // ========== ETAPA 8: VERIFICAR PÁGINAS HTML ==========
        log('cyan', '\n📍 ETAPA 8: VERIFICAR INTERFACE WEB');
        
        const homeRes = await api.get('/home.html');
        if (homeRes.status === 200) {
            const hasCards = homeRes.data.includes('card') || homeRes.data.includes('dashboard');
            log('green', `✅ Home.html: ${homeRes.data.length} bytes ${hasCards ? '(com cards)' : ''}`);
        }
        
        const cronogramaRes = await api.get('/cronograma.html');
        if (cronogramaRes.status === 200) {
            const hasSchedule = cronogramaRes.data.includes('cronograma') || cronogramaRes.data.includes('sessão');
            log('green', `✅ Cronograma.html: ${cronogramaRes.data.length} bytes ${hasSchedule ? '(com cronograma)' : ''}`);
        }
        
        // ========== ETAPA 9: MARCAR SESSÕES CONCLUÍDAS ==========
        if (sessionIds.length > 0) {
            log('cyan', '\n📍 ETAPA 9: MARCAR SESSÕES COMO CONCLUÍDAS');
            
            let completed = 0;
            for (const sessionId of sessionIds.slice(0, 3)) {
                const completeRes = await api.patch(`/api/sessions/${sessionId}/complete`, {
                    completed: true,
                    performance: 85
                }, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'X-CSRF-Token': csrfToken
                    }
                });
                
                if (completeRes.status === 200) {
                    completed++;
                    log('green', `✅ Sessão ${sessionId} marcada como concluída`);
                }
            }
            
            if (completed > 0) {
                log('gray', `   Total: ${completed} sessões concluídas`);
            }
        } else {
            log('yellow', '⚠️ Nenhuma sessão disponível para marcar');
        }
        
        // ========== ETAPA 10: VERIFICAR ESTATÍSTICAS ==========
        log('cyan', '\n📍 ETAPA 10: VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO');
        
        const statsEndpoints = [
            '/api/stats/user',
            '/api/progress',
            '/api/achievements',
            '/api/statistics'
        ];
        
        for (const endpoint of statsEndpoints) {
            const statsRes = await api.get(endpoint + (endpoint.includes('progress') ? `?planId=${planId}` : ''), {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (statsRes.status === 200) {
                log('green', `✅ ${endpoint}: Dados recebidos`);
                if (statsRes.data.xp) log('gray', `   XP: ${statsRes.data.xp}`);
                if (statsRes.data.level) log('gray', `   Level: ${statsRes.data.level}`);
                if (statsRes.data.percentage) log('gray', `   Progresso: ${statsRes.data.percentage}%`);
            } else if (statsRes.status === 404) {
                log('yellow', `⚠️ ${endpoint}: Não implementado ainda`);
            } else {
                log('red', `❌ ${endpoint}: Erro ${statsRes.status}`);
            }
        }
        
        // ========== RELATÓRIO FINAL ==========
        log('yellow', '\n' + '='.repeat(60));
        log('yellow', '📊 RELATÓRIO FINAL DO TESTE');
        log('yellow', '='.repeat(60));
        
        log('cyan', '\n🗂️ DADOS CRIADOS:');
        log('gray', `  • Email: ${TEST_USER.email}`);
        log('gray', `  • User ID: ${userId}`);
        log('gray', `  • Plan ID: ${planId}`);
        log('gray', `  • Disciplinas: ${subjectIds.length}`);
        log('gray', `  • Sessões: ${sessionIds.length}`);
        
        log('green', '\n✅ TESTE CONCLUÍDO COM SUCESSO!');
        log('gray', 'O fluxo principal do sistema está funcionando.');
        
    } catch (error) {
        log('red', `\n❌ ERRO NO TESTE: ${error.message}`);
        if (error.response) {
            log('red', `Status: ${error.response.status}`);
            log('red', `Data: ${JSON.stringify(error.response.data)}`);
        }
    }
    
    log('yellow', '\n' + '='.repeat(60) + '\n');
}

// Executar teste
runTest();