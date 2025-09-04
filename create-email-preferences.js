const { Client } = require('pg');

async function createEmailPreferencesTable() {
    const client = new Client({
        host: '127.0.0.1',
        port: 5432,
        database: 'editaliza_db',
        user: 'editaliza_user',
        password: '1a2b3c4d'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL');

        // Criar tabela
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_email_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                email_daily_schedule BOOLEAN DEFAULT true,
                email_weekly_summary BOOLEAN DEFAULT true, 
                email_study_reminders BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id)
            )
        `);
        console.log('✅ Tabela user_email_preferences criada');

        // Criar índice
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id 
            ON user_email_preferences(user_id)
        `);
        console.log('✅ Índice criado');

        // Verificar se a tabela foi criada
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_email_preferences'
        `);
        
        console.log('📊 Estrutura da tabela:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
        console.log('🔌 Conexão fechada');
    }
}

createEmailPreferencesTable();