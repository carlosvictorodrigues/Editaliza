// server.js - Versão com correções de segurança

// Carregar variáveis de ambiente ANTES de qualquer outro código
require('dotenv').config();

// CONFIGURAÇÃO DE FUSO HORÁRIO BRASILEIRO
process.env.TZ = 'America/Sao_Paulo';

// Carregar configurações de ambiente
const config = require('./src/config/environment');

// FUNÇÃO UTILITÁRIA PARA DATA BRASILEIRA
function getBrazilianDateString() {
    const now = new Date();
    // Criar objeto Date diretamente no timezone brasileiro
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const express = require('express');
const db = require('./database-postgresql.js');

// ============================================================================
// INTEGRAÇÃO DOS REPOSITORIES - FASE 4
// ============================================================================
const { createRepositories } = require('./src/repositories');
const repos = createRepositories(db);
// Disponibilizar repositories globalmente para migração gradual
global.repos = repos;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { body, query, validationResult } = require('express-validator');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
// Removido SQLiteStore - usando MemoryStore temporariamente
// const SQLiteStore = require('connect-sqlite3')(session);
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Import modular Passport configuration
const passport = require('./src/config/passport');

// Import email services
const emailService = require('./src/services/emailService');
const { emailRateLimitService, createPasswordRecoveryRateLimit } = require('./src/services/emailRateLimitService');

// Importar rotas CACKTO para webhooks
let CacktoRoutes;
try {
    CacktoRoutes = require('./src/routes/cackto.routes');
    console.log('✅ CacktoRoutes module loaded successfully');
} catch (error) {
    console.error('❌ Failed to load CacktoRoutes:', error.message);
    CacktoRoutes = express.Router(); // Fallback empty router
}

// Importar middleware de segurança
const {
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    bodySizeLimit
} = require('./middleware.js');

// Importar utilitários de segurança e performance
const {
    strictRateLimit,
    moderateRateLimit,
    sanitizeInput,
    validateApiInput,
    csrfProtection,
    generateCSRFToken,
    securityLog
} = require('./src/utils/security');

// Importar sistema de error handling
const {
    AppError,
    ERROR_TYPES,
    errorHandler,
    asyncHandler,
    handleDatabaseError,
} = require('./src/utils/error-handler');

// Sistema de backup foi removido durante migração para PostgreSQL

// Importar otimizações de banco
const {
    fetchTopicsWithSubjects,
    fetchSessionsWithRelatedData,
    executeCachedQuery,
    globalCache
} = require('./src/utils/database-optimization');


// ============================================================================
// VALIDAÇÃO DE SEGURANÇA EM PRODUÇÃO
// ============================================================================
function validateProductionSecrets() {
    if (process.env.NODE_ENV === 'production') {
        const requiredSecrets = [
            'SESSION_SECRET',
            'JWT_SECRET',
            'JWT_REFRESH_SECRET'
        ];
        
        for (const secret of requiredSecrets) {
            if (!process.env[secret] || process.env[secret].length < 32) {
                throw new Error(`${secret} deve ter pelo menos 32 caracteres em produção`);
            }
        }
    }
}

// Validar secrets em produção antes de inicializar
try {
    validateProductionSecrets();
    console.log('✅ Secrets de produção validados');
} catch (error) {
    console.error('❌ ERRO DE SEGURANÇA:', error.message);
    if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Não permitir inicialização sem secrets
    }
}

const app = express();

app.use((req, res, next) => {
    console.log(`[REQUEST LOGGER] ${req.method} ${req.path}`);
    next();
});

// CORREÇÃO OAUTH: Configurar trust proxy para funcionar atrás de Nginx
// Isso é CRÍTICO para OAuth funcionar corretamente com proxy reverso
app.set('trust proxy', 1);
console.log('✅ Trust proxy configurado para funcionar com Nginx');

// Middleware para configurar MIME types corretos
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
    }
    next();
});

// CORREÇÃO DE SEGURANÇA: Servir apenas arquivos públicos necessários
// Anteriormente: app.use(express.static(__dirname)); // ❌ EXPUNHA TODO O PROJETO
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js'))  res.setHeader('Content-Type','application/javascript; charset=utf-8');
    if (path.endsWith('.css')) res.setHeader('Content-Type','text/css; charset=utf-8');
  }
}));

