/**
 * User Controller - Handles all user-related HTTP requests
 * 
 * This controller manages user profile, settings, preferences, statistics,
 * and account management that was previously in server.js
 */

const userService = require('../services/userService');
const { sanitizeHtml } = require('../utils/sanitizer');
const { createSafeError, securityLog } = require('../utils/security');

/**
 * Get user profile
 * GET /users/profile
 */
const getProfile = async (req, res) => {
    try {
        const profile = await userService.getUserProfile(req.user.id, req);
        res.json(profile);
    } catch (error) {
        securityLog('get_profile_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado')) {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao carregar perfil'));
        }
    }
};

/**
 * Update user profile
 * PATCH /users/profile
 */
const updateProfile = async (req, res) => {
    try {
        const updatedProfile = await userService.updateUserProfile(req.user.id, req.body, req);
        res.json(updatedProfile);
    } catch (error) {
        securityLog('update_profile_error', error.message, req.user.id, req);
        
        if (error.message.includes('campo para atualizar')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar perfil'));
        }
    }
};

/**
 * Upload profile photo
 * POST /users/profile/upload-photo
 */
const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        
        const result = await userService.uploadProfilePhoto(req.user.id, req.file, req);
        
        securityLog('profile_photo_uploaded', { userId: req.user.id, filename: req.file.filename }, req.user.id, req);
        
        res.json(result);
    } catch (error) {
        securityLog('profile_photo_upload_error', error.message, req.user?.id, req);
        
        if (error.message.includes('arquivo muito grande') || 
            error.message.includes('tipo não permitido')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao fazer upload da foto'));
        }
    }
};

/**
 * Get user settings
 * GET /users/settings
 */
const getSettings = async (req, res) => {
    try {
        const settings = await userService.getUserSettings(req.user.id, req);
        res.json(settings);
    } catch (error) {
        securityLog('get_settings_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar configurações'));
    }
};

/**
 * Update user settings
 * PATCH /users/settings
 */
const updateSettings = async (req, res) => {
    try {
        const updatedSettings = await userService.updateUserSettings(req.user.id, req.body, req);
        res.json(updatedSettings);
    } catch (error) {
        securityLog('update_settings_error', error.message, req.user.id, req);
        
        if (error.message.includes('configuração inválida')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar configurações'));
        }
    }
};

/**
 * Get user preferences
 * GET /users/preferences
 */
const getPreferences = async (req, res) => {
    try {
        const preferences = await userService.getUserPreferences(req.user.id, req);
        res.json(preferences);
    } catch (error) {
        securityLog('get_preferences_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar preferências'));
    }
};

/**
 * Update user preferences
 * PATCH /users/preferences
 */
const updatePreferences = async (req, res) => {
    try {
        const updatedPreferences = await userService.updateUserPreferences(req.user.id, req.body, req);
        res.json(updatedPreferences);
    } catch (error) {
        securityLog('update_preferences_error', error.message, req.user.id, req);
        
        if (error.message.includes('preferência inválida')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao atualizar preferências'));
        }
    }
};

/**
 * Get user statistics
 * GET /users/statistics
 */
const getStatistics = async (req, res) => {
    try {
        const statistics = await userService.getUserStatistics(req.user.id, req);
        res.json(statistics);
    } catch (error) {
        securityLog('get_statistics_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar estatísticas'));
    }
};

/**
 * Update user activity/progress
 * POST /users/activity
 */
const updateActivity = async (req, res) => {
    try {
        const result = await userService.updateUserActivity(req.user.id, req.body, req);
        res.json(result);
    } catch (error) {
        securityLog('update_activity_error', error.message, req.user.id, req);
        
        if (error.message.includes('dados de atividade inválidos')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao registrar atividade'));
        }
    }
};

/**
 * Deactivate user account
 * POST /users/deactivate
 */
const deactivateAccount = async (req, res) => {
    try {
        const result = await userService.deactivateAccount(req.user.id, req.body, req);
        
        // Clear session after deactivation
        req.session.destroy((err) => {
            if (err) {
                securityLog('deactivate_session_error', err.message, req.user.id, req);
            }
            res.json(result);
        });
    } catch (error) {
        securityLog('deactivate_account_error', error.message, req.user.id, req);
        
        if (error.message.includes('senha incorreta') || 
            error.message.includes('confirmação necessária')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao desativar conta'));
        }
    }
};

/**
 * Delete user account permanently
 * DELETE /users/account
 */
