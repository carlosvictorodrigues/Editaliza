/**
 * Database Utilities - Promise-based database functions
 * 
 * This module provides Promise-based wrappers for SQLite database operations,
 * making it easier to work with async/await in services and repositories.
 */

const db = require('../../database');

/**
 * Get a single row from database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>} - Single row or undefined
 */
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

/**
 * Get all rows from database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Array of rows
 */
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

/**
 * Run a database query (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Result object with lastID, changes, etc.
 */
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this); // Contains lastID, changes, etc.
            }
        });
    });
};

module.exports = {
    dbGet,
    dbAll,
    dbRun
};
