const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

// Importar utilitários de segurança
const { validateTableName, securityLog } = require('./src/utils/security');

// Função para adicionar uma coluna a uma tabela se ela não existir
const addColumnIfNotExists = (tableName, columnName, columnDef) => {
    return new Promise((resolve, reject) => {
        try {
            // CORREÇÃO CRÍTICA: Validar nome da tabela para prevenir SQL Injection
            const validatedTableName = validateTableName(tableName);
            
            // Usar query parametrizada com tabela validada
            db.all(`PRAGMA table_info("${validatedTableName}")`, (err, columns) => {
                if (err) {
                    securityLog('database_error', { error: err.message, table: tableName });
                    return reject(err);
                }
                
                const columnExists = columns.some(col => col.name === columnName);
                if (!columnExists) {
                    console.log(`Adicionando coluna '${columnName}' à tabela '${validatedTableName}'...`);
                    
                    // Validar definição da coluna também
                    if (!/^[a-zA-Z0-9_\s()]+$/.test(columnDef)) {
                        return reject(new Error('Definição de coluna contém caracteres inválidos'));
                    }
                    
                    db.run(`ALTER TABLE "${validatedTableName}" ADD COLUMN "${columnName}" ${columnDef}`, (err) => {
                        if (err) {
                            securityLog('column_add_error', { error: err.message, table: tableName, column: columnName });
                            return reject(err);
                        }
                        console.log(`Coluna '${columnName}' adicionada com sucesso.`);
                        securityLog('column_added', { table: tableName, column: columnName });
                        resolve();
                    });
                } else {
                    // A coluna já existe, não faz nada.
                    resolve();
                }
            });
        } catch (error) {
            securityLog('table_validation_error', { error: error.message, table: tableName });
            reject(error);
        }
    });
};

