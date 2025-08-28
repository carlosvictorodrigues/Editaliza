const db = require('./database-postgres-direct');

async function verifyColumn() {
    try {
        console.log('🔍 Verificando contexto da coluna time_studied_seconds...\n');
        
        // Check all schemas
        const schemas = await db.all(`
            SELECT DISTINCT table_schema 
            FROM information_schema.tables 
            WHERE table_name = 'study_sessions'
        `);
        console.log('📋 Schemas com tabela study_sessions:', schemas);
        
        // Check columns in each schema
        for (const schema of schemas) {
            console.log(`\n🔍 Schema: ${schema.table_schema}`);
            const columns = await db.all(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = $1 
                AND table_name = 'study_sessions'
                AND column_name IN ('time_studied_seconds', 'questions_solved', 'status')
                ORDER BY column_name
            `, [schema.table_schema]);
            
            console.log('  Colunas encontradas:');
            columns.forEach(col => {
                console.log(`    - ${col.column_name}: ${col.data_type}`);
            });
        }
        
        // Check current search_path
        const searchPath = await db.get(`SHOW search_path`);
        console.log('\n🔍 Search path atual:', searchPath);
        
        // Test query directly
        console.log('\n🧪 Testando query diretamente...');
        try {
            const result = await db.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(time_studied_seconds) as with_time
                FROM study_sessions
                LIMIT 1
            `);
            console.log('✅ Query funcionou:', result);
        } catch (error) {
            console.error('❌ Query falhou:', error.message);
        }
        
        // Check if we're using the right table
        console.log('\n🔍 Verificando qual tabela está sendo usada...');
        const tableInfo = await db.get(`
            SELECT 
                schemaname,
                tablename,
                tableowner
            FROM pg_tables
            WHERE tablename = 'study_sessions'
            AND schemaname NOT IN ('pg_catalog', 'information_schema')
            LIMIT 1
        `);
        console.log('📋 Tabela em uso:', tableInfo);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await db.close();
    }
}

verifyColumn();