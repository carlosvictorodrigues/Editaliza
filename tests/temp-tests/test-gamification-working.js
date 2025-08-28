/**
 * Teste de Sistema de Gamificação - Versão Corrigida
 * Baseado no test-plataforma-completo.js que funciona
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE_URL = 'http://localhost:3000/api';

// Dados do teste
const timestamp = Date.now();
const testUser = {
    name: `Gamification Test ${timestamp}`,
    email: `gamification.${timestamp}@editaliza.com`,
    password: 'Test@123456'
};

let authToken = null;
let userId = null;
let planId = null;

async function makeRequest(method, endpoint, data = null, includeAuth = true) {
    const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (authToken && includeAuth) {
        config.headers.Authorization = `Bearer ${authToken}`;
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

async function testarGamificacao() {
    console.log('\n================================='.cyan);
    console.log('🎮 TESTE DE GAMIFICAÇÃO'.cyan.bold);
    console.log('=================================\n'.cyan);

    try {
        // ========== 1. REGISTRO ==========
        console.log('1️⃣ REGISTRO DO USUÁRIO'.yellow.bold);
        console.log('-'.repeat(40));
        
        const registerResult = await makeRequest('POST', '/auth/register', testUser, false);
        
        if (!registerResult.success) {
            throw new Error(`Erro no registro: ${JSON.stringify(registerResult.error)}`);
        }
        
        authToken = registerResult.data.token;
        userId = registerResult.data.user?.id || registerResult.data.userId;
        
        console.log('✅ Usuário registrado com sucesso'.green);
        console.log(`   Email: ${testUser.email}`.gray);
        console.log(`   User ID: ${userId}`.gray);
        
        // ========== 2. VERIFICAR PERFIL INICIAL ==========
        console.log('\n2️⃣ PERFIL DE GAMIFICAÇÃO INICIAL'.yellow.bold);
        console.log('-'.repeat(40));
        
        const initialProfile = await makeRequest('GET', '/gamification/profile');
        
        if (initialProfile.success) {
            console.log('📊 Estado Inicial:'.cyan);
            console.log(`   XP: ${initialProfile.data.xp}`.gray);
            console.log(`   Nível: ${initialProfile.data.level}`.gray);
            console.log(`   Streak: ${initialProfile.data.current_streak} dias`.gray);
            console.log(`   Conquistas: ${initialProfile.data.achievements?.length || 0}`.gray);
        } else {
            console.log('⚠️ Perfil não encontrado (será criado automaticamente)'.yellow);
        }
        
        // ========== 3. CRIAR PLANO DE ESTUDOS ==========
        console.log('\n3️⃣ CRIAÇÃO DO PLANO DE ESTUDOS'.yellow.bold);
        console.log('-'.repeat(40));
        
        const examDate = new Date('2025-11-21'); // Data real da prova TJPE
        
        const planData = {
            plan_name: 'Teste Gamificação - TJPE 2025',
            exam_date: examDate.toISOString().split('T')[0],
            daily_question_goal: 20,
            weekly_question_goal: 120,
            session_duration_minutes: 45
        };
        
        const planResult = await makeRequest('POST', '/plans', planData);
        
        if (!planResult.success) {
            throw new Error(`Erro ao criar plano: ${JSON.stringify(planResult.error)}`);
        }
        
        planId = planResult.data.planId;
        console.log('✅ Plano criado com sucesso'.green);
        console.log(`   ID do Plano: ${planId}`.gray);
        console.log(`   Nome: ${planData.plan_name}`.gray);
        
        // ========== 4. ADICIONAR DISCIPLINAS E TÓPICOS ==========
        console.log('\n4️⃣ ADICIONANDO DISCIPLINAS E TÓPICOS'.yellow.bold);
        console.log('-'.repeat(40));
        
        const disciplinas = [
            { 
                nome: 'Direito Administrativo', 
                peso: 5,
                topicos: [
                    { nome: 'Princípios do Direito Administrativo', peso: 5 },
                    { nome: 'Atos administrativos', peso: 5 },
                    { nome: 'Licitação - conceito e princípios', peso: 5 }
                ]
            },
            { 
                nome: 'Português', 
                peso: 4,
                topicos: [
                    { nome: 'Compreensão e interpretação de textos', peso: 5 },
                    { nome: 'Ortografia, acentuação e pontuação', peso: 4 }
                ]
            }
        ];
        
        for (const disc of disciplinas) {
            const subjectResult = await makeRequest('POST', `/subjects`, {
                subject_name: disc.nome,
                weight: disc.peso,
                priority_weight: disc.peso,
                study_plan_id: planId
            });
            
            if (!subjectResult.success) {
                console.log(`   ⚠️ Erro ao criar ${disc.nome}: ${subjectResult.error}`.yellow);
                continue;
            }
            
            const subjectId = subjectResult.data.subject.id;
            console.log(`   ✅ ${disc.nome} criada (ID: ${subjectId})`.green);
            
            // Adicionar tópicos
            for (const topico of disc.topicos) {
                const topicResult = await makeRequest('POST', `/subjects/${subjectId}/topics`, {
                    topic_name: topico.nome,
                    topic_description: `Descrição: ${topico.nome}`,
                    weight: topico.peso,
                    priority_weight: topico.peso,
                    subject_id: subjectId
                });
                
                if (topicResult.success) {
                    console.log(`      + ${topico.nome}`.gray);
                }
            }
        }
        
        // ========== 5. GERAR CRONOGRAMA ==========
        console.log('\n5️⃣ GERANDO CRONOGRAMA DE ESTUDOS'.yellow.bold);
        console.log('-'.repeat(40));
        
        const scheduleData = {
            start_date: new Date().toISOString().split('T')[0],
            exam_date: examDate.toISOString().split('T')[0],
            study_hours_per_day: {
                'Seg': 4,
                'Ter': 4,
                'Qua': 4,
                'Qui': 4,
                'Sex': 4,
                'Sab': 2,
                'Dom': 2
            }
        };
        
        const scheduleResult = await makeRequest('POST', `/plans/${planId}/generate`, scheduleData);
        
        if (!scheduleResult.success) {
            console.log('⚠️ Aviso ao gerar cronograma:'.yellow, scheduleResult.error);
        } else {
            console.log('✅ Cronograma gerado com sucesso'.green);
        }
        
        // ========== 6. BUSCAR SESSÕES ==========
        console.log('\n6️⃣ BUSCANDO SESSÕES DE ESTUDO'.yellow.bold);
        console.log('-'.repeat(40));
        
        const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`);
        
        if (!sessionsResult.success || !sessionsResult.data.sessions?.length) {
            throw new Error('Nenhuma sessão encontrada');
        }
        
        const sessions = sessionsResult.data.sessions;
        console.log(`✅ ${sessions.length} sessões encontradas`.green);
        
        // ========== 7. COMPLETAR PRIMEIRA SESSÃO ==========
        console.log('\n7️⃣ COMPLETANDO PRIMEIRA SESSÃO'.yellow.bold);
        console.log('-'.repeat(40));
        
        const firstSession = sessions[0];
        console.log(`   Sessão ID: ${firstSession.id}`.gray);
        console.log(`   Tópico: ${firstSession.topic_name || 'N/A'}`.gray);
        
        // Marcar como concluída
        const completeResult = await makeRequest('PATCH', `/sessions/${firstSession.id}`, {
            status: 'Concluído',
            questions_solved: 15,
            notes: 'Sessão completada com sucesso - teste de gamificação'
        });
        
        if (!completeResult.success) {
            console.log('⚠️ Aviso ao completar sessão:'.yellow, completeResult.error);
        } else {
            console.log('✅ Sessão marcada como concluída'.green);
        }
        
        // Registrar tempo de estudo
        const timeResult = await makeRequest('POST', `/sessions/${firstSession.id}/time`, {
            time_seconds: 2700 // 45 minutos
        });
        
        if (timeResult.success) {
            console.log('✅ Tempo de estudo registrado: 45 minutos'.green);
        }
        
        // ========== 8. AGUARDAR PROCESSAMENTO ==========
        console.log('\n⏳ Aguardando processamento da gamificação...'.yellow);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // ========== 9. VERIFICAR PERFIL ATUALIZADO ==========
        console.log('\n9️⃣ PERFIL DE GAMIFICAÇÃO ATUALIZADO'.yellow.bold);
        console.log('-'.repeat(40));
        
        const finalProfile = await makeRequest('GET', '/gamification/profile');
        
        if (!finalProfile.success) {
            console.log('❌ Erro ao buscar perfil final:'.red, finalProfile.error);
        } else {
            const initialXP = initialProfile.data?.xp || 0;
            const finalXP = finalProfile.data.xp;
            const xpGained = finalXP - initialXP;
            
            console.log('\n📊 RESULTADOS DA GAMIFICAÇÃO:'.cyan.bold);
            console.log('═'.repeat(40).cyan);
            
            console.log('\n📈 Progresso de XP:'.yellow);
            console.log(`   Inicial: ${initialXP} XP`.gray);
            console.log(`   Final: ${finalXP} XP`.gray);
            console.log(`   Ganho: ${xpGained > 0 ? '+' : ''}${xpGained} XP ${xpGained > 0 ? '✨' : ''}`.green);
            
            console.log('\n🎖️ Nível:'.yellow);
            console.log(`   Nível Atual: ${finalProfile.data.level}`.gray);
            if (finalProfile.data.level_info) {
                console.log(`   Título: ${finalProfile.data.level_info.title}`.cyan);
                if (finalProfile.data.level_info.phrase) {
                    console.log(`   Frase: "${finalProfile.data.level_info.phrase}"`.gray);
                }
            }
            
            console.log('\n🔥 Streak:'.yellow);
            console.log(`   Dias consecutivos: ${finalProfile.data.current_streak}`.gray);
            console.log(`   Maior streak: ${finalProfile.data.longest_streak}`.gray);
            
            if (finalProfile.data.achievements?.length > 0) {
                console.log('\n🏆 Conquistas Desbloqueadas:'.yellow);
                finalProfile.data.achievements.forEach(ach => {
                    console.log(`   • ${ach.achievement_id}`.gray);
                });
            }
            
            // ========== 10. ANÁLISE FINAL ==========
            console.log('\n📋 ANÁLISE DO SISTEMA:'.yellow.bold);
            console.log('═'.repeat(40).cyan);
            
            if (xpGained > 0) {
                console.log('✅ Sistema de XP funcionando corretamente'.green);
                console.log(`   Você ganhou ${xpGained} XP por completar a sessão`.gray);
            } else {
                console.log('❌ PROBLEMA DETECTADO: XP não foi atualizado'.red);
                console.log('   Verifique o GamificationService'.gray);
            }
            
            if (finalProfile.data.current_streak > 0) {
                console.log('✅ Sistema de streak funcionando'.green);
            }
            
            console.log('\n💡 Dicas para ganhar mais XP:'.yellow);
            console.log('   • Complete mais sessões de estudo'.gray);
            console.log('   • Resolva questões durante as sessões'.gray);
            console.log('   • Mantenha uma sequência diária de estudos'.gray);
            console.log('   • Complete tópicos inteiros'.gray);
        }
        
        // ========== 11. COMPLETAR MAIS SESSÕES (OPCIONAL) ==========
        if (sessions.length > 1) {
            console.log('\n🎯 TESTE ADICIONAL: Completando segunda sessão...'.yellow.bold);
            console.log('-'.repeat(40));
            
            const secondSession = sessions[1];
            
            await makeRequest('PATCH', `/sessions/${secondSession.id}`, {
                status: 'Concluído',
                questions_solved: 20
            });
            
            await makeRequest('POST', `/sessions/${secondSession.id}/time`, {
                time_seconds: 3600 // 1 hora
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const extraProfile = await makeRequest('GET', '/gamification/profile');
            if (extraProfile.success) {
                const extraXP = extraProfile.data.xp - finalProfile.data.xp;
                console.log(`✅ Segunda sessão completada: +${extraXP} XP`.green);
                console.log(`   XP Total: ${extraProfile.data.xp}`.gray);
            }
        }
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:'.red.bold, error.message);
        if (error.response?.data) {
            console.error('Detalhes do erro:', JSON.stringify(error.response.data, null, 2));
        }
    }
    
    console.log('\n================================='.cyan);
    console.log('🏁 TESTE FINALIZADO'.cyan.bold);
    console.log('=================================\n'.cyan);
    
    process.exit(0);
}

// Executar teste
console.log('🚀 Iniciando teste de gamificação...'.cyan);
console.log('   Certifique-se que o servidor está rodando na porta 3000'.gray);
console.log('');

testarGamificacao().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});