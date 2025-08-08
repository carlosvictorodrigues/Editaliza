/**
 * Auth Routes - HTTP routes for authentication endpoints
 * 
 * This module defines all the routes related to user authentication,
 * connecting HTTP requests to the appropriate controller methods.
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Import middleware
const { 
    authenticateToken, 
    validators, 
    handleValidationErrors, 
    sanitizeMiddleware 
} = require('../../middleware');

// Import controller
const authController = require('../controllers/authController');

// Import rate limiting
const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: { error: 'Muitas solicitações de redefinição. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Configure Multer for profile photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB maximum
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos.'), false);
        }
    }
});

// Apply sanitization to all routes
router.use(sanitizeMiddleware);

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register',
    authLimiter,
    validators.email,
    validators.password,
    validators.text('name', 0, 100), // Optional name field
    handleValidationErrors,
    authController.register
);

/**
 * @route POST /auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login',
    authLimiter,
    validators.email,
    validators.password,
    handleValidationErrors,
    authController.login
);

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
            
            // Redirect to frontend with token
            res.redirect(`/home.html?auth_success=1&token=${encodeURIComponent(token)}`);
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('/login.html?error=oauth_callback_failed');
        }
    }
);

/**
 * @route GET /auth/google/status
 * @desc Check Google OAuth status
 * @access Private
 */
router.get('/google/status',
    authenticateToken,
    authController.getGoogleStatus
);

/**
 * @route POST /auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout',
    authenticateToken,
    authController.logout
);

/**
 * @route POST /auth/request-password-reset
 * @desc Request password reset
 * @access Public
 */
router.post('/request-password-reset',
    passwordResetLimiter,
    validators.email,
    handleValidationErrors,
    authController.requestPasswordReset
);

/**
 * @route POST /auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password',
    passwordResetLimiter,
    validators.text('token', 32, 64), // Token validation
    validators.password,
    handleValidationErrors,
    authController.resetPassword
);

/**
 * @route GET /auth/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile',
    authenticateToken,
    authController.getProfile
);

/**
 * @route PUT /auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile',
    authenticateToken,
    // Optional validations for profile fields
    validators.text('name', 0, 100),
    validators.text('phone', 0, 20),
    validators.text('whatsapp', 0, 20),
    validators.text('state', 0, 50),
    validators.text('city', 0, 100),
    validators.text('education', 0, 100),
    validators.text('work_status', 0, 100),
    validators.text('area_interest', 0, 200),
    validators.text('level_desired', 0, 100),
    validators.text('timeline_goal', 0, 100),
    validators.text('motivation_text', 0, 1000),
    validators.integer('study_hours', 1, 24),
    validators.integer('concursos_count', 0, 100),
    // Date validations are optional and handled in service layer
    authController.updateProfile
);

/**
 * @route POST /auth/profile/upload-photo
 * @desc Upload profile photo
 * @access Private
 */
router.post('/profile/upload-photo',
    authenticateToken,
    upload.single('photo'),
    authController.uploadProfilePhoto
);

/**
 * @route GET /auth/verify
 * @desc Verify JWT token
 * @access Private
 */
router.get('/verify',
    authenticateToken,
    authController.verifyToken
);

/**
 * @route POST /auth/refresh
 * @desc Refresh JWT token
 * @access Public (but requires valid token in header)
 */
router.post('/refresh',
    authController.refreshToken
);

/**
 * @route GET /auth/status
 * @desc Check authentication status
 * @access Public
 */
router.get('/status',
    authController.getAuthStatus
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
        }
        return res.status(400).json({ error: 'Erro no upload do arquivo.' });
    }
    if (error.message === 'Apenas arquivos de imagem são permitidos.') {
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

module.exports = router;