const deleteAccount = async (req, res) => {
    try {
        const result = await userService.deleteAccount(req.user.id, req.body, req);
        
        // Clear session after deletion
        req.session.destroy((err) => {
            if (err) {
                securityLog('delete_session_error', err.message, req.user.id, req);
            }
            res.json(result);
        });
    } catch (error) {
        securityLog('delete_account_error', error.message, req.user.id, req);
        
        if (error.message.includes('senha incorreta') || 
            error.message.includes('confirmação necessária')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao deletar conta'));
        }
    }
};

/**
 * Change user password
 * POST /users/change-password
 */
const changePassword = async (req, res) => {
    try {
        const result = await userService.changePassword(req.user.id, req.body, req);
        res.json(result);
    } catch (error) {
        securityLog('change_password_error', error.message, req.user.id, req);
        
        if (error.message.includes('senha atual incorreta') || 
            error.message.includes('mesma senha') ||
            error.message.includes('Google')) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao alterar senha'));
        }
    }
};

/**
 * Get notification preferences
 * GET /users/notifications
 */
const getNotificationPreferences = async (req, res) => {
    try {
        const preferences = await userService.getNotificationPreferences(req.user.id, req);
        res.json(preferences);
    } catch (error) {
        securityLog('get_notifications_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar preferências de notificação'));
    }
};

/**
 * Update notification preferences
 * PATCH /users/notifications
 */
const updateNotificationPreferences = async (req, res) => {
    try {
        const updatedPreferences = await userService.updateNotificationPreferences(req.user.id, req.body, req);
        res.json(updatedPreferences);
    } catch (error) {
        securityLog('update_notifications_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao atualizar preferências de notificação'));
    }
};

/**
 * Get privacy settings
 * GET /users/privacy
 */
const getPrivacySettings = async (req, res) => {
    try {
        const settings = await userService.getPrivacySettings(req.user.id, req);
        res.json(settings);
    } catch (error) {
        securityLog('get_privacy_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao carregar configurações de privacidade'));
    }
};

/**
 * Update privacy settings
 * PATCH /users/privacy
 */
const updatePrivacySettings = async (req, res) => {
    try {
        const updatedSettings = await userService.updatePrivacySettings(req.user.id, req.body, req);
        res.json(updatedSettings);
    } catch (error) {
        securityLog('update_privacy_error', error.message, req.user.id, req);
        res.status(500).json(createSafeError(error, 'Erro ao atualizar configurações de privacidade'));
    }
};

// =====================================
// ADMIN FUNCTIONS (require admin role)
// =====================================

/**
 * Search users (admin only)
 * GET /users/search
 */
const searchUsers = async (req, res) => {
    try {
        // This would require admin middleware in routes
        const results = await userService.searchUsers(req.query, req);
        res.json(results);
    } catch (error) {
        securityLog('search_users_error', error.message, req.user.id, req);
        
        if (error.message.includes('acesso negado') || 
            error.message.includes('não autorizado')) {
            res.status(403).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro na busca de usuários'));
        }
    }
};

/**
 * List users with pagination (admin only)
 * GET /users/list
 */
const listUsers = async (req, res) => {
    try {
        const users = await userService.listUsers(req.query, req);
        res.json(users);
    } catch (error) {
        securityLog('list_users_error', error.message, req.user.id, req);
        
        if (error.message.includes('acesso negado') || 
            error.message.includes('não autorizado')) {
            res.status(403).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao listar usuários'));
        }
    }
};

/**
 * Get user details by ID (admin only)
 * GET /users/:userId
 */
const getUserById = async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.userId, req);
        res.json(user);
    } catch (error) {
        securityLog('get_user_by_id_error', error.message, req.user.id, req);
        
        if (error.message.includes('não encontrado')) {
            res.status(404).json({ error: error.message });
        } else if (error.message.includes('acesso negado')) {
            res.status(403).json({ error: error.message });
        } else {
            res.status(500).json(createSafeError(error, 'Erro ao buscar usuário'));
        }
    }
};

module.exports = {
    getProfile,
    updateProfile,
    uploadProfilePhoto,
    getSettings,
    updateSettings,
    getPreferences,
    updatePreferences,
    getStatistics,
    updateActivity,
    deactivateAccount,
    deleteAccount,
    changePassword,
    getNotificationPreferences,
    updateNotificationPreferences,
    getPrivacySettings,
    updatePrivacySettings,
    searchUsers,
    listUsers,
    getUserById
};