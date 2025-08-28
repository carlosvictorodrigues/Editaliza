// Script para verificar dados no banco
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

console.log('📊 Verificando dados no banco de dados...\n');

// Verificar usuários
db.all('SELECT COUNT(*) as count FROM users', (err, rows) => {
    if (err) {
        console.error('❌ Erro ao verificar usuários:', err);
        return;
    }
    console.log(`👤 Usuários cadastrados: ${rows[0].count}`);
    
    // Se há usuários, mostrar alguns detalhes
    if (rows[0].count > 0) {
        db.all('SELECT id, email, created_at FROM users LIMIT 3', (err, users) => {
            if (err) {
                console.error('❌ Erro ao listar usuários:', err);
                return;
            }
            
            console.log('📝 Usuários encontrados:');
            users.forEach(user => {
                console.log(`  - ID: ${user.id}, Email: ${user.email}, Criado: ${user.created_at}`);
            });
            
            // Verificar planos do primeiro usuário
            const firstUserId = users[0].id;
            db.all('SELECT COUNT(*) as count FROM plans WHERE user_id = ?', [firstUserId], (err, planRows) => {
                if (err) {
                    console.error('❌ Erro ao verificar planos:', err);
                    return;
                }
                
                console.log(`\n📚 Planos do usuário ${firstUserId}: ${planRows[0].count}`);
                
                if (planRows[0].count > 0) {
                    db.all('SELECT id, plan_name, exam_date, created_at FROM plans WHERE user_id = ? LIMIT 2', [firstUserId], (err, plans) => {
                        if (err) {
                            console.error('❌ Erro ao listar planos:', err);
                            return;
                        }
                        
                        console.log('📋 Planos encontrados:');
                        plans.forEach(plan => {
                            console.log(`  - ID: ${plan.id}, Nome: ${plan.plan_name}, Prova: ${plan.exam_date}`);
                        });
                        
                        // Testar endpoint de progresso
                        const testPlanId = plans[0].id;
                        console.log(`\n🧪 Testando dados para o plano ID: ${testPlanId}`);
                        
                        // Verificar tópicos
                        db.all('SELECT COUNT(*) as count FROM topics WHERE plan_id = ?', [testPlanId], (err, topicRows) => {
                            if (err) {
                                console.error('❌ Erro ao verificar tópicos:', err);
                                return;
                            }
                            console.log(`📖 Tópicos no plano: ${topicRows[0].count}`);
                            
                            // Verificar sessões
                            db.all('SELECT COUNT(*) as count FROM sessions WHERE plan_id = ?', [testPlanId], (err, sessionRows) => {
                                if (err) {
                                    console.error('❌ Erro ao verificar sessões:', err);
                                    return;
                                }
                                console.log(`⏰ Sessões de estudo: ${sessionRows[0].count}`);
                                
                                // Verificar sessões concluídas
                                db.all('SELECT COUNT(*) as count FROM sessions WHERE plan_id = ? AND status = \'Concluído\'', [testPlanId], (err, completedRows) => {
                                    if (err) {
                                        console.error('❌ Erro ao verificar sessões concluídas:', err);
                                        return;
                                    }
                                    console.log(`✅ Sessões concluídas: ${completedRows[0].count}`);
                                    
                                    console.log('\n🎯 RESUMO:');
                                    console.log(`- Banco possui dados suficientes para testes: ${planRows[0].count > 0 && topicRows[0].count > 0 ? 'SIM ✅' : 'NÃO ❌'}`);
                                    console.log(`- Plano ID para testes: ${testPlanId}`);
                                    console.log(`- Progresso esperado: ${completedRows[0].count}/${sessionRows[0].count} sessões`);
                                    
                                    db.close();
                                });
                            });
                        });
                    });
                } else {
                    console.log('⚠️  Nenhum plano encontrado. Crie um plano para testar a interface.');
                    db.close();
                }
            });
        });
    } else {
        console.log('⚠️  Nenhum usuário encontrado. Registre um usuário para testar.');
        db.close();
    }
});