/**
 * ADAPTADOR UNIVERSAL DE BANCO DE DADOS - EDITALIZA
 * Interface unificada para SQLite e PostgreSQL
 * Mantém 100% compatibilidade com código existente
 */

const sqlite3 = require('sqlite3').verbose();
const { Client, Pool } = require('pg');
const path = require('path');

const dbConfig = require('../config/database');
const { securityLog, validateTableName } = require('./security');
const { translateQuery, getDialectQuery, translateParams, mapResults, adaptCreateTable } = require('./queryMapper');

/**
 * Cache de conexões e pools
 */
let connectionCache = {
    sqlite: null,
    postgresql: null,
    pool: null
};

/**
 * Estatísticas de performance
 */
const stats = {
    queries: 0,
    errors: 0,
    totalTime: 0,
    slowQueries: 0,
    connections: 0,
    poolHits: 0
};

/**
 * Classe principal do adaptador
 */
class DatabaseAdapter {
    constructor() {
        this.dialect = dbConfig.strategy;
        this.config = dbConfig.active;
        this.isPostgreSQL = dbConfig.isPostgreSQL;
        this.isSQLite = dbConfig.isSQLite;
        this.connection = null;
        this.pool = null;
        
        securityLog('database_adapter_init', {
            dialect: this.dialect,
            environment: process.env.NODE_ENV
        });
    }
    
    /**
     * Conectar ao banco de dados
     */
    async connect() {
        try {
            const startTime = Date.now();
            
            if (this.isPostgreSQL) {
                await this._connectPostgreSQL();
            } else {
                await this._connectSQLite();
            }
            
            const connectionTime = Date.now() - startTime;
            stats.connections++;
            
            securityLog('database_connected', {
                dialect: this.dialect,
                connectionTime,
                totalConnections: stats.connections
            });
            
            // Aplicar configurações pós-conexão
            await this._applyPostConnectionConfig();
            
            return this;
            
        } catch (error) {
            securityLog('database_connection_error', {
                dialect: this.dialect,
                error: error.message,
                stack: error.stack
            });
            
            // Tentar fallback para SQLite se PostgreSQL falhar
            if (this.isPostgreSQL && !process.env.FORCE_POSTGRES) {
                console.warn('⚠️  PostgreSQL falhou, usando SQLite como fallback...');
                return this._fallbackToSQLite();
            }
            
            throw error;
        }
    }
    
    /**
     * Conectar ao PostgreSQL
     */
    async _connectPostgreSQL() {
        try {
            // Criar pool de conexões
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                max: this.config.options.max,
                min: this.config.options.min,
                idleTimeoutMillis: this.config.options.idle,
                connectionTimeoutMillis: this.config.options.acquire,
                ssl: this.config.options.ssl,
                application_name: this.config.options.application_name
            });
            
            // Testar conexão
            const testClient = await this.pool.connect();
            await testClient.query('SELECT NOW()');
            testClient.release();
            
            // Cache global
            connectionCache.pool = this.pool;
            connectionCache.postgresql = this.pool;
            
