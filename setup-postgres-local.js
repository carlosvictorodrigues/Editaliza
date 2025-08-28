// Script para configurar PostgreSQL local
const { Client } = require('pg');
require('dotenv').config();

async function setupPostgresLocal() {
    console.log('🔧 Configurando PostgreSQL local...\n');
    
    // Primeiro, conectar como postgres para criar o banco se não existir
    const adminClient = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres' // Senha padrão do postgres, pode precisar ajustar
    });
    
    try {
        console.log('📊 Conectando ao PostgreSQL como admin...');
        await adminClient.connect();
        
        // Verificar se o banco existe
        const checkDB = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [process.env.DB_NAME || 'editaliza_db']
        );
        
        if (checkDB.rows.length === 0) {
            console.log('📦 Banco não existe, criando...');
            await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME || 'editaliza_db'}`);
            console.log('✅ Banco criado com sucesso!');
        } else {
            console.log('✅ Banco já existe');
        }
        
        // Verificar se o usuário existe
        const checkUser = await adminClient.query(
            "SELECT 1 FROM pg_user WHERE usename = $1",
            [process.env.DB_USER || 'editaliza_user']
        );
        
        if (checkUser.rows.length === 0) {
            console.log('👤 Usuário não existe, criando...');
            await adminClient.query(
                `CREATE USER ${process.env.DB_USER || 'editaliza_user'} WITH PASSWORD '${process.env.DB_PASSWORD || '1a2b3c4d'}'`
            );
            console.log('✅ Usuário criado com sucesso!');
        } else {
            console.log('✅ Usuário já existe');
        }
        
        // Dar permissões ao usuário
        await adminClient.query(
            `GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME || 'editaliza_db'} TO ${process.env.DB_USER || 'editaliza_user'}`
        );
        console.log('✅ Permissões concedidas');
        
        await adminClient.end();
        
    } catch (error) {
        console.error('❌ Erro ao configurar banco como admin:', error.message);
        console.log('\n⚠️  Você pode precisar ajustar a senha do usuário postgres no script');
        console.log('    ou executar os seguintes comandos manualmente no psql:\n');
        console.log(`    CREATE DATABASE ${process.env.DB_NAME || 'editaliza_db'};`);
        console.log(`    CREATE USER ${process.env.DB_USER || 'editaliza_user'} WITH PASSWORD '${process.env.DB_PASSWORD || '1a2b3c4d'}';`);
        console.log(`    GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME || 'editaliza_db'} TO ${process.env.DB_USER || 'editaliza_user'};`);
        await adminClient.end();
        process.exit(1);
    }
    
    // Agora conectar com o usuário da aplicação para criar as tabelas
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        console.log('\n📊 Conectando ao banco com usuário da aplicação...');
        await client.connect();
        console.log('✅ Conectado com sucesso!');
        
        // Criar tabelas necessárias
        console.log('\n📋 Criando tabelas...');
        
        // Tabela users
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
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
                reset_password_expires TIMESTAMP
            )
        `);
        console.log('✅ Tabela users criada');
        
        // Tabela sessions
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP NOT NULL
            )
        `);
        console.log('✅ Tabela sessions criada');
        
        // Tabela study_plans
        await client.query(`
            CREATE TABLE IF NOT EXISTS study_plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                plan_name VARCHAR(255) NOT NULL,
                exam_date DATE,
                study_days_per_week INTEGER DEFAULT 6,
                hours_per_day DECIMAL(4,2) DEFAULT 4.0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela study_plans criada');
        
        // Tabela subjects
        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                weight INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela subjects criada');
        
        // Tabela topics
        await client.query(`
            CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
                topic_description TEXT NOT NULL,
                weight INTEGER DEFAULT 5,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela topics criada');
        
        // Tabela study_sessions
        await client.query(`
            CREATE TABLE IF NOT EXISTS study_sessions (
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
            )
        `);
        console.log('✅ Tabela study_sessions criada');
        
        // Tabela user_gamification_stats
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_gamification_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela user_gamification_stats criada');
        
        // Tabela user_achievements
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                achievement_id VARCHAR(100),
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela user_achievements criada');
        
        // Tabela oauth_providers (mesmo que não use agora, para evitar erros)
        await client.query(`
            CREATE TABLE IF NOT EXISTS oauth_providers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_id)
            )
        `);
        console.log('✅ Tabela oauth_providers criada');
        
        // Tabelas adicionais mencionadas no CLAUDE.md
        await client.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                schedule_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela schedules criada');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255),
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela plans criada');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela tasks criada');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS progress (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                progress_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela progress criada');
        
        console.log('\n🎉 Todas as tabelas foram criadas com sucesso!');
        
        // Criar usuário de teste
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('123456', 12);
        
        await client.query(`
            INSERT INTO users (email, password_hash, name, email_verified)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO NOTHING
        `, ['c@c.com', hashedPassword, 'Usuário Teste', true]);
        
        console.log('\n👤 Usuário de teste criado:');
        console.log('   Email: c@c.com');
        console.log('   Senha: 123456');
        
        await client.end();
        
        console.log('\n✨ PostgreSQL local configurado com sucesso!');
        console.log('\nPróximos passos:');
        console.log('1. Reinicie o servidor: npm start');
        console.log('2. Acesse: http://localhost:3000');
        console.log('3. Faça login com c@c.com / 123456');
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error.message);
        await client.end();
        process.exit(1);
    }
}

// Executar setup
setupPostgresLocal().catch(console.error);