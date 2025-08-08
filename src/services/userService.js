/**
 * User Service - Business logic for user management
 * 
 * This service contains all the complex business logic for user profile,
 * settings, preferences, statistics, and account management.
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const userRepository = require('../repositories/userRepository');
const { sanitizeEmail, sanitizeInput, sanitizeNumericId, sanitizeJson } = require('../utils/sanitizer');
const { securityLog, createSafeError, checkUserRateLimit, validateFilePath } = require('../utils/security');

/**
 * Get user profile with all safe fields
 */
const getUserProfile = async (userId, req) => {
    const user = await userRepository.getUserProfile(userId);
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
        id: user.id,
        email: user.email,
        name: user.name,
        profile_picture: user.profile_picture,
        phone: user.phone,
        whatsapp: user.whatsapp,
        created_at: user.created_at,
        state: user.state,
        city: user.city,
        birth_date: user.birth_date,
        education: user.education,
        work_status: user.work_status,
        first_time: user.first_time,
        concursos_count: user.concursos_count,
        difficulties,
        area_interest: user.area_interest,
        level_desired: user.level_desired,
        timeline_goal: user.timeline_goal,
        study_hours: user.study_hours,
        motivation_text: user.motivation_text,
        auth_provider: user.auth_provider
    };
};

/**
 * Update user profile with comprehensive validation
 */
const updateUserProfile = async (userId, profileData, req) => {
    const allowedFields = [
        'name', 'profile_picture', 'phone', 'whatsapp', 'state', 'city', 
        'birth_date', 'education', 'work_status', 'first_time', 'concursos_count',
        'difficulties', 'area_interest', 'level_desired', 'timeline_goal', 
        'study_hours', 'motivation_text'
    ];
    
    // Sanitize inputs and filter allowed fields only
    const sanitizedData = {};
    
    Object.entries(profileData).forEach(([key, value]) => {
        if (allowedFields.includes(key)) {
            if (typeof value === 'string') {
                sanitizedData[key] = sanitizeInput(value);
            } else {
                sanitizedData[key] = value;
            }
        }
    });
    
    // Handle special fields
    if (sanitizedData.difficulties) {
        if (Array.isArray(sanitizedData.difficulties)) {
            sanitizedData.difficulties = JSON.stringify(sanitizedData.difficulties);
        } else if (typeof sanitizedData.difficulties === 'string') {
            // Try to parse if it's already a JSON string
            try {
                const parsed = JSON.parse(sanitizedData.difficulties);
                sanitizedData.difficulties = JSON.stringify(Array.isArray(parsed) ? parsed : []);
            } catch {
                sanitizedData.difficulties = JSON.stringify([]);
            }
        } else {
            sanitizedData.difficulties = JSON.stringify([]);
        }
    }
    
    // Validate field lengths and formats
    if (sanitizedData.name && (sanitizedData.name.length < 1 || sanitizedData.name.length > 100)) {
        throw new Error('Nome deve ter entre 1 e 100 caracteres');
    }
    
    if (sanitizedData.phone && sanitizedData.phone.length > 20) {
        throw new Error('Telefone muito longo');
    }
    
    if (sanitizedData.state && sanitizedData.state.length !== 2) {
        throw new Error('Estado deve ser a sigla com 2 caracteres');
    }
    
    if (sanitizedData.motivation_text && sanitizedData.motivation_text.length > 1000) {
        throw new Error('Texto de motivação muito longo');
    }
    
    if (Object.keys(sanitizedData).length === 0) {
        throw new Error('Nenhum campo para atualizar.');
    }
    
    const updatedUser = await userRepository.updateUserProfile(userId, sanitizedData);
    
    securityLog('profile_updated', { userId, updatedFields: Object.keys(sanitizedData) }, userId, req);
    
    // Return formatted profile
    return await getUserProfile(userId, req);
};

/**
 * Upload and process profile photo
 */
