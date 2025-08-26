/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       FASE 7 - CONFIG AGGREGATOR                         ║
 * ║                    Centralizador de Configurações                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Este arquivo agrega todas as configurações do sistema em um ponto central.
 * Facilita a manutenção e organização das configurações.
 * 
 * Created: 2025-08-25
 * Author: DevOps Automator - FASE 7 Implementation
 */

const environment = require('./environment');
const appConfig = require('./app.config');
const databaseConfig = require('./database.config');
const sessionConfig = require('./session.config');
const securityConfig = require('./security.config');
const oauthConfig = require('./oauth.config');
const featuresConfig = require('./features.config');

// Aggregated configuration object
const config = {
    // Environment variables and base config
    ...environment,
    
    // Modular configurations
    app: appConfig,
    database: databaseConfig,
    session: sessionConfig.sessionConfig,
    security: securityConfig,
    oauth: oauthConfig,
    features: featuresConfig,
    
    // Legacy compatibility - mantém estrutura anterior
    NODE_ENV: environment.NODE_ENV,
    PORT: environment.PORT,
    IS_PRODUCTION: environment.IS_PRODUCTION,
    IS_DEVELOPMENT: environment.IS_DEVELOPMENT
};

// Validate critical configurations
if (config.IS_PRODUCTION) {
    const requiredSecrets = [
        { key: 'JWT_SECRET', value: config.SECURITY.JWT_SECRET },
        { key: 'SESSION_SECRET', value: config.SECURITY.SESSION_SECRET },
        { key: 'DB_PASSWORD', value: config.DB.PASSWORD }
    ];
    
    const missing = requiredSecrets.filter(secret => !secret.value || secret.value.length < 16);
    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing required configuration secrets:');
        missing.forEach(secret => console.error(`   - ${secret.key}`));
        throw new Error('Critical configuration secrets missing in production');
    }
}

// Configuration validation summary
if (config.IS_DEVELOPMENT) {
    console.log('\n🔧 FASE 7 - Configuration System Active');
    console.log('📋 Config modules loaded:');
    console.log('   ✅ Environment config');
    console.log('   ✅ Database configuration');
    console.log('   ✅ Session management');
    console.log('   ✅ Security settings');
    console.log('   ✅ OAuth configuration');
    console.log('   ✅ Feature flags');
    console.log('📊 Target server.js reduction: ~300 lines');
    
    // Show configuration summary
    const dbInfo = databaseConfig.getDatabaseInfo();
    const securityInfo = securityConfig.getSecurityInfo();
    const oauthInfo = oauthConfig.getInfo();
    const featuresInfo = featuresConfig.getInfo();
    
    console.log('\n📊 Configuration Summary:');
    console.log(`   Database: ${dbInfo.type} (${dbInfo.host}:${dbInfo.port})`);
    console.log(`   Security: CORS + CSP + Rate Limiting (${securityInfo.rateLimit.globalLimit} req/15min)`);
    console.log(`   OAuth: ${oauthInfo.providersEnabled} provider(s) enabled`);
    console.log(`   Features: ${featuresInfo.enabledFeatures}/${featuresInfo.totalFeatures} enabled`);
    console.log('\n');
}

module.exports = config;