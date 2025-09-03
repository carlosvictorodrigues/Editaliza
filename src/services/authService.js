/**
 * Auth Service - Business logic for user authentication
 * 
 * This service contains all the complex business logic for user authentication,
 * JWT token management, password validation, and OAuth integration.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authRepository = require('../repositories/authRepository');
const { sanitizeEmail, sanitizeInput } = require('../utils/sanitizer');
const { securityLog, createSafeError, checkUserRateLimit } = require('../utils/security');
const { getPasswordColumn } = require('../utils/dbCompat');

/**
 * Register a new user - SIMPLIFICADO para resolver timeout
 */
const register = async (userData, req) => {
    const { email, password, name } = userData;
    
    try {
        console.log('[AUTH_SERVICE] Iniciando registro para:', email);
        
        // Sanitize inputs
        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            throw new Error('E-mail inválido');
        }
        
        const sanitizedName = name ? sanitizeInput(name) : null;
        
        console.log('[AUTH_SERVICE] Verificando se usuário existe...');
        
        // Check if user already exists - TIMEOUT AQUI?
        const existingUser = await authRepository.findUserByEmail(sanitizedEmail);
        if (existingUser) {
            console.log('[AUTH_SERVICE] Usuário já existe:', email);
            securityLog('registration_attempt_existing_email', { email: sanitizedEmail }, null, req);
            throw new Error('Este e-mail já está em uso.');
        }
        
        console.log('[AUTH_SERVICE] Fazendo hash da senha...');
        
        // Hash password - PODE DEMORAR MAS NAO DEVERIA TRAVAR
        const hashedPassword = await bcrypt.hash(password, 10); // Reduzido de 12 para 10
        const currentDate = new Date().toISOString();
        
        console.log('[AUTH_SERVICE] Criando usuário no banco...');
        
        // Create user - TIMEOUT AQUI?
        const newUser = await authRepository.createUser({
            email: sanitizedEmail,
            passwordHash: hashedPassword,
            name: sanitizedName,
            currentDate
        });
        
        console.log('[AUTH_SERVICE] Usuário criado com sucesso:', newUser?.id);
        
        securityLog('user_registered', { email: sanitizedEmail, userId: newUser?.id }, newUser?.id, req);
        
        return {
            message: 'Usuário criado com sucesso!',
            userId: newUser?.id
        };
        
    } catch (error) {
        console.error('[AUTH_SERVICE] Erro no registro:', error);
        throw error;
    }
};

/**
 * Login user with email and password
 */
const login = async (credentials, req) => {
    const { email, password } = credentials;
    
    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
        throw new Error('E-mail inválido');
    }
    
    // Check rate limiting
    if (!checkUserRateLimit(sanitizedEmail, 'login', 5, 15 * 60 * 1000)) {
        securityLog('login_rate_limited', { email: sanitizedEmail }, null, req);
        throw new Error('Muitas tentativas de login. Tente novamente em 15 minutos.');
    }
    
    // Find user
    const user = await authRepository.findUserByEmail(sanitizedEmail);
    if (!user) {
        await authRepository.recordLoginAttempt(sanitizedEmail, false, req.ip, req.headers['user-agent']);
        securityLog('login_attempt_user_not_found', { email: sanitizedEmail }, null, req);
        throw new Error('Conta não encontrada. Verifique o e-mail ou crie uma nova conta.');
    }
    
    // Check if user is a Google OAuth user
    if (user.auth_provider === 'google') {
        await authRepository.recordLoginAttempt(sanitizedEmail, false, req.ip, req.headers['user-agent']);
        securityLog('login_attempt_google_user', { email: sanitizedEmail, userId: user.id }, user.id, req);
        throw new Error('Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.');
    }
    
    // Check if user has a password set
    const passwordColumn = getPasswordColumn();
    if (!user[passwordColumn]) {
        await authRepository.recordLoginAttempt(sanitizedEmail, false, req.ip, req.headers['user-agent']);
        securityLog('login_attempt_no_password', { email: sanitizedEmail, userId: user.id }, user.id, req);
        throw new Error('Conta não possui senha definida. Use o botão \'Esqueci minha senha\' para criar uma senha.');
    }

    // Verify password
    if (!await bcrypt.compare(password, user[passwordColumn])) {
        await authRepository.recordLoginAttempt(sanitizedEmail, false, req.ip, req.headers['user-agent']);
        securityLog('login_attempt_wrong_password', { email: sanitizedEmail, userId: user.id }, user.id, req);
        throw new Error('Senha incorreta. Tente novamente ou use "Esqueci minha senha".');
    }
    
    // Check subscription status
    if (user.plan_expiry) {
        const now = new Date();
        const expiry = new Date(user.plan_expiry);
        
        if (expiry < now) {
            // Plan expired
            securityLog('login_attempt_expired_plan', { email: sanitizedEmail, userId: user.id, expiry: user.plan_expiry }, user.id, req);
            
            // Update plan status if needed
            if (user.plan_status === 'active') {
                await authRepository.updatePlanStatus(user.id, 'expired');
            }
            
            // Still allow login but with expired status
            await authRepository.recordLoginAttempt(sanitizedEmail, true, req.ip, req.headers['user-agent']);
            
            const token = generateJWT(user);
            
            return {
                message: 'Login realizado. Atenção: Seu plano expirou!',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    auth_provider: user.auth_provider,
                    plan_status: 'expired',
                    plan_expired: true
                },
                subscription_expired: true
            };
        }
        
        // Check if expiring soon (less than 7 days)
        const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 7) {
            securityLog('login_success_expiring_soon', { 
                email: sanitizedEmail, 
                userId: user.id, 
                daysRemaining: daysUntilExpiry 
            }, user.id, req);
        }
    }
    
    // Success - record attempt and generate token
    await authRepository.recordLoginAttempt(sanitizedEmail, true, req.ip, req.headers['user-agent']);
    securityLog('user_login_success', { email: sanitizedEmail, userId: user.id }, user.id, req);
    
    const token = generateJWT(user);
    
    return {
        message: 'Login bem-sucedido!',
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            auth_provider: user.auth_provider,
            plan_status: user.plan_status,
            plan_type: user.plan_type
        }
    };
};