const uploadProfilePhoto = async (userId, file, req) => {
    // Validate file type and size (already handled by multer, but double-check)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Tipo de arquivo não permitido. Use JPG, PNG ou GIF.');
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
        throw new Error('Arquivo muito grande. Máximo 5MB.');
    }
    
    try {
        // Get current profile picture to delete old one
        const user = await userRepository.getUserProfile(userId);
        const oldPhoto = user?.profile_picture;
        
        // Update profile with new photo path
        const photoPath = `/uploads/${file.filename}`;
        await userRepository.updateUserProfile(userId, {
            profile_picture: photoPath
        });
        
        // Delete old photo file if exists and is valid
        if (oldPhoto && oldPhoto !== photoPath && oldPhoto.startsWith('/uploads/')) {
            try {
                const validatedPath = validateFilePath(oldPhoto, 'uploads');
                const oldFilePath = path.join(__dirname, '../../', validatedPath.substring(1));
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    securityLog('old_photo_deleted', { path: validatedPath }, userId, req);
                }
            } catch (pathError) {
                securityLog('invalid_photo_path', { error: pathError.message, path: oldPhoto }, userId, req);
                // Continue without deleting if path is invalid
            }
        }
        
        return {
            message: 'Foto de perfil atualizada com sucesso',
            profilePicture: photoPath
        };
    } catch (error) {
        // If database update failed, clean up uploaded file
        try {
            const filePath = path.join(__dirname, '../../uploads', file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupError) {
            securityLog('photo_cleanup_failed', { error: cleanupError.message }, userId, req);
        }
        throw error;
    }
};

/**
 * Get user settings (theme, language, etc.)
 */
const getUserSettings = async (userId, req) => {
    const settings = await userRepository.getUserSettings(userId);
    
    if (!settings) {
        // Return default settings
        return {
            theme: 'light',
            language: 'pt-BR',
            timezone: 'America/Sao_Paulo',
            auto_save: true,
            compact_mode: false
        };
    }
    
    return settings;
};

/**
 * Update user settings
 */
const updateUserSettings = async (userId, settingsData, req) => {
    const allowedSettings = ['theme', 'language', 'timezone', 'auto_save', 'compact_mode'];
    const validThemes = ['light', 'dark', 'auto'];
    const validLanguages = ['pt-BR', 'en-US'];
    
    const sanitizedSettings = {};
    
    Object.entries(settingsData).forEach(([key, value]) => {
        if (allowedSettings.includes(key)) {
            if (key === 'theme' && !validThemes.includes(value)) {
                throw new Error(`Tema inválido: ${value}`);
            }
            if (key === 'language' && !validLanguages.includes(value)) {
                throw new Error(`Idioma inválido: ${value}`);
            }
            if ((key === 'auto_save' || key === 'compact_mode') && typeof value !== 'boolean') {
                throw new Error(`Configuração inválida para ${key}: deve ser true ou false`);
            }
            
            sanitizedSettings[key] = value;
        }
    });
    
    if (Object.keys(sanitizedSettings).length === 0) {
        throw new Error('Nenhuma configuração válida para atualizar');
    }
    
    const updatedSettings = await userRepository.updateUserSettings(userId, sanitizedSettings);
    
    securityLog('settings_updated', { userId, updatedSettings: Object.keys(sanitizedSettings) }, userId, req);
    
    return updatedSettings;
};

/**
 * Get user preferences (notifications, study preferences, etc.)
 */
const getUserPreferences = async (userId, req) => {
    const preferences = await userRepository.getUserPreferences(userId);
    
    if (!preferences) {
        // Return default preferences
        return {
            email_notifications: true,
            push_notifications: false,
            study_reminders: true,
            progress_reports: true,
            marketing_emails: false
        };
    }
    
    return preferences;
};

/**
 * Update user preferences
 */
const updateUserPreferences = async (userId, preferencesData, req) => {
    const allowedPreferences = [
        'email_notifications', 'push_notifications', 'study_reminders', 
        'progress_reports', 'marketing_emails'
    ];
    
    const sanitizedPreferences = {};
    
    Object.entries(preferencesData).forEach(([key, value]) => {
        if (allowedPreferences.includes(key)) {
            if (typeof value !== 'boolean') {
                throw new Error(`Preferência inválida para ${key}: deve ser true ou false`);
            }
            sanitizedPreferences[key] = value;
        }
    });
    
    if (Object.keys(sanitizedPreferences).length === 0) {
        throw new Error('Nenhuma preferência válida para atualizar');
    }
    
    const updatedPreferences = await userRepository.updateUserPreferences(userId, sanitizedPreferences);
    
    securityLog('preferences_updated', { userId, updatedPreferences: Object.keys(sanitizedPreferences) }, userId, req);
    
    return updatedPreferences;
};

/**
 * Get user statistics and progress
 */
const getUserStatistics = async (userId, req) => {
    const stats = await userRepository.getUserStatistics(userId);
    
    return {
        planos_criados: stats.plans_created || 0,
        horas_estudadas: stats.hours_studied || 0,
        dias_consecutivos: stats.streak_days || 0,
        ultima_atividade: stats.last_activity,
        data_cadastro: stats.created_at,
        progresso_mes: stats.monthly_progress || 0,
        meta_cumprida: stats.goal_achieved || false
    };
};

/**
 * Update user activity/progress
 */
