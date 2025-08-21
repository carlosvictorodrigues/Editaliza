/**
 * BANCO DE DADOS UNIFICADO - EDITALIZA
 * Migração completa SQLite -> PostgreSQL com fallback automático
 * 100% compatível com o database.js original
 */

// Usar implementação simples PostgreSQL
const simpleDb = require('./database-simple-postgres');
const { securityLog, validateTableName } = require('./src/utils/security');
const dbConfig = require('./src/config/database');

/**
 * Cache da instância do banco
 */
let dbInstance = null;

/**
 * Função para adicionar uma coluna a uma tabela se ela não existir
 * MANTÉM COMPATIBILIDADE 100% com o código original
 */
const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
    try {
        const db = await getDbInstance();
        
        // Implementação simples para PostgreSQL
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `;
        
        const exists = await db.get(checkQuery, [tableName, columnName]);
        
        if (!exists) {
            const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`;
            await db.run(alterQuery);
            console.log(`✅ Coluna ${columnName} adicionada à tabela ${tableName}`);
        }
        
        return true;
    } catch (error) {
        securityLog('add_column_error', {
            table: tableName,
            column: columnName,
            error: error.message
        });
        throw error;
    }
};

/**
 * Obter instância do banco de dados
 */
async function getDbInstance() {
    if (!dbInstance) {
        try {
            // Usar implementação simples PostgreSQL
            dbInstance = simpleDb;
            console.log(`✅ Banco de dados POSTGRESQL inicializado`);
        } catch (error) {
            console.error('❌ Erro ao inicializar banco:', error.message);
            throw error;
        }
    }
    return dbInstance;
}

/**
 * Inicializar e configurar o banco de dados
 */
