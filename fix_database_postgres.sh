#!/bin/bash

echo "=== Corrigindo configuração do banco de dados para PostgreSQL ==="

# Criar novo arquivo database.js para PostgreSQL
ssh editaliza "cd /root/editaliza && cat > database_postgres.js" << 'EOF'
// Database configuration for PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

// Criar pool de conexões PostgreSQL
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Testar conexão
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Erro ao conectar ao PostgreSQL:', err.message);
    } else {
        console.log('✓ Conectado ao PostgreSQL:', res.rows[0].now);
    }
});

// Funções helper para compatibilidade com código existente
const db = {
    get: async (sql, params = []) => {
        try {
            const result = await pool.query(sql, params);
            return result.rows[0];
        } catch (err) {
            console.error('Database error (get):', err);
            throw err;
        }
    },
    
    all: async (sql, params = []) => {
        try {
            const result = await pool.query(sql, params);
            return result.rows;
        } catch (err) {
            console.error('Database error (all):', err);
            throw err;
        }
    },
    
    run: async (sql, params = []) => {
        try {
            const result = await pool.query(sql, params);
            return {
                lastID: result.rows[0]?.id,
                changes: result.rowCount
            };
        } catch (err) {
            console.error('Database error (run):', err);
            throw err;
        }
    },
    
    serialize: (callback) => {
        // PostgreSQL não precisa de serialize
        if (callback) callback();
    },
    
    close: async () => {
        await pool.end();
    }
};

module.exports = db;
EOF

# Fazer backup do database.js original
ssh editaliza "cd /root/editaliza && cp database.js database_sqlite_backup.js"

# Substituir database.js pelo novo
ssh editaliza "cd /root/editaliza && cp database_postgres.js database.js"

echo "✓ Arquivo database.js atualizado para PostgreSQL"

# Atualizar server.js para remover referências ao SQLite
echo ""
echo "Removendo referências ao SQLite do server.js..."

ssh editaliza "cd /root/editaliza && sed -i.bak 's/const SQLiteStore = require.*$/\/\/ SQLite removido - usando PostgreSQL/' server.js"

# Criar store de sessão compatível com PostgreSQL
ssh editaliza "cd /root/editaliza && cat > session_store.js" << 'EOF'
// Session store configuration
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

const sessionStore = new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
});

module.exports = { sessionStore, session };
EOF

echo ""
echo "Instalando dependências do PostgreSQL..."
ssh editaliza "cd /root/editaliza && npm install pg connect-pg-simple --save"

echo ""
echo "Testando nova configuração..."
ssh editaliza "cd /root/editaliza && timeout 3 node -e \"require('./database.js'); console.log('Database OK');\""