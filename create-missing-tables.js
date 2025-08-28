// Script para criar tabelas críticas faltantes
const { Client } = require('pg');
require('dotenv').config();

async function createMissingTables() {
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
        
        const tables = [
            {
                name: 'user_gamification_stats',
                sql: `CREATE TABLE IF NOT EXISTS user_gamification_stats (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    current_streak INTEGER DEFAULT 0,
                    longest_streak INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'user_achievements',
                sql: `CREATE TABLE IF NOT EXISTS user_achievements (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    achievement_id VARCHAR(100) NOT NULL,
                    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, achievement_id)
                )`
            },
            {
                name: 'oauth_providers',
                sql: `CREATE TABLE IF NOT EXISTS oauth_providers (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    provider VARCHAR(50) NOT NULL,
                    provider_id VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(provider, provider_id)
                )`
            },
            {
                name: 'schedules',
                sql: `CREATE TABLE IF NOT EXISTS schedules (
                    id SERIAL PRIMARY KEY,
                    study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE,
                    schedule_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'plans',
                sql: `CREATE TABLE IF NOT EXISTS plans (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255),
                    data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'tasks',
                sql: `CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: 'progress',
                sql: `CREATE TABLE IF NOT EXISTS progress (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                    progress_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            }
        ];
        
        console.log('🔧 Criando tabelas críticas faltantes...\n');
        
        for (const table of tables) {
            try {
                await client.query(table.sql);
                console.log(`✅ Tabela '${table.name}' criada/verificada`);
            } catch (err) {
                console.error(`❌ Erro ao criar tabela '${table.name}':`, err.message);
            }
        }
        
        console.log('\n✨ Todas as tabelas críticas foram processadas!');
        
        // Verificar total de tabelas
        const result = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        console.log('\n📋 Tabelas no banco após criação:');
        result.rows.forEach(row => {
            console.log(`   - ${row.tablename}`);
        });
        
        console.log(`\nTotal: ${result.rows.length} tabelas`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

createMissingTables();