const updateUserActivity = async (userId, activityData, req) => {
    const { activity_type, duration, metadata } = activityData;
    
    // Validate activity data
    if (!activity_type || typeof activity_type !== 'string') {
        throw new Error('Dados de atividade inválidos: tipo necessário');
    }
    
    const allowedTypes = ['study', 'plan_creation', 'plan_completion', 'login'];
    if (!allowedTypes.includes(activity_type)) {
        throw new Error('Tipo de atividade inválido');
    }
    
    const sanitizedDuration = duration ? sanitizeNumericId(duration) : null;
    const sanitizedMetadata = metadata ? sanitizeJson(JSON.stringify(metadata)) : null;
    
    const result = await userRepository.recordUserActivity(userId, {
        activity_type,
        duration: sanitizedDuration,
        metadata: sanitizedMetadata
    });
    
    securityLog('activity_recorded', { userId, activity_type, duration: sanitizedDuration }, userId, req);
    
    return {
        message: 'Atividade registrada com sucesso',
        activity_id: result.id
    };
};

/**
 * Deactivate user account (soft delete)
 */
const deactivateAccount = async (userId, deactivationData, req) => {
    const { password, reason, confirmation } = deactivationData;
    
    if (confirmation !== 'DESATIVAR') {
        throw new Error('Confirmação necessária: digite "DESATIVAR" para confirmar');
    }
    
    // Get user to check auth provider and password
    const user = await userRepository.getUserProfile(userId);
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // If not a Google user, verify password
    if (user.auth_provider !== 'google') {
        if (!password) {
            throw new Error('Senha atual necessária para desativar conta');
        }
        
        const fullUser = await userRepository.getUserWithPassword(userId);
        if (!await bcrypt.compare(password, fullUser.password_hash)) {
            throw new Error('Senha incorreta');
        }
    }
    
    // Perform deactivation
    await userRepository.deactivateUser(userId, reason);
    
    securityLog('account_deactivated', { userId, reason }, userId, req);
    
    return {
        message: 'Conta desativada com sucesso'
    };
};

/**
 * Delete user account permanently (hard delete)
 */
const deleteAccount = async (userId, deletionData, req) => {
    const { password, confirmation } = deletionData;
    
    if (confirmation !== 'DELETAR PERMANENTEMENTE') {
        throw new Error('Confirmação necessária: digite "DELETAR PERMANENTEMENTE" para confirmar');
    }
    
    // Get user to check auth provider and password
    const user = await userRepository.getUserProfile(userId);
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // If not a Google user, verify password
    if (user.auth_provider !== 'google') {
        if (!password) {
            throw new Error('Senha atual necessária para deletar conta');
        }
        
        const fullUser = await userRepository.getUserWithPassword(userId);
        if (!await bcrypt.compare(password, fullUser.password_hash)) {
            throw new Error('Senha incorreta');
        }
    }
    
    // Delete profile picture file if exists
    if (user.profile_picture && user.profile_picture.startsWith('/uploads/')) {
        try {
            const validatedPath = validateFilePath(user.profile_picture, 'uploads');
            const filePath = path.join(__dirname, '../../', validatedPath.substring(1));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            securityLog('profile_photo_delete_failed', { error: error.message }, userId, req);
        }
    }
    
    // Perform hard delete
    await userRepository.deleteUser(userId);
    
    securityLog('account_deleted', { userId }, userId, req);
    
    return {
        message: 'Conta deletada permanentemente'
    };
};

/**
 * Change user password
 */
const changePassword = async (userId, passwordData, req) => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Todos os campos de senha são obrigatórios');
    }
    
    if (newPassword !== confirmPassword) {
        throw new Error('Nova senha e confirmação não coincidem');
    }
    
    if (newPassword.length < 6) {
        throw new Error('Nova senha deve ter pelo menos 6 caracteres');
    }
    
    // Get user with password
    const user = await userRepository.getUserWithPassword(userId);
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // Check if user is Google OAuth
    if (user.auth_provider === 'google') {
        throw new Error('Usuários do Google não podem alterar senha diretamente');
    }
    
    // Verify current password
    if (!await bcrypt.compare(currentPassword, user.password_hash)) {
        throw new Error('Senha atual incorreta');
    }
    
    // Check if new password is different
    if (await bcrypt.compare(newPassword, user.password_hash)) {
        throw new Error('A nova senha deve ser diferente da senha atual');
    }
    
    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(userId, hashedPassword);
    
    securityLog('password_changed', { userId }, userId, req);
    
    return {
        message: 'Senha alterada com sucesso'
    };
};

/**
 * Get notification preferences
 */
