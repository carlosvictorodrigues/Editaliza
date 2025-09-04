const { Pool } = require('pg');

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d'
});

async function cleanSessions() {
    try {
        console.log('\n🗑️ LIMPANDO SESSÕES ÓRFÃS DO PLANO 140...');
        console.log('=========================================\n');
        
        // Mostrar antes
        const beforeResult = await pool.query(`
            SELECT COUNT(*) as total FROM study_sessions WHERE study_plan_id = 140
        `);
        console.log(`📊 Antes: ${beforeResult.rows[0].total} sessões no plano 140`);
        
        // Deletar sessões órfãs
        const deleteResult = await pool.query(
            'DELETE FROM study_sessions WHERE study_plan_id = 140 AND user_id IS NULL'
        );
        console.log(`\n✅ ${deleteResult.rowCount} sessões órfãs deletadas!`);
        
        // Mostrar depois
        const afterResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as concluidas,
                COUNT(CASE WHEN DATE(session_date) = CURRENT_DATE THEN 1 END) as hoje
            FROM study_sessions 
            WHERE user_id = 148
        `);
        
        console.log('\n📊 SITUAÇÃO ATUAL DO USUÁRIO u@u.com:');
        console.log('======================================');
        console.log(`Total de sessões: ${afterResult.rows[0].total}`);
        console.log(`Sessões concluídas: ${afterResult.rows[0].concluidas}`);
        console.log(`Sessões de hoje: ${afterResult.rows[0].hoje}`);
        
        // Adicionar 3 sessões de teste para hoje
        console.log('\n➕ Adicionando 3 sessões de teste para HOJE...');
        
        for (let i = 1; i <= 3; i++) {
            const result = await pool.query(`
                INSERT INTO study_sessions (
                    user_id,
                    study_plan_id,
                    session_type,
                    status,
                    session_date,
                    created_at,
                    updated_at,
                    time_studied_seconds,
                    duration_minutes
                ) VALUES (
                    148,
                    140,
                    'Novo Tópico',
                    'Concluído',
                    CURRENT_DATE,
                    NOW(),
                    NOW(),
                    1800,
                    30
                ) RETURNING id
            `);
            console.log(`  ✓ Sessão ${i} criada com ID: ${result.rows[0].id}`);
        }
        
        // Verificar resultado final
        const finalResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as concluidas,
                COUNT(CASE WHEN DATE(session_date) = CURRENT_DATE THEN 1 END) as hoje
            FROM study_sessions 
            WHERE user_id = 148
        `);
        
        console.log('\n🎉 RESULTADO FINAL:');
        console.log('===================');
        console.log(`Total de sessões: ${finalResult.rows[0].total}`);
        console.log(`Sessões concluídas: ${finalResult.rows[0].concluidas}`);
        console.log(`Sessões de hoje: ${finalResult.rows[0].hoje}`);
        
        // Calcular nível correto
        const completed = parseInt(finalResult.rows[0].concluidas);
        let nivel = 1;
        let titulo = 'Pagador de Inscrição 💸';
        
        if (completed >= 300) { nivel = 10; titulo = 'Lenda Viva dos Concursos 👑'; }
        else if (completed >= 230) { nivel = 9; titulo = 'Patrimônio Público 👑'; }
        else if (completed >= 170) { nivel = 8; titulo = 'Veterano de 7 Bancas 😎'; }
        else if (completed >= 120) { nivel = 7; titulo = 'Quase Nomeado 🏷️'; }
        else if (completed >= 80) { nivel = 6; titulo = 'Terror do Cespe 👹'; }
        else if (completed >= 50) { nivel = 5; titulo = 'Fiscal de Gabarito 🔍'; }
        else if (completed >= 30) { nivel = 4; titulo = 'Estrategista de Chute 🎲'; }
        else if (completed >= 15) { nivel = 3; titulo = 'Caçador de Questões 🎯'; }
        else if (completed >= 5) { nivel = 2; titulo = 'Sobrevivente do Primeiro PDF 📄'; }
        
        console.log(`\n🏆 Nível atual: ${nivel} - ${titulo}`);
        console.log(`   Próximo nível em: ${nivel < 10 ? (nivel === 1 ? 5 - completed : nivel === 2 ? 15 - completed : nivel === 3 ? 30 - completed : 'calcular...') + ' sessões' : 'Nível máximo!'}`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
        console.log('\n✨ Processo concluído! Recarregue a página para ver as atualizações.');
    }
}

cleanSessions();