            console.log('✅ Conectado ao PostgreSQL');
            
        } catch (error) {
            console.error('❌ Erro ao conectar PostgreSQL:', error.message);
            throw error;
        }
    }
    
    /**
     * Conectar ao SQLite
     */
    async _connectSQLite() {
        return new Promise((resolve, reject) => {
            try {
                const dbPath = path.resolve(this.config.database);
                
                this.connection = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        console.error('❌ Erro ao conectar SQLite:', err.message);
                        return reject(err);
                    }
                    
                    console.log('✅ Conectado ao SQLite');
                    
                    // Cache global
                    connectionCache.sqlite = this.connection;
                    
                    resolve();
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Aplicar configurações pós-conexão
     */
    async _applyPostConnectionConfig() {
        if (this.isSQLite) {
            await this._applySQLiteConfig();
        } else if (this.isPostgreSQL) {
            await this._applyPostgreSQLConfig();
        }
    }
    
    /**
     * Configurações específicas do SQLite
     */
    async _applySQLiteConfig() {
        const optimizations = [
            'PRAGMA journal_mode = WAL',
            'PRAGMA synchronous = NORMAL',
            'PRAGMA cache_size = -64000',
            'PRAGMA temp_store = MEMORY',
            'PRAGMA mmap_size = 268435456',
            'PRAGMA foreign_keys = ON',
            'PRAGMA auto_vacuum = INCREMENTAL'
        ];
        
        for (const pragma of optimizations) {
            await this.run(pragma);
        }
        
        console.log('⚡ Otimizações SQLite aplicadas');
    }
    
    /**
     * Configurações específicas do PostgreSQL
     */
    async _applyPostgreSQLConfig() {
        try {
            // Configurações de sessão
            await this.run('SET timezone = \'America/Sao_Paulo\'');
            await this.run('SET statement_timeout = \'60s\'');
            await this.run('SET lock_timeout = \'30s\'');
            
            console.log('⚡ Configurações PostgreSQL aplicadas');
            
        } catch (error) {
            console.warn('⚠️  Algumas configurações PostgreSQL falharam:', error.message);
        }
    }
    
    /**
     * Fallback para SQLite
     */
    async _fallbackToSQLite() {
        console.log('🔄 Fazendo fallback para SQLite...');
        
        // Reconfigurar para SQLite
        this.dialect = 'sqlite';
        this.config = dbConfig.sqlite;
        this.isPostgreSQL = false;
        this.isSQLite = true;
        
        // Conectar ao SQLite
        await this._connectSQLite();
        await this._applySQLiteConfig();
        
        securityLog('database_fallback', {
            from: 'postgresql',
            to: 'sqlite',
            reason: 'connection_failed'
        });
        
        return this;
    }
    
    /**
     * Executar query (interface unificada)
     */
    async query(sql, params = []) {
        const startTime = Date.now();
        stats.queries++;
        
        try {
            // Log da query se habilitado
            if (dbConfig.logging.enabled) {
                securityLog('sql_query', {
                    dialect: this.dialect,
                    sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
                    paramCount: Array.isArray(params) ? params.length : Object.keys(params || {}).length
                });
            }
            
            let result;
            
            if (this.isPostgreSQL) {
                result = await this._queryPostgreSQL(sql, params);
            } else {
                result = await this._querySQLite(sql, params);
            }
            
            // Estatísticas de performance
            const queryTime = Date.now() - startTime;
            stats.totalTime += queryTime;
            
            if (queryTime > dbConfig.logging.slow_query_threshold) {
                stats.slowQueries++;
                securityLog('slow_query', {
                    dialect: this.dialect,
                    time: queryTime,
                    sql: sql.substring(0, 100) + '...'
                });
            }
            
            return result;
            
        } catch (error) {
            stats.errors++;
            
            securityLog('query_error', {
                dialect: this.dialect,
                error: error.message,
                sql: sql.substring(0, 100) + '...',
                params: Array.isArray(params) ? params.length : Object.keys(params || {}).length
            });
            
            throw error;
        }
    }
    
    /**
     * Query PostgreSQL
     */
    async _queryPostgreSQL(sql, params) {
        const client = await this.pool.connect();
        stats.poolHits++;
        
        try {
            // Traduzir query se necessário
            const translatedSql = translateQuery(sql, 'sqlite', 'postgresql');
            const translatedParams = translateParams(params, 'sqlite', 'postgresql');
            
            const result = await client.query(translatedSql, translatedParams);
            
            // Verificar se result existe antes de acessar rows
            if (!result) {
                throw new Error('Query returned undefined result');
            }
            
            // Mapear resultados para formato SQLite-compatível
            return mapResults(result.rows || [], 'postgresql', 'sqlite');
            
        } finally {
            client.release();
        }
    }
    
    /**
     * Query SQLite
     */
    async _querySQLite(sql, params) {
        return new Promise((resolve, reject) => {
            // Por enquanto, usar SQL direto para testar
            this.connection.all(sql, params, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                
                resolve(rows);
            });
        });
    }
    
    /**
     * Executar comando (sem retorno de dados)
     */
    async run(sql, params = []) {
        const startTime = Date.now();
        stats.queries++;
        
        try {
            if (this.isPostgreSQL) {
                const client = await this.pool.connect();
                try {
                    const translatedSql = translateQuery(sql, 'sqlite', 'postgresql');
                    const translatedParams = translateParams(params, 'sqlite', 'postgresql');
                    
                    await client.query(translatedSql, translatedParams);
                } finally {
                    client.release();
                }
            } else {
                return new Promise((resolve, reject) => {
                    const translatedSql = translateQuery(sql, 'postgresql', 'sqlite');
                    const translatedParams = translateParams(params, 'postgresql', 'sqlite');
                    
                    this.connection.run(translatedSql, translatedParams, function(err) {
                        if (err) {
                            return reject(err);
                        }
                        resolve({ lastID: this.lastID, changes: this.changes });
                    });
                });
            }
            
        } catch (error) {
            stats.errors++;
            securityLog('run_error', {
                dialect: this.dialect,
                error: error.message,
                sql: sql.substring(0, 100) + '...'
            });
            throw error;
        }
    }
    
    /**
     * Verificar se tabela existe
     */
    async tableExists(tableName) {
        try {
            const validatedTable = validateTableName(tableName);
            const query = getDialectQuery('tableExists', this.dialect);
            const result = await this.query(query, [validatedTable]);
            
            return result && result.length > 0;
            
        } catch (error) {
            securityLog('table_exists_error', {
                table: tableName,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Obter informações da tabela
     */
    async getTableInfo(tableName) {
        try {
            const validatedTable = validateTableName(tableName);
            
            if (this.isPostgreSQL) {
                const query = getDialectQuery('tableInfo', this.dialect);
                const result = await this.query(query, [validatedTable]);
                return result;
            } else {
                // SQLite usa PRAGMA sem parâmetros
                const query = `PRAGMA table_info("${validatedTable}")`;
                const result = await this.query(query, []);
                return result;
            }
            
        } catch (error) {
            securityLog('table_info_error', {
                table: tableName,
                error: error.message
            });
            return [];
        }
    }
    
    /**
     * Verificar se coluna existe
     */
    async columnExists(tableName, columnName) {
        try {
            const validatedTable = validateTableName(tableName);
            
            if (this.isPostgreSQL) {
                const query = getDialectQuery('columnExists', this.dialect);
                const result = await this.query(query, [validatedTable, columnName]);
                return result && result.length > 0;
            } else {
                // SQLite: verificar via PRAGMA table_info
                const query = `PRAGMA table_info("${validatedTable}")`;
                const tableInfo = await this.query(query, []);
                return tableInfo.some(col => col.name === columnName);
            }
            
        } catch (error) {
            securityLog('column_exists_error', {
                table: tableName,
                column: columnName,
                error: error.message
            });
            return false;
        }
    }
    
    /**
     * Adicionar coluna se não existir
     */
    async addColumnIfNotExists(tableName, columnName, columnDef) {
        try {
            const validatedTable = validateTableName(tableName);
            
            // Verificar se coluna já existe
            const exists = await this.columnExists(validatedTable, columnName);
            if (exists) {
                return Promise.resolve();
            }
            
            // Validar definição da coluna (permitir aspas e DEFAULT)
            if (!/^[a-zA-Z0-9_\s()"'=-]+$/.test(columnDef)) {
                throw new Error('Definição de coluna contém caracteres inválidos');
            }
            
            console.log(`Adicionando coluna '${columnName}' à tabela '${validatedTable}'...`);
            
            // Simplificar para primeira versão - usar definição direta
            const query = `ALTER TABLE "${validatedTable}" ADD COLUMN "${columnName}" ${columnDef}`;
            
            await this.run(query);
            
            console.log(`Coluna '${columnName}' adicionada com sucesso.`);
            securityLog('column_added', { table: validatedTable, column: columnName });
            
        } catch (error) {
            securityLog('column_add_error', {
                table: tableName,
                column: columnName,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Obter estatísticas de performance
     */
    getStats() {
        return {
            ...stats,
            avgQueryTime: stats.queries > 0 ? stats.totalTime / stats.queries : 0,
            errorRate: stats.queries > 0 ? (stats.errors / stats.queries) * 100 : 0,
            dialect: this.dialect,
            connected: this.isConnected()
        };
    }
    
    /**
     * Verificar se está conectado
     */
    isConnected() {
        if (this.isPostgreSQL) {
            return this.pool && !this.pool.ended;
        } else {
            return this.connection && this.connection.open;
        }
    }
    
    /**
     * Fechar conexão
     */
    async close() {
        try {
            if (this.isPostgreSQL && this.pool) {
                await this.pool.end();
                console.log('🔌 Pool PostgreSQL fechado');
            } else if (this.isSQLite && this.connection) {
                await new Promise((resolve) => {
                    this.connection.close((err) => {
                        if (err) console.error('Erro ao fechar SQLite:', err.message);
                        console.log('🔌 Conexão SQLite fechada');
                        resolve();
                    });
                });
            }
            
            // Limpar cache
            connectionCache = { sqlite: null, postgresql: null, pool: null };
            
        } catch (error) {
            securityLog('close_error', { error: error.message });
            throw error;
        }
    }
}

/**
 * Singleton global do adaptador
 */
let globalAdapter = null;

/**
 * Obter instância do adaptador
 */
async function getAdapter() {
    if (!globalAdapter) {
        globalAdapter = new DatabaseAdapter();
        await globalAdapter.connect();
    }
    
    return globalAdapter;
}

/**
 * Interface compatível com o database.js original
 */
async function getDatabase() {
    const adapter = await getAdapter();
    
    // Retornar interface compatível com SQLite
    return {
        // Métodos SQLite originais
        all: (sql, params) => adapter.query(sql, params),
        run: (sql, params) => adapter.run(sql, params),
        get: async (sql, params) => {
            const results = await adapter.query(sql, params);
            return results[0] || null;
        },
        
        // Métodos do adaptador
        query: (sql, params) => adapter.query(sql, params),
        tableExists: (table) => adapter.tableExists(table),
        columnExists: (table, column) => adapter.columnExists(table, column),
        addColumnIfNotExists: (table, column, def) => adapter.addColumnIfNotExists(table, column, def),
        getTableInfo: (table) => adapter.getTableInfo(table),
        
        // Métodos de controle
        close: () => adapter.close(),
        isConnected: () => adapter.isConnected(),
        getStats: () => adapter.getStats(),
        
        // Propriedades de compatibilidade
        dialect: adapter.dialect,
        isPostgreSQL: adapter.isPostgreSQL,
        isSQLite: adapter.isSQLite,
        
        // Referência direta para casos especiais
        _adapter: adapter,
        _connection: adapter.connection,
        _pool: adapter.pool
    };
}

module.exports = {
    DatabaseAdapter,
    getAdapter,
    getDatabase,
    stats
};