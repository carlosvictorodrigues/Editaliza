/**
 * CONFIGURAÇÃO UNIFICADA DE BANCO DE DADOS - EDITALIZA
 * Suporte dual: SQLite (desenvolvimento) + PostgreSQL (produção)
 * 
 * Estratégia:
 * - SQLite: Desenvolvimento local (rápido, sem configuração)
 * - PostgreSQL: Produção (robusto, escalável)
 * - Fallback automático se PostgreSQL falhar
 * - 100% compatibilidade com código existente
 */

const config = require('./environment');
const { securityLog } = require('../utils/security');

// Detectar ambiente
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_LOCAL = config.IS_LOCAL;
const FORCE_SQLITE = process.env.FORCE_SQLITE === 'true';
const FORCE_POSTGRES = process.env.FORCE_POSTGRES === 'true';

/**
 * Configuração do banco SQLite
 */
const SQLITE_CONFIG = {
    type: 'sqlite',
    database: 'db.sqlite',
    options: {
        // Otimizações SQLite
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000, // 64MB
        temp_store: 'MEMORY',
        mmap_size: 268435456, // 256MB
        foreign_keys: 'ON',
        auto_vacuum: 'INCREMENTAL'
    }
};

/**
 * Configuração do banco PostgreSQL
 */
const POSTGRES_CONFIG = {
    type: 'postgresql',
    host: config.DB.HOST,
    port: config.DB.PORT,
    database: config.DB.NAME,
    user: config.DB.USER,
    password: config.DB.PASSWORD,
    options: {
        // Pool de conexões
        max: IS_PRODUCTION ? 20 : 5,
        min: IS_PRODUCTION ? 5 : 1,
        idle: 10000,
        acquire: 60000,
        
        // Configurações SSL para produção
        ssl: IS_PRODUCTION ? {
            require: true,
            rejectUnauthorized: false
        } : false,
        
        // Timeouts
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        query_timeout: 60000,
        
        // Configurações específicas PostgreSQL
        application_name: 'editaliza-app',
        timezone: 'America/Sao_Paulo'
    }
};

/**
 * Estratégia de seleção de banco
 */
function getDatabaseStrategy() {
    try {
        // Força específica via env
        if (FORCE_SQLITE) {
            securityLog('database_strategy', { 
                choice: 'sqlite', 
                reason: 'forced_by_env',
                env: process.env.NODE_ENV 
            });
            return 'sqlite';
        }
        
        if (FORCE_POSTGRES) {
            securityLog('database_strategy', { 
                choice: 'postgresql', 
                reason: 'forced_by_env',
                env: process.env.NODE_ENV 
            });
            return 'postgresql';
        }
        
        // Estratégia automática
        if (IS_PRODUCTION) {
            // Produção sempre usa PostgreSQL
            securityLog('database_strategy', { 
                choice: 'postgresql', 
                reason: 'production_environment',
                env: process.env.NODE_ENV 
            });
            return 'postgresql';
        }
        
        // Desenvolvimento: verifica se PostgreSQL está disponível
        if (config.DB.HOST && config.DB.USER && config.DB.PASSWORD) {
            securityLog('database_strategy', { 
                choice: 'postgresql', 
                reason: 'development_with_postgres_config',
                env: process.env.NODE_ENV 
            });
            return 'postgresql';
        }
        
        // Fallback para SQLite em desenvolvimento
        securityLog('database_strategy', { 
            choice: 'sqlite', 
            reason: 'development_fallback',
            env: process.env.NODE_ENV 
        });
        return 'sqlite';
        
    } catch (error) {
        securityLog('database_strategy_error', { 
            error: error.message,
            fallback: 'sqlite' 
        });
        return 'sqlite';
    }
}

/**
 * Configuração final baseada na estratégia
 */
const DATABASE_STRATEGY = getDatabaseStrategy();
const DATABASE_CONFIG = DATABASE_STRATEGY === 'postgresql' ? POSTGRES_CONFIG : SQLITE_CONFIG;

/**
 * Configuração exportada
 */
