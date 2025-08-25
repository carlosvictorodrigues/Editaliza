/**
 * Profile Routes - Consolidated
 * 
 * Define todas as rotas relacionadas ao perfil do usuário
 * Padronização: /api/users/profile/*
 * 
 * IMPORTANTE: Mantém compatibilidade com rotas antigas
 */

const express = require('express');
const router = express.Router();

// Controller
const profileController = require('../controllers/profile.controller');

// Middleware
const { 
    authenticateToken,
    handleValidationErrors,
    sanitizeMiddleware
} = require('../../middleware');

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================

// Todas as rotas de perfil requerem autenticação
router.use(authenticateToken);

// Aplicar sanitização em todas as rotas
router.use(sanitizeMiddleware);

// ============================================================================
// ROTAS DE PERFIL
// ============================================================================

/**
 * @route GET /api/users/profile
 * @desc Obter perfil do usuário autenticado
 * @access Private
 * 
 * Antiga: GET /api/profile
 */
router.get('/profile', profileController.getProfile);

/**
 * @route PATCH /api/users/profile
 * @desc Atualizar perfil do usuário
 * @access Private
 * 
 * Antiga: PATCH /api/profile
 */
router.patch('/profile',
    profileController.profileValidations,
    handleValidationErrors,
    profileController.updateProfile
);

/**
 * @route POST /api/users/profile/photo
 * @desc Upload de foto de perfil
 * @access Private
 * @body multipart/form-data com campo 'photo'
 * 
 * Antiga: POST /api/profile/upload-photo
 */
router.post('/profile/photo',
    profileController.uploadMiddleware.single('photo'),
    (req, res, next) => {
        // Tratamento de erros do multer
        if (req.fileValidationError) {
            return res.status(400).json({ 
                error: req.fileValidationError 
            });
        }
        next();
    },
    profileController.uploadProfilePhoto
);

/**
 * @route DELETE /api/users/profile/photo
 * @desc Remover foto de perfil
 * @access Private
 * 
 * Nova funcionalidade
 */
router.delete('/profile/photo', profileController.deleteProfilePhoto);

// ============================================================================
// ROTAS DE COMPATIBILIDADE (Temporárias)
// ============================================================================

/**
 * @deprecated
 * Rota antiga mantida para compatibilidade
 * Use: GET /api/users/profile
 */
router.get('/', (req, res, next) => {
    console.warn('[DEPRECATED] GET /api/users → Use GET /api/users/profile');
    req.url = '/profile';
    next();
}, profileController.getProfile);

// ============================================================================
// TRATAMENTO DE ERROS ESPECÍFICOS DO MULTER
// ============================================================================

// Error handler para upload
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'Arquivo muito grande. Máximo 5MB.' 
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                error: 'Campo de arquivo inesperado.' 
            });
        }
        return res.status(400).json({ 
            error: `Erro no upload: ${error.message}` 
        });
    }
    
    // Erro customizado do fileFilter
    if (error.message && error.message.includes('Apenas imagens')) {
        return res.status(400).json({ 
            error: error.message 
        });
    }
    
    // Passar para o próximo handler de erro
    next(error);
});

module.exports = router;