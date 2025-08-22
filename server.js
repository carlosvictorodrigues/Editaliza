// server.js - Versão com correções de segurança

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
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
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
require('dotenv').config();

// Import email services
const emailService = require('./src/services/emailService');
const { emailRateLimitService, createPasswordRecoveryRateLimit } = require('./src/services/emailRateLimitService');

// CACKTO INTEGRATION DISABLED - Causing database errors
// TODO: Re-enable after proper database migration
/*
// Importar integração CACKTO
const { 
    CacktoRoutes,
    initialize: initializeCackto,
    checkCacktoSubscription,
    requirePremiumFeature,
    addSubscriptionInfo
} = require('./src/cackto-integration');
*/

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
app.use(express.static(path.join(__dirname, 'public')));

// Servir arquivos específicos ainda no root (compatibilidade temporária)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

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
app.use(helmet({
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
            frameAncestors: ['\'none\''], // Clickjacking protection
            upgradeInsecureRequests: [], // Forçar HTTPS
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    // Adicionar headers de segurança extras
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

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

// Configuração de sessão (APENAS PostgreSQL - sem SQLite)
const sessionConfig = {
    store: new pgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'sessions'
    }),
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

app.post('/profile/upload-photo', authenticateToken, (req, res) => {
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
// app.use(authenticateToken, addSubscriptionInfo());

// WORKAROUND: Aplicar apenas autenticação sem subscription info
app.use('*', (req, res, next) => {
    // Pular autenticação para rotas públicas
    const publicPaths = ['/health', '/login.html', '/register.html', '/auth', '/api/webhooks'];
    if (publicPaths.some(path => req.path.includes(path)) || req.method === 'OPTIONS') {
        return next();
    }
    
    // Aplicar autenticação apenas para outras rotas
    authenticateToken(req, res, next);
});

// Rotas de webhook CACKTO (ANTES do rate limiting para APIs)
app.use('/api/webhooks', CacktoRoutes);

// Middleware para rotas que precisam de assinatura ativa
const requireActiveSubscription = checkCacktoSubscription({
    redirectToPlans: false,
    strict: true
});
*/

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

// CSRF Protection para rotas POST/PUT/DELETE (exceto auth pública)
app.use((req, res, next) => {
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
    const isAPIRoute = req.path.startsWith('/schedules') || req.path.startsWith('/plans') || req.path.startsWith('/users') || req.path.startsWith('/topics');
    const hasJWTAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    
    if (skipCSRF.includes(req.path) || req.method === 'GET' || (isAPIRoute && hasJWTAuth)) {
        return next();
    }
    
    return csrfProtection()(req, res, next);
});

// Body parsing com sanitização
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
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300, // Reduzido
    message: { 
        error: 'Muitas requisições. Por favor, tente novamente mais tarde.',
        code: 'RATE_LIMIT_GENERAL' 
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
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
               req.path.includes('/topics/'); // Qualquer rota de tópicos
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
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

// CORREÇÃO DE SEGURANÇA: Disponibilizar dbGet para middleware de admin
global.dbGet = dbGet;
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));

// --- ROTAS DE AUTENTICAÇÃO E USUÁRIO ---

// Rota para registrar um novo usuário
// LEGACY AUTH ROUTES - COMMENTED OUT (Now using modular /auth routes)
/*
app.post('/register', 
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
                res.status(400).json({ error: "Este e-mail já está em uso." });
            } else {
                console.error('Erro no registro:', error);
                res.status(500).json({ error: "Erro ao criar usuário." });
            }
        }
    }
);
*/

// ============================================================================
// MODULAR ROUTES - NEW ARCHITECTURE
// ============================================================================

// Import modular routes
const planRoutes = require('./src/routes/planRoutes');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const scheduleRoutes = require('./src/routes/scheduleRoutes');

// Use modular routes
app.use('/plans', planRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/schedules', scheduleRoutes);

// ============================================================================
// LEGACY ROUTES - TO BE REFACTORED
// ============================================================================

// Rota para login de usuário
app.post('/login', 
    loginLimiter,
    validators.email,
    validators.password,
    handleValidationErrors,
    async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
            if (!user) {
                return res.status(401).json({ 'error': 'E-mail ou senha inválidos.' });
            }
            
            // Check if user is a Google OAuth user
            if (user.auth_provider === 'google') {
                return res.status(401).json({ 
                    'error': 'Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.' 
                });
            }
            
            if (!await bcrypt.compare(password, user.password_hash)) {
                return res.status(401).json({ 'error': 'E-mail ou senha inválidos.' });
            }
            
            const token = jwt.sign(
                { id: user.id, email: user.email }, 
                process.env.JWT_SECRET, 
                { expiresIn: '24h', issuer: 'editaliza' }
            );
            
            req.session.userId = user.id;
            req.session.loginTime = new Date();
            
            res.json({ 'message': 'Login bem-sucedido!', 'token': token });
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ 'error': 'Erro no servidor.' });
        }
    }
);

// Google OAuth Routes
// Route to start Google OAuth
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback route
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html?error=oauth_failed' }),
    async (req, res) => {
        try {
            // Generate JWT token for the authenticated user
            const token = jwt.sign(
                { id: req.user.id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h', issuer: 'editaliza' }
            );
            
            // Set session data
            req.session.userId = req.user.id;
            req.session.loginTime = new Date();
            
            // CORREÇÃO DE SEGURANÇA: Usar session ao invés de token na URL
            // Anteriormente: res.redirect(`/home.html?auth_success=1&token=${token}`); // ❌ EXPUNHA TOKEN
            
            // Salvar token na sessão segura
            req.session.authToken = token;
            req.session.authSuccess = true;
            
            // Redirecionar sem expor token na URL
            res.redirect('/home.html?auth_success=1');
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('/login.html?error=oauth_callback_failed');
        }
    }
);

// CORREÇÃO DE SEGURANÇA: Endpoint seguro para recuperar token da sessão
app.get('/auth/session-token', (req, res) => {
    if (req.session.authSuccess && req.session.authToken) {
        // Retornar token uma única vez e limpar da sessão
        const token = req.session.authToken;
        req.session.authToken = null;
        req.session.authSuccess = null;
        
        res.json({ token, success: true });
    } else {
        res.status(401).json({ error: 'Nenhum token de sessão disponível' });
    }
});

// Endpoint para obter token CSRF (para testes e desenvolvimento)
app.get('/csrf-token', (req, res) => {
    // Gerar token CSRF se não existir na sessão
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    
    res.json({ 
        csrfToken: req.session.csrfToken,
        info: 'Use este token no header x-csrf-token para requisições POST/PUT/DELETE'
    });
});

// Route to check Google OAuth status (for debugging)
app.get('/auth/google/status', authenticateToken, (req, res) => {
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            auth_provider: req.user.auth_provider
        }
    });
});

// Rota para logout
app.post('/logout', authenticateToken, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.json({ message: 'Logout realizado com sucesso' });
    });
});

// Rota para solicitar redefinição de senha
app.post('/request-password-reset',
    createPasswordRecoveryRateLimit(), // Add rate limiting middleware
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        const { email } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        try {
            // Check rate limits for email and IP
            const rateLimitCheck = emailRateLimitService.checkLimits(email, clientIP);
            if (!rateLimitCheck.allowed) {
                return res.status(429).json({ 
                    error: rateLimitCheck.message,
                    retryAfter: rateLimitCheck.cooldownMinutes * 60 // Convert to seconds
                });
            }

            // Always record the attempt for rate limiting (prevents user enumeration)
            emailRateLimitService.recordEmailAttempt(email, clientIP);
            
            const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
            
            if (user) {
                // Check if user is a Google OAuth user
                if (user.auth_provider === 'google') {
                    return res.status(400).json({ 
                        error: 'Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.' 
                    });
                }
                
                // Generate secure reset token
                const token = crypto.randomBytes(32).toString('hex');
                const expires = Date.now() + 3600000; // 1 hour
                
                // Save token to database
                await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', 
                    [token, expires, user.id]);
                
                // Get base URL for links
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.headers['x-forwarded-host'] || req.get('host');
                const baseUrl = `${protocol}://${host}`;
                
                // Send password recovery email
                try {
                    const emailResult = await emailService.sendPasswordRecoveryEmail(
                        user.email, 
                        user.name, 
                        token, 
                        baseUrl
                    );
                    
                    console.log(`✅ Password recovery ${emailResult.simulated ? 'simulated' : 'sent'} for ${user.email}`);
                } catch (emailError) {
                    console.error('Email sending failed, but continuing with security response:', emailError.message);
                }
            }
            
            // Always return the same response to prevent user enumeration
            res.json({ 
                message: 'Se um usuário com este e-mail existir, um link de recuperação foi enviado.',
                info: 'Verifique sua caixa de entrada e spam. O link expira em 1 hora.'
            });
            
        } catch (error) {
            console.error('Erro na recuperação de senha:', error);
            res.status(500).json({ 
                error: 'Erro no servidor ao processar a solicitação.' 
            });
        }
    }
);

// Rota para redefinir a senha com um token
app.post('/reset-password',
    body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
    validators.password,
    handleValidationErrors,
    async (req, res) => {
        const { token, password } = req.body;
        try {
            const user = await dbGet('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?', [token, Date.now()]);
            if (!user) {
                return res.status(400).json({ error: 'Token inválido ou expirado.' });
            }
            const hashedPassword = await bcrypt.hash(password, 12);
            await dbRun('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
            res.json({ message: 'Senha redefinida com sucesso!' });
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            res.status(500).json({ 'error': 'Erro no servidor ao redefinir a senha.' });
        }
    }
);

// --- ROTAS DE PERFIL DO USUÁRIO ---
// Rota para obter dados do perfil do usuário logado
app.get('/profile', authenticateToken, async (req, res) => {
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
        res.status(500).json({ error: 'Erro ao carregar perfil do usuário.' });
    }
});

// Rota para atualizar dados do perfil (completo com todos os campos)
app.patch('/profile', 
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
            res.status(500).json({ error: 'Erro ao atualizar perfil do usuário.' });
        }
    }
);


