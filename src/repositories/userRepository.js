/**
 * User Repository - Data access layer for user management
 * 
 * This repository handles all database interactions related to user management,
 * providing a clean interface between the service layer and the database.
 */

const { dbGet, dbAll, dbRun } = require('../utils/database');
const { securityLog } = require('../utils/security');

/**
 * Get user profile with safe fields only
 */
const getUserProfile = async (userId) => {
    return await dbGet(`
        SELECT 
            id, email, name, profile_picture, phone, whatsapp, created_at,
            state, city, birth_date, education, work_status, first_time, concursos_count,
            difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
            google_id, auth_provider, google_avatar, is_active
        FROM users WHERE id = ?
    `, [userId]);
};

/**
 * Get user with password (for authentication operations)
 */
const getUserWithPassword = async (userId) => {
    return await dbGet(`
        SELECT 
            id, email, name, password_hash, auth_provider, is_active
        FROM users WHERE id = ?
    `, [userId]);
};

/**
 * Update user profile with dynamic fields
 */
const updateUserProfile = async (userId, profileData) => {
    const fields = [];
    const values = [];
    
    // Build dynamic update query
    Object.entries(profileData).forEach(([key, value]) => {
        fields.push(`${key} = ?`);
        values.push(value);
    });
    
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    
    values.push(userId);
    
    await dbRun(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    
    return await getUserProfile(userId);
};

/**
 * Update user password
 */
const updatePassword = async (userId, hashedPassword) => {
    await dbRun(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [hashedPassword, new Date().toISOString(), userId]
    );
};

/**
 * Get user settings
 */
const getUserSettings = async (userId) => {
    return await dbGet(`
        SELECT 
            theme, language, timezone, auto_save, compact_mode, updated_at
        FROM user_settings WHERE user_id = ?
    `, [userId]);
};

/**
 * Update or create user settings
 */
const updateUserSettings = async (userId, settingsData) => {
    const fields = [];
    const values = [];
    
    // Build dynamic update query
    Object.entries(settingsData).forEach(([key, value]) => {
        fields.push(`${key} = ?`);
        values.push(value);
    });
    
    if (fields.length === 0) {
        throw new Error('No settings to update');
    }
    
    // Add updated_at
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);
    
    // Try to update first
    const updateResult = await dbRun(
        `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`,
        values
    );
    
    // If no rows affected, create new record
    if (updateResult.changes === 0) {
        const insertFields = ['user_id', 'updated_at'];
        const insertValues = [userId, new Date().toISOString()];
        
        Object.entries(settingsData).forEach(([key, value]) => {
            insertFields.push(key);
            insertValues.push(value);
        });
        
        await dbRun(
            `INSERT INTO user_settings (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
            insertValues
        );
    }
    
    return await getUserSettings(userId);
};

/**
 * Get user preferences
 */
const getUserPreferences = async (userId) => {
    return await dbGet(`
        SELECT 
            email_notifications, push_notifications, study_reminders, 
            progress_reports, marketing_emails, updated_at
        FROM user_preferences WHERE user_id = ?
    `, [userId]);
};

/**
 * Update or create user preferences
 */
const updateUserPreferences = async (userId, preferencesData) => {
    const fields = [];
    const values = [];
    
    // Build dynamic update query
    Object.entries(preferencesData).forEach(([key, value]) => {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0); // Convert boolean to integer for SQLite
    });
    
    if (fields.length === 0) {
        throw new Error('No preferences to update');
    }
    
    // Add updated_at
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);
    
    // Try to update first
    const updateResult = await dbRun(
        `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
        values
    );
    
    // If no rows affected, create new record
    if (updateResult.changes === 0) {
        const insertFields = ['user_id', 'updated_at'];
        const insertValues = [userId, new Date().toISOString()];
        
        Object.entries(preferencesData).forEach(([key, value]) => {
            insertFields.push(key);
            insertValues.push(value ? 1 : 0);
        });
        
        await dbRun(
            `INSERT INTO user_preferences (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
            insertValues
        );
    }
    
    return await getUserPreferences(userId);
};

/**
 * Get user statistics
 */
const getUserStatistics = async (userId) => {
    // Get basic stats from different tables
        const planStats = await dbGet(`
        SELECT 
            COUNT(*) as plans_created,
            SUM(CASE WHEN exam_date < date('now') THEN 1 ELSE 0 END) as plans_completed
        FROM study_plans WHERE user_id = ?
    `, [userId]);
    
    const activityStats = await dbGet(`
        SELECT 
            SUM(CASE WHEN activity_type = 'study' THEN duration ELSE 0 END) as hours_studied,
            MAX(created_at) as last_activity
        FROM user_activities WHERE user_id = ?
    `, [userId]);
    
    const userInfo = await dbGet(`
        SELECT created_at FROM users WHERE id = ?
    `, [userId]);
    
    // Calculate streak (simplified - would need more complex logic for real streaks)
    const streakData = await dbGet(`
        SELECT COUNT(DISTINCT DATE(created_at)) as streak_days 
        FROM user_activities 
        WHERE user_id = ? AND created_at >= DATE('now', '-30 days')
    `, [userId]);
    
    return {
        plans_created: planStats?.plans_created || 0,
        plans_completed: planStats?.plans_completed || 0,
        hours_studied: Math.round((activityStats?.hours_studied || 0) / 60), // Convert minutes to hours
        streak_days: streakData?.streak_days || 0,
        last_activity: activityStats?.last_activity,
        created_at: userInfo?.created_at,
        monthly_progress: 0, // TODO: Implement monthly progress calculation
        goal_achieved: false // TODO: Implement goal tracking
    };
};

/**
 * Record user activity
 */
const recordUserActivity = async (userId, activityData) => {
    const { activity_type, duration, metadata } = activityData;
    
    const result = await dbRun(`
        INSERT INTO user_activities (user_id, activity_type, duration, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)
    `, [
        userId, 
        activity_type, 
        duration, 
        metadata ? JSON.stringify(metadata) : null, 
        new Date().toISOString()
    ]);
    
    return { id: result.lastID };
};

/**
 * Deactivate user (soft delete)
 */
const deactivateUser = async (userId, reason) => {
    await dbRun(`
        UPDATE users 
        SET is_active = 0, deactivation_reason = ?, deactivated_at = ?
        WHERE id = ?
    `, [reason || null, new Date().toISOString(), userId]);
};

/**
 * Delete user permanently
 */
const deleteUser = async (userId) => {
    // Delete user data in correct order due to foreign key constraints
    await dbRun('DELETE FROM user_activities WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM privacy_settings WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM study_plans WHERE user_id = ?', [userId]);
    await dbRun('DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = ?)', [userId]);
    await dbRun('DELETE FROM users WHERE id = ?', [userId]);
};

/**
 * Get privacy settings
 */
const getPrivacySettings = async (userId) => {
    return await dbGet(`
        SELECT 
            profile_visibility, show_email, show_progress, allow_contact, updated_at
        FROM privacy_settings WHERE user_id = ?
    `, [userId]);
};

/**
 * Update or create privacy settings
 */
const updatePrivacySettings = async (userId, privacyData) => {
    const fields = [];
    const values = [];
    
    // Build dynamic update query
    Object.entries(privacyData).forEach(([key, value]) => {
        fields.push(`${key} = ?`);
        if (typeof value === 'boolean') {
            values.push(value ? 1 : 0);
        } else {
            values.push(value);
        }
    });
    
    if (fields.length === 0) {
        throw new Error('No privacy settings to update');
    }
    
    // Add updated_at
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);
    
    // Try to update first
    const updateResult = await dbRun(
        `UPDATE privacy_settings SET ${fields.join(', ')} WHERE user_id = ?`,
        values
    );
    
    // If no rows affected, create new record
    if (updateResult.changes === 0) {
        const insertFields = ['user_id', 'updated_at'];
        const insertValues = [userId, new Date().toISOString()];
        
        Object.entries(privacyData).forEach(([key, value]) => {
            insertFields.push(key);
            if (typeof value === 'boolean') {
                insertValues.push(value ? 1 : 0);
            } else {
                insertValues.push(value);
            }
        });
        
        await dbRun(
            `INSERT INTO privacy_settings (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`,
            insertValues
        );
    }
    
    return await getPrivacySettings(userId);
};

// =====================================
// ADMIN FUNCTIONS
// =====================================

/**
 * Search users by name or email (admin only)
 */
const searchUsers = async (query, limit, offset) => {
    const searchPattern = `%${query}%`;
    
    return await dbAll(`
        SELECT 
            id, email, name, created_at, is_active, auth_provider,
            last_login_at
        FROM users 
        WHERE (name LIKE ? OR email LIKE ?) AND is_active = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [searchPattern, searchPattern, limit, offset]);
};

/**
 * List users with pagination (admin only)
 */
const listUsers = async (limit, offset, status = 'active') => {
    let whereClause = '';
    let params = [limit, offset];
    
    if (status === 'active') {
        whereClause = 'WHERE is_active = 1';
    } else if (status === 'inactive') {
        whereClause = 'WHERE is_active = 0';
    }
    // status === 'all' doesn't add WHERE clause
    
    return await dbAll(`
        SELECT 
            id, email, name, created_at, is_active, auth_provider,
            last_login_at, deactivated_at, deactivation_reason
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, params);
};

/**
 * Get user count (admin only)
 */
const getUserCount = async (status = 'active') => {
    let whereClause = '';
    let params = [];
    
    if (status === 'active') {
        whereClause = 'WHERE is_active = 1';
    } else if (status === 'inactive') {
        whereClause = 'WHERE is_active = 0';
    }
    
    const result = await dbGet(`
        SELECT COUNT(*) as count FROM users ${whereClause}
    `, params);
    
    return result?.count || 0;
};

/**
 * Update last login time
 */
const updateLastLogin = async (userId) => {
    try {
        await dbRun(
            'UPDATE users SET last_login_at = ? WHERE id = ?',
            [new Date().toISOString(), userId]
        );
    } catch (error) {
        // Log but don't throw - this is not critical
        securityLog('update_last_login_failed', { userId, error: error.message });
    }
};

/**
 * Check if user exists and is active
 */
const isUserActive = async (userId) => {
    const user = await dbGet(
        'SELECT is_active FROM users WHERE id = ?',
        [userId]
    );
    
    return user?.is_active === 1;
};

/**
 * Get user's plan count
 */
const getUserPlanCount = async (userId) => {
    const result = await dbGet(
        'SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?',
        [userId]
    );
    
    return result?.count || 0;
};

/**
 * Find user by email (for admin operations)
 */
const findUserByEmail = async (email) => {
    return await dbGet(
        'SELECT id, email, name, created_at, is_active, auth_provider FROM users WHERE email = ?', 
        [email]
    );
};

module.exports = {
    getUserProfile,
    getUserWithPassword,
    updateUserProfile,
    updatePassword,
    getUserSettings,
    updateUserSettings,
    getUserPreferences,
    updateUserPreferences,
    getUserStatistics,
    recordUserActivity,
    deactivateUser,
    deleteUser,
    getPrivacySettings,
    updatePrivacySettings,
    searchUsers,
    listUsers,
    getUserCount,
    updateLastLogin,
    isUserActive,
    getUserPlanCount,
    findUserByEmail
};