// Tentar usar PostgreSQL, mas fallback para memória se falhar
let db;

try {
    // Tentar carregar PostgreSQL
    db = require('./database-simple-postgres');
    
    // Testar conexão
    const { Client } = require('pg');
    const testClient = new Client({
        database: 'editaliza_db',
        user: 'editaliza_user',
        password: 'Editaliza@2025#Secure',
        host: 'localhost',
        port: 5432
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