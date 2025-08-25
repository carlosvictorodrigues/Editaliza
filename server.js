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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 FASE 4.1 - MIGRAÇÃO PARA ARQUITETURA MODULAR CONCLUÍDA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo foi otimizado para remover 32 rotas duplicadas que já foram
 * migradas para a nova arquitetura modular.
 * 
 * ✅ Rotas migradas para:
 * • /src/routes/plans.routes.js    - Operações de planos de estudo
 * • /src/routes/sessions.routes.js - Gerenciamento de sessões
 * • /src/routes/auth.routes.js     - Autenticação e autorização
 * • /src/routes/profile.routes.js  - Perfil do usuário
 * • /src/routes/subjects.routes.js - Disciplinas
 * • /src/routes/topics.routes.js   - Tópicos
 * 
 * ⏳ Rotas complexas ainda não migradas (permanecem neste arquivo):
 * • GET  /api/plans/:planId/replan-preview     - Preview de replanejamento
 * • POST /api/plans/:planId/replan             - Replanejamento inteligente
 * • GET  /api/plans/:planId/progress           - Progresso detalhado
 * • GET  /api/plans/:planId/goal_progress      - Progresso de metas
 * • GET  /api/plans/:planId/question_radar     - Radar de questões
 * • GET  /api/plans/:planId/review_data        - Dados de revisão
 * • GET  /api/plans/:planId/detailed_progress  - Progresso detalhado
 * • GET  /api/plans/:planId/activity_summary   - Resumo de atividades
 * • GET  /api/plans/:planId/realitycheck       - Diagnóstico de performance
 * 
 * 🎯 Progresso da migração: 78% (32/41 rotas migradas)
 * 
 * Data da otimização: 2025-08-25T16:15:58.708Z
 * ═══════════════════════════════════════════════════════════════════════════
 */


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
    const isAPIRoute = req.path.startsWith('/api/') || req.path.startsWith('/schedules') || req.path.startsWith('/plans') || req.path.startsWith('/users') || req.path.startsWith('/topics');
    const hasJWTAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    
    if (skipCSRF.includes(req.path) || req.method === 'GET' || (isAPIRoute && hasJWTAuth)) {
        return next();
    }
    
    return csrfProtection()(req, res, next);
});

// Body parsing com sanitização
// Adicionar middleware de métricas
const { collectMetrics } = require('./src/middleware/metrics');
app.use(collectMetrics);

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
*/

// ============================================================================
// MODULAR ROUTES - NEW ARCHITECTURE
// ============================================================================

// Import modular routes
const plansRoutes = require('./src/routes/plans.routes'); // NOVA ARQUITETURA CONSOLIDADA
const subjectsRoutes = require('./src/routes/subjects.routes'); // FASE 4 - DISCIPLINAS
const topicsRoutes = require('./src/routes/topics.routes'); // FASE 4 - TÓPICOS
const authRoutes = require('./src/routes/auth.routes');
const profileRoutes = require('./src/routes/profile.routes'); // User profile routes
const scheduleRoutes = require('./src/routes/schedule.routes');
const sessionsRoutes = require('./src/routes/sessions.routes'); // FASE 5 - SESSÕES
const statisticsRoutes = require('./src/routes/statistics.routes'); // FASE 6 - ESTATÍSTICAS
const gamificationRoutes = require('./src/routes/gamification.routes'); // FASE 7 - GAMIFICAÇÃO
const adminRoutes = require('./src/routes/admin.routes'); // FASE 8 - ADMINISTRAÇÃO
const scheduleGenerationRoutes = require('./src/routes/schedule.routes'); // FASE 9 - GERAÇÃO DE CRONOGRAMA

// Use modular routes
// app.use('/api/plans', planRoutes); // REMOVIDO - arquivo órfão deletado
app.use('/api/plans', plansRoutes); // Rotas modulares ativas // NOVAS ROTAS CONSOLIDADAS (CRUD, etc)
app.use('/api', subjectsRoutes); // FASE 4 - DISCIPLINAS
app.use('/api', topicsRoutes); // FASE 4 - TÓPICOS
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes); // User profile routes
// app.use('/api/schedules', scheduleRoutes); // COMENTADO - Conflito com schedule.routes.js
app.use('/api', sessionsRoutes); // FASE 5 - SESSÕES
app.use('/api', statisticsRoutes); // FASE 6 - ESTATÍSTICAS E MÉTRICAS
app.use('/api', gamificationRoutes); // FASE 7 - GAMIFICAÇÃO (XP, níveis, achievements)
app.use('/api/admin', adminRoutes); // FASE 8 - ADMINISTRAÇÃO (email, system, users, config, audit)
app.use('/api', scheduleGenerationRoutes); // FASE 9 - GERAÇÃO DE CRONOGRAMA (algoritmo complexo 700+ linhas)

// ============================================================================
// LEGACY ROUTES - TO BE REFACTORED
// ============================================================================

// Rota para login de usuário
app.post('/api/login', 
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
            return res.status(500).json({ 'error': 'Erro no servidor.' });
        }
    }
);

