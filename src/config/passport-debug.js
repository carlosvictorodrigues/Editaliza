/**
 * Passport Configuration with Debug - OAuth strategies and session handling
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

console.log('🔧 Passport Debug - Inicializando configuração');
console.log('GOOGLE_CLIENT_ID presente?', !!process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_CLIENT_SECRET presente?', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);

// Configure Google OAuth Strategy (only if credentials are available)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleConfig = {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        passReqToCallback: true
    };
    
    console.log('🔧 Google Strategy Config:', {
        clientID: googleConfig.clientID.substring(0, 10) + '...',
        callbackURL: googleConfig.callbackURL
    });
    
    passport.use(new GoogleStrategy(googleConfig, 
        async (req, accessToken, refreshToken, profile, done) => {
            console.log('🔧 Google Callback executado');
            console.log('Profile ID:', profile.id);
            console.log('Profile Email:', profile.emails?.[0]?.value);
            console.log('Session ID:', req.sessionID);
            
            try {
                // Use auth service to process OAuth callback
                const user = await authService.processGoogleCallback(profile);
                console.log('✅ Usuário processado:', user.id, user.email);
                return done(null, user);
            } catch (error) {
                console.error('❌ Google OAuth Error:', error);
                console.error('Stack:', error.stack);
                return done(error, null);
            }
        }
    ));
} else {
    console.warn('⚠️  Google OAuth credentials not configured - Google login will be disabled');
}

// Serialize user for session
passport.serializeUser((user, done) => {
    console.log('🔧 Serializing user:', user.id);
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    console.log('🔧 Deserializing user:', id);
    try {
        const authRepository = require('../repositories/authRepository');
        const user = await authRepository.findUserById(id);
        done(null, user);
    } catch (error) {
        console.error('❌ Deserialize error:', error);
        done(error, null);
    }
});

module.exports = passport;