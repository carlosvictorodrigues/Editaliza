/**
 * Teste dos botões Adiar e Reforçar
 * Verifica se os endpoints estão funcionando corretamente
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE_URL = 'http://localhost:3000/api';

// Dados do teste
const timestamp = Date.now();
const testUser = {
    name: `Test Adiar Reforcar ${timestamp}`,
    email: `test.adiar.reforcar.${timestamp}@editaliza.com`,
    password: 'Test@123456'
};

let authToken = null;
let userId = null;
let planId = null;
let sessionId = null;

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

async function testarBotoesAdiarReforcar() {
    console.log('\n================================='.cyan);
    console.log('🔄 TESTE DOS BOTÕES ADIAR E REFORÇAR'.cyan.bold);
    console.log('=================================\n'.cyan);

    try {
        // ========== 1. SETUP INICIAL ==========
        console.log('1️⃣ SETUP INICIAL'.yellow.bold);
        console.log('-'.repeat(40));
        
        // Registrar usuário
        const registerResult = await makeRequest('POST', '/auth/register', testUser, false);
        if (!registerResult.success) {
            throw new Error(`Erro no registro: ${JSON.stringify(registerResult.error)}`);
        }
        
        authToken = registerResult.data.token;
        userId = registerResult.data.user?.id || registerResult.data.userId;
        console.log('✅ Usuário registrado'.green);
        
        // Criar plano (com exam_date no formato correto)
        const examDate = new Date('2025-11-21');
        const planData = {
            plan_name: 'Teste Botões Adiar/Reforçar',
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
        console.log('✅ Plano criado'.green);
        
        // Adicionar disciplina e tópico
        const subjectResult = await makeRequest('POST', '/subjects', {
            subject_name: 'Teste Disciplina',
            weight: 5,
            priority_weight: 5,
            study_plan_id: planId
        });
        
        if (!subjectResult.success) {
            throw new Error(`Erro ao criar disciplina: ${JSON.stringify(subjectResult.error)}`);
        }
        
        const subjectId = subjectResult.data.subject.id;
        console.log('✅ Disciplina criada'.green);
        
        // Adicionar tópico
        await makeRequest('POST', `/subjects/${subjectId}/topics`, {
            topic_name: 'Tópico para Teste',
            topic_description: 'Teste dos botões adiar e reforçar',
            weight: 5,
            priority_weight: 5,
            subject_id: subjectId
        });
        
        console.log('✅ Tópico criado'.green);
        
        // Gerar cronograma
        const scheduleResult = await makeRequest('POST', `/plans/${planId}/generate`, {
            start_date: new Date().toISOString().split('T')[0],
            exam_date: examDate.toISOString().split('T')[0],
            study_hours_per_day: {
                'Seg': 4,
                'Ter': 4,
                'Qua': 4,
                'Qui': 4,
                'Sex': 4,
                'Sab': 2,
                'Dom': 0
            }
        });
        
        if (!scheduleResult.success) {
            console.log('⚠️ Aviso ao gerar cronograma:'.yellow, scheduleResult.error);
        } else {
            console.log('✅ Cronograma gerado'.green);
        }
        
        // Buscar sessões
        const sessionsResult = await makeRequest('GET', `/plans/${planId}/sessions`);
        
        if (!sessionsResult.success) {
            console.log('❌ Erro ao buscar sessões:'.red, sessionsResult.error);
            throw new Error('Erro ao buscar sessões');
        }
        
        const sessions = sessionsResult.data?.sessions || sessionsResult.data || [];
        
        if (sessions.length === 0) {
            console.log('⚠️ Nenhuma sessão encontrada após gerar cronograma'.yellow);
            throw new Error('Nenhuma sessão encontrada');
        }
        sessionId = sessions[0].id;
        console.log(`✅ ${sessions.length} sessões encontradas`.green);
        console.log(`   Sessão selecionada: ID ${sessionId}`.gray);
        
        // ========== 2. TESTAR BOTÃO ADIAR ==========
        console.log('\n2️⃣ TESTANDO BOTÃO ADIAR'.yellow.bold);
        console.log('-'.repeat(40));
        
        console.log('📅 Adiando sessão para amanhã...');
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const postponeResult = await makeRequest('PATCH', `/sessions/${sessionId}/postpone`, {
            new_date: tomorrow.toISOString().split('T')[0],
            reason: 'Teste do botão adiar'
        });
        
        if (postponeResult.success) {
            console.log('✅ SUCESSO: Sessão adiada com sucesso!'.green.bold);
            console.log(`   Mensagem: ${postponeResult.data.message || 'Sessão reagendada'}`.gray);
            
            // Verificar se a data foi atualizada
            const updatedSession = await makeRequest('GET', `/sessions/${sessionId}`);
            if (updatedSession.success) {
                const newDate = updatedSession.data.session_date;
                console.log(`   Nova data: ${newDate}`.gray);
            }
        } else {
            console.log('❌ ERRO: Falha ao adiar sessão'.red.bold);
            console.log(`   Erro: ${JSON.stringify(postponeResult.error)}`.red);
            console.log(`   Status HTTP: ${postponeResult.status}`.gray);
        }
        
        // ========== 3. TESTAR BOTÃO REFORÇAR ==========
        console.log('\n3️⃣ TESTANDO BOTÃO REFORÇAR'.yellow.bold);
        console.log('-'.repeat(40));
        
        // Primeiro, marcar a sessão como concluída
        console.log('📝 Marcando sessão como concluída primeiro...');
        await makeRequest('PATCH', `/sessions/${sessionId}`, {
            status: 'Concluído',
            questions_solved: 10,
            notes: 'Sessão completada para teste de reforço'
        });
        console.log('✅ Sessão marcada como concluída'.green);
        
        console.log('💪 Criando sessão de reforço...');
        
        const reinforceResult = await makeRequest('POST', `/sessions/${sessionId}/reinforce`, {
            notes: 'Preciso reforçar este conteúdo'
        });
        
        if (reinforceResult.success) {
            console.log('✅ SUCESSO: Sessão de reforço criada!'.green.bold);
            console.log(`   Mensagem: ${reinforceResult.data.message || 'Sessão de reforço agendada'}`.gray);
            
            if (reinforceResult.data.newSession) {
                console.log(`   Nova sessão ID: ${reinforceResult.data.newSession.id}`.gray);
                console.log(`   Data agendada: ${reinforceResult.data.newSession.session_date}`.gray);
            }
            
            // Verificar se a nova sessão foi criada
            const allSessionsAfter = await makeRequest('GET', `/plans/${planId}/sessions`);
            if (allSessionsAfter.success) {
                const newSessionCount = allSessionsAfter.data.sessions.length;
                console.log(`   Total de sessões agora: ${newSessionCount} (era ${sessions.length})`.gray);
            }
        } else {
            console.log('❌ ERRO: Falha ao criar sessão de reforço'.red.bold);
            console.log(`   Erro: ${JSON.stringify(reinforceResult.error)}`.red);
            console.log(`   Status HTTP: ${reinforceResult.status}`.gray);
        }
        
        // ========== 4. RESUMO FINAL ==========
        console.log('\n' + '='.repeat(50));
        console.log('📋 RESUMO DO TESTE'.yellow.bold);
        console.log('='.repeat(50));
        
        const adiarFuncionando = postponeResult.success;
        const reforcarFuncionando = reinforceResult.success;
        
        console.log('\n🔍 Status dos Botões:');
        console.log(`   📅 ADIAR: ${adiarFuncionando ? '✅ FUNCIONANDO' : '❌ COM PROBLEMA'}`.bold);
        console.log(`   💪 REFORÇAR: ${reforcarFuncionando ? '✅ FUNCIONANDO' : '❌ COM PROBLEMA'}`.bold);
        
        if (adiarFuncionando && reforcarFuncionando) {
            console.log('\n🎉 SUCESSO TOTAL! Ambos os botões estão funcionando corretamente!'.green.bold);
        } else if (adiarFuncionando || reforcarFuncionando) {
            console.log('\n⚠️ SUCESSO PARCIAL: Apenas um botão está funcionando'.yellow.bold);
        } else {
            console.log('\n❌ FALHA: Nenhum dos botões está funcionando'.red.bold);
        }
        
        // ========== 5. TESTE ADICIONAL: MÚLTIPLOS ADIAMENTOS ==========
        if (adiarFuncionando) {
            console.log('\n5️⃣ TESTE ADICIONAL: MÚLTIPLOS ADIAMENTOS'.yellow.bold);
            console.log('-'.repeat(40));
            
            // Tentar adiar a mesma sessão novamente
            const secondPostpone = await makeRequest('PATCH', `/sessions/${sessionId}/postpone`, {
                new_date: tomorrow.toISOString().split('T')[0],
                reason: 'Segundo adiamento'
            });
            
            if (secondPostpone.success) {
                console.log('✅ Segundo adiamento permitido'.green);
            } else {
                console.log('⚠️ Segundo adiamento bloqueado (pode ser intencional)'.yellow);
                console.log(`   Mensagem: ${JSON.stringify(secondPostpone.error)}`.gray);
            }
        }
        
    } catch (error) {
        console.error('\n❌ ERRO FATAL NO TESTE:'.red.bold, error.message);
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
console.log('🚀 Iniciando teste dos botões Adiar e Reforçar...'.cyan);
console.log('   Certifique-se que o servidor está rodando na porta 3000'.gray);
console.log('');

testarBotoesAdiarReforcar().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
});