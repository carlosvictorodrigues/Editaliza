/**
 * OAuth Configuration Module
 * 
 * Centralizes OAuth provider configurations:
 * - Google OAuth settings
 * - Callback URLs
 * - Scope definitions
 * - Provider validation
 * 
 * PHASE 7: Configuration Modularization
 * Created: 2025-08-25
 */

const environment = require('./environment');

/**
 * Google OAuth Configuration
 */
const googleOAuthConfig = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || (
        environment.IS_PRODUCTION 
            ? 'https://app.editaliza.com.br/auth/google/callback'
            : 'http://localhost:3000/auth/google/callback'
    ),
    scope: ['profile', 'email'],
    
    // OAuth 2.0 settings
    accessType: 'offline',
    prompt: 'consent',
    
    // Validation
    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
};

/**
 * OAuth Providers Registry
 * Centralized configuration for all OAuth providers
 */
const oauthProviders = {
    google: googleOAuthConfig,
    
    // Future providers can be added here
    // facebook: facebookOAuthConfig,
    // github: githubOAuthConfig,
};

/**
 * OAuth Route Configuration
 * Defines routes and their corresponding providers
 */
const oauthRoutes = {
    google: {
        auth: '/auth/google',
        callback: '/auth/google/callback',
        failure: '/login.html?error=oauth_failed',
        success: '/dashboard.html'
    }
};

/**
 * OAuth Security Settings
 */
const oauthSecurity = {
    // Session-based state verification
    useSession: true,
    
    // CSRF protection for OAuth flows
    csrfProtection: true,
    
    // Callback URL validation
    validateCallbackURL: true,
    
    // Rate limiting for OAuth endpoints
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10 // Maximum 10 OAuth attempts per window
    }
};

/**
 * Validate OAuth Configuration
 * Checks if OAuth providers are properly configured
 */
function validateOAuthConfig() {
    const issues = [];
    
    // Validate Google OAuth
    if (!googleOAuthConfig.enabled) {
        if (environment.IS_PRODUCTION) {
            issues.push('Google OAuth not configured in production');
        } else {
            console.warn('⚠️ Google OAuth not configured (development mode)');
        }
    } else {
        // Validate callback URL format
        try {
            new URL(googleOAuthConfig.callbackURL);
        } catch (error) {
            issues.push('Invalid Google OAuth callback URL format');
        }
        
        // Validate client credentials format
        if (!googleOAuthConfig.clientID.includes('.googleusercontent.com')) {
            issues.push('Invalid Google OAuth client ID format');
        }
    }
    
    return issues;
}

/**
 * Get OAuth Provider by Name
 * @param {string} providerName - Name of the OAuth provider
 * @returns {object|null} Provider configuration or null if not found
 */
function getOAuthProvider(providerName) {
    const provider = oauthProviders[providerName.toLowerCase()];
    
    if (!provider) {
        console.error(`OAuth provider '${providerName}' not found`);
        return null;
    }
    
    if (!provider.enabled) {
        console.error(`OAuth provider '${providerName}' is not enabled`);
        return null;
    }
    
    return provider;
}

/**
 * Get Enabled OAuth Providers
 * @returns {Array} List of enabled OAuth providers
 */
function getEnabledProviders() {
    return Object.entries(oauthProviders)
        .filter(([name, config]) => config.enabled)
        .map(([name, config]) => ({ name, ...config }));
}

/**
 * OAuth Configuration Summary
 * @returns {object} Summary of OAuth configuration status
 */
function getOAuthInfo() {
    const enabledProviders = getEnabledProviders();
    
    return {
        providersAvailable: Object.keys(oauthProviders).length,
        providersEnabled: enabledProviders.length,
        providers: enabledProviders.map(p => ({
            name: p.name,
            callbackURL: p.callbackURL,
            scope: p.scope
        })),
        security: {
            sessionBased: oauthSecurity.useSession,
            csrfProtected: oauthSecurity.csrfProtection,
            rateLimited: true
        }
    };
}

/**
 * Initialize OAuth Configuration
 * Validates configuration and logs status
 */
function initializeOAuthConfig() {
    const validationIssues = validateOAuthConfig();
    
    if (validationIssues.length > 0) {
        console.warn('⚠️ OAuth configuration issues:');
        validationIssues.forEach(issue => console.warn(`   - ${issue}`));
        
        if (environment.IS_PRODUCTION) {
            console.error('❌ OAuth configuration invalid for production');
        }
    }
    
    if (environment.IS_DEVELOPMENT) {
        const info = getOAuthInfo();
        console.log('✅ OAuth configuration loaded:');
        console.log(`   Providers enabled: ${info.providersEnabled}/${info.providersAvailable}`);
        
        info.providers.forEach(provider => {
            console.log(`   - ${provider.name}: ${provider.callbackURL}`);
        });
    }
    
    return {
        providers: oauthProviders,
        routes: oauthRoutes,
        security: oauthSecurity,
        getProvider: getOAuthProvider,
        getEnabledProviders,
        getInfo: getOAuthInfo
    };
}

module.exports = initializeOAuthConfig();