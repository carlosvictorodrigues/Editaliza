// Script para verificar estrutura do banco
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('🔍 Verificando estrutura do banco de dados...\n');

// Listar todas as tabelas
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('❌ Erro ao listar tabelas:', err);
        db.close();
        return;
    }
    
    console.log('📋 Tabelas encontradas:');
    tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table.name}`);
    });
    
    console.log('\n📊 Análise detalhada das tabelas:');
    
    // Função recursiva para analisar cada tabela
    let tableIndex = 0;
    const analyzeNextTable = () => {
        if (tableIndex >= tables.length) {
            console.log('\n✅ Análise concluída!');
            db.close();
            return;
        }
        
        const tableName = tables[tableIndex].name;
        console.log(`\n🔍 Analisando tabela: ${tableName}`);
        
        // Contar registros
        db.all(`SELECT COUNT(*) as count FROM "${tableName}"`, (err, countResult) => {
            if (err) {
                console.error(`  ❌ Erro ao contar registros: ${err.message}`);
                tableIndex++;
                analyzeNextTable();
                return;
            }
            
            console.log(`  📊 Registros: ${countResult[0].count}`);
            
            // Mostrar estrutura da tabela
            db.all(`PRAGMA table_info("${tableName}")`, (err, columns) => {
                if (err) {
                    console.error(`  ❌ Erro ao obter estrutura: ${err.message}`);
                } else {
                    console.log(`  🏗️  Colunas: ${columns.map(col => col.name).join(', ')}`);
                    
                    // Se há dados, mostrar alguns exemplos (apenas para tabelas pequenas)
                    if (countResult[0].count > 0 && countResult[0].count <= 10) {
                        db.all(`SELECT * FROM "${tableName}" LIMIT 3`, (err, samples) => {
                            if (err) {
                                console.error(`  ❌ Erro ao obter amostras: ${err.message}`);
                            } else if (samples.length > 0) {
                                console.log(`  📝 Exemplo de dados:`, JSON.stringify(samples[0], null, 2).slice(0, 200) + '...');
                            }
                            
                            tableIndex++;
                            analyzeNextTable();
                        });
                    } else {
                        tableIndex++;
                        analyzeNextTable();
                    }
                }
            });
        });
    };
    
    // Iniciar análise
    analyzeNextTable();
});