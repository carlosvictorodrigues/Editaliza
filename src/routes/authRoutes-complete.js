// Trecho corrigido das rotas OAuth - authRoutes.js

/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth
 * @access Public
 */
router.get('/google', (req, res, next) => {
    console.log('🔍 Iniciando OAuth Google');
    console.log('   Referer:', req.get('referer'));
    console.log('   Session ID:', req.sessionID);
    
    // Salvar origem para redirecionamento posterior
    const referer = req.get('referer') || '';
    if (referer.includes('app.editaliza.com.br')) {
        req.session.oauth_origin = 'app';
        console.log('   Origem: app.editaliza.com.br');
    } else {
        req.session.oauth_origin = 'main';
        console.log('   Origem: editaliza.com.br');
    }
    
    // Salvar sessão antes de redirecionar
    req.session.save((err) => {
        if (err) {
            console.error('❌ Erro ao salvar sessão:', err);
        }
        
        // Iniciar autenticação OAuth
        passport.authenticate('google', {
            scope: ['profile', 'email'],
            prompt: 'select_account' // Força seleção de conta
        })(req, res, next);
    });
});

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get('/google/callback', (req, res, next) => {
    console.log('🔍 Callback OAuth recebido');
    console.log('   Query params:', Object.keys(req.query));
    console.log('   Session ID:', req.sessionID);
    console.log('   Session origin:', req.session?.oauth_origin);
    
    // Verificar erros do Google
    if (req.query.error) {
        console.error('❌ Google retornou erro:', req.query.error);
        if (req.query.error_description) {
            console.error('   Descrição:', req.query.error_description);
        }
        return res.redirect('/login.html?error=' + encodeURIComponent(req.query.error));
    }
    
    // Verificar código de autorização
    if (!req.query.code) {
        console.error('❌ Código de autorização ausente');
        return res.redirect('/login.html?error=no_code');
    }
    
    console.log('✅ Código de autorização presente');
    console.log('   Code length:', req.query.code.length);
    
    // Processar autenticação
    passport.authenticate('google', {
        failureRedirect: '/login.html?error=oauth_failed',
        session: true
    }, async (err, user, info) => {
        console.log('🔍 Passport authenticate callback');
        
        if (err) {
            console.error('❌ Erro no Passport:', err.message);
            console.error('   Stack:', err.stack);
            return res.redirect('/login.html?error=auth_error');
        }
        
        if (!user) {
            console.error('❌ Usuário não retornado pelo Passport');
            console.error('   Info:', info);
            return res.redirect('/login.html?error=no_user');
        }
        
        console.log('✅ Usuário autenticado:', user.email);
        
        // Fazer login do usuário
        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                console.error('❌ Erro ao fazer login:', loginErr);
                return res.redirect('/login.html?error=login_error');
            }
            
            try {
                // Gerar token JWT
                const token = jwt.sign(
                    { id: user.id, email: user.email },
                    process.env.JWT_SECRET || 'fallback-secret',
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                console.log('✅ Token JWT gerado');
                
                // Salvar na sessão
                req.session.userId = user.id;
                req.session.loginTime = new Date();
                
                // Determinar redirecionamento
                let redirectUrl = '/home.html?auth_success=1&token=' + encodeURIComponent(token);
                
                if (req.session.oauth_origin === 'app') {
                    redirectUrl = 'https://app.editaliza.com.br' + redirectUrl;
                    console.log('   Redirecionando para app.editaliza.com.br');
                } else {
                    console.log('   Redirecionando para editaliza.com.br');
                }
                
                // Limpar flag de origem
                delete req.session.oauth_origin;
                
                // Salvar sessão e redirecionar
                req.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('⚠️ Erro ao salvar sessão final:', saveErr);
                    }
                    console.log('✅ Redirecionando para:', redirectUrl);
                    res.redirect(redirectUrl);
                });
                
            } catch (tokenError) {
                console.error('❌ Erro ao gerar token:', tokenError);
                res.redirect('/login.html?error=token_error');
            }
        });
    })(req, res, next);
});