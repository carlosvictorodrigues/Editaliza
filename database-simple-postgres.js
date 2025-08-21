/**
 * IMPLEMENTAÇÃO SIMPLES E DIRETA DO POSTGRESQL
 * Resolve o problema de timeout da API /plans
 */

const { Pool } = require('pg');

// Pool de conexões PostgreSQL
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'editaliza_db', 
    user: 'editaliza_user',
    password: 'editaliza2024',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

console.log('[POSTGRES] Pool PostgreSQL inicializado');

// Função para converter placeholders SQLite (?) para PostgreSQL ($1, $2, etc)
function convertQuery(sql, params) {
    let paramIndex = 1;
    const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    return { sql: pgSql, params };
}

// Interface compatível com SQLite
const db = {
    // Método all - buscar múltiplas linhas
    all: async (sql, params = []) => {
        try {
            const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
            console.log(`[POSTGRES] Query: ${pgSql}`);
            console.log(`[POSTGRES] Params:`, pgParams);
            
            const result = await pool.query(pgSql, pgParams);
            
            if (!result) {
                console.error('[POSTGRES] Query retornou undefined');
                return [];
            }
            
            if (!result.rows) {
                console.error('[POSTGRES] Result sem propriedade rows:', result);
                return [];
            }
            
            console.log(`[POSTGRES] Resultado: ${result.rows.length} linhas`);
            return result.rows;
        } catch (error) {
            console.error('[POSTGRES] Erro em all():', error.message);
            throw error;
        }
    },

    // Método get - buscar uma linha
    get: async (sql, params = []) => {
        try {
            const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
            console.log(`[POSTGRES] Query: ${pgSql}`);
            console.log(`[POSTGRES] Params:`, pgParams);
            
            const result = await pool.query(pgSql, pgParams);
            
            if (!result) {
                console.error('[POSTGRES] Query retornou undefined');
                return null;
            }
            
            if (!result.rows) {
                console.error('[POSTGRES] Result sem propriedade rows:', result);
                return null;
            }
            
            console.log(`[POSTGRES] Resultado: ${result.rows.length > 0 ? 'encontrado' : 'não encontrado'}`);
            return result.rows[0] || null;
        } catch (error) {
            console.error('[POSTGRES] Erro em get():', error.message);
            throw error;
        }
    },

    // Método run - executar comandos (INSERT, UPDATE, DELETE)
    run: async (sql, params = []) => {
        try {
            const { sql: pgSql, params: pgParams } = convertQuery(sql, params);
            console.log(`[POSTGRES] Query: ${pgSql}`);
            console.log(`[POSTGRES] Params:`, pgParams);
            
            const result = await pool.query(pgSql, pgParams);
            console.log(`[POSTGRES] Linhas afetadas: ${result.rowCount}`);
            
            return {
                lastID: result.insertId || null,
                changes: result.rowCount || 0
            };
        } catch (error) {
            console.error('[POSTGRES] Erro em run():', error.message);
            throw error;
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