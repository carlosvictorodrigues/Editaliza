/**
 * Teste de Debug para Sistema de Gamificação
 * Verifica se o XP está sendo atualizado corretamente
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE_URL = 'http://localhost:3000/api';

// Dados do teste
const timestamp = Date.now();
const testUser = {
    name: `Debug Gamification ${timestamp}`,
    email: `debug.gamification.${timestamp}@editaliza.com`,
    password: 'Test@123456'
};

let authToken = null;
let userId = null;
let planId = null;

async function makeRequest(method, endpoint, data = null, token = null) {
    const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message, 
            status: error.response?.status 
        };
    }
}

async function debugGamification() {
    console.log('\n================================='.cyan);
    console.log('🎮 DEBUG DE GAMIFICAÇÃO'.cyan.bold);
    console.log('=================================\n'.cyan);

    try {
        // 1. Registrar usuário
        console.log('1️⃣ Registrando usuário...'.yellow);
        const registerResult = await makeRequest('POST', '/auth/register', testUser);
        if (!registerResult.success) {
            throw new Error(`Erro no registro: ${JSON.stringify(registerResult.error)}`);
        }
        authToken = registerResult.data.token;
        userId = registerResult.data.user.id;
        console.log(`   ✅ Usuário registrado: ${testUser.email} (ID: ${userId})`.green);

        // 2. Verificar perfil de gamificação inicial
        console.log('\n2️⃣ Verificando perfil de gamificação INICIAL...'.yellow);
        const initialProfile = await makeRequest('GET', '/gamification/profile', null, authToken);
        if (!initialProfile.success) {
            console.log('   ❌ Erro ao buscar perfil inicial:'.red, initialProfile.error);
        } else {
            console.log('   📊 Perfil Inicial:'.cyan);
            console.log(`      XP: ${initialProfile.data.xp}`.gray);
            console.log(`      Nível: ${initialProfile.data.level}`.gray);
            console.log(`      Streak: ${initialProfile.data.current_streak} dias`.gray);
            console.log(`      Conquistas: ${initialProfile.data.achievements?.length || 0}`.gray);
        }

        // 3. Criar plano de estudos
        console.log('\n3️⃣ Criando plano de estudos...'.yellow);
        const planData = {
            plan_name: 'Teste Gamificação',
            exam_name: 'Teste Gamificação',
            exam_date: '2025-12-31',
            available_hours: 4,
            available_days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
        };
        const planResult = await makeRequest('POST', '/plans', planData, authToken);
        if (!planResult.success) {
            throw new Error(`Erro ao criar plano: ${JSON.stringify(planResult.error)}`);
        }
        planId = planResult.data.planId;
        console.log(`   ✅ Plano criado: ID ${planId}`.green);

        // 4. Adicionar disciplina e tópico
        console.log('\n4️⃣ Adicionando disciplina e tópico...'.yellow);
        const subjectData = {
            subject_name: 'Teste Gamificação',
            weight: 5,
            priority_weight: 5,
            study_plan_id: planId
        };
        const subjectResult = await makeRequest('POST', `/subjects`, subjectData, authToken);
        
        if (!subjectResult.success) {
            throw new Error(`Erro ao criar disciplina: ${JSON.stringify(subjectResult.error)}`);
        }
        const subjectId = subjectResult.data.subject.id;
        console.log(`   ✅ Disciplina criada: ID ${subjectId}`.green);

        // Adicionar tópico
        const topicData = {
            topic_name: 'Tópico Teste',
            topic_description: 'Descrição do tópico para teste de gamificação',
            weight: 5,
            priority_weight: 5,
            subject_id: subjectId
        };
        const topicResult = await makeRequest('POST', `/subjects/${subjectId}/topics`, topicData, authToken);
        if (!topicResult.success) {
            throw new Error(`Erro ao criar tópico: ${JSON.stringify(topicResult.error)}`);
        }
        console.log(`   ✅ Tópico criado`.green);

        // 5. Gerar cronograma
        console.log('\n5️⃣ Gerando cronograma...'.yellow);
        const scheduleResult = await makeRequest('POST', `/plans/${planId}/generate`, {
            start_date: new Date().toISOString().split('T')[0],
            exam_date: '2025-12-31',
            study_hours_per_day: {
                'Seg': 4,
                'Ter': 4,
                'Qua': 4,
                'Qui': 4,
                'Sex': 4,
                'Sab': 0,
                'Dom': 0
            }
        }, authToken);
        
        if (!scheduleResult.success) {
            throw new Error(`Erro ao gerar cronograma: ${JSON.stringify(scheduleResult.error)}`);
        }
        console.log(`   ✅ Cronograma gerado`.green);

        // 6. Buscar uma sessão para completar
        console.log('\n6️⃣ Buscando sessões...'.yellow);
        const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`, null, authToken);
        if (!sessionsResult.success || !sessionsResult.data.sessions?.length) {
            throw new Error('Nenhuma sessão encontrada');
        }
        
        const session = sessionsResult.data.sessions[0];
        console.log(`   ✅ Sessão encontrada: ID ${session.id}`.green);

        // 7. Marcar sessão como concluída
        console.log('\n7️⃣ Marcando sessão como concluída...'.yellow);
        const completeResult = await makeRequest('PATCH', `/sessions/${session.id}`, {
            status: 'Concluído',
            questions_solved: 10,
            notes: 'Teste de gamificação'
        }, authToken);
        
        if (!completeResult.success) {
            throw new Error(`Erro ao completar sessão: ${JSON.stringify(completeResult.error)}`);
        }
        console.log(`   ✅ Sessão marcada como concluída`.green);

        // 8. Registrar tempo de estudo
        console.log('\n8️⃣ Registrando tempo de estudo...'.yellow);
        const timeResult = await makeRequest('POST', `/sessions/${session.id}/time`, {
            time_seconds: 3600 // 1 hora
        }, authToken);
        
        if (timeResult.success) {
            console.log(`   ✅ Tempo registrado: 1 hora`.green);
        } else {
            console.log(`   ⚠️ Aviso ao registrar tempo: ${timeResult.error}`.yellow);
        }

        // 9. Aguardar processamento
        console.log('\n⏳ Aguardando processamento da gamificação (3 segundos)...'.yellow);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 10. Verificar perfil de gamificação FINAL
        console.log('\n🔍 Verificando perfil de gamificação FINAL...'.yellow);
        const finalProfile = await makeRequest('GET', '/gamification/profile', null, authToken);
        
        if (!finalProfile.success) {
            console.log('   ❌ Erro ao buscar perfil final:'.red, finalProfile.error);
        } else {
            console.log('\n📊 COMPARAÇÃO DE PERFIS:'.cyan.bold);
            console.log('   '.repeat(10) + 'INICIAL → FINAL'.gray);
            
            const xpGanho = finalProfile.data.xp - (initialProfile.data?.xp || 0);
            const nivelMudou = finalProfile.data.level !== (initialProfile.data?.level || 1);
            const streakMudou = finalProfile.data.current_streak !== (initialProfile.data?.current_streak || 0);
            const conquistasGanhas = (finalProfile.data.achievements?.length || 0) - (initialProfile.data?.achievements?.length || 0);
            
            console.log(`   XP: ${initialProfile.data?.xp || 0} → ${finalProfile.data.xp} (${xpGanho >= 0 ? '+' : ''}${xpGanho})`.cyan);
            console.log(`   Nível: ${initialProfile.data?.level || 1} → ${finalProfile.data.level} ${nivelMudou ? '⬆️' : ''}`.cyan);
            console.log(`   Streak: ${initialProfile.data?.current_streak || 0} → ${finalProfile.data.current_streak} dias ${streakMudou ? '🔥' : ''}`.cyan);
            console.log(`   Conquistas: ${initialProfile.data?.achievements?.length || 0} → ${finalProfile.data.achievements?.length || 0} (+${conquistasGanhas})`.cyan);
            
            // Mostrar título do nível
            if (finalProfile.data.level_info) {
                console.log(`\n   📌 Nível Atual: ${finalProfile.data.level_info.title}`.yellow);
                if (finalProfile.data.level_info.phrase) {
                    console.log(`   💬 "${finalProfile.data.level_info.phrase}"`.gray);
                }
            }
            
            // Verificar conquistas desbloqueadas
            if (finalProfile.data.achievements?.length > 0) {
                console.log('\n   🏆 Conquistas:'.yellow);
                finalProfile.data.achievements.forEach(ach => {
                    console.log(`      - ${ach.achievement_id}`.gray);
                });
            }
            
            // Análise do resultado
            console.log('\n📈 ANÁLISE DO RESULTADO:'.yellow.bold);
            if (xpGanho > 0) {
                console.log(`   ✅ XP foi atualizado corretamente (+${xpGanho} XP)`.green);
            } else {
                console.log(`   ❌ XP NÃO foi atualizado (esperado: +100 XP mínimo)`.red);
            }
            
            if (streakMudou) {
                console.log(`   ✅ Streak foi atualizado corretamente`.green);
            } else {
                console.log(`   ⚠️ Streak não mudou (pode estar correto se já estudou hoje)`.yellow);
            }
            
            if (conquistasGanhas > 0) {
                console.log(`   ✅ ${conquistasGanhas} nova(s) conquista(s) desbloqueada(s)`.green);
            } else {
                console.log(`   ℹ️ Nenhuma nova conquista (normal para primeira sessão)`.gray);
            }
        }

        // 11. Testar processamento direto (opcional)
        console.log('\n🔬 Testando chamada direta ao service...'.yellow);
        const gamificationService = require('./src/services/gamificationService');
        
        // Buscar outra sessão
        const sessions = sessionsResult.data.sessions;
        if (sessions.length > 1) {
            const secondSession = sessions[1];
            console.log(`   Processando sessão ${secondSession.id} diretamente...`.gray);
            
            try {
                // Marcar como concluída primeiro
                await makeRequest('PATCH', `/sessions/${secondSession.id}`, {
                    status: 'Concluído'
                }, authToken);
                
                // Chamar processamento direto
                await gamificationService.processSessionCompletion(userId, secondSession.id);
                console.log('   ✅ Processamento direto concluído'.green);
                
                // Verificar perfil novamente
                const afterDirectProfile = await makeRequest('GET', '/gamification/profile', null, authToken);
                if (afterDirectProfile.success) {
                    const xpAposDirecto = afterDirectProfile.data.xp - finalProfile.data.xp;
                    console.log(`   XP após processamento direto: ${afterDirectProfile.data.xp} (+${xpAposDirecto})`.cyan);
                }
            } catch (error) {
                console.log('   ❌ Erro no processamento direto:'.red, error.message);
            }
        }

    } catch (error) {
        console.error('\n❌ Erro no teste:'.red, error.message);
        if (error.response?.data) {
            console.error('Detalhes:', error.response.data);
        }
    }

    console.log('\n================================='.cyan);
    console.log('🏁 TESTE FINALIZADO'.cyan.bold);
    console.log('=================================\n'.cyan);
}

// Executar teste
debugGamification().catch(console.error);