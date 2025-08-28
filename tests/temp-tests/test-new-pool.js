/**
 * Teste do novo pool com search_path configurado
 */

const db = require('./database-postgres-direct');

async function testNewPool() {
    console.log('🧪 TESTANDO NOVO POOL COM SEARCH_PATH CORRIGIDO\n');
    
    try {
        // 1. Verificar search_path
        console.log('1️⃣ Verificando search_path:');
        const searchPath = await db.get(`SHOW search_path`);
        console.log('  Search path:', searchPath.search_path);
        
        // 2. Testar resolução de nomes
        console.log('\n2️⃣ Testando resolução de nomes:');
        const resolution = await db.get(`
            SELECT 
                to_regclass('study_sessions') as default_resolution,
                current_setting('search_path') as current_path
        `);
        console.log('  study_sessions resolve para:', resolution.default_resolution);
        console.log('  Search path atual:', resolution.current_path);
        
        // 3. Testar a query problemática
        console.log('\n3️⃣ Testando query problemática:');
        const test1 = await db.get(`
            SELECT 
                COUNT(*) as total,
                COUNT(time_studied_seconds) as with_column
            FROM study_sessions
            WHERE time_studied_seconds >= 0
            LIMIT 1
        `);
        console.log('  ✅ Query 1 funcionou:', test1);
        
        // 4. Testar query completa de estatísticas
        console.log('\n4️⃣ Testando query completa de estatísticas:');
        const test2 = await db.get(`
            SELECT 
                COALESCE(SUM(time_studied_seconds) / 3600.0, 0) as total_hours,
                COUNT(CASE WHEN time_studied_seconds > 0 OR status = 'Concluído' THEN 1 END) as completed_sessions,
                COUNT(*) as total_sessions
            FROM study_sessions
            WHERE study_plan_id = 1
        `);
        console.log('  ✅ Query 2 funcionou:', test2);
        
        // 5. Testar com múltiplas conexões
        console.log('\n5️⃣ Testando com múltiplas conexões simultâneas:');
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(
                db.get(`
                    SELECT 
                        current_setting('search_path') as path,
                        COUNT(time_studied_seconds) as count
                    FROM study_sessions
                    LIMIT 1
                `)
            );
        }
        
        const results = await Promise.all(promises);
        results.forEach((r, i) => {
            console.log(`  Conexão ${i + 1}: search_path=${r.path}, count=${r.count}`);
        });
        
        console.log('\n✅ TODOS OS TESTES PASSARAM!');
        console.log('🎉 O pool está configurado corretamente!');
        
    } catch (error) {
        console.error('\n❌ ERRO NOS TESTES:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await db.close();
    }
}

testNewPool();