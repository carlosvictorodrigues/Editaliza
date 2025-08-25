/**
 * User Repository
 * Implementação profissional com métodos bem nomeados e contexto de negócio
 */

const BaseRepository = require('./base.repository');

class UserRepository extends BaseRepository {
    constructor(db) {
        super(db);
    }

    // ======================== AUTHENTICATION ========================

    /**
     * Busca usuário por email para autenticação
     */
    async findByEmail(email) {
        const query = `SELECT * FROM users WHERE email = $1`;
        return this.findOne(query, [email]);
    }

    /**
     * Busca usuário por Google ID para OAuth
     */
    async findByGoogleId(googleId) {
        const query = `SELECT * FROM users WHERE google_id = $1`;
        return this.findOne(query, [googleId]);
    }

    /**
     * Busca usuário por ID
     */
    async findById(id) {
        const query = `SELECT * FROM users WHERE id = $1`;
        return this.findOne(query, [id]);
    }

    /**
     * Busca perfil completo do usuário (sem dados sensíveis)
     */
    async findProfileById(id) {
        const query = `
            SELECT 
                id, email, name, profile_picture, phone, whatsapp, created_at,
                state, city, birth_date, education, work_status, first_time, concursos_count,
                difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
                google_id, auth_provider, google_avatar
            FROM users WHERE id = $1
        `;
        return this.findOne(query, [id]);
    }

    // ======================== USER CREATION ========================

    /**
     * Cria usuário com email/senha
     */
    async createWithPassword(userData) {
        const query = `
            INSERT INTO users (email, password_hash, name, created_at) 
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;
        const params = [
            userData.email,
            userData.password_hash,
            userData.name,
            userData.created_at || new Date()
        ];
        return this.create(query, params);
    }

    /**
     * Cria usuário com Google OAuth
     */
    async createWithGoogle(userData) {
        const query = `
            INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;
        const params = [
            userData.email,
            userData.name,
            userData.google_id,
            userData.auth_provider || 'google',
            userData.google_avatar,
            userData.created_at || new Date()
        ];
        return this.create(query, params);
    }

    // ======================== PROFILE UPDATES ========================

    /**
     * Vincula conta Google a usuário existente
     */
    async linkGoogleAccount(userId, googleData) {
        const query = `
            UPDATE users 
            SET google_id = $1, auth_provider = $2, google_avatar = $3 
            WHERE id = $4
        `;
        const params = [
            googleData.google_id,
            googleData.auth_provider || 'google',
            googleData.google_avatar,
            userId
        ];
        return this.update(query, params);
    }

    /**
     * Atualiza foto de perfil
     */
    async updateProfilePicture(userId, pictureUrl) {
        // Primeiro busca a foto atual para eventual limpeza
        const currentPicture = await this.db.get(
            'SELECT profile_picture FROM users WHERE id = $1',
            [userId]
        );

        const query = `UPDATE users SET profile_picture = $1 WHERE id = $2`;
        const result = await this.update(query, [pictureUrl, userId]);
        
        return {
            changes: result,
            previousPicture: currentPicture?.profile_picture
        };
    }

    // ======================== PASSWORD RESET ========================

    /**
     * Define token de reset de senha
     */
    async setResetToken(userId, token, expiresAt) {
        const query = `
            UPDATE users 
            SET reset_token = $1, reset_token_expires = $2 
            WHERE id = $3
        `;
        return this.update(query, [token, expiresAt, userId]);
    }

    /**
     * Busca usuário por token de reset válido
     */
    async findByValidResetToken(token) {
        const query = `
            SELECT * FROM users 
            WHERE reset_token = $1 AND reset_token_expires > $2
        `;
        return this.findOne(query, [token, new Date()]);
    }

    /**
     * Reseta senha e limpa token
     */
    async resetPassword(userId, newPasswordHash) {
        const query = `
            UPDATE users 
            SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
            WHERE id = $2
        `;
        return this.update(query, [newPasswordHash, userId]);
    }

    // ======================== USER VALIDATION ========================

    /**
     * Verifica se email já existe
     */
    async emailExists(email) {
        return this.exists('users', 'email = $1', [email]);
    }

    /**
     * Verifica se Google ID já existe
     */
    async googleIdExists(googleId) {
        return this.exists('users', 'google_id = $1', [googleId]);
    }

    // ======================== BUSINESS METHODS ========================

    /**
     * Busca usuários por critérios (admin)
     */
    async findByCriteria(criteria = {}, page = 1, limit = 20) {
        const whereConditions = [];
        const params = [];
        let paramIndex = 1;

        if (criteria.email) {
            whereConditions.push(`email ILIKE $${paramIndex}`);
            params.push(`%${criteria.email}%`);
            paramIndex++;
        }

        if (criteria.name) {
            whereConditions.push(`name ILIKE $${paramIndex}`);
            params.push(`%${criteria.name}%`);
            paramIndex++;
        }

        if (criteria.auth_provider) {
            whereConditions.push(`auth_provider = $${paramIndex}`);
            params.push(criteria.auth_provider);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        const query = `
            SELECT id, email, name, created_at, auth_provider, profile_picture
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const offset = (page - 1) * limit;
        params.push(limit, offset);

        return this.findAll(query, params);
    }

    /**
     * Conta total de usuários
     */
    async getTotalCount() {
        return this.count('users');
    }

    /**
     * Estatísticas de usuários
     */
    async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN auth_provider = 'google' THEN 1 END) as google_users,
                COUNT(CASE WHEN auth_provider IS NULL THEN 1 END) as email_users,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_users
            FROM users
        `;
        return this.findOne(query, []);
    }

    // ======================== DATA VALIDATION ========================

    /**
     * Valida dados de usuário antes da criação
     */
    validateUserData(userData) {
        const errors = [];

        if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) {
            errors.push('Email inválido');
        }

        if (!userData.name || userData.name.trim().length < 2) {
            errors.push('Nome deve ter pelo menos 2 caracteres');
        }

        if (userData.password && userData.password.length < 8) {
            errors.push('Senha deve ter pelo menos 8 caracteres');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = UserRepository;