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
    password: 'editaliza_password_123',
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