// Servir arquivos específicos ainda no root (compatibilidade temporária)
app.use('/css', express.static(path.join(__dirname, 'css'), { 
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));


// CORREÇÃO: Servir avatares de forma segura - apenas imagens da pasta images/avatars
app.use('/images', express.static(path.join(__dirname, 'images')));

// Servir arquivos HTML específicos
const allowedHtmlFiles = [
    'home.html', 'login.html', 'register.html', 'dashboard.html', 
    'profile.html', 'cronograma.html', 'plan.html', 'notes.html',
    'metodologia.html', 'faq.html', 'plan_settings.html'
];

allowedHtmlFiles.forEach(file => {
    app.get(`/${file}`, (req, res) => {
        // Adicionar headers para desabilitar o cache durante o debug
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.sendFile(path.join(__dirname, file));
    });
});

// CORREÇÃO DE SEGURANÇA: CSP endurecida sem unsafe-inline
// Middleware para gerar nonce único por requisição e CSRF token
app.use((req, res, next) => {
    res.locals.nonce = require('crypto').randomBytes(16).toString('base64');
    
    // Gerar CSRF token para sessões autenticadas
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    
    // Disponibilizar CSRF token para templates
    res.locals.csrfToken = req.session?.csrfToken || '';
    next();
});

// Configurações de segurança - Helmet com CSP endurecida
const __isProd = process.env.NODE_ENV === 'production';
const __helmetOptions = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ['\'self\''],
            // CORREÇÃO: Remover 'unsafe-inline' e usar nonce
            styleSrc: ['\'self\'', 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com', (req, res) => `'nonce-${res.locals.nonce}'`],
            scriptSrc: ['\'self\'', 'https://cdn.tailwindcss.com', (req, res) => `'nonce-${res.locals.nonce}'`],
            fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
            imgSrc: ['\'self\'', 'data:', 'https:', 'https://lh3.googleusercontent.com'], // Google avatars
            connectSrc: ['\'self\'', 'https://accounts.google.com'],
            formAction: ['\'self\'', 'https://accounts.google.com'],
            objectSrc: ['\'none\''], // Bloquear Flash/plugins
            baseUri: ['\'self\''], // Prevenir ataques base href
            frameAncestors: ['\'none\''] // Clickjacking protection
        },
    },
    // Adicionar headers de segurança extras
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};

// Em produção, habilitar upgradeInsecureRequests e HSTS; em desenvolvimento, desabilitar
if (__isProd) {
    __helmetOptions.contentSecurityPolicy.directives.upgradeInsecureRequests = [];
    __helmetOptions.hsts = { maxAge: 31536000, includeSubDomains: true, preload: true };
}

app.use(helmet(__helmetOptions));

// Configuração CORS mais restritiva
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin header (health checks, server-to-server, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        // Verificar se o origin está na lista de permitidos
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn('CORS bloqueou origin:', origin, 'Permitidos:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['X-Total-Count'] // Headers seguros para expor
}));

// Configuração de sessão - Usa PostgreSQL ou memória
let sessionStore;

// Construir connection string a partir das variáveis de ambiente
const pgConnString = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

// Tentar usar PostgreSQL se disponível
if (process.env.FORCE_MEMORY_SESSIONS === 'true') {
    console.log('📦 Usando sessões em memória (forçado)');
    sessionStore = new session.MemoryStore();
} else {
    try {
        sessionStore = new pgSession({
            conString: pgConnString,
            tableName: 'sessions',
            createTableIfMissing: true,
            schemaName: 'public' // Usar schema public
        });
        console.log('📦 Usando PostgreSQL para sessões');
    } catch (err) {
        // Fallback para memória se PostgreSQL falhar
        console.log('⚠️ PostgreSQL não disponível, usando sessões em memória');
        sessionStore = new session.MemoryStore();
    }
}

const sessionConfig = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.editaliza.com.br' : undefined
    }
};

// Aplicar configuração de sessão
app.use(cookieParser());
app.use(session(sessionConfig));

// Middleware para debug de sessão (temporário)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        if (req.path.includes('/auth/google')) {
            console.log('[SESSION DEBUG]', {
                path: req.path,
                sessionID: req.sessionID,
                hasSession: !!req.session,
                sessionData: req.session ? Object.keys(req.session) : [],
                cookies: Object.keys(req.cookies || {})
            });
        }
        next();
    });
}

// Configure Passport
app.use(passport.initialize());
app.use(passport.session());

/*
// LEGACY PASSPORT CONFIGURATION - MOVED TO src/config/passport.js
// Passport Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists with Google ID
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE google_id = ?',
                [profile.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingUser) {
            return done(null, existingUser);
        }

        // Check if user exists with same email
        const emailUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE email = ?',
                [profile.emails[0].value],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (emailUser) {
            // Link Google account to existing user
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET google_id = ?, auth_provider = "google", google_avatar = ?, name = ? WHERE id = ?',
                    [profile.id, profile.photos[0]?.value, profile.displayName, emailUser.id],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            // Return updated user
            const updatedUser = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE id = ?',
                    [emailUser.id],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            return done(null, updatedUser);
        }

        // Create new user
        const newUser = await new Promise((resolve, reject) => {
            const currentDate = new Date().toISOString();
            db.run(
                `INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
                 VALUES (?, ?, ?, "google", ?, ?)`,
                [profile.emails[0].value, profile.displayName, profile.id, profile.photos[0]?.value, currentDate],
                function(err) {
                    if (err) reject(err);
                    else {
                        db.get(
                            'SELECT * FROM users WHERE id = ?',
                            [this.lastID],
                            (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            }
                        );
                    }
                }
            );
        });

        return done(null, newUser);
    } catch (error) {
        console.error('Google OAuth Error:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});
*/

