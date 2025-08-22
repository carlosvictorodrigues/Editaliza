// Tentar usar PostgreSQL, mas fallback para memória se falhar
let db;

try {
    // Tentar carregar PostgreSQL
    db = require('./database-simple-postgres');
    
    // Testar conexão
    const { Client } = require('pg');
    const testClient = new Client({
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d',
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432
    });
    
    testClient.connect()
        .then(() => {
            console.log('[DATABASE] PostgreSQL conectado com sucesso');
            testClient.end();
        })
        .catch(err => {
            console.log('[DATABASE] PostgreSQL não disponível, usando banco em memória');
            db = require('./database-memory');
        });
    
} catch (err) {
    console.log('[DATABASE] Erro ao conectar PostgreSQL, usando banco em memória');
    db = require('./database-memory');
}

module.exports = db;