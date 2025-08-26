/**
 * Session Management Configuration
 * 
 * Centralizes all session-related configuration including:
 * - Session store configuration
 * - Cookie settings
 * - Security settings
 * 
 * PHASE 7: Configuration Modularization
 * Created: 2025-08-25
 */

const environment = require('./environment');
const databaseConfig = require('./database.config');
const crypto = require('crypto');

/**
 * Session Cookie Configuration
 * Adapts settings based on environment (dev vs prod)
 */
const cookieConfig = {
    secure: environment.IS_PRODUCTION,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: environment.IS_PRODUCTION ? 'none' : 'lax',
    domain: environment.IS_PRODUCTION ? '.editaliza.com.br' : undefined
};

/**
 * Generate Session Secret
 * Uses environment variable or generates secure random secret
 * @returns {string} Session secret
 */
function generateSessionSecret() {
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }
    
    if (environment.IS_PRODUCTION) {
        throw new Error('SESSION_SECRET must be set in production environment');
    }
    
    // Generate random secret for development
    const secret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ Using generated session secret for development. Set SESSION_SECRET in production.');
    return secret;
}

/**
 * Complete Session Configuration
 * Ready to be used with express-session middleware
 */
const sessionConfig = {
    store: databaseConfig.createSessionStore(),
    secret: generateSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request
    cookie: cookieConfig,
    
    // Session name
    name: 'editaliza.sid',
    
    // Additional security options
    proxy: environment.IS_PRODUCTION, // Trust proxy in production
    
    // Generate session ID
    genid: () => crypto.randomUUID()
};

/**
 * Session Debug Middleware
 * Logs session information for debugging (development only)
 */
function createSessionDebugMiddleware() {
    if (environment.IS_PRODUCTION) {
        // No debugging in production
        return (req, res, next) => next();
    }
    
    return (req, res, next) => {
        // Only log for OAuth routes
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
    };
}

/**
 * Session Security Validation
 * Validates session configuration for security best practices
 */
function validateSessionSecurity() {
    const issues = [];
    
    if (environment.IS_PRODUCTION) {
        if (!sessionConfig.cookie.secure) {
            issues.push('Cookies should be secure in production');
        }
        
        if (!sessionConfig.cookie.httpOnly) {
            issues.push('Cookies should be httpOnly for security');
        }
        
        if (sessionConfig.secret.length < 32) {
            issues.push('Session secret should be at least 32 characters');
        }
    }
    
    return issues;
}

/**
 * Initialize Session Configuration
 * Validates and returns session configuration
 */
function initializeSessionConfig() {
    const securityIssues = validateSessionSecurity();
    
    if (securityIssues.length > 0) {
        console.warn('⚠️ Session security issues:');
        securityIssues.forEach(issue => console.warn(`   - ${issue}`));
        
        if (environment.IS_PRODUCTION) {
            throw new Error('Session security validation failed in production');
        }
    }
    
    if (environment.IS_DEVELOPMENT) {
        console.log('✅ Session configuration loaded:');
        console.log('   Store type:', sessionConfig.store.constructor.name);
        console.log('   Cookie secure:', sessionConfig.cookie.secure);
        console.log('   Cookie domain:', sessionConfig.cookie.domain || 'localhost');
        console.log('   Max age:', Math.floor(sessionConfig.cookie.maxAge / (60 * 60 * 1000)), 'hours');
    }
    
    return sessionConfig;
}

module.exports = {
    sessionConfig: initializeSessionConfig(),
    cookieConfig,
    createSessionDebugMiddleware,
    validateSessionSecurity
};