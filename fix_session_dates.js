// Script para ajustar datas das sessões para começar hoje
const db = require('./database-postgresql');

async function fixSessionDates() {
    try {
        console.log('🔄 Ajustando datas das sessões...\n');
        
        // Buscar o plano do usuário p@p.com
        const user = await db.get('SELECT id FROM users WHERE email = $1', ['p@p.com']);
        if (!user) {
            console.log('❌ Usuário não encontrado');
            return;
        }
        
        const plan = await db.get('SELECT * FROM study_plans WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [user.id]);
        if (!plan) {
            console.log('❌ Plano não encontrado');
            return;
        }
        
        console.log(`📋 Ajustando plano: ${plan.plan_name || plan.name} (ID: ${plan.id})`);
        
        // Buscar todas as sessões
        const sessions = await db.all(
            'SELECT * FROM study_sessions WHERE study_plan_id = $1 ORDER BY session_date, id',
            [plan.id]
        );
        
        console.log(`📅 ${sessions.length} sessões encontradas`);
        
        if (sessions.length === 0) {
            console.log('❌ Nenhuma sessão para ajustar');
            return;
        }
        
        // Calcular diferença entre primeira sessão e hoje
        const firstSession = sessions[0];
        const firstDate = new Date(firstSession.session_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((firstDate - today) / (1000 * 60 * 60 * 24));
        
        console.log(`📆 Primeira sessão: ${firstDate.toISOString().split('T')[0]}`);
        console.log(`📆 Hoje: ${today.toISOString().split('T')[0]}`);
        console.log(`📆 Diferença: ${daysDiff} dias`);
        
        if (daysDiff <= 0) {
            console.log('✅ Sessões já estão no período correto');
            return;
        }
        
        // Atualizar todas as sessões subtraindo a diferença
        console.log(`\n🔄 Ajustando ${sessions.length} sessões...`);
        
        for (const session of sessions) {
            const oldDate = new Date(session.session_date);
            const newDate = new Date(oldDate);
            newDate.setDate(oldDate.getDate() - daysDiff);
            
            const newDateStr = newDate.toISOString().split('T')[0];
            
            await db.run(
                'UPDATE study_sessions SET session_date = $1 WHERE id = $2',
                [newDateStr, session.id]
            );
        }
        
        console.log('✅ Datas ajustadas com sucesso!');
        
        // Verificar resultado
        const updatedSessions = await db.all(
            'SELECT session_date, COUNT(*) as count FROM study_sessions WHERE study_plan_id = $1 GROUP BY session_date ORDER BY session_date LIMIT 5',
            [plan.id]
        );
        
        console.log('\n📊 Primeiras datas após ajuste:');
        updatedSessions.forEach(row => {
            const date = new Date(row.session_date);
            console.log(`   ${date.toISOString().split('T')[0]}: ${row.count} sessões`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

setTimeout(fixSessionDates, 2000);