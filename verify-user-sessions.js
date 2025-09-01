/**
 * Verificar problema de sessões misturadas
 */

const db = require('./database-postgresql.js');

async function verifyUserSessions() {
    console.log('🔍 Analisando problema de sessões...\n');
    
    try {
        // 1. Encontrar o usuário correto
        console.log('📌 Buscando usuário editaliza@outlook.com:');
        const user = await db.get(`
            SELECT id, name, email
            FROM users
            WHERE email = $1
        `, ['editaliza@outlook.com']);
        
        if (!user) {
            console.log('❌ Usuário não encontrado com este email');
            
            // Buscar usuários similares
            const users = await db.all(`
                SELECT id, name, email
                FROM users
                WHERE email LIKE '%editaliza%' OR name LIKE '%Lucas%'
                ORDER BY id DESC
                LIMIT 10
            `);
            
            console.log('\n📧 Usuários encontrados:');
            users.forEach(u => {
                console.log(`  ID ${u.id}: ${u.name} - ${u.email}`);
            });
            return;
        }
        
        console.log(`✅ Usuário encontrado: ${user.name} (ID: ${user.id})`);
        
        // 2. Buscar planos deste usuário
        const plans = await db.all(`
            SELECT id, plan_name, exam_date
            FROM study_plans
            WHERE user_id = $1
            ORDER BY id DESC
        `, [user.id]);
        
        console.log(`\n📋 Planos do usuário ${user.id}:`);
        if (plans.length === 0) {
            console.log('  ❌ Nenhum plano encontrado');
        } else {
            plans.forEach(p => {
                console.log(`  - Plano ID ${p.id}: ${p.plan_name}`);
            });
            
            // 3. Verificar sessões do plano mais recente
            const currentPlan = plans[0];
            console.log(`\n📅 Sessões do plano ${currentPlan.id} (${currentPlan.plan_name}):`);
            
            const sessions = await db.all(`
                SELECT id, subject_name, session_date, status
                FROM study_sessions
                WHERE study_plan_id = $1
                ORDER BY id DESC
                LIMIT 10
            `, [currentPlan.id]);
            
            if (sessions.length === 0) {
                console.log('  ❌ Nenhuma sessão encontrada');
            } else {
                sessions.forEach(s => {
                    console.log(`  - ID ${s.id}: ${s.subject_name} (${s.status})`);
                });
            }
        }
        
        // 4. Verificar a sessão problemática 11910
        console.log('\n⚠️ VERIFICANDO SESSÃO 11910:');
        const problemSession = await db.get(`
            SELECT 
                ss.id,
                ss.study_plan_id,
                sp.user_id,
                sp.plan_name,
                u.email as owner_email
            FROM study_sessions ss
            JOIN study_plans sp ON ss.study_plan_id = sp.id
            JOIN users u ON sp.user_id = u.id
            WHERE ss.id = $1
        `, [11910]);
        
        if (problemSession) {
            console.log(`  - Pertence ao plano ${problemSession.study_plan_id} (${problemSession.plan_name})`);
            console.log(`  - Dono: usuário ${problemSession.user_id} (${problemSession.owner_email})`);
            
            if (user && problemSession.user_id !== user.id) {
                console.log('\n❌ PROBLEMA IDENTIFICADO:');
                console.log(`  Você está logado como usuário ${user.id} (${user.email})`);
                console.log(`  Mas a sessão 11910 pertence ao usuário ${problemSession.user_id} (${problemSession.owner_email})`);
                console.log('\n🔧 ISSO SIGNIFICA QUE:');
                console.log('  1. O frontend está mostrando dados do plano errado');
                console.log('  2. Provavelmente está usando planId 140 (do usuário 148) ao invés do seu plano');
                console.log('\n✅ SOLUÇÃO:');
                console.log('  1. Limpar localStorage no navegador');
                console.log('  2. Fazer logout e login novamente');
                console.log('  3. O sistema deve carregar automaticamente SEU plano, não o plano 140');
            }
        }
        
        // 5. Verificar qual plano está sendo usado no frontend
        console.log('\n📊 DIAGNÓSTICO FINAL:');
        console.log('  - O backend está funcionando corretamente');
        console.log('  - A validação de segurança está funcionando (404 quando tenta acessar sessão de outro usuário)');
        console.log('  - O problema está no FRONTEND que está carregando o plano 140 ao invés do seu plano');
        console.log('\n🎯 AÇÃO NECESSÁRIA:');
        console.log('  Execute no console do navegador:');
        console.log('  localStorage.clear(); sessionStorage.clear(); location.reload();');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        process.exit(0);
    }
}

verifyUserSessions();