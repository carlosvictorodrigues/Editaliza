const db = require('./database-postgresql.js');

async function checkAllTablesStructure() {
    try {
        console.log('🔍 Verificando estrutura de todas as tabelas relevantes...\n');
        
        const tables = ['study_plans', 'subjects', 'topics'];
        
        for (const tableName of tables) {
            console.log(`📋 Tabela: ${tableName}`);
            console.log('='.repeat(60));
            
            const result = await db.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position
            `, [tableName]);
            
            if (result.rows.length === 0) {
                console.log(`❌ Tabela ${tableName} não encontrada!`);
            } else {
                result.rows.forEach(row => {
                    console.log(`• ${row.column_name.padEnd(25)} | ${row.data_type.padEnd(15)} | Nullable: ${row.is_nullable}`);
                });
            }
            console.log('\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

checkAllTablesStructure();