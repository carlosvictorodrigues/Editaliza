const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const util = require('util');

// Conectar ao banco de dados
const db = new sqlite3.Database('./db.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco de dados');
});

const dbGet = util.promisify(db.get.bind(db));
const dbAll = util.promisify(db.all.bind(db));

async function verifyUserAndAuth() {
    try {
        console.log('🔍 === VERIFICAÇÃO DE USUÁRIO E AUTENTICAÇÃO ===\n');
        
        // 1. Verificar se o usuário debug@test.com existe
        console.log('1️⃣ Verificando usuário debug@test.com...');
        const user = await dbGet('SELECT * FROM users WHERE email = ?', ['debug@test.com']);
        
        if (!user) {
            console.error('❌ Usuário debug@test.com não encontrado!');
            
            // Listar primeiros 5 usuários para referência
            console.log('\n📋 Primeiros 5 usuários no banco:');
            const users = await dbAll('SELECT id, email, created_at FROM users ORDER BY id LIMIT 5');
            users.forEach(u => {
                console.log(`   - ID: ${u.id}, Email: ${u.email}, Criado: ${u.created_at}`);
            });
            
            return;
        }
        
        console.log(`✅ Usuário encontrado: ID ${user.id}, Email: ${user.email}`);
        
        // 2. Verificar se o plano 1017 existe e pertence ao usuário
        console.log('\n2️⃣ Verificando plano 1017...');
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [1017, user.id]);
        
        if (!plan) {
            console.error(`❌ Plano 1017 não encontrado para usuário ${user.id}!`);
            
            // Listar planos do usuário
            console.log(`\n📋 Planos do usuário ${user.id}:`);
            const userPlans = await dbAll('SELECT id, plan_name, exam_date FROM study_plans WHERE user_id = ?', [user.id]);
            userPlans.forEach(p => {
                console.log(`   - ID: ${p.id}, Nome: ${p.plan_name}, Exame: ${p.exam_date}`);
            });
            
            return;
        }
        
        console.log(`✅ Plano encontrado: ${plan.plan_name} (ID: ${plan.id})`);
        
        // 3. Testar geração de token
        console.log('\n3️⃣ Testando geração de token...');
        const jwtSecret = 'u^#OoPglavughqn0D7Nco^1*9s0zlaG&&2j*05^xW4DlLADLskbo&@yE5Iw*y37N';
        
        const tokenPayload = { 
            id: user.id, 
            email: user.email 
        };
        
        const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' });
        console.log(`✅ Token gerado: ${token.substring(0, 50)}...`);
        
        // 4. Verificar token
        console.log('\n4️⃣ Verificando token...');
        try {
            const decoded = jwt.verify(token, jwtSecret);
            console.log('✅ Token válido! Dados decodificados:', decoded);
        } catch (error) {
            console.error('❌ Erro ao verificar token:', error.message);
            return;
        }
        
        // 5. Verificar se há problemas com o algoritmo diretamente
        console.log('\n5️⃣ Verificando dados necessários para cronograma...');
        
        // Verificar disciplinas
        const subjects = await dbAll('SELECT * FROM subjects WHERE study_plan_id = ?', [plan.id]);
        console.log(`   - Disciplinas: ${subjects.length}`);
        
        // Verificar tópicos
        const topics = await dbAll('SELECT t.* FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [plan.id]);
        console.log(`   - Tópicos: ${topics.length}`);
        
        // Verificar sessões existentes
        const sessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ?', [plan.id]);
        console.log(`   - Sessões existentes: ${sessions.length}`);
        
        console.log('\n✅ === VERIFICAÇÃO CONCLUÍDA ===');
        console.log(`\nUse estes dados para teste:`);
        console.log(`- User ID: ${user.id}`);
        console.log(`- Plan ID: ${plan.id}`);
        console.log(`- Token: ${token}`);
        
    } catch (error) {
        console.error('\n❌ ERRO DURANTE VERIFICAÇÃO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Erro ao fechar banco:', err.message);
            } else {
                console.log('\n🔚 Conexão com banco fechada');
            }
        });
    }
}

// Executar verificação
verifyUserAndAuth();