const express = require('express');
const router = express.Router();
const preferencesController = require('../controllers/preferences.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Todas as rotas requerem autenticação
router.use(authMiddleware.authenticateToken);

// Buscar preferências de email
router.get('/email', preferencesController.getEmailPreferences);

// Atualizar todas as preferências de email
router.put('/email', preferencesController.updateEmailPreferences);

// Atualizar uma preferência específica
router.patch('/email/:preference', preferencesController.updateSinglePreference);

module.exports = router;