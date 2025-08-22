/**
 * User Routes - HTTP route definitions for user management
 * 
 * This module defines all HTTP routes related to user management,
 * including profile, settings, preferences, and account operations.
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userController = require('../controllers/userController');

const router = express.Router();

// Import middleware
const { handleValidationErrors, authenticateToken, requireAdmin } = require('../../middleware.js');

// =====================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// =====================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
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
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file type
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos'), false);
        }
    }
});

// =====================================
// PROFILE ROUTES
// =====================================

/**
 * Get user profile
 * GET /users/profile
 */
router.get('/profile', authenticateToken, userController.getProfile);

/**
 * Update user profile
 * PATCH /users/profile
 */
router.patch('/profile', 
    authenticateToken,
    // Basic profile validations
    body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
    body('profile_picture').optional().isString().isLength({ max: 500 }).withMessage('URL da foto muito longa'),
    body('phone').optional().isString().isLength({ max: 20 }).withMessage('Telefone muito longo'),
    body('whatsapp').optional().isString().isLength({ max: 20 }).withMessage('WhatsApp muito longo'),
    // Extended profile validations
    body('state').optional().isString().isLength({ min: 2, max: 2 }).withMessage('Estado deve ser a sigla com 2 caracteres'),
    body('city').optional().isString().isLength({ max: 100 }).withMessage('Cidade muito longa'),
    body('birth_date').optional().isISO8601().withMessage('Data de nascimento inválida'),
    body('education').optional().isString().isLength({ max: 50 }).withMessage('Escolaridade inválida'),
    body('work_status').optional().isString().isLength({ max: 50 }).withMessage('Situação profissional inválida'),
    body('first_time').optional().isString().isIn(['sim', 'nao']).withMessage('Primeira vez deve ser sim ou nao'),
    body('concursos_count').optional().isString().withMessage('Contagem de concursos inválida'),
    body('difficulties').optional().custom((value) => {
        if (value === null || value === undefined) return true;
        if (Array.isArray(value)) return true;
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return true;
            } catch (e) {
                // Continue to throw error
            }
        }
        throw new Error('Dificuldades deve ser um array');
    }),
    body('area_interest').optional().isString().isLength({ max: 50 }).withMessage('Área de interesse inválida'),
    body('level_desired').optional().isString().isLength({ max: 50 }).withMessage('Nível desejado inválido'),
    body('timeline_goal').optional().isString().isLength({ max: 50 }).withMessage('Prazo inválido'),
    body('study_hours').optional().isString().isLength({ max: 20 }).withMessage('Horas de estudo inválidas'),
    body('motivation_text').optional().isString().isLength({ max: 1000 }).withMessage('Texto de motivação muito longo'),
    handleValidationErrors,
    userController.updateProfile
);

/**
 * Upload profile photo
 * POST /users/profile/upload-photo
 */
router.post('/profile/upload-photo', 
    authenticateToken, 
    upload.single('photo'), 
    userController.uploadProfilePhoto
);

// =====================================
// SETTINGS ROUTES
// =====================================

/**
 * Get user settings
 * GET /users/settings
 */
router.get('/settings', authenticateToken, userController.getSettings);

/**
 * Update user settings
 * PATCH /users/settings
 */
router.patch('/settings',
    authenticateToken,
    body('theme').optional().isIn(['light', 'dark', 'auto']).withMessage('Tema inválido'),
    body('language').optional().isIn(['pt-BR', 'en-US']).withMessage('Idioma inválido'),
    body('timezone').optional().isString().isLength({ max: 50 }).withMessage('Timezone inválido'),
    body('auto_save').optional().isBoolean().withMessage('Auto save deve ser verdadeiro ou falso'),
    body('compact_mode').optional().isBoolean().withMessage('Modo compacto deve ser verdadeiro ou falso'),
    handleValidationErrors,
    userController.updateSettings
);

// =====================================
// PREFERENCES ROUTES
// =====================================

/**
 * Get user preferences
 * GET /users/preferences
 */
router.get('/preferences', authenticateToken, userController.getPreferences);

/**
 * Update user preferences
 * PATCH /users/preferences
 */
router.patch('/preferences',
    authenticateToken,
    body('email_notifications').optional().isBoolean().withMessage('Notificações por email deve ser verdadeiro ou falso'),
    body('push_notifications').optional().isBoolean().withMessage('Notificações push deve ser verdadeiro ou falso'),
    body('study_reminders').optional().isBoolean().withMessage('Lembretes de estudo deve ser verdadeiro ou falso'),
    body('progress_reports').optional().isBoolean().withMessage('Relatórios de progresso deve ser verdadeiro ou falso'),
    body('marketing_emails').optional().isBoolean().withMessage('Emails de marketing deve ser verdadeiro ou falso'),
    handleValidationErrors,
    userController.updatePreferences
);

// =====================================
// STATISTICS AND ACTIVITY ROUTES
// =====================================

/**
 * Get user statistics
 * GET /users/statistics
 */
