/**
 * Auth Repository - Data access layer for user authentication
 * 
 * This repository handles all database interactions related to user authentication,
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
        securityLog('auth_repository_query', {
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
            
            // Adaptar lastID para compatibilidade
            if (db.isPostgreSQL && result && !result.lastID && !result.id) {
                // No PostgreSQL, pode precisar do ID retornado na query RETURNING
                securityLog('auth_repository_lastid_adaptation', {
                    context: logContext,
                    hasLastID: !!result.lastID,
                    hasId: !!result.id,
                    changes: result.changes
                });
            }
        }
        
        return result;
        
    } catch (error) {
        securityLog('auth_repository_error', {
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
 * Find user by email
 */
const findUserByEmail = async (email) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM users WHERE email = $1'
        : 'SELECT * FROM users WHERE email = ?';
    
    return await executeQuery('get', sql, [email], 'findUserByEmail');
};

/**
 * Find user by ID
 */
const findUserById = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM users WHERE id = $1'
        : 'SELECT * FROM users WHERE id = ?';
    
    return await executeQuery('get', sql, [userId], 'findUserById');
};

/**
 * Find user by Google ID
 */
const findUserByGoogleId = async (googleId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM users WHERE google_id = $1'
        : 'SELECT * FROM users WHERE google_id = ?';
    
    return await executeQuery('get', sql, [googleId], 'findUserByGoogleId');
};

/**
 * Find user by reset token
 */
const findUserByResetToken = async (token) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2'
        : 'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?';
    
    return await executeQuery('get', sql, [token, Date.now()], 'findUserByResetToken');
};

/**
 * Create new user
 */
const createUser = async (userData) => {
    const { email, passwordHash, name, currentDate } = userData;
    const passwordColumn = getPasswordColumn();
    const db = await getDB();
    
    let sql, params;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO users (email, ${passwordColumn}, name, created_at) VALUES ($1, $2, $3, $4) RETURNING id`;
        params = [email, passwordHash, name || null, currentDate];
    } else {
        sql = `INSERT INTO users (email, ${passwordColumn}, name, created_at) VALUES (?, ?, ?, ?)`;
        params = [email, passwordHash, name || null, currentDate];
    }
    
    try {
        const result = await executeQuery('run', sql, params, 'createUser');
        
        // Adaptação para obter userId
        let userId;
        
        if (db.isPostgreSQL) {
            // No PostgreSQL com RETURNING, o ID vem diretamente no lastID
            userId = result.lastID;
            
            // Se não tiver lastID, tentar obter do rows
            if (!userId && result && result.rows && result.rows[0]) {
                userId = result.rows[0].id;
            }
        } else {
            // SQLite tradicional
            userId = result.lastID || result.lastInsertRowid;
        }
        
        if (userId) {
            securityLog('auth_repository_user_created', {
                userId,
                email,
                dialect: db.dialect
            });
            
            // Buscar usuário criado diretamente
            return await findUserById(userId);
        }
        
        throw new Error('Failed to create user - no ID returned');
        
    } catch (error) {
        securityLog('auth_repository_create_user_error', {
            error: error.message,
            email,
            dialect: db.dialect
        });
        throw error;
    }
};

/**
 * Create new Google OAuth user
 */
const createGoogleUser = async (profileData) => {
    const { email, name, googleId, avatar, currentDate } = profileData;
    const db = await getDB();
    
    let sql, params;
    
    if (db.isPostgreSQL) {
        sql = `INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
               VALUES ($1, $2, $3, 'google', $4, $5) RETURNING id`;
        params = [email, name, googleId, avatar, currentDate];
    } else {
        sql = `INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
               VALUES (?, ?, ?, 'google', ?, ?)`;
        params = [email, name, googleId, avatar, currentDate];
    }
    
    try {
        const result = await executeQuery('run', sql, params, 'createGoogleUser');
        
        // Adaptação para obter userId
        let userId;
        
        if (db.isPostgreSQL) {
            // No PostgreSQL com RETURNING, o ID vem diretamente no lastID
            userId = result.lastID;
            
            // Se não tiver lastID, tentar obter do rows
            if (!userId && result && result.rows && result.rows[0]) {
                userId = result.rows[0].id;
            }
        } else {
            userId = result.lastID || result.lastInsertRowid;
        }
        
        if (userId) {
            securityLog('auth_repository_google_user_created', {
                userId,
                email,
                googleId,
                dialect: db.dialect
            });
            
            return await findUserById(userId);
        }
        
        throw new Error('Failed to create Google user - no ID returned');
        
    } catch (error) {
        securityLog('auth_repository_create_google_user_error', {
            error: error.message,
            email,
            googleId,
            dialect: db.dialect
        });
        throw error;
    }
};

/**
 * Link Google account to existing user
 */
const linkGoogleAccount = async (userId, googleId, avatar, name) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'UPDATE users SET google_id = $1, auth_provider = \'google\', google_avatar = $2, name = $3 WHERE id = $4'
        : 'UPDATE users SET google_id = ?, auth_provider = \'google\', google_avatar = ?, name = ? WHERE id = ?';
    
    await executeQuery('run', sql, [googleId, avatar, name, userId], 'linkGoogleAccount');
    
    return await findUserById(userId);
};

/**
 * Update password
 */
const updatePassword = async (userId, hashedPassword) => {
    const passwordColumn = getPasswordColumn();
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? `UPDATE users SET ${passwordColumn} = $1 WHERE id = $2`
        : `UPDATE users SET ${passwordColumn} = ? WHERE id = ?`;
    
    await executeQuery('run', sql, [hashedPassword, userId], 'updatePassword');
};

/**
 * Set reset token
 */
const setResetToken = async (userId, token, expires) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3'
        : 'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?';
    
    await executeQuery('run', sql, [token, expires, userId], 'setResetToken');
};

/**
 * Clear reset token
 */
const clearResetToken = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1'
        : 'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?';
    
    await executeQuery('run', sql, [userId], 'clearResetToken');
};

/**
 * Get user profile data (safe fields only)
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
            google_id, auth_provider, google_avatar
        FROM users WHERE id = ?`;
    
    return await executeQuery('get', sql, [userId], 'getUserProfile');
};

