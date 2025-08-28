/**
 * Teste Simplificado de Gamificação
 * Verifica se XP e estatísticas são atualizadas ao concluir sessões
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(method, endpoint, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}/api${endpoint}`,
            timeout: 5000, // 5 segundos de timeout
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

async function testarGamificacao() {
    console.log('🎮 TESTE RÁPIDO DE GAMIFICAÇÃO\n');
    
    let token, userId, planId;
    
    // 1. Criar usuário
    console.log('1️⃣ Criando usuário de teste...');
    const timestamp = Date.now();
    const userData = {
        name: `Test ${timestamp}`,
        email: `test.${timestamp}@editaliza.com`,
        password: 'Test@123!',
        confirmPassword: 'Test@123!'
    };
    
    const registerResult = await makeRequest('POST', '/auth/register', userData);
    if (!registerResult.success) {
        console.error('❌ Erro ao registrar:', registerResult.error);
        return;
    }
    
    token = registerResult.data.token;
    userId = registerResult.data.user.id;
    console.log('✅ Usuário criado - ID:', userId);
    
    // 2. Criar plano
    console.log('\n2️⃣ Criando plano de estudos...');
    const planResult = await makeRequest('POST', '/plans', {
        plan_name: 'Teste Gamificação',
        exam_date: '2025-12-31',
        study_hours_per_day: {"0":2,"1":2,"2":2,"3":2,"4":2,"5":2,"6":2},
        daily_question_goal: 10,
        weekly_question_goal: 70,
        session_duration_minutes: 30
    }, token);
    
    if (!planResult.success) {
        console.error('❌ Erro ao criar plano:', planResult.error);
        return;
    }
    
    planId = planResult.data.planId || planResult.data.newPlanId;
    console.log('✅ Plano criado - ID:', planId);
    
    // 3. Adicionar disciplina
    console.log('\n3️⃣ Adicionando disciplina...');
    const subjectResult = await makeRequest('POST', `/plans/${planId}/subjects`, {
        name: 'Matemática',
        weight: 5
    }, token);
    
    if (!subjectResult.success) {
        console.error('❌ Erro ao criar disciplina:', subjectResult.error);
        return;
    }
    
    const subjectId = subjectResult.data.subjectId || subjectResult.data.id;
    console.log('✅ Disciplina criada - ID:', subjectId);
    
    // 4. Adicionar tópico
    console.log('\n4️⃣ Adicionando tópico...');
    await makeRequest('POST', `/subjects/${subjectId}/topics`, {
        topic_name: 'Álgebra',
        priority_weight: 5,
        status: 'Não Iniciado'
    }, token);
    console.log('✅ Tópico adicionado');
    
    // 5. Gerar cronograma
    console.log('\n5️⃣ Gerando cronograma...');
    const generateResult = await makeRequest('POST', `/plans/${planId}/generate`, {
        daily_question_goal: 10,
        weekly_question_goal: 70,
        session_duration_minutes: 30,
        study_hours_per_day: {"0":2,"1":2,"2":2,"3":2,"4":2,"5":2,"6":2},
        has_essay: false,
        reta_final_mode: false
    }, token);
    
    if (!generateResult.success) {
        console.error('❌ Erro ao gerar cronograma:', generateResult.error);
        return;
    }
    console.log('✅ Cronograma gerado');
    console.log('   Resposta completa:', JSON.stringify(generateResult.data, null, 2));
    const sessionsCreated = generateResult.data?.sessionsCreated || 
                           generateResult.data?.statistics?.totalSessions || 
                           generateResult.data?.statistics?.studySessions || 0;
    console.log('   Sessões criadas:', sessionsCreated);
    
    // 6. Verificar gamificação ANTES
    console.log('\n6️⃣ Verificando gamificação inicial...');
    // Tentar diferentes endpoints de gamificação
    console.log('   Tentando /api/gamification/profile...');
    let initialGamification = await makeRequest('GET', '/gamification/profile', null, token);
    
    if (!initialGamification.success) {
        console.log('   Tentando /api/plans/' + planId + '/gamification...');
        initialGamification = await makeRequest('GET', `/plans/${planId}/gamification`, null, token);
    }
    
    if (!initialGamification.success) {
        console.log('⚠️  Gamificação não disponível - continuando teste...');
    } else {
        const profile = initialGamification.data;
        console.log('📊 Estado Inicial:');
        console.log('   XP:', profile.xp || 0);
        console.log('   Nível:', profile.level || 1);
        console.log('   Conquistas:', profile.achievements?.length || 0);
    }
    
    // 7. Buscar sessões
    console.log('\n7️⃣ Buscando sessões...');
    const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`, null, token);
    
    if (!sessionsResult.success) {
        console.error('❌ Erro ao buscar sessões:', sessionsResult.error);
        return;
    }
    
    const sessions = sessionsResult.data.sessions || sessionsResult.data || [];
    console.log(`✅ ${sessions.length} sessões encontradas`);
    
    if (sessions.length === 0) {
        console.log('⚠️  Nenhuma sessão foi criada no cronograma');
        console.log('   Debug - Resposta:', JSON.stringify(sessionsResult.data, null, 2));
    }
    
    // 8. Marcar 3 sessões como concluídas
    console.log('\n8️⃣ Marcando 3 sessões como concluídas...');
    let completed = 0;
    
    for (let i = 0; i < Math.min(3, sessions.length); i++) {
        const session = sessions[i];
        const sessionId = session.id || session.session_id;
        
        const result = await makeRequest('PATCH', `/sessions/${sessionId}`, {
            status: 'Concluído'
        }, token);
        
        if (result.success) {
            completed++;
            console.log(`   ✅ Sessão ${sessionId} concluída`);
        } else {
            console.log(`   ❌ Erro na sessão ${sessionId}:`, result.error);
        }
    }
    
    console.log(`   Total: ${completed}/3 sessões concluídas`);
    
    // 9. Verificar gamificação DEPOIS
    console.log('\n9️⃣ Verificando gamificação após conclusões...');
    const finalGamification = await makeRequest('GET', '/gamification/profile', null, token);
    
    if (!finalGamification.success) {
        console.log('⚠️  Gamificação não disponível');
    } else {
        const finalProfile = finalGamification.data;
        const initialProfile = initialGamification.data || {};
        
        console.log('📊 Estado Final:');
        console.log('   XP:', finalProfile.xp || 0);
        console.log('   Nível:', finalProfile.level || 1);
        console.log('   Conquistas:', finalProfile.achievements?.length || 0);
        
        console.log('\n📈 Mudanças:');
        console.log(`   XP ganho: +${(finalProfile.xp || 0) - (initialProfile.xp || 0)}`);
        console.log(`   Novos badges: +${(finalProfile.achievements?.length || 0) - (initialProfile.achievements?.length || 0)}`);
    }
    
    // 10. Verificar estatísticas
    console.log('\n🔟 Verificando estatísticas...');
    const statsResult = await makeRequest('GET', `/sessions/statistics/${planId}`, null, token);
    
    if (!statsResult.success) {
        console.log('⚠️  Estatísticas não disponíveis');
    } else {
        const stats = statsResult.data;
        console.log('📊 Estatísticas:');
        console.log('   Sessões concluídas:', stats.completed_sessions || completed);
        console.log('   Taxa de conclusão:', stats.completion_rate || 0, '%');
        console.log('   Horas estudadas:', stats.total_study_hours || 0);
    }
    
    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📋 RESUMO DO TESTE');
    console.log('='.repeat(50));
    
    const hasGamification = finalGamification.success;
    const hasStatistics = statsResult.success;
    const xpChanged = finalGamification.success && 
                     (finalGamification.data.xp || 0) > (initialGamification.data?.xp || 0);
    
    console.log(`\n✅ Sessões marcadas com sucesso: ${completed > 0 ? '✅' : '❌'}`);
    console.log(`✅ Gamificação disponível: ${hasGamification ? '✅' : '❌'}`);
    console.log(`✅ XP incrementado: ${xpChanged ? '✅' : '❌'}`);
    console.log(`✅ Estatísticas disponíveis: ${hasStatistics ? '✅' : '❌'}`);
    
    if (completed > 0) {
        console.log('\n🎉 FUNCIONALIDADE BÁSICA FUNCIONANDO!');
        if (!hasGamification) {
            console.log('⚠️  Gamificação precisa ser implementada/corrigida');
        }
        if (!hasStatistics) {
            console.log('⚠️  Estatísticas precisam ser implementadas/corrigidas');
        }
    }
}

// Executar
console.log('🚀 Iniciando teste simplificado...\n');

testarGamificacao()
    .then(() => {
        console.log('\n✨ Teste finalizado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Erro:', error.message);
        process.exit(1);
    });