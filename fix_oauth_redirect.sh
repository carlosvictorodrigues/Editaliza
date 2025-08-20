#!/bin/bash
# Script para corrigir o problema de OAuth entre domínios

cat << 'EOF' > /tmp/oauth_fix.js
// Arquivo: src/routes/authRoutes.js - Correção do callback OAuth

/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth with origin tracking
 * @access Public
 */
router.get('/google', (req, res, next) => {
    // Salvar o domínio de origem na sessão
    const origin = req.get('referer') || req.get('origin');
    if (origin) {
        req.session.oauth_origin = origin;
    }
    
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback with smart redirect
 * @access Public
 */
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html?error=oauth_failed' }),
    async (req, res) => {
        try {
            // Generate JWT token for the authenticated user
            const token = jwt.sign(
                { id: req.user.id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h', issuer: 'editaliza' }
            );
            
            // Set session data
            req.session.userId = req.user.id;
            req.session.loginTime = new Date();
            
            // Determinar para onde redirecionar baseado na origem
            let redirectUrl = '/home.html';
            const origin = req.session.oauth_origin;
            
            if (origin && origin.includes('app.editaliza.com.br')) {
                // Se veio de app.editaliza.com.br, redirecionar de volta para lá
                redirectUrl = `https://app.editaliza.com.br/home.html?auth_success=1&token=${encodeURIComponent(token)}`;
            } else {
                // Caso contrário, redirecionar localmente
                redirectUrl = `/home.html?auth_success=1&token=${encodeURIComponent(token)}`;
            }
            
            // Limpar a origem da sessão
            delete req.session.oauth_origin;
            
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('/login.html?error=oauth_callback_failed');
        }
    }
);
EOF

# Aplicar a correção no servidor
echo "Aplicando correção OAuth no servidor..."

# Criar backup
ssh root@161.35.127.123 "cd /opt/Editaliza-sv && cp src/routes/authRoutes.js src/routes/authRoutes.js.backup"

# Atualizar apenas as rotas do Google OAuth
ssh root@161.35.127.123 "cd /opt/Editaliza-sv && sed -i '/\\/auth\\/google.*{/,/^});/d' src/routes/authRoutes.js"

# Adicionar as novas rotas antes do module.exports
ssh root@161.35.127.123 "cd /opt/Editaliza-sv && sed -i '/module.exports = router;/i\\
/**\\
 * @route GET /auth/google\\
 * @desc Initiate Google OAuth with origin tracking\\
 * @access Public\\
 */\\
router.get('\''/google'\'', (req, res, next) => {\\
    // Salvar o domínio de origem na sessão\\
    const origin = req.get('\''referer'\'') || req.get('\''origin'\'');\\
    if (origin) {\\
        req.session.oauth_origin = origin;\\
    }\\
    \\
    passport.authenticate('\''google'\'', { scope: ['\''profile'\'', '\''email'\''] })(req, res, next);\\
});\\
\\
/**\\
 * @route GET /auth/google/callback\\
 * @desc Google OAuth callback with smart redirect\\
 * @access Public\\
 */\\
router.get('\''/google/callback'\'',\\
    passport.authenticate('\''google'\'', { failureRedirect: '\''/login.html?error=oauth_failed'\'' }),\\
    async (req, res) => {\\
        try {\\
            // Generate JWT token for the authenticated user\\
            const token = jwt.sign(\\
                { id: req.user.id, email: req.user.email },\\
                process.env.JWT_SECRET,\\
                { expiresIn: '\''24h'\'', issuer: '\''editaliza'\'' }\\
            );\\
            \\
            // Set session data\\
            req.session.userId = req.user.id;\\
            req.session.loginTime = new Date();\\
            \\
            // Determinar para onde redirecionar baseado na origem\\
            let redirectUrl = '\''/home.html'\'';\\
            const origin = req.session.oauth_origin;\\
            \\
            if (origin && origin.includes('\''app.editaliza.com.br'\'')) {\\
                // Se veio de app.editaliza.com.br, redirecionar de volta para lá\\
                redirectUrl = `https://app.editaliza.com.br/home.html?auth_success=1&token=${encodeURIComponent(token)}`;\\
            } else {\\
                // Caso contrário, redirecionar localmente\\
                redirectUrl = `/home.html?auth_success=1&token=${encodeURIComponent(token)}`;\\
            }\\
            \\
            // Limpar a origem da sessão\\
            delete req.session.oauth_origin;\\
            \\
            res.redirect(redirectUrl);\\
        } catch (error) {\\
            console.error('\''Google OAuth callback error:'\'', error);\\
            res.redirect('\''/login.html?error=oauth_callback_failed'\'');\\
        }\\
    }\\
);' src/routes/authRoutes.js"

# Reiniciar o servidor
ssh root@161.35.127.123 "cd /opt/Editaliza-sv && pm2 restart editaliza-app"

echo "Correção aplicada e servidor reiniciado!"