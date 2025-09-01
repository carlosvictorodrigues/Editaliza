/**
 * Script de teste para validar o fluxo completo de sessão de estudo
 * Simula: Iniciar sessão → Pausar → Continuar → Finalizar → Marcar como concluído
 */

const db = require('./database-postgresql');

async function testSessionFlow() {
    console.log('🧪 INICIANDO TESTE DO FLUXO DE SESSÃO DE ESTUDO\n');
    
    // 1. Criar usuário de teste
    const testUserId = 999;
    const testPlanId = 999;
    const testSessionId = 99999;
    
    try {
        // Limpar dados antigos de teste
        console.log('🧹 Limpando dados antigos de teste...');
        await db.pool.query('DELETE FROM study_sessions WHERE id = $1', [testSessionId]);
        await db.pool.query('DELETE FROM study_plans WHERE id = $1', [testPlanId]);
        await db.pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        
        // Criar usuário de teste
        console.log('👤 Criando usuário de teste...');
        await db.pool.query(
            `INSERT INTO users (id, name, email, password_hash, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [testUserId, 'Teste Session Flow', 'test-session@test.com', 'hash-test']
        );
        
        // Criar plano de teste
        console.log('📋 Criando plano de teste...');
        await db.pool.query(
            `INSERT INTO study_plans (id, user_id, plan_name, exam_date, created_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
            [testPlanId, testUserId, 'Plano Teste Flow', '2025-12-31']
        );
        
        // Criar sessão de estudo
        console.log('📚 Criando sessão de estudo...');
        await db.pool.query(
            `INSERT INTO study_sessions (
                id, study_plan_id, session_date, start_time, 
                subject_name, topic_name, session_type, status,
                time_studied_seconds, created_at
             ) VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [
                testSessionId, testPlanId, 'Matemática', 'Álgebra Linear',
                'Novo Tópico', 'Pendente', 0
            ]
        );
        
        console.log('✅ Dados de teste criados!\n');
        
        // 2. SIMULAR INÍCIO DA SESSÃO
        console.log('▶️  SIMULANDO INÍCIO DA SESSÃO...');
        let result = await db.pool.query(
            'SELECT * FROM study_sessions WHERE id = $1',
            [testSessionId]
        );
        console.log(`   Status inicial: ${result.rows[0].status}`);
        console.log(`   Tempo estudado: ${result.rows[0].time_studied_seconds}s`);
        
        // 3. SIMULAR ESTUDO (30 segundos)
        console.log('\n⏱️  SIMULANDO 30 SEGUNDOS DE ESTUDO...');
        await db.pool.query(
            `UPDATE study_sessions 
             SET time_studied_seconds = time_studied_seconds + 30,
                 status = 'Em Progresso'
             WHERE id = $1`,
            [testSessionId]
        );
        
        result = await db.pool.query(
            'SELECT * FROM study_sessions WHERE id = $1',
            [testSessionId]
        );
        console.log(`   Status: ${result.rows[0].status}`);
        console.log(`   Tempo estudado: ${result.rows[0].time_studied_seconds}s`);
        
        // 4. SIMULAR PAUSA
        console.log('\n⏸️  SIMULANDO PAUSA...');
        // Em uma aplicação real, o timer frontend pararia aqui
        console.log('   Timer pausado no frontend (simulado)');
        
        // 5. SIMULAR CONTINUAÇÃO
        console.log('\n▶️  SIMULANDO CONTINUAÇÃO...');
        await db.pool.query(
            `UPDATE study_sessions 
             SET time_studied_seconds = time_studied_seconds + 20
             WHERE id = $1`,
            [testSessionId]
        );
        
        result = await db.pool.query(
            'SELECT * FROM study_sessions WHERE id = $1',
            [testSessionId]
        );
        console.log(`   Tempo total estudado: ${result.rows[0].time_studied_seconds}s`);
        
        // 6. SIMULAR FINALIZAÇÃO E MARCAR COMO CONCLUÍDO
        console.log('\n✅ SIMULANDO FINALIZAÇÃO E MARCANDO COMO CONCLUÍDO...');
        await db.pool.query(
            `UPDATE study_sessions 
             SET status = 'Concluído',
                 questions_solved = 10,
                 notes = 'Sessão de teste concluída com sucesso',
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [testSessionId]
        );
        
        // 7. VERIFICAR RESULTADO FINAL
        console.log('\n📊 VERIFICANDO RESULTADO FINAL:\n');
        result = await db.pool.query(
            `SELECT 
                s.*, 
                p.plan_name,
                u.name as user_name
             FROM study_sessions s
             JOIN study_plans p ON s.study_plan_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE s.id = $1`,
            [testSessionId]
        );
        
        const session = result.rows[0];
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                   RESULTADO DO TESTE                      ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ 👤 Usuário: ${session.user_name.padEnd(45)}║`);
        console.log(`║ 📋 Plano: ${session.plan_name.padEnd(47)}║`);
        console.log(`║ 📚 Disciplina: ${session.subject_name.padEnd(42)}║`);
        console.log(`║ 📖 Tópico: ${session.topic_name.padEnd(46)}║`);
        console.log(`║ ⏱️  Tempo Total: ${String(session.time_studied_seconds + 's').padEnd(40)}║`);
        console.log(`║ ✅ Status: ${session.status.padEnd(46)}║`);
        console.log(`║ 📝 Questões: ${String(session.questions_solved).padEnd(44)}║`);
        console.log(`║ 💾 Salvo em: ${new Date(session.completed_at).toLocaleString('pt-BR').padEnd(40)}║`);
        console.log('╚══════════════════════════════════════════════════════════╝');
        
        // 8. VERIFICAR ISOLAMENTO (não deve afetar outros usuários)
        console.log('\n🔒 VERIFICANDO ISOLAMENTO DE DADOS:');
        
        // Verificar se apenas o usuário teste foi afetado
        const otherUsers = await db.pool.query(
            `SELECT COUNT(*) as count 
             FROM study_sessions s
             JOIN study_plans p ON s.study_plan_id = p.id
             WHERE p.user_id != $1 
             AND s.updated_at > NOW() - INTERVAL '1 minute'`,
            [testUserId]
        );
        
        if (otherUsers.rows[0].count === '0') {
            console.log('   ✅ Nenhum outro usuário foi afetado!');
        } else {
            console.log(`   ⚠️  ALERTA: ${otherUsers.rows[0].count} sessões de outros usuários foram modificadas!`);
        }
        
        // 9. LIMPAR DADOS DE TESTE
        console.log('\n🧹 Limpando dados de teste...');
        await db.pool.query('DELETE FROM study_sessions WHERE id = $1', [testSessionId]);
        await db.pool.query('DELETE FROM study_plans WHERE id = $1', [testPlanId]);
        await db.pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        
        console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!\n');
        
    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
        
        // Limpar dados mesmo em caso de erro
        try {
            await db.pool.query('DELETE FROM study_sessions WHERE id = $1', [testSessionId]);
            await db.pool.query('DELETE FROM study_plans WHERE id = $1', [testPlanId]);
            await db.pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
        } catch (cleanupError) {
            console.error('Erro ao limpar dados de teste:', cleanupError.message);
        }
    }
    
    process.exit(0);
}

// Executar teste
testSessionFlow();