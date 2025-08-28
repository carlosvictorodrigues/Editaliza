// Debug script para criar tabelas
const { Client } = require('pg');
require('dotenv').config();

async function debugCreateTables() {
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
        
        // Primeiro, verificar permissões
        const userInfo = await client.query(`
            SELECT current_user, current_database()
        `);
        console.log('👤 Usuário:', userInfo.rows[0].current_user);
        console.log('📊 Database:', userInfo.rows[0].current_database);
        console.log('');
        
        // Testar criação de uma tabela simples
        console.log('🔧 Tentando criar tabela de teste...');
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS test_table (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100)
                )
            `);
            console.log('✅ Tabela test_table criada');
            
            // Verificar se foi criada
            const check = await client.query(`
                SELECT EXISTS (
                    SELECT FROM pg_tables 
                    WHERE schemaname = 'public' 
                    AND tablename = 'test_table'
                )
            `);
            console.log('   Existe?', check.rows[0].exists ? 'SIM' : 'NÃO');
            
            // Deletar tabela de teste
            await client.query('DROP TABLE IF EXISTS test_table');
            console.log('   Tabela de teste removida\n');
            
        } catch (err) {
            console.error('❌ Erro ao criar tabela de teste:', err.message);
            console.log('\n⚠️  Parece que há um problema de permissões!');
            return;
        }
        
        // Agora tentar criar as tabelas necessárias uma por uma
        console.log('🔧 Criando tabelas necessárias uma por uma...\n');
        
        // 1. user_gamification_stats
        try {
            console.log('Criando user_gamification_stats...');
            await client.query(`
                CREATE TABLE user_gamification_stats (
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
            console.log('✅ user_gamification_stats criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  user_gamification_stats já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 2. user_achievements
        try {
            console.log('Criando user_achievements...');
            await client.query(`
                CREATE TABLE user_achievements (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    achievement_id VARCHAR(100) NOT NULL,
                    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ user_achievements criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  user_achievements já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 3. oauth_providers
        try {
            console.log('Criando oauth_providers...');
            await client.query(`
                CREATE TABLE oauth_providers (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    provider VARCHAR(50) NOT NULL,
                    provider_id VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ oauth_providers criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  oauth_providers já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 4. schedules
        try {
            console.log('Criando schedules...');
            await client.query(`
                CREATE TABLE schedules (
                    id SERIAL PRIMARY KEY,
                    study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                    schedule_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ schedules criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  schedules já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 5. plans
        try {
            console.log('Criando plans...');
            await client.query(`
                CREATE TABLE plans (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255),
                    data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ plans criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  plans já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 6. tasks
        try {
            console.log('Criando tasks...');
            await client.query(`
                CREATE TABLE tasks (
                    id SERIAL PRIMARY KEY,
                    plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ tasks criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  tasks já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // 7. progress
        try {
            console.log('Criando progress...');
            await client.query(`
                CREATE TABLE progress (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                    progress_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ progress criada');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('⚠️  progress já existe');
            } else {
                console.error('❌ Erro:', err.message);
            }
        }
        
        // Verificar tabelas finais
        console.log('\n📋 Verificando tabelas após criação:');
        const tables = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        console.log('\nTabelas existentes:');
        tables.rows.forEach(row => {
            console.log(`   ✅ ${row.tablename}`);
        });
        console.log(`\nTotal: ${tables.rows.length} tabelas`);
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    } finally {
        await client.end();
    }
}

debugCreateTables();