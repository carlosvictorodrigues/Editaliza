/**
 * IMPLEMENTAÇÃO SIMPLES E DIRETA DO POSTGRESQL
 * Resolve o problema de timeout da API /plans
 * Versão com suporte a callbacks para compatibilidade
 */

const { Pool } = require('pg');

// Pool de conexões PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || 'editaliza2024',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

console.log('[POSTGRES] Pool PostgreSQL inicializado');

// Função para converter placeholders SQLite (?) para PostgreSQL ($1, $2, etc)
function convertQuery(sql, params) {
    let paramIndex = 1;
    let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    
    // Converter comandos específicos do SQLite para PostgreSQL
    pgSql = pgSql.replace(/BEGIN TRANSACTION/gi, 'BEGIN');
    pgSql = pgSql.replace(/BEGIN IMMEDIATE TRANSACTION/gi, 'BEGIN');
    pgSql = pgSql.replace(/BEGIN IMMEDIATE/gi, 'BEGIN');
    
    return { sql: pgSql, params };
}

// Interface compatível com SQLite
const db = {
    // Método all - buscar múltiplas linhas (com suporte a callback)
    all: (sql, params = [], callback) => {
        // Suportar callback para compatibilidade
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        const executeQuery = async () => {
            try {
                const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
                console.log(`[POSTGRES] Query: ${pgSql}`);
                console.log(`[POSTGRES] Params:`, pgParams);
                
                const result = await pool.query(pgSql, pgParams);
                
                if (!result.rows) {
                    console.error('[POSTGRES] Result sem propriedade rows:', result);
                    return [];
                }
                
                // Converter IDs de string para número se necessário
                const processedRows = result.rows.map(row => {
                    // Normalizar todos os campos que podem ser IDs
                    for (const key in row) {
                        if (key.endsWith('_id') || key === 'id') {
                            if (row[key] && typeof row[key] === 'string' && !isNaN(Number(row[key]))) {
                                row[key] = parseInt(row[key], 10);
                            }
                        }
                    }
                    return row;
                });
                
                console.log(`[POSTGRES] Resultado: ${processedRows.length} linhas`);
                return processedRows;
            } catch (error) {
                console.error('[POSTGRES] Erro em all():', error.message);
                throw error;
            }
        };
        
        const promise = executeQuery();
        
        if (callback) {
            promise.then(rows => callback(null, rows)).catch(err => callback(err));
        } else {
            return promise;
        }
    },

    // Método get - buscar uma linha (com suporte a callback)
    get: (sql, params = [], callback) => {
        // Suportar callback para compatibilidade
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        const executeQuery = async () => {
            try {
                const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
                console.log(`[POSTGRES] Query: ${pgSql}`);
                console.log(`[POSTGRES] Params:`, pgParams);
                
                const result = await pool.query(pgSql, pgParams);
                
                if (!result.rows) {
                    console.error('[POSTGRES] Result sem propriedade rows:', result);
                    return null;
                }
                
                // Converter IDs de string para número se necessário
                const processedRow = result.rows[0] || null;
                if (processedRow) {
                    // Normalizar todos os campos que podem ser IDs
                    for (const key in processedRow) {
                        if (key.endsWith('_id') || key === 'id') {
                            if (processedRow[key] && typeof processedRow[key] === 'string' && !isNaN(Number(processedRow[key]))) {
                                processedRow[key] = parseInt(processedRow[key], 10);
                            }
                        }
                    }
                }
                
                console.log(`[POSTGRES] Resultado: ${processedRow ? 'encontrado' : 'não encontrado'}`);
                return processedRow;
            } catch (error) {
                console.error('[POSTGRES] Erro em get():', error.message);
                throw error;
            }
        };
        
        const promise = executeQuery();
        
        if (callback) {
            promise.then(row => callback(null, row)).catch(err => callback(err));
        } else {
            return promise;
        }
    },

    // Método run - executar comandos (com suporte a callback)
    run: (sql, params = [], callback) => {
        // Suportar callback estilo SQLite
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        const executeQuery = async () => {
            try {
                const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
                console.log(`[POSTGRES] Query: ${pgSql}`);
                console.log(`[POSTGRES] Params:`, pgParams);
                
                // Para INSERTs, automaticamente adicionar RETURNING id se não existir
                let finalSql = pgSql;
                if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
                    finalSql = pgSql + ' RETURNING id';
                    console.log(`[POSTGRES] Adicionado RETURNING id: ${finalSql}`);
                }
                
                const result = await pool.query(finalSql, pgParams);
                console.log(`[POSTGRES] Linhas afetadas: ${result.rowCount}`);
                
                // PostgreSQL retorna lastID através de RETURNING id
                let lastID = null;
                if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
                    lastID = parseInt(result.rows[0].id, 10) || result.rows[0].id;
                    console.log(`[POSTGRES] lastID: ${lastID} (tipo: ${typeof lastID})`);
                }
                
                return {
                    lastID: lastID,
                    changes: result.rowCount || 0
                };
            } catch (error) {
                console.error('[POSTGRES] Erro em run():', error.message);
                throw error;
            }
        };
        
        const promise = executeQuery();
        
        if (callback) {
            // Callback estilo SQLite com 'this' context
            promise.then(result => {
                callback.call(result, null);
            }).catch(err => callback(err));
        } else {
            return promise;
        }
    },

    // Função de teste de conexão
    testConnection: async () => {
        try {
            const client = await pool.connect();
            await client.query('SELECT NOW() as current_time');
            client.release();
            console.log('[POSTGRES] ✅ Teste de conexão bem-sucedido');
            return true;
        } catch (error) {
            console.error('[POSTGRES] ❌ Erro no teste de conexão:', error.message);
            throw error;
        }
    },

    // Função de health check
    healthCheck: async () => {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as version');
            client.release();
            
            return {
                status: 'healthy',
                database: 'postgresql',
                timestamp: result.rows[0].current_time,
                version: result.rows[0].version,
                pool: {
                    total: pool.totalCount,
                    idle: pool.idleCount,
                    waiting: pool.waitingCount
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                database: 'postgresql'
            };
        }
    },

    // Método prepare - compatibilidade com SQLite
    prepare: (sql) => {
        const { sql: pgSql } = convertQuery(sql, []);
        console.log(`[POSTGRES] Prepared statement: ${pgSql}`);
        
        return {
            run: async (...params) => {
                try {
                    const result = await pool.query(pgSql, params);
                    console.log(`[POSTGRES] Prepared run - Linhas afetadas: ${result.rowCount}`);
                    
                    let lastID = null;
                    if (result.rows && result.rows.length > 0 && result.rows[0].id !== undefined) {
                        lastID = parseInt(result.rows[0].id, 10) || result.rows[0].id;
                    }
                    
                    return {
                        lastID: lastID,
                        changes: result.rowCount || 0
                    };
                } catch (error) {
                    console.error('[POSTGRES] Erro em prepared run():', error.message);
                    throw error;
                }
            },
            finalize: (callback) => {
                // PostgreSQL não precisa finalizar prepared statements
                if (callback) callback();
                return Promise.resolve();
            }
        };
    },

    // Propriedades de compatibilidade
    dialect: 'postgresql',
    isPostgreSQL: true,
    isSQLite: false
};

// Testar conexão na inicialização
pool.connect()
    .then(client => {
        console.log('[POSTGRES] ✅ Conexão PostgreSQL testada com sucesso');
        client.release();
    })
    .catch(err => {
        console.error('[POSTGRES] ❌ Erro ao conectar PostgreSQL:', err.message);
    });

module.exports = db;