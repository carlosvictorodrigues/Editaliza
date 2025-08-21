/**
 * CAMADA DE ABSTRAÇÃO DE BANCO DE DADOS
 * 
 * Esta camada permite trocar entre SQLite e PostgreSQL
 * sem modificar o código da aplicação.
 * 
 * PRINCÍPIO: Segurança máxima - sempre falha para SQLite se houver dúvida
 */

const path = require('path');
const fs = require('fs');

class DatabaseAdapter {
    constructor(config = {}) {
        // Por padrão, usa SQLite (mais seguro)
        this.dbType = process.env.DB_TYPE || config.dbType || 'sqlite';
        this.isInitialized = false;
        this.connection = null;
        this.transactionDepth = 0;
        this.queryLog = [];
        this.errorLog = [];
        
        // Configurações de segurança
        this.safeMode = process.env.SAFE_MODE !== 'false'; // Ativo por padrão
        this.dualWrite = process.env.DUAL_WRITE === 'true';
        this.readFromPG = process.env.READ_FROM_PG === 'true';
        
        // Métricas para monitoramento
        this.metrics = {
            queries: 0,
            errors: 0,
            avgResponseTime: 0,
            lastError: null
        };
    }

    async initialize() {
        if (this.isInitialized) {
            return this.connection;
        }

        try {
            if (this.dbType === 'postgresql') {
                await this.initPostgreSQL();
            } else {
                await this.initSQLite();
            }
            
            this.isInitialized = true;
            console.log(`✅ Database adapter initialized: ${this.dbType}`);
            
        } catch (error) {
            console.error(`❌ Failed to initialize ${this.dbType}:`, error.message);
            
            // Fallback para SQLite se PostgreSQL falhar
            if (this.dbType === 'postgresql' && this.safeMode) {
                console.log('🔄 Falling back to SQLite...');
                this.dbType = 'sqlite';
                await this.initSQLite();
                this.isInitialized = true;
            } else {
                throw error;
            }
        }

        return this.connection;
    }