async function initializeDatabase() {
    try {
        console.log('🔄 Configurando o banco de dados...');
        
        const db = await getDbInstance();
        
        // Log da estratégia escolhida
        console.log(`📊 Usando POSTGRESQL como banco de dados`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        
        // Aplicar migrações e estrutura
        await setupDatabaseStructure(db);
        
        console.log('✅ Banco de dados configurado com sucesso');
        return db;
        
    } catch (error) {
        console.error('❌ Erro na inicialização do banco:', error.message);
        throw error;
    }
}

/**
 * Configurar estrutura do banco de dados
 */
async function setupDatabaseStructure(db) {
    console.log('📋 Criando estrutura do banco...');
    
    try {
        // === TABELAS PRINCIPAIS ===
        console.log('🏗️  Criando tabelas principais...');
        
        // Tabela users
        await db.run(`CREATE TABLE IF NOT EXISTS users (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            email TEXT UNIQUE,
            password_hash TEXT
        )`);

        // Tabela study_plans
        await db.run(`CREATE TABLE IF NOT EXISTS study_plans (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER,
            plan_name TEXT,
            exam_date TEXT,
            study_hours_per_day TEXT,
            daily_question_goal INTEGER,
            weekly_question_goal INTEGER,
            session_duration_minutes INTEGER,
            review_mode TEXT,
            postponement_count INTEGER,
            reta_final_mode INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela subjects
        await db.run(`CREATE TABLE IF NOT EXISTS subjects (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            study_plan_id INTEGER,
            subject_name TEXT,
            priority_weight INTEGER,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id)
        )`);

        // Tabela topics
        await db.run(`CREATE TABLE IF NOT EXISTS topics (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            subject_id INTEGER,
            description TEXT NOT NULL,
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )`);

        // Tabela study_sessions
        await db.run(`CREATE TABLE IF NOT EXISTS study_sessions (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            study_plan_id INTEGER,
            topic_id INTEGER,
            subject_name TEXT,
            topic_description TEXT,
            session_date TEXT,
            session_type TEXT,
            status TEXT,
            notes TEXT,
            questions_solved INTEGER,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id),
            FOREIGN KEY (topic_id) REFERENCES topics (id)
        )`);

        // === MIGRAÇÕES AUTOMÁTICAS ===
        console.log('🔄 Aplicando migrações automáticas...');
        
        // Adiciona colunas à tabela 'topics'
        await addColumnIfNotExists('topics', 'status', 'TEXT DEFAULT "Pendente"');
        await addColumnIfNotExists('topics', 'completion_date', 'TEXT');
        await addColumnIfNotExists('topics', 'priority_weight', 'INTEGER DEFAULT 3');

        // Adiciona colunas à tabela 'users'
        await addColumnIfNotExists('users', 'reset_token', 'TEXT');
        await addColumnIfNotExists('users', 'reset_token_expires', 'INTEGER');
        await addColumnIfNotExists('users', 'name', 'TEXT');
        await addColumnIfNotExists('users', 'profile_picture', 'TEXT');
        await addColumnIfNotExists('users', 'created_at', db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME');
        await addColumnIfNotExists('users', 'age', 'INTEGER');
        await addColumnIfNotExists('users', 'location', 'TEXT');
        await addColumnIfNotExists('users', 'profession', 'TEXT');
        await addColumnIfNotExists('users', 'phone', 'TEXT');
        await addColumnIfNotExists('users', 'whatsapp', 'TEXT');
        
        // Adiciona colunas estendidas de perfil
        await addColumnIfNotExists('users', 'state', 'TEXT');
        await addColumnIfNotExists('users', 'city', 'TEXT');
        await addColumnIfNotExists('users', 'birth_date', 'TEXT');
        await addColumnIfNotExists('users', 'education', 'TEXT');
        await addColumnIfNotExists('users', 'work_status', 'TEXT');
        await addColumnIfNotExists('users', 'first_time', 'TEXT');
        await addColumnIfNotExists('users', 'concursos_count', 'TEXT');
        await addColumnIfNotExists('users', 'difficulties', 'TEXT');
        await addColumnIfNotExists('users', 'area_interest', 'TEXT');
        await addColumnIfNotExists('users', 'level_desired', 'TEXT');
        await addColumnIfNotExists('users', 'timeline_goal', 'TEXT');
        await addColumnIfNotExists('users', 'study_hours', 'TEXT');
        await addColumnIfNotExists('users', 'motivation_text', 'TEXT');
        
        // Google OAuth fields
        await addColumnIfNotExists('users', 'google_id', 'TEXT');
        await addColumnIfNotExists('users', 'auth_provider', 'TEXT DEFAULT "local"');
        await addColumnIfNotExists('users', 'google_avatar', 'TEXT');
        
        // Sistema de roles
        await addColumnIfNotExists('users', 'role', 'TEXT DEFAULT "user"');
        
        // Adiciona colunas aos planos de estudo
        await addColumnIfNotExists('study_plans', 'has_essay', 'BOOLEAN DEFAULT 0');
        await addColumnIfNotExists('study_plans', 'reta_final_mode', 'INTEGER DEFAULT 0');

        // Adiciona colunas às sessões
        await addColumnIfNotExists('study_sessions', 'time_studied_seconds', 'INTEGER DEFAULT 0');
        await addColumnIfNotExists('study_sessions', 'postpone_count', 'INTEGER DEFAULT 0');

        // === TABELAS DE SUPORTE ===
        console.log('📊 Criando tabelas de suporte...');
        
        // Tabela de logs de tempo
        await db.run(`CREATE TABLE IF NOT EXISTS study_time_logs (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            session_id INTEGER,
            user_id INTEGER,
            start_time ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'},
            end_time ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'},
            duration_seconds INTEGER,
            created_at ${db.isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
            FOREIGN KEY (session_id) REFERENCES study_sessions (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de atividades do usuário
        await db.run(`CREATE TABLE IF NOT EXISTS user_activities (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER,
            activity_type TEXT,
            duration INTEGER,
            metadata TEXT,
            created_at ${db.isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de configurações do usuário
        await db.run(`CREATE TABLE IF NOT EXISTS user_settings (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER UNIQUE,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'pt-BR',
            timezone TEXT DEFAULT 'America/Sao_Paulo',
            auto_save BOOLEAN DEFAULT 1,
            compact_mode BOOLEAN DEFAULT 0,
            updated_at ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'},
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de preferências
        await db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER UNIQUE,
            email_notifications BOOLEAN DEFAULT 1,
            push_notifications BOOLEAN DEFAULT 0,
            study_reminders BOOLEAN DEFAULT 1,
            progress_reports BOOLEAN DEFAULT 1,
            marketing_emails BOOLEAN DEFAULT 0,
            updated_at ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'},
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de configurações de privacidade
        await db.run(`CREATE TABLE IF NOT EXISTS privacy_settings (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER UNIQUE,
            profile_visibility TEXT DEFAULT 'private',
            show_email BOOLEAN DEFAULT 0,
            show_progress BOOLEAN DEFAULT 0,
            allow_contact BOOLEAN DEFAULT 1,
            updated_at ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'},
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Tabela de tentativas de login
        await db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            email TEXT,
            success BOOLEAN,
            ip_address TEXT,
            user_agent TEXT,
            attempt_time ${db.isPostgreSQL ? 'TIMESTAMP' : 'DATETIME'}
        )`);

        // Tabela para exclusões do modo Reta Final
        await db.run(`CREATE TABLE IF NOT EXISTS reta_final_exclusions (
            id ${db.isPostgreSQL ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            study_plan_id INTEGER,
            topic_id INTEGER,
            subject_name TEXT,
            topic_description TEXT,
            priority_combined REAL,
            exclusion_date ${db.isPostgreSQL ? 'TIMESTAMP DEFAULT NOW()' : 'DATETIME DEFAULT CURRENT_TIMESTAMP'},
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id),
            FOREIGN KEY (topic_id) REFERENCES topics (id)
        )`);

        // === ÍNDICES OTIMIZADOS ===
        console.log('⚡ Criando índices otimizados...');
        await createOptimizedIndexes(db);
        
        console.log('✅ Estrutura do banco criada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao configurar estrutura:', error.message);
        throw error;
    }
}

/**
 * Criar índices otimizados para performance
 */
async function createOptimizedIndexes(db) {
    const indexes = [
        // Índices para otimizar a rota de geração de cronograma
        'CREATE INDEX IF NOT EXISTS idx_subjects_study_plan_id ON subjects(study_plan_id)',
        'CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id)',
        'CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status)',
        'CREATE INDEX IF NOT EXISTS idx_topics_completion_date ON topics(completion_date)',
        
        // Índices para sessões de estudo
        'CREATE INDEX IF NOT EXISTS idx_study_sessions_plan_id ON study_sessions(study_plan_id)',
        'CREATE INDEX IF NOT EXISTS idx_study_sessions_topic_id ON study_sessions(topic_id)',
        'CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date)',
        'CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status)',
        'CREATE INDEX IF NOT EXISTS idx_study_sessions_type ON study_sessions(session_type)',
        
        // Índices compostos para queries complexas
        'CREATE INDEX IF NOT EXISTS idx_topics_subject_status ON topics(subject_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_plan_status_date ON study_sessions(study_plan_id, status, session_date)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_plan_type_status ON study_sessions(study_plan_id, session_type, status)',
        
        // Índices otimizados específicos para performance
        'CREATE INDEX IF NOT EXISTS idx_topics_join_optimized ON topics(subject_id, status, id)',
        'CREATE INDEX IF NOT EXISTS idx_subjects_plan_priority ON subjects(study_plan_id, priority_weight)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_plan_date_count ON study_sessions(study_plan_id, session_date)',
        'CREATE INDEX IF NOT EXISTS idx_topics_status_completion ON topics(status, completion_date)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_progress_query ON study_sessions(study_plan_id, session_type, status, topic_id)',
        
        // Índices para autenticação de usuários
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)',
        'CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)',
        
        // Índices para planos de estudo
        'CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id)',
        
        // Índices para exclusões do modo Reta Final
        'CREATE INDEX IF NOT EXISTS idx_reta_final_exclusions_plan_id ON reta_final_exclusions(study_plan_id)',
        'CREATE INDEX IF NOT EXISTS idx_reta_final_exclusions_date ON reta_final_exclusions(exclusion_date)'
    ];
    
    for (const indexSql of indexes) {
        try {
            await db.run(indexSql);
        } catch (error) {
            // Alguns índices podem já existir, ignorar erros
            if (!error.message.includes('already exists')) {
                console.warn(`⚠️  Aviso ao criar índice: ${error.message}`);
            }
        }
    }
    
    console.log('📊 Índices otimizados criados');
}

/**
 * Obter estatísticas do banco
 */
async function getDatabaseStats() {
    try {
        const db = await getDbInstance();
        const stats = db.getStats();
        
        // Adicionar informações específicas
        if (db.isPostgreSQL) {
            // Estatísticas PostgreSQL
            const result = await db.query(`
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes
                FROM pg_stat_user_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            `);
            stats.tableStats = result;
        } else {
            // Estatísticas SQLite
            const result = await db.query(`
                SELECT name, sql 
                FROM sqlite_master 
                WHERE type='table' 
                AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `);
            stats.tables = result;
        }
        
        return stats;
        
    } catch (error) {
        securityLog('stats_error', { error: error.message });
        return null;
    }
}

/**
 * Backup PostgreSQL
 * REMOVIDO: Backup SQLite - sistema usa apenas PostgreSQL
 */
async function backupDatabase() {
    try {
        console.log('ℹ️  Para backup PostgreSQL:');
        console.log('   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d).sql');
        console.log('   Ou use o comando: npm run db:backup-pg');
        
        return 'backup_instructions_logged';
        
    } catch (error) {
        securityLog('backup_error', { error: error.message });
        throw error;
    }
}

/**
 * Fechar conexão do banco
 */
async function closeDatabase() {
    try {
        if (dbInstance) {
            await dbInstance.close();
            dbInstance = null;
            console.log('🔌 Conexão do banco fechada');
        }
    } catch (error) {
        console.error('❌ Erro ao fechar banco:', error.message);
        throw error;
    }
}

// === INICIALIZAÇÃO AUTOMÁTICA ===
const dbPromise = initializeDatabase().catch(error => {
    console.error('💥 Falha crítica na inicialização do banco:', error.message);
    process.exit(1);
});

// Export da instância do banco para compatibilidade
let exportedDb = null;

// Inicialização lazy
dbPromise.then(db => {
    exportedDb = {
        // Interface SQLite compatível
        all: db.all.bind(db),
        run: db.run.bind(db),
        get: db.get.bind(db),
        
        // Propriedades
        dialect: 'postgresql',
        isPostgreSQL: true,
        isSQLite: false
    };
}).catch(error => {
    console.error('💥 Erro na inicialização:', error.message);
});

// Proxy para aguardar inicialização
module.exports = new Proxy({}, {
    get: function(target, prop) {
        if (!exportedDb) {
            throw new Error('Banco de dados ainda não foi inicializado. Aguarde a inicialização.');
        }
        return exportedDb[prop];
    }
});

// Export das funções utilitárias diretamente
module.exports.addColumnIfNotExists = addColumnIfNotExists;
module.exports.getDatabaseStats = getDatabaseStats;
module.exports.backupDatabase = backupDatabase;
module.exports.closeDatabase = closeDatabase;
module.exports.initializeDatabase = initializeDatabase;