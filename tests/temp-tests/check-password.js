// Script para verificar senhas no banco
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./db.sqlite');

console.log('🔍 Verificando usuários e suas senhas...\n');

db.all("SELECT id, email, password_hash FROM users LIMIT 5", (err, users) => {
    if (err) {
        console.error('❌ Erro ao buscar usuários:', err);
        db.close();
        return;
    }
    
    console.log('👥 Usuários encontrados:');
    users.forEach(user => {
        console.log(`  ID: ${user.id}, Email: ${user.email}`);
        console.log(`  Hash: ${user.password_hash?.substring(0, 20)}...`);
        
        // Testar senhas comuns
        const commonPasswords = ['123456', 'admin', 'password', 'test', '123', user.email.split('@')[0]];
        
        for (const password of commonPasswords) {
            try {
                if (user.password_hash && bcrypt.compareSync(password, user.password_hash)) {
                    console.log(`  ✅ SENHA ENCONTRADA: ${password}`);
                    break;
                }
            } catch (error) {
                // Ignora erros de hash inválido
            }
        }
        console.log(''); // Linha em branco
    });
    
    // Criar um usuário de teste se necessário
    console.log('🔧 Criando usuário de teste...');
    const testEmail = 'test@editaliza.com';
    const testPassword = '123456';
    const testPasswordHash = bcrypt.hashSync(testPassword, 10);
    
    db.run("INSERT OR REPLACE INTO users (id, email, password_hash, name) VALUES (999, ?, ?, ?)", 
        [testEmail, testPasswordHash, 'Usuário de Teste'], 
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar usuário de teste:', err);
            } else {
                console.log(`✅ Usuário de teste criado:`);
                console.log(`  Email: ${testEmail}`);
                console.log(`  Senha: ${testPassword}`);
                console.log(`  ID: 999`);
                
                // Criar um plano de teste para este usuário
                console.log('\n📚 Criando plano de teste...');
                db.run(`INSERT OR REPLACE INTO study_plans 
                    (id, user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal) 
                    VALUES (999, 999, 'Plano de Teste', '2025-12-31', '{"0":2,"1":4,"2":4,"3":4,"4":4,"5":4,"6":2}', 30, 200)`,
                    function(err) {
                        if (err) {
                            console.error('❌ Erro ao criar plano de teste:', err);
                        } else {
                            console.log('✅ Plano de teste criado (ID: 999)');
                            console.log('\n🎯 Dados para teste:');
                            console.log(`  Login: ${testEmail} / ${testPassword}`);
                            console.log(`  Plano ID: 999`);
                        }
                        db.close();
                    });
            }
        });
});