// Production Database Configuration
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ProductionDatabase {
    constructor() {
        this.dbPath = process.env.DATABASE_PATH || '/app/data/database.db';
        this.db = null;
        this.connectionPool = [];
        this.maxConnections = 10;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async init() {
        try {
            await this.createConnection();
            await this.setupDatabase();
            await this.runMigrations();
            console.log('Production database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize production database:', error);
            process.exit(1);
        }
    }

    async createConnection() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    reject(new Error(`Database connection failed: ${err.message}`));
                } else {
                    console.log('Connected to production SQLite database');
                    // Configure database for production
                    this.configurePragmas();
                    resolve();
                }
            });
        });
    }

    configurePragmas() {
        // Production optimizations
        this.db.run('PRAGMA journal_mode = WAL');
        this.db.run('PRAGMA synchronous = NORMAL');
        this.db.run('PRAGMA cache_size = 10000');
        this.db.run('PRAGMA temp_store = MEMORY');
        this.db.run('PRAGMA mmap_size = 268435456'); // 256MB
        this.db.run('PRAGMA foreign_keys = ON');
        this.db.run('PRAGMA busy_timeout = 30000');
    }

    async setupDatabase() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email_verified BOOLEAN DEFAULT FALSE,
                subscription_plan TEXT DEFAULT 'free',
                subscription_status TEXT DEFAULT 'active',
                subscription_expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login_at DATETIME,
                login_attempts INTEGER DEFAULT 0,
                locked_until DATETIME
            )`,
            
            `CREATE TABLE IF NOT EXISTS study_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_name TEXT NOT NULL,
                description TEXT,
                total_study_days INTEGER NOT NULL,
                daily_study_hours REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reta_final_mode INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                study_plan_id INTEGER NOT NULL,
                subject_name TEXT NOT NULL,
                priority_weight INTEGER NOT NULL DEFAULT 1,
                total_hours_allocated REAL DEFAULT 0,
                completed_hours REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (study_plan_id) REFERENCES study_plans (id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                estimated_hours REAL DEFAULT 1,
                completed BOOLEAN DEFAULT FALSE,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS study_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic_id INTEGER NOT NULL,
                session_date DATE NOT NULL,
                start_time DATETIME,
                end_time DATETIME,
                duration_minutes INTEGER,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                expires_at INTEGER NOT NULL,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id INTEGER,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )`
        ];

        for (const table of tables) {
            await this.runQuery(table);
        }

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
            'CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_subjects_study_plan_id ON subjects(study_plan_id)',
            'CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_topic_id ON study_sessions(topic_id)',
            'CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)'
        ];

        for (const index of indexes) {
            await this.runQuery(index);
        }
    }

    async runMigrations() {
        // Version control for database schema
        await this.runQuery(`
            CREATE TABLE IF NOT EXISTS schema_versions (
                version INTEGER PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const currentVersion = await this.getCurrentVersion();
        const migrations = this.getMigrations();

        for (const migration of migrations) {
            if (migration.version > currentVersion) {
                console.log(`Applying migration ${migration.version}: ${migration.description}`);
                await this.runQuery(migration.sql);
                await this.runQuery(
                    'INSERT INTO schema_versions (version) VALUES (?)',
                    [migration.version]
                );
            }
        }
    }

    async getCurrentVersion() {
        try {
            const result = await this.getQuery(
                'SELECT MAX(version) as version FROM schema_versions'
            );
            return result ? result.version || 0 : 0;
        } catch (error) {
            return 0;
        }
    }

    getMigrations() {
        return [
            {
                version: 1,
                description: 'Add subscription fields to users table',
                sql: `
                    ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'free';
                    ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active';
                    ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME;
                `
            },
            {
                version: 2,
                description: 'Add reta_final_mode to study_plans',
                sql: `
                    ALTER TABLE study_plans ADD COLUMN reta_final_mode INTEGER DEFAULT 0;
                `
            },
            // Add more migrations as needed
        ];
    }

    async runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async backup() {
        const backupPath = `${this.dbPath}.backup.${Date.now()}`;
        return new Promise((resolve, reject) => {
            const backup = this.db.backup(backupPath);
            backup.step(-1, (err) => {
                if (err) {
                    reject(err);
                } else {
                    backup.finish((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`Database backup created: ${backupPath}`);
                            resolve(backupPath);
                        }
                    });
                }
            });
        });
    }

    async healthCheck() {
        try {
            await this.getQuery('SELECT 1');
            return { status: 'healthy', timestamp: new Date().toISOString() };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                error: error.message, 
                timestamp: new Date().toISOString() 
            };
        }
    }

    async close() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
                resolve();
            });
        });
    }
}

// Export singleton instance
const productionDb = new ProductionDatabase();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('Shutting down database connection...');
    await productionDb.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down database connection...');
    await productionDb.close();
    process.exit(0);
});

module.exports = productionDb;