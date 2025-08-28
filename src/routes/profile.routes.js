/**
 * Profile Routes - Versão Final Corrigida
 */

const express = require('express');
const router = express.Router();

const profileController = require('../controllers/profile.controller');

// Middleware
const { authenticateToken } = require('../middleware/auth.middleware');

console.log('[PROFILE ROUTES] Arquivo carregado!');

/**
 * @route GET /api/users/profile
 * @desc Obter perfil do usuário autenticado
 * @access Private
 */
router.get('/profile', authenticateToken(), profileController.getProfile);

/**
 * @route PATCH /api/users/profile
 * @desc Atualizar perfil do usuário autenticado
 * @access Private
 */
router.patch('/profile', authenticateToken(), profileController.profileValidations, profileController.updateProfile);

/**
 * @route POST /api/users/profile/photo
 * @desc Upload da foto de perfil
 * @access Private
 */
router.post('/profile/photo', authenticateToken(), profileController.uploadMiddleware.single('photo'), profileController.uploadProfilePhoto);

/**
 * @route DELETE /api/users/profile/photo
 * @desc Remover foto de perfil
 * @access Private
 */
router.delete('/profile/photo', authenticateToken(), profileController.deleteProfilePhoto);

module.exports = router;