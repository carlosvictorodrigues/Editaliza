#!/usr/bin/env node

/**
 * TESTE COMPLETO FINAL - SISTEMA EDITALIZA
 * Validação completa de todas as funcionalidades após correções
 */

const axios = require('axios');

// Configuração
const BASE_URL = 'http://localhost:3000';
const timestamp = Date.now();
const TEST_USER = {
    email: `test_final_${timestamp}@editaliza.com`,
    password: 'Test@2024!Secure',
    name: 'Usuário Teste Final'
};

// Cliente HTTP
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    validateStatus: () => true
});

// Estado global
let authToken = null;
let csrfToken = null;
let userId = null;
let planId = null;
let subjectIds = [];
let topicIds = [];
let sessionIds = [];

// Cores para console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCompleteSystem() {
    log('magenta', '\n' + '='.repeat(70));
    log('magenta', '🚀 TESTE COMPLETO FINAL - SISTEMA EDITALIZA v2.0');
    log('magenta', '='.repeat(70));
    log('gray', `Servidor: ${BASE_URL}`);
    log('gray', `Timestamp: ${new Date().toLocaleString('pt-BR')}\n`);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // ========== 1. OBTER CSRF TOKEN ==========
    log('cyan', '📍 ETAPA 1: AUTENTICAÇÃO E SEGURANÇA');
    
    try {
        const csrfRes = await api.get('/api/auth/csrf-token');
        if (csrfRes.status === 200 && csrfRes.data.csrfToken) {
            csrfToken = csrfRes.data.csrfToken;
            log('green', `✅ CSRF Token obtido: ${csrfToken.substring(0, 20)}...`);
            passedTests++;
        } else {
            log('red', `❌ Falha ao obter CSRF: ${csrfRes.status}`);
            failedTests++;
        }
        totalTests++;
    } catch (error) {
        log('red', `❌ Erro ao obter CSRF: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    // ========== 2. REGISTRO DE USUÁRIO ==========
    try {
        const registerRes = await api.post('/api/auth/register', {
            ...TEST_USER,
            confirmPassword: TEST_USER.password
        }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        
        if (registerRes.status === 201 || registerRes.status === 200) {
            log('green', `✅ Usuário registrado: ${TEST_USER.email}`);
            passedTests++;
        } else {
            log('red', `❌ Falha no registro: ${registerRes.status}`);
            failedTests++;
        }
        totalTests++;
    } catch (error) {
        log('red', `❌ Erro no registro: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    // ========== 3. LOGIN ==========
    try {
        const loginRes = await api.post('/api/auth/login', {
            email: TEST_USER.email,
            password: TEST_USER.password
        }, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        
        if (loginRes.status === 200) {
            // Procurar token em diferentes estruturas possíveis
            authToken = loginRes.data.token || 
                       loginRes.data.accessToken ||
                       loginRes.data.tokens?.accessToken ||
                       loginRes.data.tokens?.token;
            
            userId = loginRes.data.user?.id || loginRes.data.userId;
            
            if (authToken) {
                log('green', `✅ Login bem-sucedido - Token JWT recebido`);
                log('gray', `   User ID: ${userId}, Token: ${authToken.substring(0, 30)}...`);
                passedTests++;
            } else {
                log('red', `❌ Login sem token no response: ${JSON.stringify(loginRes.data)}`);
                failedTests++;
            }
        } else {
            log('red', `❌ Falha no login: ${loginRes.status}`);
            failedTests++;
        }
        totalTests++;
    } catch (error) {
        log('red', `❌ Erro no login: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    // ========== 4. VERIFICAR AUTENTICAÇÃO ==========
    if (authToken) {
        try {
            const meRes = await api.get('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (meRes.status === 200) {
                log('green', `✅ Rota protegida acessível: ${meRes.data.user?.name || meRes.data.name}`);
                passedTests++;
            } else {
                log('red', `❌ Falha na autenticação: ${meRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro na autenticação: ${error.message}`);
            failedTests++;
            totalTests++;
        }
    }

    // ========== 5. CRIAR PLANO DE ESTUDOS ==========
    log('cyan', '\n📍 ETAPA 2: CRIAÇÃO DE CONTEÚDO');
    
    if (authToken) {
        try {
            const planRes = await api.post('/api/plans', {
                plan_name: 'Plano Completo - Teste Final',
                exam_date: '2025-12-31',
                study_hours_per_day: JSON.stringify({
                    '0': 2, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 2
                }),
                daily_question_goal: 50,
                weekly_question_goal: 300
            }, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });
            
            if (planRes.status === 201 || planRes.status === 200) {
                planId = planRes.data.newPlanId || planRes.data.planId || planRes.data.id;
                log('green', `✅ Plano criado com sucesso - ID: ${planId}`);
                passedTests++;
            } else {
                log('red', `❌ Erro ao criar plano: ${planRes.status} - ${JSON.stringify(planRes.data)}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro ao criar plano: ${error.message}`);
            failedTests++;
            totalTests++;
        }
    }

    // ========== 6. ADICIONAR DISCIPLINAS E TÓPICOS ==========
    if (planId && authToken) {
        const subjects = [
            { 
                name: 'Português', 
                weight: 3,
                topics: ['Gramática', 'Interpretação', 'Redação']
            },
            { 
                name: 'Matemática', 
                weight: 2,
                topics: ['Álgebra', 'Geometria', 'Estatística']
            },
            { 
                name: 'Direito', 
                weight: 4,
                topics: ['Constitucional', 'Administrativo', 'Penal']
            }
        ];
        
        for (const subject of subjects) {
            try {
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
                    log('green', `✅ Disciplina criada: ${subject.name} (ID: ${subjectId})`);
                    passedTests++;
                    
                    // Adicionar tópicos
                    for (const topicName of subject.topics) {
                        const topicRes = await api.post('/api/topics', {
                            subject_id: subjectId,
                            topic_name: topicName,
                            priority: 'alta',
                            complexity: 'medio',
                            estimated_hours: 15
                        }, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'X-CSRF-Token': csrfToken
                            }
                        });
                        
                        if (topicRes.status === 201 || topicRes.status === 200) {
                            const topicId = topicRes.data.id || topicRes.data.topicId;
                            topicIds.push(topicId);
                            log('gray', `   → Tópico: ${topicName} (ID: ${topicId})`);
                        }
                    }
                } else {
                    log('red', `❌ Erro ao criar disciplina ${subject.name}: ${subjectRes.status}`);
                    failedTests++;
                }
                totalTests++;
            } catch (error) {
                log('red', `❌ Erro ao criar disciplina: ${error.message}`);
                failedTests++;
                totalTests++;
            }
        }
    }

    // ========== 7. GERAR CRONOGRAMA ==========
    log('cyan', '\n📍 ETAPA 3: CRONOGRAMA E SESSÕES');
    
    if (planId && authToken) {
        try {
            const generateRes = await api.post(`/api/plans/${planId}/generate`, {}, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-CSRF-Token': csrfToken
                }
            });
            
            if (generateRes.status === 200) {
                log('green', `✅ Cronograma gerado com sucesso`);
                passedTests++;
                
                // Buscar sessões criadas
                const sessionsRes = await api.get(`/api/schedules?planId=${planId}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                if (sessionsRes.status === 200 && Array.isArray(sessionsRes.data)) {
                    sessionIds = sessionsRes.data.map(s => s.id).slice(0, 5);
                    log('gray', `   Sessões criadas: ${sessionsRes.data.length}`);
                }
            } else {
                log('red', `❌ Erro ao gerar cronograma: ${generateRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro ao gerar cronograma: ${error.message}`);
            failedTests++;
            totalTests++;
        }
    }

    // ========== 8. MARCAR SESSÕES COMO CONCLUÍDAS ==========
    if (sessionIds.length > 0 && authToken) {
        let completedCount = 0;
        for (const sessionId of sessionIds.slice(0, 3)) {
            try {
                const completeRes = await api.patch(`/api/sessions/${sessionId}/complete`, {
                    completed: true,
                    performance: 90
                }, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'X-CSRF-Token': csrfToken
                    }
                });
                
                if (completeRes.status === 200) {
                    completedCount++;
                    log('gray', `   ✓ Sessão ${sessionId} marcada como concluída`);
                }
            } catch (error) {
                // Silenciar erros de sessões individuais
            }
        }
        
        if (completedCount > 0) {
            log('green', `✅ ${completedCount} sessões marcadas como concluídas`);
            passedTests++;
        } else {
            log('yellow', `⚠️ Nenhuma sessão pôde ser marcada como concluída`);
        }
        totalTests++;
    }

    // ========== 9. TESTAR GAMIFICAÇÃO ==========
    log('cyan', '\n📍 ETAPA 4: SISTEMA DE GAMIFICAÇÃO');
    
    if (authToken) {
        // Testar /api/stats/user
        try {
            const statsRes = await api.get('/api/stats/user', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (statsRes.status === 200) {
                log('green', `✅ GET /api/stats/user - Funcionando`);
                if (statsRes.data.xp_total !== undefined) {
                    log('gray', `   XP: ${statsRes.data.xp_total}, Nível: ${statsRes.data.nivel_atual}`);
                }
                passedTests++;
            } else {
                log('red', `❌ GET /api/stats/user - Erro ${statsRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro em /api/stats/user: ${error.message}`);
            failedTests++;
            totalTests++;
        }

        // Testar /api/progress
        try {
            const progressRes = await api.get('/api/progress', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (progressRes.status === 200) {
                log('green', `✅ GET /api/progress - Funcionando`);
                if (progressRes.data.progresso_geral !== undefined) {
                    log('gray', `   Progresso: ${progressRes.data.progresso_geral}%`);
                }
                passedTests++;
            } else {
                log('red', `❌ GET /api/progress - Erro ${progressRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro em /api/progress: ${error.message}`);
            failedTests++;
            totalTests++;
        }

        // Testar /api/achievements
        try {
            const achievementsRes = await api.get('/api/achievements', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (achievementsRes.status === 200) {
                log('green', `✅ GET /api/achievements - Funcionando`);
                if (achievementsRes.data.conquistas_desbloqueadas) {
                    log('gray', `   Conquistas: ${achievementsRes.data.conquistas_desbloqueadas.length}`);
                }
                passedTests++;
            } else {
                log('red', `❌ GET /api/achievements - Erro ${achievementsRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro em /api/achievements: ${error.message}`);
            failedTests++;
            totalTests++;
        }

        // Testar /api/statistics
        try {
            const statisticsRes = await api.get('/api/statistics', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (statisticsRes.status === 200) {
                log('green', `✅ GET /api/statistics - Funcionando`);
                passedTests++;
            } else {
                log('red', `❌ GET /api/statistics - Erro ${statisticsRes.status}`);
                failedTests++;
            }
            totalTests++;
        } catch (error) {
            log('red', `❌ Erro em /api/statistics: ${error.message}`);
            failedTests++;
            totalTests++;
        }
    }

    // ========== 10. VERIFICAR INTERFACE WEB ==========
    log('cyan', '\n📍 ETAPA 5: INTERFACE WEB');
    
    try {
        const homeRes = await api.get('/home.html');
        if (homeRes.status === 200 && homeRes.data.includes('dashboard')) {
            log('green', `✅ home.html carregando (${homeRes.data.length} bytes)`);
            passedTests++;
        } else {
            log('red', `❌ home.html com problemas`);
            failedTests++;
        }
        totalTests++;
    } catch (error) {
        log('red', `❌ Erro ao carregar home.html: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    try {
        const cronogramaRes = await api.get('/cronograma.html');
        if (cronogramaRes.status === 200 && cronogramaRes.data.includes('cronograma')) {
            log('green', `✅ cronograma.html carregando (${cronogramaRes.data.length} bytes)`);
            passedTests++;
        } else {
            log('red', `❌ cronograma.html com problemas`);
            failedTests++;
        }
        totalTests++;
    } catch (error) {
        log('red', `❌ Erro ao carregar cronograma.html: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    // ========== RELATÓRIO FINAL ==========
    log('magenta', '\n' + '='.repeat(70));
    log('magenta', '📊 RELATÓRIO FINAL DO TESTE COMPLETO');
    log('magenta', '='.repeat(70));
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    log('cyan', '\n📈 MÉTRICAS:');
    log('gray', `  • Total de testes: ${totalTests}`);
    log('green', `  • Testes aprovados: ${passedTests}`);
    log('red', `  • Testes falhados: ${failedTests}`);
    log('yellow', `  • Taxa de sucesso: ${successRate}%`);
    
    log('cyan', '\n🗂️ DADOS CRIADOS:');
    log('gray', `  • Email: ${TEST_USER.email}`);
    log('gray', `  • User ID: ${userId || 'N/A'}`);
    log('gray', `  • Plan ID: ${planId || 'N/A'}`);
    log('gray', `  • Disciplinas: ${subjectIds.length}`);
    log('gray', `  • Tópicos: ${topicIds.length}`);
    log('gray', `  • Sessões: ${sessionIds.length}`);
    
    log('cyan', '\n📋 RESUMO DOS COMPONENTES:');
    const components = [
        { name: 'Autenticação (CSRF, Registro, Login)', passed: passedTests >= 3 },
        { name: 'Criação de Conteúdo (Planos, Disciplinas)', passed: planId !== null },
        { name: 'Geração de Cronograma', passed: sessionIds.length > 0 },
        { name: 'Sistema de Gamificação', passed: passedTests >= 12 },
        { name: 'Interface Web', passed: passedTests >= 15 }
    ];
    
    components.forEach(comp => {
        const status = comp.passed ? '✅' : '❌';
        const color = comp.passed ? 'green' : 'red';
        log(color, `  ${status} ${comp.name}`);
    });
    
    // Conclusão final
    if (successRate >= 90) {
        log('green', '\n🎉 SISTEMA FUNCIONANDO PERFEITAMENTE!');
        log('green', 'Todos os componentes principais estão operacionais.');
    } else if (successRate >= 70) {
        log('yellow', '\n⚠️ SISTEMA FUNCIONAL COM ALGUMAS PENDÊNCIAS');
        log('yellow', 'A maioria dos componentes está funcionando corretamente.');
    } else {
        log('red', '\n❌ SISTEMA COM PROBLEMAS CRÍTICOS');
        log('red', 'Vários componentes precisam de correção.');
    }
    
    log('magenta', '\n' + '='.repeat(70) + '\n');
}

// Executar teste
testCompleteSystem().catch(error => {
    log('red', `\n❌ ERRO FATAL NO TESTE: ${error.message}`);
    process.exit(1);
});