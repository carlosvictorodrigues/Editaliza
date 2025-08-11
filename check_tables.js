const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Verificando tabelas no banco de dados...\n');

// Listar todas as tabelas
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    
    console.log('Tabelas encontradas:');
    rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.name}`);
    });
    
    // Verificar se existe a tabela de cronogramas/agendas
    const tableNames = rows.map(r => r.name);
    
    // Verificar tabelas relevantes
    if (tableNames.includes('study_sessions')) {
        console.log('\n📚 Verificando estrutura da tabela study_sessions:');
        db.all("PRAGMA table_info(study_sessions)", (err, columns) => {
            if (err) {
                console.error('Erro:', err);
                return;
            }
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})`);
            });
            
            // Contar registros
            db.get("SELECT COUNT(*) as total FROM study_sessions", (err, row) => {
                if (err) {
                    console.error('Erro ao contar study_sessions:', err);
                    db.close();
                } else {
                    console.log(`\nTotal de registros em study_sessions: ${row.total}`);
                    
                    // Verificar se existem registros
                    if (row.total > 0) {
                        db.all("SELECT * FROM study_sessions LIMIT 3", (err, samples) => {
                            if (err) {
                                console.error('Erro ao buscar amostras:', err);
                            } else {
                                console.log('\nExemplos de registros:');
                                samples.forEach((session, index) => {
                                    console.log(`${index + 1}. ${JSON.stringify(session)}`);
                                });
                            }
                            db.close();
                        });
                    } else {
                        db.close();
                    }
                }
            });
        });
    } else if (tableNames.includes('study_plans')) {
        console.log('\n📋 Verificando estrutura da tabela study_plans:');
        db.all("PRAGMA table_info(study_plans)", (err, columns) => {
            if (err) {
                console.error('Erro:', err);
                return;
            }
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})`);
            });
            db.close();
        });
    } else {
        console.log('\n❌ Nenhuma tabela de cronogramas encontrada');
        db.close();
    }
});