/**
 * @file src/config/environment.js
 * @description Configuração centralizada de variáveis de ambiente
 * @version 1.0.0 - Preparação para produção
 */

require('dotenv').config();

/**
 * Validação e parsing de variáveis de ambiente
 */
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    return value.toLowerCase() === 'true';
};

const parseInteger = (value, defaultValue = 0) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

const parseFloat = (value, defaultValue = 0.0) => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Configurações de ambiente com validação
 */
const config = {
    // === CONFIGURAÇÕES BÁSICAS ===
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    IS_TEST: process.env.NODE_ENV === 'test',
    
    PORT: parseInteger(process.env.PORT, 3000),
    HOST: process.env.HOST || '0.0.0.0',
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    TIMEZONE: process.env.TIMEZONE || 'America/Sao_Paulo',

    // === BANCO DE DADOS ===
    DATABASE: {
        PATH: process.env.DATABASE_PATH || './db.sqlite',
        CACHE_SIZE: parseInteger(process.env.SQLITE_CACHE_SIZE, -64000),
        MMAP_SIZE: parseInteger(process.env.SQLITE_MMAP_SIZE, 268435456),
        BUSY_TIMEOUT: parseInteger(process.env.SQLITE_BUSY_TIMEOUT, 30000)
    },

    // === CAMINHOS ===
    PATHS: {
        UPLOADS: process.env.UPLOADS_DIR || './uploads',
        PUBLIC: process.env.PUBLIC_DIR || './public',
        CSS: process.env.CSS_DIR || './css',
        JS: process.env.JS_DIR || './js',
        IMAGES: process.env.IMAGES_DIR || './images'
    },

    // === UPLOADS ===
    UPLOAD: {
        MAX_FILE_SIZE: parseInteger(process.env.UPLOAD_MAX_FILE_SIZE, 5 * 1024 * 1024), // 5MB
        MAX_BODY_SIZE: process.env.MAX_BODY_SIZE || '10mb'
    },

    // === SESSÃO ===
    SESSION: {
        SECRET: process.env.SESSION_SECRET || 'change_this_in_production_very_long_secure_string',
        MAX_AGE: parseInteger(process.env.SESSION_MAX_AGE, 24 * 60 * 60 * 1000), // 24h
        STORE_PATH: process.env.SESSION_STORE_PATH || './sessions.db'
    },

    // === RATE LIMITING ===
    RATE_LIMIT: {
        WINDOW_MS: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15min
        MAX_REQUESTS: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
        LOGIN_WINDOW_MS: parseInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
        LOGIN_MAX_ATTEMPTS: parseInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 5)
    },

    // === SEGURANÇA ===
    SECURITY: {
        JWT_SECRET: process.env.JWT_SECRET || 'change_this_in_production_jwt_secret_very_long_and_secure',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'change_this_in_production_refresh_secret_very_long_and_secure',
        HSTS_MAX_AGE: parseInteger(process.env.HSTS_MAX_AGE, 31536000), // 1 year
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000']
    },

    // === OAUTH GOOGLE ===
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
    },

    // === EMAIL ===
    EMAIL: {
        HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
        PORT: parseInteger(process.env.EMAIL_PORT, 587),
        USER: process.env.EMAIL_USER,
        PASS: process.env.EMAIL_PASS,
        SUPPORT: process.env.SUPPORT_EMAIL || 'suporte@editaliza.com.br'
    },

    // === BUSINESS LOGIC ===
    BUSINESS: {
        CRONOGRAMA_BATCH_SIZE: parseInteger(process.env.CRONOGRAMA_BATCH_SIZE, 100),
        MAX_NAME_LENGTH: parseInteger(process.env.MAX_NAME_LENGTH, 100),
        MAX_CITY_LENGTH: parseInteger(process.env.MAX_CITY_LENGTH, 100),
        MAX_MOTIVATION_TEXT_LENGTH: parseInteger(process.env.MAX_MOTIVATION_TEXT_LENGTH, 1000)
    },

    // === DEBUG E LOGS ===
    DEBUG: {
        MODE: parseBoolean(process.env.DEBUG_MODE, false),
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    },

    // === CSP ===
    CSP: {
        SCRIPT_SRC: process.env.CSP_SCRIPT_SRC || "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://accounts.google.com https://www.gstatic.com",
        STYLE_SRC: process.env.CSP_STYLE_SRC || "'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com",
        FONT_SRC: process.env.CSP_FONT_SRC || "'self' https://fonts.gstatic.com",
        IMG_SRC: process.env.CSP_IMG_SRC || "'self' data: https: blob:",
        CONNECT_SRC: process.env.CSP_CONNECT_SRC || "'self' https: wss:"
    }
};

/**
 * Validação de configurações críticas
 */
const validateConfig = () => {
    const errors = [];

    // Validações críticas para produção
    if (config.IS_PRODUCTION) {
        if (config.SESSION.SECRET === 'change_this_in_production_very_long_secure_string') {
            errors.push('SESSION_SECRET deve ser alterado em produção');
        }
        
        if (config.SECURITY.JWT_SECRET === 'change_this_in_production_jwt_secret_very_long_and_secure') {
            errors.push('JWT_SECRET deve ser alterado em produção');
        }
        
        if (config.SECURITY.JWT_REFRESH_SECRET === 'change_this_in_production_refresh_secret_very_long_and_secure') {
            errors.push('JWT_REFRESH_SECRET deve ser alterado em produção');
        }

        if (!config.GOOGLE.CLIENT_ID || !config.GOOGLE.CLIENT_SECRET) {
            errors.push('Configurações do Google OAuth são obrigatórias em produção');
        }

        if (config.EMAIL.USER && !config.EMAIL.PASS) {
            errors.push('EMAIL_PASS é obrigatório quando EMAIL_USER está configurado');
        }
    }

    // Validações de tipos
    if (config.PORT < 1 || config.PORT > 65535) {
        errors.push('PORT deve estar entre 1 e 65535');
    }

    if (config.UPLOAD.MAX_FILE_SIZE < 1024) {
        errors.push('UPLOAD_MAX_FILE_SIZE deve ser pelo menos 1KB');
    }

    if (errors.length > 0) {
        console.error('❌ Erros de configuração encontrados:');
        errors.forEach(error => console.error(`  - ${error}`));
        
        if (config.IS_PRODUCTION) {
            process.exit(1);
        } else {
            console.warn('⚠️  Continuando em modo de desenvolvimento...');
        }
    }
};

// Validar configurações na inicialização
validateConfig();

// Log das configurações carregadas (sem secrets)
if (config.DEBUG.MODE) {
    console.log('🔧 Configurações carregadas:', {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        HOST: config.HOST,
        DATABASE_PATH: config.DATABASE.PATH,
        UPLOADS_DIR: config.PATHS.UPLOADS,
        TIMEZONE: config.TIMEZONE
    });
}

module.exports = config;