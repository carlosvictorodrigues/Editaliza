/**
 * Script para criar usuário de teste
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
});

async function createTestUser() {
    console.log('🔧 Criando usuário de teste...');
    
    try {
        // Hash da senha
        const passwordHash = await bcrypt.hash('TestUser123!', 10);
        
        // Verificar se usuário já existe
        const checkUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            ['ui-test-user@editaliza.com']
        );
        
        if (checkUser.rows.length > 0) {
            console.log('⚠️  Usuário já existe, atualizando senha...');
            
            await pool.query(
                'UPDATE users SET password_hash = $1 WHERE email = $2',
                [passwordHash, 'ui-test-user@editaliza.com']
            );
            
            console.log('✅ Senha atualizada com sucesso');
        } else {
            // Criar novo usuário
            const result = await pool.query(
                `INSERT INTO users (email, password_hash, name, role, is_email_verified, created_at) 
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) 
                 RETURNING id`,
                ['ui-test-user@editaliza.com', passwordHash, 'Usuário de Teste', 'user', true]
            );
            
            console.log('✅ Usuário criado com sucesso');
            console.log(`   ID: ${result.rows[0].id}`);
        }
        
        console.log("Email: ui-test-user@editaliza.com");
        console.log("Senha: TestUser123!");
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário:', error.message);
    } finally {
        await pool.end();
    }
}

createTestUser();