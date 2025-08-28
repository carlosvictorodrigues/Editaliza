// Script para testar o fluxo completo de autenticação
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d'
});

async function testAuthFlow() {
    console.log('🔧 Testando fluxo de autenticação...\n');
    
    try {
        // 1. Verificar se a conta c@c.com existe
        console.log('1️⃣ Verificando conta c@c.com...');
        let user = await pool.query('SELECT * FROM users WHERE email = $1', ['c@c.com']);
        
        if (user.rows.length === 0) {
            console.log('   ❌ Conta não existe. Criando...');
            
            // Criar conta
            const hashedPassword = await bcrypt.hash('senha123456', 12);
            await pool.query(
                'INSERT INTO users (email, password_hash, name, created_at) VALUES ($1, $2, $3, $4)',
                ['c@c.com', hashedPassword, 'Usuário Teste', new Date()]
            );
            console.log('   ✅ Conta criada com sucesso!');
        } else {
            console.log('   ✅ Conta já existe');
            console.log('   ID:', user.rows[0].id);
            console.log('   Email:', user.rows[0].email);
            console.log('   Nome:', user.rows[0].name);
        }
        
        // 2. Testar login
        console.log('\n2️⃣ Testando login...');
        user = await pool.query('SELECT * FROM users WHERE email = $1', ['c@c.com']);
        
        if (user.rows.length > 0) {
            const validPassword = await bcrypt.compare('senha123456', user.rows[0].password_hash);
            if (validPassword) {
                console.log('   ✅ Login válido - senha correta!');
            } else {
                console.log('   ❌ Senha incorreta');
            }
        }
        
        // 3. Listar todas as contas de teste
        console.log('\n3️⃣ Contas de teste disponíveis:');
        const testAccounts = await pool.query(
            'SELECT email, name, created_at FROM users WHERE email LIKE \'%test%\' OR email LIKE \'%@c.com\' ORDER BY created_at DESC LIMIT 10'
        );
        
        if (testAccounts.rows.length > 0) {
            testAccounts.rows.forEach(acc => {
                console.log(`   📧 ${acc.email} - ${acc.name || 'Sem nome'}`);
            });
        } else {
            console.log('   Nenhuma conta de teste encontrada');
        }
        
        console.log('\n✅ Teste concluído!');
        console.log('\n📝 Credenciais de teste:');
        console.log('   Email: c@c.com');
        console.log('   Senha: senha123456');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

testAuthFlow();