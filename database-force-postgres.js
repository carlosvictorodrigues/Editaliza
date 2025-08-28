/**
 * Database Force PostgreSQL - Força o uso do PostgreSQL local
 * 
 * Este arquivo garante que SEMPRE usamos PostgreSQL
 * ao invés de fallback para banco em memória
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Configuração do pool de conexões
const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    max: 20, // máximo de conexões no pool
    min: 2,  // mínimo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
};

// Criar pool de conexões
const pool = new Pool(config);

// Testar conexão inicial
pool.connect()
    .then(client => {
        console.log('✅ [DATABASE] PostgreSQL conectado com sucesso');
        console.log(`   Host: ${config.host}`);
        console.log(`   Database: ${config.database}`);
        console.log(`   User: ${config.user}`);
        client.release();
    })
    .catch(err => {
        console.error('❌ [DATABASE] Erro ao conectar PostgreSQL:', err.message);
        console.log('\n⚠️  Para configurar o PostgreSQL local:');
        console.log('1. Execute: node setup-postgres-local.js');
        console.log('2. Ou execute os comandos em: setup-postgres-manual.sql');
        process.exit(1); // Força saída se não conseguir conectar
    });

// Funções principais exportadas
async function dbGet(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    } catch (error) {
        console.error('[DB] Erro em dbGet:', error.message);
        console.error('[DB] SQL:', sql);
        console.error('[DB] Params:', params);
        throw error;
    }
}

async function dbAll(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('[DB] Erro em dbAll:', error.message);
        console.error('[DB] SQL:', sql);
        console.error('[DB] Params:', params);
        throw error;
    }
}

async function dbRun(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result;
    } catch (error) {
        console.error('[DB] Erro em dbRun:', error.message);
        console.error('[DB] SQL:', sql);
        console.error('[DB] Params:', params);
        throw error;
    }
}

// Função para verificar saúde do banco
async function checkHealth() {
    try {
        const result = await pool.query('SELECT NOW()');
        return {
            status: 'healthy',
            timestamp: result.rows[0].now,
            database: config.database,
            connections: {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message
        };
    }
}

// Garantir que tabelas essenciais existem
async function ensureTables() {
    try {
        // Verificar se as tabelas principais existem
        const tables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename IN ('users', 'study_plans', 'subjects', 'topics', 'study_sessions')
        `);
        
        const existingTables = tables.rows.map(r => r.tablename);
        const requiredTables = ['users', 'study_plans', 'subjects', 'topics', 'study_sessions'];
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length > 0) {
            console.log('⚠️  [DATABASE] Tabelas faltando:', missingTables.join(', '));
            console.log('   Execute: node setup-postgres-local.js');
        } else {
            console.log('✅ [DATABASE] Todas as tabelas essenciais existem');
        }
        
        // Verificar se tem usuário de teste
        const testUser = await pool.query(
            "SELECT id FROM users WHERE email = 'c@c.com'"
        );
        
        if (testUser.rows.length === 0) {
            console.log('📝 [DATABASE] Criando usuário de teste...');
            const hash = await bcrypt.hash('123456', 12);
            await pool.query(
                `INSERT INTO users (email, password_hash, name, email_verified)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) DO NOTHING`,
                ['c@c.com', hash, 'Usuário Teste', true]
            );
            console.log('✅ [DATABASE] Usuário de teste criado (c@c.com / 123456)');
        }
        
    } catch (error) {
        console.error('❌ [DATABASE] Erro ao verificar tabelas:', error.message);
    }
}

// Verificar tabelas ao iniciar
ensureTables();

// Tratamento de erros do pool
pool.on('error', (err, client) => {
    console.error('[DATABASE] Erro inesperado no pool:', err);
});

// Fechar conexões ao encerrar o processo
process.on('SIGINT', async () => {
    console.log('\n[DATABASE] Encerrando conexões...');
    await pool.end();
    process.exit(0);
});

module.exports = {
    // Funções principais
    dbGet,
    dbAll,
    dbRun,
    
    // Compatibilidade com código legado
    get: dbGet,
    all: dbAll,
    run: dbRun,
    query: async (sql, params) => {
        return await pool.query(sql, params);
    },
    
    // Utilitários
    checkHealth,
    pool, // Exportar pool para casos especiais
    
    // Informações
    isPostgresAvailable: () => true, // Sempre true pois forçamos PostgreSQL
    getMemoryDB: () => null // Não há banco em memória
};