/**
 * Script de Teste Completo da Plataforma Editaliza
 * 
 * Este script testa todo o fluxo da aplicação:
 * 1. Criação de conta
 * 2. Login
 * 3. Criação de plano
 * 4. Adição de disciplinas e tópicos com pesos
 * 5. Geração de cronograma com algoritmo round-robin ponderado
 * 6. Marcação de sessões como concluídas
 * 7. Verificação de estatísticas e gamificação
 */

const axios = require('axios');
const API_URL = 'http://localhost:3000/api';

// Dados de teste
const testUser = {
    name: 'Teste Completo',
    email: `teste${Date.now()}@test.com`,
    password: 'Test@123456'
};

let authToken = '';
let userId = '';
let planId = '';
let sessions = [];

// Função auxiliar para fazer requisições
async function makeRequest(method, endpoint, data = null, useAuth = true) {
    const config = {
        method,
        url: `${API_URL}${endpoint}`,
        headers: {}
    };
    
    if (useAuth && authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    if (data) {
        config.data = data;
    }
    
    try {
        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`❌ Erro em ${method} ${endpoint}:`, error.response?.data || error.message);
        return { success: false, error: error.response?.data || error.message };
    }
}

async function testPlatform() {
    console.log('🚀 Iniciando teste completo da plataforma...\n');
    
    // 1. CRIAR CONTA
    console.log('📝 1. Testando criação de conta...');
    const registerResult = await makeRequest('POST', '/auth/register', testUser, false);
    
    if (!registerResult.success) {
        console.log('❌ Falha ao criar conta');
        return;
    }
    
    console.log('✅ Conta criada com sucesso');
    authToken = registerResult.data.token;
    userId = registerResult.data.user.id;
    console.log(`   User ID: ${userId}`);
    
    // 2. LOGIN (testar se funciona)
    console.log('\n🔑 2. Testando login...');
    const loginResult = await makeRequest('POST', '/auth/login', {
        email: testUser.email,
        password: testUser.password
    }, false);
    
    if (!loginResult.success) {
        console.log('❌ Falha ao fazer login');
        return;
    }
    
    console.log('✅ Login realizado com sucesso');
    authToken = loginResult.data.token;
    
    // 3. CRIAR PLANO DE ESTUDOS
    console.log('\n📚 3. Criando plano de estudos...');
    const examDate = new Date();
    examDate.setMonth(examDate.getMonth() + 3);
    
    const planResult = await makeRequest('POST', '/plans', {
        plan_name: 'Concurso Teste TRF',
        exam_date: examDate.toISOString().split('T')[0]
    });
    
    if (!planResult.success) {
        console.log('❌ Falha ao criar plano');
        return;
    }
    
    console.log('✅ Plano criado com sucesso');
    planId = planResult.data.plan.id;
    console.log(`   Plan ID: ${planId}`);
    
    // 4. ADICIONAR DISCIPLINAS E TÓPICOS COM PESOS DIFERENTES
    console.log('\n📖 4. Adicionando disciplinas e tópicos com pesos...');
    
    const disciplinas = [
        { 
            nome: 'Direito Constitucional', 
            peso: 10,
            topicos: [
                { nome: 'Princípios Fundamentais', peso: 9 },
                { nome: 'Direitos e Garantias', peso: 8 },
                { nome: 'Organização do Estado', peso: 7 }
            ]
        },
        {
            nome: 'Português',
            peso: 8,
            topicos: [
                { nome: 'Interpretação de Texto', peso: 10 },
                { nome: 'Gramática', peso: 6 },
                { nome: 'Redação Oficial', peso: 5 }
            ]
        },
        {
            nome: 'Informática',
            peso: 5,
            topicos: [
                { nome: 'Windows', peso: 4 },
                { nome: 'Word', peso: 3 },
                { nome: 'Excel', peso: 8 }
            ]
        },
        {
            nome: 'Raciocínio Lógico',
            peso: 3,
            topicos: [
                { nome: 'Proposições', peso: 6 },
                { nome: 'Argumentação', peso: 5 },
                { nome: 'Quantificadores', peso: 4 }
            ]
        }
    ];
    
    for (const disciplina of disciplinas) {
        // Criar disciplina
        console.log(`\n   Adicionando ${disciplina.nome} (peso ${disciplina.peso})...`);
        const subjectResult = await makeRequest('POST', `/plans/${planId}/subjects`, {
            name: disciplina.nome,
            weight: disciplina.peso
        });
        
        if (!subjectResult.success) {
            console.log(`   ❌ Erro ao adicionar ${disciplina.nome}`);
            continue;
        }
        
        const subjectId = subjectResult.data.subject.id;
        console.log(`   ✅ ${disciplina.nome} adicionada`);
        
        // Adicionar tópicos
        for (const topico of disciplina.topicos) {
            const topicResult = await makeRequest('POST', `/subjects/${subjectId}/topics`, {
                topic_description: topico.nome,
                weight: topico.peso
            });
            
            if (topicResult.success) {
                console.log(`      ✅ Tópico: ${topico.nome} (peso ${topico.peso})`);
            } else {
                console.log(`      ❌ Erro no tópico: ${topico.nome}`);
            }
        }
    }
    
    // 5. GERAR CRONOGRAMA
    console.log('\n📅 5. Gerando cronograma...');
    
    const scheduleResult = await makeRequest('POST', `/plans/${planId}/generate-schedule`, {
        start_date: new Date().toISOString().split('T')[0],
        exam_date: examDate.toISOString().split('T')[0],
        available_days: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: false
        },
        hours_per_day: 4
    });
    
    if (!scheduleResult.success) {
        console.log('❌ Falha ao gerar cronograma');
        return;
    }
    
    console.log('✅ Cronograma gerado com sucesso');
    
    // 6. VERIFICAR DISTRIBUIÇÃO PONDERADA
    console.log('\n🔍 6. Analisando distribuição ponderada do cronograma...');
    
    const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`);
    
    if (!sessionsResult.success) {
        console.log('❌ Erro ao buscar sessões');
        return;
    }
    
    sessions = sessionsResult.data.sessions;
    console.log(`   Total de sessões geradas: ${sessions.length}`);
    
    // Analisar distribuição por disciplina e tópico
    const distribution = {};
    const topicFrequency = {};
    
    sessions.forEach(session => {
        // Contar por disciplina
        if (!distribution[session.subject_name]) {
            distribution[session.subject_name] = 0;
        }
        distribution[session.subject_name]++;
        
        // Contar por tópico
        const key = `${session.subject_name} - ${session.topic_description}`;
        if (!topicFrequency[key]) {
            topicFrequency[key] = 0;
        }
        topicFrequency[key]++;
    });
    
    console.log('\n   📊 Distribuição por Disciplina:');
    Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([subject, count]) => {
            console.log(`      ${subject}: ${count} sessões`);
        });
    
    console.log('\n   📊 Top 5 Tópicos Mais Frequentes:');
    Object.entries(topicFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([topic, count]) => {
            console.log(`      ${topic}: ${count} vezes`);
        });
    
    // Verificar se respeita o algoritmo round-robin ponderado
    console.log('\n   🎯 Validando algoritmo round-robin ponderado:');
    
    // Direito Constitucional (peso 10) deve aparecer mais que Português (peso 8)
    const direitoCount = distribution['Direito Constitucional'] || 0;
    const portuguesCount = distribution['Português'] || 0;
    const informaticaCount = distribution['Informática'] || 0;
    const raciocinioCount = distribution['Raciocínio Lógico'] || 0;
    
    const test1 = direitoCount > portuguesCount;
    const test2 = portuguesCount > informaticaCount;
    const test3 = informaticaCount > raciocinioCount;
    
    console.log(`      Direito (${direitoCount}) > Português (${portuguesCount}): ${test1 ? '✅' : '❌'}`);
    console.log(`      Português (${portuguesCount}) > Informática (${informaticaCount}): ${test2 ? '✅' : '❌'}`);
    console.log(`      Informática (${informaticaCount}) > Raciocínio (${raciocinioCount}): ${test3 ? '✅' : '❌'}`);
    
    // 7. MARCAR ALGUMAS SESSÕES COMO CONCLUÍDAS
    console.log('\n✅ 7. Marcando sessões como concluídas...');
    
    const sessionsToComplete = sessions.slice(0, 5); // Primeiras 5 sessões
    
    for (const session of sessionsToComplete) {
        const completeResult = await makeRequest('POST', `/sessions/${session.id}/status`, {
            status: 'Concluído',
            notes: 'Sessão de teste concluída',
            questions_solved: Math.floor(Math.random() * 50) + 10
        });
        
        if (completeResult.success) {
            console.log(`   ✅ Sessão ${session.id} concluída`);
        } else {
            console.log(`   ❌ Erro ao concluir sessão ${session.id}`);
        }
    }
    
    // 8. VERIFICAR ESTATÍSTICAS E GAMIFICAÇÃO
    console.log('\n🎮 8. Verificando estatísticas e gamificação...');
    
    // Buscar perfil de gamificação
    const gamificationResult = await makeRequest('GET', '/gamification/profile');
    
    if (gamificationResult.success) {
        const profile = gamificationResult.data;
        console.log('\n   🏆 Perfil de Gamificação:');
        console.log(`      XP: ${profile.xp || 0}`);
        console.log(`      Nível: ${profile.level_info?.title || 'N/A'}`);
        console.log(`      Streak: ${profile.current_streak || 0} dias`);
        console.log(`      Conquistas: ${profile.achievements?.length || 0}`);
        
        if (profile.achievements && profile.achievements.length > 0) {
            console.log('\n      🎯 Conquistas Desbloqueadas:');
            profile.achievements.forEach(ach => {
                console.log(`         - ${ach.achievement_id}`);
            });
        }
    } else {
        console.log('   ❌ Erro ao buscar gamificação');
    }
    
    // Buscar estatísticas gerais
    const statsResult = await makeRequest('GET', '/statistics/general');
    
    if (statsResult.success) {
        const stats = statsResult.data;
        console.log('\n   📊 Estatísticas Gerais:');
        console.log(`      Sessões completadas: ${stats.metricas_desempenho?.sessoes_semana || 0}`);
        console.log(`      Horas estudadas: ${stats.metricas_desempenho?.horas_semana || 0}`);
        console.log(`      Progresso semanal: ${stats.graficos_progresso?.progresso_semanal || 0}%`);
    } else {
        console.log('   ❌ Erro ao buscar estatísticas');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 TESTE COMPLETO FINALIZADO');
    console.log('='.repeat(60));
}

// Executar teste
testPlatform().then(() => {
    console.log('\n✨ Script de teste concluído');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});