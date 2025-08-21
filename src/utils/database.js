/**
 * Database Utilities - Promise-based database functions
 * 
 * This module provides Promise-based wrappers for database operations,
 * making it easier to work with async/await in services and repositories.
 */

// Usar implementação simples do PostgreSQL
const db = require('../../database-simple-postgres');

console.log('[DATABASE] Usando implementação simples PostgreSQL');

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
        const result = await db.get(sql, params);
        console.log(`[DEBUG DB] dbGet resultado:`, result);
        return result;
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
        const result = await db.all(sql, params);
        console.log(`[DEBUG DB] dbAll resultado:`, result);
        return result;
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
        const result = await db.run(sql, params);
        console.log(`[DEBUG DB] dbRun resultado:`, result);
        return result;
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
