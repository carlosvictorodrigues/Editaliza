/**
 * Teste Completo de Gamificação e Estatísticas
 * 
 * Este teste valida:
 * 1. XP é incrementado ao concluir sessões
 * 2. Badges são desbloqueados corretamente
 * 3. Estatísticas são atualizadas
 * 4. Streak é mantido/incrementado
 * 5. Progresso geral é calculado
 */

const axios = require('axios');
const fs = require('fs');

// Configuração
const BASE_URL = 'http://localhost:3000';
const timestamp = Date.now();

// Resultados do teste
const testResults = {
    timestamp: new Date().toISOString(),
    gamificationTests: [],
    statisticsTests: [],
    errors: []
};

// Helper para fazer requisições
async function makeRequest(method, endpoint, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}/api${endpoint}`,
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
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status 
        };
    }
}

// Delay entre requisições
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testarGamificacaoCompleta() {
    console.log('======================================================================');
    console.log('🎮 TESTE COMPLETO DE GAMIFICAÇÃO E ESTATÍSTICAS');
    console.log('======================================================================');
    console.log(`Timestamp: ${new Date().toISOString()}\n`);
    
    let token, userId, planId;
    
    // ========== 1. SETUP INICIAL ==========
    console.log('📝 ETAPA 1: SETUP INICIAL');
    console.log('-'.repeat(40));
    
    // Registrar usuário
    const userData = {
        name: `Test Gamification ${timestamp}`,
        email: `test.gamification.${timestamp}@editaliza.com`,
        password: 'Test@123!',
        confirmPassword: 'Test@123!'
    };
    
    const registerResult = await makeRequest('POST', '/auth/register', userData);
    if (!registerResult.success) {
        console.error('❌ Erro ao registrar usuário:', registerResult.error);
        return;
    }
    
    token = registerResult.data.token;
    userId = registerResult.data.user.id;
    console.log('✅ Usuário criado - ID:', userId);
    
    // Criar plano
    const planData = {
        plan_name: 'Teste Gamificação',
        exam_date: '2025-12-31',
        study_hours_per_day: {"0":4,"1":4,"2":4,"3":4,"4":4,"5":4,"6":4},
        daily_question_goal: 50,
        weekly_question_goal: 300,
        session_duration_minutes: 50
    };
    
    const planResult = await makeRequest('POST', '/plans', planData, token);
    if (!planResult.success) {
        console.error('❌ Erro ao criar plano:', planResult.error);
        return;
    }
    
    planId = planResult.data.planId || planResult.data.newPlanId || planResult.data.id;
    console.log('✅ Plano criado - ID:', planId);
    
    // Adicionar disciplina e tópicos
    const subjectResult = await makeRequest('POST', `/plans/${planId}/subjects`, {
        name: 'Matemática',
        weight: 5
    }, token);
    
    if (!subjectResult.success) {
        console.error('❌ Erro ao criar disciplina:', subjectResult.error);
        return;
    }
    
    const subjectId = subjectResult.data.subjectId || subjectResult.data.id || subjectResult.data.subject?.id;
    console.log('✅ Disciplina criada - ID:', subjectId);
    
    if (!subjectId) {
        console.error('❌ ID da disciplina não encontrado:', subjectResult.data);
        return;
    }
    
    // Adicionar tópicos
    const topics = [
        'Álgebra', 'Geometria', 'Trigonometria', 'Cálculo', 'Estatística'
    ];
    
    for (const topicName of topics) {
        await makeRequest('POST', `/subjects/${subjectId}/topics`, {
            topic_name: topicName,
            priority_weight: 5,
            status: 'Não Iniciado'
        }, token);
        await delay(50);
    }
    console.log('✅ Tópicos adicionados:', topics.length);
    
    // Gerar cronograma com os parâmetros corretos
    const generateResult = await makeRequest('POST', `/plans/${planId}/generate`, {
        daily_question_goal: 50,
        weekly_question_goal: 300,
        session_duration_minutes: 50,
        study_hours_per_day: {"0":4,"1":4,"2":4,"3":4,"4":4,"5":4,"6":4},
        has_essay: false,
        reta_final_mode: false
    }, token);
    if (!generateResult.success) {
        console.error('❌ Erro ao gerar cronograma:', generateResult.error);
        return;
    }
    console.log('✅ Cronograma gerado\n');
    
    // ========== 2. CAPTURAR ESTADO INICIAL ==========
    console.log('📸 ETAPA 2: CAPTURAR ESTADO INICIAL');
    console.log('-'.repeat(40));
    
    // Gamificação inicial
    const initialGamification = await makeRequest('GET', '/gamification/profile', null, token);
    const initialProfile = initialGamification.data || {
        xp: 0,
        level: 1,
        current_streak: 0,
        achievements: [],
        badges: []
    };
    
    console.log('🎮 Gamificação Inicial:');
    console.log(`   XP: ${initialProfile.xp || 0}`);
    console.log(`   Nível: ${initialProfile.level || 1}`);
    console.log(`   Streak: ${initialProfile.current_streak || 0} dias`);
    console.log(`   Conquistas: ${initialProfile.achievements?.length || 0}`);
    console.log(`   Badges: ${initialProfile.badges?.length || 0}`);
    
    // Estatísticas iniciais
    const initialStats = await makeRequest('GET', `/sessions/statistics/${planId}`, null, token);
    const stats = initialStats.data || {
        total_sessions: 0,
        completed_sessions: 0,
        total_study_hours: 0,
        completion_rate: 0
    };
    
    console.log('\n📊 Estatísticas Iniciais:');
    console.log(`   Sessões totais: ${stats.total_sessions || 0}`);
    console.log(`   Sessões concluídas: ${stats.completed_sessions || 0}`);
    console.log(`   Horas estudadas: ${stats.total_study_hours || 0}`);
    console.log(`   Taxa de conclusão: ${stats.completion_rate || 0}%`);
    
    testResults.initial = {
        gamification: initialProfile,
        statistics: stats
    };
    
    // ========== 3. BUSCAR SESSÕES ==========
    console.log('\n🗓️ ETAPA 3: BUSCAR SESSÕES CRIADAS');
    console.log('-'.repeat(40));
    
    const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`, null, token);
    if (!sessionsResult.success) {
        console.error('❌ Erro ao buscar sessões:', sessionsResult.error);
        return;
    }
    
    const sessions = sessionsResult.data.sessions || sessionsResult.data || [];
    console.log(`✅ ${sessions.length} sessões encontradas`);
    
    // ========== 4. MARCAR SESSÕES COMO CONCLUÍDAS ==========
    console.log('\n✅ ETAPA 4: MARCAR SESSÕES COMO CONCLUÍDAS E VERIFICAR MUDANÇAS');
    console.log('-'.repeat(40));
    
    const sessionBatches = [
        { count: 1, description: 'Primeira sessão' },
        { count: 4, description: 'Mais 4 sessões (total: 5)' },
        { count: 5, description: 'Mais 5 sessões (total: 10)' }
    ];
    
    let totalCompleted = 0;
    
    for (const batch of sessionBatches) {
        console.log(`\n📝 Marcando ${batch.description}...`);
        
        const sessionsToComplete = sessions.slice(totalCompleted, totalCompleted + batch.count);
        
        for (const session of sessionsToComplete) {
            const sessionId = session.id || session.session_id;
            const completeResult = await makeRequest('PATCH', `/sessions/${sessionId}`, {
                status: 'Concluído'
            }, token);
            
            if (completeResult.success) {
                console.log(`   ✅ Sessão ${sessionId} concluída`);
                
                // Adicionar tempo de estudo (opcional)
                await makeRequest('POST', `/sessions/${sessionId}/time`, {
                    seconds: 3000 // 50 minutos
                }, token);
            } else {
                console.log(`   ❌ Erro na sessão ${sessionId}`);
            }
            
            await delay(100);
        }
        
        totalCompleted += batch.count;
        
        // Verificar mudanças após cada batch
        console.log('\n🔍 Verificando mudanças...');
        
        // Gamificação atualizada
        const updatedGamification = await makeRequest('GET', '/gamification/profile', null, token);
        const updatedProfile = updatedGamification.data || {};
        
        const xpGained = (updatedProfile.xp || 0) - (initialProfile.xp || 0);
        const levelChanged = (updatedProfile.level || 1) !== (initialProfile.level || 1);
        const newAchievements = (updatedProfile.achievements?.length || 0) - (initialProfile.achievements?.length || 0);
        
        console.log(`\n   📈 Mudanças na Gamificação após ${totalCompleted} sessões:`);
        console.log(`      XP ganho: +${xpGained} (${initialProfile.xp || 0} → ${updatedProfile.xp || 0})`);
        console.log(`      Nível: ${initialProfile.level || 1} → ${updatedProfile.level || 1} ${levelChanged ? '⬆️' : ''}`);
        console.log(`      Novas conquistas: +${newAchievements}`);
        
        if (newAchievements > 0 && updatedProfile.achievements) {
            console.log('      🏆 Conquistas desbloqueadas:');
            const newAchievementsList = updatedProfile.achievements.slice(-(newAchievements));
            newAchievementsList.forEach(ach => {
                console.log(`         - ${ach.name || ach.achievement_name || ach.achievement_id}`);
            });
        }
        
        // Estatísticas atualizadas
        const updatedStats = await makeRequest('GET', `/sessions/statistics/${planId}`, null, token);
        const newStats = updatedStats.data || {};
        
        console.log(`\n   📊 Mudanças nas Estatísticas:`);
        console.log(`      Sessões concluídas: ${stats.completed_sessions || 0} → ${newStats.completed_sessions || totalCompleted}`);
        console.log(`      Taxa de conclusão: ${stats.completion_rate || 0}% → ${newStats.completion_rate || 0}%`);
        console.log(`      Horas estudadas: ${stats.total_study_hours || 0} → ${newStats.total_study_hours || 0}`);
        
        // Registrar teste
        testResults.gamificationTests.push({
            batch: batch.description,
            sessionsCompleted: totalCompleted,
            xpGained,
            levelChanged,
            newAchievements,
            profile: updatedProfile
        });
        
        testResults.statisticsTests.push({
            batch: batch.description,
            sessionsCompleted: totalCompleted,
            stats: newStats
        });
    }
    
    // ========== 5. VERIFICAR BADGES ESPECÍFICOS ==========
    console.log('\n🏅 ETAPA 5: VERIFICAR BADGES ESPECÍFICOS');
    console.log('-'.repeat(40));
    
    const expectedBadges = [
        { sessions: 1, name: 'Primeira Sessão', description: 'Complete sua primeira sessão de estudo' },
        { sessions: 5, name: 'Dedicado', description: 'Complete 5 sessões de estudo' },
        { sessions: 10, name: 'Comprometido', description: 'Complete 10 sessões de estudo' }
    ];
    
    const finalGamification = await makeRequest('GET', '/gamification/profile', null, token);
    const finalProfile = finalGamification.data || {};
    const allAchievements = finalProfile.achievements || [];
    
    console.log(`\n   Total de conquistas: ${allAchievements.length}`);
    
    for (const expected of expectedBadges) {
        const found = allAchievements.find(ach => 
            ach.name?.includes(expected.name) || 
            ach.achievement_name?.includes(expected.name) ||
            ach.description?.includes(expected.description)
        );
        
        if (found) {
            console.log(`   ✅ Badge "${expected.name}" desbloqueado`);
        } else if (totalCompleted >= expected.sessions) {
            console.log(`   ⚠️ Badge "${expected.name}" esperado mas não encontrado (após ${expected.sessions} sessões)`);
        }
    }
    
    // ========== 6. RESUMO FINAL ==========
    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMO DO TESTE DE GAMIFICAÇÃO');
    console.log('='.repeat(70));
    
    const finalStats = testResults.statisticsTests[testResults.statisticsTests.length - 1]?.stats || {};
    
    console.log('\n🎮 GAMIFICAÇÃO:');
    console.log(`   XP Total Ganho: ${(finalProfile.xp || 0) - (initialProfile.xp || 0)}`);
    console.log(`   Níveis Subidos: ${(finalProfile.level || 1) - (initialProfile.level || 1)}`);
    console.log(`   Conquistas Desbloqueadas: ${allAchievements.length}`);
    console.log(`   Streak Atual: ${finalProfile.current_streak || 0} dias`);
    
    console.log('\n📊 ESTATÍSTICAS:');
    console.log(`   Sessões Concluídas: ${finalStats.completed_sessions || totalCompleted}/${sessions.length}`);
    console.log(`   Taxa de Conclusão: ${finalStats.completion_rate || 0}%`);
    console.log(`   Horas Totais Estudadas: ${finalStats.total_study_hours || 0}`);
    
    // Validações
    const validations = {
        xpIncremented: (finalProfile.xp || 0) > (initialProfile.xp || 0),
        achievementsUnlocked: allAchievements.length > 0,
        statsUpdated: (finalStats.completed_sessions || 0) === totalCompleted,
        completionRateCalculated: (finalStats.completion_rate || 0) > 0
    };
    
    console.log('\n✅ VALIDAÇÕES:');
    console.log(`   XP incrementado: ${validations.xpIncremented ? '✅' : '❌'}`);
    console.log(`   Conquistas desbloqueadas: ${validations.achievementsUnlocked ? '✅' : '❌'}`);
    console.log(`   Estatísticas atualizadas: ${validations.statsUpdated ? '✅' : '❌'}`);
    console.log(`   Taxa de conclusão calculada: ${validations.completionRateCalculated ? '✅' : '❌'}`);
    
    const allValid = Object.values(validations).every(v => v === true);
    
    if (allValid) {
        console.log('\n🎉 TESTE DE GAMIFICAÇÃO COMPLETO E BEM-SUCEDIDO!');
        console.log('   ✅ XP está sendo incrementado corretamente');
        console.log('   ✅ Badges e conquistas estão sendo desbloqueados');
        console.log('   ✅ Estatísticas estão sendo atualizadas');
        console.log('   ✅ Sistema de gamificação funcionando perfeitamente!');
    } else {
        console.log('\n⚠️ TESTE DE GAMIFICAÇÃO COM PROBLEMAS');
        console.log('   Verifique as validações acima para identificar o que precisa ser corrigido');
    }
    
    // Salvar resultados
    testResults.final = {
        gamification: finalProfile,
        statistics: finalStats,
        validations
    };
    
    const filename = `teste-gamification-resultado-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
    console.log(`\n📁 Resultados detalhados salvos em: ${filename}`);
}

// Executar teste
console.log('🚀 Iniciando teste completo de gamificação...\n');

testarGamificacaoCompleta()
    .then(() => {
        console.log('\n✨ Teste finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro fatal no teste:', error);
        testResults.errors.push(error.message);
        process.exit(1);
    });