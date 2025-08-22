// Script para criar tabelas no PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d'
});

async function createTables() {
    try {
        console.log('🔧 Criando tabelas no PostgreSQL...\n');

        // Tabela de usuários
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                is_email_verified BOOLEAN DEFAULT FALSE,
                email_verification_token VARCHAR(255),
                reset_password_token VARCHAR(255),
                reset_password_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela users criada');

        // Tabela de sessões
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            )
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire)`);
        console.log('✅ Tabela sessions criada');

        // Tabela de cronogramas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                subjects TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela schedules criada');

        // Tabela de planos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                schedule_id INTEGER,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                exam_date DATE,
                study_hours_per_day INTEGER DEFAULT 4,
                subjects TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela plans criada');

        // Tabela de tarefas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                subject VARCHAR(255),
                duration INTEGER DEFAULT 60,
                priority INTEGER DEFAULT 5,
                difficulty INTEGER DEFAULT 5,
                completed BOOLEAN DEFAULT FALSE,
                completed_at TIMESTAMP,
                scheduled_date DATE,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela tasks criada');

        // Tabela de progresso
        await pool.query(`
            CREATE TABLE IF NOT EXISTS progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                task_id INTEGER NOT NULL,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                time_spent INTEGER,
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela progress criada');

        // Tabela OAuth
        await pool.query(`
            CREATE TABLE IF NOT EXISTS oauth_providers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(provider, provider_id)
            )
        `);
        console.log('✅ Tabela oauth_providers criada');

        // Criar índices
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_oauth_provider_id ON oauth_providers(provider, provider_id)`);
        console.log('✅ Índices criados');

        console.log('\n🎉 Todas as tabelas foram criadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error);
    } finally {
        await pool.end();
    }
}

createTables();