router.get('/statistics', authenticateToken, userController.getStatistics);

/**
 * Update user activity
 * POST /users/activity
 */
router.post('/activity',
    authenticateToken,
    body('activity_type').isString().isIn(['study', 'plan_creation', 'plan_completion', 'login']).withMessage('Tipo de atividade inválido'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duração deve ser um número positivo'),
    body('metadata').optional().isObject().withMessage('Metadados devem ser um objeto'),
    handleValidationErrors,
    userController.updateActivity
);

// =====================================
// ACCOUNT MANAGEMENT ROUTES
// =====================================

/**
 * Change password
 * POST /users/change-password
 */
router.post('/change-password',
    authenticateToken,
    body('currentPassword').isString().isLength({ min: 1 }).withMessage('Senha atual é obrigatória'),
    body('newPassword').isString().isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres'),
    body('confirmPassword').isString().isLength({ min: 1 }).withMessage('Confirmação de senha é obrigatória'),
    handleValidationErrors,
    userController.changePassword
);

/**
 * Deactivate account
 * POST /users/deactivate
 */
router.post('/deactivate',
    authenticateToken,
    body('password').optional().isString().withMessage('Senha deve ser uma string'),
    body('reason').optional().isString().isLength({ max: 500 }).withMessage('Motivo muito longo'),
    body('confirmation').isString().equals('DESATIVAR').withMessage('Confirmação deve ser exatamente "DESATIVAR"'),
    handleValidationErrors,
    userController.deactivateAccount
);

/**
 * Delete account permanently
 * DELETE /users/account
 */
router.delete('/account',
    authenticateToken,
    body('password').optional().isString().withMessage('Senha deve ser uma string'),
    body('confirmation').isString().equals('DELETAR PERMANENTEMENTE').withMessage('Confirmação deve ser exatamente "DELETAR PERMANENTEMENTE"'),
    handleValidationErrors,
    userController.deleteAccount
);

// =====================================
// NOTIFICATION AND PRIVACY ROUTES
// =====================================

/**
 * Get notification preferences
 * GET /users/notifications
 */
router.get('/notifications', authenticateToken, userController.getNotificationPreferences);

/**
 * Update notification preferences
 * PATCH /users/notifications
 */
router.patch('/notifications',
    authenticateToken,
    body('email_notifications').optional().isBoolean().withMessage('Notificações por email deve ser verdadeiro ou falso'),
    body('push_notifications').optional().isBoolean().withMessage('Notificações push deve ser verdadeiro ou falso'),
    body('study_reminders').optional().isBoolean().withMessage('Lembretes de estudo deve ser verdadeiro ou falso'),
    body('progress_reports').optional().isBoolean().withMessage('Relatórios de progresso deve ser verdadeiro ou falso'),
    body('marketing_emails').optional().isBoolean().withMessage('Emails de marketing deve ser verdadeiro ou falso'),
    handleValidationErrors,
    userController.updateNotificationPreferences
);

/**
 * Get privacy settings
 * GET /users/privacy
 */
router.get('/privacy', authenticateToken, userController.getPrivacySettings);

/**
 * Update privacy settings
 * PATCH /users/privacy
 */
router.patch('/privacy',
    authenticateToken,
    body('profile_visibility').optional().isIn(['public', 'private', 'friends']).withMessage('Visibilidade inválida'),
    body('show_email').optional().isBoolean().withMessage('Mostrar email deve ser verdadeiro ou falso'),
    body('show_progress').optional().isBoolean().withMessage('Mostrar progresso deve ser verdadeiro ou falso'),
    body('allow_contact').optional().isBoolean().withMessage('Permitir contato deve ser verdadeiro ou falso'),
    handleValidationErrors,
    userController.updatePrivacySettings
);

// =====================================
// ADMIN ROUTES (TODO: Add admin middleware)
// =====================================

/**
 * Search users (admin only)
 * GET /users/search?q=query&limit=20&offset=0
 */
router.get('/search',
    authenticateToken,
    requireAdmin, // IMPORTANT: Add admin role check middleware
    query('q').isString().isLength({ min: 2, max: 100 }).withMessage('Termo de busca deve ter entre 2 e 100 caracteres'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset deve ser um número positivo'),
    handleValidationErrors,
    userController.searchUsers
);

/**
 * List users with pagination (admin only)
 * GET /users/list?limit=20&offset=0&status=active
 */
router.get('/list',
    authenticateToken,
    requireAdmin, // IMPORTANT: Add admin role check middleware
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset deve ser um número positivo'),
    query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Status inválido'),
    handleValidationErrors,
    userController.listUsers
);

/**
 * Get user by ID (admin only)
 * GET /users/:userId
 */
router.get('/:userId',
    authenticateToken,
    requireAdmin, // IMPORTANT: Add admin role check middleware
    param('userId').isInt({ min: 1 }).withMessage('ID de usuário inválido'),
    handleValidationErrors,
    userController.getUserById
);

module.exports = router;