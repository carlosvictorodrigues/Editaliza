/**
 * Módulo de Gerenciamento de Transações PostgreSQL
 * 
 * Resolve problemas de:
 * - Transações usando clients diferentes do pool
 * - Deadlocks por locks em ordem inconsistente
 * - Timeouts em transações longas
 * 
 * Baseado nas recomendações do ChatGPT para resolver erro 500 e timeouts
 */

const { Pool } = require('pg');

// Reutilizar o pool existente do sistema
const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

/**
 * Executa trabalho dentro de uma transação com client dedicado
 * 
 * @param {Function} work - Função assíncrona que recebe o client
 * @param {Object} options - Opções de configuração da transação
 * @returns {Promise<any>} Resultado do trabalho
 */
async function withTransaction(work, options = {}) {
    const {
        lockTimeout = 3000,      // 3 segundos para aguardar locks
        statementTimeout = 8000,  // 8 segundos para queries
        idleTimeout = 5000,       // 5 segundos idle na transação
        isolationLevel = 'READ COMMITTED'
    } = options;
    
    const client = await pool.connect();
    
    try {
        // Configurar timeouts para evitar travamentos
        await client.query(`SET LOCAL lock_timeout = '${lockTimeout}ms'`);
        await client.query(`SET LOCAL statement_timeout = '${statementTimeout}ms'`);
        await client.query(`SET LOCAL idle_in_transaction_session_timeout = '${idleTimeout}ms'`);
        
        // Iniciar transação com nível de isolamento apropriado
        await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
        
        // Executar o trabalho com o client dedicado
        const result = await work(client);
        
        // Commit se tudo der certo
        await client.query('COMMIT');
        
        return result;
        
    } catch (error) {
        // Rollback em caso de erro
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[TRANSACTION] Erro ao fazer rollback:', rollbackError);
        }
        
        // Log detalhado do erro
        console.error('[TRANSACTION] Erro na transação:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            routine: error.routine
        });
        
        // Re-lançar o erro para tratamento no nível superior
        throw error;
        
    } finally {
        // SEMPRE liberar o client de volta para o pool
        client.release();
    }
}

/**
 * Executa trabalho em modo READ ONLY (para leituras)
 * Não usa locks e é mais rápido
 */
async function withReadOnlyTransaction(work) {
    return withTransaction(work, {
        lockTimeout: 1000,      // Timeout menor para leituras
        statementTimeout: 5000,
        isolationLevel: 'READ COMMITTED READ ONLY'
    });
}

/**
 * Helper para executar query simples sem transação
 * Útil para SELECTs simples que não precisam de transação
 */
async function query(sql, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result;
    } finally {
        client.release();
    }
}

/**
 * Helper para executar query simples com resultado único
 */
async function queryOne(sql, params = []) {
    const result = await query(sql, params);
    return result.rows[0] || null;
}

/**
 * Helper para executar query simples com múltiplos resultados
 */
async function queryMany(sql, params = []) {
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Verifica e mata transações idle que podem estar causando locks
 */
async function killIdleTransactions() {
    try {
        const result = await query(`
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND state = 'idle in transaction'
              AND state_change < NOW() - INTERVAL '5 seconds'
        `);
        
        if (result.rowCount > 0) {
            console.log(`[TRANSACTION] Terminadas ${result.rowCount} transações idle`);
        }
        
        return result.rowCount;
    } catch (error) {
        console.error('[TRANSACTION] Erro ao matar transações idle:', error);
        return 0;
    }
}

/**
 * Monitora locks ativos no banco
 */
async function getActiveLocks() {
    try {
        const result = await query(`
            SELECT 
                l.pid,
                a.usename,
                a.application_name,
                a.state,
                a.query_start,
                age(now(), a.query_start) AS query_age,
                a.query
            FROM pg_locks l
            JOIN pg_stat_activity a ON l.pid = a.pid
            WHERE NOT l.granted
            ORDER BY a.query_start
        `);
        
        return result.rows;
    } catch (error) {
        console.error('[TRANSACTION] Erro ao buscar locks:', error);
        return [];
    }
}

module.exports = {
    pool,
    withTransaction,
    withReadOnlyTransaction,
    query,
    queryOne,
    queryMany,
    killIdleTransactions,
    getActiveLocks
};