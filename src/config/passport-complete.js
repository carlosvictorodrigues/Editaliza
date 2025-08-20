/**
 * Passport Configuration - Complete Solution
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

console.log('🔧 Inicializando Passport OAuth');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // URL de callback deve corresponder EXATAMENTE ao configurado no Google Console
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || "https://editaliza.com.br/auth/google/callback";
    
    console.log('📍 Configurando Google OAuth');
    console.log('📍 Callback URL:', callbackURL);
    console.log('📍 Client ID:', process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...');
    
    const googleStrategy = new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
        passReqToCallback: true,
        proxy: true // Importante para funcionar atrás do Nginx
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('✅ Google Strategy Callback executado');
            console.log('   Profile ID:', profile.id);
            console.log('   Email:', profile.emails?.[0]?.value);
            console.log('   Nome:', profile.displayName);
            
            // Processar ou criar usuário
            const user = await authService.processGoogleCallback(profile);
            
            console.log('✅ Usuário processado com sucesso');
            console.log('   User ID:', user.id);
            console.log('   User Email:', user.email);
            
            return done(null, user);
        } catch (error) {
            console.error('❌ Erro no processamento OAuth:', error);
            console.error('   Mensagem:', error.message);
            console.error('   Stack:', error.stack);
            return done(error, null);
        }
    });
    
    passport.use(googleStrategy);
    console.log('✅ Google Strategy registrada com sucesso');
} else {
    console.error('❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados');
}

// Serialização de usuário para sessão
passport.serializeUser((user, done) => {
    console.log('📦 Serializando usuário ID:', user.id);
    done(null, user.id);
});

// Deserialização de usuário da sessão
passport.deserializeUser(async (id, done) => {
    console.log('📦 Deserializando usuário ID:', id);
    try {
        const authRepository = require('../repositories/authRepository');
        const user = await authRepository.findUserById(id);
        if (user) {
            console.log('✅ Usuário deserializado:', user.email);
        } else {
            console.log('⚠️ Usuário não encontrado:', id);
        }
        done(null, user);
    } catch (error) {
        console.error('❌ Erro ao deserializar:', error.message);
        done(error, null);
    }
});

module.exports = passport;