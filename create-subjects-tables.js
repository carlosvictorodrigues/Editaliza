// Script para criar tabelas de subjects e topics no PostgreSQL
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
        console.log('🔧 Criando tabelas de disciplinas e tópicos...\n');

        // Tabela de subjects (disciplinas)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER NOT NULL,
                subject_name VARCHAR(255) NOT NULL,
                priority_weight INTEGER DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela subjects criada');

        // Tabela de topics (tópicos)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                subject_id INTEGER NOT NULL,
                topic_name VARCHAR(500) NOT NULL,
                status VARCHAR(50) DEFAULT 'Pendente',
                priority INTEGER DEFAULT 3,
                difficulty INTEGER DEFAULT 3,
                estimated_hours DECIMAL(5,2) DEFAULT 2.0,
                actual_hours DECIMAL(5,2) DEFAULT 0,
                completion_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela topics criada');

        // Tabela de study_sessions (sessões de estudo)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS study_sessions (
                id SERIAL PRIMARY KEY,
                study_plan_id INTEGER NOT NULL,
                topic_id INTEGER,
                subject_id INTEGER,
                session_date DATE NOT NULL,
                session_type VARCHAR(50) DEFAULT 'Estudo',
                duration_minutes INTEGER DEFAULT 60,
                questions_done INTEGER DEFAULT 0,
                questions_correct INTEGER DEFAULT 0,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'Agendada',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Tabela study_sessions criada');

        // Tabela de reta_final_excluded_topics (exclusões da reta final)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reta_final_excluded_topics (
                id SERIAL PRIMARY KEY,
                plan_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                topic_id INTEGER NOT NULL,
                reason VARCHAR(255),
                excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
                UNIQUE(plan_id, topic_id)
            )
        `);
        console.log('✅ Tabela reta_final_excluded_topics criada');

        // Criar índices para melhor performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_subjects_plan_id ON subjects(study_plan_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_plan_id ON study_sessions(study_plan_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(session_date)`);
        console.log('✅ Índices criados');

        console.log('\n🎉 Todas as tabelas de disciplinas foram criadas com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error);
    } finally {
        await pool.end();
    }
}

createTables();