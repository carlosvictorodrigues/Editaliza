const db = require('./database-postgresql');

async function createGamificationTable() {
    console.log('🎮 Criando tabela de gamificação...\n');
    
    try {
        // Verificar se a tabela já existe
        const checkResult = await db.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_gamification_stats'
            )
        `);
        
        if (checkResult.rows[0].exists) {
            console.log('✅ Tabela user_gamification_stats já existe');
        } else {
            // Criar tabela
            console.log('📝 Criando tabela user_gamification_stats...');
            await db.pool.query(`
                CREATE TABLE user_gamification_stats (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    completed_topics_count INTEGER DEFAULT 0,
                    completed_sessions_count INTEGER DEFAULT 0,
                    total_study_days INTEGER DEFAULT 0,
                    streak_days INTEGER DEFAULT 0,
                    last_activity_date DATE,
                    achievements JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Criar índices
            await db.pool.query(`
                CREATE INDEX idx_user_gamification_stats_user_id 
                ON user_gamification_stats(user_id)
            `);
            
            await db.pool.query(`
                CREATE INDEX idx_user_gamification_stats_xp 
                ON user_gamification_stats(xp DESC)
            `);
            
            console.log('✅ Tabela criada com sucesso!');
        }
        
        // Inicializar registros para usuários existentes
        console.log('\n📝 Inicializando registros de gamificação para usuários existentes...');
        
        const insertResult = await db.pool.query(`
            INSERT INTO user_gamification_stats (user_id, xp, level)
            SELECT 
                u.id,
                0 as xp,
                1 as level
            FROM users u
            LEFT JOIN user_gamification_stats ugs ON u.id = ugs.user_id
            WHERE ugs.user_id IS NULL
            ON CONFLICT (user_id) DO NOTHING
            RETURNING user_id
        `);
        
        console.log(`✅ ${insertResult.rowCount} registros de gamificação criados`);
        
        // Estatísticas
        const statsResult = await db.pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(DISTINCT ugs.user_id) as users_with_gamification
            FROM users u
            LEFT JOIN user_gamification_stats ugs ON u.id = ugs.user_id
        `);
        
        const stats = statsResult.rows[0];
        console.log('\n📊 Estatísticas:');
        console.log(`   Total de usuários: ${stats.total_users}`);
        console.log(`   Usuários com gamificação: ${stats.users_with_gamification}`);
        
        console.log('\n✅ Configuração de gamificação concluída!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
    
    process.exit(0);
}

createGamificationTable();