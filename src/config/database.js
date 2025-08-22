/**
 * CONFIGURAÇÃO DE BANCO DE DADOS - EDITALIZA
 * APENAS POSTGRESQL - SQLite completamente removido
 * 
 * Sistema migrado 100% para PostgreSQL
 * Sem fallbacks ou adapters - direto e simples
 */

const config = require('./environment');
const { securityLog } = require('../utils/security');

// Detectar ambiente
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_LOCAL = config.IS_LOCAL;

/**
 * Configuração ÚNICA do PostgreSQL
 */
const POSTGRESQL_CONFIG = {
    type: 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD,
    options: {
        // Pool de conexões
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        min: parseInt(process.env.DB_POOL_MIN || '2'),
        idle: parseInt(process.env.DB_POOL_IDLE || '30000'),
        acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000'),
        
        // SSL em produção
        ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false,
        
        // Configurações PostgreSQL
        application_name: 'editaliza',
        statement_timeout: 60000, // 60 segundos
        query_timeout: 30000,     // 30 segundos
        connectionTimeoutMillis: 5000, // 5 segundos para conectar
        
        // Timezone brasileiro
        timezone: 'America/Sao_Paulo'
    }
};

/**
 * Log de segurança da configuração
 */
function logDatabaseConfig() {
    securityLog('database_config_loaded', {
        environment: process.env.NODE_ENV,
        host: POSTGRESQL_CONFIG.host,
        database: POSTGRESQL_CONFIG.database,
        user: POSTGRESQL_CONFIG.user,
        ssl: !!POSTGRESQL_CONFIG.options.ssl,
        pool_max: POSTGRESQL_CONFIG.options.max,
        is_production: IS_PRODUCTION,
        is_local: IS_LOCAL
    });
    
    console.log('🗄️  Database Config Loaded:');
    console.log(`   Database: ${POSTGRESQL_CONFIG.database}`);
    console.log(`   Host: ${POSTGRESQL_CONFIG.host}:${POSTGRESQL_CONFIG.port}`);
    console.log(`   User: ${POSTGRESQL_CONFIG.user}`);
    console.log(`   SSL: ${POSTGRESQL_CONFIG.options.ssl ? 'Enabled' : 'Disabled'}`);
    console.log(`   Pool: ${POSTGRESQL_CONFIG.options.min}-${POSTGRESQL_CONFIG.options.max} connections`);
}

/**
 * Validar configuração
 */
function validateDatabaseConfig() {
    const required = ['host', 'database', 'user'];
    const missing = [];
    
    for (const field of required) {
        if (!POSTGRESQL_CONFIG[field]) {
            missing.push(field);
        }
    }
    
    if (!POSTGRESQL_CONFIG.password && IS_PRODUCTION) {
        missing.push('password');
    }
    
    if (missing.length > 0) {
        const error = `Missing required database config: ${missing.join(', ')}`;
        securityLog('database_config_error', { missing, environment: process.env.NODE_ENV });
        throw new Error(error);
    }
    
    // Validar porta
    if (isNaN(POSTGRESQL_CONFIG.port) || POSTGRESQL_CONFIG.port < 1 || POSTGRESQL_CONFIG.port > 65535) {
        throw new Error('Invalid database port');
    }
    
    return true;
}

/**
 * Obter configuração ativa
 */
function getDatabaseConfig() {
    validateDatabaseConfig();
    logDatabaseConfig();
    
    return {
        // Configuração principal
        active: POSTGRESQL_CONFIG,
        
        // Informações do ambiente
        environment: {
            isProduction: IS_PRODUCTION,
            isLocal: IS_LOCAL,
            nodeEnv: process.env.NODE_ENV
        },
        
        // Configurações de log
        logging: {
            enabled: process.env.DB_LOG_QUERIES === 'true',
            slow_query_threshold: parseInt(process.env.DB_SLOW_QUERY_MS || '1000'),
            log_level: process.env.DB_LOG_LEVEL || 'info'
        },
        
        // Informações de compatibilidade
        isPostgreSQL: true,
        isSQLite: false, // SEMPRE false - SQLite removido
        strategy: 'postgresql-only',
        
        // Helpers
        getConnectionString() {
            const { host, port, database, user, password } = POSTGRESQL_CONFIG;
            return `postgresql://${user}:${password || ''}@${host}:${port}/${database}`;
        },
        
        getPoolConfig() {
            return POSTGRESQL_CONFIG.options;
        }
    };
}

// Log da inicialização
console.log('📋 Database Configuration: PostgreSQL Only (SQLite Removed)');

module.exports = getDatabaseConfig();