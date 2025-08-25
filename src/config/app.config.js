/**
 * Configuração Central da Aplicação
 * Gerencia todas as configurações do sistema de forma centralizada e segura
 * 
 * ROBUSTEZ:
 * - Detecção automática de ambiente
 * - Validações de configurações críticas
 * - Fallbacks seguros para desenvolvimento
 * - Logging estruturado das configurações
 */

require('dotenv').config();
const path = require('path');

// Detecção inteligente do ambiente
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Detecção de ambiente local vs servidor
const isLocal = process.env.APP_URL?.includes('localhost') || 
                process.env.NODE_ENV === 'development' ||
                !process.env.NODE_ENV;

const config = {
    // === AMBIENTE ===
    environment: {
        NODE_ENV,
        isDevelopment,
        isProduction,
        isTest,
        isLocal,
        PORT: parseInt(process.env.PORT) || 3000,
        HOST: process.env.HOST || '0.0.0.0'
    },

    // === URLS E DOMÍNIOS ===
    urls: {
        app: process.env.APP_URL || (isProduction 
            ? 'https://app.editaliza.com.br' 
            : 'http://localhost:3000'),
        
        client: process.env.CLIENT_URL || (isProduction 
            ? 'https://app.editaliza.com.br' 
            : 'http://localhost:3000'),
        
        frontend: process.env.FRONTEND_URL || (isProduction 
            ? 'https://app.editaliza.com.br' 
            : 'http://localhost:3000'),
        
        api: process.env.API_URL || (isProduction 
            ? 'https://app.editaliza.com.br/api' 
            : 'http://localhost:3000/api')
    },

    // === BANCO DE DADOS ===
    database: {
        // PostgreSQL Principal
        postgres: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || (isProduction ? 'editaliza_db' : 'editaliza_dev'),
            username: process.env.DB_USER || 'editaliza_user',
            password: process.env.DB_PASSWORD || (isProduction ? undefined : '1a2b3c4d'),
            
            // Pool de conexões otimizado
            pool: {
                min: parseInt(process.env.DB_POOL_MIN) || (isProduction ? 5 : 2),
                max: parseInt(process.env.DB_POOL_MAX) || (isProduction ? 20 : 5),
                idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
                acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
                evict: parseInt(process.env.DB_POOL_EVICT) || 1000
            },
            
            // Configurações SSL
            ssl: isProduction ? {
                require: true,
                rejectUnauthorized: false
            } : false,
            
            // Configurações de performance
            dialectOptions: {
                statement_timeout: 30000,
                query_timeout: 30000,
                idle_in_transaction_session_timeout: 30000
            }
        },

        // Redis para Cache e Sessões
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: parseInt(process.env.REDIS_DB) || 0,
            enabled: isProduction || process.env.REDIS_ENABLED === 'true',
            
            // Configurações de retry e timeout
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            
            // TTL padrão para cache
            defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL) || 3600 // 1 hora
        }
    },

    // === SEGURANÇA ===
    security: {
        // JWT Configuration
        jwt: {
            secret: process.env.JWT_SECRET || (isProduction 
                ? undefined // Força erro em produção
                : 'dev_jwt_secret_change_in_production'),
            refreshSecret: process.env.JWT_REFRESH_SECRET || (isProduction 
                ? undefined 
                : 'dev_refresh_secret_change_in_production'),
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
            refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
            algorithm: 'HS256',
            issuer: 'editaliza-app'
        },

        // Sessões
        session: {
            secret: process.env.SESSION_SECRET || (isProduction 
                ? undefined 
                : 'dev_session_secret_change_in_production'),
            name: process.env.SESSION_NAME || 'editaliza.session',
            resave: false,
            saveUninitialized: false,
            rolling: true,
            cookie: {
                secure: isProduction,
                httpOnly: true,
                maxAge: parseInt(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000, // 7 dias
                sameSite: 'lax',
                domain: isProduction ? '.editaliza.com.br' : undefined
            }
        },

        // Bcrypt
        bcrypt: {
            rounds: parseInt(process.env.BCRYPT_ROUNDS) || (isProduction ? 12 : 10)
        },

        // CSRF Protection
        csrf: {
            enabled: isProduction || process.env.CSRF_ENABLED !== 'false',
            secret: process.env.CSRF_SECRET || 'csrf-secret-key',
            cookie: {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax'
            }
        }
    },

    // === RATE LIMITING ===
    rateLimit: {
        // Rate limit global
        global: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
            max: parseInt(process.env.RATE_LIMIT_MAX) || (isProduction ? 100 : 1000),
            message: 'Muitas requisições. Tente novamente em alguns minutos.',
            standardHeaders: true,
            legacyHeaders: false
        },

        // Rate limit estrito para autenticação
        auth: {
            windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
            max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || (isProduction ? 5 : 50),
            message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
            skipSuccessfulRequests: true
        },

        // Rate limit para APIs
        api: {
            windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 min
            max: parseInt(process.env.API_RATE_LIMIT_MAX) || (isProduction ? 60 : 600),
            message: 'Limite de requisições API excedido. Aguarde um momento.'
        }
    },

    // === OAUTH PROVIDERS ===
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || (isProduction 
                ? 'https://app.editaliza.com.br/auth/google/callback'
                : 'http://localhost:3000/auth/google/callback'),
            scope: ['profile', 'email'],
            enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
        }
    },

    // === EMAIL SERVICE ===
    email: {
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        from: process.env.EMAIL_FROM || 'noreply@editaliza.com.br',
        enabled: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
        
        // Templates
        templates: {
            passwordReset: 'password-reset',
            welcome: 'welcome',
            planGenerated: 'plan-generated'
        },

        // Rate limiting para emails
        rateLimit: {
            max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX) || 10,
            windowMs: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000 // 1 hora
        }
    },

    // === CORS ===
    cors: {
        origin: process.env.CORS_ORIGIN ? 
            process.env.CORS_ORIGIN.split(',') : 
            (isProduction 
                ? ['https://app.editaliza.com.br', 'https://editaliza.com.br']
                : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']),
        credentials: process.env.CORS_CREDENTIALS !== 'false',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
        exposedHeaders: ['X-CSRF-Token'],
        optionsSuccessStatus: 200
    },

    // === LOGGING ===
    logging: {
        level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
        format: process.env.LOG_FORMAT || 'combined',
        
        // Arquivos de log
        files: {
            error: path.join(process.cwd(), 'logs', 'error.log'),
            combined: path.join(process.cwd(), 'logs', 'combined.log'),
            access: path.join(process.cwd(), 'logs', 'access.log')
        },
        
        // Rotação de logs
        rotation: {
            maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
            maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true
        },

        // Configurações específicas
        sql: process.env.LOG_SQL === 'true',
        performance: {
            enabled: isDevelopment || process.env.LOG_PERFORMANCE === 'true',
            slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD) || 1000, // ms
            slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 2000 // ms
        }
    },

    // === UPLOAD DE ARQUIVOS ===
    upload: {
        destination: process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'),
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf'
        ],
        
        // Configurações específicas para fotos de perfil
        profile: {
            maxSize: parseInt(process.env.PROFILE_PHOTO_MAX_SIZE) || 2 * 1024 * 1024, // 2MB
            dimensions: {
                width: parseInt(process.env.PROFILE_PHOTO_WIDTH) || 400,
                height: parseInt(process.env.PROFILE_PHOTO_HEIGHT) || 400
            }
        }
    },

    // === FEATURES FLAGS ===
    features: {
        // Funcionalidades que podem ser habilitadas/desabilitadas
        registrationOpen: process.env.FEATURE_REGISTRATION !== 'false',
        emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
        googleOAuth: process.env.FEATURE_GOOGLE_OAUTH !== 'false',
        passwordReset: process.env.FEATURE_PASSWORD_RESET !== 'false',
        profilePhotos: process.env.FEATURE_PROFILE_PHOTOS !== 'false',
        
        // Funcionalidades específicas do sistema
        planGeneration: process.env.FEATURE_PLAN_GENERATION !== 'false',
        statistics: process.env.FEATURE_STATISTICS !== 'false',
        gamification: process.env.FEATURE_GAMIFICATION !== 'false',
        
        // Funcionalidades administrativas
        adminPanel: process.env.FEATURE_ADMIN_PANEL !== 'false',
        systemMetrics: process.env.FEATURE_SYSTEM_METRICS !== 'false'
    },

    // === PERFORMANCE ===
    performance: {
        // Compression
        compression: {
            enabled: process.env.COMPRESSION_ENABLED !== 'false',
            level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
            threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024
        },

        // Caching
        cache: {
            enabled: isProduction || process.env.CACHE_ENABLED === 'true',
            defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 300, // 5 min
            
            // Cache específico por tipo
            plans: parseInt(process.env.CACHE_PLANS_TTL) || 600, // 10 min
            statistics: parseInt(process.env.CACHE_STATS_TTL) || 300, // 5 min
            user: parseInt(process.env.CACHE_USER_TTL) || 900 // 15 min
        },

        // Timeouts
        timeouts: {
            request: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30s
            database: parseInt(process.env.DB_TIMEOUT) || 30000, // 30s
            email: parseInt(process.env.EMAIL_TIMEOUT) || 10000 // 10s
        }
    },

    // === PATHS ===
    paths: {
        root: process.cwd(),
        src: path.join(process.cwd(), 'src'),
        public: path.join(process.cwd(), 'public'),
        uploads: path.join(process.cwd(), 'uploads'),
        logs: path.join(process.cwd(), 'logs'),
        temp: path.join(process.cwd(), 'temp'),
        
        // Templates
        emailTemplates: path.join(process.cwd(), 'src', 'templates', 'email'),
        views: path.join(process.cwd(), 'views')
    }
};