const getNotificationPreferences = async (userId, req) => {
    return await getUserPreferences(userId, req);
};

/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (userId, notificationData, req) => {
    return await updateUserPreferences(userId, notificationData, req);
};

/**
 * Get privacy settings
 */
const getPrivacySettings = async (userId, req) => {
    const settings = await userRepository.getPrivacySettings(userId);
    
    if (!settings) {
        return {
            profile_visibility: 'private',
            show_email: false,
            show_progress: false,
            allow_contact: true
        };
    }
    
    return settings;
};

/**
 * Update privacy settings
 */
const updatePrivacySettings = async (userId, privacyData, req) => {
    const allowedSettings = ['profile_visibility', 'show_email', 'show_progress', 'allow_contact'];
    const validVisibilities = ['public', 'private', 'friends'];
    
    const sanitizedSettings = {};
    
    Object.entries(privacyData).forEach(([key, value]) => {
        if (allowedSettings.includes(key)) {
            if (key === 'profile_visibility' && !validVisibilities.includes(value)) {
                throw new Error(`Visibilidade inválida: ${value}`);
            }
            if (['show_email', 'show_progress', 'allow_contact'].includes(key) && typeof value !== 'boolean') {
                throw new Error(`Configuração inválida para ${key}: deve ser true ou false`);
            }
            sanitizedSettings[key] = value;
        }
    });
    
    const updatedSettings = await userRepository.updatePrivacySettings(userId, sanitizedSettings);
    
    securityLog('privacy_updated', { userId, updatedSettings: Object.keys(sanitizedSettings) }, userId, req);
    
    return updatedSettings;
};

// =====================================
// ADMIN FUNCTIONS
// =====================================

/**
 * Search users (admin only)
 */
const searchUsers = async (queryParams, req) => {
    // TODO: Add admin role check
    // if (req.user.role !== 'admin') {
    //     throw new Error('Acesso negado: apenas administradores');
    // }
    
    const { q, limit = 20, offset = 0 } = queryParams;
    
    if (!q || q.trim().length < 2) {
        throw new Error('Termo de busca deve ter pelo menos 2 caracteres');
    }
    
    const sanitizedQuery = sanitizeInput(q);
    const sanitizedLimit = sanitizeNumericId(limit) || 20;
    const sanitizedOffset = sanitizeNumericId(offset) || 0;
    
    const results = await userRepository.searchUsers(sanitizedQuery, sanitizedLimit, sanitizedOffset);
    
    securityLog('users_searched', { query: sanitizedQuery, results: results.length }, req.user.id, req);
    
    return {
        users: results,
        query: sanitizedQuery,
        total: results.length
    };
};

/**
 * List users with pagination (admin only)
 */
const listUsers = async (queryParams, req) => {
    // TODO: Add admin role check
    
    const { limit = 20, offset = 0, status = 'active' } = queryParams;
    
    const sanitizedLimit = sanitizeNumericId(limit) || 20;
    const sanitizedOffset = sanitizeNumericId(offset) || 0;
    const validStatuses = ['active', 'inactive', 'all'];
    const sanitizedStatus = validStatuses.includes(status) ? status : 'active';
    
    const users = await userRepository.listUsers(sanitizedLimit, sanitizedOffset, sanitizedStatus);
    const totalCount = await userRepository.getUserCount(sanitizedStatus);
    
    securityLog('users_listed', { limit: sanitizedLimit, offset: sanitizedOffset, status: sanitizedStatus }, req.user.id, req);
    
    return {
        users,
        pagination: {
            limit: sanitizedLimit,
            offset: sanitizedOffset,
            total: totalCount,
            hasNext: sanitizedOffset + sanitizedLimit < totalCount
        }
    };
};

/**
 * Get user by ID (admin only)
 */
const getUserById = async (userId, req) => {
    // TODO: Add admin role check
    
    const sanitizedUserId = sanitizeNumericId(userId);
    if (!sanitizedUserId) {
        throw new Error('ID de usuário inválido');
    }
    
    const user = await userRepository.getUserProfile(sanitizedUserId);
    if (!user) {
        throw new Error('Usuário não encontrado');
    }
    
    // Get additional admin data
    const statistics = await userRepository.getUserStatistics(sanitizedUserId);
    
    securityLog('user_viewed_by_admin', { targetUserId: sanitizedUserId }, req.user.id, req);
    
    return {
        ...user,
        statistics
    };
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    uploadProfilePhoto,
    getUserSettings,
    updateUserSettings,
    getUserPreferences,
    updateUserPreferences,
    getUserStatistics,
    updateUserActivity,
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