    async initSQLite() {
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = process.env.SQLITE_DB_PATH || './db.sqlite';
        
        return new Promise((resolve, reject) => {
            this.connection = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // Aplicar otimizações SQLite
                    this.connection.run('PRAGMA journal_mode = WAL');
                    this.connection.run('PRAGMA synchronous = NORMAL');
                    this.connection.run('PRAGMA cache_size = -64000');
                    this.connection.run('PRAGMA foreign_keys = ON');
                    
                    resolve(this.connection);
                }
            });
        });
    }

    async initPostgreSQL() {
        const { Pool } = require('pg');
        
        const config = {
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            database: process.env.PG_DATABASE || 'editaliza_dev',
            user: process.env.PG_USER || 'postgres',
            password: process.env.PG_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        };

        this.connection = new Pool(config);
        
        // Testar conexão
        const client = await this.connection.connect();
        await client.query('SELECT NOW()');
        client.release();
    }

    /**
     * Método principal GET - retorna uma única linha
     */
    async get(sql, params = []) {
        const startTime = Date.now();
        
        try {
            let result;
            
            if (this.dbType === 'sqlite') {
                result = await this.getSQLite(sql, params);
            } else {
                result = await this.getPostgreSQL(sql, params);
            }
            
            this.recordMetrics(Date.now() - startTime, false);
            return result;
            
        } catch (error) {
            this.recordMetrics(Date.now() - startTime, true, error);
            
            if (this.safeMode && this.dbType === 'postgresql') {
                console.warn('⚠️  PostgreSQL query failed, trying SQLite fallback');
                return this.getSQLite(sql, params);
            }
            
            throw error;
        }
    }

    async getSQLite(sql, params) {
        return new Promise((resolve, reject) => {
            this.connection.get(sql, params, (err, row) => {
                if (err) {
                    this.logError('SQLite GET', sql, err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getPostgreSQL(sql, params) {
        const pgSQL = this.convertToPostgreSQL(sql, params);
        const result = await this.connection.query(pgSQL);
        return result.rows[0];
    }

    /**
     * Método principal ALL - retorna todas as linhas
     */
    async all(sql, params = []) {
        const startTime = Date.now();
        
        try {
            let result;
            
            if (this.dbType === 'sqlite') {
                result = await this.allSQLite(sql, params);
            } else {
                result = await this.allPostgreSQL(sql, params);
            }
            
            this.recordMetrics(Date.now() - startTime, false);
            return result;
            
        } catch (error) {
            this.recordMetrics(Date.now() - startTime, true, error);
            
            if (this.safeMode && this.dbType === 'postgresql') {
                console.warn('⚠️  PostgreSQL query failed, trying SQLite fallback');
                return this.allSQLite(sql, params);
            }
            
            throw error;
        }
    }

    async allSQLite(sql, params) {
        return new Promise((resolve, reject) => {
            this.connection.all(sql, params, (err, rows) => {
                if (err) {
                    this.logError('SQLite ALL', sql, err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async allPostgreSQL(sql, params) {
        const pgSQL = this.convertToPostgreSQL(sql, params);
        const result = await this.connection.query(pgSQL);
        return result.rows;
    }

    /**
     * Método principal RUN - executa INSERT, UPDATE, DELETE
     */
    async run(sql, params = []) {
        const startTime = Date.now();
        
        try {
            let result;
            
            // Se dual-write está ativo, escrever em ambos
            if (this.dualWrite && this.dbType === 'postgresql') {
                try {
                    // Escrever primeiro no SQLite (principal)
                    const sqliteResult = await this.runSQLite(sql, params);
                    
                    // Depois no PostgreSQL
                    const pgResult = await this.runPostgreSQL(sql, params);
                    
                    // Retornar resultado do SQLite
                    result = sqliteResult;
                } catch (pgError) {
                    console.warn('⚠️  Dual-write to PostgreSQL failed:', pgError.message);
                    // Continuar apenas com SQLite
                    result = await this.runSQLite(sql, params);
                }
            } else if (this.dbType === 'sqlite') {
                result = await this.runSQLite(sql, params);
            } else {
                result = await this.runPostgreSQL(sql, params);
            }
            
            this.recordMetrics(Date.now() - startTime, false);
            return result;
            
        } catch (error) {
            this.recordMetrics(Date.now() - startTime, true, error);
            
            if (this.safeMode && this.dbType === 'postgresql') {
                console.warn('⚠️  PostgreSQL run failed, trying SQLite fallback');
                return this.runSQLite(sql, params);
            }
            
            throw error;
        }
    }

    async runSQLite(sql, params) {
        return new Promise((resolve, reject) => {
            this.connection.run(sql, params, function(err) {
                if (err) {
                    this.logError('SQLite RUN', sql, err);
                    reject(err);
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    async runPostgreSQL(sql, params) {
        const pgSQL = this.convertToPostgreSQL(sql, params);
        
        // Adicionar RETURNING para INSERT se necessário
        if (sql.toLowerCase().startsWith('insert')) {
            if (!pgSQL.text.toLowerCase().includes('returning')) {
                pgSQL.text += ' RETURNING id';
            }
        }
        
        const result = await this.connection.query(pgSQL);
        
        return {
            lastID: result.rows[0]?.id,
            changes: result.rowCount
        };
    }

    /**
     * Converter SQL do SQLite para PostgreSQL
     */
    convertToPostgreSQL(sql, params) {
        let pgSQL = sql;
        
        // Converter placeholders ? para $1, $2, etc
        let paramIndex = 0;
        pgSQL = pgSQL.replace(/\?/g, () => `$${++paramIndex}`);
        
        // Converter funções de data
        pgSQL = pgSQL.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
        pgSQL = pgSQL.replace(/date\('now'\)/gi, 'CURRENT_DATE');
        
        // Converter AUTOINCREMENT
        pgSQL = pgSQL.replace(/AUTOINCREMENT/gi, '');
        
        // Converter tipos
        pgSQL = pgSQL.replace(/\bTEXT\b/gi, 'VARCHAR(255)');
        pgSQL = pgSQL.replace(/\bBLOB\b/gi, 'BYTEA');
        
        // Converter LIMIT com offset
        const limitMatch = pgSQL.match(/LIMIT\s+(\d+)\s*,\s*(\d+)/i);
        if (limitMatch) {
            pgSQL = pgSQL.replace(
                /LIMIT\s+\d+\s*,\s*\d+/i,
                `LIMIT ${limitMatch[2]} OFFSET ${limitMatch[1]}`
            );
        }
        
        return {
            text: pgSQL,
            values: params
        };
    }

    /**
     * Transações
     */
    async beginTransaction() {
        if (this.dbType === 'sqlite') {
            return new Promise((resolve, reject) => {
                this.connection.run('BEGIN TRANSACTION', (err) => {
                    if (err) reject(err);
                    else {
                        this.transactionDepth++;
                        resolve();
                    }
                });
            });
        } else {
            const client = await this.connection.connect();
            await client.query('BEGIN');
            this.transactionDepth++;
            return client;
        }
    }

    async commit() {
        if (this.dbType === 'sqlite') {
            return new Promise((resolve, reject) => {
                this.connection.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else {
                        this.transactionDepth--;
                        resolve();
                    }
                });
            });
        } else {
            await this.connection.query('COMMIT');
            this.transactionDepth--;
        }
    }

    async rollback() {
        if (this.dbType === 'sqlite') {
            return new Promise((resolve, reject) => {
                this.connection.run('ROLLBACK', (err) => {
                    if (err) reject(err);
                    else {
                        this.transactionDepth = 0;
                        resolve();
                    }
                });
            });
        } else {
            await this.connection.query('ROLLBACK');
            this.transactionDepth = 0;
        }
    }

    /**
     * Métodos auxiliares
     */
    recordMetrics(responseTime, isError, error = null) {
        this.metrics.queries++;
        
        if (isError) {
            this.metrics.errors++;
            this.metrics.lastError = error;
        }
        
        // Calcular média de tempo de resposta
        this.metrics.avgResponseTime = 
            (this.metrics.avgResponseTime * (this.metrics.queries - 1) + responseTime) / 
            this.metrics.queries;
    }

    logError(operation, sql, error) {
        const errorEntry = {
            timestamp: new Date(),
            operation,
            sql,
            error: error.message,
            stack: error.stack
        };
        
        this.errorLog.push(errorEntry);
        
        // Manter apenas os últimos 100 erros
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
        
        // Log para arquivo se configurado
        if (process.env.LOG_DB_ERRORS === 'true') {
            const logPath = path.join(__dirname, '..', '..', 'logs', 'db-errors.log');
            fs.appendFileSync(logPath, JSON.stringify(errorEntry) + '\n');
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            dbType: this.dbType,
            safeMode: this.safeMode,
            dualWrite: this.dualWrite,
            errorCount: this.errorLog.length,
            transactionDepth: this.transactionDepth
        };
    }

    async healthCheck() {
        try {
            const testQuery = 'SELECT 1 as test';
            const result = await this.get(testQuery);
            
            return {
                healthy: true,
                dbType: this.dbType,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                healthy: false,
                dbType: this.dbType,
                error: error.message,
                metrics: this.getMetrics()
            };
        }
    }

    async close() {
        if (this.dbType === 'sqlite') {
            return new Promise((resolve) => {
                this.connection.close(() => {
                    this.isInitialized = false;
                    resolve();
                });
            });
        } else {
            await this.connection.end();
            this.isInitialized = false;
        }
    }
}

// Singleton para garantir uma única instância
let instance = null;

module.exports = {
    DatabaseAdapter,
    
    getInstance: (config) => {
        if (!instance) {
            instance = new DatabaseAdapter(config);
        }
        return instance;
    },
    
    // Manter compatibilidade com código existente
    dbGet: async (sql, params) => {
        const adapter = module.exports.getInstance();
        await adapter.initialize();
        return adapter.get(sql, params);
    },
    
    dbAll: async (sql, params) => {
        const adapter = module.exports.getInstance();
        await adapter.initialize();
        return adapter.all(sql, params);
    },
    
    dbRun: async (sql, params) => {
        const adapter = module.exports.getInstance();
        await adapter.initialize();
        return adapter.run(sql, params);
    }
};