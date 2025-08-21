/**
 * Database Utilities - Promise-based database functions
 * 
 * This module provides Promise-based wrappers for database operations,
 * making it easier to work with async/await in services and repositories.
 */

// Usar PostgreSQL diretamente para resolver problema de timeout
const { Pool } = require('pg');

// Configuração direta do PostgreSQL
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: 'editaliza_password_123',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

console.log('[DATABASE] Usando PostgreSQL direto para resolver timeout');

// Testar conexão na inicialização
pool.connect().then(client => {
    console.log('[DATABASE] Conexão PostgreSQL testada com sucesso');
    client.release();
}).catch(err => {
    console.error('[DATABASE] Erro ao conectar PostgreSQL:', err.message);
});

/**
 * Get a single row from database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>} - Single row or undefined
 */
const dbGet = async (sql, params = []) => {
    console.log(`[DEBUG DB] dbGet executando: ${sql}`);
    console.log(`[DEBUG DB] dbGet params:`, params);
    
    try {
        // Traduzir placeholders SQLite (?) para PostgreSQL ($1, $2, etc)
        let pgSql = sql;
        let pgParams = params;
        
        if (params && params.length > 0) {
            let paramIndex = 1;
            pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            pgParams = params;
        }
        
        console.log(`[DEBUG DB] PostgreSQL query: ${pgSql}`);
        console.log(`[DEBUG DB] PostgreSQL params:`, pgParams);
        
        const result = await pool.query(pgSql, pgParams);
        
        console.log(`[DEBUG DB] dbGet resultado:`, result.rows[0]);
        return result.rows[0] || null;
        
    } catch (error) {
        console.error(`[DEBUG DB] dbGet erro:`, error);
        throw error;
    }
};

/**
 * Get all rows from database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Array of rows
 */
const dbAll = async (sql, params = []) => {
    console.log(`[DEBUG DB] dbAll executando: ${sql}`);
    console.log(`[DEBUG DB] dbAll params:`, params);
    
    try {
        // Traduzir placeholders SQLite (?) para PostgreSQL ($1, $2, etc)
        let pgSql = sql;
        let pgParams = params;
        
        if (params && params.length > 0) {
            let paramIndex = 1;
            pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            pgParams = params;
        }
        
        console.log(`[DEBUG DB] PostgreSQL query: ${pgSql}`);
        console.log(`[DEBUG DB] PostgreSQL params:`, pgParams);
        
        const result = await pool.query(pgSql, pgParams);
        
        console.log(`[DEBUG DB] dbAll resultado:`, result.rows);
        return result.rows;
        
    } catch (error) {
        console.error(`[DEBUG DB] dbAll erro:`, error);
        throw error;
    }
};

/**
 * Run a database query (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Result object with lastID, changes, etc.
 */
const dbRun = async (sql, params = []) => {
    console.log(`[DEBUG DB] dbRun executando: ${sql}`);
    console.log(`[DEBUG DB] dbRun params:`, params);
    
    try {
        // Traduzir placeholders SQLite (?) para PostgreSQL ($1, $2, etc)
        let pgSql = sql;
        let pgParams = params;
        
        if (params && params.length > 0) {
            let paramIndex = 1;
            pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
            pgParams = params;
        }
        
        console.log(`[DEBUG DB] PostgreSQL query: ${pgSql}`);
        console.log(`[DEBUG DB] PostgreSQL params:`, pgParams);
        
        const result = await pool.query(pgSql, pgParams);
        
        console.log(`[DEBUG DB] dbRun resultado:`, result);
        return {
            lastID: result.insertId || null,
            changes: result.rowCount || 0
        };
        
    } catch (error) {
        console.error(`[DEBUG DB] dbRun erro:`, error);
        throw error;
    }
};

module.exports = {
    dbGet,
    dbAll,
    dbRun
};
