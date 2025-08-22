// tests/test-server.js - Servidor configurado para testes
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body } = require('express-validator');
const session = require('express-session');

// Importar middleware de segurança
const {
    sanitizeMiddleware,
    handleValidationErrors,
    authenticateToken,
    validators,
    bodySizeLimit
} = require('../middleware.js');

// Importar banco de dados de teste
const { getTestDb, dbGet, dbAll, dbRun } = require('./database-test');

// Função para criar servidor de teste
const createTestServer = () => {
    const app = express();

    // Configurações de segurança - Helmet (menos restritivo para testes)
    app.use(helmet({
        contentSecurityPolicy: false, // Desabilitar CSP para testes
        hsts: false // Desabilitar HSTS para testes
    }));

    // Configuração CORS mais permissiva para testes
    app.use(cors({
        origin: function (origin, callback) {
            // Permitir todas as origens em testes
            callback(null, true);
        },
        credentials: true,
        optionsSuccessStatus: 200
    }));

    // Configuração de sessão em memória para testes
    app.use(session({
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // HTTP em testes
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
        }
    }));

    // Middleware para parsing e sanitização com tratamento de erro
    app.use(express.json({ 
        limit: '10mb',
        verify: (req, res, buf, encoding) => {
            try {
                JSON.parse(buf);
            } catch (err) {
                const error = new Error('JSON malformado');
                error.status = 400;
                throw error;
            }
        }
    }));
    app.use(bodySizeLimit('10mb'));
    app.use(sanitizeMiddleware);

    // Rate limiting mais permissivo para testes, mas ainda testável
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 1000, // Muito permissivo para testes normais
        message: { error: 'Muitas requisições. Por favor, tente novamente mais tarde.' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
    });
    app.use(globalLimiter);

    // Rate limiting específico para login (mais restritivo para testar)
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: { error: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.' },
        skipSuccessfulRequests: true,
        skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
    });

    // --- ROTAS DE AUTENTICAÇÃO ---

    // Rota para registrar um novo usuário
    app.post('/register', 
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const hashedPassword = await bcrypt.hash(password, 12);
                await dbRun('INSERT INTO users (email, password_hash) VALUES (?,?)', [email, hashedPassword]);
                res.status(201).json({ 'message': 'Usuário criado com sucesso!' });
            } catch (error) {
                if (error.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Este e-mail já está em uso.' });
                } else {
                    console.error('Erro no registro:', error);
                    res.status(500).json({ error: 'Erro ao criar usuário.' });
                }
            }
        }
    );

    // Rota para login de usuário
    app.post('/login', 
        loginLimiter,
        validators.email,
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (!user || !await bcrypt.compare(password, user.password_hash)) {
                    return res.status(401).json({ 'error': 'E-mail ou senha inválidos.' });
                }
                
                // Gerar token com informações mínimas e expiração
                const token = jwt.sign(
                    { id: user.id, email: user.email }, 
                    process.env.JWT_SECRET, 
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                // Salvar informações da sessão
                req.session.userId = user.id;
                req.session.loginTime = new Date();
                
                res.json({ 'message': 'Login bem-sucedido!', 'token': token });
            } catch (error) {
                console.error('Erro no login:', error);
                res.status(500).json({ 'error': 'Erro no servidor.' });
            }
        }
    );

    // Rota para logout
    app.post('/logout', authenticateToken, (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Erro ao fazer logout' });
            }
            res.json({ message: 'Logout realizado com sucesso' });
        });
    });

    // Rota para solicitar redefinição de senha
    app.post('/request-password-reset',
        validators.email,
        handleValidationErrors,
        async (req, res) => {
            const { email } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (user) {
                    const token = crypto.randomBytes(32).toString('hex');
                    const expires = Date.now() + 3600000; // 1 hora
                    await dbRun('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, user.id]);
                    // Em testes, não enviamos e-mail real
                    console.log(`TESTE: Link de recuperação para ${user.email}: http://localhost:3000/reset-password.html?token=${token}`);
                }
                // Resposta genérica para evitar enumeração de usuários
                res.json({ message: 'Se um usuário com este e-mail existir, um link de recuperação foi enviado.' });
            } catch (error) {
                console.error('Erro na recuperação de senha:', error);
                res.status(500).json({ 'error': 'Erro no servidor ao processar a solicitação.' });
            }
        }
    );

    // Rota para redefinir a senha com um token
    app.post('/reset-password',
        body('token').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
        validators.password,
        handleValidationErrors,
        async (req, res) => {
            const { token, password } = req.body;
            try {
                const user = await dbGet('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?', [token, Date.now()]);
                if (!user) {
                    return res.status(400).json({ error: 'Token inválido ou expirado.' });
                }
                const hashedPassword = await bcrypt.hash(password, 12);
                await dbRun('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
                res.json({ message: 'Senha redefinida com sucesso!' });
            } catch (error) {
                console.error('Erro ao redefinir senha:', error);
                res.status(500).json({ 'error': 'Erro no servidor ao redefinir a senha.' });
            }
        }
    );

    // Rota para refresh de token
    app.post('/auth/refresh', async (req, res) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ error: 'Token não fornecido' });
            }
            
            // Verify old token (allow expired tokens for refresh)
            const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
            
            if (!decoded.id || !decoded.email) {
                return res.status(401).json({ error: 'Token malformado' });
            }
            
            // Check if token is too old to refresh (e.g., more than 7 days)
            const tokenAge = Date.now() / 1000 - decoded.iat;
            if (tokenAge > 7 * 24 * 60 * 60) { // 7 days
                return res.status(401).json({ error: 'Token muito antigo para renovação' });
            }
            
            // Get fresh user data
            const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.id]);
            if (!user) {
                return res.status(401).json({ error: 'Usuário não encontrado' });
            }
            
            // Generate new token
            const newToken = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    name: user.name
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '24h',
                    issuer: 'editaliza'
                }
            );
            
            // Update session
            if (req.session) {
                req.session.userId = user.id;
                req.session.loginTime = new Date();
            }
            
            res.json({
                token: newToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    auth_provider: user.auth_provider
                }
            });
        } catch (error) {
            console.error('Token refresh error:', error);
            
            if (error.name === 'TokenExpiredError') {
                // This shouldn't happen since we use ignoreExpiration: true
                return res.status(401).json({ error: 'Token expirado' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Token inválido' });
            }
            if (error.message.includes('expirado') ||
                error.message.includes('inválido') ||
                error.message.includes('malformado') ||
                error.message.includes('antigo')) {
                return res.status(401).json({ error: error.message });
            }
            
            res.status(500).json({ error: 'Erro ao renovar token' });
        }
    });

    // Rota de teste para verificar autenticação
    app.get('/protected', authenticateToken, (req, res) => {
        res.json({ 
            message: 'Acesso autorizado', 
            user: { id: req.user.id, email: req.user.email } 
        });
    });

    // Rota de healthcheck para testes
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', database: !!getTestDb() });
    });

    // --- ROTAS DE TESTE PARA OAUTH ---
    
    // Endpoint de teste para simular callback do Google OAuth
    app.post('/test/oauth/google/callback', async (req, res) => {
        try {
            const { profile, error } = req.body;
            
            // Handle OAuth provider errors
            if (error) {
                if (error === 'invalid_token') {
                    return res.status(401).json({ error: 'Token OAuth inválido' });
                }
                if (error === 'timeout') {
                    return res.status(503).json({ error: 'Timeout do provedor OAuth' });
                }
                return res.status(400).json({ error: `Erro OAuth: ${error}` });
            }
            
            // Validate required profile fields
            if (!profile || !profile.id || !profile.emails || !profile.emails[0]?.value) {
                return res.status(400).json({ error: 'Perfil OAuth inválido' });
            }
            
            const email = profile.emails[0].value;
            const googleId = profile.id;
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Email OAuth inválido' });
            }
            
            // Sanitize profile data
            const displayName = profile.displayName ? 
                profile.displayName.replace(/<[^>]*>/g, '').substring(0, 100) : '';
            
            let profilePicture = profile.photos?.[0]?.value || null;
            if (profilePicture && profilePicture.startsWith('javascript:')) {
                profilePicture = null; // Remove dangerous URLs
            }
            
            // Check if user already exists with Google ID
            let user = await dbGet('SELECT * FROM users WHERE google_id = ?', [googleId]);
            if (user) {
                return res.json({ 
                    message: 'Usuário OAuth existente encontrado',
                    user: { id: user.id, email: user.email, name: user.name }
                });
            }
            
            // Check if user exists with same email (link accounts)
            user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
            if (user) {
                // Link Google account to existing user
                await dbRun(`
                    UPDATE users 
                    SET google_id = ?, auth_provider = 'google', name = ?, profile_picture = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [googleId, displayName, profilePicture, user.id]);
                
                const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
                
                // Set session data for linked account
                req.session.userId = updatedUser.id;
                req.session.loginTime = new Date();
                
                // Set cookie for session
                res.cookie('connect.sid', 'test_session_' + updatedUser.id, {
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000
                });
                
                return res.json({
                    message: 'Conta Google vinculada com sucesso',
                    user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name }
                });
            }
            
            // Create new OAuth user
            const result = await dbRun(`
                INSERT INTO users (email, name, google_id, auth_provider, profile_picture, created_at, updated_at)
                VALUES (?, ?, ?, 'google', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [email, displayName, googleId, profilePicture]);
            
            const newUser = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
            
            // Set session data
            req.session.userId = newUser.id;
            req.session.loginTime = new Date();
            
            // Set cookie for session
            res.cookie('connect.sid', 'test_session_' + newUser.id, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000
            });
            
            res.json({
                message: 'Usuário OAuth criado com sucesso',
                user: { id: newUser.id, email: newUser.email, name: newUser.name }
            });
            
        } catch (error) {
            console.error('Erro no callback OAuth de teste:', error);
            res.status(500).json({ error: 'Erro ao processar callback OAuth' });
        }
    });
    
    // Endpoint de teste para criar usuário Google diretamente
    app.post('/test/create-google-user', async (req, res) => {
        try {
            const { email, name, google_id, auth_provider, profile_picture } = req.body;
            
            const result = await dbRun(`
                INSERT INTO users (email, name, google_id, auth_provider, profile_picture, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [email, name, google_id, auth_provider || 'google', profile_picture]);
            
            const user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
            res.json({ message: 'Usuário Google criado para teste', user });
            
        } catch (error) {
            console.error('Erro ao criar usuário Google de teste:', error);
            res.status(500).json({ error: 'Erro ao criar usuário Google' });
        }
    });
    
    // Endpoint de teste para adicionar dados do usuário
    app.post('/test/add-user-data', async (req, res) => {
        try {
            const { email, preferences } = req.body;
            
            await dbRun(`
                UPDATE users 
                SET preferences = ?, updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
            `, [JSON.stringify(preferences), email]);
            
            res.json({ message: 'Dados do usuário adicionados' });
            
        } catch (error) {
            console.error('Erro ao adicionar dados do usuário:', error);
            res.status(500).json({ error: 'Erro ao adicionar dados' });
        }
    });
    
    // Create rate limiter for OAuth routes
    const oauthLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 attempts per window
        message: { error: 'Muitas tentativas de OAuth. Tente novamente em 15 minutos.' },
        skipSuccessfulRequests: false,
        skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']
    });

    // Simular rota de início do Google OAuth
    app.get('/auth/google', oauthLimiter, (req, res) => {
        // Simulate OAuth initiation
        res.redirect('https://accounts.google.com/oauth/authorize?client_id=test&response_type=code&scope=profile%20email&redirect_uri=http://localhost:3000/auth/google/callback');
    });
    
    // Simular callback do Google OAuth (para testes de redirecionamento)
    app.get('/auth/google/callback', oauthLimiter, (req, res) => {
        const { error, code, state } = req.query;
        
        if (error) {
            return res.redirect(`/login.html?error=oauth_failed`);
        }
        
        if (!code) {
            return res.redirect(`/login.html?error=oauth_no_code`);
        }
        
        // Simulate successful OAuth
        res.redirect('/dashboard.html?oauth=success');
    });
    
    // Rota de status do Google OAuth (requer autenticação)
    app.get('/auth/google/status', authenticateToken, async (req, res) => {
        try {
            const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            res.json({
                authenticated: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    auth_provider: user.auth_provider
                }
            });
        } catch (error) {
            console.error('Erro ao verificar status OAuth:', error);
            res.status(500).json({ error: 'Erro ao verificar status' });
        }
    });

    // Tratamento de erros global
    app.use((err, req, res, next) => {
        if (err.message === 'Not allowed by CORS') {
            return res.status(403).json({ error: 'Origem não permitida' });
        }
        
        // Tratar erros de JSON malformado
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'JSON malformado' });
        }
        
        // Tratar erros personalizados com status
        if (err.status) {
            return res.status(err.status).json({ error: err.message });
        }
        
        console.error('Erro não tratado:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    });

    return app;
};

module.exports = { createTestServer };