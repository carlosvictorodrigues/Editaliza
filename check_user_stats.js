// Script para verificar estatísticas do usuário c@c.com
const fetch = require('node-fetch');

async function checkStats() {
    console.log('🔍 Verificando estatísticas do usuário c@c.com\n');
    
    try {
        // 1. Fazer login
        console.log('1️⃣ Fazendo login...');
        const loginResponse = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'c@c.com',
                password: '123456'
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.token) {
            console.error('❌ Erro no login:', loginData);
            return;
        }
        
        const token = loginData.token;
        console.log('✅ Login bem-sucedido!\n');
        
        // 2. Buscar planos
        console.log('2️⃣ Buscando planos...');
        const plansResponse = await fetch('http://localhost:3000/plans', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const plans = await plansResponse.json();
        if (!plans || plans.length === 0) {
            console.log('❌ Nenhum plano encontrado');
            return;
        }
        
        const plan = plans[0];
        console.log(`✅ Plano encontrado: ${plan.plan_name} (ID: ${plan.id})\n`);
        
        // 3. Buscar dados de gamificação
        console.log('3️⃣ Buscando dados de gamificação...');
        const gamificationResponse = await fetch(`http://localhost:3000/plans/${plan.id}/gamification`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const gamificationData = await gamificationResponse.json();
        console.log('📊 DADOS DE GAMIFICAÇÃO:');
        console.log(JSON.stringify(gamificationData, null, 2));
        console.log('');
        
        // 4. Buscar sessões de hoje
        console.log('4️⃣ Buscando sessões de hoje...');
        const todayResponse = await fetch(`http://localhost:3000/schedules/${plan.id}/today`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const todayData = await todayResponse.json();
        console.log('📅 SESSÕES DE HOJE:');
        console.log(`   Total: ${todayData.sessions?.length || 0}`);
        if (todayData.sessions) {
            const completed = todayData.sessions.filter(s => s.status === 'Concluído').length;
            console.log(`   Concluídas: ${completed}`);
            console.log(`   Pendentes: ${todayData.sessions.length - completed}`);
        }
        console.log('');
        
        // 5. Buscar dados de progresso
        console.log('5️⃣ Buscando dados de progresso...');
        const progressResponse = await fetch(`http://localhost:3000/plans/${plan.id}/progress`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            console.log('📈 PROGRESSO:');
            console.log(JSON.stringify(progressData, null, 2));
        } else {
            console.log('⚠️ Endpoint de progresso não disponível');
        }
        
        // 6. Análise do problema
        console.log('\n' + '='.repeat(60));
        console.log('🔍 ANÁLISE DO PROBLEMA:\n');
        
        if (gamificationData.completedTopicsCount === 0) {
            console.log('⚠️ Nenhum tópico marcado como concluído');
            console.log('   → Verifique se existem sessões com status "Concluído"');
            console.log('   → Verifique se as sessões têm session_type = "Novo Tópico"');
        }
        
        if (gamificationData.experiencePoints === 0) {
            console.log('⚠️ XP está zerado');
            console.log('   → Indica que não há sessões concluídas no banco');
        }
        
        if (gamificationData.totalStudyDays === 0) {
            console.log('⚠️ Total de dias está zerado');
            console.log('   → Nenhuma sessão foi marcada como concluída');
        }
        
        console.log('\n💡 SOLUÇÃO:');
        console.log('   1. Marque pelo menos uma sessão como concluída');
        console.log('   2. As estatísticas devem atualizar automaticamente');
        console.log('   3. Se não atualizar, pode haver problema no cálculo');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

checkStats();