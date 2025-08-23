const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== ESTRUTURA DO BANCO DE DADOS ===\n');

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function analyzeDatabase() {
    try {
        const tables = await runQuery("SELECT name FROM sqlite_master WHERE type='table'");
        
        for (const table of tables) {
            console.log(`\n📋 TABELA: ${table.name.toUpperCase()}`);
            console.log('─'.repeat(50));
            
            try {
                // Estrutura da tabela
                const structure = await runQuery(`PRAGMA table_info(${table.name})`);
                console.log('Colunas:');
                structure.forEach(col => {
                    const pk = col.pk ? ' (PRIMARY KEY)' : '';
                    const notNull = col.notnull ? ' NOT NULL' : '';
                    const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
                    console.log(`  - ${col.name}: ${col.type}${pk}${notNull}${defaultVal}`);
                });
                
                // Contar registros
                const countResult = await runQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
                console.log(`\n📊 Total de registros: ${countResult[0].count}`);
                
                // Se for uma tabela relevante para o usuário, mostrar alguns dados
                if ((table.name === 'users' || table.name === 'study_sessions' || 
                     table.name === 'study_plans' || table.name === 'topics') && 
                     countResult[0].count > 0) {
                    
                    console.log('\n🔍 Alguns registros:');
                    
                    if (table.name === 'users') {
                        const users = await runQuery(`SELECT id, email, name, created_at FROM ${table.name} WHERE email = 'c@c.com'`);
                        users.forEach(user => {
                            console.log(`  - ID: ${user.id}, Email: ${user.email}, Nome: ${user.name || 'N/A'}`);
                        });
                    } else if (table.name === 'study_plans') {
                        const plans = await runQuery(`SELECT * FROM ${table.name} WHERE user_id = 1006`);
                        plans.forEach(plan => {
                            console.log(`  - Plano ID: ${plan.id}, Nome: ${plan.plan_name || 'N/A'}`);
                        });
                    } else if (table.name === 'study_sessions') {
                        const sessions = await runQuery(`SELECT * FROM ${table.name} WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = 1006) LIMIT 5`);
                        sessions.forEach(session => {
                            console.log(`  - Sessão ID: ${session.id}, Status: ${session.status}, Data: ${session.session_date}`);
                        });
                    } else if (table.name === 'topics') {
                        const topics = await runQuery(`SELECT * FROM ${table.name} WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = 1006)) LIMIT 3`);
                        topics.forEach(topic => {
                            console.log(`  - Tópico ID: ${topic.id}, Status: ${topic.status || 'N/A'}, Descrição: ${topic.description || 'N/A'}`);
                        });
                    }
                }
                
            } catch (err) {
                console.log(`❌ Erro ao analisar tabela ${table.name}: ${err.message}`);
            }
        }
        
        console.log('\n=== ANÁLISE CONCLUÍDA ===');
        
    } catch (error) {
        console.error('❌ Erro durante a análise:', error);
    } finally {
        db.close();
    }
}

analyzeDatabase();