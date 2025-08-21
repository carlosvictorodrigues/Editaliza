#!/usr/bin/env node

/**
 * Script de inicialização do banco de dados
 * Garante que todas as tabelas necessárias existam
 * Execute sempre após deploy ou migração
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Configuração do banco
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || 'Editaliza@2025#Secure'
};

async function initDatabase() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('🔌 Conectado ao banco de dados PostgreSQL');
        
        // 1. Criar tabela de sessões (necessária para express-session)
        console.log('\n📋 Verificando tabela de sessões...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR NOT NULL PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire)
        `);
        console.log('✅ Tabela sessions OK');
        
        // 2. Verificar tabela de usuários
        console.log('\n📋 Verificando tabela de usuários...');
        const usersCheck = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'users'
        `);
        
        if (usersCheck.rows[0].count === '0') {
            await client.query(`
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reset_token VARCHAR(255),
                    reset_token_expires BIGINT
                )
            `);
            console.log('✅ Tabela users criada');
        } else {
            console.log('✅ Tabela users OK');
        }
        
        // 3. Verificar tabela de tentativas de login
        console.log('\n📋 Verificando tabela de tentativas de login...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                success INTEGER DEFAULT 0,
                ip_address VARCHAR(45),
                user_agent TEXT,
                attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela login_attempts OK');
        
        // 4. Verificar tabela de planos de estudo
        console.log('\n📋 Verificando tabela de planos de estudo...');
        const plansCheck = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'study_plans'
        `);
        
        if (plansCheck.rows[0].count === '0') {
            await client.query(`
                CREATE TABLE study_plans (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    plan_name VARCHAR(255) NOT NULL,
                    exam_name VARCHAR(255),
                    exam_date DATE,
                    available_hours_weekday INTEGER DEFAULT 2,
                    available_hours_weekend INTEGER DEFAULT 4,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela study_plans criada');
        } else {
            console.log('✅ Tabela study_plans OK');
        }
        
        // 5. Criar usuário de teste se não existir
        console.log('\n📋 Verificando usuário de teste...');
        const testUserCheck = await client.query(
            'SELECT id FROM users WHERE email = \'teste@teste.com\''
        );
        
        if (testUserCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('123456', 12);
            await client.query(
                'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)',
                ['teste@teste.com', hashedPassword, 'Usuário Teste']
            );
            console.log('✅ Usuário teste@teste.com criado (senha: 123456)');
        } else {
            console.log('✅ Usuário de teste existe');
        }
        
        // 6. Verificar índices importantes
        console.log('\n📋 Criando índices de performance...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
            CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
        `);
        console.log('✅ Índices criados/verificados');
        
        // 7. Estatísticas do banco
        console.log('\n📊 Estatísticas do banco:');
        const stats = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM study_plans) as total_plans,
                (SELECT COUNT(*) FROM sessions) as active_sessions
        `);
        
        const row = stats.rows[0];
        console.log(`   👥 Usuários: ${row.total_users}`);
        console.log(`   📚 Planos: ${row.total_plans}`);
        console.log(`   🔐 Sessões ativas: ${row.active_sessions}`);
        
        console.log('\n✅ Banco de dados inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };