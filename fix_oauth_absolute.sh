#!/bin/bash
# Correção definitiva - usar URL absoluto e callback fixo

echo "=== Aplicando correção OAuth com URL absoluto ==="

ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv

# Verificar configuração atual
echo "Configuração atual do Google OAuth:"
grep -E "GOOGLE_|CALLBACK" .env

# Criar arquivo de configuração Passport corrigido
cat > src/config/passport.js << 'PASSPORT'
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

console.log('🔧 Configurando Passport OAuth');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // IMPORTANTE: Usar URL absoluto SEMPRE
    const CALLBACK_URL = "https://editaliza.com.br/auth/google/callback";
    
    console.log('📍 Configuração OAuth:');
    console.log('   Client ID:', process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...');
    console.log('   Callback URL:', CALLBACK_URL);
    
    passport.use('google', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        proxy: true,
        state: true,
        passReqToCallback: false // Mudando para false
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('✅ Google OAuth callback executado');
            console.log('   Profile ID:', profile.id);
            console.log('   Email:', profile.emails?.[0]?.value);
            
            const user = await authService.processGoogleCallback(profile);
            console.log('✅ Usuário processado:', user.email);
            
            return done(null, user);
        } catch (error) {
            console.error('❌ Erro processando usuário:', error.message);
            return done(error, false);
        }
    }));
    
    console.log('✅ Google Strategy configurada');
} else {
    console.error('❌ Credenciais Google OAuth não configuradas');
}

passport.serializeUser((user, done) => {
    console.log('📦 Serializando usuário:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const authRepository = require('../repositories/authRepository');
        const user = await authRepository.findUserById(id);
        done(null, user);
    } catch (error) {
        console.error('❌ Erro deserializando:', error.message);
        done(error, null);
    }
});

module.exports = passport;
PASSPORT

# Atualizar .env para garantir callback URL correto
sed -i 's|GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://editaliza.com.br/auth/google/callback|' .env

# Verificar mudança
echo ""
echo "Nova configuração:"
grep GOOGLE_CALLBACK_URL .env

# Reiniciar servidor
pm2 restart editaliza-app

echo ""
echo "=== Servidor reiniciado com correções ==="
echo ""
echo "IMPORTANTE: Verifique no Google Console se o callback URL está:"
echo "https://editaliza.com.br/auth/google/callback"
echo ""
echo "Se não estiver, adicione exatamente esse URL!"

EOF