// --- ROTAS DE TESTE E DEBUG ---
app.get('/test-db', authenticateToken, async (req, res) => {
    try {
        console.log(`[DEBUG TEST] Testando conexão do banco...`);
        
        // Teste 1: Query simples sem parâmetros
        const test1 = await dbAll('SELECT 1 as test');
        console.log(`[DEBUG TEST] Teste 1 (SELECT 1):`, test1);
        
        // Teste 2: Query com parâmetro
        const test2 = await dbAll('SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?', [req.user.id]);
        console.log(`[DEBUG TEST] Teste 2 (COUNT):`, test2);
        
        res.json({ test1, test2, userId: req.user.id });
    } catch (error) {
        console.error('[DEBUG TEST] Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- ROTAS DE PLANOS (CRUD E CONFIGURAÇÕES) ---
app.get('/plans', authenticateToken, async (req, res) => {
    try {
        console.log(`[PLANS] Usuário ID: ${req.user.id}`);
        
        const rows = await dbAll('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
        console.log(`[PLANS] Encontrados ${rows.length} planos`);
        
        // Processar dados de forma mais robusta
        const plans = rows.map(plan => {
            let studyHours = {};
            if (plan.study_hours_per_day) {
                try {
                    studyHours = JSON.parse(plan.study_hours_per_day);
                } catch (e) {
                    console.warn(`[PLANS] JSON parse error for plan ${plan.id}:`, e.message);
                    studyHours = {};
                }
            }
            
            return {
                ...plan,
                study_hours_per_day: studyHours
            };
        });
        
        console.log(`[PLANS] Enviando ${plans.length} planos`);
        res.json(plans);
        
    } catch (error) {
        console.error('[PLANS] Erro:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/plans', 
    authenticateToken,
    validators.text('plan_name', 1, 200),
    validators.date('exam_date'),
    handleValidationErrors,
    async (req, res) => {
        const { plan_name, exam_date } = req.body;
        const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
        const sql = `
            INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        try {
            const result = await dbRun(sql, [req.user.id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
            res.status(201).json({ 'message': 'Plano criado com sucesso!', 'newPlanId': result.lastID });
        } catch (error) {
            console.error('Erro ao criar plano:', error);
            res.status(500).json({ 'error': 'Erro ao criar plano' });
        }
    }
);

app.get('/plans/:id', 
    authenticateToken,
    validators.numericId('id'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const row = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            if (!row) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
            if (row.study_hours_per_day) {
                row.study_hours_per_day = JSON.parse(row.study_hours_per_day);
            }
            res.json(row);
        } catch (error) {
            console.error('Erro ao buscar plano:', error);
            res.status(500).json({ 'error': 'Erro ao buscar plano' });
        }
    }
);

app.delete('/plans/:planId', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou você não tem permissão.' });
            
            await dbRun('BEGIN');
            await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [planId]);
            await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', [planId]);
            await dbRun('DELETE FROM study_plans WHERE id = ?', [planId]);
            await dbRun('COMMIT');
            
            res.json({ message: 'Plano e todos os dados associados foram apagados com sucesso' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar plano:', error);
            res.status(500).json({ 'error': 'Erro ao apagar o plano.' });
        }
    }
);

app.patch('/plans/:planId/settings', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    body('reta_final_mode').isBoolean().withMessage('reta_final_mode deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const { daily_question_goal, weekly_question_goal, review_mode, session_duration_minutes, study_hours_per_day, has_essay, reta_final_mode } = req.body;
        const hoursJson = JSON.stringify(study_hours_per_day);
        
        const validReviewModes = ['completo', 'focado'];
        if (review_mode && !validReviewModes.includes(review_mode)) {
            return res.status(400).json({ error: 'Modo de revisão inválido' });
        }
        
        const sql = 'UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, review_mode = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ?, reta_final_mode = ? WHERE id = ? AND user_id = ?';
        try {
            const result = await dbRun(sql, [daily_question_goal, weekly_question_goal, review_mode || 'completo', session_duration_minutes, hoursJson, has_essay, reta_final_mode ? 1 : 0, req.params.planId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            res.json({ message: 'Configurações salvas com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            res.status(500).json({ 'error': 'Erro ao salvar configurações' });
        }
    }
);

// --- ROTAS DE DISCIPLINAS E TÓPICOS --- - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/subjects', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });
            
            const rows = await dbAll("SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY id DESC", [req.params.planId]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar disciplinas:', error);
            res.status(500).json({ "error": "Erro ao buscar disciplinas" });
        }
    }
); 
END LEGACY ROUTE COMMENT */

app.post('/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    body('topics_list').isString().isLength({ max: 10000 }).withMessage('Lista de tópicos muito longa'),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight, topics_list } = req.body;
        const planId = req.params.planId;
        
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

            const topics = topics_list.split('\n').map(t => t.trim()).filter(t => t !== '');
            
            await dbRun('BEGIN');
            const result = await dbRun('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)', [planId, subject_name, priority_weight]);
            const subjectId = result.lastID;
            
            if (topics.length > 0) {
                // Use dbRun for each topic insert instead of prepared statements
                // PostgreSQL handles this efficiently with connection pooling
                for (const topic of topics) {
                    // Tópicos novos recebem peso padrão 3, que pode ser editado depois
                    await dbRun('INSERT INTO topics (subject_id, description, priority_weight) VALUES (?,?,?)', 
                        [subjectId, topic.substring(0, 500), 3]);
                }
            }
            
            await dbRun('COMMIT');
            res.status(201).json({ message: 'Disciplina e tópicos adicionados com sucesso!' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao criar disciplina:', error);
            res.status(500).json({ 'error': 'Erro ao criar a disciplina e tópicos.' });
        }
    }
);

app.patch('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    handleValidationErrors,
    async (req, res) => {
        const { subject_name, priority_weight } = req.body;
        const sql = `
            UPDATE subjects SET subject_name = ?, priority_weight = ? 
            WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)
        `;
        try {
            const result = await dbRun(sql, [subject_name, priority_weight, req.params.subjectId, req.user.id]);
            if (result.changes === 0) return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });
            res.json({ message: 'Disciplina atualizada com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar disciplina:', error);
            res.status(500).json({ error: 'Erro ao atualizar disciplina' });
        }
    }
);

app.delete('/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        const subjectId = req.params.subjectId;
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });

            await dbRun('BEGIN');
            await dbRun('DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = ?)', [subjectId]);
            await dbRun('DELETE FROM topics WHERE subject_id = ?', [subjectId]);
            await dbRun('DELETE FROM subjects WHERE id = ?', [subjectId]);
            await dbRun('COMMIT');
            res.json({ message: 'Disciplina e todos os seus dados foram apagados com sucesso' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar disciplina:', error);
            res.status(500).json({ 'error': 'Erro ao apagar disciplina' });
        }
    }
);

app.get('/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const { planId } = req.params;
        const { id: userId } = req.user;

        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
            }

            const subjects = await dbAll('SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY id DESC', [planId]);
            const subjectIds = subjects.map(s => s.id);

            if (subjectIds.length === 0) {
                return res.json([]);
            }

            const topics = await dbAll(`
                SELECT id, subject_id, description, status, completion_date, priority_weight 
                FROM topics 
                WHERE subject_id IN (${subjectIds.map(() => '?').join(',')}) 
                ORDER BY id ASC
            `, subjectIds);

            const topicsBySubjectId = new Map();
            topics.forEach(topic => {
                // Normalizar tipo do peso para inteiro
                topic.priority_weight = parseInt(topic.priority_weight, 10) || 3;
                if (!topicsBySubjectId.has(topic.subject_id)) {
                    topicsBySubjectId.set(topic.subject_id, []);
                }
                topicsBySubjectId.get(topic.subject_id).push(topic);
            });

            const result = subjects.map(subject => ({
                ...subject,
                topics: topicsBySubjectId.get(subject.id) || []
            }));

            // Evitar cache para refletir rapidamente alterações
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.json(result);
        } catch (error) {
            console.error('Erro ao buscar disciplinas com tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao buscar disciplinas e tópicos' });
        }
    }
);

app.get('/subjects/:subjectId/topics', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const subject = await dbGet(`
                SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE s.id = ? AND sp.user_id = ?
            `, [req.params.subjectId, req.user.id]);
            if (!subject) return res.status(404).json({ error: 'Disciplina não encontrada ou não autorizada.' });

            const rows = await dbAll('SELECT id, description, status, completion_date, priority_weight FROM topics WHERE subject_id = ? ORDER BY id ASC', [req.params.subjectId]);
            rows.forEach(r => r.priority_weight = parseInt(r.priority_weight, 10) || 3);
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao buscar tópicos' });
        }
    }
);

app.patch('/topics/batch_update', 
    authenticateToken,
    body('topics').isArray().withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id').isInt().withMessage('ID do tópico inválido'),
    body('topics.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    body('topics.*.completion_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Data de conclusão inválida'),
    body('topics.*.description').optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 500 }).withMessage('Descrição do tópico inválida'),
    handleValidationErrors,
    async (req, res) => {
        const { topics } = req.body;

        try {
            await dbRun('BEGIN');
            
            for (const topic of topics) {
                const { id, status, completion_date, description } = topic;
                let { priority_weight } = topic;
                
                // Log para depurar o valor recebido
                if (priority_weight !== undefined) {
                    console.log(`[DEBUG] Recebido priority_weight para tópico ${id}:`, priority_weight, `(Tipo: ${typeof priority_weight})`);
                }

                // Validação manual e robusta para o peso do tópico
                if (priority_weight !== undefined) {
                    const parsedWeight = parseInt(priority_weight, 10);
                    if (isNaN(parsedWeight) || parsedWeight < 1 || parsedWeight > 5) {
                        console.error(`[VALIDATION] Peso de prioridade inválido para o tópico ${id}: recebido '${priority_weight}'. A atualização do peso será ignorada.`);
                        priority_weight = undefined; // Ignorar atualização deste campo
                    } else {
                        priority_weight = parsedWeight; // Usar o valor numérico validado
                    }
                }

                // Construir consulta dinâmica baseada nos campos presentes
                const updates = [];
                const values = [];
                
                if (status !== undefined) {
                    updates.push('status = ?');
                    values.push(status);
                }
                
                if (completion_date !== undefined) {
                    updates.push('completion_date = ?');
                    const completionDate = status === 'Concluído' ? completion_date : null;
                    values.push(completionDate);
                }
                
                if (description !== undefined && String(description).trim().length > 0) {
                    updates.push('description = ?');
                    values.push(String(description).trim());
                }
                
                if (priority_weight !== undefined) {
                    const parsed = parseInt(priority_weight, 10);
                    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                        updates.push('priority_weight = ?');
                        values.push(parsed);
                    }
                }
                
                if (updates.length === 0) {
                    continue; // Pular se não há nada para atualizar
                }
                
                values.push(id);
                values.push(req.user.id);
                
                const sql = `
                    UPDATE topics 
                    SET ${updates.join(', ')}
                    WHERE id = ? AND subject_id IN (
                        SELECT id FROM subjects WHERE study_plan_id IN (
                            SELECT id FROM study_plans WHERE user_id = ?
                        )
                    )
                `;
                
                const result = await dbRun(sql, values);
                console.log(`[DEBUG] Update tópico ${id}: fields=${updates.join(', ')}, values=${JSON.stringify(values)}; changes=${result.changes}`);
            }
            
            await dbRun('COMMIT');
            res.json({ message: 'Progresso dos tópicos atualizado com sucesso!' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos:', error);
            res.status(500).json({ 'error': 'Erro ao atualizar os tópicos.' });
        }
    }
);

app.patch('/topics/batch_update_details',
    authenticateToken,
    body('topics').isArray().withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id').isInt().withMessage('ID do tópico inválido'),
    body('topics.*.description').optional({ checkFalsy: true }).isString().isLength({ min: 1, max: 500 }).withMessage('Descrição do tópico inválida'),
    body('topics.*.priority_weight').optional().isInt({ min: 1, max: 5 }).withMessage('Peso do tópico deve estar entre 1 e 5'),
    handleValidationErrors,
    async (req, res) => {
        const { topics } = req.body;
        const userId = req.user.id;

        try {
            await dbRun('BEGIN');

            for (const topic of topics) {
                const { id, description, priority_weight } = topic;

                const updates = [];
                const values = [];

                if (description !== undefined && String(description).trim().length > 0) {
                    updates.push('description = ?');
                    values.push(String(description).trim());
                }
                if (priority_weight !== undefined) {
                    updates.push('priority_weight = ?');
                    values.push(priority_weight);
                }

                if (updates.length === 0) {
                    continue; 
                }

                values.push(id);
                values.push(userId);

                const sql = `
                    UPDATE topics
                    SET ${updates.join(', ')}
                    WHERE id = ? AND subject_id IN (
                        SELECT id FROM subjects WHERE study_plan_id IN (
                            SELECT id FROM study_plans WHERE user_id = ?
                        )
                    )
                `;

                const result = await dbRun(sql, values);
                console.log(`[DEBUG] Update tópico ${id} (details): fields=${updates.join(', ')}, values=${JSON.stringify(values)}; changes=${result.changes}`);
            }

            await dbRun('COMMIT');
            res.json({ message: 'Tópicos atualizados com sucesso!' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao atualizar tópicos em lote:', error);
            res.status(500).json({ 'error': 'Erro ao atualizar os tópicos.' });
        }
    }
);

app.patch('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    validators.text('description', 1, 500),
    body('priority_weight').optional().isInt({ min: 1, max: 5 }).withMessage('Peso deve ser um número entre 1 e 5'),
    handleValidationErrors,
    async (req, res) => {
        const { description, priority_weight } = req.body;
        
        let sql, params;
        if (priority_weight !== undefined) {
            sql = `
                UPDATE topics SET description = ?, priority_weight = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `;
            params = [description, priority_weight, req.params.topicId, req.user.id];
        } else {
            sql = `
                UPDATE topics SET description = ? 
                WHERE id = ? AND subject_id IN (
                    SELECT id FROM subjects WHERE study_plan_id IN (
                        SELECT id FROM study_plans WHERE user_id = ?
                    )
                )
            `;
            params = [description, req.params.topicId, req.user.id];
        }
        
        try {
            const result = await dbRun(sql, params);
            if (result.changes === 0) return res.status(404).json({ error: 'Tópico não encontrado ou não autorizado.' });
            res.json({ message: 'Tópico atualizado com sucesso!' });
        } catch (error) {
            console.error('Erro ao atualizar tópico:', error);
            res.status(500).json({ error: 'Erro ao atualizar tópico' });
        }
    }
);

app.delete('/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    handleValidationErrors,
    async (req, res) => {
        const topicId = req.params.topicId;
        try {
            console.log(`[DELETE_TOPIC] Tentando excluir tópico ${topicId} para usuário ${req.user.id}`);
            
            const topic = await dbGet(`
                SELECT t.id FROM topics t 
                JOIN subjects s ON t.subject_id = s.id
                JOIN study_plans sp ON s.study_plan_id = sp.id 
                WHERE t.id = ? AND sp.user_id = ?
            `, [topicId, req.user.id]);
            
            console.log(`[DELETE_TOPIC] Resultado da consulta:`, topic);
            
            if (!topic) {
                console.log(`[DELETE_TOPIC] Tópico ${topicId} não encontrado para usuário ${req.user.id}`);
                return res.status(404).json({ error: 'Tópico não encontrado ou não autorizado.' });
            }

            await dbRun('BEGIN');
            await dbRun('DELETE FROM study_sessions WHERE topic_id = ?', [topicId]);
            await dbRun('DELETE FROM topics WHERE id = ?', [topicId]);
            await dbRun('COMMIT');
            res.json({ message: 'Tópico e sessões associadas foram apagados com sucesso' });
        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('Erro ao apagar tópico:', error);
            res.status(500).json({ 'error': 'Erro ao apagar tópico' });
        }
    }
);

// --- ROTA DE GERAÇÃO DE CRONOGRAMA OTIMIZADA ---
app.post('/plans/:planId/generate', 
    authenticateToken,
    validators.numericId('planId'),
    validators.integer('daily_question_goal', 0, 500),
    validators.integer('weekly_question_goal', 0, 3500),
    validators.integer('session_duration_minutes', 10, 240),
    body('has_essay').isBoolean().withMessage('has_essay deve ser booleano'),
    body('reta_final_mode').isBoolean().withMessage('reta_final_mode deve ser booleano'),
    validators.jsonField('study_hours_per_day'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const { daily_question_goal, weekly_question_goal, session_duration_minutes, study_hours_per_day, has_essay, reta_final_mode } = req.body;
        
        console.time(`[PERF] Generate schedule for plan ${planId}`);
        const startTime = Date.now();
        
        // LOGS DETALHADOS PARA DEBUGGING
        console.log(`[CRONOGRAMA] Iniciando geração de cronograma para plano ${planId}`);
        console.log(`[CRONOGRAMA] Usuário: ${req.user.id}`);
        console.log(`[CRONOGRAMA] Parâmetros:`, {
            daily_question_goal,
            weekly_question_goal,
            session_duration_minutes,
            study_hours_per_day,
            has_essay,
            reta_final_mode
        });

        try {
            await dbRun('BEGIN');
            console.log(`[CRONOGRAMA] ✅ Transação iniciada para plano ${planId}`);
            
            const hoursJson = JSON.stringify(study_hours_per_day);
            console.log(`[CRONOGRAMA] ✅ Atualizando plano ${planId} com parâmetros`);
            await dbRun('UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ?, reta_final_mode = ? WHERE id = ? AND user_id = ?',
                [daily_question_goal, weekly_question_goal, session_duration_minutes, hoursJson, has_essay, reta_final_mode ? 1 : 0, planId, req.user.id]);
            console.log(`[CRONOGRAMA] ✅ Plano ${planId} atualizado com sucesso`);
            
            console.log(`[CRONOGRAMA] 🔍 Buscando plano ${planId} para usuário ${req.user.id}`);
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            console.log(`[CRONOGRAMA] 📋 Plano encontrado:`, plan ? `ID ${plan.id}, exam_date: ${plan.exam_date}` : 'Não encontrado');
            if (!plan) {
                await dbRun('ROLLBACK');
                return res.status(404).json({ error: 'Plano não encontrado.' });
            }

            const totalWeeklyHours = Object.values(study_hours_per_day).reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
            if (totalWeeklyHours === 0) {
                await dbRun('ROLLBACK');
                return res.status(400).json({ error: 'O cronograma não pode ser gerado porque não há horas de estudo definidas.' });
            }

            console.log(`[CRONOGRAMA] ✅ Removendo sessões antigas do plano ${planId}`);
            await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
            console.log(`[CRONOGRAMA] ✅ Sessões antigas removidas`);

            const allTopicsQuery = `
                SELECT 
                    t.id, t.description, t.status, t.completion_date,
                    s.subject_name, s.priority_weight as subject_priority,
                    COALESCE(t.priority_weight, 3) as topic_priority
                FROM subjects s
                INNER JOIN topics t ON s.id = t.subject_id
                WHERE s.study_plan_id = ?
                ORDER BY s.priority_weight DESC, COALESCE(t.priority_weight, 3) DESC, t.id ASC
            `;
            const allTopics = await dbAll(allTopicsQuery, [planId]);
            // Normalizar priority_weight possivelmente string para número seguro
            allTopics.forEach(t => {
                t.subject_priority = parseInt(t.subject_priority, 10) || 3;
                t.topic_priority = parseInt(t.topic_priority, 10) || 3;
            });

            if (allTopics.length === 0) {
                await dbRun('COMMIT');
                return res.json({ message: 'Nenhum tópico encontrado para gerar o cronograma.' });
            }
            
            const sessionDuration = parseInt(session_duration_minutes, 10) || 50;
            
            // Log para debug
            console.log('🔍 Gerando cronograma - Dados do plano:', {
                plan_id: planId,
                exam_date: plan.exam_date,
                exam_date_type: typeof plan.exam_date,
                exam_date_value: plan.exam_date
            });
            
            // Validação robusta da data de prova para evitar 500
            let examDateString = plan.exam_date;
            
            // Se exam_date é um objeto Date, converter para string
            if (plan.exam_date instanceof Date) {
                examDateString = plan.exam_date.toISOString().split('T')[0];
            } else if (typeof plan.exam_date === 'object' && plan.exam_date !== null) {
                // Se for um objeto com toISOString
                examDateString = new Date(plan.exam_date).toISOString().split('T')[0];
            }
            
            console.log('📅 Data da prova após conversão:', examDateString);
            
            if (!examDateString || isNaN(new Date(examDateString + 'T00:00:00').getTime())) {
                console.error('❌ Data da prova inválida:', examDateString);
                await dbRun('ROLLBACK');
                return res.status(400).json({ error: 'Defina a data da prova nas configurações do plano antes de gerar o cronograma.' });
            }
            const examDate = new Date(examDateString + 'T23:59:59');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const availableDatesCache = new Map();
            const getAvailableDates = (startDate, endDate, weekdayOnly = false) => {
                const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}`;
                if (availableDatesCache.has(cacheKey)) {
                    return availableDatesCache.get(cacheKey);
                }
                
                const dates = [];
                const currentDate = new Date(startDate);
                while (currentDate <= endDate) {
                    const dayOfWeek = currentDate.getDay();
                    const shouldSkip = (weekdayOnly && (dayOfWeek === 0 || dayOfWeek === 6));
                    
                    if (!shouldSkip && (study_hours_per_day[dayOfWeek] || 0) > 0) {
                        dates.push({
                            date: new Date(currentDate),
                            dayOfWeek,
                            maxSessions: Math.floor((study_hours_per_day[dayOfWeek] * 60) / sessionDuration)
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                availableDatesCache.set(cacheKey, dates);
                return dates;
            };

            const agenda = new Map();
            const addSessionToAgenda = (date, session) => {
                // Usar horário de Brasília corretamente
                const dateStr = date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
                if (!agenda.has(dateStr)) {
                    agenda.set(dateStr, []);
                }
                agenda.get(dateStr).push({ ...session, session_date: dateStr });
            };
            
            if (plan.has_essay) {
                const sundayDates = getAvailableDates(today, examDate).filter(d => d.dayOfWeek === 0);
                for (const dateInfo of sundayDates) {
                    addSessionToAgenda(dateInfo.date, {
                        topicId: null,
                        subjectName: 'Redação',
                        topicDescription: 'Prática de redação dissertativa-argumentativa, focando em estrutura, coesão e argumentação.',
                        sessionType: 'Redação'
                    });
                }
            }

            const findNextAvailableSlot = (startDate, isWeekdayOnly = false) => {
                const availableDates = getAvailableDates(startDate, examDate, isWeekdayOnly);
                for (const dateInfo of availableDates) {
                    // Usar horário de Brasília corretamente
                    const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
                    const currentSessions = agenda.get(dateStr)?.length || 0;
                    if (currentSessions < dateInfo.maxSessions) return dateInfo.date;
                }
                return null;
            };

            const getNextSaturdayForReview = (date) => {
                const saturdayDates = getAvailableDates(date, examDate).filter(d => d.dayOfWeek === 6);
                for (const dateInfo of saturdayDates) {
                    // Usar horário de Brasília corretamente
                    const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
                    if ((agenda.get(dateStr)?.length || 0) < dateInfo.maxSessions) return dateInfo.date;
                }
                return null;
            };

            const completedTopicsQuery = `
                SELECT t.id, t.description, t.completion_date, s.subject_name
                FROM topics t
                INNER JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = ? AND t.status = 'Concluído' AND t.completion_date IS NOT NULL
                ORDER BY t.completion_date DESC
            `;
            const completedTopics = await dbAll(completedTopicsQuery, [planId]);
            
            for (const topic of completedTopics) {
                const baseDate = new Date(topic.completion_date + 'T00:00:00');
                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(baseDate);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);
                    if (targetReviewDate >= today && targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: `Revisão ${days}D` });
                        }
                    }
                });
            }
            
            const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
            const availableSlots = getAvailableDates(today, examDate, true).reduce((sum, d) => sum + (parseInt(d.maxSessions, 10) || 0), 0);
            let topicsToSchedule = pendingTopics;
            let excludedTopics = [];
            let prioritizedSubjects = [];

            if (pendingTopics.length > availableSlots) {
                if (!plan.reta_final_mode) {
                    await dbRun('ROLLBACK');
                    return res.status(400).json({
                        error: `❌ CRONOGRAMA INVIÁVEL: ${pendingTopics.length} tópicos para apenas ${availableSlots} sessões. Ative o Modo Reta Final para priorizar as disciplinas mais importantes.`
                    });
                }

                // Combinar peso da disciplina e do tópico para priorização no modo reta final
                const sortedTopics = [...pendingTopics].sort((a, b) => {
                    const priorityA = (a.subject_priority * 10) + a.topic_priority;
                    const priorityB = (b.subject_priority * 10) + b.topic_priority;
                    return priorityB - priorityA;
                });
                topicsToSchedule = sortedTopics.slice(0, availableSlots);
                excludedTopics = sortedTopics.slice(availableSlots);

                const subjectsMap = new Map();
                topicsToSchedule.forEach(t => {
                    if (!subjectsMap.has(t.subject_name)) {
                        subjectsMap.set(t.subject_name, { name: t.subject_name, weight: t.subject_priority });
                    }
                });
                prioritizedSubjects = Array.from(subjectsMap.values());
            }

            // Se há exclusões, limpar registros antigos e salvar os novos
            if (excludedTopics.length > 0) {
                // Limpar registros antigos de ambas as tabelas
                await dbRun('DELETE FROM reta_final_exclusions WHERE study_plan_id = ?', [planId]);
                await dbRun('DELETE FROM reta_final_excluded_topics WHERE study_plan_id = ?', [planId]);
                
                for (const excludedTopic of excludedTopics) {
                    const priorityCombined = (excludedTopic.subject_priority * 10) + excludedTopic.topic_priority;
                    const reason = `Tópico excluído automaticamente no Modo Reta Final devido à falta de tempo. Prioridade combinada: ${priorityCombined.toFixed(2)}`;
                    
                    // CORREÇÃO CRÍTICA: Verificar se o topic_id é válido antes da inserção
                    try {
                        console.log(`[CRONOGRAMA] 🔍 Processando exclusão: ${excludedTopic.subject_name} - ${excludedTopic.description}`);
                        
                        // Verificar se o tópico existe na tabela topics
                        const topicExists = await dbGet('SELECT id FROM topics WHERE id = ?', [excludedTopic.id]);
                        
                        if (topicExists) {
                            console.log(`[CRONOGRAMA] ✅ Tópico ${excludedTopic.id} encontrado, inserindo em reta_final_exclusions`);
                            // Salvar na tabela legada (para compatibilidade) apenas se o tópico existir
                            await dbRun(
                                'INSERT INTO reta_final_exclusions (study_plan_id, topic_id, subject_name, topic_description, priority_combined) VALUES (?, ?, ?, ?, ?)',
                                [planId, excludedTopic.id, excludedTopic.subject_name, excludedTopic.description, priorityCombined]
                            );
                            console.log(`[CRONOGRAMA] ✅ Inserção em reta_final_exclusions concluída`);
                        } else {
                            console.warn(`[CRONOGRAMA] ⚠️ Tópico com ID ${excludedTopic.id} não encontrado na tabela topics, pulando inserção na reta_final_exclusions`);
                        }
                        
                        console.log(`[CRONOGRAMA] ✅ Inserindo em reta_final_excluded_topics`);
                        // Salvar na nova tabela com mais detalhes (não depende de FOREIGN KEY para topic_id)
                        await dbRun(
                            'INSERT INTO reta_final_excluded_topics (study_plan_id, subject_name, topic_name, importance, priority_weight, reason) VALUES (?, ?, ?, ?, ?, ?)',
                            [planId, excludedTopic.subject_name, excludedTopic.description, excludedTopic.topic_priority, priorityCombined, reason]
                        );
                        console.log(`[CRONOGRAMA] ✅ Inserção em reta_final_excluded_topics concluída`);
                        
                    } catch (insertError) {
                        console.error(`[CRONOGRAMA] ❌ ERRO CRÍTICO na inserção do tópico ${excludedTopic.id}:`, insertError.message);
                        console.error(`[CRONOGRAMA] ❌ Stack trace:`, insertError.stack);
                        throw insertError; // Re-throw para parar o processo e capturar onde está falhando
                    }
                }
            } else {
                // Se não há exclusões, limpar registros antigos de ambas as tabelas
                await dbRun('DELETE FROM reta_final_exclusions WHERE study_plan_id = ?', [planId]);
                await dbRun('DELETE FROM reta_final_excluded_topics WHERE study_plan_id = ?', [planId]);
            }

            // CORREÇÃO CRÍTICA: Algoritmo simplificado e robusto
            console.log(`[CRONOGRAMA] Iniciando distribuição de ${topicsToSchedule.length} tópicos`);
            
            // CORREÇÃO: Validar se há tópicos para processar
            if (!topicsToSchedule || topicsToSchedule.length === 0) {
                console.log('[CRONOGRAMA] Nenhum tópico pendente encontrado');
                await dbRun('COMMIT');
                console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
                return res.json({ message: 'Cronograma gerado com sucesso!' });
            }

            // ORDENAÇÃO SIMPLES POR PESO: (peso_disciplina × 10) + peso_assunto
            const sortedByPriority = [...topicsToSchedule].sort((a, b) => {
                // VALIDAÇÃO: Garantir que os objetos têm as propriedades necessárias
                if (!a || !b || !a.subject_name || !b.subject_name) {
                    console.warn('[CRONOGRAMA] Tópico inválido encontrado durante ordenação');
                    return 0;
                }
                
                const priorityA = ((a.subject_priority || 3) * 10) + (a.topic_priority || 3);
                const priorityB = ((b.subject_priority || 3) * 10) + (b.topic_priority || 3);
                console.log(`[CRONOGRAMA] ${a.subject_name}: ${priorityA} vs ${b.subject_name}: ${priorityB}`);
                return priorityB - priorityA; // Maior peso primeiro
            });
            
            // Adicionar tópicos na ordem de prioridade, mas com distribuição intercalada por disciplina
            const disciplineGroups = new Map();
            const uniquePendingTopicsInOrder = [];
            const seenTopics = new Set();
            sortedByPriority.forEach(topic => {
                // VALIDAÇÃO: Verificar se o tópico é válido antes de agrupá-lo
                if (!topic || !topic.subject_name || !topic.id) {
                    console.warn('[CRONOGRAMA] Tópico inválido ignorado durante agrupamento:', topic);
                    return;
                }
                
                if (!disciplineGroups.has(topic.subject_name)) {
                    disciplineGroups.set(topic.subject_name, []);
                }
                disciplineGroups.get(topic.subject_name).push(topic);
            });
            
            // Round-robin entre disciplinas, respeitando ordem de prioridade dentro de cada uma
            const disciplineNames = [...disciplineGroups.keys()].sort((a, b) => {
                // Ordenar disciplinas por peso (maior primeiro)
                const topicsA = disciplineGroups.get(a);
                const topicsB = disciplineGroups.get(b);
                const weightA = topicsA.length > 0 ? topicsA[0].subject_priority : 0;
                const weightB = topicsB.length > 0 ? topicsB[0].subject_priority : 0;
                return weightB - weightA;
            });
            
            console.log(`[CRONOGRAMA] Distribuindo tópicos entre ${disciplineNames.length} disciplinas: ${disciplineNames.join(', ')}`);
            
            // Intercalar tópicos entre disciplinas
            const disciplineTopicsArrays = [...disciplineGroups.values()];
            
            // VALIDAÇÃO: Verificar se há disciplinas válidas
            if (disciplineTopicsArrays.length === 0) {
                console.error('[CRONOGRAMA] Nenhuma disciplina válida encontrada após agrupamento');
                await dbRun('ROLLBACK');
                return res.status(500).json({ error: 'Erro na organização dos tópicos por disciplina' });
            }
            
            const maxTopicsInAnyDiscipline = Math.max(...disciplineTopicsArrays.map(topics => topics.length));
            
            for (let round = 0; round < maxTopicsInAnyDiscipline; round++) {
                for (const disciplineName of disciplineNames) {
                    const disciplineTopics = disciplineGroups.get(disciplineName);
                    if (disciplineTopics && round < disciplineTopics.length) {
                        const topic = disciplineTopics[round];
                        
                        // VALIDAÇÃO: Verificar se o tópico é válido antes de adicioná-lo
                        if (topic && topic.id && !seenTopics.has(topic.id)) {
                            uniquePendingTopicsInOrder.push(topic);
                            seenTopics.add(topic.id);
                            
                            const description = topic.description ? topic.description.substring(0, 40) : 'Sem descrição';
                            console.log(`[CRONOGRAMA] Adicionado (round ${round + 1}): ${topic.subject_name} - ${description}...`);
                        }
                    }
                }
            }
            
            console.log(`[CRONOGRAMA] Distribuição final: ${uniquePendingTopicsInOrder.length} tópicos ordenados`);
            
            // VALIDAÇÃO FINAL: Verificar se há tópicos para agendar
            if (uniquePendingTopicsInOrder.length === 0) {
                console.log('[CRONOGRAMA] Nenhum tópico válido encontrado para agendamento');
                await dbRun('COMMIT');
                console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
                return res.json({ message: 'Cronograma gerado com sucesso!' });
            }

            let currentDateForNewTopics = new Date(today);
            let lastNewTopicDate = null;

            for (const topic of uniquePendingTopicsInOrder) {
                const studyDay = findNextAvailableSlot(currentDateForNewTopics, true);
                if (!studyDay) break;

                addSessionToAgenda(studyDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: 'Novo Tópico' });

                lastNewTopicDate = new Date(studyDay);
                currentDateForNewTopics = new Date(studyDay);

                [7, 14, 28].forEach(days => {
                    const targetReviewDate = new Date(studyDay);
                    targetReviewDate.setDate(targetReviewDate.getDate() + days);
                    if (targetReviewDate <= examDate) {
                        const reviewDay = getNextSaturdayForReview(targetReviewDate);
                        if (reviewDay) {
                            addSessionToAgenda(reviewDay, { topicId: topic.id, subjectName: topic.subject_name, topicDescription: topic.description, sessionType: `Revisão ${days}D` });
                        }
                    }
                });
            }
            
            const maintenanceStartDate = lastNewTopicDate ? new Date(lastNewTopicDate) : new Date(today);
            maintenanceStartDate.setDate(maintenanceStartDate.getDate() + 1);
            
            const hasPendingNewTopics = pendingTopics.length > 0;
            
            if (!hasPendingNewTopics) {
                console.log(`[CRONOGRAMA] Todas as matérias foram cobertas. Iniciando fase de simulados...`);
                
                const subjectTopicsMap = new Map();
                
                allTopics.forEach(topic => {
                    if (!subjectTopicsMap.has(topic.subject_name)) {
                        subjectTopicsMap.set(topic.subject_name, []);
                    }
                    subjectTopicsMap.get(topic.subject_name).push(topic.description);
                });
                
                const currentSimDate = new Date(maintenanceStartDate);
                currentSimDate.setDate(currentSimDate.getDate() + 3); 
                
                const progressPercentage = (completedTopics.length / allTopics.length);

                // CORREÇÃO: Simulados direcionados só após todo conteúdo ser abordado (100% de cobertura)
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    const subjectCompletionMap = new Map();
                    
                    allTopics.forEach(topic => {
                        if (!subjectCompletionMap.has(topic.subject_name)) {
                            subjectCompletionMap.set(topic.subject_name, { completed: [], total: 0 });
                        }
                        const subjectData = subjectCompletionMap.get(topic.subject_name);
                        subjectData.total++;
                        if (topic.status === 'Concluído') {
                            subjectData.completed.push(topic.description);
                        }
                    });
                    
                    const subjectsReadyForSim = Array.from(subjectCompletionMap.entries())
                        .filter(([subject, data]) => data.completed.length >= 2)
                        .sort(([, dataA], [, dataB]) => dataB.completed.length - dataA.completed.length);
                    
                    let currentDirectedSimDate = new Date(maintenanceStartDate);
                    
                    for (const [subjectName, subjectData] of subjectsReadyForSim) {
                        const completedTopics = subjectData.completed;
                        
                        const topicGroups = [];
                        for (let i = 0; i < completedTopics.length; i += 4) {
                            topicGroups.push(completedTopics.slice(i, i + 4));
                        }
                        
                        for (let groupIndex = 0; groupIndex < topicGroups.length; groupIndex++) {
                            const topicGroup = topicGroups[groupIndex];
                            const nextSimulatedDay = findNextAvailableSlot(currentDirectedSimDate, false);
                            if (!nextSimulatedDay) break;
                            
                            const groupNumber = topicGroups.length > 1 ? ` - Bloco ${groupIndex + 1}` : '';
                            const topicList = topicGroup.map(topic => `• ${topic}`).join('\n');
                            const simuladoDescription = `Simulado direcionado focado em ${subjectName}${groupNumber}:\n\n${topicList}\n\nEste simulado aborda especificamente estes tópicos já estudados. Teste sua retenção e aplicação prática dos conceitos.`;
                            
                            addSessionToAgenda(nextSimulatedDay, { 
                                topicId: null, 
                                subjectName: `Simulado Direcionado - ${subjectName}`, 
                                topicDescription: simuladoDescription, 
                                sessionType: 'Simulado Direcionado' 
                            });
                            
                            currentDirectedSimDate = new Date(nextSimulatedDay);
                            currentDirectedSimDate.setDate(currentDirectedSimDate.getDate() + 3); 
                        }
                    }
                }
                
                // Simulados completos só após todo conteúdo ser abordado
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    const basicCompleteSimDate = new Date(maintenanceStartDate);
                    basicCompleteSimDate.setDate(basicCompleteSimDate.getDate() + 7); 
                    const basicCompleteSlot = findNextAvailableSlot(basicCompleteSimDate, false);
                    if (basicCompleteSlot) {
                        addSessionToAgenda(basicCompleteSlot, {
                            topicId: null,
                            subjectName: 'Simulado Completo', 
                            topicDescription: 'Simulado geral abrangendo todas as disciplinas do concurso. Uma excelente oportunidade de testar seus conhecimentos em um formato similar ao da prova real.', 
                            sessionType: 'Simulado Completo' 
                        });
                    }
                }
                
                // Simulados gerais só após todo conteúdo ser abordado
                if (pendingTopics.length === 0 && progressPercentage >= 0.95) {
                    let nextMaintenanceDay = new Date(maintenanceStartDate);
                    nextMaintenanceDay.setDate(nextMaintenanceDay.getDate() + 5); 
                    
                    const simuladoFrequency = 3; // Frequência fixa quando todo conteúdo foi abordado
                    
                    let simuladoCount = 0;
                    const maxSimulados = 20; // Máximo de simulados quando todo conteúdo foi abordado
                    
                    while(simuladoCount < maxSimulados) {
                        nextMaintenanceDay = findNextAvailableSlot(nextMaintenanceDay, false);
                        if (!nextMaintenanceDay) break;
                        
                        const simuladoDescription = 'Simulado completo cobrindo todos os tópicos do edital. Foque em tempo, estratégia e resistência. Esta é sua preparação final!';
                        
                        addSessionToAgenda(nextMaintenanceDay, { 
                            topicId: null, 
                            subjectName: 'Simulado Completo', 
                            topicDescription: simuladoDescription, 
                            sessionType: 'Simulado Completo' 
                        });
                        
                        nextMaintenanceDay.setDate(nextMaintenanceDay.getDate() + simuladoFrequency);
                        simuladoCount++;
                    }
                }
            }

            const sessionsToCreate = Array.from(agenda.values()).flat();
            
            console.log(`[PERF] Creating ${sessionsToCreate.length} sessions in batch`);

            if (sessionsToCreate.length > 0) {
                // CORREÇÃO CRÍTICA: Pre-validar todos os topic_ids antes da inserção em batch
                console.log('[CRONOGRAMA] Validando topic_ids antes da inserção...');
                
                // Coletar todos os topic_ids únicos que não são null
                const uniqueTopicIds = [...new Set(
                    sessionsToCreate
                        .map(s => s.topicId)
                        .filter(id => id !== null && id !== undefined)
                )];
                
                // Verificar quais topic_ids existem
                const validTopicIds = new Set();
                if (uniqueTopicIds.length > 0) {
                    const placeholders = uniqueTopicIds.map(() => '?').join(',');
                    const existingTopics = await dbAll(`SELECT id FROM topics WHERE id IN (${placeholders})`, uniqueTopicIds);
                    existingTopics.forEach(topic => validTopicIds.add(topic.id));
                    
                    console.log(`[CRONOGRAMA] Dos ${uniqueTopicIds.length} topic_ids únicos, ${validTopicIds.size} são válidos`);
                }
                
                const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
                
                const BATCH_SIZE = 100;
                for (let i = 0; i < sessionsToCreate.length; i += BATCH_SIZE) {
                    const chunk = sessionsToCreate.slice(i, i + BATCH_SIZE);
                    for (const sessionData of chunk) {
                        // Validar topic_id usando o cache de IDs válidos
                        let validTopicId = sessionData.topicId;
                        
                        if (validTopicId !== null && validTopicId !== undefined) {
                            if (!validTopicIds.has(validTopicId)) {
                                console.warn(`[CRONOGRAMA] Topic ID ${validTopicId} não encontrado, definindo como null`);
                                validTopicId = null;
                            }
                        }
                        
                        try {
                            // Use dbRun instead of prepared statement
                            await dbRun(
                                insertSql,
                                [
                                    planId,
                                    validTopicId,
                                    String(sessionData.subjectName || '').substring(0, 200),
                                    String(sessionData.topicDescription || '').substring(0, 500),
                                    sessionData.session_date,
                                    sessionData.sessionType,
                                    'Pendente'
                                ]
                            );
                        } catch (sessionError) {
                            console.error(`[CRONOGRAMA] ❌ ERRO na inserção de sessão:`, {
                                planId,
                                validTopicId,
                                subjectName: sessionData.subjectName,
                                sessionType: sessionData.sessionType,
                                error: sessionError.message
                            });
                            throw sessionError;
                        }
                    }
                }
            }
            
            await dbRun('COMMIT');
            
            const endTime = Date.now();
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            console.log(`[PERF] Total execution time: ${endTime - startTime}ms`);
            console.log(`[PERF] Sessions created: ${sessionsToCreate.length}`);

            res.json({
                message: `Seu mapa para a aprovação foi traçado com sucesso. 🗺️`,
                performance: {
                    executionTime: `${endTime - startTime}ms`,
                    sessionsCreated: sessionsToCreate.length,
                    topicsProcessed: allTopics.length
                },
                retaFinal: {
                    isActive: !!plan.reta_final_mode,
                    excludedTopics: excludedTopics.map(t => ({
                        subject_name: t.subject_name,
                        topic_name: t.description,
                        importance: t.topic_priority,
                        priority_weight: (t.subject_priority * 10) + t.topic_priority,
                        reason: `Tópico excluído automaticamente no Modo Reta Final devido à falta de tempo. Prioridade combinada: ${((t.subject_priority * 10) + t.topic_priority).toFixed(2)}`
                    })),
                    prioritizedSubjects,
                    totalExcluded: excludedTopics.length,
                    totalIncluded: topicsToSchedule.length,
                    message: excludedTopics.length > 0 ? 
                        `⚠️ ${excludedTopics.length} tópicos foram excluídos para adequar o cronograma ao tempo disponível. Consulte os detalhes na aba Transparência.` :
                        '✅ Todos os tópicos puderam ser incluídos no cronograma.'
                }
            });

        } catch (error) {
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                console.error('[CRONOGRAMA] Erro ao fazer rollback:', rollbackError);
            }
            
            // LOGS DETALHADOS PARA DEBUGGING
            console.error('[CRONOGRAMA] ⚠️ ERRO CAPTURADO - Linha exata:', error.stack?.split('\n')[1]?.trim());
            console.error('[CRONOGRAMA] Erro ao gerar cronograma para plano:', planId);
            console.error('[CRONOGRAMA] Detalhes do erro:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                errno: error.errno,
                planId: planId,
                userId: req.user.id,
                timestamp: new Date().toISOString()
            });
            
            // Log dos parâmetros recebidos para análise
            console.error('[CRONOGRAMA] Parâmetros recebidos:', {
                daily_question_goal,
                weekly_question_goal,
                session_duration_minutes,
                study_hours_per_day,
                has_essay,
                reta_final_mode
            });
            
            console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
            
            // Retornar erro mais detalhado em desenvolvimento
            if (process.env.NODE_ENV === 'development') {
                res.status(500).json({ 
                    error: 'Ocorreu um erro interno no servidor ao gerar o cronograma.',
                    debug: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            } else {
                res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao gerar o cronograma.' });
            }
        }
    }
);

