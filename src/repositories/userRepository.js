/**
 * User Repository - Data access layer for user management
 * 
 * This repository handles all database interactions related to user management,
 * providing a clean interface between the service layer and the database.
 * 
 * FASE 2: Migrado para usar DatabaseAdapter com suporte PostgreSQL/SQLite
 */

// Usar implementação simples PostgreSQL
const simpleDb = require('../../database-simple-postgres');
// Removido translateQuery, translateParams - não necessários com implementação simples
const { securityLog } = require('../utils/security');
const { getPasswordColumn } = require('../utils/dbCompat');

// Cache da instância do banco
let dbInstance = null;

/**
 * Obter instância do banco de dados
 */
async function getDB() {
    if (!dbInstance) {
        dbInstance = simpleDb;
    }
    return dbInstance;
}

/**
 * Wrapper para queries com log e adaptação
 */
async function executeQuery(type, sql, params = [], logContext = '') {
    const db = await getDB();
    
    try {
        // Log detalhado para debug
        securityLog('user_repository_query', {
            type,
            context: logContext,
            dialect: db.dialect,
            sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
            paramCount: Array.isArray(params) ? params.length : 0
        });
        
        let result;
        
        if (type === 'get') {
            result = await db.get(sql, params);
        } else if (type === 'all') {
            result = await db.all(sql, params);
        } else if (type === 'run') {
            result = await db.run(sql, params);
        }
        
        return result;
        
    } catch (error) {
        securityLog('user_repository_error', {
            type,
            context: logContext,
            error: error.message,
            dialect: db.dialect,
            sql: sql.substring(0, 50)
        });
        throw error;
    }
}

/**
 * Construir query dinâmica com placeholders adaptados
 */
function buildDynamicQuery(baseQuery, fields, whereClause, db) {
    const fieldList = fields.map((field, index) => {
        if (db.isPostgreSQL) {
            return `${field} = $${index + 1}`;
        } else {
            return `${field} = ?`;
        }
    }).join(', ');
    
    const whereParam = db.isPostgreSQL ? `$${fields.length + 1}` : '?';
    
    return `${baseQuery} ${fieldList} ${whereClause} ${whereParam}`;
}

/**
 * Get user profile with safe fields only
 */
const getUserProfile = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            id, email, name, profile_picture, phone, whatsapp, created_at,
            state, city, birth_date, education, work_status, first_time, concursos_count,
            difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
            google_id, auth_provider, google_avatar
        FROM users WHERE id = $1`
        : `SELECT 
            id, email, name, profile_picture, phone, whatsapp, created_at,
            state, city, birth_date, education, work_status, first_time, concursos_count,
            difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
            google_id, auth_provider, google_avatar, is_active
        FROM users WHERE id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getUserProfile');
};

/**
 * Get user with password (for authentication operations)
 */
const getUserWithPassword = async (userId) => {
    const passwordColumn = getPasswordColumn();
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            id, email, name, ${passwordColumn} as password_hash, auth_provider, is_active
        FROM users WHERE id = $1`
        : `SELECT 
            id, email, name, ${passwordColumn} as password_hash, auth_provider, is_active
        FROM users WHERE id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getUserWithPassword');
};

/**
 * Update user profile with dynamic fields
 */
const updateUserProfile = async (userId, profileData) => {
    const db = await getDB();
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.entries(profileData).forEach(([key, value]) => {
        if (db.isPostgreSQL) {
            fields.push(`${key} = $${paramCount}`);
        } else {
            fields.push(`${key} = ?`);
        }
        values.push(value);
        paramCount++;
    });
    
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    
    values.push(userId);
    
    let sql;
    if (db.isPostgreSQL) {
        sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    } else {
        sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    }
    
    await executeQuery('run', sql, values, 'updateUserProfile');
    
    return await getUserProfile(userId);
};

/**
 * Update user password
 */
const updatePassword = async (userId, hashedPassword) => {
    const passwordColumn = getPasswordColumn();
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `UPDATE users SET ${passwordColumn} = $1, updated_at = $2 WHERE id = $3`
        : `UPDATE users SET ${passwordColumn} = ?, updated_at = ? WHERE id = ?`;
    
    await executeQuery('run', sql, [hashedPassword, new Date().toISOString(), userId], 'updatePassword');
};

/**
 * Get user settings
 */
const getUserSettings = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            theme, language, timezone, auto_save, compact_mode, updated_at
        FROM user_settings WHERE user_id = $1`
        : `SELECT 
            theme, language, timezone, auto_save, compact_mode, updated_at
        FROM user_settings WHERE user_id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getUserSettings');
};

/**
 * Update or create user settings
 */