/**
 * Process Google OAuth callback
 */
const processGoogleCallback = async (profile, req) => {
    try {
        // Check if user already exists with Google ID
        let user = await authRepository.findUserByGoogleId(profile.id);
        if (user) {
            securityLog('google_oauth_existing_user', { email: profile.emails[0].value, userId: user.id }, user.id, req);
            return user;
        }
        
        // Check if user exists with same email
        const emailUser = await authRepository.findUserByEmail(profile.emails[0].value);
        if (emailUser) {
            // Link Google account to existing user
            user = await authRepository.linkGoogleAccount(
                emailUser.id,
                profile.id,
                profile.photos[0]?.value,
                profile.displayName
            );
            
            securityLog('google_oauth_account_linked', { email: profile.emails[0].value, userId: user.id }, user.id, req);
            return user;
        }
        
        // Create new user
        user = await authRepository.createGoogleUser({
            email: profile.emails[0].value,
            name: profile.displayName,
            googleId: profile.id,
            avatar: profile.photos[0]?.value,
            currentDate: new Date().toISOString()
        });
        
        securityLog('google_oauth_user_created', { email: profile.emails[0].value, userId: user.id }, user.id, req);
        return user;
        
    } catch (error) {
        securityLog('google_oauth_error', { error: error.message, profileEmail: profile.emails[0]?.value }, null, req);
        throw error;
    }
};

/**
 * Request password reset
 */
const requestPasswordReset = async (email, req) => {
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
        throw new Error('E-mail inválido');
    }
    
    // Check rate limiting for password reset requests
    if (!checkUserRateLimit(sanitizedEmail, 'password_reset', 3, 60 * 60 * 1000)) {
        securityLog('password_reset_rate_limited', { email: sanitizedEmail }, null, req);
        throw new Error('Muitas solicitações de redefinição de senha. Tente novamente em 1 hora.');
    }
    
    const user = await authRepository.findUserByEmail(sanitizedEmail);
    if (user) {
        // Check if user is a Google OAuth user
        if (user.auth_provider === 'google') {
            securityLog('password_reset_google_user', { email: sanitizedEmail, userId: user.id }, user.id, req);
            throw new Error('Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.');
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour
        
        await authRepository.setResetToken(user.id, token, expires);
        
        securityLog('password_reset_requested', { email: sanitizedEmail, userId: user.id }, user.id, req);
        
        // In development, log the reset link
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        if (process.env.NODE_ENV !== 'production') {
            console.log(`SIMULAÇÃO DE E-MAIL: Link de recuperação para ${user.email}: ${appUrl}/reset-password.html?token=${token}`);
        }
    }
    
    // Always return success message to prevent email enumeration
    return {
        message: 'Se um usuário com este e-mail existir, um link de recuperação foi enviado.'
    };
};

