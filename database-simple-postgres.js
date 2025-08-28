/**
 * Database Simple PostgreSQL
 * 
 * Usa conexão direta com PostgreSQL
 * Sem adaptadores ou fallbacks - desenvolvimento = produção
 */

const postgres = require('./database-postgres-direct');

module.exports = postgres;