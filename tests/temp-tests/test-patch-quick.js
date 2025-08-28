/**
 * Teste rápido do PATCH /api/sessions/:sessionId após reiniciar servidor
 */

const axios = require('axios');

async function testQuick() {
    console.log('🔄 Teste Rápido - PATCH Sessions (após reiniciar servidor)\n');
    
    try {
        // 1. Registrar usuário novo
        const timestamp = Date.now();
        const userData = {
            name: `Test User ${timestamp}`,
            email: `test.${timestamp}@editaliza.com`,
            password: 'Test@123!',
            confirmPassword: 'Test@123!'
        };
        
        console.log('1️⃣ Registrando novo usuário...');
        const registerResponse = await axios.post('http://localhost:3000/api/auth/register', userData);
        const { token, user } = registerResponse.data;
        console.log('✅ Usuário registrado - ID:', user.id, '\n');
        
        // 2. Criar plano
        console.log('2️⃣ Criando plano de estudos...');
        const planResponse = await axios.post('http://localhost:3000/api/plans', {
            plan_name: 'Teste PATCH',
            exam_date: '2025-12-31',
            study_hours_per_day: {"0":2,"1":2,"2":2,"3":2,"4":2,"5":2,"6":2},
            daily_question_goal: 10,
            weekly_question_goal: 70,
            session_duration_minutes: 30
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const planId = planResponse.data.planId || planResponse.data.id || planResponse.data.plan?.id;
        console.log('✅ Plano criado - ID:', planId, '\n');
        console.log('   Resposta completa:', JSON.stringify(planResponse.data, null, 2));
        
        // 3. Adicionar disciplina
        console.log('3️⃣ Adicionando disciplina...');
        const subjectResponse = await axios.post(`http://localhost:3000/api/plans/${planId}/subjects`, {
            name: 'Teste',
            weight: 5
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const subjectId = subjectResponse.data.id;
        console.log('✅ Disciplina criada - ID:', subjectId, '\n');
        
        // 4. Adicionar tópico
        console.log('4️⃣ Adicionando tópico...');
        const topicResponse = await axios.post(`http://localhost:3000/api/subjects/${subjectId}/topics`, {
            topic_name: 'Tópico Teste',
            priority_weight: 5,
            status: 'Não Iniciado'
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Tópico criado\n');
        
        // 5. Gerar cronograma
        console.log('5️⃣ Gerando cronograma...');
        await axios.post(`http://localhost:3000/api/plans/${planId}/generate`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Cronograma gerado\n');
        
        // 6. Buscar sessões
        console.log('6️⃣ Buscando sessões criadas...');
        const sessionsResponse = await axios.get(`http://localhost:3000/api/plans/${planId}/sessions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const sessions = sessionsResponse.data.sessions || sessionsResponse.data;
        const sessionId = sessions[0]?.id;
        
        if (!sessionId) {
            console.error('❌ Nenhuma sessão encontrada');
            return;
        }
        
        console.log('✅ Sessão encontrada - ID:', sessionId, '\n');
        
        // 7. TESTAR O PATCH
        console.log('7️⃣ Testando PATCH /api/sessions/' + sessionId);
        console.log('   Body: { status: "Concluído" }\n');
        
        const startTime = Date.now();
        
        const patchResponse = await axios.patch(`http://localhost:3000/api/sessions/${sessionId}`, {
            status: 'Concluído'
        }, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 10000
        });
        
        const duration = Date.now() - startTime;
        
        console.log('✅ SUCESSO! Sessão atualizada');
        console.log('⏱️  Tempo de resposta:', duration, 'ms');
        console.log('📥 Resposta:', patchResponse.data);
        
        if (duration < 1000) {
            console.log('\n🎉 PROBLEMA TOTALMENTE RESOLVIDO!');
            console.log('✅ Middleware corrigido');
            console.log('✅ Database wrapper corrigido');
            console.log('✅ Resposta rápida sem timeout');
        } else if (duration < 5000) {
            console.log('\n⚠️ Funciona mas está lento');
        }
        
    } catch (error) {
        console.error('\n❌ Erro no teste:');
        
        if (error.code === 'ECONNABORTED') {
            console.error('⏱️ TIMEOUT - Query ainda trava');
            console.error('❗ Servidor precisa ser reiniciado com as correções');
        } else if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Erro:', error.response.data);
            
            if (error.response.status === 500 && error.response.data.details) {
                console.error('\n💡 Detalhes do erro:', error.response.data.details);
            }
        } else {
            console.error('Erro:', error.message);
        }
    }
}

console.log('========================================');
console.log('   TESTE APÓS REINICIAR SERVIDOR');
console.log('========================================\n');

testQuick().then(() => {
    console.log('\n========================================');
    process.exit(0);
}).catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});