// --- ROTAS DE SESSÕES E DADOS ---

// Obter detalhes do replanejamento de tarefas atrasadas
app.get('/plans/:planId/replan-preview', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

            const todayStr = getBrazilianDateString();
            const overdueSessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\' AND session_date < ? ORDER BY session_date, id', [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return res.json({ 
                    hasOverdue: false,
                    message: 'Nenhuma tarefa atrasada encontrada.' 
                });
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // OTIMIZAÇÃO: Cache único para contagens de sessões por data
            const endDateStr = examDate.toISOString().split('T')[0];
            const sessionCountsQuery = `
                SELECT session_date, COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_date BETWEEN ? AND ?
                GROUP BY session_date
            `;
            const sessionCountsResult = await dbAll(sessionCountsQuery, [planId, todayStr, endDateStr]);
            
            // Criar mapa para acesso O(1)
            const sessionCountsCache = new Map();
            sessionCountsResult.forEach(row => {
                sessionCountsCache.set(row.session_date, row.count);
            });

            // Simular estratégia inteligente de replanejamento para preview
            const replanPreview = [];
            
            // Buscar sessões futuras por matéria para inserção inteligente
            const futureSessions = await dbAll(`
                SELECT * FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? 
                ORDER BY session_date, id
            `, [planId, todayStr]);

            const futureSessionsBySubject = {};
            futureSessions.forEach(session => {
                if (!futureSessionsBySubject[session.subject_name]) {
                    futureSessionsBySubject[session.subject_name] = [];
                }
                futureSessionsBySubject[session.subject_name].push(session);
            });

            // Função auxiliar para encontrar slot disponível no preview
            const findAvailableSlotPreview = (startDate, skipDate = null) => {
                const currentDate = new Date(startDate);
                while (currentDate <= examDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    if (dayOfWeek === 0 || (skipDate && dateStr === skipDate)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    const currentSessionCount = sessionCountsCache.get(dateStr) || 0;

                    if (totalMinutes > 0 && currentSessionCount < maxSessions) {
                        return currentDate;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
                return null;
            };

            // Agrupar sessões atrasadas por matéria
            const sessionsBySubject = {};
            overdueSessions.forEach(session => {
                if (!sessionsBySubject[session.subject_name]) {
                    sessionsBySubject[session.subject_name] = [];
                }
                sessionsBySubject[session.subject_name].push(session);
            });

            // Simular estratégia inteligente para cada matéria
            for (const [subject, sessions] of Object.entries(sessionsBySubject)) {
                const futureSessionsOfSubject = futureSessionsBySubject[subject] || [];
                
                for (const session of sessions) {
                    let newDate = null;
                    let strategy = '';
                    
                    // ESTRATÉGIA 1: Tentar inserir antes da próxima sessão da mesma matéria
                    if (futureSessionsOfSubject.length > 0) {
                        const nextSessionDate = new Date(futureSessionsOfSubject[0].session_date);
                        const insertDate = new Date(nextSessionDate);
                        insertDate.setDate(insertDate.getDate() - 1);
                        
                        const slot = findAvailableSlotPreview(insertDate > new Date() ? insertDate : new Date());
                        if (slot && slot < nextSessionDate) {
                            newDate = slot;
                            strategy = 'Inserida antes da próxima sessão da matéria';
                        }
                    }
                    
                    // ESTRATÉGIA 2: Encontrar próximo slot disponível
                    if (!newDate) {
                        newDate = findAvailableSlotPreview(new Date());
                        strategy = 'Próximo slot disponível';
                    }
                    
                    if (newDate) {
                        const dateStr = newDate.toISOString().split('T')[0];
                        replanPreview.push({
                            sessionId: session.id,
                            topic: session.topic_description,
                            subject: session.subject_name,
                            sessionType: session.session_type,
                            originalDate: session.session_date,
                            newDate: dateStr,
                            newDateFormatted: newDate.toLocaleDateString('pt-BR', { 
                                weekday: 'long', 
                                day: '2-digit', 
                                month: 'long' 
                            }),
                            strategy: strategy
                        });
                        
                        // Atualizar cache para próximas simulações
                        const currentCount = sessionCountsCache.get(dateStr) || 0;
                        sessionCountsCache.set(dateStr, currentCount + 1);
                    }
                }
            }

            res.json({
                hasOverdue: true,
                count: overdueSessions.length,
                strategy: 'Redistribuição Inteligente',
                description: 'As tarefas atrasadas serão reagendadas de forma inteligente: preferencialmente antes das próximas sessões da mesma matéria, preservando a continuidade do aprendizado.',
                replanPreview: replanPreview.slice(0, 5), // Mostrar apenas primeiras 5
                totalToReplan: replanPreview.length,
                examDate: plan.exam_date,
                daysUntilExam: Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24))
            });

        } catch (error) {
            console.error('Erro ao gerar preview de replanejamento:', error);
            res.status(500).json({ error: 'Erro ao analisar tarefas atrasadas.' });
        }
    }
);

