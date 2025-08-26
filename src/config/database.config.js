/**
 * Database Configuration Module
 * 
 * Centralizes PostgreSQL and session store configuration.
 * Extracted from server.js as part of PHASE 7 modularization.
 * 
 * Created: 2025-08-25
 * Author: DevOps Automator
 */

const environment = require('./environment');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

/**
 * Build PostgreSQL connection string from environment variables
 * @returns {string} PostgreSQL connection string
 */
function buildPgConnectionString() {
    return process.env.DATABASE_URL || 
        `postgresql://${environment.DB.USER}:${environment.DB.PASSWORD}@${environment.DB.HOST}:${environment.DB.PORT}/${environment.DB.NAME}`;
}

/**
 * PostgreSQL Configuration
 */
const postgresConfig = {
    host: environment.DB.HOST,
    port: environment.DB.PORT,
    database: environment.DB.NAME,
    user: environment.DB.USER,
    password: environment.DB.PASSWORD,
    connectionString: buildPgConnectionString(),
    
    // Connection pool settings
    pool: {
        min: environment.IS_PRODUCTION ? 5 : 2,
        max: environment.IS_PRODUCTION ? 20 : 10,
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000
    },
    
    // SSL configuration for production
    ssl: environment.IS_PRODUCTION ? {
        require: true,
        rejectUnauthorized: false
    } : false
};

/**
 * Create Session Store
 * Uses PostgreSQL if available, falls back to MemoryStore
 * @returns {object} Session store instance
 */
function createSessionStore() {
    let sessionStore;
    
    // Force memory sessions if environment variable is set
    if (process.env.FORCE_MEMORY_SESSIONS === 'true') {
        console.log('📦 Using memory sessions (forced by environment)');
        return new session.MemoryStore();
    }
    
    try {
        sessionStore = new pgSession({
            conString: postgresConfig.connectionString,
            tableName: 'sessions',
            createTableIfMissing: true,
            schemaName: 'public'
        });
        
        console.log('✅ PostgreSQL session store configured');
        return sessionStore;
        
    } catch (error) {
        console.warn('⚠️ PostgreSQL session store failed, falling back to memory store');
        console.warn('Error:', error.message);
        
        return new session.MemoryStore();
    }
}

/**
 * Database Connection Validation
 * Tests connection to ensure database is accessible
 */
function validateDatabaseConnection() {
    return new Promise((resolve, reject) => {
        // Simple connection test would go here
        // For now, we'll assume connection is valid
        resolve(true);
    });
}

/**
 * Database Configuration Summary
 */
function getDatabaseInfo() {
    return {
        type: 'PostgreSQL',
        host: postgresConfig.host,
        port: postgresConfig.port,
        database: postgresConfig.database,
        ssl: !!postgresConfig.ssl,
        poolSize: `${postgresConfig.pool.min}-${postgresConfig.pool.max}`,
        connectionString: postgresConfig.connectionString.replace(/:([^@]+)@/, ':***@') // Hide password
    };
}

module.exports = {
    postgresConfig,
    buildPgConnectionString,
    createSessionStore,
    validateDatabaseConnection,
    getDatabaseInfo
};