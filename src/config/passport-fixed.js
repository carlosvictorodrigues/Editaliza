/**
 * Passport Configuration - Fixed OAuth Issue
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

console.log('🔧 Inicializando Passport com correções');

// Configure Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // IMPORTANTE: Usar callback URL absoluto
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || "https://editaliza.com.br/auth/google/callback";
    
    console.log('📍 Callback URL configurado:', callbackURL);
    
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
        proxy: true, // Importante para funcionar atrás do Nginx
        passReqToCallback: true,
        scope: ['profile', 'email']
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('✅ Google OAuth callback recebido');
            console.log('Profile ID:', profile.id);
            console.log('Profile Email:', profile.emails?.[0]?.value);
            
            const user = await authService.processGoogleCallback(profile);
            console.log('✅ Usuário processado com sucesso:', user.id);
            
            return done(null, user);
        } catch (error) {
            console.error('❌ Erro no processamento OAuth:', error);
            return done(error, null);
        }
    }));
    
    console.log('✅ Google OAuth Strategy configurada');
} else {
    console.warn('⚠️  Google OAuth não configurado - credenciais ausentes');
}

// Serialize user for session
passport.serializeUser((user, done) => {
    console.log('📦 Serializando usuário:', user.id);
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const authRepository = require('../repositories/authRepository');
        const user = await authRepository.findUserById(id);
        done(null, user);
    } catch (error) {
        console.error('❌ Erro ao deserializar usuário:', error);
        done(error, null);
    }
});

module.exports = passport;