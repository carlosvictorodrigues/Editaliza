/**
 * Configuração de Ambiente Inteligente
 * Detecta automaticamente se está em desenvolvimento ou produção
 */

require('dotenv').config();

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Detecta se está rodando localmente
const isLocal = process.env.APP_URL?.includes('localhost') || 
                process.env.NODE_ENV === 'development' ||
                !process.env.NODE_ENV;

const config = {
    // Ambiente
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    IS_PRODUCTION: isProduction,
    IS_DEVELOPMENT: isDevelopment,
    IS_LOCAL: isLocal,
    
    // URLs - Adapta automaticamente
    APP_URL: process.env.APP_URL || (isProduction 
        ? 'https://app.editaliza.com.br' 
        : 'http://localhost:3000'),
    
    CLIENT_URL: process.env.CLIENT_URL || (isProduction 
        ? 'https://app.editaliza.com.br' 
        : 'http://localhost:3000'),
    
    FRONTEND_URL: process.env.FRONTEND_URL || (isProduction 
        ? 'https://app.editaliza.com.br' 
        : 'http://localhost:3000'),
    
    // Banco de Dados
    DB: {
        HOST: process.env.DB_HOST || 'localhost',
        PORT: process.env.DB_PORT || 5432,
        NAME: process.env.DB_NAME || (isProduction ? 'editaliza_db' : 'editaliza_dev'),
        USER: process.env.DB_USER || 'editaliza_user',
        PASSWORD: process.env.DB_PASSWORD || 'editaliza_password123'
    },
    
    // Redis
    REDIS: {
        HOST: process.env.REDIS_HOST || 'localhost',
        PORT: process.env.REDIS_PORT || 6379,
        PASSWORD: process.env.REDIS_PASSWORD || '',
        DB: process.env.REDIS_DB || 0,
        // Em desenvolvimento, Redis é opcional
        ENABLED: isProduction || process.env.REDIS_ENABLED === 'true'
    },
    
    // Segurança
    SECURITY: {
        JWT_SECRET: process.env.JWT_SECRET || (isProduction 
            ? undefined // Força erro em produção se não configurado
            : 'desenvolvimento_jwt_secret_inseguro'),
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || (isProduction 
            ? undefined 
            : 'desenvolvimento_refresh_secret_inseguro'),
        SESSION_SECRET: process.env.SESSION_SECRET || (isProduction 
            ? undefined 
            : 'desenvolvimento_session_secret_inseguro'),
        BCRYPT_ROUNDS: isProduction ? 12 : 10
    },
    
    // Google OAuth
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || (isProduction 
            ? 'https://app.editaliza.com.br/auth/google/callback'
            : 'http://localhost:3000/auth/google/callback'),
        ENABLED: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    },
    
    // Email
    EMAIL: {
        FROM: process.env.EMAIL_FROM || 'noreply@editaliza.com.br',
        HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
        PORT: process.env.EMAIL_PORT || 587,
        SECURE: process.env.EMAIL_SECURE === 'true',
        USER: process.env.EMAIL_USER,
        PASSWORD: process.env.EMAIL_PASSWORD,
        ENABLED: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
    },
    
    // CORS
    CORS: {
        ORIGIN: process.env.CORS_ORIGIN || (isProduction 
            ? ['https://app.editaliza.com.br', 'https://editaliza.com.br']
            : ['http://localhost:3000', 'http://localhost:3001']),
        CREDENTIALS: process.env.CORS_CREDENTIALS !== 'false'
    },
    
    // Cookies
    COOKIES: {
        SECURE: isProduction || process.env.COOKIE_SECURE === 'true',
        DOMAIN: process.env.COOKIE_DOMAIN || (isProduction 
            ? '.editaliza.com.br' 
            : 'localhost'),
        SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax',
        HTTP_ONLY: true,
        MAX_AGE: 7 * 24 * 60 * 60 * 1000 // 7 dias
    },
    
    // Debug
    DEBUG: {
        ENABLED: isDevelopment || process.env.DEBUG === 'true',
        LOG_LEVEL: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
        LOG_SQL: isDevelopment && process.env.LOG_SQL === 'true'
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
        MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        ENABLED: isProduction || process.env.RATE_LIMIT_ENABLED === 'true'
    },
    
    // Backup
    BACKUP: {
        ENABLED: process.env.BACKUP_ENABLED === 'true',
        INTERVAL_HOURS: parseInt(process.env.BACKUP_INTERVAL_HOURS || '6')
    }
};

// Validação de configurações críticas em produção
if (isProduction) {
    const requiredConfigs = [
        { name: 'JWT_SECRET', value: config.SECURITY.JWT_SECRET },
        { name: 'SESSION_SECRET', value: config.SECURITY.SESSION_SECRET },
        { name: 'DB_PASSWORD', value: config.DB.PASSWORD }
    ];
    
    const missing = requiredConfigs.filter(cfg => !cfg.value);
    if (missing.length > 0) {
        console.error('❌ Configurações obrigatórias faltando em produção:');
        missing.forEach(cfg => console.error(`   - ${cfg.name}`));
        console.error('\nConfigure estas variáveis no arquivo .env');
        // Em produção real, você poderia querer process.exit(1) aqui
    }
}

// Log das configurações (sem expor secrets)
if (isDevelopment) {
    console.log('📋 Configuração do Ambiente:');
    console.log('   Ambiente:', config.NODE_ENV);
    console.log('   Porta:', config.PORT);
    console.log('   URL:', config.APP_URL);
    console.log('   DB:', `${config.DB.HOST}:${config.DB.PORT}/${config.DB.NAME}`);
    console.log('   Redis:', config.REDIS.ENABLED ? 'Habilitado' : 'Desabilitado');
    console.log('   OAuth:', config.GOOGLE.ENABLED ? 'Configurado' : 'Não configurado');
    console.log('   Email:', config.EMAIL.ENABLED ? 'Configurado' : 'Não configurado');
}

module.exports = config;