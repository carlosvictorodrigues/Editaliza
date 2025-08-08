const sqlite3 = require('sqlite3').verbose();

// Conectar ao banco de dados
const db = new sqlite3.Database('db.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        return;
    }
    console.log('Conectado ao banco de dados db.sqlite');
});

// Função para verificar a estrutura das tabelas
function debugDatabase() {
    console.log('\n🔍 DEBUGANDO ESTRUTURA DO BANCO DE DADOS\n');
    
    // 1. Verificar tabelas existentes
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Erro ao buscar tabelas:', err.message);
            return;
        }
        
        console.log('📋 Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
        
        // 2. Verificar estrutura da tabela subjects
        console.log('\n🔍 Estrutura da tabela subjects:');
        db.all("PRAGMA table_info(subjects)", (err, columns) => {
            if (err) {
                console.error('Erro ao buscar estrutura de subjects:', err.message);
                return;
            }
            
            columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})`);
            });
            
            // 3. Verificar estrutura da tabela topics
            console.log('\n🔍 Estrutura da tabela topics:');
            db.all("PRAGMA table_info(topics)", (err, columns) => {
                if (err) {
                    console.error('Erro ao buscar estrutura de topics:', err.message);
                    return;
                }
                
                columns.forEach(col => {
                    console.log(`  - ${col.name} (${col.type})`);
                });
                
                // 4. Verificar dados de subjects
                console.log('\n🔍 Dados da tabela subjects:');
                db.all("SELECT * FROM subjects WHERE study_plan_id = 1", (err, subjects) => {
                    if (err) {
                        console.error('Erro ao buscar subjects:', err.message);
                        return;
                    }
                    
                    console.log(`✅ Subjects encontrados: ${subjects.length}`);
                    subjects.forEach(subject => {
                        console.log(`  - ID: ${subject.id}, Nome: ${subject.name}, Plano: ${subject.study_plan_id}`);
                    });
                    
                    // 5. Verificar dados de topics
                    if (subjects.length > 0) {
                        const subjectIds = subjects.map(s => s.id).join(',');
                        console.log('\n🔍 Dados da tabela topics:');
                        db.all(`SELECT * FROM topics WHERE subject_id IN (${subjectIds})`, (err, topics) => {
                            if (err) {
                                console.error('Erro ao buscar topics:', err.message);
                                return;
                            }
                            
                            console.log(`✅ Topics encontrados: ${topics.length}`);
                            topics.forEach(topic => {
                                console.log(`  - ID: ${topic.id}, Subject: ${topic.subject_id}, Status: ${topic.status}, Descrição: ${topic.description}`);
                            });
                            
                            // 6. Testar a query corrigida
                            console.log('\n🔍 Testando query corrigida:');
                            const query = `
                                SELECT t.*, s.name as subject_name 
                                FROM topics t 
                                JOIN subjects s ON t.subject_id = s.id 
                                WHERE s.study_plan_id = ?
                                ORDER BY t.priority DESC, t.id ASC
                            `;
                            
                            db.all(query, [1], (err, results) => {
                                if (err) {
                                    console.error('Erro na query corrigida:', err.message);
                                    return;
                                }
                                
                                console.log(`✅ Query corrigida retornou: ${results.length} resultados`);
                                
                                if (results.length > 0) {
                                    let completed = 0;
                                    let pending = 0;
                                    
                                    results.forEach(topic => {
                                        if (topic.status === 'Concluído') {
                                            completed++;
                                        } else {
                                            pending++;
                                        }
                                    });
                                    
                                    console.log(`  - Concluídos: ${completed}`);
                                    console.log(`  - Pendentes: ${pending}`);
                                }
                                
                                // Fechar conexão
                                setTimeout(() => {
                                    db.close((err) => {
                                        if (err) {
                                            console.error('Erro ao fechar banco:', err.message);
                                        } else {
                                            console.log('\n✅ Conexão com banco fechada');
                                        }
                                    });
                                }, 1000);
                            });
                        });
                    } else {
                        console.log('❌ Nenhum subject encontrado para o plano 1');
                        setTimeout(() => {
                            db.close((err) => {
                                if (err) {
                                    console.error('Erro ao fechar banco:', err.message);
                                } else {
                                    console.log('\n✅ Conexão com banco fechada');
                                }
                            });
                        }, 1000);
                    }
                });
            });
        });
    });
}

// Executar debug
debugDatabase(); 