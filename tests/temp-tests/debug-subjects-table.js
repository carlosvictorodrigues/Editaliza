const db = require('./database-postgresql.js');

async function checkSubjectsTable() {
    console.log('🔍 Verificando estrutura da tabela subjects...');
    
    try {
        const tableInfo = await new Promise((resolve, reject) => {
            db.all(`SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = 'subjects' 
                    AND table_schema = 'app'`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('Estrutura da tabela subjects:');
        if (tableInfo.length === 0) {
            console.log('❌ Tabela subjects não encontrada!');
        } else {
            tableInfo.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    process.exit(0);
}

checkSubjectsTable();