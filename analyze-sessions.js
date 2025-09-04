const { Pool } = require('pg');
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d'
});

(async () => {
    try {
        // Verificar inconsistência: sessões com study_plan_id=140 mas sem user_id
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN user_id IS NULL THEN 1 END) as sem_user_id,
                COUNT(CASE WHEN user_id = 148 THEN 1 END) as com_user_correto,
                COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as concluidas
            FROM study_sessions 
            WHERE study_plan_id = 140
        `);
        
        console.log('🔍 ANÁLISE DO PLANO 140:');
        console.log('========================');
        console.log('Total de sessões:', result.rows[0].total);
        console.log('Sessões SEM user_id:', result.rows[0].sem_user_id);
        console.log('Sessões com user_id=148:', result.rows[0].com_user_correto);
        console.log('Sessões concluídas:', result.rows[0].concluidas);
        
        // Mostrar algumas sessões de exemplo
        const exampleResult = await pool.query(`
            SELECT id, user_id, status, session_date, session_type
            FROM study_sessions 
            WHERE study_plan_id = 140 
            AND status = 'Concluído'
            LIMIT 5
        `);
        
        console.log('\n📝 Exemplos de sessões concluídas do plano:');
        exampleResult.rows.forEach(row => {
            console.log(`  ID: ${row.id}, user_id: ${row.user_id || 'NULL'}, Data: ${row.session_date?.toLocaleDateString() || 'NULL'}`);
        });
        
        console.log('\n💡 DIAGNÓSTICO:');
        console.log('O problema é que as sessões foram criadas com study_plan_id mas sem user_id!');
        console.log('Por isso o sistema conta 24 sessões do plano mas apenas 3 do usuário.');
        
        console.log('\n🔧 SOLUÇÃO PROPOSTA:');
        console.log('1. Atualizar as sessões do plano 140 para ter user_id = 148');
        console.log('2. Ou deletar essas sessões de teste e criar novas corretamente');
        
        // Contar quantas sessões seriam afetadas
        const updateCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM study_sessions 
            WHERE study_plan_id = 140 
            AND (user_id IS NULL OR user_id != 148)
        `);
        
        console.log(`\n📊 Sessões que precisam correção: ${updateCount.rows[0].count}`);
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
})();