// === VALIDAÇÕES DE CONFIGURAÇÕES CRÍTICAS ===
function validateConfig() {
    const errors = [];
    
    if (isProduction) {
        // Validações obrigatórias em produção
        const requiredInProduction = [
            { key: 'JWT_SECRET', value: config.security.jwt.secret },
            { key: 'SESSION_SECRET', value: config.security.session.secret },
            { key: 'DB_PASSWORD', value: config.database.postgres.password }
        ];

        requiredInProduction.forEach(({ key, value }) => {
            if (!value) {
                errors.push(`${key} é obrigatório em produção`);
            }
        });

        // Validações de segurança
        if (config.security.bcrypt.rounds < 10) {
            errors.push('BCRYPT_ROUNDS deve ser pelo menos 10 em produção');
        }

        if (!config.security.session.cookie.secure) {
            errors.push('Cookies devem ser seguros em produção');
        }
    }

    // Validações de OAuth
    if (config.features.googleOAuth && !config.oauth.google.enabled) {
        errors.push('Google OAuth habilitado mas credenciais não configuradas');
    }

    // Validações de email
    if (config.features.passwordReset && !config.email.enabled) {
        errors.push('Reset de senha habilitado mas email não configurado');
    }

    // Validações de banco
    if (!config.database.postgres.host || !config.database.postgres.database) {
        errors.push('Configurações do banco de dados incompletas');
    }

    return errors;
}

