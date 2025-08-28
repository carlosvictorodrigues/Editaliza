/**
 * Database PostgreSQL
 * 
 * Usa conexão direta com PostgreSQL
 * Sem fallbacks - desenvolvimento = produção
 */

const postgres = require('./database-postgres-direct');

// Testar conexão ao carregar
postgres.testConnection().catch(err => {
    console.error('❌ [DATABASE] PostgreSQL não está disponível');
    console.error('   Certifique-se que o PostgreSQL está rodando');
    console.error('   Config:', {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db'
    });
    process.exit(1);
});

module.exports = postgres;