// Replanejar tarefas atrasadas com estratégia inteligente
app.post('/plans/:planId/replan', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

            const todayStr = getBrazilianDateString();
            const overdueSessions = await dbAll('SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\' AND session_date < ? ORDER BY session_date, id', [planId, todayStr]);
            
            if (overdueSessions.length === 0) {
                return res.json({ 
                    success: true, 
                    message: 'Nenhuma tarefa atrasada para replanejar.' 
                });
            }

            const sessionDuration = plan.session_duration_minutes || 50;
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // Função para encontrar próximo slot disponível com segurança
            const findNextAvailableSlot = async (startDate, skipDate = null, maxDaysSearch = 365) => {
                const currentDate = new Date(startDate);
                let daysSearched = 0;
                
                while (currentDate <= examDate && daysSearched < maxDaysSearch) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const dayOfWeek = currentDate.getDay();

                    // Pula domingos ou data específica se fornecida
                    if (dayOfWeek === 0 || (skipDate && dateStr === skipDate)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        daysSearched++;
                        continue;
                    }

                    const totalMinutes = (studyHoursPerDay[dayOfWeek] || 0) * 60;
                    const maxSessions = Math.floor(totalMinutes / sessionDuration);
                    
                    // Segurança: verificar se há estudo neste dia
                    if (maxSessions <= 0) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        daysSearched++;
                        continue;
                    }
                    
                    const currentSessionCountResult = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                    const currentSessionCount = currentSessionCountResult.count;

                    if (currentSessionCount < maxSessions) {
                        return { 
                            date: currentDate, 
                            availableSlots: maxSessions - currentSessionCount,
                            dayOfWeek: dayOfWeek
                        };
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                    daysSearched++;
                }
                return null;
            };

            // Estratégia inteligente de replanejamento
            const smartReplan = async () => {
                console.log(`[REPLAN] Iniciando replanejamento inteligente para ${overdueSessions.length} sessões atrasadas`);
                
                // Cache de sessões por data para performance
                const sessionDateCache = new Map();
                const loadSessionsForDate = async (dateStr) => {
                    if (!sessionDateCache.has(dateStr)) {
                        const sessions = await dbAll('SELECT id, subject_name FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, dateStr]);
                        sessionDateCache.set(dateStr, sessions);
                    }
                    return sessionDateCache.get(dateStr);
                };
                
                // Agrupar sessões atrasadas por matéria e tipo (priorizar sessões de estudo inicial)
                const sessionsBySubject = {};
                overdueSessions.forEach(session => {
                    if (!sessionsBySubject[session.subject_name]) {
                        sessionsBySubject[session.subject_name] = [];
                    }
                    sessionsBySubject[session.subject_name].push(session);
                });
                
                // Ordenar por prioridade: sessões de estudo inicial primeiro, depois revisões
                Object.keys(sessionsBySubject).forEach(subject => {
                    sessionsBySubject[subject].sort((a, b) => {
                        const priorityOrder = {'Estudo Inicial': 1, 'Primeira Revisão': 2, 'Segunda Revisão': 3, 'Revisão Final': 4};
                        return (priorityOrder[a.session_type] || 5) - (priorityOrder[b.session_type] || 5);
                    });
                });

                // Buscar sessões futuras por matéria para inserção inteligente
                const futureSessions = await dbAll(`
                    SELECT * FROM study_sessions 
                    WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? 
                    ORDER BY session_date, id
                `, [planId, todayStr]);

                const futureSessionsBySubject = {};
                futureSessions.forEach(session => {
                    if (!futureSessionsBySubject[session.subject_name]) {
                        futureSessionsBySubject[session.subject_name] = [];
                    }
                    futureSessionsBySubject[session.subject_name].push(session);
                });

                let rescheduledCount = 0;
                const failedSessions = [];
                const reschedulingLog = [];

                // Processar cada matéria com segurança
                for (const [subject, sessions] of Object.entries(sessionsBySubject)) {
                    console.log(`[REPLAN] Processando ${sessions.length} sessões da matéria: ${subject}`);
                    
                    const futureSessionsOfSubject = futureSessionsBySubject[subject] || [];
                    
                    for (const session of sessions) {
                        let rescheduled = false;
                        let strategy = '';
                        
                        // SEGURANÇA: Verificar se a sessão ainda existe e está pendente
                        const sessionExists = await dbGet('SELECT id, status FROM study_sessions WHERE id = ? AND status = "Pendente"', [session.id]);
                        if (!sessionExists) {
                            console.log(`[REPLAN] ⚠ Sessão ${session.id} não existe ou não está pendente - ignorando`);
                            continue;
                        }
                        
                        // ESTRATÉGIA 1: Tentar inserir antes da próxima sessão da mesma matéria
                        if (futureSessionsOfSubject.length > 0) {
                            const nextSessionDate = new Date(futureSessionsOfSubject[0].session_date);
                            const searchStartDate = new Date();
                            
                            // Buscar slot entre hoje e a próxima sessão da matéria
                            const slot = await findNextAvailableSlot(searchStartDate);
                            if (slot && slot.date < nextSessionDate) {
                                const newDateStr = slot.date.toISOString().split('T')[0];
                                
                                // Verificar se não há sobrecarga da mesma matéria no mesmo dia
                                const sessionsOnDate = await loadSessionsForDate(newDateStr);
                                const sameSubjectCount = sessionsOnDate.filter(s => s.subject_name === session.subject_name).length;
                                
                                // Máximo 2 sessões da mesma matéria por dia para evitar fadiga
                                if (sameSubjectCount < 2) {
                                    await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                    sessionDateCache.get(newDateStr).push({id: session.id, subject_name: session.subject_name});
                                    rescheduled = true;
                                    strategy = 'inserida antes da próxima sessão';
                                    rescheduledCount++;
                                    reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy})`);
                                    console.log(`[REPLAN] ✓ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                                }
                            }
                        }
                        
                        // ESTRATÉGIA 2: Encontrar próximo slot disponível com balanceamento
                        if (!rescheduled) {
                            let currentSearchDate = new Date();
                            let attempts = 0;
                            const maxAttempts = 30; // Procurar por até 30 dias
                            
                            while (attempts < maxAttempts && !rescheduled) {
                                const slot = await findNextAvailableSlot(currentSearchDate);
                                if (slot) {
                                    const newDateStr = slot.date.toISOString().split('T')[0];
                                    const sessionsOnDate = await loadSessionsForDate(newDateStr);
                                    const sameSubjectCount = sessionsOnDate.filter(s => s.subject_name === session.subject_name).length;
                                    
                                    // Preferir dias com menor concentração da mesma matéria
                                    if (sameSubjectCount < 2) {
                                        await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                        sessionDateCache.get(newDateStr).push({id: session.id, subject_name: session.subject_name});
                                        rescheduled = true;
                                        strategy = 'próximo slot balanceado';
                                        rescheduledCount++;
                                        reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy})`);
                                        console.log(`[REPLAN] ✓ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                                    } else {
                                        // Pular para o próximo dia se já há muitas sessões da mesma matéria
                                        currentSearchDate = new Date(slot.date);
                                        currentSearchDate.setDate(currentSearchDate.getDate() + 1);
                                        attempts++;
                                    }
                                } else {
                                    break; // Não há mais slots disponíveis
                                }
                            }
                        }
                        
                        // ESTRATÉGIA 3: Se ainda não conseguiu, verificar se há espaço no final do cronograma
                        if (!rescheduled) {
                            // Procurar nos últimos dias antes do exame
                            const examMinusWeek = new Date(examDate);
                            examMinusWeek.setDate(examMinusWeek.getDate() - 7);
                            
                            const lateSlot = await findNextAvailableSlot(examMinusWeek);
                            if (lateSlot) {
                                const newDateStr = lateSlot.date.toISOString().split('T')[0];
                                await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, session.id]);
                                rescheduled = true;
                                strategy = 'slot de emergência próximo ao exame';
                                rescheduledCount++;
                                reschedulingLog.push(`${session.subject_name}: ${session.topic_description} → ${newDateStr} (${strategy} - ATENÇÃO!)`);
                                console.log(`[REPLAN] ⚠ Sessão ${session.id} reagendada para ${newDateStr} (${strategy})`);
                            }
                        }
                        
                        if (!rescheduled) {
                            failedSessions.push({
                                ...session,
                                reason: 'Sem slots disponíveis até o exame'
                            });
                            console.log(`[REPLAN] ✗ Não foi possível reagendar sessão ${session.id} - sem slots disponíveis`);
                        }
                    }
                }

                return { rescheduledCount, failedSessions, reschedulingLog };
            };
            
            await dbRun('BEGIN');
            
            const result = await smartReplan();
            
            // Atualizar contador de replanejamentos
            await dbRun('UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?', [planId]);
            
            await dbRun('COMMIT');
            
            // Log detalhado para debugging
            console.log(`[REPLAN] Resultado:`);
            console.log(`- Sessions reagendadas: ${result.rescheduledCount}/${overdueSessions.length}`);
            console.log(`- Sessions não reagendadas: ${result.failedSessions.length}`);
            result.reschedulingLog.forEach(log => console.log(`  - ${log}`));
            
            // Preparar mensagem detalhada baseada no resultado
            let message = '';
            if (result.rescheduledCount === overdueSessions.length) {
                message = `✅ Todas as ${result.rescheduledCount} tarefas atrasadas foram replanejadas com sucesso!`;
            } else if (result.rescheduledCount > 0) {
                message = `⚠ ${result.rescheduledCount} de ${overdueSessions.length} tarefas foram replanejadas. ${result.failedSessions.length} tarefas não puderam ser reagendadas por falta de espaço até o exame.`;
            } else {
                message = `❌ Nenhuma tarefa pôde ser replanejada. Considere estender sua data de exame ou aumentar suas horas diárias de estudo.`;
            }
            
            // Retornar resposta detalhada
            res.json({ 
                success: result.rescheduledCount > 0, // Sucesso se pelo menos uma sessão foi reagendada
                message,
                details: {
                    rescheduled: result.rescheduledCount,
                    failed: result.failedSessions.length,
                    total: overdueSessions.length,
                    successRate: Math.round((result.rescheduledCount / overdueSessions.length) * 100),
                    log: result.reschedulingLog.slice(0, 8), // Mostrar primeiros 8 para dar mais detalhes
                    failedReasons: result.failedSessions.slice(0, 3).map(s => ({
                        topic: s.topic_description,
                        subject: s.subject_name,
                        reason: s.reason || 'Sem slots disponíveis'
                    }))
                }
            });

        } catch (error) {
            // Rollback seguro da transação
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                console.error('[REPLAN] Erro ao fazer rollback:', rollbackError);
            }
            
            console.error('[REPLAN] Erro crítico ao replanejar:', {
                planId,
                userId: req.user.id,
                error: error.message,
                stack: error.stack
            });
            
            res.status(500).json({ 
                success: false, 
                error: 'Ocorreu um erro interno ao replanejar as tarefas. Nossa equipe foi notificada.',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor'
            });
        }
    }
);