/**
 * Reset password with token
 */
const resetPassword = async (token, newPassword, req) => {
    if (!token || token.length < 32) {
        throw new Error('Token inválido');
    }
    
    const user = await authRepository.findUserByResetToken(token);
    if (!user) {
        securityLog('password_reset_invalid_token', { token: token.substring(0, 8) + '...' }, null, req);
        throw new Error('Token inválido ou expirado.');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password and clear reset token
    await authRepository.updatePassword(user.id, hashedPassword);
    await authRepository.clearResetToken(user.id);
    
    securityLog('password_reset_completed', { email: user.email, userId: user.id }, user.id, req);
    
    return {
        message: 'Senha redefinida com sucesso!'
    };
};

/**
 * Get user profile
 */
const getUserProfile = async (userId, req) => {
    const user = await authRepository.getUserProfile(userId);
    if (!user) {
        throw new Error('Usuário não encontrado.');
    }
    
    // Parse difficulties JSON string back to array
    let difficulties = [];
    if (user.difficulties) {
        try {
            difficulties = JSON.parse(user.difficulties);
        } catch (error) {
            securityLog('profile_difficulties_parse_error', { userId, error: error.message }, userId, req);
        }
    }
    
    return {
        ...user,
        difficulties
    };
};

/**
 * Update user profile
 */
const updateUserProfile = async (userId, profileData, req) => {
    // Sanitize inputs
    const sanitizedData = {};
    
    Object.entries(profileData).forEach(([key, value]) => {
        if (typeof value === 'string') {
            sanitizedData[key] = sanitizeInput(value);
        } else {
            sanitizedData[key] = value;
        }
    });
    
    // Handle special fields
    if (sanitizedData.difficulties && Array.isArray(sanitizedData.difficulties)) {
        sanitizedData.difficulties = JSON.stringify(sanitizedData.difficulties);
    }
    
    const updatedUser = await authRepository.updateUserProfile(userId, sanitizedData);
    
    securityLog('profile_updated', { userId, updatedFields: Object.keys(sanitizedData) }, userId, req);
    
    return updatedUser;
};

/**
 * Verify JWT token and get user
 */
const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded.id || !decoded.email) {
            throw new Error('Token malformado');
        }
        
        // Optionally verify user still exists
        const user = await authRepository.findUserById(decoded.id);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expirado. Por favor, faça login novamente.');
        }
        throw new Error('Token inválido');
    }
};

/**
 * Generate JWT token
 */
const generateJWT = (user) => {
    return jwt.sign(
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
};

/**
 * Refresh JWT token
 */
const refreshToken = async (oldToken, req) => {
    try {
        // Verify old token (allow expired tokens for refresh)
        const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        
        if (!decoded.id || !decoded.email) {
            throw new Error('Token malformado');
        }
        
        // Check if token is too old to refresh (e.g., more than 7 days)
        const tokenAge = Date.now() / 1000 - decoded.iat;
        if (tokenAge > 7 * 24 * 60 * 60) { // 7 days
            throw new Error('Token muito antigo para renovação');
        }
        
        // Get fresh user data
        const user = await authRepository.findUserById(decoded.id);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        
        const newToken = generateJWT(user);
        
        securityLog('token_refreshed', { userId: user.id }, user.id, req);
        
        return {
            token: newToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                auth_provider: user.auth_provider
            }
        };
    } catch (error) {
        securityLog('token_refresh_failed', { error: error.message }, null, req);
        throw error;
    }
};

const checkIfUserHasPlans = async (userId) => {
    const plans = await authRepository.findPlansByUserId(userId);
    return plans && plans.length > 0;
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
    try {
        const user = await authRepository.findUserById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        return user;
    } catch (error) {
        console.error('[AUTH_SERVICE] Erro ao buscar usuário por ID:', error);
        throw error;
    }
};

module.exports = {
    register,
    login,
    processGoogleCallback,
    requestPasswordReset,
    resetPassword,
    getUserProfile,
    getUserById,
    updateUserProfile,
    verifyToken,
    generateJWT,
    refreshToken,
    checkIfUserHasPlans
};