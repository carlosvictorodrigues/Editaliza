// Script para verificar sessões do usuário p@p.com
const db = require('./database-postgresql');

async function checkUserSessions() {
    try {
        console.log('🔍 Verificando dados do usuário p@p.com...\n');
        
        // Buscar usuário
        const user = await db.get('SELECT * FROM users WHERE email = $1', ['p@p.com']);
        if (!user) {
            console.log('❌ Usuário p@p.com não encontrado!');
            return;
        }
        console.log('✅ Usuário encontrado:', { id: user.id, email: user.email });
        
        // Buscar planos do usuário
        const plans = await db.all('SELECT * FROM study_plans WHERE user_id = $1', [user.id]);
        console.log(`\n📚 Planos encontrados: ${plans.length}`);
        
        for (const plan of plans) {
            console.log(`\n📋 Plano: ${plan.plan_name || plan.name} (ID: ${plan.id})`);
            console.log(`   Data do exame: ${plan.exam_date}`);
            console.log(`   Horas por dia: ${plan.hours_per_day || plan.study_hours_per_day}`);
            
            // Buscar sessões do plano
            const sessions = await db.all(
                'SELECT * FROM study_sessions WHERE study_plan_id = $1 ORDER BY session_date, id', 
                [plan.id]
            );
            
            console.log(`   📅 Sessões encontradas: ${sessions.length}`);
            
            if (sessions.length > 0) {
                // Mostrar primeiras 5 sessões
                console.log('\n   Primeiras sessões:');
                sessions.slice(0, 5).forEach(session => {
                    console.log(`   - ${session.session_date}: ${session.subject_name} | ${session.topic_name} | Status: ${session.status}`);
                });
                
                // Agrupar por data
                const byDate = {};
                sessions.forEach(s => {
                    if (!byDate[s.session_date]) byDate[s.session_date] = [];
                    byDate[s.session_date].push(s);
                });
                
                console.log(`\n   Distribuição por data:`);
                Object.keys(byDate).slice(0, 5).forEach(date => {
                    console.log(`   - ${date}: ${byDate[date].length} sessões`);
                });
            }
            
            // Buscar disciplinas e tópicos
            const subjects = await db.all(
                'SELECT * FROM subjects WHERE study_plan_id = $1',
                [plan.id]
            );
            console.log(`\n   📚 Disciplinas: ${subjects.length}`);
            
            for (const subject of subjects.slice(0, 3)) {
                const topics = await db.all(
                    'SELECT COUNT(*) as count FROM topics WHERE subject_id = $1',
                    [subject.id]
                );
                console.log(`   - ${subject.name}: ${topics[0].count} tópicos`);
            }
        }
        
        console.log('\n✅ Verificação concluída!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

// Dar tempo para conexão com banco
setTimeout(checkUserSessions, 2000);