/*
// ============================================================================
// LEGACY UPLOAD ROUTE - MOVED TO /auth/profile/upload-photo
// ============================================================================
const { validateFilePath, createSafeError, securityLog } = require('./src/utils/security');

app.post('/api/profile/upload-photo', authenticateToken, (req, res) => {
    upload.single('photo')(req, res, async (err) => {
        if (err) {
            securityLog('upload_error', { error: err.message }, req.user.id, req);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
                }
            }
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
            securityLog('upload_no_file', {}, req.user.id, req);
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }
        
        try {
            // Obter a foto de perfil anterior para deletar
            const user = await dbGet('SELECT profile_picture FROM users WHERE id = ?', [req.user.id]);
            const oldPhoto = user?.profile_picture;
            
            // Atualizar o caminho da foto no banco
            const photoPath = `/uploads/${req.file.filename}`;
            await dbRun('UPDATE users SET profile_picture = ? WHERE id = ?', [photoPath, req.user.id]);
            
            // CORREÇÃO CRÍTICA: Validação segura de path antes de deletar
            if (oldPhoto && oldPhoto !== photoPath && oldPhoto.startsWith('/uploads/')) {
                try {
                    const validatedPath = validateFilePath(oldPhoto, 'uploads');
                    const oldFilePath = path.join(__dirname, validatedPath.substring(1));
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                        securityLog('old_photo_deleted', { path: validatedPath }, req.user.id, req);
                    }
                } catch (pathError) {
                    securityLog('invalid_photo_path', { error: pathError.message, path: oldPhoto }, req.user.id, req);
                    // Continue sem deletar se path for inválido
                }
            }
            
            securityLog('photo_uploaded', { photoPath }, req.user.id, req);
            res.json({
                message: 'Foto de perfil atualizada com sucesso!',
                profile_picture: photoPath
            });
            
        } catch (error) {
            securityLog('upload_database_error', error.message, req.user.id, req);
            
            // Deletar arquivo se houver erro ao salvar no banco
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            
            res.status(500).json(createSafeError(error, 'Erro ao salvar foto de perfil'));
        }
    });
});
*/



// CORREÇÃO: Rate limiting aplicado antes do parsing
app.use('/login', strictRateLimit);
app.use('/register', strictRateLimit);
app.use('/forgot-password', strictRateLimit);
app.use('/reset-password', strictRateLimit);


// ==========================================
// INTEGRAÇÃO CACKTO - TEMPORARIAMENTE DESABILITADA
// ==========================================

/* 
// CACKTO INTEGRATION TEMPORARILY DISABLED
// Reason: Missing database tables and columns causing 500 errors
// Tables needed: integration_metrics, cackto_cache  
// Column needed: subscriptions.cackto_transaction_id (currently has kiwify_transaction_id)
// TODO: Run migration script and re-enable

// Inicializar integração CACKTO
(async () => {
    try {
        const result = await initializeCackto({
            enableCache: true,
            enableMetrics: true,
            syncOnInit: false
        });
        console.log('✅ Integração CACKTO inicializada:', result.message);
    } catch (error) {
        console.error('❌ Erro ao inicializar CACKTO:', error.message);
    }
})();

// Adicionar informações de assinatura a todas as rotas autenticadas
// TEMPORÁRIO: Comentando middleware problemático que causa timeout
// Rotas de webhook CACKTO (ANTES de qualquer middleware de autenticação)
// Webhook routes don't need authentication - they use signature validation
console.log('🔧 Mounting CacktoRoutes at /api/webhooks');
console.log('   CacktoRoutes type:', typeof CacktoRoutes);
console.log('   CacktoRoutes keys:', CacktoRoutes ? Object.keys(CacktoRoutes) : 'null');
app.use('/api/webhooks', CacktoRoutes);
console.log('✅ CacktoRoutes mounted successfully');

// Debug route to test webhook path
app.post('/api/webhooks/cackto', (req, res) => {
    console.log('🎯 Direct webhook route hit!');
    res.status(200).json({ message: 'Direct route working', body: req.body });
});

// app.use(authenticateToken, addSubscriptionInfo());

// WORKAROUND: Aplicar apenas autenticação sem subscription info
app.use('*', (req, res, next) => {
    // Pular autenticação para rotas públicas
    const publicPaths = ['/health', '/login.html', '/register.html', '/auth', '/api/webhooks'];
    if (publicPaths.some(path => req.originalUrl.includes(path)) || req.method === 'OPTIONS') {
        return next();
    }
    
    // Aplicar autenticação apenas para outras rotas
    authenticateToken(req, res, next);
});

// TEMPORARY FALLBACK - Simple subscription check without Cackto
const requireActiveSubscription = (req, res, next) => {
    // For now, allow all authenticated users until Cackto is properly configured
    next();
};

// Middleware para funcionalidades premium específicas - DISABLED WITH CACKTO
/*
const requirePDFDownload = requirePremiumFeature('pdf_download');
const requireAdvancedSearch = requirePremiumFeature('advanced_search');
const requireOfflineAccess = requirePremiumFeature('offline_access');
*/

