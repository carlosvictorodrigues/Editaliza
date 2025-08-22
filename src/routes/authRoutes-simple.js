// ROTAS OAUTH SIMPLIFICADAS

/**
 * @route GET /auth/google
 * @desc Initiate Google OAuth
 * @access Public
 */
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    async (req, res) => {
        try {
            const token = jwt.sign(
                { id: req.user.id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            req.session.userId = req.user.id;
            res.redirect(`/home.html?token=${encodeURIComponent(token)}`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login.html');
        }
    }
);