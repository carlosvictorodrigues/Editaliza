/**
 * Auth Routes - Fixed OAuth callback issue
 * Trecho corrigido do arquivo authRoutes.js
 */

// ... código anterior ...

/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth
 * @access Public
 */
router.get('/google', (req, res, next) => {
    // Salvar origem para redirecionamento posterior
    const referer = req.get('referer') || req.get('origin') || '';
    req.session.oauth_origin = referer.includes('app.editaliza.com.br') ? 'app' : 'main';
    req.session.save((err) => {
        if (err) console.error('Erro ao salvar sessão:', err);
        
        // Configurar scope explicitamente
        passport.authenticate('google', { 
            scope: ['profile', 'email'],
            accessType: 'offline',
            prompt: 'select_account' // Força seleção de conta
        })(req, res, next);
    });
});

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback - Fixed
 * @access Public
 */
router.get('/google/callback', (req, res, next) => {
    console.log('🔍 Callback recebido com query:', req.query);
    
    // Verificar se há erro do Google
    if (req.query.error) {
        console.error('❌ Erro do Google:', req.query.error);
        return res.redirect('/login.html?error=' + req.query.error);
    }
    
    // Verificar se há código de autorização
    if (!req.query.code) {
        console.error('❌ Sem código de autorização');
        return res.redirect('/login.html?error=no_auth_code');
    }
    
    passport.authenticate('google', { 
        failureRedirect: '/login.html?error=oauth_failed',
        failWithError: false,
        session: true
    }, async (err, user, info) => {
        if (err) {
            console.error('❌ Erro na autenticação:', err);
            return res.redirect('/login.html?error=auth_error');
        }
        
        if (!user) {
            console.error('❌ Usuário não encontrado:', info);
            return res.redirect('/login.html?error=no_user');
        }
        
        // Login manual do usuário
        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                console.error('❌ Erro no login:', loginErr);
                return res.redirect('/login.html?error=login_failed');
            }
            
            try {
                // Gerar token JWT
                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                // Definir dados da sessão
                req.session.userId = user.id;
                req.session.loginTime = new Date();
                
                // Determinar URL de redirecionamento
                let redirectUrl = '/home.html';
                
                if (req.session.oauth_origin === 'app') {
                    redirectUrl = `https://app.editaliza.com.br/home.html?auth_success=1&token=${encodeURIComponent(token)}`;
                } else {
                    redirectUrl = `/home.html?auth_success=1&token=${encodeURIComponent(token)}`;
                }
                
                // Limpar origem da sessão
                delete req.session.oauth_origin;
                
                console.log('✅ OAuth concluído, redirecionando para:', redirectUrl);
                res.redirect(redirectUrl);
                
            } catch (error) {
                console.error('❌ Erro ao gerar token:', error);
                res.redirect('/login.html?error=token_generation_failed');
            }
        });
    })(req, res, next);
});

// ... resto do código ...