const db = new sqlite3.Database(DBSOURCE, async (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    }
    
    console.log('Conectado ao banco de dados db.sqlite.');
    
    // OTIMIZAÇÕES DE PERFORMANCE PARA SQLITE
    console.log('Aplicando otimizações de performance...');
    
    // Configurações otimizadas para SQLite
    db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging para melhor concorrência
    db.run('PRAGMA synchronous = NORMAL'); // Balanço entre performance e segurança
    db.run('PRAGMA cache_size = -64000'); // 64MB de cache
    db.run('PRAGMA temp_store = MEMORY'); // Tabelas temporárias em memória
    db.run('PRAGMA mmap_size = 268435456'); // 256MB de memory mapping
    db.run('PRAGMA foreign_keys = ON'); // Manter integridade referencial
    db.run('PRAGMA auto_vacuum = INCREMENTAL'); // Limpeza incremental
    
    console.log('Otimizações SQLite aplicadas com sucesso.');

    db.serialize(async () => {
        console.log('Configurando o banco de dados...');

        // Criação das tabelas principais se não existirem
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password_hash TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS study_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            plan_name TEXT,
            exam_date TEXT,
            study_hours_per_day TEXT,
            daily_question_goal INTEGER,
            weekly_question_goal INTEGER,
            session_duration_minutes INTEGER,
            review_mode TEXT,
            postponement_count INTEGER,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            study_plan_id INTEGER,
            subject_name TEXT,
            priority_weight INTEGER,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER,
            description TEXT NOT NULL,
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        // --- ATUALIZAÇÕES AUTOMÁTICAS DO BANCO DE DADOS (MIGRAÇÕES) ---
        try {
            console.log('Verificando atualizações do banco de dados...');
            // Adiciona colunas à tabela 'topics'
            await addColumnIfNotExists('topics', 'status', 'TEXT DEFAULT "Pendente"');
            await addColumnIfNotExists('topics', 'completion_date', 'TEXT');

            // Adiciona colunas à tabela 'users'
            await addColumnIfNotExists('users', 'reset_token', 'TEXT');
            await addColumnIfNotExists('users', 'reset_token_expires', 'INTEGER');
            // Adiciona colunas de perfil do usuário
            await addColumnIfNotExists('users', 'name', 'TEXT');
            await addColumnIfNotExists('users', 'profile_picture', 'TEXT');
            await addColumnIfNotExists('users', 'created_at', 'DATETIME');
            await addColumnIfNotExists('users', 'age', 'INTEGER');
            await addColumnIfNotExists('users', 'location', 'TEXT');
            await addColumnIfNotExists('users', 'profession', 'TEXT');
            await addColumnIfNotExists('users', 'phone', 'TEXT');
            await addColumnIfNotExists('users', 'whatsapp', 'TEXT');
            
            // PASSO 1 DO PLANO DE AÇÃO: Adiciona coluna 'has_essay' à tabela 'study_plans'
            await addColumnIfNotExists('study_plans', 'has_essay', 'BOOLEAN DEFAULT 0');
            
            // Add extended profile fields
            await addColumnIfNotExists('users', 'state', 'TEXT');
            await addColumnIfNotExists('users', 'city', 'TEXT');
            await addColumnIfNotExists('users', 'birth_date', 'TEXT');
            await addColumnIfNotExists('users', 'education', 'TEXT');
            await addColumnIfNotExists('users', 'work_status', 'TEXT');
            await addColumnIfNotExists('users', 'first_time', 'TEXT');
            await addColumnIfNotExists('users', 'concursos_count', 'TEXT');
            await addColumnIfNotExists('users', 'difficulties', 'TEXT'); // JSON string
            await addColumnIfNotExists('users', 'area_interest', 'TEXT');
            await addColumnIfNotExists('users', 'level_desired', 'TEXT');
            await addColumnIfNotExists('users', 'timeline_goal', 'TEXT');
            await addColumnIfNotExists('users', 'study_hours', 'TEXT');
            await addColumnIfNotExists('users', 'motivation_text', 'TEXT');
            
            // Add Google OAuth fields
            await addColumnIfNotExists('users', 'google_id', 'TEXT');
            await addColumnIfNotExists('users', 'auth_provider', 'TEXT DEFAULT "local"');
            await addColumnIfNotExists('users', 'google_avatar', 'TEXT');
            
	    // Adiciona coluna de tempo estudado
	    await addColumnIfNotExists('study_sessions', 'time_studied_seconds', 'INTEGER DEFAULT 0');

	    // Adiciona coluna de limite de adiamentos
	    await addColumnIfNotExists('study_sessions', 'postpone_count', 'INTEGER DEFAULT 0');
	    // Criar tabela de logs de tempo
            db.run(`CREATE TABLE IF NOT EXISTS study_time_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                user_id INTEGER,
                start_time DATETIME,
                end_time DATETIME,
                duration_seconds INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES study_sessions (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);


            // Criar tabelas de suporte ao usuário
            db.run(`CREATE TABLE IF NOT EXISTS user_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                activity_type TEXT,
                duration INTEGER,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                theme TEXT DEFAULT 'light',
                language TEXT DEFAULT 'pt-BR',
                timezone TEXT DEFAULT 'America/Sao_Paulo',
                auto_save BOOLEAN DEFAULT 1,
                compact_mode BOOLEAN DEFAULT 0,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                email_notifications BOOLEAN DEFAULT 1,
                push_notifications BOOLEAN DEFAULT 0,
                study_reminders BOOLEAN DEFAULT 1,
                progress_reports BOOLEAN DEFAULT 1,
                marketing_emails BOOLEAN DEFAULT 0,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS privacy_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                profile_visibility TEXT DEFAULT 'private',
                show_email BOOLEAN DEFAULT 0,
                show_progress BOOLEAN DEFAULT 0,
                allow_contact BOOLEAN DEFAULT 1,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                success BOOLEAN,
                ip_address TEXT,
                user_agent TEXT,
                attempt_time DATETIME
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                activity_type TEXT,
                duration INTEGER,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                theme TEXT DEFAULT 'light',
                language TEXT DEFAULT 'pt-BR',
                timezone TEXT DEFAULT 'America/Sao_Paulo',
                auto_save BOOLEAN DEFAULT 1,
                compact_mode BOOLEAN DEFAULT 0,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                email_notifications BOOLEAN DEFAULT 1,
                push_notifications BOOLEAN DEFAULT 0,
                study_reminders BOOLEAN DEFAULT 1,
                progress_reports BOOLEAN DEFAULT 1,
                marketing_emails BOOLEAN DEFAULT 0,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS privacy_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                profile_visibility TEXT DEFAULT 'private',
                show_email BOOLEAN DEFAULT 0,
                show_progress BOOLEAN DEFAULT 0,
                allow_contact BOOLEAN DEFAULT 1,
                updated_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                success BOOLEAN,
                ip_address TEXT,
                user_agent TEXT,
                attempt_time DATETIME
            )`);


            // OTIMIZAÇÕES DE PERFORMANCE: Criar índices otimizados
            console.log('Criando índices otimizados para performance...');
            
            // Índices para otimizar a rota de geração de cronograma
            db.run('CREATE INDEX IF NOT EXISTS idx_subjects_study_plan_id ON subjects(study_plan_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status)');
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_completion_date ON topics(completion_date)');
            
            // Índices para sessões de estudo
            db.run('CREATE INDEX IF NOT EXISTS idx_study_sessions_plan_id ON study_sessions(study_plan_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_study_sessions_topic_id ON study_sessions(topic_id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date)');
            db.run('CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status)');
            db.run('CREATE INDEX IF NOT EXISTS idx_study_sessions_type ON study_sessions(session_type)');
            
            // Índice composto para queries complexas da rota generate
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_subject_status ON topics(subject_id, status)');
            db.run('CREATE INDEX IF NOT EXISTS idx_sessions_plan_status_date ON study_sessions(study_plan_id, status, session_date)');
            db.run('CREATE INDEX IF NOT EXISTS idx_sessions_plan_type_status ON study_sessions(study_plan_id, session_type, status)');
            
            // ÍNDICES OTIMIZADOS ESPECÍFICOS PARA PERFORMANCE DA ROTA /plans/:planId/generate
            // 1. Índice otimizado para a consulta JOIN principal (linha 933-942)
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_join_optimized ON topics(subject_id, status, id)');
            db.run('CREATE INDEX IF NOT EXISTS idx_subjects_plan_priority ON subjects(study_plan_id, priority_weight DESC)');
            
            // 2. Índice para contagem de sessões por data (otimizar linha 1227)
            db.run('CREATE INDEX IF NOT EXISTS idx_sessions_plan_date_count ON study_sessions(study_plan_id, session_date)');
            
            // 3. Índice para tópicos concluídos com data
            db.run('CREATE INDEX IF NOT EXISTS idx_topics_status_completion ON topics(status, completion_date)');
            
            // 4. Índice composto para consultas de progresso
            db.run('CREATE INDEX IF NOT EXISTS idx_sessions_progress_query ON study_sessions(study_plan_id, session_type, status, topic_id)');
            
            // Índices para user authentication
            db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
            db.run('CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)');
            db.run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
            
            // Índices para planos de estudo
            db.run('CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id)');
            
            console.log('Índices criados com sucesso.');
            console.log('Banco de dados configurado com sucesso.');
        } catch (error) {
            console.error("Erro ao atualizar o banco de dados:", error.message);
        }
    });
});

module.exports = db;