const db = require('./database-postgresql.js');

async function checkTableStructure() {
    try {
        console.log('🔍 Verificando estrutura da tabela study_plans...\n');
        
        const result = await db.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'study_plans' 
            ORDER BY ordinal_position
        `);
        
        if (result.rows.length === 0) {
            console.log('❌ Tabela study_plans não encontrada!\n');
            
            // Verificar se há outras tabelas relacionadas a planos
            const tables = await db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE '%plan%'
            `);
            
            console.log('Tabelas relacionadas a planos encontradas:');
            tables.rows.forEach(row => {
                console.log(`- ${row.table_name}`);
            });
            
        } else {
            console.log('📋 Estrutura da tabela study_plans:');
            console.log('='.repeat(60));
            result.rows.forEach(row => {
                console.log(`• ${row.column_name.padEnd(25)} | ${row.data_type.padEnd(15)} | Nullable: ${row.is_nullable} | Default: ${row.column_default || 'N/A'}`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao verificar estrutura da tabela:', error.message);
        process.exit(1);
    }
}

checkTableStructure();