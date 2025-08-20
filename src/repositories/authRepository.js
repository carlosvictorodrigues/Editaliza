/**
 * Auth Repository - Data access layer for user authentication
 * 
 * This repository handles all database interactions related to user authentication,
 * providing a clean interface between the service layer and the database.
 */

const { dbGet, dbAll, dbRun } = require('../utils/database');
const { securityLog } = require('../utils/security');
const { getPasswordColumn } = require('../utils/dbCompat');

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
    return await dbGet(
        'SELECT * FROM users WHERE email = $1', 
        [email]
    );
};

/**
 * Find user by ID
 */
const findUserById = async (userId) => {
    return await dbGet(
        'SELECT * FROM users WHERE id = $1', 
        [userId]
    );
};

/**
 * Find user by Google ID
 */
const findUserByGoogleId = async (googleId) => {
    return await dbGet(
        'SELECT * FROM users WHERE google_id = $1', 
        [googleId]
    );
};

/**
 * Find user by reset token
 */
const findUserByResetToken = async (token) => {
    return await dbGet(
        'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2', 
        [token, Date.now()]
    );
};

/**
 * Create new user
 */
const createUser = async (userData) => {
    const { email, passwordHash, name, currentDate } = userData;
    const passwordColumn = getPasswordColumn();
    
    const result = await dbRun(
        `INSERT INTO users (email, ${passwordColumn}, name, created_at) VALUES ($1,$2,$3,$4) RETURNING id`, 
        [email, passwordHash, name || null, currentDate]
    );
    
    // Compatibilidade com diferentes implementações de database
    const userId = result.lastID || result.lastInsertRowid || result.id;
    if (userId) {
        return await findUserById(userId);
    }
    
    throw new Error('Failed to create user');
};

/**
 * Create new Google OAuth user
 */
const createGoogleUser = async (profileData) => {
    const { email, name, googleId, avatar, currentDate } = profileData;
    
    const result = await dbRun(
        `INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
         VALUES ($1, $2, $3, 'google', $4, $5) RETURNING id`,
        [email, name, googleId, avatar, currentDate]
    );
    
    // Compatibilidade com diferentes implementações de database
    const userId = result.lastID || result.lastInsertRowid || result.id;
    if (userId) {
        return await findUserById(userId);
    }
    
    throw new Error('Failed to create Google user');
};

/**
 * Link Google account to existing user
 */
const linkGoogleAccount = async (userId, googleId, avatar, name) => {
    await dbRun(
        'UPDATE users SET google_id = $1, auth_provider = \'google\', google_avatar = $2, name = $3 WHERE id = $4',
        [googleId, avatar, name, userId]
    );
    
    return await findUserById(userId);
};

/**
 * Update password
 */
const updatePassword = async (userId, hashedPassword) => {
    const passwordColumn = getPasswordColumn();
    await dbRun(
        `UPDATE users SET ${passwordColumn} = $1 WHERE id = $2`,
        [hashedPassword, userId]
    );
};

/**
 * Set reset token
 */
const setResetToken = async (userId, token, expires) => {
    await dbRun(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [token, expires, userId]
    );
};

/**
 * Clear reset token
 */
const clearResetToken = async (userId) => {
    await dbRun(
        'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1',
        [userId]
    );
};

/**
 * Get user profile data (safe fields only)
 */
const getUserProfile = async (userId) => {
    return await dbGet(`
        SELECT 
            id, email, name, profile_picture, phone, whatsapp, created_at,
            state, city, birth_date, education, work_status, first_time, concursos_count,
            difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
            google_id, auth_provider, google_avatar
        FROM users WHERE id = $1
    `, [userId]);
};

/**
 * Update user profile
 */
const updateUserProfile = async (userId, profileData) => {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Build dynamic update query
    Object.entries(profileData).forEach(([key, value]) => {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
    });
    
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    
    values.push(userId);
    
    await dbRun(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`,
        values
    );
    
    return await getUserProfile(userId);
};

/**
 * Record login attempt
 */
const recordLoginAttempt = async (email, success, ipAddress, userAgent) => {
    try {
        await dbRun(
            'INSERT INTO login_attempts (email, success, ip_address, user_agent, attempt_time) VALUES ($1, $2, $3, $4, $5)',
            [email, success ? 1 : 0, ipAddress, userAgent, new Date().toISOString()]
        );
    } catch (error) {
        // Log but don't throw - login attempts table might not exist
        securityLog('login_attempt_record_failed', { email, error: error.message });
    }
};

/**
 * Get recent failed login attempts
 */
const getRecentFailedAttempts = async (email, windowMinutes = 15) => {
    try {
        const cutoffTime = new Date(Date.now() - (windowMinutes * 60 * 1000)).toISOString();
        
        const result = await dbGet(
            'SELECT COUNT(*) as count FROM login_attempts WHERE email = $1 AND success = 0 AND attempt_time > $2',
            [email, cutoffTime]
        );
        
        return result?.count || 0;
    } catch (error) {
        // Log but return 0 - table might not exist
        securityLog('failed_attempts_check_failed', { email, error: error.message });
        return 0;
    }
};

const findPlansByUserId = async (userId) => {
    return await dbAll(
        'SELECT * FROM study_plans WHERE user_id = $1',
        [userId]
    );
};

module.exports = {
    findUserByEmail,
    findUserById,
    findUserByGoogleId,
    findUserByResetToken,
    createUser,
    createGoogleUser,
    linkGoogleAccount,
    updatePassword,
    setResetToken,
    clearResetToken,
    getUserProfile,
    updateUserProfile,
    recordLoginAttempt,
    getRecentFailedAttempts,
    findPlansByUserId
};
