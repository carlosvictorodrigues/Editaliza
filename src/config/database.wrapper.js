/**
 * DATABASE WRAPPER - FASE 4 MIGRATION
 * Wrapper para as funções de banco utilizadas pelos controllers modulares
 * 
 * Este wrapper importa a instância do banco do arquivo principal
 * e exporta as funções dbGet, dbAll, dbRun para uso nos controllers
 */

const db = require('../../database-postgresql.js');

// Funções utilitárias para interagir com o banco usando Promises
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) {
            console.error('Database error (dbGet):', err);
            reject(err);
        } else {
            resolve(row);
        }
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Database error (dbAll):', err);
            reject(err);
        } else {
            resolve(rows);
        }
    });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Database error (dbRun):', err);
            reject(err);
        } else {
            resolve(this); // 'this' contém lastID, changes, etc.
        }
    });
});

module.exports = {
    dbGet,
    dbAll,
    dbRun
};