// Obter tópicos excluídos no modo Reta Final (endpoint legado - mantido para compatibilidade)
app.get('/plans/:planId/exclusions',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const planId = req.params.planId;
            
            // Verificar se o plano pertence ao usuário
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }
            
            // Buscar exclusões
            const exclusions = await dbAll(
                'SELECT * FROM reta_final_exclusions WHERE study_plan_id = ? ORDER BY priority_combined DESC, subject_name, topic_description',
                [planId]
            );
            
            // Agrupar por disciplina
            const exclusionsBySubject = exclusions.reduce((acc, exclusion) => {
                if (!acc[exclusion.subject_name]) {
                    acc[exclusion.subject_name] = [];
                }
                acc[exclusion.subject_name].push({
                    id: exclusion.id,
                    topic_id: exclusion.topic_id,
                    description: exclusion.topic_description,
                    priority_combined: exclusion.priority_combined,
                    exclusion_date: exclusion.exclusion_date
                });
                return acc;
            }, {});
            
            res.json({
                isRetaFinalActive: !!plan.reta_final_mode,
                totalExclusions: exclusions.length,
                exclusionsBySubject,
                lastUpdated: exclusions.length > 0 ? exclusions[0].exclusion_date : null
            });
            
        } catch (error) {
            console.error('Erro ao buscar exclusões:', error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
);

// Novo endpoint para consultar tópicos excluídos no modo Reta Final
app.get('/plans/:planId/excluded-topics',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const planId = req.params.planId;
            
            // Verificar se o plano pertence ao usuário
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }
            
            // Buscar tópicos excluídos da nova tabela
            const excludedTopics = await dbAll(
                'SELECT * FROM reta_final_excluded_topics WHERE study_plan_id = ? ORDER BY priority_weight DESC, subject_name, topic_name',
                [planId]
            );
            
            // Agrupar por disciplina
            const exclusionsBySubject = excludedTopics.reduce((acc, topic) => {
                if (!acc[topic.subject_name]) {
                    acc[topic.subject_name] = {
                        subject_name: topic.subject_name,
                        topics: [],
                        totalExcluded: 0
                    };
                }
                acc[topic.subject_name].topics.push({
                    id: topic.id,
                    topic_name: topic.topic_name,
                    importance: topic.importance,
                    priority_weight: topic.priority_weight,
                    reason: topic.reason,
                    excluded_at: topic.excluded_at
                });
                acc[topic.subject_name].totalExcluded++;
                return acc;
            }, {});
            
            // Estatísticas gerais
            const stats = {
                totalTopicsExcluded: excludedTopics.length,
                totalSubjectsAffected: Object.keys(exclusionsBySubject).length,
                lastExclusionDate: excludedTopics.length > 0 ? excludedTopics[0].excluded_at : null,
                averagePriorityWeight: excludedTopics.length > 0 ? 
                    (excludedTopics.reduce((sum, t) => sum + t.priority_weight, 0) / excludedTopics.length).toFixed(2) : 0
            };
            
            res.json({
                isRetaFinalActive: !!plan.reta_final_mode,
                planName: plan.name,
                stats,
                exclusionsBySubject: Object.values(exclusionsBySubject),
                rawExclusions: excludedTopics,
                message: excludedTopics.length > 0 ? 
                    `📊 ${excludedTopics.length} tópicos foram excluídos no Modo Reta Final para adequar o cronograma ao tempo disponível.` :
                    '✅ Nenhum tópico foi excluído. Todos os conteúdos cabem no tempo disponível.'
            });
            
        } catch (error) {
            console.error('Erro ao buscar tópicos excluídos:', error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
);

// Verificar tarefas atrasadas - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/overdue_check', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const todayStr = getBrazilianDateString();
            const result = await dbGet("SELECT COUNT(id) as count FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?", [req.params.planId, todayStr]);
            res.json(result);
        } catch (error) {
            console.error('Erro ao verificar tarefas atrasadas:', error);
            res.status(500).json({ error: "Erro ao verificar tarefas atrasadas" });
        }
}); 
END LEGACY ROUTE COMMENT */

