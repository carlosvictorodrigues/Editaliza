/**
 * Database PostgreSQL
 * 
 * Usa conexão direta com PostgreSQL
 * Sem fallbacks - desenvolvimento = produção
 */

const postgres = require('./database-postgres-direct');

// Validação inicial amigável (sem encerrar imediatamente)
postgres.testConnection().then((ok) => {
    if (!ok) {
        console.error('❌ [DATABASE] PostgreSQL não respondeu ao teste inicial');
        console.error('   Verifique se o serviço está ativo e as variáveis DB_* estão corretas.');
        console.error('   Config:', {
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'editaliza_db'
        });
        // O módulo database-postgres-direct fará novas tentativas de conexão.
    }
}).catch(() => {/* já tratado acima */});

module.exports = postgres;