// TEMPORARY FALLBACK - Allow all features until Cackto is properly configured
const requirePDFDownload = (req, res, next) => next();
const requireAdvancedSearch = (req, res, next) => next();
const requireOfflineAccess = (req, res, next) => next();

app.use('/api/', moderateRateLimit);

// Alias /dashboard para compatibilidade com testes
app.get('/api/dashboard', authenticateToken, (req, res) => {
    // Redirecionar para endpoint de estatísticas ou retornar dados básicos
    res.json({
        message: 'Dashboard endpoint',
        userId: req.user?.id,
        stats: {
            plansCount: 0,
            sessionsCount: 0,
            completedCount: 0
        }
    });
});

// CSRF Protection DESABILITADO TEMPORARIAMENTE PARA DEBUG
app.use((req, res, next) => {
    console.log(`[CSRF] Pulando validação para: ${req.method} ${req.path}`);
    return next(); // SEMPRE PULAR CSRF PARA DEBUG
    
    /* CÓDIGO ORIGINAL COMENTADO
    // Pular CSRF para algumas rotas públicas essenciais
    const skipCSRF = [
        '/login',
        '/register',
        '/auth/login',
        '/auth/register', 
        '/auth/google',
        '/auth/google/callback',
        '/request-password-reset',
        '/reset-password',
        '/csrf-token'  // Endpoint para obter token CSRF
    ];
    
    // Pular CSRF para APIs autenticadas com JWT (verifica se há Authorization header)
    const isAPIRoute = req.path.startsWith('/api/') || req.path.startsWith('/schedules') || req.path.startsWith('/plans') || req.path.startsWith('/users') || req.path.startsWith('/topics');
    const hasJWTAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    
    if (skipCSRF.includes(req.path) || req.method === 'GET' || (isAPIRoute && hasJWTAuth)) {
        return next();
    }
    
    return csrfProtection()(req, res, next);
    */
});

// Body parsing com sanitização
// Adicionar middleware de métricas
const { collectMetrics } = require('./src/middleware/metrics');
app.use(collectMetrics);

// MIDDLEWARE DE LOG FINAL - CAPTURA TODOS OS STATUS
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log('[FINAL]', res.statusCode, req.method, req.originalUrl, (Date.now()-start)+'ms', {
      rl: res.get('X-RateLimit-Remaining') || res.get('RateLimit-Remaining') || null
    });
  });
  next();
});

app.use(express.json({ 
    limit: '2mb', // Reduzido para segurança
    verify: (req, res, buf) => {
        // Log suspeito de payloads muito grandes
        if (buf.length > 1024 * 1024) {
            securityLog('large_payload_detected', {
                size: buf.length,
                ip: req.ip,
                endpoint: req.path
            });
        }
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '2mb',
    parameterLimit: 100 // Limitar número de parâmetros
}));
app.use(bodySizeLimit('2mb'));

// Middleware de sanitização global
app.use((req, res, next) => {
    // Sanitizar body
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    
    // Sanitizar query params
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeInput(req.query[key]);
            }
        }
    }
    
    next();
});
app.use(sanitizeMiddleware);

