/**
 * DATABASE WRAPPER - FASE 4 MIGRATION - POSTGRESQL SIMPLE
 * Wrapper para as funções de banco utilizadas pelos controllers modulares
 * 
 * CORREÇÃO: Usar database-simple-postgres.js ao invés de database-postgresql.js
 * para resolver problemas de timeout e compatibilidade
 */

// CORREÇÃO: Usar implementação simples PostgreSQL
const db = require('../../database-simple-postgres.js');

// Funções utilitárias já retornam promises diretamente
const dbGet = async (sql, params = []) => {
    try {
        console.log('[DB_WRAPPER] dbGet:', sql.substring(0, 100), 'params:', params?.length || 0);
        return await db.get(sql, params);
    } catch (error) {
        console.error('Database error (dbGet):', error);
        throw error;
    }
};

const dbAll = async (sql, params = []) => {
    try {
        console.log('[DB_WRAPPER] dbAll:', sql.substring(0, 100), 'params:', params?.length || 0);
        
        // Add timeout protection
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database query timeout')), 15000)
        );
        
        const queryPromise = db.all(sql, params);
        return await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
        console.error('Database error (dbAll):', error);
        throw error;
    }
};

const dbRun = async (sql, params = []) => {
    try {
        console.log('[DB_WRAPPER] dbRun:', sql.substring(0, 100), 'params:', params?.length || 0);
        return await db.run(sql, params);
    } catch (error) {
        console.error('Database error (dbRun):', error);
        throw error;
    }
};

module.exports = {
    dbGet,
    dbAll,
    dbRun,
    db // Exportar a instância do banco também
};