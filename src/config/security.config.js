/**
 * Security Configuration Module
 * 
 * Centralizes all security-related middleware and configuration:
 * - CORS settings
 * - Helmet (CSP, HSTS, etc.)
 * - Rate limiting
 * - CSRF protection
 * - Input sanitization
 * 
 * PHASE 7: Configuration Modularization
 * Created: 2025-08-25
 */

const environment = require('./environment');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * CORS Configuration
 * Allows requests from approved origins only
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://app.editaliza.com.br',
    'https://editaliza.com.br'
];

const corsConfig = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, server-to-server, health checks)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn('⚠️ CORS blocked origin:', origin, 'Allowed:', allowedOrigins);
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    exposedHeaders: ['X-Total-Count']
};

/**
 * Content Security Policy (CSP) Configuration
 * Hardened CSP without unsafe-inline, uses nonces
 */
const cspConfig = {
    directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
            "'self'", 
            'https://cdn.tailwindcss.com', 
            'https://fonts.googleapis.com',
            (req, res) => `'nonce-${res.locals.nonce}'`
        ],
        scriptSrc: [
            "'self'", 
            'https://cdn.tailwindcss.com',
            (req, res) => `'nonce-${res.locals.nonce}'`
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'https://lh3.googleusercontent.com'], // Google avatars
        connectSrc: ["'self'", 'https://accounts.google.com'],
        formAction: ["'self'", 'https://accounts.google.com'],
        objectSrc: ["'none'"], // Block Flash/plugins
        baseUri: ["'self'"], // Prevent base href attacks
        frameAncestors: ["'none'"], // Clickjacking protection
        // upgradeInsecureRequests: [], // Temporarily disabled due to helmet version compatibility
    }
};

/**
 * Helmet Configuration
 * Comprehensive security headers
 */
const helmetConfig = {
    contentSecurityPolicy: cspConfig,
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false // Disable for compatibility
};

/**
 * Rate Limiting Configurations
 */
const rateLimitConfigs = {
    // Global rate limiting
    global: rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (environment.IS_PRODUCTION ? 300 : 1000),
        message: { 
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            const skipPaths = [
                '/health', '/ready', // Health checks
                '/gamification', '/schedule', '/overdue_check',
                '/progress', '/goal_progress', '/realitycheck',
                '/settings', '/generate', '/batch_update'
            ];
            return skipPaths.some(path => req.path.endsWith(path)) || 
                   req.path.includes('/plans/') || 
                   req.path.includes('/topics/');
        }
    }),
    
    // Strict rate limiting for authentication
    strict: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: environment.IS_PRODUCTION ? 5 : 50,
        message: { 
            error: 'Too many authentication attempts. Please try again in 15 minutes.',
            code: 'AUTH_RATE_LIMITED'
        },
        skipSuccessfulRequests: true
    }),
    
    // Moderate rate limiting for APIs
    moderate: rateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: environment.IS_PRODUCTION ? 100 : 500,
        message: { 
            error: 'API rate limit exceeded. Please wait a moment.',
            code: 'API_RATE_LIMITED'
        }
    }),
    
    // Login-specific rate limiting
    login: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: { 
            error: 'Too many login attempts. Please try again in 15 minutes.',
            code: 'LOGIN_RATE_LIMITED'
        },
        skipSuccessfulRequests: true
    })
};

/**
 * CSRF Token Generation and Validation
 */
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware
 */
function createCSRFProtection() {
    return (req, res, next) => {
        // Skip CSRF for safe methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return next();
        }
        
        // Skip CSRF for public auth routes
        const skipCSRF = [
            '/login', '/register', '/auth/login', '/auth/register',
            '/auth/google', '/auth/google/callback',
            '/request-password-reset', '/reset-password',
            '/csrf-token'
        ];
        
        if (skipCSRF.includes(req.path)) {
            return next();
        }
        
        // Skip CSRF for API routes with JWT authentication
        const isAPIRoute = req.path.startsWith('/api/');
        const hasJWTAuth = req.headers.authorization?.startsWith('Bearer ');
        
        if (isAPIRoute && hasJWTAuth) {
            return next();
        }
        
        // Validate CSRF token
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        const sessionToken = req.session?.csrfToken;
        
        if (!token || !sessionToken || token !== sessionToken) {
            return res.status(403).json({
                error: 'CSRF token validation failed',
                code: 'CSRF_INVALID'
            });
        }
        
        next();
    };
}

/**
 * Nonce Generation Middleware
 * Generates unique nonce for each request for CSP
 */
function nonceMiddleware(req, res, next) {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    
    // Generate CSRF token for authenticated sessions
    if (req.session && !req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }
    
    // Make CSRF token available to templates
    res.locals.csrfToken = req.session?.csrfToken || '';
    
    next();
}

/**
 * Input Sanitization
 * Basic XSS and injection prevention
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
        .replace(/[<>"'&]/g, (match) => {
            const htmlEntities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return htmlEntities[match];
        })
        .trim();
}

/**
 * Global Input Sanitization Middleware
 */
function sanitizationMiddleware(req, res, next) {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeInput(req.query[key]);
            }
        }
    }
    
    next();
}

/**
 * Security Logging
 * Logs security events for monitoring
 */
function securityLog(event, details) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        details,
        environment: environment.NODE_ENV
    };
    
    if (environment.IS_DEVELOPMENT) {
        console.log('🔒 Security Event:', JSON.stringify(logEntry, null, 2));
    } else {
        // In production, you might want to send to a logging service
        console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
    }
}

/**
 * Security Configuration Summary
 */
function getSecurityInfo() {
    return {
        cors: {
            allowedOrigins: allowedOrigins.length,
            credentialsEnabled: corsConfig.credentials
        },
        csp: {
            nonceEnabled: true,
            unsafeInlineBlocked: true
        },
        rateLimit: {
            globalLimit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (environment.IS_PRODUCTION ? 300 : 1000),
            authLimit: environment.IS_PRODUCTION ? 5 : 50
        },
        csrf: {
            enabled: true,
            tokenValidation: true
        }
    };
}

module.exports = {
    corsConfig,
    helmetConfig,
    rateLimitConfigs,
    nonceMiddleware,
    createCSRFProtection,
    sanitizeInput,
    sanitizationMiddleware,
    securityLog,
    generateCSRFToken,
    getSecurityInfo
};