const updateUserSettings = async (userId, settingsData) => {
    const db = await getDB();
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.entries(settingsData).forEach(([key, value]) => {
        if (db.isPostgreSQL) {
            fields.push(`${key} = $${paramCount}`);
        } else {
            fields.push(`${key} = ?`);
        }
        values.push(value);
        paramCount++;
    });
    
    if (fields.length === 0) {
        throw new Error('No settings to update');
    }
    
    // Add updated_at
    if (db.isPostgreSQL) {
        fields.push(`updated_at = $${paramCount}`);
        paramCount++;
    } else {
        fields.push('updated_at = ?');
    }
    values.push(new Date().toISOString());
    values.push(userId);
    
    let updateSql;
    if (db.isPostgreSQL) {
        updateSql = `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $${paramCount}`;
    } else {
        updateSql = `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`;
    }
    
    // Try to update first
    const updateResult = await executeQuery('run', updateSql, values, 'updateUserSettings_update');
    
    // If no rows affected, create new record
    if (updateResult.changes === 0) {
        const insertFields = ['user_id', 'updated_at'];
        const insertValues = [userId, new Date().toISOString()];
        
        Object.entries(settingsData).forEach(([key, value]) => {
            insertFields.push(key);
            insertValues.push(value);
        });
        
        let insertSql;
        if (db.isPostgreSQL) {
            const placeholders = insertFields.map((_, index) => `$${index + 1}`).join(', ');
            insertSql = `INSERT INTO user_settings (${insertFields.join(', ')}) VALUES (${placeholders})`;
        } else {
            insertSql = `INSERT INTO user_settings (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
        }
        
        await executeQuery('run', insertSql, insertValues, 'updateUserSettings_insert');
    }
    
    return await getUserSettings(userId);
};

/**
 * Get user preferences
 */
const getUserPreferences = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            email_notifications, push_notifications, study_reminders, 
            progress_reports, marketing_emails, updated_at
        FROM user_preferences WHERE user_id = $1`
        : `SELECT 
            email_notifications, push_notifications, study_reminders, 
            progress_reports, marketing_emails, updated_at
        FROM user_preferences WHERE user_id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getUserPreferences');
};

/**
 * Update or create user preferences
 */
const updateUserPreferences = async (userId, preferencesData) => {
    const db = await getDB();
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.entries(preferencesData).forEach(([key, value]) => {
        if (db.isPostgreSQL) {
            fields.push(`${key} = $${paramCount}`);
        } else {
            fields.push(`${key} = ?`);
        }
        values.push(value ? 1 : 0); // Convert boolean to integer for SQLite
        paramCount++;
    });
    
    if (fields.length === 0) {
        throw new Error('No preferences to update');
    }
    
    // Add updated_at
    if (db.isPostgreSQL) {
        fields.push(`updated_at = $${paramCount}`);
        paramCount++;
    } else {
        fields.push('updated_at = ?');
    }
    values.push(new Date().toISOString());
    values.push(userId);
    
    // Try to update first
    let updateSql;
    if (db.isPostgreSQL) {
        updateSql = `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = $${paramCount}`;
    } else {
        updateSql = `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`;
    }
    
    const updateResult = await executeQuery('run', updateSql, values, 'updateUserPreferences_update');
    
    // If no rows affected, create new record
    if (updateResult.changes === 0) {
        const insertFields = ['user_id', 'updated_at'];
        const insertValues = [userId, new Date().toISOString()];
        
        Object.entries(preferencesData).forEach(([key, value]) => {
            insertFields.push(key);
            insertValues.push(value ? 1 : 0);
        });
        
        let insertSql;
        if (db.isPostgreSQL) {
            const placeholders = insertFields.map((_, index) => `$${index + 1}`).join(', ');
            insertSql = `INSERT INTO user_preferences (${insertFields.join(', ')}) VALUES (${placeholders})`;
        } else {
            insertSql = `INSERT INTO user_preferences (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
        }
        
        await executeQuery('run', insertSql, insertValues, 'updateUserPreferences_insert');
    }
    
    return await getUserPreferences(userId);
};

/**
 * Get user statistics
 */
const getUserStatistics = async (userId) => {
    const db = await getDB();
    
    // Get basic stats from different tables
    const planStatsSQL = db.isPostgreSQL 
        ? `SELECT 
            COUNT(*) as plans_created,
            SUM(CASE WHEN exam_date < CURRENT_DATE THEN 1 ELSE 0 END) as plans_completed
        FROM study_plans WHERE user_id = $1`
        : `SELECT 
            COUNT(*) as plans_created,
            SUM(CASE WHEN exam_date < date('now') THEN 1 ELSE 0 END) as plans_completed
        FROM study_plans WHERE user_id = ?`;
    
    const planStats = await executeQuery('get', planStatsSQL, [userId], 'getUserStatistics_plans');
    
    const activityStatsSQL = db.isPostgreSQL 
        ? `SELECT 
            SUM(CASE WHEN activity_type = 'study' THEN duration ELSE 0 END) as hours_studied,
            MAX(created_at) as last_activity
        FROM user_activities WHERE user_id = $1`
        : `SELECT 
            SUM(CASE WHEN activity_type = 'study' THEN duration ELSE 0 END) as hours_studied,
            MAX(created_at) as last_activity
        FROM user_activities WHERE user_id = ?`;
    
    const activityStats = await executeQuery('get', activityStatsSQL, [userId], 'getUserStatistics_activities');
    
    const userInfoSQL = db.isPostgreSQL 
        ? 'SELECT created_at FROM users WHERE id = $1'
        : 'SELECT created_at FROM users WHERE id = ?';
    
    const userInfo = await executeQuery('get', userInfoSQL, [userId], 'getUserStatistics_user');
    
    // Calculate streak (simplified - would need more complex logic for real streaks)
    const streakSQL = db.isPostgreSQL 
        ? `SELECT COUNT(DISTINCT DATE(created_at)) as streak_days 
        FROM user_activities 
        WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'`
        : `SELECT COUNT(DISTINCT DATE(created_at)) as streak_days 
        FROM user_activities 
        WHERE user_id = ? AND created_at >= DATE('now', '-30 days')`;
    
    const streakData = await executeQuery('get', streakSQL, [userId], 'getUserStatistics_streak');
    
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
    const db = await getDB();
    
    let sql, result;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO user_activities (user_id, activity_type, duration, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`;
        result = await executeQuery('run', sql, [
            userId, 
            activity_type, 
            duration, 
            metadata ? JSON.stringify(metadata) : null, 
            new Date().toISOString()
        ], 'recordUserActivity');
        
        const id = result?.rows?.[0]?.id || result?.id;
        return { id };
    } else {
        sql = `INSERT INTO user_activities (user_id, activity_type, duration, metadata, created_at)
        VALUES (?, ?, ?, ?, ?)`;
        result = await executeQuery('run', sql, [
            userId, 
            activity_type, 
            duration, 
            metadata ? JSON.stringify(metadata) : null, 
            new Date().toISOString()
        ], 'recordUserActivity');
        
        return { id: result.lastID };
    }
};

/**
 * Deactivate user (soft delete)
 */
const deactivateUser = async (userId, reason) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `-- PostgreSQL: User deactivation not implemented (no is_active column)
        SELECT 1 WHERE FALSE`
        : `UPDATE users 
        SET is_active = 0, deactivation_reason = ?, deactivated_at = ?
        WHERE id = ?`;
    
    await executeQuery('run', sql, [reason || null, new Date().toISOString(), userId], 'deactivateUser');
};

/**
 * Delete user permanently
 */
const deleteUser = async (userId) => {
    const db = await getDB();
    
    // Delete user data in correct order due to foreign key constraints
    const queries = [
        'DELETE FROM user_activities WHERE user_id = ',
        'DELETE FROM user_settings WHERE user_id = ',
        'DELETE FROM user_preferences WHERE user_id = ',
        'DELETE FROM privacy_settings WHERE user_id = ',
        'DELETE FROM study_plans WHERE user_id = ',
        'DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = ',
        'DELETE FROM users WHERE id = '
    ];
    
    for (let i = 0; i < queries.length; i++) {
        const baseQuery = queries[i];
        let sql;
        let params;
        
        if (i === 5) { // login_attempts query is different
            sql = db.isPostgreSQL 
                ? baseQuery + '$1)'
                : baseQuery + '?)';
            params = [userId];
        } else {
            sql = db.isPostgreSQL 
                ? baseQuery + '$1'
                : baseQuery + '?';
            params = [userId];
        }
        
        await executeQuery('run', sql, params, `deleteUser_step${i + 1}`);
    }
};

/**
 * Get privacy settings
 */
const getPrivacySettings = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `SELECT 
            profile_visibility, show_email, show_progress, allow_contact, updated_at
        FROM privacy_settings WHERE user_id = $1`
        : `SELECT 
            profile_visibility, show_email, show_progress, allow_contact, updated_at
        FROM privacy_settings WHERE user_id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getPrivacySettings');
};

/**
 * Update or create privacy settings
 */
const updatePrivacySettings = async (userId, privacyData) => {
    const db = await getDB();
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.entries(privacyData).forEach(([key, value]) => {
        if (db.isPostgreSQL) {
            fields.push(`${key} = $${paramCount}`);
        } else {
            fields.push(`${key} = ?`);
        }
        if (typeof value === 'boolean') {
            values.push(value ? 1 : 0);
        } else {
            values.push(value);
        }
        paramCount++;
    });
    
    if (fields.length === 0) {
        throw new Error('No privacy settings to update');
    }
    
    // Add updated_at
    if (db.isPostgreSQL) {
        fields.push(`updated_at = $${paramCount}`);
        paramCount++;
    } else {
        fields.push('updated_at = ?');
    }
    values.push(new Date().toISOString());
    values.push(userId);
    
    // Try to update first
    let updateSql;
    if (db.isPostgreSQL) {
        updateSql = `UPDATE privacy_settings SET ${fields.join(', ')} WHERE user_id = $${paramCount}`;
    } else {
        updateSql = `UPDATE privacy_settings SET ${fields.join(', ')} WHERE user_id = ?`;
    }
    
    const updateResult = await executeQuery('run', updateSql, values, 'updatePrivacySettings_update');
    
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
        
        let insertSql;
        if (db.isPostgreSQL) {
            const placeholders = insertFields.map((_, index) => `$${index + 1}`).join(', ');
            insertSql = `INSERT INTO privacy_settings (${insertFields.join(', ')}) VALUES (${placeholders})`;
        } else {
            insertSql = `INSERT INTO privacy_settings (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
        }
        
        await executeQuery('run', insertSql, insertValues, 'updatePrivacySettings_insert');
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
    const db = await getDB();
    
    const sql = db.isPostgreSQL 
        ? `SELECT 
            id, email, name, created_at, auth_provider
        FROM users 
        WHERE (name LIKE $1 OR email LIKE $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`
        : `SELECT 
            id, email, name, created_at, is_active, auth_provider,
            last_login_at
        FROM users 
        WHERE (name LIKE ? OR email LIKE ?) AND is_active = 1
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`;
    
    return await executeQuery('all', sql, [searchPattern, searchPattern, limit, offset], 'searchUsers');
};

/**
 * List users with pagination (admin only)
 */
const listUsers = async (limit, offset, status = 'active') => {
    const db = await getDB();
    let whereClause = '';
    let params;
    
    if (db.isPostgreSQL) {
        params = [limit, offset];
        // PostgreSQL: Não há coluna is_active, listar todos os usuários
        whereClause = '';
        
        const sql = `SELECT 
            id, email, name, created_at, auth_provider
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`;
        
        return await executeQuery('all', sql, params, 'listUsers');
    } else {
        params = [limit, offset];
        if (status === 'active') {
            whereClause = 'WHERE is_active = 1';
        } else if (status === 'inactive') {
            whereClause = 'WHERE is_active = 0';
        }
        
        const sql = `SELECT 
            id, email, name, created_at, is_active, auth_provider,
            last_login_at, deactivated_at, deactivation_reason
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`;
        
        return await executeQuery('all', sql, params, 'listUsers');
    }
};

/**
 * Get user count (admin only)
 */
const getUserCount = async (status = 'active') => {
    const db = await getDB();
    let whereClause = '';
    const params = [];
    
    if (db.isPostgreSQL) {
        // PostgreSQL: Não há coluna is_active, contar todos
        whereClause = '';
    } else {
        if (status === 'active') {
            whereClause = 'WHERE is_active = 1';
        } else if (status === 'inactive') {
            whereClause = 'WHERE is_active = 0';
        }
    }
    
    const sql = `SELECT COUNT(*) as count FROM users ${whereClause}`;
    const result = await executeQuery('get', sql, params, 'getUserCount');
    
    return result?.count || 0;
};

/**
 * Update last login time
 */
const updateLastLogin = async (userId) => {
    try {
        const db = await getDB();
        const sql = db.isPostgreSQL 
            ? 'UPDATE users SET last_login_at = $1 WHERE id = $2'
            : 'UPDATE users SET last_login_at = ? WHERE id = ?';
        
        await executeQuery('run', sql, [new Date().toISOString(), userId], 'updateLastLogin');
    } catch (error) {
        // Log but don't throw - this is not critical
        securityLog('update_last_login_failed', { userId, error: error.message });
    }
};

/**
 * Check if user exists and is active
 */
const isUserActive = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT id FROM users WHERE id = $1'
        : 'SELECT is_active FROM users WHERE id = ?';
    
    const user = await executeQuery('get', sql, [userId], 'isUserActive');
    
    if (db.isPostgreSQL) {
        // Para PostgreSQL, assumir que usuário existe = ativo
        return !!user;
    }
    return user?.is_active === 1;
};

/**
 * Get user's plan count
 */
const getUserPlanCount = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT COUNT(*) as count FROM study_plans WHERE user_id = $1'
        : 'SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?';
    
    const result = await executeQuery('get', sql, [userId], 'getUserPlanCount');
    
    return result?.count || 0;
};

/**
 * Find user by email (for admin operations)
 */
const findUserByEmail = async (email) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT id, email, name, created_at, auth_provider FROM users WHERE email = $1'
        : 'SELECT id, email, name, created_at, is_active, auth_provider FROM users WHERE email = ?';
    
    return await executeQuery('get', sql, [email], 'findUserByEmail');
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