/**
 * Update user profile
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
 * Record login attempt
 */
const recordLoginAttempt = async (email, success, ipAddress, userAgent) => {
    try {
        const db = await getDB();
        const sql = db.isPostgreSQL 
            ? 'INSERT INTO login_attempts (email, success, ip_address, user_agent, attempt_time) VALUES ($1, $2, $3, $4, $5)'
            : 'INSERT INTO login_attempts (email, success, ip_address, user_agent, attempt_time) VALUES (?, ?, ?, ?, ?)';
        
        await executeQuery('run', sql, [email, success ? 1 : 0, ipAddress, userAgent, new Date().toISOString()], 'recordLoginAttempt');
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
        const db = await getDB();
        const cutoffTime = new Date(Date.now() - (windowMinutes * 60 * 1000)).toISOString();
        const sql = db.isPostgreSQL 
            ? 'SELECT COUNT(*) as count FROM login_attempts WHERE email = $1 AND success = 0 AND attempt_time > $2'
            : 'SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND attempt_time > ?';
        
        const result = await executeQuery('get', sql, [email, cutoffTime], 'getRecentFailedAttempts');
        
        return result?.count || 0;
    } catch (error) {
        // Log but return 0 - table might not exist
        securityLog('failed_attempts_check_failed', { email, error: error.message });
        return 0;
    }
};

const findPlansByUserId = async (userId) => {
    const db = await getDB();
    const sql = db.isPostgreSQL 
        ? 'SELECT * FROM study_plans WHERE user_id = $1'
        : 'SELECT * FROM study_plans WHERE user_id = ?';
    
    return await executeQuery('all', sql, [userId], 'findPlansByUserId');
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