// === INICIALIZAÇÃO ===
function initializeConfig() {
    const validationErrors = validateConfig();
    
    if (validationErrors.length > 0) {
        console.error('❌ ERROS DE CONFIGURAÇÃO:');
        validationErrors.forEach(error => console.error(`   - ${error}`));
        
        if (isProduction) {
            console.error('\n💥 APLICAÇÃO NÃO PODE INICIAR COM CONFIGURAÇÕES INVÁLIDAS EM PRODUÇÃO');
            process.exit(1);
        } else {
            console.warn('\n⚠️  APLICAÇÃO INICIANDO COM CONFIGURAÇÕES INVÁLIDAS (DESENVOLVIMENTO)');
        }
    }

    // Log das configurações em desenvolvimento
    if (isDevelopment) {
        console.log('\n📋 CONFIGURAÇÕES DA APLICAÇÃO:');
        console.log(`   Ambiente: ${config.environment.NODE_ENV}`);
        console.log(`   Porta: ${config.environment.PORT}`);
        console.log(`   URL: ${config.urls.app}`);
        console.log(`   Banco: ${config.database.postgres.host}:${config.database.postgres.port}/${config.database.postgres.database}`);
        console.log(`   Redis: ${config.database.redis.enabled ? 'Habilitado' : 'Desabilitado'}`);
        console.log(`   Google OAuth: ${config.oauth.google.enabled ? 'Configurado' : 'Não configurado'}`);
        console.log(`   Email: ${config.email.enabled ? 'Configurado' : 'Não configurado'}`);
        console.log(`   Features: ${Object.keys(config.features).filter(f => config.features[f]).join(', ')}`);
    }

    return config;
}

// Exportar configuração inicializada
module.exports = initializeConfig();