const dbConfig = {
    // Estratégia selecionada
    strategy: DATABASE_STRATEGY,
    
    // Configuração ativa
    active: DATABASE_CONFIG,
    
    // Configurações disponíveis
    sqlite: SQLITE_CONFIG,
    postgresql: POSTGRES_CONFIG,
    
    // Flags úteis
    isPostgreSQL: DATABASE_STRATEGY === 'postgresql',
    isSQLite: DATABASE_STRATEGY === 'sqlite',
    isProduction: IS_PRODUCTION,
    
    // Configurações de pool e conexão
    pool: {
        max: DATABASE_STRATEGY === 'postgresql' ? POSTGRES_CONFIG.options.max : 1,
        min: DATABASE_STRATEGY === 'postgresql' ? POSTGRES_CONFIG.options.min : 1,
        idle: DATABASE_STRATEGY === 'postgresql' ? POSTGRES_CONFIG.options.idle : 10000
    },
    
    // Configurações de migração
    migration: {
        tableName: 'schema_migrations',
        directory: './migrations',
        pattern: /^\d+[\w-_]+\.(js|sql)$/
    },
    
    // Configurações de backup
    backup: {
        enabled: config.BACKUP.ENABLED,
        interval: config.BACKUP.INTERVAL_HOURS,
        retention: 30, // dias
        directory: './backups'
    },
    
    // Configurações de logging
    logging: {
        enabled: config.DEBUG.LOG_SQL,
        level: config.DEBUG.LOG_LEVEL,
        slow_query_threshold: 1000 // ms
    }
};

/**
 * Validar configuração do banco
 */
function validateDatabaseConfig() {
    const errors = [];
    
    if (dbConfig.isPostgreSQL) {
        if (!dbConfig.active.host) errors.push('DB_HOST é obrigatório para PostgreSQL');
        if (!dbConfig.active.database) errors.push('DB_NAME é obrigatório para PostgreSQL');
        if (!dbConfig.active.user) errors.push('DB_USER é obrigatório para PostgreSQL');
        if (!dbConfig.active.password) errors.push('DB_PASSWORD é obrigatório para PostgreSQL');
        
        // Validações de produção
        if (IS_PRODUCTION) {
            if (dbConfig.active.password.length < 8) {
                errors.push('DB_PASSWORD deve ter pelo menos 8 caracteres em produção');
            }
        }
    }
    
    if (errors.length > 0) {
        console.error('❌ Erros na configuração do banco:');
        errors.forEach(error => console.error(`   - ${error}`));
        
        if (IS_PRODUCTION) {
            throw new Error('Configuração de banco inválida em produção');
        } else {
            console.warn('⚠️  Usando SQLite como fallback devido aos erros acima');
            dbConfig.strategy = 'sqlite';
            dbConfig.active = dbConfig.sqlite;
            dbConfig.isPostgreSQL = false;
            dbConfig.isSQLite = true;
        }
    }
    
    return errors.length === 0;
}

/**
 * Log da configuração ativa
 */
function logDatabaseConfig() {
    if (config.DEBUG.ENABLED) {
        console.log('🗄️  Configuração do Banco de Dados:');
        console.log(`   Estratégia: ${dbConfig.strategy.toUpperCase()}`);
        console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
        
        if (dbConfig.isPostgreSQL) {
            console.log(`   Host: ${dbConfig.active.host}:${dbConfig.active.port}`);
            console.log(`   Database: ${dbConfig.active.database}`);
            console.log(`   User: ${dbConfig.active.user}`);
            console.log(`   Pool: ${dbConfig.pool.min}-${dbConfig.pool.max} conexões`);
            console.log(`   SSL: ${dbConfig.active.options.ssl ? 'Habilitado' : 'Desabilitado'}`);
        } else {
            console.log(`   Arquivo: ${dbConfig.active.database}`);
            console.log(`   Modo: WAL (Write-Ahead Logging)`);
        }
        
        console.log(`   Logging SQL: ${dbConfig.logging.enabled ? 'Habilitado' : 'Desabilitado'}`);
        console.log(`   Backup: ${dbConfig.backup.enabled ? 'Habilitado' : 'Desabilitado'}`);
    }
}

// Validar configuração na inicialização
validateDatabaseConfig();

// Log da configuração
logDatabaseConfig();

module.exports = dbConfig;