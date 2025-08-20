#!/bin/bash

echo "🔧 Corrigindo memory leak no servidor..."

# Backup do arquivo atual
ssh editaliza "cp /root/editaliza/src/config/passport.js /root/editaliza/src/config/passport.js.backup"

# Criar versão corrigida
cat << 'EOF' > passport_fixed.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

// Garantir que o log só execute uma vez
let configuredOnce = false;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const CALLBACK_URL = 'https://app.editaliza.com.br/auth/google/callback';
    
    if (!configuredOnce) {
        console.log('🔐 Google OAuth configurado com URL:', CALLBACK_URL);
        configuredOnce = true;
    }
    
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        passReqToCallback: false
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('✅ OAuth Success! User:', profile.emails[0].value);
            const user = await authService.processGoogleCallback(profile);
            return done(null, user);
        } catch (error) {
            console.error('❌ Google OAuth Error:', error);
            return done(error, null);
        }
    }));
} else {
    if (!configuredOnce) {
        console.warn('⚠️  Google OAuth credentials not configured');
        configuredOnce = true;
    }
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

module.exports = passport;
EOF

# Copiar arquivo corrigido para o servidor
scp passport_fixed.js editaliza:/root/editaliza/src/config/passport.js

# Reiniciar aplicação
ssh editaliza "cd /root/editaliza && pm2 restart editaliza-app"

echo "✅ Correção aplicada!"

# Aguardar 5 segundos
sleep 5

# Verificar logs
echo "📊 Verificando logs após correção..."
ssh editaliza "pm2 logs editaliza-app --lines 10 --nostream"

# Limpar arquivo temporário
rm passport_fixed.js