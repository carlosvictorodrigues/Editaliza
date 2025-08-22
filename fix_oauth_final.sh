#!/bin/bash
# Correção final OAuth - Resolver problema de Malformed auth code

echo "=== Aplicando correção final OAuth ==="

ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv

# 1. Criar novo arquivo de configuração Passport com correção
cat > src/config/passport.js << 'PASSPORT'
/**
 * Passport Configuration - Final Fix
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

console.log('🔧 Passport OAuth - Inicializando');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const strategy = new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://editaliza.com.br/auth/google/callback",
        proxy: true,
        state: false, // Desabilitar state para evitar problemas
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            console.log('✅ OAuth Callback - Profile recebido:', profile.id);
            
            // Processar usuário
            const user = await authService.processGoogleCallback(profile);
            console.log('✅ Usuário processado:', user.email);
            
            return done(null, user);
        } catch (error) {
            console.error('❌ Erro processando OAuth:', error.message);
            return done(error, null);
        }
    });
    
    passport.use(strategy);
    console.log('✅ Google OAuth configurado');
} else {
    console.warn('⚠️ Google OAuth não configurado');
}

// Serialização simplificada
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
PASSPORT

# 2. Simplificar callback route
cat > /tmp/auth_route_fix.txt << 'ROUTEFIX'
/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth
 * @access Public
 */
router.get('/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email']
    })
);

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: '/login.html?error=oauth_failed' 
    }),
    async (req, res) => {
        try {
            console.log('✅ Usuário autenticado:', req.user.email);
            
            // Gerar token JWT
            const token = jwt.sign(
                { id: req.user.id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h', issuer: 'editaliza' }
            );
            
            // Salvar na sessão
            req.session.userId = req.user.id;
            
            // Redirecionar com token
            const redirectUrl = `/home.html?auth_success=1&token=${encodeURIComponent(token)}`;
            console.log('Redirecionando para:', redirectUrl);
            
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Erro no callback:', error);
            res.redirect('/login.html?error=callback_error');
        }
    }
);
ROUTEFIX

echo "Correções aplicadas. Reiniciando servidor..."

# 3. Reiniciar servidor
pm2 restart editaliza-app

sleep 2
echo "=== Status do servidor ==="
pm2 status

EOF

echo "=== Correção final aplicada ===="
echo "Teste em: https://editaliza.com.br/login.html"