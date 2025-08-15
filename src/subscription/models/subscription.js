// subscription.js - Modelo de assinatura com segurança robusta
const db = require('../utils/database');
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');

class SubscriptionModel {
    /**
     * Cria uma nova assinatura
     * @param {Object} subscriptionData - Dados da assinatura
     * @returns {Promise<Object>} - Assinatura criada
     */
    static async create(subscriptionData) {
        const {
            userId,
            kiwifyTransactionId,
            kiwifyProductId,
            plan,
            status,
            amount,
            currency = 'BRL',
            paymentMethod,
            expiresAt,
            metadata = {}
        } = subscriptionData;

        const subscriptionId = crypto.randomUUID();
        const encryptedMetadata = this.encryptMetadata(metadata);
        const now = new Date().toISOString();

        const query = `
            INSERT INTO subscriptions (
                id, user_id, kiwify_transaction_id, kiwify_product_id,
                plan, status, amount, currency, payment_method,
                created_at, updated_at, expires_at, metadata,
                version, checksum
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `;

        const checksum = this.generateChecksum(subscriptionData);

        try {
            await db.run(query, [
                subscriptionId, userId, kiwifyTransactionId, kiwifyProductId,
                plan, status, amount, currency, paymentMethod,
                now, now, expiresAt, encryptedMetadata, checksum
            ]);

            // Log da criação para auditoria
            await this.logAuditEvent({
                subscriptionId,
                action: 'CREATE',
                userId,
                details: { plan, amount, status },
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent
            });

            return await this.findById(subscriptionId);
        } catch (error) {
            throw new AppError(
                'Erro ao criar assinatura',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Busca assinatura por ID
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object|null>} - Assinatura encontrada
     */
    static async findById(subscriptionId) {
        const query = `
            SELECT s.*, u.email, u.name as user_name
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `;

        try {
            const subscription = await db.get(query, [subscriptionId]);
            if (!subscription) return null;

            return this.decryptSubscription(subscription);
        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura',
                ERROR_TYPES.DATABASE_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Busca assinatura ativa por usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object|null>} - Assinatura ativa
     */
    static async findActiveByUserId(userId) {
        const query = `
            SELECT * FROM subscriptions 
            WHERE user_id = ? 
            AND status IN ('active', 'trialing')
            AND (expires_at IS NULL OR expires_at > datetime('now'))
            ORDER BY created_at DESC
            LIMIT 1
        `;

        try {
            const subscription = await db.get(query, [userId]);
            if (!subscription) return null;

            return this.decryptSubscription(subscription);
        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura ativa',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Atualiza status da assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {Object} updateData - Dados para atualizar
     * @returns {Promise<Object>} - Assinatura atualizada
     */
    static async updateStatus(subscriptionId, updateData) {
        const { status, metadata = {}, userId } = updateData;
        const now = new Date().toISOString();
        
        // Buscar versão atual para controle de concorrência
        const current = await this.findById(subscriptionId);
        if (!current) {
            throw new AppError(
                'Assinatura não encontrada',
                ERROR_TYPES.NOT_FOUND,
                { subscriptionId }
            );
        }

        const newVersion = current.version + 1;
        const encryptedMetadata = this.encryptMetadata({
            ...current.metadata,
            ...metadata,
            statusHistory: [
                ...(current.metadata.statusHistory || []),
                {
                    from: current.status,
                    to: status,
                    timestamp: now,
                    reason: metadata.reason
                }
            ]
        });

        const query = `
            UPDATE subscriptions 
            SET status = ?, updated_at = ?, metadata = ?, version = ?
            WHERE id = ? AND version = ?
        `;

        try {
            const result = await db.run(query, [
                status, now, encryptedMetadata, newVersion,
                subscriptionId, current.version
            ]);

            if (result.changes === 0) {
                throw new AppError(
                    'Conflito de concorrência na atualização',
                    ERROR_TYPES.CONFLICT,
                    { subscriptionId, currentVersion: current.version }
                );
            }

            // Log da atualização para auditoria
            await this.logAuditEvent({
                subscriptionId,
                action: 'UPDATE_STATUS',
                userId,
                details: { fromStatus: current.status, toStatus: status },
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent
            });

            return await this.findById(subscriptionId);
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao atualizar status da assinatura',
                ERROR_TYPES.DATABASE_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Busca assinatura por ID da transação Kiwify
     * @param {string} kiwifyTransactionId - ID da transação Kiwify
     * @returns {Promise<Object|null>} - Assinatura encontrada
     */
    static async findByKiwifyTransactionId(kiwifyTransactionId) {
        const query = `
            SELECT s.*, u.email, u.name as user_name
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            WHERE s.kiwify_transaction_id = ?
        `;

        try {
            const subscription = await db.get(query, [kiwifyTransactionId]);
            if (!subscription) return null;

            return this.decryptSubscription(subscription);
        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura por transação Kiwify',
                ERROR_TYPES.DATABASE_ERROR,
                { kiwifyTransactionId, originalError: error.message }
            );
        }
    }

    /**
     * Lista assinaturas com paginação
     * @param {Object} options - Opções de listagem
     * @returns {Promise<Object>} - Lista paginada
     */
    static async list(options = {}) {
        const {
            page = 1,
            limit = 50,
            status,
            userId,
            plan,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;

        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('s.status = ?');
            params.push(status);
        }

        if (userId) {
            conditions.push('s.user_id = ?');
            params.push(userId);
        }

        if (plan) {
            conditions.push('s.plan = ?');
            params.push(plan);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const query = `
            SELECT s.*, u.email, u.name as user_name
            FROM subscriptions s
            JOIN users u ON s.user_id = u.id
            ${whereClause}
            ORDER BY s.${sortBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM subscriptions s
            ${whereClause}
        `;

        try {
            const [subscriptions, countResult] = await Promise.all([
                db.all(query, [...params, limit, offset]),
                db.get(countQuery, params)
            ]);

            const decryptedSubscriptions = subscriptions.map(sub => 
                this.decryptSubscription(sub)
            );

            return {
                data: decryptedSubscriptions,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                }
            };
        } catch (error) {
            throw new AppError(
                'Erro ao listar assinaturas',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Verifica se usuário tem acesso premium
     * @param {number} userId - ID do usuário
     * @returns {Promise<boolean>} - Se tem acesso premium
     */
    static async hasActiveSubscription(userId) {
        const subscription = await this.findActiveByUserId(userId);
        return !!subscription && ['active', 'trialing'].includes(subscription.status);
    }

    /**
     * Cancela assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {Object} metadata - Metadados do cancelamento
     * @returns {Promise<Object>} - Assinatura cancelada
     */
    static async cancel(subscriptionId, metadata = {}) {
        return await this.updateStatus(subscriptionId, {
            status: 'cancelled',
            metadata: {
                ...metadata,
                cancelledAt: new Date().toISOString(),
                reason: metadata.reason || 'user_requested'
            }
        });
    }

    /**
     * Criptografa metadados sensíveis
     * @param {Object} metadata - Metadados para criptografar
     * @returns {string} - Metadados criptografados
     */
    static encryptMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return JSON.stringify({});
        }

        try {
            const algorithm = 'aes-256-gcm';
            const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(algorithm, key);
            
            let encrypted = cipher.update(JSON.stringify(metadata), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return JSON.stringify({
                data: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            });
        } catch (error) {
            console.error('Erro ao criptografar metadados:', error);
            return JSON.stringify({});
        }
    }

    /**
     * Descriptografa metadados
     * @param {string} encryptedMetadata - Metadados criptografados
     * @returns {Object} - Metadados descriptografados
     */
    static decryptMetadata(encryptedMetadata) {
        if (!encryptedMetadata) return {};

        try {
            const { data, iv, authTag } = JSON.parse(encryptedMetadata);
            if (!data) return {};

            const algorithm = 'aes-256-gcm';
            const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
            const decipher = crypto.createDecipher(algorithm, key);
            
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            
            let decrypted = decipher.update(data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Erro ao descriptografar metadados:', error);
            return {};
        }
    }

    /**
     * Descriptografa assinatura completa
     * @param {Object} subscription - Assinatura criptografada
     * @returns {Object} - Assinatura descriptografada
     */
    static decryptSubscription(subscription) {
        if (!subscription) return null;

        return {
            ...subscription,
            metadata: this.decryptMetadata(subscription.metadata)
        };
    }

    /**
     * Gera checksum para integridade
     * @param {Object} data - Dados para gerar checksum
     * @returns {string} - Checksum gerado
     */
    static generateChecksum(data) {
        const content = JSON.stringify({
            userId: data.userId,
            kiwifyTransactionId: data.kiwifyTransactionId,
            amount: data.amount,
            plan: data.plan
        });
        
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Verifica integridade da assinatura
     * @param {Object} subscription - Assinatura para verificar
     * @returns {boolean} - Se a integridade está válida
     */
    static verifyIntegrity(subscription) {
        const expectedChecksum = this.generateChecksum(subscription);
        return expectedChecksum === subscription.checksum;
    }

    /**
     * Registra evento de auditoria
     * @param {Object} eventData - Dados do evento
     */
    static async logAuditEvent(eventData) {
        const {
            subscriptionId,
            action,
            userId,
            details = {},
            ipAddress,
            userAgent
        } = eventData;

        const query = `
            INSERT INTO subscription_audit_logs (
                id, subscription_id, action, user_id, details,
                ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            await db.run(query, [
                crypto.randomUUID(),
                subscriptionId,
                action,
                userId,
                JSON.stringify(details),
                ipAddress,
                userAgent,
                new Date().toISOString()
            ]);
        } catch (error) {
            console.error('Erro ao registrar evento de auditoria:', error);
            // Não falha a operação principal por erro de auditoria
        }
    }

    /**
     * Busca logs de auditoria de uma assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {Object} options - Opções de busca
     * @returns {Promise<Array>} - Logs de auditoria
     */
    static async getAuditLogs(subscriptionId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        const query = `
            SELECT * FROM subscription_audit_logs
            WHERE subscription_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        try {
            return await db.all(query, [subscriptionId, limit, offset]);
        } catch (error) {
            throw new AppError(
                'Erro ao buscar logs de auditoria',
                ERROR_TYPES.DATABASE_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }
}

module.exports = SubscriptionModel;