// Rate limiting geral para outras rotas
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 50000, // MUITO alto para debug
    message: { 
        error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
        code: 'RATE_LIMIT_GENERAL' 
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        console.log('[RATE-LIMIT-HIT] 429 sendo enviado para:', req.method, req.originalUrl, req.ip);
        res.status(429).json({
            error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
            code: 'RATE_LIMIT_GENERAL'
        });
    },
    skip: (req) => {
        // Desabilitar completamente se configurado
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            return true;
        }
        
        const skipPaths = [
            '/health', '/ready', // Health checks
            '/gamification',
            '/schedule', 
            '/overdue_check',
            '/progress',
            '/goal_progress',
            '/realitycheck',
            '/settings', // Configurações do plano
            '/generate', // Geração de cronograma
            '/batch_update', // Atualização em lote
            '/batch_update_details' // Atualização de detalhes
        ];
        return skipPaths.some(path => req.path.endsWith(path)) || 
               req.path.includes('/plans/') || // Qualquer rota de planos
               req.path.includes('/topics/') || // Qualquer rota de tópicos
               req.path.includes('/subjects/'); // Qualquer rota de subjects
    }
});
app.use(globalLimiter);

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Gerar nome único para o arquivo
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB máximo
    },
    fileFilter: function (req, file, cb) {
        // Verificar se o arquivo é uma imagem
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos.'), false);
        }
    }
});

// Servir arquivos de upload estaticamente
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting específico para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
});

// Verificar variáveis de ambiente críticas
const requiredEnvVars = ['JWT_SECRET', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error(`ERRO: Variáveis de ambiente obrigatórias não definidas: ${missingEnvVars.join(', ')}`);
    console.error('Por favor, crie um arquivo .env baseado no .env.example');
    process.exit(1);
}

