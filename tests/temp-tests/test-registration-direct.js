// Teste direto de registro com PostgreSQL

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Configuração direta do PostgreSQL
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d',
    max: 2
});

async function testDirectRegistration() {
    console.log('\n🔍 TESTE DIRETO DE REGISTRO COM POSTGRESQL\n');
    
    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão...');
        const testQuery = await pool.query('SELECT NOW()');
        console.log('✅ Conexão OK:', testQuery.rows[0].now);
        
        // 2. Verificar tabela users
        console.log('\n2️⃣ Verificando estrutura da tabela users...');
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Colunas encontradas:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        
        // 3. Criar usuário de teste
        console.log('\n3️⃣ Criando usuário de teste...');
        const email = `test_${Date.now()}@example.com`;
        const password = 'Test123!@#';
        const name = 'Test User';
        
        // Hash da senha
        console.log('  - Gerando hash da senha...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('  ✅ Hash gerado:', hashedPassword.substring(0, 30) + '...');
        
        // Inserir usuário
        console.log('  - Inserindo usuário no banco...');
        const insertQuery = `
            INSERT INTO users (email, password_hash, name, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING id, email, name, created_at
        `;
        
        const result = await pool.query(insertQuery, [email, hashedPassword, name]);
        console.log('✅ Usuário criado:', result.rows[0]);
        
        // 4. Verificar se foi inserido
        console.log('\n4️⃣ Verificando inserção...');
        const checkUser = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
        console.log('✅ Usuário encontrado:', checkUser.rows[0]);
        
        // 5. Testar login
        console.log('\n5️⃣ Testando validação de senha...');
        const userForLogin = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const isValid = await bcrypt.compare(password, userForLogin.rows[0].password_hash);
        console.log('✅ Senha válida:', isValid);
        
        console.log('\n✨ TESTE COMPLETO - TUDO FUNCIONANDO!');
        
    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

// Executar teste
testDirectRegistration();