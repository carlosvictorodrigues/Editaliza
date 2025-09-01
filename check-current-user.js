/**
 * Verificar qual usuário está logado e suas sessões
 */

const db = require('./database-postgresql.js');

async function checkCurrentUser() {
    console.log('🔍 Verificando usuário atual e suas sessões...\n');
    
    try {
        // 1. Verificar último login
        console.log('📌 Últimos logins no sistema:');
        const recentLogins = await db.all(`
            SELECT id, name, email, last_login
            FROM users
            WHERE last_login IS NOT NULL
            ORDER BY last_login DESC
            LIMIT 5
        `);
        
        recentLogins.forEach(u => {
            const loginTime = u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca';
            console.log(`  - ${u.name} (ID: ${u.id}) - ${loginTime}`);
        });
        
        // 2. Verificar o usuário que você está usando
        console.log('\n📌 Verificando seu usuário (editaliza@outlook.com):');
        const yourUser = await db.get(`
            SELECT id, name, email, last_login
            FROM users
            WHERE email = $1
        `, ['editaliza@outlook.com']);
        
        if (yourUser) {
            console.log(`  ✅ Encontrado: ${yourUser.name} (ID: ${yourUser.id})`);
            console.log(`  📧 Email: ${yourUser.email}`);
            console.log(`  🕐 Último login: ${yourUser.last_login ? new Date(yourUser.last_login).toLocaleString('pt-BR') : 'Não registrado'}`);
            
            // 3. Buscar plano ativo deste usuário
            console.log('\n📋 Planos deste usuário:');
            const userPlans = await db.all(`
                SELECT id, plan_name, exam_date
                FROM study_plans
                WHERE user_id = $1
                ORDER BY created_at DESC
            `, [yourUser.id]);
            
            userPlans.forEach(p => {
                console.log(`  - Plano: ${p.plan_name} (ID: ${p.id})`);
            });
            
            if (userPlans.length > 0) {
                const activePlan = userPlans[0];
                
                // 4. Buscar sessões do plano ativo
                console.log(`\n📅 Sessões do plano ativo (${activePlan.plan_name}):`);
                const sessions = await db.all(`
                    SELECT id, subject_name, session_date, status
                    FROM study_sessions
                    WHERE study_plan_id = $1
                    ORDER BY session_date DESC
                    LIMIT 10
                `, [activePlan.id]);
                
                sessions.forEach(s => {
                    const date = new Date(s.session_date).toLocaleDateString('pt-BR');
                    console.log(`  - ID ${s.id}: ${s.subject_name} - ${date} (${s.status})`);
                });
                
                // 5. Verificar se a sessão 11910 pertence a este usuário
                const session11910Owner = await db.get(`
                    SELECT sp.user_id, u.email
                    FROM study_sessions ss
                    JOIN study_plans sp ON ss.study_plan_id = sp.id
                    JOIN users u ON sp.user_id = u.id
                    WHERE ss.id = $1
                `, [11910]);
                
                console.log('\n⚠️ ANÁLISE DO PROBLEMA:');
                console.log('------------------------');
                console.log(`Sessão 11910 pertence ao usuário ${session11910Owner.user_id} (${session11910Owner.email})`);
                console.log(`Você está logado como usuário ${yourUser.id} (${yourUser.email})`);
                
                if (session11910Owner.user_id !== yourUser.id) {
                    console.log('\n❌ PROBLEMA CONFIRMADO:');
                    console.log('O frontend está mostrando sessões de outro usuário!');
                    console.log('\n🔧 SOLUÇÃO NECESSÁRIA:');
                    console.log('1. Verificar se o frontend está usando o planId correto');
                    console.log('2. Limpar cache do navegador (localStorage/sessionStorage)');
                    console.log('3. Verificar se a API está retornando o plano correto para o usuário logado');
                } else {
                    console.log('✅ A sessão pertence ao usuário correto');
                }
            }
        } else {
            console.log('❌ Usuário editaliza@outlook.com não encontrado');
            
            // Buscar usuários com emails similares
            const similarUsers = await db.all(`
                SELECT id, name, email
                FROM users
                WHERE email LIKE '%editaliza%'
                LIMIT 10
            `);
            
            if (similarUsers.length > 0) {
                console.log('\n📧 Usuários com email similar:');
                similarUsers.forEach(u => {
                    console.log(`  - ${u.email} (ID: ${u.id})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        process.exit(0);
    }
}

checkCurrentUser();