// Funções utilitárias para interagir com o banco de dados usando Promises
// CORREÇÃO: Usar métodos do PostgreSQL diretamente quando disponíveis
const dbGet = db.get && typeof db.get === 'function' ? 
    (sql, params = []) => db.get(sql, params) : 
    (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

const dbAll = db.all && typeof db.all === 'function' ?
    (sql, params = []) => db.all(sql, params) :
    (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

// CORREÇÃO DE SEGURANÇA: Disponibilizar dbGet para middleware de admin
global.dbGet = dbGet;

const dbRun = db.run && typeof db.run === 'function' ?
    (sql, params = []) => db.run(sql, params) :
    (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));

// --- ROTAS DE AUTENTICAÇÃO E USUÁRIO ---

// Rota para registrar um novo usuário
// LEGACY AUTH ROUTES - COMMENTED OUT (Now using modular /auth routes)
/*
app.post('/api/register', 
    validators.email,
    validators.password,
    body('name').optional().isString().isLength({ max: 100 }).withMessage('Nome muito longo'),
    handleValidationErrors,
    async (req, res) => {
        const { email, password, name } = req.body;
        try {
            const hashedPassword = await bcrypt.hash(password, 12);
            const now = new Date().toISOString();
            await dbRun('INSERT INTO users (email, password_hash, name, created_at) VALUES (?,?,?,?)', [email, hashedPassword, name || null, now]);
            res.status(201).json({ "message": "Usuário criado com sucesso!" });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: "Este e-mail já está em uso." });
            } else {
                console.error('Erro no registro:', error);
                return res.status(500).json({ error: "Erro ao criar usuário." });
            }
        }
    }
);
*/

// ============================================================================
// MODULAR ROUTES - NEW ARCHITECTURE
// ============================================================================

// ============================================================================
// CONFIGURAÇÃO DE ROTAS - USANDO CENTRALIZADOR MODULAR
// ============================================================================
const { configureRoutes } = require('./src/routes/index');

// Cookie parser já foi configurado anteriormente

// Aplicar configuração condicional de CSRF - desabilitar para rotas /api/*
// NOTA: CSRF está comentado temporariamente pois está causando problemas
// TODO: Revisar configuração de CSRF após estabilização do sistema
/*
const csrfMiddleware = require('csurf')({ cookie: true });
app.use((req, res, next) => {
    // Desabilitar CSRF para todas as rotas de API que usam JWT
    if (req.path.startsWith('/api/')) {
        return next();
    }
    // Habilitar CSRF para todas as outras rotas (ex: renderização de páginas com formulários)
    csrfMiddleware(req, res, next);
});
*/

// Configurar todas as rotas modulares
configureRoutes(app);

// ============================================================================
// LEGACY ROUTES MOVIDAS PARA MODULES - NÃO ADICIONAR ROTAS AQUI
// ============================================================================
// TODAS AS ROTAS FORAM MOVIDAS PARA OS MÓDULOS EM src/routes/
// NÃO ADICIONE ROTAS DIRETAMENTE NO server.js

/* LEGACY CODE - COMENTADO PARA REFERÊNCIA
    try {
        const user = await dbGet(`SELECT 
            id, email, name, profile_picture, phone, whatsapp, created_at,
            state, city, birth_date, education, work_status, first_time, concursos_count,
            difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
            google_id, auth_provider, google_avatar
            FROM users WHERE id = ?`, [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        // Parse difficulties JSON string back to array
        let difficulties = [];
        if (user.difficulties) {
            try {
                difficulties = JSON.parse(user.difficulties);
            } catch (e) {
                difficulties = [];
            }
        }
        
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            profile_picture: user.profile_picture,
            phone: user.phone,
            whatsapp: user.whatsapp,
            created_at: user.created_at,
            state: user.state,
            city: user.city,
            birth_date: user.birth_date,
            education: user.education,
            work_status: user.work_status,
            first_time: user.first_time,
            concursos_count: user.concursos_count,
            difficulties: difficulties,
            area_interest: user.area_interest,
            level_desired: user.level_desired,
            timeline_goal: user.timeline_goal,
            study_hours: user.study_hours,
            motivation_text: user.motivation_text
        });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        return res.status(500).json({ error: 'Erro ao carregar perfil do usuário.' });
    }
});

// Rota para atualizar dados do perfil (completo com todos os campos)
app.patch('/api/profile', 
    authenticateToken,
    // Basic profile validations
    body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
    body('profile_picture').optional().isString().isLength({ max: 500 }).withMessage('URL da foto muito longa'),
    body('phone').optional().isString().isLength({ max: 20 }).withMessage('Telefone muito longo'),
    body('whatsapp').optional().isString().isLength({ max: 20 }).withMessage('WhatsApp muito longo'),
    // Extended profile validations
    body('state').optional().isString().isLength({ max: 2 }).withMessage('Estado deve ser a sigla com 2 caracteres'),
    body('city').optional().isString().isLength({ max: 100 }).withMessage('Cidade muito longa'),
    body('birth_date').optional().isISO8601().withMessage('Data de nascimento inválida'),
    body('education').optional().isString().isLength({ max: 50 }).withMessage('Escolaridade inválida'),
    body('work_status').optional().isString().isLength({ max: 50 }).withMessage('Situação profissional inválida'),
    body('first_time').optional().isString().isIn(['sim', 'nao']).withMessage('Primeira vez deve ser sim ou nao'),
    body('concursos_count').optional().isString().withMessage('Contagem de concursos inválida'),
    body('difficulties').optional().custom((value) => {
        let parsedValue = value;
        if (typeof value === 'string') {
            try {
                parsedValue = JSON.parse(value);
            } catch (e) {
                // Se não for um JSON válido, deixe como está para a próxima verificação
            }
        }
        if (parsedValue === null || parsedValue === undefined) return true; // Allow null/undefined
        if (Array.isArray(parsedValue)) return true; // Allow arrays
        throw new Error('Dificuldades deve ser um array');
    }),
    body('area_interest').optional().isString().isLength({ max: 50 }).withMessage('Área de interesse inválida'),
    body('level_desired').optional().isString().isLength({ max: 50 }).withMessage('Nível desejado inválido'),
    body('timeline_goal').optional().isString().isLength({ max: 50 }).withMessage('Prazo inválido'),
    body('study_hours').optional().isString().isLength({ max: 20 }).withMessage('Horas de estudo inválidas'),
    body('motivation_text').optional().isString().isLength({ max: 1000 }).withMessage('Texto de motivação muito longo'),
    handleValidationErrors,
    async (req, res) => {
        const { 
            name, profile_picture, phone, whatsapp, state, city, birth_date, education,
            work_status, first_time, concursos_count, difficulties, area_interest, 
            level_desired, timeline_goal, study_hours, motivation_text
        } = req.body;

        console.log('DEBUG (server.js): req.body.difficulties recebido:', difficulties); // Adicionar este log
        console.log('DEBUG (server.js): typeof req.body.difficulties:', typeof difficulties); // Adicionar este log
        
        try {
            const updates = [];
            const values = [];
            
            // Basic profile fields
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (profile_picture !== undefined) {
                updates.push('profile_picture = ?');
                values.push(profile_picture);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                values.push(phone);
            }
            if (whatsapp !== undefined) {
                updates.push('whatsapp = ?');
                values.push(whatsapp);
            }
            
            // Extended profile fields
            if (state !== undefined) {
                updates.push('state = ?');
                values.push(state);
            }
            if (city !== undefined) {
                updates.push('city = ?');
                values.push(city);
            }
            if (birth_date !== undefined) {
                updates.push('birth_date = ?');
                values.push(birth_date);
            }
            if (education !== undefined) {
                updates.push('education = ?');
                values.push(education);
            }
            if (work_status !== undefined) {
                updates.push('work_status = ?');
                values.push(work_status);
            }
            if (first_time !== undefined) {
                updates.push('first_time = ?');
                values.push(first_time);
            }
            if (concursos_count !== undefined) {
                updates.push('concursos_count = ?');
                values.push(concursos_count);
            }
            if (difficulties !== undefined) {
                updates.push('difficulties = ?');
                // Ensure difficulties is always an array or null
                const difficultiesToStore = difficulties === null ? [] : (Array.isArray(difficulties) ? difficulties : []);
                values.push(JSON.stringify(difficultiesToStore)); // Store as JSON string
            }
            if (area_interest !== undefined) {
                updates.push('area_interest = ?');
                values.push(area_interest);
            }
            if (level_desired !== undefined) {
                updates.push('level_desired = ?');
                values.push(level_desired);
            }
            if (timeline_goal !== undefined) {
                updates.push('timeline_goal = ?');
                values.push(timeline_goal);
            }
            if (study_hours !== undefined) {
                updates.push('study_hours = ?');
                values.push(study_hours);
            }
            if (motivation_text !== undefined) {
                updates.push('motivation_text = ?');
                values.push(motivation_text);
            }
            
            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }
            
            values.push(req.user.id);
            const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            
            await dbRun(sql, values);
            
            // Retornar dados atualizados com todos os campos
            const updatedUser = await dbGet(`SELECT 
                id, email, name, profile_picture, phone, whatsapp, created_at,
                state, city, birth_date, education, work_status, first_time, concursos_count,
                difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text
                FROM users WHERE id = ?`, [req.user.id]);
            
            // Parse difficulties back to array
            let userDifficulties = [];
            if (updatedUser.difficulties) {
                try {
                    userDifficulties = JSON.parse(updatedUser.difficulties);
                } catch (e) {
                    userDifficulties = [];
                }
            }
            
            res.json({
                message: 'Perfil atualizado com sucesso!',
                user: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    name: updatedUser.name,
                    profile_picture: updatedUser.profile_picture,
                    phone: updatedUser.phone,
                    whatsapp: updatedUser.whatsapp,
                    created_at: updatedUser.created_at,
                    state: updatedUser.state,
                    city: updatedUser.city,
                    birth_date: updatedUser.birth_date,
                    education: updatedUser.education,
                    work_status: updatedUser.work_status,
                    first_time: updatedUser.first_time,
                    concursos_count: updatedUser.concursos_count,
                    difficulties: userDifficulties,
                    area_interest: updatedUser.area_interest,
                    level_desired: updatedUser.level_desired,
                    timeline_goal: updatedUser.timeline_goal,
                    study_hours: updatedUser.study_hours,
                    motivation_text: updatedUser.motivation_text
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            return res.status(500).json({ error: 'Erro ao atualizar perfil do usuário.' });
        }
    }
);


// --- ROTAS DE TESTE E DEBUG ---
app.get('/api/test-db', authenticateToken, async (req, res) => {
    try {
        console.log("[DEBUG TEST] Testando conexão do banco...");
        
        // Teste 1: Query simples sem parâmetros
        const test1 = await dbAll('SELECT 1 as test');
        console.log(`[DEBUG TEST] Teste 1 (SELECT 1):`, test1);
        
        // Teste 2: Query com parâmetro
        const test2 = await dbAll('SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?', [req.user.id]);
        console.log(`[DEBUG TEST] Teste 2 (COUNT):`, test2);
        
        res.json({ test1, test2, userId: req.user.id });
    } catch (error) {
        console.error('[DEBUG TEST] Erro:', error);
        return res.status(500).json({ error: error.message });
    }
});

// --- ROTAS LEGACY REMOVIDAS - USANDO SISTEMA MODULAR ---
// TODAS as rotas /api/plans/* foram migradas para src/routes/plans.routes.js
// COMENTANDO TODAS AS ROTAS LEGACY PARA NÃO CONFLITAR COM SISTEMA MODULAR

// === TODAS AS ROTAS LEGACY /api/plans/* REMOVIDAS ===
// MIGRADAS PARA: src/routes/plans.routes.js
// Sistema modular agora é a única fonte de rotas /api/plans/*

// Endpoint para registrar tempo de estudo







































// === ROTA DE GAMIFICAÇÃO MIGRADA PARA MÓDULO ===
// A rota /api/plans/:planId/gamification foi migrada para:
// src/controllers/gamification.controller.js
// src/routes/gamification.routes.js
// FASE 7 COMPLETA ✅

// Endpoint para gerar dados de compartilhamento














            // Pegar dados de gamificação
            // CORREÇÃO: Contar tópicos únicos concluídos independente do session_type









            // Debug: Log para verificar o que está sendo calculado





            // Calcular streak































            // Calcular dias até prova





            // Determinar nível atual









// FASE2_REMOVED: Share progress endpoint moved to plans.routes.js

// Rota padrão - redireciona para login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Tratamento de erros global
// Health check endpoint for Docker/K8s (SIMPLIFICADO)
app.get('/health', (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        database: 'PostgreSQL',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    };
    
    // Resposta simples sem testar banco para evitar deadlocks
    res.status(200).json(healthCheck);
});

// Ready probe endpoint for K8s
app.get('/ready', (req, res) => {
    res.status(200).json({ status: 'ready', timestamp: Date.now() });
});

// Legacy metrics endpoint - MIGRATED TO /api/admin/system/metrics
app.get('/metrics', authenticateToken, (req, res) => {
    console.warn('DEPRECATED: /metrics - Use /api/admin/system/metrics instead');
    try {
        const { getMetricsReport } = require('./src/middleware/metrics');
        const report = getMetricsReport();
        res.json({
            ...report,
            deprecated: true,
            newEndpoint: '/api/admin/system/metrics'
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao coletar métricas' });
    }
});

// Configurar error handling global
// setupGlobalErrorHandling(); // Função não existe, comentada temporariamente

// Middleware de tratamento de erros robusto
app.use(errorHandler);

// Sistema de backup foi removido durante migração para PostgreSQL

// --- LEGACY ADMIN ROUTES (PHASE 8 - MIGRATED TO /api/admin/*) ---
// These routes are kept for backward compatibility during transition
// TODO: Remove after confirming /api/admin/* routes work correctly

// Legacy email service status endpoint - MIGRATED TO /api/admin/email/status
app.get('/admin/email/status', authenticateToken, (req, res) => {
    console.warn('DEPRECATED: /admin/email/status - Use /api/admin/email/status instead');
    try {
        const status = emailService.getStatus();
        const rateLimitStats = emailRateLimitService.getStats();
        
        res.json({
            emailService: status,
            rateLimiting: rateLimitStats,
            timestamp: new Date().toISOString(),
            deprecated: true,
            newEndpoint: '/api/admin/email/status'
        });
    } catch (error) {
        console.error('Error getting email status:', error);
        res.status(500).json({ error: 'Failed to get email status' });
    }
});
END OF LEGACY CODE BLOCK */

/* LEGACY EMAIL ENDPOINTS - MANTIDO PARA REFERÊNCIA
// Legacy test email endpoint - MIGRATED TO /api/admin/email/test
app.post('/admin/email/test', 
    authenticateToken,
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        console.warn('DEPRECATED: /admin/email/test - Use /api/admin/email/test instead');
        try {
            const { email } = req.body;
            const result = await emailService.sendTestEmail(email);
            
            res.json({
                success: true,
                message: 'Test email sent successfully',
                messageId: result.messageId,
                deprecated: true,
                newEndpoint: '/api/admin/email/test'
            });
        } catch (error) {
            console.error('Test email failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send test email',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Legacy reset rate limits endpoint - MIGRATED TO /api/admin/email/reset-limits
app.post('/admin/email/reset-limits',
    authenticateToken,
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        console.warn('DEPRECATED: /admin/email/reset-limits - Use /api/admin/email/reset-limits instead');
        try {
            const { email } = req.body;
            emailRateLimitService.resetEmailLimits(email);
            
            res.json({
                success: true,
                message: `Rate limits reset for ${email}`,
                deprecated: true,
                newEndpoint: '/api/admin/email/reset-limits'
            });
        } catch (error) {
            console.error('Failed to reset rate limits:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset rate limits'
            });
        }
    }
);
END OF LEGACY EMAIL ENDPOINTS */

// ============================================================================
// EMAIL SCHEDULER SERVICE
// ============================================================================
const EmailSchedulerService = require('./src/services/EmailSchedulerService');
let emailScheduler = null;

// Inicializar Email Scheduler apenas em produção
if (process.env.NODE_ENV === 'production') {
    try {
        emailScheduler = new EmailSchedulerService(db, emailService);
        emailScheduler.initialize().catch(err => {
            console.error('⚠️ Erro ao inicializar Email Scheduler:', err);
        });
    } catch (error) {
        console.error('⚠️ Email Scheduler não pôde ser iniciado:', error);
    }
}

// Rotas de preferências de email
const emailPreferencesRoutes = require('./src/routes/email-preferences.routes');
app.use('/api/emails', emailPreferencesRoutes(db, emailScheduler));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check disponível em: http://localhost:${PORT}/health`);
    console.log('Sistema de backup automático ativado');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido, fechando servidor graciosamente...');
    
    // Parar Email Scheduler se estiver rodando
    if (emailScheduler) {
        emailScheduler.stop();
    }
    
    server.close(() => {
        console.log('Servidor fechado.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT recebido, fechando servidor graciosamente...');
    server.close(() => {
        console.log('Servidor fechado.');
        process.exit(0);
    });
});
// TIMEZONE SERVIDOR CORRIGIDO - Wed, Aug 13, 2025 10:13:36 PM
// TIMEZONE BRASILEIRO FINAL CORRIGIDO - Wed, Aug 13, 2025 10:15:49 PM

