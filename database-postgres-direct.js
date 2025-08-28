/**
 * PostgreSQL Direct Connection
 * 
 * Conexão direta com PostgreSQL sem adaptadores ou fallbacks
 * Ambiente de desenvolvimento = Ambiente de produção
 */

const { Pool } = require('pg');

// Configuração do pool de conexões
const pool = new Pool({
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user', 
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 10000, // Reduzido para 10s para renovar conexões mais rápido
    connectionTimeoutMillis: 2000,
});

// Configurar search_path corretamente para CADA conexão
pool.on('connect', async (client) => {
    console.log('[POSTGRES] Nova conexão estabelecida com o pool');
    
    // CRÍTICO: Definir search_path para cada nova conexão
    try {
        await client.query('SET search_path TO public, app');
        console.log('[POSTGRES] Search path configurado: public, app');
    } catch (err) {
        console.error('[POSTGRES] Erro ao configurar search_path:', err);
    }
});

pool.on('error', (err) => {
    console.error('[POSTGRES] Erro no pool:', err);
});

/**
 * Executar query simples (SELECT único registro)
 */
async function get(sql, params = []) {
    try {
        // Converter placeholders ? para $n do PostgreSQL
        const pgSQL = convertToPostgreSQL(sql);
        
        // DEBUG: Log completo da query
        if (sql.includes('statistics') || sql.includes('time_studied_seconds')) {
            console.log('\n[DEBUG QUERY] ====================================\n');
            console.log('[DEBUG QUERY] SQL Original:', sql);
            console.log('[DEBUG QUERY] SQL Convertido:', pgSQL);
            console.log('[DEBUG QUERY] Params:', params);
            console.log('\n[DEBUG QUERY] ====================================\n');
        }

        // --- START DEBUG BLOCK ---
        if (sql.includes('time_studied_seconds')) { // Only for relevant queries
            const client = await pool.connect(); // Get a client from the pool
            try {
                const schemaResult = await client.query('SELECT current_schema, current_setting(\'search_path\') as search_path');
                console.log('[DEBUG DB CONTEXT] Current Schema:', schemaResult.rows[0].current_schema);
                console.log('[DEBUG DB CONTEXT] Search Path:', schemaResult.rows[0].search_path);

                const columnCheck = await client.query(`
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'study_sessions' AND column_name = 'time_studied_seconds';
                `);
                if (columnCheck.rows.length > 0) {
                    console.log('[DEBUG DB CONTEXT] time_studied_seconds column EXISTS in public.study_sessions (from within dbGet)');
                } else {
                    console.error('[DEBUG DB CONTEXT] time_studied_seconds column DOES NOT EXIST in public.study_sessions (from within dbGet)');
                }
            } catch (debugError) {
                console.error('[DEBUG DB CONTEXT] Error checking schema/column:', debugError.message);
            } finally {
                client.release(); // Release the client back to the pool
            }
        }
        // --- END DEBUG BLOCK ---
        
        const result = await pool.query(pgSQL, params);
        return result.rows[0] || null;
    } catch (error) {
        console.error('[POSTGRES] Erro em get:', error.message);
        console.error('[POSTGRES] SQL Original:', sql);
        console.error('[POSTGRES] SQL Convertido:', convertToPostgreSQL(sql));
        console.error('[POSTGRES] Params:', params);
        console.error('[POSTGRES] Erro completo:', error);
        throw error;
    }
}

/**
 * Executar query que retorna múltiplos registros
 */
async function all(sql, params = []) {
    try {
        const pgSQL = convertToPostgreSQL(sql);
        const result = await pool.query(pgSQL, params);
        return result.rows;
    } catch (error) {
        console.error('[POSTGRES] Erro em all:', error.message);
        console.error('[POSTGRES] SQL:', sql);
        console.error('[POSTGRES] Params:', params);
        throw error;
    }
}

/**
 * Executar query de modificação (INSERT, UPDATE, DELETE)
 */
async function run(sql, params = []) {
    try {
        const pgSQL = convertToPostgreSQL(sql);
        
        // Adicionar RETURNING id para INSERTs se não tiver (exceto quando tem ON CONFLICT)
        let finalSQL = pgSQL;
        if (pgSQL.toLowerCase().startsWith('insert') && 
            !pgSQL.toLowerCase().includes('returning') && 
            !pgSQL.toLowerCase().includes('on conflict')) {
            finalSQL = pgSQL + ' RETURNING id';
        }
        
        const result = await pool.query(finalSQL, params);
        
        // Formatar resultado para compatibilidade
        return {
            lastID: result.rows[0]?.id || null,
            id: result.rows[0]?.id || null,
            changes: result.rowCount,
            affectedRows: result.rowCount
        };
    } catch (error) {
        console.error('[POSTGRES] Erro em run:', error.message);
        console.error('[POSTGRES] SQL:', sql);
        console.error('[POSTGRES] Params:', params);
        throw error;
    }
}

/**
 * Converter placeholders ? para $n do PostgreSQL
 */
function convertToPostgreSQL(sql) {
    // Se já está no formato PostgreSQL, retornar como está
    if (sql.includes('$1')) {
        return sql;
    }
    
    // Converter ? para $n
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Executar query genérica
 */
async function query(sql, params = []) {
    try {
        const pgSQL = convertToPostgreSQL(sql);
        const result = await pool.query(pgSQL, params);
        return result;
    } catch (error) {
        console.error('[POSTGRES] Erro em query:', error.message);
        throw error;
    }
}

/**
 * Testar conexão
 */
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW() as now');
        console.log('[POSTGRES] Conexão testada com sucesso:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('[POSTGRES] Erro ao testar conexão:', error.message);
        return false;
    }
}

/**
 * Encerrar pool de conexões
 */
async function close() {
    await pool.end();
    console.log('[POSTGRES] Pool de conexões encerrado');
}

// Aliases para compatibilidade
const dbGet = get;
const dbAll = all;
const dbRun = run;

// Forçar renovação de todas as conexões no pool
async function forcePoolRefresh() {
    try {
        // Criar uma nova conexão para forçar o evento 'connect'
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('🔄 [POSTGRES] Pool refresh forçado');
    } catch (err) {
        console.error('❌ [POSTGRES] Erro ao forçar refresh do pool:', err);
    }
}

// Testar conexão ao inicializar e forçar refresh
testConnection().then(async success => {
    if (success) {
        console.log('✅ [POSTGRES-DIRECT] Conectado ao PostgreSQL');
        console.log(`   Host: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}`);
        console.log(`   Database: ${process.env.DB_NAME || 'editaliza_db'}`);
        
        // Forçar renovação do pool
        await forcePoolRefresh();
    } else {
        console.error('❌ [POSTGRES-DIRECT] Falha na conexão com PostgreSQL');
        process.exit(1); // Encerrar se não conseguir conectar
    }
});

module.exports = {
    // Métodos principais
    get,
    all,
    run,
    query,
    
    // Aliases para compatibilidade
    dbGet,
    dbAll,
    dbRun,
    
    // Utilitários
    testConnection,
    close,
    pool,
    
    // Flags de compatibilidade
    isPostgreSQL: true,
    dialect: 'postgresql',
    
    // Para código que verifica disponibilidade
    isPostgresAvailable: () => true
};