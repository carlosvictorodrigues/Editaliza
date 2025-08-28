const db = require('./database-postgres-direct');

async function checkAppSchema() {
    try {
        console.log('🔍 Verificando schema app...\n');
        
        // Check if app schema exists
        const appSchema = await db.get(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = 'app'
        `);
        
        if (appSchema) {
            console.log('✅ Schema app existe');
            
            // Check if study_sessions exists in app schema
            const appTable = await db.get(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'app' 
                AND table_name = 'study_sessions'
            `);
            
            if (appTable) {
                console.log('⚠️ Tabela study_sessions EXISTE no schema app!');
                
                // Check columns in app.study_sessions
                const appColumns = await db.all(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'app' 
                    AND table_name = 'study_sessions'
                    ORDER BY ordinal_position
                `);
                
                console.log('\n📋 Colunas em app.study_sessions:');
                appColumns.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type}`);
                });
                
                // Check if time_studied_seconds exists
                const hasColumn = appColumns.some(col => col.column_name === 'time_studied_seconds');
                if (!hasColumn) {
                    console.log('\n❌ Coluna time_studied_seconds NÃO existe em app.study_sessions!');
                    console.log('🔧 Adicionando coluna...');
                    
                    await db.run(`
                        ALTER TABLE app.study_sessions 
                        ADD COLUMN IF NOT EXISTS time_studied_seconds INTEGER DEFAULT 0
                    `);
                    
                    await db.run(`
                        ALTER TABLE app.study_sessions 
                        ADD COLUMN IF NOT EXISTS questions_solved INTEGER DEFAULT 0
                    `);
                    
                    console.log('✅ Colunas adicionadas ao schema app!');
                }
            } else {
                console.log('✅ Tabela study_sessions NÃO existe no schema app (OK!)');
            }
        } else {
            console.log('✅ Schema app não existe (OK!)');
        }
        
        // Verify both schemas now
        console.log('\n📊 Verificando ambos os schemas:');
        const allTables = await db.all(`
            SELECT 
                table_schema,
                table_name,
                COUNT(*) as column_count
            FROM information_schema.columns
            WHERE table_name = 'study_sessions'
            AND table_schema NOT IN ('pg_catalog', 'information_schema')
            GROUP BY table_schema, table_name
        `);
        
        for (const table of allTables) {
            console.log(`\n  ${table.table_schema}.${table.table_name}: ${table.column_count} colunas`);
            
            const hasTime = await db.get(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 
                AND table_name = 'study_sessions' 
                AND column_name = 'time_studied_seconds'
            `, [table.table_schema]);
            
            console.log(`    time_studied_seconds: ${hasTime ? '✅ EXISTS' : '❌ MISSING'}`);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await db.close();
    }
}

checkAppSchema();