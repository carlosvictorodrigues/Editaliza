// Script para verificar e criar tabelas faltantes no PostgreSQL
const { Client } = require('pg');
require('dotenv').config();

async function checkAndCreateTables() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');
        
        // Verificar tabelas existentes
        const result = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        const existingTables = result.rows.map(r => r.tablename);
        console.log('📋 Tabelas existentes:', existingTables.join(', '));
        
        // Lista de tabelas necessárias
        const requiredTables = {
            'users': `CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token TEXT,
                verification_expires TIMESTAMP,
                reset_password_token TEXT,
                reset_password_expires TIMESTAMP,
                profile_picture VARCHAR(500)
            )`,
            
            'sessions': `CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP NOT NULL
            )`,
            
            'study_plans': `CREATE TABLE IF NOT EXISTS study_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                plan_name VARCHAR(255) NOT NULL,
                exam_date DATE,
                study_days_per_week INTEGER DEFAULT 6,
                hours_per_day DECIMAL(4,2) DEFAULT 4.0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'subjects': `CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                weight INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'topics': `CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
                topic_description TEXT NOT NULL,
                weight INTEGER DEFAULT 5,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'study_sessions': `CREATE TABLE IF NOT EXISTS study_sessions (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
                subject_name VARCHAR(255),
                topic_description TEXT,
                session_date DATE,
                session_type VARCHAR(50),
                status VARCHAR(50) DEFAULT 'Pendente',
                time_studied_seconds INTEGER DEFAULT 0,
                notes TEXT,
                questions_solved INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'user_gamification_stats': `CREATE TABLE IF NOT EXISTS user_gamification_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'user_achievements': `CREATE TABLE IF NOT EXISTS user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                achievement_id VARCHAR(100),
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'oauth_providers': `CREATE TABLE IF NOT EXISTS oauth_providers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_id)
            )`,
            
            'schedules': `CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                schedule_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'plans': `CREATE TABLE IF NOT EXISTS plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255),
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'tasks': `CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            'progress': `CREATE TABLE IF NOT EXISTS progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                progress_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        };
        
        // Criar tabelas faltantes
        console.log('\n🔧 Verificando e criando tabelas...');
        for (const [tableName, createSQL] of Object.entries(requiredTables)) {
            if (!existingTables.includes(tableName)) {
                console.log(`   ⚠️  Tabela '${tableName}' não existe, criando...`);
                await client.query(createSQL);
                console.log(`   ✅ Tabela '${tableName}' criada`);
            } else {
                console.log(`   ✅ Tabela '${tableName}' já existe`);
            }
        }
        
        // Criar índices importantes
        console.log('\n📊 Criando índices...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_study_sessions_plan ON study_sessions(study_plan_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_subjects_plan ON subjects(study_plan_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id)');
        console.log('✅ Índices criados/verificados');
        
        // Verificar usuário de teste
        const userCheck = await client.query(
            "SELECT id, email FROM users WHERE email = 'c@c.com'"
        );
        
        if (userCheck.rows.length === 0) {
            console.log('\n👤 Criando usuário de teste...');
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('123456', 12);
            await client.query(
                `INSERT INTO users (email, password_hash, name, email_verified)
                 VALUES ($1, $2, $3, $4)`,
                ['c@c.com', hash, 'Usuário Teste', true]
            );
            console.log('✅ Usuário de teste criado (c@c.com / 123456)');
        } else {
            console.log('\n✅ Usuário de teste já existe (c@c.com)');
        }
        
        console.log('\n✨ PostgreSQL está configurado e pronto para uso!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

checkAndCreateTables();