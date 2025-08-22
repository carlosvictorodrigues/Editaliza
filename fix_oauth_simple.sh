#!/bin/bash
# SOLUÇÃO SIMPLES E DIRETA - OAuth Google

echo "=== CORREÇÃO DEFINITIVA OAUTH ==="

ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv

# 1. Adicionar trust proxy no server.js (ESSENCIAL para Nginx)
if ! grep -q "trust proxy" server.js; then
    sed -i "/const app = express/a app.set('trust proxy', 1);" server.js
    echo "✅ Trust proxy adicionado"
fi

# 2. Criar configuração Passport SIMPLES
cat > src/config/passport.js << 'PASSPORT'
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

// Configuração SIMPLES e DIRETA
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",  // URL relativo, deixa o Express resolver
        proxy: true  // ESSENCIAL para funcionar com Nginx
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await authService.processGoogleCallback(profile);
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
}

passport.serializeUser((user, done) => done(null, user.id));
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

# 3. Criar rotas SIMPLES
cat > /tmp/oauth_routes.txt << 'ROUTES'
// OAuth Google - SIMPLES E DIRETO
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    async (req, res) => {
        try {
            const token = jwt.sign(
                { id: req.user.id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.redirect(`/home.html?token=${encodeURIComponent(token)}`);
        } catch (error) {
            res.redirect('/login.html?error=1');
        }
    }
);
ROUTES

echo "✅ Arquivos criados"

# 4. Reiniciar servidor
pm2 restart editaliza-app

echo ""
echo "=== PRONTO! ==="
echo "Teste em: https://editaliza.com.br/login.html"
echo ""

# Mostrar logs em tempo real
pm2 logs editaliza-app --lines 5

EOF