/**
 * Script para verificar sessões do usuário u@u.com
 * e testar o fluxo de atualização de sessão
 */

const db = require('./database-postgresql');

async function verifyUserSessions() {
    console.log('🔍 VERIFICANDO DADOS DO USUÁRIO u@u.com\n');
    
    try {
        // 1. Buscar o usuário
        console.log('👤 Buscando usuário u@u.com...');
        const userResult = await db.pool.query(
            "SELECT id, name, email FROM users WHERE email = 'u@u.com'"
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ Usuário u@u.com não encontrado!');
            process.exit(1);
        }
        
        const user = userResult.rows[0];
        console.log(`✅ Usuário encontrado: ID=${user.id}, Nome=${user.name}\n`);
        
        // 2. Buscar planos do usuário
        console.log('📋 Buscando planos do usuário...');
        const plansResult = await db.pool.query(
            'SELECT id, plan_name, exam_date FROM study_plans WHERE user_id = $1 ORDER BY id DESC',
            [user.id]
        );
        
        console.log(`📊 Total de planos: ${plansResult.rows.length}`);
        if (plansResult.rows.length > 0) {
            console.log('\nPlanos encontrados:');
            plansResult.rows.forEach(plan => {
                console.log(`  - ID: ${plan.id} | Nome: ${plan.plan_name} | Data Prova: ${plan.exam_date}`);
            });
        }
        
        // 3. Buscar sessões recentes
        console.log('\n📚 Buscando sessões de estudo recentes...');
        const sessionsResult = await db.pool.query(
            `SELECT 
                s.id,
                s.session_date,
                s.subject_name,
                s.topic_name,
                s.status,
                s.time_studied_seconds,
                s.questions_solved,
                s.created_at,
                s.updated_at
             FROM study_sessions s
             JOIN study_plans p ON s.study_plan_id = p.id
             WHERE p.user_id = $1
             ORDER BY s.id DESC
             LIMIT 10`,
            [user.id]
        );
        
        console.log(`📊 Total de sessões encontradas: ${sessionsResult.rows.length}\n`);
        
        if (sessionsResult.rows.length > 0) {
            console.log('Últimas sessões:');
            console.log('═══════════════════════════════════════════════════════════════════════════════');
            console.log('ID     | Data       | Disciplina      | Status      | Tempo (s) | Questões');
            console.log('───────┼────────────┼─────────────────┼─────────────┼───────────┼─────────');
            
            sessionsResult.rows.forEach(session => {
                const id = String(session.id).padEnd(6);
                const date = new Date(session.session_date).toLocaleDateString('pt-BR').padEnd(10);
                const subject = (session.subject_name || '').substring(0, 15).padEnd(15);
                const status = (session.status || 'Pendente').padEnd(11);
                const time = String(session.time_studied_seconds || 0).padEnd(9);
                const questions = String(session.questions_solved || 0);
                
                console.log(`${id} | ${date} | ${subject} | ${status} | ${time} | ${questions}`);
            });
            console.log('═══════════════════════════════════════════════════════════════════════════════');
            
            // 4. Testar atualização de uma sessão pendente
            const pendingSession = sessionsResult.rows.find(s => s.status === 'Pendente');
            if (pendingSession) {
                console.log(`\n🧪 TESTANDO ATUALIZAÇÃO DA SESSÃO ${pendingSession.id}...`);
                
                // Simular 30 segundos de estudo
                console.log('⏱️  Adicionando 30 segundos de estudo...');
                await db.pool.query(
                    `UPDATE study_sessions 
                     SET time_studied_seconds = COALESCE(time_studied_seconds, 0) + 30,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [pendingSession.id]
                );
                
                // Marcar como concluída
                console.log('✅ Marcando sessão como concluída...');
                await db.pool.query(
                    `UPDATE study_sessions 
                     SET status = 'Concluído',
                         questions_solved = COALESCE(questions_solved, 0) + 5,
                         completed_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [pendingSession.id]
                );
                
                // Verificar resultado
                const updatedResult = await db.pool.query(
                    'SELECT * FROM study_sessions WHERE id = $1',
                    [pendingSession.id]
                );
                
                const updated = updatedResult.rows[0];
                console.log('\n📊 SESSÃO ATUALIZADA:');
                console.log(`   Status: ${updated.status}`);
                console.log(`   Tempo estudado: ${updated.time_studied_seconds}s`);
                console.log(`   Questões resolvidas: ${updated.questions_solved}`);
                console.log(`   Atualizado em: ${new Date(updated.updated_at).toLocaleString('pt-BR')}`);
                
                // Reverter para não afetar dados reais
                console.log('\n🔄 Revertendo alterações de teste...');
                await db.pool.query(
                    `UPDATE study_sessions 
                     SET status = $1,
                         time_studied_seconds = $2,
                         questions_solved = $3,
                         completed_at = NULL,
                         updated_at = $4
                     WHERE id = $5`,
                    [
                        pendingSession.status,
                        pendingSession.time_studied_seconds || 0,
                        pendingSession.questions_solved || 0,
                        pendingSession.updated_at,
                        pendingSession.id
                    ]
                );
                console.log('✅ Dados originais restaurados!');
            } else {
                console.log('\n⚠️  Nenhuma sessão pendente encontrada para teste.');
            }
        } else {
            console.log('⚠️  Nenhuma sessão encontrada para este usuário.');
        }
        
        // 5. Verificar isolamento - confirmar que não há planos de outros usuários
        console.log('\n🔒 VERIFICANDO ISOLAMENTO DE DADOS:');
        const wrongPlansResult = await db.pool.query(
            `SELECT COUNT(*) as count 
             FROM study_plans 
             WHERE user_id != $1`,
            [user.id]
        );
        
        const otherUsersPlans = parseInt(wrongPlansResult.rows[0].count);
        if (otherUsersPlans > 0) {
            console.log(`   ℹ️  Existem ${otherUsersPlans} planos de outros usuários no sistema.`);
            
            // Verificar se algum plano de outro usuário seria retornado incorretamente
            const wrongDataResult = await db.pool.query(
                `SELECT p.id, p.plan_name, u.email 
                 FROM study_plans p
                 JOIN users u ON p.user_id = u.id
                 WHERE u.email != 'u@u.com'
                 LIMIT 3`
            );
            
            if (wrongDataResult.rows.length > 0) {
                console.log('   Exemplos de planos de OUTROS usuários (não devem aparecer para u@u.com):');
                wrongDataResult.rows.forEach(plan => {
                    console.log(`     - Plano ${plan.id}: "${plan.plan_name}" (usuário: ${plan.email})`);
                });
            }
        } else {
            console.log('   ✅ Sistema contém apenas dados do usuário de teste.');
        }
        
        console.log('\n✅ VERIFICAÇÃO CONCLUÍDA!\n');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

// Executar verificação
verifyUserSessions();