/**
 * Script simplificado para verificar dados do usuário u@u.com
 */

const db = require('./database-postgresql');

async function checkUser() {
    console.log('🔍 VERIFICANDO USUÁRIO u@u.com\n');
    
    try {
        // 1. Buscar o usuário
        const userResult = await db.pool.query(
            "SELECT id, name, email FROM users WHERE email = 'u@u.com'"
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ Usuário u@u.com não encontrado!');
            process.exit(1);
        }
        
        const user = userResult.rows[0];
        console.log('👤 USUÁRIO ENCONTRADO:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Nome: ${user.name}`);
        console.log(`   Email: ${user.email}\n`);
        
        // 2. Buscar planos
        const plansResult = await db.pool.query(
            'SELECT id, plan_name, exam_date, created_at FROM study_plans WHERE user_id = $1 ORDER BY id DESC',
            [user.id]
        );
        
        console.log(`📋 PLANOS DO USUÁRIO: ${plansResult.rows.length} encontrado(s)`);
        plansResult.rows.forEach(plan => {
            console.log(`\n   Plano ID: ${plan.id}`);
            console.log(`   Nome: ${plan.plan_name}`);
            console.log(`   Data Prova: ${new Date(plan.exam_date).toLocaleDateString('pt-BR')}`);
            console.log(`   Criado em: ${new Date(plan.created_at).toLocaleString('pt-BR')}`);
        });
        
        // 3. Buscar sessões
        console.log('\n📚 BUSCANDO SESSÕES DE ESTUDO...');
        const sessionsResult = await db.pool.query(
            `SELECT 
                s.id,
                s.study_plan_id,
                s.session_date,
                s.subject_name,
                s.session_type,
                s.status,
                s.time_studied_seconds,
                s.questions_solved,
                s.topic_id
             FROM study_sessions s
             WHERE s.study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $1)
             ORDER BY s.id DESC
             LIMIT 20`,
            [user.id]
        );
        
        console.log(`\n📊 SESSÕES ENCONTRADAS: ${sessionsResult.rows.length}`);
        
        if (sessionsResult.rows.length > 0) {
            console.log('\n════════════════════════════════════════════════════════════════════════');
            console.log('ID      | Plano | Data       | Disciplina     | Status     | Tempo(s)');
            console.log('────────┼───────┼────────────┼────────────────┼────────────┼─────────');
            
            sessionsResult.rows.forEach(s => {
                const id = String(s.id).padEnd(7);
                const planId = String(s.study_plan_id).padEnd(5);
                const date = new Date(s.session_date).toLocaleDateString('pt-BR').padEnd(10);
                const subject = (s.subject_name || 'N/A').substring(0, 14).padEnd(14);
                const status = (s.status || 'Pendente').substring(0, 10).padEnd(10);
                const time = String(s.time_studied_seconds || 0);
                
                console.log(`${id} | ${planId} | ${date} | ${subject} | ${status} | ${time}`);
            });
            console.log('════════════════════════════════════════════════════════════════════════');
            
            // Estatísticas
            const pendingCount = sessionsResult.rows.filter(s => s.status === 'Pendente').length;
            const completedCount = sessionsResult.rows.filter(s => s.status === 'Concluído').length;
            const totalTime = sessionsResult.rows.reduce((sum, s) => sum + (s.time_studied_seconds || 0), 0);
            
            console.log('\n📈 ESTATÍSTICAS:');
            console.log(`   Sessões Pendentes: ${pendingCount}`);
            console.log(`   Sessões Concluídas: ${completedCount}`);
            console.log(`   Tempo Total Estudado: ${Math.floor(totalTime / 60)} minutos (${totalTime}s)`);
        }
        
        // 4. Verificar isolamento
        console.log('\n🔒 VERIFICAÇÃO DE SEGURANÇA:');
        
        // Verificar se há planos de outros usuários sendo retornados
        const securityCheckResult = await db.pool.query(
            `SELECT 
                p.id as plan_id,
                p.user_id,
                p.plan_name,
                u.email
             FROM study_plans p
             JOIN users u ON p.user_id = u.id
             WHERE p.id IN (
                SELECT DISTINCT study_plan_id 
                FROM study_sessions 
                WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = $1)
             )`,
            [user.id]
        );
        
        const wrongUserPlans = securityCheckResult.rows.filter(p => p.user_id !== user.id);
        
        if (wrongUserPlans.length > 0) {
            console.log('   ⚠️  ALERTA: Planos de outros usuários detectados!');
            wrongUserPlans.forEach(p => {
                console.log(`      - Plano ${p.plan_id} pertence ao usuário ${p.email} (ID: ${p.user_id})`);
            });
        } else {
            console.log('   ✅ Todos os planos e sessões pertencem ao usuário correto!');
        }
        
        console.log('\n✅ VERIFICAÇÃO CONCLUÍDA!\n');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
    }
    
    process.exit(0);
}

checkUser();