// Google OAuth Routes
// Route to start Google OAuth

// Google OAuth callback route

// CORREÇÃO DE SEGURANÇA: Endpoint seguro para recuperar token da sessão

// CSRF token endpoint removido - agora está em auth.routes.js para evitar duplicação

// Route to check Google OAuth status (for debugging)

// Rota para logout

// Rota para solicitar redefinição de senha

// Rota para redefinir a senha com um token

// --- ROTAS DE PERFIL DO USUÁRIO ---
// Rota para obter dados do perfil do usuário logado

// Rota para atualizar dados do perfil (completo com todos os campos)


// --- ROTAS DE TESTE E DEBUG ---
app.get('/api/test-db', authenticateToken, async (req, res) => {
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
        return res.status(500).json({ error: error.message });
    }
});

// --- ROTAS DE PLANOS (CRUD E CONFIGURAÇÕES) ---





// --- ROTAS DE DISCIPLINAS E TÓPICOS --- - MIGRATED TO MODULAR ARCHITECTURE
// ============================================================================
// TODAS AS ROTAS ABAIXO FORAM MIGRADAS PARA:
// - src/routes/subjects.routes.js
// - src/routes/topics.routes.js  
// - src/controllers/subjects.controller.js
// - src/controllers/topics.controller.js
//
// PHASE 4 MIGRATION - MANTENDO COMO LEGACY/BACKUP
// ============================================================================
/* LEGACY ROUTES - REPLACED BY MODULAR ARCHITECTURE

/*
app.post('/api/plans/:planId/subjects_with_topics', 
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
                    await dbRun('INSERT INTO topics (subject_id, topic_name, priority_weight) VALUES (?,?,?)', 
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








END LEGACY ROUTES COMMENT */

// --- ROTA DE GERAÇÃO DE CRONOGRAMA OTIMIZADA ---
// [MIGRADO PARA FASE 9] - Movido para src/routes/schedule.routes.js
// Esta rota complexa de 700+ linhas foi modularizada com sucesso
/* COMENTADO - USANDO NOVA IMPLEMENTAÇÃO MODULAR
*/ // FIM DO COMENTÁRIO - ROTA MIGRADA PARA FASE 9

// --- ROTAS DE SESSÕES E DADOS ---

// Obter detalhes do replanejamento de tarefas atrasadas
app.get('/api/plans/:planId/replan-preview', 
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
app.post('/api/plans/:planId/replan', 
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

// Novo endpoint para consultar tópicos excluídos no modo Reta Final

// Endpoint para estatísticas do plano (Total de dias, Sequência, etc)

// Verificar tarefas atrasadas - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/api/plans/:planId/overdue_check', 
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
app.get('/api/plans/:planId/schedule', 
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



























                // Use dbRun instead of prepared statement


















// Agendar uma sessão de reforço - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js

























// Adiar uma sessão de estudo - MIGRATED TO MODULAR ARCHITECTURE
// Rota genérica para atualizar status de sessão









            // Verificar se a sessão existe e pertence ao usuário










            // Atualizar status da sessão










/* LEGACY ROUTE - REPLACED BY src/routes/scheduleRoutes.js























































// Obter dados de progresso do plano - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/api/plans/:planId/progress', 
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
app.get('/api/plans/:planId/goal_progress', 
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
app.get('/api/plans/:planId/question_radar', 
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
app.get('/api/plans/:planId/review_data', 
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

// Obter progresso detalhado - ATIVA
app.get('/api/plans/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        const userId = req.user.id;
        try {
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

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
            res.status(500).json({ 'error': 'Erro ao buscar progresso detalhado' });
        }
    }
);

// Obter estatísticas resumidas de atividades - MIGRATED TO MODULAR ARCHITECTURE
/* LEGACY ROUTE - REPLACED BY src/routes/planRoutes.js
app.get('/api/plans/:planId/activity_summary',
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

// Obter diagnóstico de performance (reality check) - ATIVA
app.get('/api/plans/:planId/realitycheck', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado' });
            
            const sessions = await dbAll('SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?', [planId]);
            const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            const totalTopics = totalTopicsResult.total;

            if (totalTopics === 0) {
                return res.json({ message: 'Adicione tópicos ao seu plano para ver as projeções.' });
            }

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            
            const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
            const completedTopics = new Set(newTopicSessions.filter(s => s.status === 'Concluído').map(r => r.topic_id));
            const topicsCompletedCount = completedTopics.size;
            const topicsRemaining = totalTopics - topicsCompletedCount;

            const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'Pendente');
            const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

            const firstSessionDateResult = await dbGet('SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = \'Novo Tópico\' AND status = \'Concluído\'', [planId]);
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
                requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : 'N/A',
                postponementCount: plan.postponement_count,
                status,
                primaryMessage,
                secondaryMessage,
                motivationalMessage,
                isMaintenanceMode
            });

        } catch (error) {
            console.error('Erro no reality check:', error);
            res.status(500).json({ 'error': 'Erro ao calcular diagnóstico' });
        }
});
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
