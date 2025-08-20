const { Pool } = require('pg');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Importar utilitários de segurança
const { validateTableName, securityLog } = require('./src/utils/security');

// Configuração do PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD,
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Pool de backup SQLite caso PostgreSQL falhe
let sqliteBackup = null;

// Função para inicializar SQLite como backup
function initSQLiteBackup() {
    if (!sqliteBackup) {
        const sqlite3 = require('sqlite3').verbose();
        sqliteBackup = new sqlite3.Database('./db.sqlite');
        console.log('SQLite backup initialized');
    }
    return sqliteBackup;
}

// Função para testar conexão PostgreSQL
async function testPostgreSQLConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('PostgreSQL connection successful');
        return true;
    } catch (error) {
        console.error('PostgreSQL connection failed:', error.message);
        return false;
    }
}

// Função para converter SQL do SQLite para PostgreSQL
function convertSQLiteToPostgreSQL(sql, params = []) {
    let pgSQL = sql;
    
    // Converter placeholders ? para $1, $2, etc
    let paramIndex = 0;
    pgSQL = pgSQL.replace(/\?/g, () => `$${++paramIndex}`);
    
    // Converter funções de data
    pgSQL = pgSQL.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    pgSQL = pgSQL.replace(/date\('now'\)/gi, 'CURRENT_DATE');
    
    // Converter AUTOINCREMENT para SERIAL
    pgSQL = pgSQL.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
    pgSQL = pgSQL.replace(/AUTOINCREMENT/gi, '');
    
    // Converter PRAGMA (ignorar - específico do SQLite)
    if (pgSQL.toLowerCase().startsWith('pragma')) {
        return null; // Ignorar comandos PRAGMA
    }
    
    // Converter CREATE INDEX IF NOT EXISTS
    pgSQL = pgSQL.replace(/CREATE INDEX IF NOT EXISTS/gi, 'CREATE INDEX IF NOT EXISTS');
    
    // Converter tipos de dados
    pgSQL = pgSQL.replace(/\bTEXT\b/gi, 'TEXT');
    pgSQL = pgSQL.replace(/\bBLOB\b/gi, 'BYTEA');
    pgSQL = pgSQL.replace(/\bINTEGER\b/gi, 'INTEGER');
    pgSQL = pgSQL.replace(/\bBOOLEAN\b/gi, 'BOOLEAN');
    
    // Converter LIMIT com offset estilo SQLite para PostgreSQL
    const limitMatch = pgSQL.match(/LIMIT\s+(\d+)\s*,\s*(\d+)/i);
    if (limitMatch) {
        pgSQL = pgSQL.replace(
            /LIMIT\s+\d+\s*,\s*\d+/i,
            `LIMIT ${limitMatch[2]} OFFSET ${limitMatch[1]}`
        );
    }
    
    return pgSQL;
}

