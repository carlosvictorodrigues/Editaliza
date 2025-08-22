/**
 * Database Utilities - Promise-based database functions
 * 
 * This module provides direct access to the database functions.
 * The main database.js already returns Promises in production (PostgreSQL)
 * and handles callbacks in development (SQLite).
 */

const db = require('../../database-postgresql');

// Check if database already returns Promises (PostgreSQL in production)
const isPromiseBased = process.env.NODE_ENV === 'production';

/**
 * Get a single row from database
 */
const dbGet = isPromiseBased 
    ? (sql, params = []) => db.get(sql, params)
    : (sql, params = []) => {
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
 */
const dbAll = isPromiseBased
    ? (sql, params = []) => db.all(sql, params)
    : (sql, params = []) => {
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
 */
const dbRun = isPromiseBased
    ? (sql, params = []) => db.run(sql, params)
    : (sql, params = []) => {
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