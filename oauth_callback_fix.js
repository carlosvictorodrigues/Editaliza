// OAuth Callback Defensivo com State Validation
// Este arquivo contém a implementação correta do callback OAuth

const router = require('express').Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// OAuth Callback com todas as proteções
router.get('/auth/google/callback', async (req, res, next) => {
  // 1. SHORT-CIRCUIT: Validar parâmetros obrigatórios
  if (!req.query.code || !req.query.state) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      details: 'Both code and state are required for OAuth callback',
      timestamp: new Date().toISOString()
    });
  }

  // 2. Validar state contra sessão (previne CSRF)
  if (req.session && req.session.oauthState) {
    if (req.session.oauthState !== req.query.state) {
      console.error('OAuth state mismatch:', {
        expected: req.session.oauthState,
        received: req.query.state
      });
      return res.status(400).json({ 
        error: 'Invalid state parameter',
        details: 'State validation failed - possible CSRF attempt'
      });
    }
    // Limpar state após validação
    delete req.session.oauthState;
  }

  // 3. Processar autenticação com Passport
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    // Erro na autenticação
    if (err) {
      console.error('OAuth authentication error:', err);
      // IMPORTANTE: Redirecionar para login, NUNCA para callback
      return res.redirect('https://app.editaliza.com.br/login?error=auth_failed');
    }

    // Usuário não autenticado
    if (!user) {
      console.warn('OAuth authentication failed - no user:', info);
      // IMPORTANTE: Redirecionar para login, NUNCA para callback
      return res.redirect('https://app.editaliza.com.br/login?error=no_user');
    }

    try {
      // 4. Gerar tokens JWT seguros
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          name: user.name,
          provider: 'google'
        },
        process.env.JWT_SECRET || 'temporary-secret-change-this',
        { 
          expiresIn: '7d',
          issuer: 'editaliza.com.br',
          audience: 'app.editaliza.com.br'
        }
      );

      // Gerar refresh token se necessário
      const refreshToken = jwt.sign(
        { 
          id: user.id,
          type: 'refresh'
        },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'temporary-secret',
        { 
          expiresIn: '30d',
          issuer: 'editaliza.com.br'
        }
      );

      // 5. Configurar sessão se estiver usando
      if (req.session) {
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.loginTime = new Date().toISOString();
      }

      // 6. IMPORTANTE: SEMPRE redirecionar para a aplicação, NUNCA para o callback
      // Passar tokens via query params temporariamente (considere usar cookies seguros)
      const redirectUrl = new URL('https://app.editaliza.com.br/dashboard');
      redirectUrl.searchParams.append('token', token);
      redirectUrl.searchParams.append('refresh', refreshToken);
      
      console.log('OAuth success for user:', user.email);
      return res.redirect(redirectUrl.toString());

    } catch (tokenError) {
      console.error('Token generation failed:', tokenError);
      // Em caso de erro, redirecionar para login
      return res.redirect('https://app.editaliza.com.br/login?error=token_failed');
    }
  })(req, res, next);
});

// Rota para iniciar OAuth (gera state)
router.get('/auth/google', (req, res, next) => {
  // Gerar state aleatório para prevenir CSRF
  const state = require('crypto').randomBytes(32).toString('hex');
  
  // Salvar state na sessão
  if (req.session) {
    req.session.oauthState = state;
  }

  // Iniciar fluxo OAuth com state
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: state,
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
});

// Health check para OAuth
router.get('/auth/health', (req, res) => {
  res.json({
    status: 'ok',
    oauth: 'configured',
    provider: 'google',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;