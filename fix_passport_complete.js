const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Verificar se já foi configurado (singleton pattern)
if (!global._passportConfigured) {
    global._passportConfigured = true;
    
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const CALLBACK_URL = 'https://app.editaliza.com.br/auth/google/callback';
        
        console.log('🔐 Google OAuth configurado com URL:', CALLBACK_URL);
        
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: CALLBACK_URL,
            passReqToCallback: false
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('✅ OAuth Success! User:', profile.emails[0].value);
                const authService = require('../services/authService');
                const user = await authService.processGoogleCallback(profile);
                return done(null, user);
            } catch (error) {
                console.error('❌ Google OAuth Error:', error);
                return done(error, null);
            }
        }));
    } else {
        console.warn('⚠️  Google OAuth credentials not configured');
    }
    
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    
    passport.deserializeUser(async (id, done) => {
        try {
            const authRepository = require('../repositories/authRepository');
            const user = await authRepository.findUserById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
}

module.exports = passport;