// Obter o cronograma de um plano - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js
app.get('/plans/:planId/schedule', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [req.params.planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            const rows = await dbAll("SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY session_date ASC, id ASC", [req.params.planId]);
            const groupedByDate = rows.reduce((acc, session) => {
                const date = session.session_date;
                if (!acc[date]) acc[date] = [];
                acc[date].push(session);
                return acc;
            }, {});
            res.json(groupedByDate);
        } catch(err) {
            console.error('Erro ao buscar cronograma:', err);
            res.status(500).json({ "error": "Erro ao buscar cronograma" });
        }
});
END LEGACY ROUTE COMMENT */

// Obter preview do status do cronograma (dados reais do usuário) - MIGRATED TO MODULAR ARCHITECTURE


// Atualizar status de múltiplas sessões - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js
app.patch('/sessions/batch_update_status', 
    authenticateToken,
    body('sessions').isArray().withMessage('O corpo deve conter um array de sessões'),
    body('sessions.*.id').isInt().withMessage('ID da sessão inválido'),
    body('sessions.*.status').isIn(['Pendente', 'Concluído']).withMessage('Status inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { sessions } = req.body;
        const userId = req.user.id;

        try {
            await dbRun('BEGIN');
            
            const updateSql = `
                UPDATE study_sessions 
                SET status = ? 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM study_plans
                    WHERE study_plans.id = study_sessions.study_plan_id
                    AND study_plans.user_id = ?
                )
            `;

            for (const session of sessions) {
                const sessionId = parseInt(session.id, 10);
                if (isNaN(sessionId)) continue;

                // Use dbRun instead of prepared statement
                const result = await dbRun(updateSql, [session.status, sessionId, userId]);
                if (result.changes === 0) {
                    console.warn(`Sessão ${sessionId} não encontrada ou não autorizada para o usuário ${userId}.`);
                }
            }
            
            await dbRun('COMMIT');
            
            res.json({ message: "Missão Cumprida! Seu cérebro agradece. 💪" });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error("ERRO no /sessions/batch_update_status:", error);
            res.status(500).json({ "error": "Ocorreu um erro no servidor ao atualizar as sessões." });
        }
});
END LEGACY ROUTE COMMENT */

// Agendar uma sessão de reforço - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js
app.post('/sessions/:sessionId/reinforce', 
    authenticateToken,
    validators.numericId('sessionId'),
    handleValidationErrors,
    async (req, res) => {
        const sessionId = req.params.sessionId;
        try {
            const session = await dbGet('SELECT ss.* FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?', [sessionId, req.user.id]);
            if (!session || !session.topic_id) return res.status(404).json({ error: "Sessão original não encontrada ou não é um tópico estudável." });
            
            const reinforceDate = new Date();
            reinforceDate.setDate(reinforceDate.getDate() + 3);
            const reinforceDateStr = reinforceDate.toISOString().split('T')[0];
            
            const sql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
            await dbRun(sql, [session.study_plan_id, session.topic_id, session.subject_name, session.topic_description, reinforceDateStr, 'Reforço Extra', 'Pendente']);
            
            res.status(201).json({ message: `Sessão de reforço agendada para ${reinforceDate.toLocaleDateString('pt-BR')}!` });
        } catch (error) {
            console.error('Erro ao agendar reforço:', error);
            res.status(500).json({ error: "Erro ao agendar a sessão de reforço." });
        }
});
END LEGACY ROUTE COMMENT */

// Adiar uma sessão de estudo - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js
app.patch('/sessions/:sessionId/postpone', 
    authenticateToken,
    validators.numericId('sessionId'),
    body('days').custom((value) => {
        return value === 'next' || (Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 30);
    }).withMessage('Número de dias inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { days } = req.body;
        const sessionId = req.params.sessionId;

        try {
            const session = await dbGet('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
            if (!session) return res.status(404).json({ error: "Sessão não encontrada." });

            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [session.study_plan_id, req.user.id]);
            if (!plan) return res.status(403).json({ error: "Não autorizado." });

            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            const findNextStudyDay = (date) => {
                let nextDay = new Date(date);
                while (nextDay <= examDate) {
                    if (nextDay.getDay() !== 0 && (studyHoursPerDay[nextDay.getDay()] || 0) > 0) return nextDay;
                    nextDay.setDate(nextDay.getDate() + 1);
                }
                return null;
            };

            let targetDate = new Date(session.session_date + 'T00:00:00');
            if (days === 'next') {
                targetDate.setDate(targetDate.getDate() + 1);
            } else {
                targetDate.setDate(targetDate.getDate() + parseInt(days, 10));
            }

            const newDate = findNextStudyDay(targetDate);

            if (!newDate) {
                return res.status(400).json({ error: "Não há dias de estudo disponíveis para adiar a tarefa." });
            }

            const newDateStr = newDate.toISOString().split('T')[0];
            await dbRun("UPDATE study_sessions SET session_date = ? WHERE id = ?", [newDateStr, sessionId]);

            res.json({ message: `Tarefa adiada para ${newDate.toLocaleDateString('pt-BR')}!` });

        } catch (error) {
            console.error("Erro ao adiar tarefa:", error);
            res.status(500).json({ error: "Erro interno ao adiar a tarefa." });
        }
});
END LEGACY ROUTE COMMENT */

// Obter dados de progresso do plano - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const completedTopicsResult = await dbAll('SELECT DISTINCT topic_id FROM study_sessions WHERE study_plan_id = ? AND session_type = "Novo Tópico" AND status = "Concluído" AND topic_id IS NOT NULL', [planId]);
            const allTopicsInPlan = await dbAll('SELECT s.subject_name, t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            
            if (allTopicsInPlan.length === 0) return res.json({ totalProgress: 0, subjectProgress: {} });

            const completedTopics = new Set(completedTopicsResult.map(r => r.topic_id));
            const totalProgress = (completedTopics.size / allTopicsInPlan.length) * 100;
            
            const subjectStats = {};
            allTopicsInPlan.forEach(topic => {
                if (!subjectStats[topic.subject_name]) {
                    subjectStats[topic.subject_name] = { total: 0, completed: 0 };
                }
                subjectStats[topic.subject_name].total++;
                if (completedTopics.has(topic.id)) {
                    subjectStats[topic.subject_name].completed++;
                }
            });
            
            const subjectProgress = {};
            for (const subject in subjectStats) {
                const stats = subjectStats[subject];
                subjectProgress[subject] = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
            }
            res.json({ totalProgress, subjectProgress });
        } catch (error) {
            console.error('Erro ao calcular progresso:', error);
            res.status(500).json({ "error": "Erro ao calcular progresso" });
        }
}); 
END LEGACY ROUTE COMMENT */

// Obter progresso das metas de questões - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/goal_progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const today = getBrazilianDateString();
        // Usar data brasileira para calcular dia da semana
        const brazilDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
        const dayOfWeek = brazilDate.getDay();
        const firstDayOfWeek = new Date();
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const firstDayOfWeekStr = firstDayOfWeek.toISOString().split('T')[0];
        try {
            const plan = await dbGet('SELECT daily_question_goal, weekly_question_goal FROM study_plans WHERE id = ?', [planId]);
            if (!plan) return res.status(404).json({ error: "Plano não encontrado" });
            const dailyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', [planId, today]);
            const weeklyResult = await dbGet('SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date >= ? AND session_date <= ?', [planId, firstDayOfWeekStr, today]);
            res.json({
                dailyGoal: plan.daily_question_goal,
                dailyProgress: dailyResult.total || 0,
                weeklyGoal: plan.weekly_question_goal,
                weeklyProgress: weeklyResult.total || 0
            });
        } catch (error) {
            console.error('Erro ao buscar progresso de metas:', error);
            res.status(500).json({ error: "Erro ao buscar progresso de metas" });
        }
}); 
END LEGACY ROUTE COMMENT */

// Obter radar de questões (pontos fracos) - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/question_radar', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const todayStr = getBrazilianDateString();
        const sql = `
            SELECT t.description as topic_description, s.subject_name, COALESCE(SUM(ss.questions_solved), 0) as total_questions
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN study_sessions ss ON t.id = ss.topic_id AND s.study_plan_id = ss.study_plan_id
            WHERE s.study_plan_id = ? 
              AND t.id IN (SELECT DISTINCT topic_id FROM study_sessions WHERE study_plan_id = ? AND session_date <= ? AND topic_id IS NOT NULL)
            GROUP BY t.id
            HAVING total_questions < 10
            ORDER BY total_questions ASC, s.subject_name
        `;
        try {
            const rows = await dbAll(sql, [req.params.planId, req.params.planId, todayStr]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao buscar radar de questões:', error);
            res.status(500).json({ "error": "Erro ao buscar radar de questões" });
        }
}); 
END LEGACY ROUTE COMMENT */

// Obter dados para revisão
app.get('/plans/:planId/review_data', 
    authenticateToken,
    validators.numericId('planId'),
    query('date').isISO8601().withMessage('Data inválida'),
    query('type').isIn(['semanal', 'mensal']).withMessage('Tipo de revisão inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { date, type } = req.query;
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT review_mode FROM study_plans WHERE id = ?', [planId]);
            if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
            const reviewDate = new Date(date + 'T00:00:00');
            const daysToLookBack = type === 'mensal' ? 28 : 7;
            const startDate = new Date(reviewDate);
            startDate.setDate(reviewDate.getDate() - (daysToLookBack - 1));
            const reviewDateStr = reviewDate.toISOString().split('T')[0];
            const startDateStr = startDate.toISOString().split('T')[0];
            let sql = `
                SELECT DISTINCT s.subject_name, ss.topic_description, ss.topic_id
                FROM study_sessions ss
                JOIN topics t ON ss.topic_id = t.id
                JOIN subjects s ON t.subject_id = s.id
                WHERE ss.study_plan_id = ? 
                  AND ss.session_type = 'Novo Tópico'
                  AND ss.session_date >= ? AND ss.session_date <= ?
            `;
            const params = [planId, startDateStr, reviewDateStr];
            if (plan.review_mode === 'focado') {
                sql += ` AND (SELECT COALESCE(SUM(questions_solved), 0) FROM study_sessions WHERE topic_id = ss.topic_id AND study_plan_id = ?) < 10`;
                params.push(planId);
            }
            sql += ` ORDER BY s.subject_name, ss.topic_description`;
            const rows = await dbAll(sql, params);
            const groupedBySubject = rows.reduce((acc, row) => {
                if (!acc[row.subject_name]) acc[row.subject_name] = [];
                acc[row.subject_name].push(row.topic_description);
                return acc;
            }, {});
            res.json(groupedBySubject);
        } catch (error) {
            console.error('Erro ao buscar dados de revisão:', error);
            res.status(500).json({ error: 'Erro ao buscar dados de revisão' });
        }
});