// Função para adicionar uma coluna a uma tabela se ela não existir (PostgreSQL)
const addColumnIfNotExistsPostgreSQL = async (tableName, columnName, columnDef) => {
    try {
        // Validar nome da tabela para prevenir SQL Injection
        const validatedTableName = validateTableName(tableName);
        
        // Verificar se a coluna já existe
        const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `;
        
        const result = await pool.query(checkColumnQuery, [validatedTableName, columnName]);
        
        if (result.rows.length === 0) {
            console.log(`Adicionando coluna '${columnName}' à tabela '${validatedTableName}'...`);
            
            // Validar definição da coluna
            if (!/^[a-zA-Z0-9_\s()]+$/.test(columnDef)) {
                throw new Error('Definição de coluna contém caracteres inválidos');
            }
            
            const alterQuery = `ALTER TABLE "${validatedTableName}" ADD COLUMN "${columnName}" ${columnDef}`;
            await pool.query(alterQuery);
            
            console.log(`Coluna '${columnName}' adicionada com sucesso.`);
            securityLog('column_added', { table: tableName, column: columnName });
        }
    } catch (error) {
        console.error(`Erro ao adicionar coluna ${columnName} na tabela ${tableName}:`, error.message);
        securityLog('column_add_error', { error: error.message, table: tableName, column: columnName });
        throw error;
    }
};

// Função auxiliar para executar queries com fallback
async function executeQueryWithFallback(operation, query, params = []) {
    try {
        // Tentar PostgreSQL primeiro
        const pgQuery = convertSQLiteToPostgreSQL(query, params);
        
        if (!pgQuery) {
            // Query ignorada (ex: PRAGMA)
            return null;
        }
        
        if (operation === 'get') {
            const result = await pool.query(pgQuery, params);
            return result.rows[0] || null;
        } else if (operation === 'all') {
            const result = await pool.query(pgQuery, params);
            return result.rows;
        } else if (operation === 'run') {
            // Para INSERT, adicionar RETURNING se necessário
            let finalQuery = pgQuery;
            if (query.toLowerCase().startsWith('insert') && !pgQuery.toLowerCase().includes('returning')) {
                finalQuery += ' RETURNING id';
            }
            
            const result = await pool.query(finalQuery, params);
            return {
                lastID: result.rows[0]?.id || null,
                changes: result.rowCount || 0
            };
        }
    } catch (error) {
        console.warn(`PostgreSQL ${operation} failed:`, error.message);
        console.warn('Attempting SQLite fallback...');
        
        // Fallback para SQLite
        const sqlite = initSQLiteBackup();
        
        return new Promise((resolve, reject) => {
            if (operation === 'get') {
                sqlite.get(query, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            } else if (operation === 'all') {
                sqlite.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            } else if (operation === 'run') {
                sqlite.run(query, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID, changes: this.changes });
                });
            }
        });
    }
}

// Inicialização do banco de dados
async function initializeDatabase() {
    console.log('Inicializando conexão com PostgreSQL...');
    
    // Testar conexão
    const pgConnected = await testPostgreSQLConnection();
    
    if (!pgConnected) {
        console.warn('Falha na conexão PostgreSQL. Inicializando SQLite como backup...');
        initSQLiteBackup();
    }
    
    try {
        console.log('Configurando o banco de dados...');
        
        // Criação das tabelas principais se não existirem
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS study_plans (
            id SERIAL PRIMARY KEY,
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
        
        await pool.query(`CREATE TABLE IF NOT EXISTS subjects (
            id SERIAL PRIMARY KEY,
            study_plan_id INTEGER,
            subject_name TEXT,
            priority_weight INTEGER,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS topics (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER,
            description TEXT NOT NULL,
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS study_sessions (
            id SERIAL PRIMARY KEY,
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
        
        // Migrações automáticas
        console.log('Verificando atualizações do banco de dados...');
        
        // Adiciona colunas à tabela 'topics'
        await addColumnIfNotExistsPostgreSQL('topics', 'status', 'TEXT DEFAULT \'Pendente\'');
        await addColumnIfNotExistsPostgreSQL('topics', 'completion_date', 'TEXT');
        
        // Adiciona colunas à tabela 'users'
        await addColumnIfNotExistsPostgreSQL('users', 'reset_token', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'reset_token_expires', 'INTEGER');
        await addColumnIfNotExistsPostgreSQL('users', 'name', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'profile_picture', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'created_at', 'TIMESTAMP');
        await addColumnIfNotExistsPostgreSQL('users', 'age', 'INTEGER');
        await addColumnIfNotExistsPostgreSQL('users', 'location', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'profession', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'phone', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'whatsapp', 'TEXT');
        
        // Adiciona colunas específicas
        await addColumnIfNotExistsPostgreSQL('study_plans', 'has_essay', 'BOOLEAN DEFAULT false');
        await addColumnIfNotExistsPostgreSQL('study_plans', 'reta_final_mode', 'INTEGER DEFAULT 0');
        
        // Perfil estendido
        await addColumnIfNotExistsPostgreSQL('users', 'state', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'city', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'birth_date', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'education', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'work_status', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'first_time', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'concursos_count', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'difficulties', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'area_interest', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'level_desired', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'timeline_goal', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'study_hours', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'motivation_text', 'TEXT');
        
        // OAuth Google
        await addColumnIfNotExistsPostgreSQL('users', 'google_id', 'TEXT');
        await addColumnIfNotExistsPostgreSQL('users', 'auth_provider', 'TEXT DEFAULT \'local\'');
        await addColumnIfNotExistsPostgreSQL('users', 'google_avatar', 'TEXT');
        
        // Sistema de roles
        await addColumnIfNotExistsPostgreSQL('users', 'role', 'TEXT DEFAULT \'user\'');
        
        // Tempo estudado
        await addColumnIfNotExistsPostgreSQL('study_sessions', 'time_studied_seconds', 'INTEGER DEFAULT 0');
        await addColumnIfNotExistsPostgreSQL('study_sessions', 'postpone_count', 'INTEGER DEFAULT 0');
        await addColumnIfNotExistsPostgreSQL('topics', 'priority_weight', 'INTEGER DEFAULT 3');
        
        // Criar tabelas auxiliares
        await pool.query(`CREATE TABLE IF NOT EXISTS study_time_logs (
            id SERIAL PRIMARY KEY,
            session_id INTEGER,
            user_id INTEGER,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            duration_seconds INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES study_sessions (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS user_activities (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            activity_type TEXT,
            duration INTEGER,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS user_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'pt-BR',
            timezone TEXT DEFAULT 'America/Sao_Paulo',
            auto_save BOOLEAN DEFAULT true,
            compact_mode BOOLEAN DEFAULT false,
            updated_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS user_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE,
            email_notifications BOOLEAN DEFAULT true,
            push_notifications BOOLEAN DEFAULT false,
            study_reminders BOOLEAN DEFAULT true,
            progress_reports BOOLEAN DEFAULT true,
            marketing_emails BOOLEAN DEFAULT false,
            updated_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS privacy_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE,
            profile_visibility TEXT DEFAULT 'private',
            show_email BOOLEAN DEFAULT false,
            show_progress BOOLEAN DEFAULT false,
            allow_contact BOOLEAN DEFAULT true,
            updated_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS login_attempts (
            id SERIAL PRIMARY KEY,
            email TEXT,
            success BOOLEAN,
            ip_address TEXT,
            user_agent TEXT,
            attempt_time TIMESTAMP
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS reta_final_excluded_topics (
            id SERIAL PRIMARY KEY,
            study_plan_id INTEGER,
            subject_name TEXT,
            topic_name TEXT,
            importance INTEGER,
            priority_weight REAL,
            reason TEXT,
            excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id)
        )`);
        
        await pool.query(`CREATE TABLE IF NOT EXISTS reta_final_exclusions (
            id SERIAL PRIMARY KEY,
            study_plan_id INTEGER,
            topic_id INTEGER,
            subject_name TEXT,
            topic_description TEXT,
            priority_combined REAL,
            exclusion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (study_plan_id) REFERENCES study_plans (id),
            FOREIGN KEY (topic_id) REFERENCES topics (id)
        )`);
        
        // Criar índices otimizados
        console.log('Criando índices otimizados para performance...');
        
        const indices = [
            'CREATE INDEX IF NOT EXISTS idx_subjects_study_plan_id ON subjects(study_plan_id)',
            'CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id)',
            'CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status)',
            'CREATE INDEX IF NOT EXISTS idx_topics_completion_date ON topics(completion_date)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_plan_id ON study_sessions(study_plan_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_topic_id ON study_sessions(topic_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_type ON study_sessions(session_type)',
            'CREATE INDEX IF NOT EXISTS idx_topics_subject_status ON topics(subject_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_plan_status_date ON study_sessions(study_plan_id, status, session_date)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_plan_type_status ON study_sessions(study_plan_id, session_type, status)',
            'CREATE INDEX IF NOT EXISTS idx_topics_join_optimized ON topics(subject_id, status, id)',
            'CREATE INDEX IF NOT EXISTS idx_subjects_plan_priority ON subjects(study_plan_id, priority_weight DESC)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_plan_date_count ON study_sessions(study_plan_id, session_date)',
            'CREATE INDEX IF NOT EXISTS idx_topics_status_completion ON topics(status, completion_date)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_progress_query ON study_sessions(study_plan_id, session_type, status, topic_id)',
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)',
            'CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_reta_final_exclusions_plan_id ON reta_final_exclusions(study_plan_id)',
            'CREATE INDEX IF NOT EXISTS idx_reta_final_exclusions_date ON reta_final_exclusions(exclusion_date)'
        ];
        
        for (const indexQuery of indices) {
            try {
                await pool.query(indexQuery);
            } catch (error) {
                console.warn(`Falha ao criar índice: ${error.message}`);
            }
        }
        
        console.log('Índices criados com sucesso.');
        console.log('Banco de dados PostgreSQL configurado com sucesso.');
        
    } catch (error) {
        console.error('Erro ao configurar banco de dados:', error.message);
        console.log('Inicializando SQLite como fallback...');
        initSQLiteBackup();
    }
}

// Funções de compatibilidade com a API existente
const dbGet = async (sql, params = []) => {
    return executeQueryWithFallback('get', sql, params);
};

const dbAll = async (sql, params = []) => {
    return executeQueryWithFallback('all', sql, params);
};

const dbRun = async (sql, params = []) => {
    return executeQueryWithFallback('run', sql, params);
};

// Objeto principal simulando a interface SQLite
const db = {
    get: dbGet,
    all: dbAll,
    run: dbRun,
    serialize: (callback) => {
        // PostgreSQL não precisa de serialize, executar diretamente
        callback();
    },
    close: async () => {
        await pool.end();
        if (sqliteBackup) {
            sqliteBackup.close();
        }
    }
};

// Inicializar o banco de dados
initializeDatabase().catch(error => {
    console.error('Falha crítica na inicialização do banco:', error.message);
    process.exit(1);
});

// Exportar as funções e o objeto db para compatibilidade
module.exports = db;
module.exports.dbGet = dbGet;
module.exports.dbAll = dbAll;
module.exports.dbRun = dbRun;
module.exports.pool = pool;

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Fechando conexões do banco de dados...');
    await db.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Fechando conexões do banco de dados...');
    await db.close();
    process.exit(0);
});