// Obter progresso detalhado - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            // Obter dados básicos de tópicos e disciplinas
            const subjects = await dbAll('SELECT id, subject_name FROM subjects WHERE study_plan_id = ?', [planId]);
            
            // CORREÇÃO: Query melhorada para capturar tempo de estudo de sessões concluídas
            const topics = await dbAll(`
                SELECT 
                    t.id, t.description, t.status, t.subject_id, 
                    COALESCE(ss.total_time, 0) as time_studied 
                FROM topics t 
                LEFT JOIN (
                    SELECT 
                        topic_id, 
                        SUM(COALESCE(time_studied_seconds, 0)) as total_time 
                    FROM study_sessions 
                    WHERE study_plan_id = ? 
                        AND topic_id IS NOT NULL
                        AND status = 'Concluído'
                        AND time_studied_seconds > 0
                    GROUP BY topic_id
                ) ss ON t.id = ss.topic_id 
                WHERE t.subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)
            `, [planId, planId]);
            
            // CORREÇÃO: Também capturar tempo de estudo de sessões por disciplina que não têm topic_id
            const subjectStudyTime = await dbAll(`
                SELECT 
                    s.id as subject_id,
                    s.subject_name,
                    COALESCE(SUM(ss.time_studied_seconds), 0) as additional_time
                FROM subjects s
                LEFT JOIN study_sessions ss ON s.subject_name = ss.subject_name
                WHERE s.study_plan_id = ? 
                    AND ss.study_plan_id = ?
                    AND ss.status = 'Concluído'
                    AND ss.time_studied_seconds > 0
                    AND (ss.topic_id IS NULL OR ss.topic_id = '')
                GROUP BY s.id, s.subject_name
            `, [planId, planId]);

            // Calcular estatísticas de atividades
            const activityStats = await dbAll(`
                SELECT 
                    session_type,
                    COUNT(*) as total_sessions,
                    SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as completed_sessions,
                    SUM(COALESCE(time_studied_seconds, 0)) as total_time_seconds
                FROM study_sessions 
                WHERE study_plan_id = ?
                GROUP BY session_type
            `, [planId]);

            // Organizar estatísticas por tipo de atividade
            const activityBreakdown = {
                revisoes_7d: { completed: 0, total: 0, timeSpent: 0 },
                revisoes_14d: { completed: 0, total: 0, timeSpent: 0 },
                revisoes_28d: { completed: 0, total: 0, timeSpent: 0 },
                simulados_direcionados: { completed: 0, total: 0, timeSpent: 0 },
                simulados_completos: { completed: 0, total: 0, timeSpent: 0 },
                redacoes: { completed: 0, total: 0, timeSpent: 0 },
                novos_topicos: { completed: 0, total: 0, timeSpent: 0 }
            };

            activityStats.forEach(stat => {
                const sessionType = stat.session_type;
                if (sessionType === 'Revisão 7D') {
                    activityBreakdown.revisoes_7d = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Revisão 14D') {
                    activityBreakdown.revisoes_14d = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Revisão 28D') {
                    activityBreakdown.revisoes_28d = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Simulado Direcionado') {
                    activityBreakdown.simulados_direcionados = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Simulado Completo') {
                    activityBreakdown.simulados_completos = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Redação') {
                    activityBreakdown.redacoes = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                } else if (sessionType === 'Novo Tópico') {
                    activityBreakdown.novos_topicos = {
                        completed: stat.completed_sessions,
                        total: stat.total_sessions,
                        timeSpent: stat.total_time_seconds
                    };
                }
            });

            // Calcular tempo total de revisões vs conteúdo novo
            const totalReviewTime = activityBreakdown.revisoes_7d.timeSpent + 
                                   activityBreakdown.revisoes_14d.timeSpent + 
                                   activityBreakdown.revisoes_28d.timeSpent;
            const totalNewContentTime = activityBreakdown.novos_topicos.timeSpent;
            
            // CORREÇÃO: Incluir TODOS os tipos de sessão no tempo total
            const totalStudyTime = totalReviewTime + 
                                 totalNewContentTime + 
                                 activityBreakdown.simulados_direcionados.timeSpent + 
                                 activityBreakdown.simulados_completos.timeSpent + 
                                 activityBreakdown.redacoes.timeSpent;
            
            console.log(`📊 Tempo total calculado: revisões=${totalReviewTime}s, novos=${totalNewContentTime}s, simulados_dir=${activityBreakdown.simulados_direcionados.timeSpent}s, simulados_comp=${activityBreakdown.simulados_completos.timeSpent}s, redações=${activityBreakdown.redacoes.timeSpent}s, TOTAL=${totalStudyTime}s`);

            // CORREÇÃO: Melhorar cálculo de tempo total por disciplina incluindo tempo adicional
            const subjectData = subjects.map(subject => {
                const subjectTopics = topics.filter(t => t.subject_id === subject.id);
                const completedTopics = subjectTopics.filter(t => t.status === 'Concluído').length;
                
                // Tempo dos tópicos específicos
                const topicsTime = subjectTopics.reduce((sum, t) => sum + t.time_studied, 0);
                
                // Tempo adicional de sessões da disciplina sem topic_id específico
                const additionalTime = subjectStudyTime.find(st => st.subject_id === subject.id)?.additional_time || 0;
                
                // Tempo total = tempo dos tópicos + tempo adicional da disciplina
                const totalTime = topicsTime + additionalTime;
                
                console.log(`📊 Disciplina ${subject.subject_name}: tópicos=${topicsTime}s, adicional=${additionalTime}s, total=${totalTime}s`);

                return {
                    id: subject.id,
                    name: subject.subject_name,
                    progress: subjectTopics.length > 0 ? (completedTopics / subjectTopics.length) * 100 : 0,
                    totalTime: totalTime, // Tempo total corrigido
                    topics: subjectTopics.map(t => ({
                        id: t.id,
                        description: t.description,
                        status: t.status,
                        timeStudied: t.time_studied
                    }))
                };
            });

            const totalTopicsInPlan = topics.length;
            const totalCompletedTopics = topics.filter(t => t.status === 'Concluído').length;
            const totalProgress = totalTopicsInPlan > 0 ? (totalCompletedTopics / totalTopicsInPlan) * 100 : 0;

            res.json({
                totalProgress,
                subjectDetails: subjectData,
                activityStats: {
                    revisoes_7d: {
                        completed: activityBreakdown.revisoes_7d.completed,
                        total: activityBreakdown.revisoes_7d.total,
                        completionRate: activityBreakdown.revisoes_7d.total > 0 ? 
                            (activityBreakdown.revisoes_7d.completed / activityBreakdown.revisoes_7d.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.revisoes_7d.timeSpent
                    },
                    revisoes_14d: {
                        completed: activityBreakdown.revisoes_14d.completed,
                        total: activityBreakdown.revisoes_14d.total,
                        completionRate: activityBreakdown.revisoes_14d.total > 0 ? 
                            (activityBreakdown.revisoes_14d.completed / activityBreakdown.revisoes_14d.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.revisoes_14d.timeSpent
                    },
                    revisoes_28d: {
                        completed: activityBreakdown.revisoes_28d.completed,
                        total: activityBreakdown.revisoes_28d.total,
                        completionRate: activityBreakdown.revisoes_28d.total > 0 ? 
                            (activityBreakdown.revisoes_28d.completed / activityBreakdown.revisoes_28d.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.revisoes_28d.timeSpent
                    },
                    simulados_direcionados: {
                        completed: activityBreakdown.simulados_direcionados.completed,
                        total: activityBreakdown.simulados_direcionados.total,
                        completionRate: activityBreakdown.simulados_direcionados.total > 0 ? 
                            (activityBreakdown.simulados_direcionados.completed / activityBreakdown.simulados_direcionados.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.simulados_direcionados.timeSpent
                    },
                    simulados_completos: {
                        completed: activityBreakdown.simulados_completos.completed,
                        total: activityBreakdown.simulados_completos.total,
                        completionRate: activityBreakdown.simulados_completos.total > 0 ? 
                            (activityBreakdown.simulados_completos.completed / activityBreakdown.simulados_completos.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.simulados_completos.timeSpent
                    },
                    redacoes: {
                        completed: activityBreakdown.redacoes.completed,
                        total: activityBreakdown.redacoes.total,
                        completionRate: activityBreakdown.redacoes.total > 0 ? 
                            (activityBreakdown.redacoes.completed / activityBreakdown.redacoes.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.redacoes.timeSpent
                    },
                    novos_topicos: {
                        completed: activityBreakdown.novos_topicos.completed,
                        total: activityBreakdown.novos_topicos.total,
                        completionRate: activityBreakdown.novos_topicos.total > 0 ? 
                            (activityBreakdown.novos_topicos.completed / activityBreakdown.novos_topicos.total * 100).toFixed(1) : 0,
                        timeSpent: activityBreakdown.novos_topicos.timeSpent
                    }
                },
                timeBreakdown: {
                    totalReviewTime: totalReviewTime,
                    totalNewContentTime: totalNewContentTime,
                    totalStudyTime: totalStudyTime,
                    reviewPercentage: totalStudyTime > 0 ? (totalReviewTime / totalStudyTime * 100).toFixed(1) : 0,
                    newContentPercentage: totalStudyTime > 0 ? (totalNewContentTime / totalStudyTime * 100).toFixed(1) : 0
                }
            });

        } catch (error) {
            console.error('Erro ao buscar progresso detalhado:', error);
            res.status(500).json({ "error": "Erro ao buscar progresso detalhado" });
        }
    }
); 
END LEGACY ROUTE COMMENT */

// Obter estatísticas resumidas de atividades - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/activity_summary',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            // Obter estatísticas de atividades concluídas
            const activityStats = await dbAll(`
                SELECT 
                    session_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as completed
                FROM study_sessions 
                WHERE study_plan_id = ?
                GROUP BY session_type
            `, [planId]);

            const summary = {
                revisoes_7d_completed: 0,
                revisoes_14d_completed: 0,
                revisoes_28d_completed: 0,
                simulados_direcionados_completed: 0,
                simulados_completos_completed: 0,
                redacoes_completed: 0,
                novos_topicos_completed: 0,
                total_revisoes_completed: 0
            };

            activityStats.forEach(stat => {
                const sessionType = stat.session_type;
                const completed = stat.completed || 0;
                
                if (sessionType === 'Revisão 7D') {
                    summary.revisoes_7d_completed = completed;
                    summary.total_revisoes_completed += completed;
                } else if (sessionType === 'Revisão 14D') {
                    summary.revisoes_14d_completed = completed;
                    summary.total_revisoes_completed += completed;
                } else if (sessionType === 'Revisão 28D') {
                    summary.revisoes_28d_completed = completed;
                    summary.total_revisoes_completed += completed;
                } else if (sessionType === 'Simulado Direcionado') {
                    summary.simulados_direcionados_completed = completed;
                } else if (sessionType === 'Simulado Completo') {
                    summary.simulados_completos_completed = completed;
                } else if (sessionType === 'Redação') {
                    summary.redacoes_completed = completed;
                } else if (sessionType === 'Novo Tópico') {
                    summary.novos_topicos_completed = completed;
                }
            });

            res.json(summary);

        } catch (error) {
            console.error('Erro ao buscar resumo de atividades:', error);
            res.status(500).json({ "error": "Erro ao buscar resumo de atividades" });
        }
    }
); 
END LEGACY ROUTE COMMENT */

// Obter diagnóstico de performance (reality check) - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/realitycheck', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet("SELECT * FROM study_plans WHERE id = ? AND user_id = ?", [planId, req.user.id]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado" });
            
            const sessions = await dbAll("SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?", [planId]);
            const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            const totalTopics = totalTopicsResult.total;

            if (totalTopics === 0) {
                return res.json({ message: "Adicione tópicos ao seu plano para ver as projeções." });
            }

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            
            const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
            const completedTopics = new Set(newTopicSessions.filter(s => s.status === 'Concluído').map(r => r.topic_id));
            const topicsCompletedCount = completedTopics.size;
            const topicsRemaining = totalTopics - topicsCompletedCount;

            const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'Pendente');
            const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

            const firstSessionDateResult = await dbGet("SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído'", [planId]);
            const firstSessionDate = firstSessionDateResult.first_date ? new Date(firstSessionDateResult.first_date + 'T00:00:00') : today;

            const daysSinceStart = Math.max(1, Math.ceil((today - firstSessionDate) / (1000 * 60 * 60 * 24)));
            const daysRemainingForExam = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
            
            const currentPace = topicsCompletedCount / daysSinceStart;
            const requiredPace = topicsRemaining / daysRemainingForExam;

            let status, primaryMessage, secondaryMessage, motivationalMessage;

            if (isMaintenanceMode) {
                status = 'completed';
                primaryMessage = `Parabéns! Você concluiu <strong>100%</strong> do edital.`;
                secondaryMessage = `Seu cronograma entrou no Modo de Manutenção Avançada, com foco em revisões e simulados.`;
                motivationalMessage = `Agora é a hora de aprimorar. Mantenha a consistência até a aprovação!`;
            } else {
                let projectedCompletionPercentage = 0;
                if (totalTopics > 0) {
                    if (currentPace > 0) {
                        const projectedTopicsToComplete = currentPace * daysRemainingForExam;
                        const totalProjectedCompleted = topicsCompletedCount + projectedTopicsToComplete;
                        projectedCompletionPercentage = Math.min(100, (totalProjectedCompleted / totalTopics) * 100);
                    } else if (topicsCompletedCount > 0) {
                        projectedCompletionPercentage = (topicsCompletedCount / totalTopics) * 100;
                    }
                }

                if (currentPace >= requiredPace) {
                    status = 'on-track';
                    primaryMessage = `Mantendo o ritmo, sua projeção é de concluir <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital.`;
                    secondaryMessage = `Excelente trabalho! Seu ritmo atual é suficiente para cobrir todo o conteúdo necessário a tempo.`;
                    motivationalMessage = `A consistência está trazendo resultados. Continue assim!`;
                } else {
                    status = 'off-track';
                    primaryMessage = `Nesse ritmo, você completará apenas <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital até a prova.`;
                    secondaryMessage = `Para concluir 100%, seu ritmo precisa aumentar para <strong>${requiredPace.toFixed(1)} tópicos/dia</strong>.`;
                    motivationalMessage = `Não desanime! Pequenos ajustes na rotina podem fazer uma grande diferença.`;
                }
            }

            res.json({
                requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : "N/A",
                postponementCount: plan.postponement_count,
                status,
                primaryMessage,
                secondaryMessage,
                motivationalMessage,
                isMaintenanceMode
            });

        } catch (error) {
            console.error('Erro no reality check:', error);
            res.status(500).json({ "error": "Erro ao calcular diagnóstico" });
        }
});
// Endpoint para registrar tempo de estudo
app.post('/sessions/:sessionId/time',
    authenticateToken,
    validators.numericId('sessionId'),
    body('seconds').isInt({ min: 0, max: 86400 }).withMessage('Tempo inválido'),
    handleValidationErrors,
    async (req, res) => {
        const { seconds } = req.body;
        const sessionId = req.params.sessionId;
        const userId = req.user.id;

        try {
            const session = await dbGet(`
                SELECT ss.* FROM study_sessions ss 
                JOIN study_plans sp ON ss.study_plan_id = sp.id 
                WHERE ss.id = ? AND sp.user_id = ?
            `, [sessionId, userId]);

            if (!session) {
                return res.status(404).json({ error: "Sessão não encontrada ou não autorizada." });
            }

            await dbRun(`
                UPDATE study_sessions 
                SET time_studied_seconds = COALESCE(time_studied_seconds, 0) + ?
                WHERE id = ?
            `, [seconds, sessionId]);

            res.json({ 
                message: "Tempo registrado com sucesso!", 
                totalTime: (session.time_studied_seconds || 0) + seconds 
            });

        } catch (error) {
            console.error('Erro ao salvar tempo de estudo:', error);
            res.status(500).json({ error: "Erro ao registrar tempo de estudo." });
        }
    }
); 
END LEGACY ROUTE COMMENT */

// --- ROTA DE GAMIFICAÇÃO --- - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/plans/:planId/gamification', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;

        try {
            const plan = await dbGet("SELECT id FROM study_plans WHERE id = ? AND user_id = ?", [planId, userId]);
            if (!plan) return res.status(404).json({ "error": "Plano não encontrado ou não autorizado." });

            // CORREÇÃO: Contar tópicos únicos concluídos independente do session_type
            const completedTopicsResult = await dbGet(`
                SELECT COUNT(DISTINCT topic_id) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? 
                AND status = 'Concluído' 
                AND topic_id IS NOT NULL
            `, [planId]);
            const completedTopicsCount = parseInt(completedTopicsResult?.count || 0);
            
            // Debug: Log para verificar o que está sendo calculado
            console.log(`[GAMIFICATION DEBUG] Plan ${planId}:`, {
                completedTopicsCount,
                queryResult: completedTopicsResult
            });

            const levels = [
                { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' },
                { threshold: 11, title: 'Pagador(a) de Inscrição 💸' },
                { threshold: 31, title: 'Acima da Nota de Corte (nos simulados) 😉' },
                { threshold: 51, title: 'Mestre dos Grupos de WhatsApp de Concurso 📲' },
                { threshold: 101, title: 'Gabaritador(a) da prova de Português da FGV 🎯' },
                { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹' },
                { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎' },
                { threshold: 501, title: '✨ Lenda Viva: Assinante Vitalício do Diário Oficial ✨' }
            ];

            let currentLevel = levels[0];
            let nextLevel = null;
            for (let i = levels.length - 1; i >= 0; i--) {
                if (completedTopicsCount >= levels[i].threshold) {
                    currentLevel = levels[i];
                    if (i < levels.length - 1) {
                        nextLevel = levels[i + 1];
                    }
                    break;
                }
            }
            
            const topicsToNextLevel = nextLevel ? nextLevel.threshold - completedTopicsCount : 0;

            const completedSessions = await dbAll(`
                SELECT DISTINCT session_date FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído' ORDER BY session_date DESC
            `, [planId]);
            
            let studyStreak = 0;
            if (completedSessions.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);

                const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
                
                if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
                    studyStreak = 1;
                    let currentDate = new Date(lastStudyDate);
                    for (let i = 1; i < completedSessions.length; i++) {
                        const previousDay = new Date(currentDate);
                        previousDay.setDate(currentDate.getDate() - 1);
                        const nextStudyDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                        if (nextStudyDate.getTime() === previousDay.getTime()) {
                            studyStreak++;
                            currentDate = nextStudyDate;
                        } else {
                            break;
                        }
                    }
                }
            }
            
            const todayStr = getBrazilianDateString();
            const todayTasksResult = await dbGet(`
                SELECT 
                    COUNT(id) as total, 
                    SUM(CASE WHEN status = 'Concluído' THEN 1 ELSE 0 END) as completed 
                FROM study_sessions 
                WHERE study_plan_id = ? AND session_date = ?
            `, [planId, todayStr]);

            // Calcular experiência baseada em atividades reais
            const allCompletedSessionsResult = await dbGet(`
                SELECT COUNT(*) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído'
            `, [planId]);
            const totalCompletedSessions = parseInt(allCompletedSessionsResult?.count || 0);
            
            console.log(`[GAMIFICATION DEBUG] Total sessions:`, {
                totalCompletedSessions,
                queryResult: allCompletedSessionsResult
            });
            
            // XP baseado em: 10 XP por sessão completada + 50 XP por tópico novo completado
            const experiencePoints = (totalCompletedSessions * 10) + (completedTopicsCount * 50);
            
            // Calcular conquistas baseadas em dados reais (formato compatível com o frontend)
            // AGORA COM MUITO HUMOR PARA ALIVIAR A PRESSÃO! 😄
            const achievements = [];
            const now = new Date().toISOString();
            
            // Conquistas por TÓPICOS CONCLUÍDOS (com MUITO humor!)
            if (completedTopicsCount >= 1) {
                achievements.push({
                    title: "🎯 Primeira Lapada no Edital",
                    description: "O primeiro soco na cara da procrastinação!",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 5) {
                achievements.push({
                    title: "📚 Maratonista do PDF",
                    description: "Sua vista já começou a reclamar.",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 10) {
                achievements.push({
                    title: "✨ Destruidor de Questões",
                    description: "Já discute gabarito com confiança.",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 25) {
                achievements.push({
                    title: "👑 Dono do Material",
                    description: "Sabe até a cor da caneta que o professor usou no slide.",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 50) {
                achievements.push({
                    title: "🌟 Meio Monstro",
                    description: "Você está virando uma lenda local no grupo de estudos.",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 100) {
                achievements.push({
                    title: "🏛️ Centurião do Conhecimento",
                    description: "Bancas já estão te bloqueando no Instagram.",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 200) {
                achievements.push({
                    title: "💪 Chuck Norris dos Editais",
                    description: "Os editais temem você!",
                    achieved_date: now
                });
            }
            if (completedTopicsCount >= 501) {
                achievements.push({
                    title: "🏛️ Vai Escolher Onde Vai Tomar Posse",
                    description: "Não é se vai passar, é onde.",
                    achieved_date: now
                });
            }
            
            // Conquistas por SEQUÊNCIA (STREAK) com humor!
            if (studyStreak >= 3) {
                achievements.push({
                    title: "Resistente ao Netflix 📺",
                    description: "3 dias seguidos! Resistiu à série nova!",
                    achieved_date: now
                });
            }
            if (studyStreak >= 7) {
                achievements.push({
                    title: "Imune ao Sofá 🛋️",
                    description: "7 dias! O sofá esqueceu sua forma!",
                    achieved_date: now
                });
            }
            if (studyStreak >= 14) {
                achievements.push({
                    title: "Inimigo do Descanso 😤",
                    description: "14 dias! Descanso? Não conheço!",
                    achieved_date: now
                });
            }
            if (studyStreak >= 30) {
                achievements.push({
                    title: "Máquina de Aprovar 🤖",
                    description: "30 dias! Você é um cyborg concurseiro!",
                    achieved_date: now
                });
            }
            
            // Conquistas por NÚMERO DE SESSÕES com humor!
            if (totalCompletedSessions >= 20) {
                achievements.push({
                    title: "Viciado(a) em Questões 💊",
                    description: "20 sessões! Questões são sua droga legal!",
                    achieved_date: now
                });
            }
            if (totalCompletedSessions >= 50) {
                achievements.push({
                    title: "🪑 Lombar Suprema",
                    description: "Já fez mais fisioterapia que simulados.",
                    achieved_date: now
                });
            }
            if (totalCompletedSessions >= 100) {
                achievements.push({
                    title: "🛏️ Travesseiro Vade Mecum",
                    description: "Seu travesseiro já está com formato de Vade Mecum.",
                    achieved_date: now
                });
            }
            if (totalCompletedSessions >= 150) {
                achievements.push({
                    title: "📖 Estuda em Fila de Banco",
                    description: "Estuda até em fila de banco.",
                    achieved_date: now
                });
            }
            if (totalCompletedSessions >= 200) {
                achievements.push({
                    title: "🏖️ O que é Férias?",
                    description: "Férias? Nunca ouvi falar.",
                    achieved_date: now
                });
            }
            if (totalCompletedSessions >= 300) {
                achievements.push({
                    title: "🎉 Destruidor(a) de Finais de Semana",
                    description: "Churrasco? Praia? Só depois da posse!",
                    achieved_date: now
                });
            }
            
            console.log(`[GAMIFICATION DEBUG] Achievements calculados:`, {
                count: achievements.length,
                totalSessions: totalCompletedSessions,
                streak: studyStreak
            });
            
            // Calcular total de dias únicos com atividades (não streak, mas total)
            const uniqueStudyDaysResult = await dbGet(`
                SELECT COUNT(DISTINCT session_date) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído'
            `, [planId]);
            const totalStudyDays = uniqueStudyDaysResult.count || 0;

            // Calcular tempo total de estudo (soma de todas as sessões)
            const totalStudyTimeResult = await dbGet(`
                SELECT SUM(COALESCE(time_studied_seconds, 0)) as total_time
                FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído'
            `, [planId]);
            const totalStudyTime = totalStudyTimeResult.total_time || 0;
            
            console.log(`📊 Endpoint gamificação - Plano ${planId}: tempo total = ${totalStudyTime} segundos`);

            res.json({
                completedTopicsCount,
                concurseiroLevel: currentLevel.title,
                nextLevel: nextLevel ? nextLevel.title : null,
                topicsToNextLevel,
                studyStreak,
                completedTodayCount: todayTasksResult.completed || 0,
                totalTodayCount: todayTasksResult.total || 0,
                experiencePoints,
                achievements,
                totalStudyDays,
                totalCompletedSessions,
                totalStudyTime
            });

        } catch (error) {
            console.error("Erro na rota de gamificação:", error);
            res.status(500).json({ "error": "Erro ao buscar dados de gamificação." });
        }
}); 
END LEGACY ROUTE COMMENT */

// Endpoint para gerar dados de compartilhamento
app.get('/plans/:planId/share-progress', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;

        try {
            const plan = await dbGet('SELECT plan_name, exam_date FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

            const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);

            // Pegar dados de gamificação
            // CORREÇÃO: Contar tópicos únicos concluídos independente do session_type
            const completedTopicsResult = await dbGet(`
                SELECT COUNT(DISTINCT topic_id) as count 
                FROM study_sessions 
                WHERE study_plan_id = ? 
                AND status = 'Concluído' 
                AND topic_id IS NOT NULL
            `, [planId]);
            const completedTopicsCount = parseInt(completedTopicsResult?.count || 0);
            
            // Debug: Log para verificar o que está sendo calculado
            console.log(`[GAMIFICATION DEBUG] Plan ${planId}:`, {
                completedTopicsCount,
                queryResult: completedTopicsResult
            });

            // Calcular streak
            const completedSessions = await dbAll(`
                SELECT DISTINCT session_date FROM study_sessions 
                WHERE study_plan_id = ? AND status = 'Concluído' ORDER BY session_date DESC
            `, [planId]);
            
            let studyStreak = 0;
            if (completedSessions.length > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);

                const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
                
                if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
                    studyStreak = 1;
                    let currentDate = new Date(lastStudyDate);
                    for (let i = 1; i < completedSessions.length; i++) {
                        const previousDay = new Date(currentDate);
                        previousDay.setDate(currentDate.getDate() - 1);
                        const nextStudyDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                        if (nextStudyDate.getTime() === previousDay.getTime()) {
                            studyStreak++;
                            currentDate = nextStudyDate;
                        } else {
                            break;
                        }
                    }
                }
            }

            // Calcular dias até prova
            const examDate = new Date(plan.exam_date + 'T00:00:00');
            const today = new Date();
            const timeDiff = examDate.getTime() - today.getTime();
            const daysToExam = Math.ceil(timeDiff / (1000 * 3600 * 24));

            // Determinar nível atual
            const levels = [
                { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' },
                { threshold: 11, title: 'Pagador(a) de Inscrição 💸' },
                { threshold: 31, title: 'Acima da Nota de Corte (nos simulados) 😉' },
                { threshold: 51, title: 'Mestre dos Grupos de WhatsApp de Concurso 📲' },
                { threshold: 101, title: 'Gabaritador(a) da prova de Português da FGV 🎯' },
                { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹' },
                { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎' },
                { threshold: 501, title: '✨ Lenda Viva: Assinante Vitalício do Diário Oficial ✨' }
            ];

            let currentLevel = levels[0];
            for (let i = levels.length - 1; i >= 0; i--) {
                if (completedTopicsCount >= levels[i].threshold) {
                    currentLevel = levels[i];
                    break;
                }
            }

            const shareData = {
                userName: user?.name || 'Concurseiro(a)',
                planName: plan.plan_name,
                completedTopics: completedTopicsCount,
                studyStreak: studyStreak,
                daysToExam: daysToExam > 0 ? daysToExam : 0,
                level: currentLevel.title,
                shareText: `🎯 MEU PROGRESSO NO ${plan.plan_name.toUpperCase()}!\n\n` +
                          `📚 ${completedTopicsCount} tópicos já dominados ✅\n` +
                          `🔥 ${studyStreak} dias consecutivos de foco total!\n` +
                          `⏰ Faltam ${daysToExam > 0 ? daysToExam : 0} dias para a prova\n` +
                          `🏆 Status atual: ${currentLevel.title}\n\n` +
                          `💪 A aprovação está cada vez mais próxima!\n\n` +
                          `#Concursos #Estudos #Editaliza #FocoNaAprovacao #VemAprovacao`
            };

            res.json(shareData);

        } catch (error) {
            console.error('Erro ao gerar dados de compartilhamento:', error);
            res.status(500).json({ 'error': 'Erro ao gerar dados de compartilhamento.' });
        }
    }
);

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

// Configurar error handling global
// setupGlobalErrorHandling(); // Função não existe, comentada temporariamente

// Middleware de tratamento de erros robusto
app.use(errorHandler);

// Sistema de backup foi removido durante migração para PostgreSQL

// --- EMAIL SERVICE ADMINISTRATIVE ROUTES ---
// Email service status endpoint
app.get('/admin/email/status', authenticateToken, (req, res) => {
    try {
        const status = emailService.getStatus();
        const rateLimitStats = emailRateLimitService.getStats();
        
        res.json({
            emailService: status,
            rateLimiting: rateLimitStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting email status:', error);
        res.status(500).json({ error: 'Failed to get email status' });
    }
});

// Test email endpoint (for administrators)
app.post('/admin/email/test', 
    authenticateToken,
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email } = req.body;
            const result = await emailService.sendTestEmail(email);
            
            res.json({
                success: true,
                message: 'Test email sent successfully',
                messageId: result.messageId
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

// Reset rate limits for specific email (admin function)
app.post('/admin/email/reset-limits',
    authenticateToken,
    validators.email,
    handleValidationErrors,
    async (req, res) => {
        try {
            const { email } = req.body;
            emailRateLimitService.resetEmailLimits(email);
            
            res.json({
                success: true,
                message: `Rate limits reset for ${email}`
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

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check disponível em: http://localhost:${PORT}/health`);
    console.log(`Sistema de backup automático ativado`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido, fechando servidor graciosamente...');
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
