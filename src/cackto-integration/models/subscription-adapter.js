// subscription-adapter.js - Adaptador para modelo de assinatura compatível com CACKTO
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const { dbGet, dbAll, dbRun } = require('../../utils/database');

class CacktoSubscriptionAdapter {
    constructor() {
        // Constructor vazio - funções db agora são importadas diretamente
    }

    /**
     * Cria nova assinatura compatível com CACKTO
     * @param {Object} subscriptionData - Dados da assinatura
     * @returns {Promise<Object>} - Assinatura criada
     */
    async create(subscriptionData) {
        const {
            userId,
            cacktoTransactionId, // Novo campo
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
        const checksum = this.generateChecksum(subscriptionData);

        const query = `
            INSERT INTO subscriptions (
                id, user_id, cackto_transaction_id,
                plan, status, amount, currency, payment_method,
                created_at, updated_at, expires_at, metadata,
                version, checksum
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `;

        try {
            await dbRun(query, [
                subscriptionId, userId, cacktoTransactionId,
                plan, status, amount, currency, paymentMethod,
                now, now, expiresAt, encryptedMetadata, checksum
            ]);

            // Log de auditoria
            await this.logAuditEvent({
                subscriptionId,
                action: 'SUBSCRIPTION_CREATED',
                userId,
                details: {
                    plan,
                    amount,
                    currency,
                    cacktoTransactionId,
                    expiresAt
                }
            });

            return await this.findById(subscriptionId);

        } catch (error) {
            throw new AppError(
                'Erro ao criar assinatura',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message, subscriptionData }
            );
        }
    }

    /**
     * Cria ou atualiza assinatura (upsert)
     * @param {Object} subscriptionData - Dados da assinatura
     * @returns {Promise<Object>} - Assinatura criada/atualizada
     */
    async createOrUpdate(subscriptionData) {
        const { userId, cacktoTransactionId } = subscriptionData;

        // Verificar se já existe uma assinatura para este usuário e transação
        const existing = await this.findByCacktoTransactionId(cacktoTransactionId);

        if (existing) {
            // Atualizar assinatura existente
            return await this.updateStatus(existing.id, {
                ...subscriptionData,
                userId: existing.user_id // Manter userId original
            });
        } else {
            // Verificar se usuário tem assinatura ativa
            const activeSubscription = await this.findActiveByUserId(userId);

            if (activeSubscription) {
                // Cancelar assinatura anterior e criar nova
                await this.updateStatus(activeSubscription.id, {
                    status: 'replaced',
                    cancelledAt: new Date().toISOString(),
                    metadata: {
                        replacedBy: cacktoTransactionId,
                        replacedAt: new Date().toISOString()
                    }
                });
            }

            // Criar nova assinatura
            return await this.create(subscriptionData);
        }
    }

    /**
     * Busca assinatura por ID de transação CACKTO
     * @param {string} cacktoTransactionId - ID da transação CACKTO
     * @returns {Promise<Object|null>} - Assinatura encontrada
     */
    async findByCacktoTransactionId(cacktoTransactionId) {
        try {
            const query = `
                SELECT * FROM subscriptions 
                WHERE cackto_transaction_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const subscription = await dbGet(query, [cacktoTransactionId]);

            if (subscription) {
                return this.decryptSubscription(subscription);
            }

            return null;

        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura por transação CACKTO',
                ERROR_TYPES.DATABASE_ERROR,
                { cacktoTransactionId, originalError: error.message }
            );
        }
    }

    /**
     * Busca assinatura ativa por usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object|null>} - Assinatura ativa
     */
    async findActiveByUserId(userId) {
        try {
            const query = `
                SELECT * FROM subscriptions 
                WHERE user_id = ? AND status = 'active'
                AND (expires_at IS NULL OR expires_at > datetime('now'))
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const subscription = await dbGet(query, [userId]);

            if (subscription) {
                return this.decryptSubscription(subscription);
            }

            return null;

        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura ativa',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Busca assinatura por ID
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object|null>} - Assinatura encontrada
     */
    async findById(subscriptionId) {
        try {
            const query = 'SELECT * FROM subscriptions WHERE id = ?';
            const subscription = await dbGet(query, [subscriptionId]);

            if (subscription) {
                return this.decryptSubscription(subscription);
            }

            return null;

        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura por ID',
                ERROR_TYPES.DATABASE_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Busca todas as assinaturas de um usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Array>} - Lista de assinaturas
     */
    async findAllByUserId(userId) {
        try {
            const query = `
                SELECT * FROM subscriptions 
                WHERE user_id = ?
                ORDER BY created_at DESC
            `;

            const subscriptions = await dbAll(query, [userId]);

            return subscriptions.map(sub => this.decryptSubscription(sub));

        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinaturas do usuário',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Atualiza status da assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {Object} updateData - Dados para atualização
     * @returns {Promise<Object>} - Assinatura atualizada
     */
    async updateStatus(subscriptionId, updateData) {
        try {
            const current = await this.findById(subscriptionId);
            
            if (!current) {
                throw new AppError(
                    'Assinatura não encontrada',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId }
                );
            }

            const {
                status,
                expiresAt,
                cancelledAt,
                suspendedAt,
                reactivatedAt,
                renewedAt,
                metadata = {}
            } = updateData;

            // Merge metadata
            const currentMetadata = current.metadata || {};
            const mergedMetadata = { ...currentMetadata, ...metadata };
            const encryptedMetadata = this.encryptMetadata(mergedMetadata);

            const now = new Date().toISOString();
            const newVersion = current.version + 1;
            const checksum = this.generateChecksum({ ...current, ...updateData });

            // Construir query dinâmica baseada nos campos fornecidos
            const updates = [];
            const values = [];

            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }

            if (expiresAt !== undefined) {
                updates.push('expires_at = ?');
                values.push(expiresAt);
            }

            if (cancelledAt !== undefined) {
                updates.push('cancelled_at = ?');
                values.push(cancelledAt);
            }

            if (suspendedAt !== undefined) {
                updates.push('suspended_at = ?');
                values.push(suspendedAt);
            }

            if (reactivatedAt !== undefined) {
                updates.push('reactivated_at = ?');
                values.push(reactivatedAt);
            }

            if (renewedAt !== undefined) {
                updates.push('renewed_at = ?');
                values.push(renewedAt);
            }

            // Campos sempre atualizados
            updates.push('metadata = ?', 'updated_at = ?', 'version = ?', 'checksum = ?');
            values.push(encryptedMetadata, now, newVersion, checksum, subscriptionId);

            const query = `
                UPDATE subscriptions 
                SET ${updates.join(', ')}
                WHERE id = ?
            `;

            await this.db.run(query, values);

            // Log de auditoria
            await this.logAuditEvent({
                subscriptionId,
                action: 'SUBSCRIPTION_UPDATED',
                userId: current.user_id,
                details: {
                    oldStatus: current.status,
                    newStatus: status,
                    changes: updateData,
                    version: newVersion
                }
            });

            return await this.findById(subscriptionId);

        } catch (error) {
            if (error instanceof AppError) throw error;

            throw new AppError(
                'Erro ao atualizar assinatura',
                ERROR_TYPES.DATABASE_ERROR,
                { subscriptionId, updateData, originalError: error.message }
            );
        }
    }

    /**
     * Obtém métricas de assinaturas
     * @param {Object} filters - Filtros para as métricas
     * @returns {Promise<Object>} - Métricas agregadas
     */
    async getMetrics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                plan
            } = filters;

            let whereConditions = ['cackto_transaction_id IS NOT NULL'];
            let values = [];

            if (startDate) {
                whereConditions.push('created_at >= ?');
                values.push(startDate);
            }

            if (endDate) {
                whereConditions.push('created_at <= ?');
                values.push(endDate);
            }

            if (plan) {
                whereConditions.push('plan = ?');
                values.push(plan);
            }

            const whereClause = whereConditions.join(' AND ');

            // Métricas básicas
            const basicMetrics = await dbGet(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended,
                    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
                    SUM(amount) as revenue,
                    AVG(amount) as averageRevenue
                FROM subscriptions 
                WHERE ${whereClause}
            `, values);

            // Métricas por plano
            const planMetrics = await dbAll(`
                SELECT 
                    plan,
                    COUNT(*) as count,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    SUM(amount) as revenue
                FROM subscriptions 
                WHERE ${whereClause}
                GROUP BY plan
                ORDER BY revenue DESC
            `, values);

            return {
                ...basicMetrics,
                byPlan: planMetrics
            };

        } catch (error) {
            throw new AppError(
                'Erro ao obter métricas',
                ERROR_TYPES.DATABASE_ERROR,
                { filters, originalError: error.message }
            );
        }
    }

    /**
     * Criptografa metadata sensível
     * @param {Object} metadata - Metadata para criptografar
     * @returns {string} - Metadata criptografada
     */
    encryptMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            return null;
        }

        try {
            const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
            const cipher = crypto.createCipher('aes-256-cbc', key);
            
            let encrypted = cipher.update(JSON.stringify(metadata), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return encrypted;
        } catch (error) {
            console.error('Erro ao criptografar metadata:', error);
            return JSON.stringify(metadata); // Fallback para texto plano
        }
    }

    /**
     * Descriptografa metadata
     * @param {string} encryptedMetadata - Metadata criptografada
     * @returns {Object} - Metadata descriptografada
     */
    decryptMetadata(encryptedMetadata) {
        if (!encryptedMetadata) {
            return {};
        }

        try {
            const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
            const decipher = crypto.createDecipher('aes-256-cbc', key);
            
            let decrypted = decipher.update(encryptedMetadata, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            // Se falhar, tentar como JSON normal (para compatibilidade)
            try {
                return JSON.parse(encryptedMetadata);
            } catch (jsonError) {
                console.error('Erro ao descriptografar metadata:', error);
                return {};
            }
        }
    }

    /**
     * Descriptografa assinatura completa
     * @param {Object} subscription - Assinatura criptografada
     * @returns {Object} - Assinatura descriptografada
     */
    decryptSubscription(subscription) {
        if (!subscription) return null;

        return {
            ...subscription,
            metadata: this.decryptMetadata(subscription.metadata)
        };
    }

    /**
     * Gera checksum para integridade
     * @param {Object} data - Dados para checksum
     * @returns {string} - Checksum MD5
     */
    generateChecksum(data) {
        const dataString = JSON.stringify(data);
        return crypto.createHash('md5').update(dataString).digest('hex');
    }

    /**
     * Log de eventos de auditoria
     * @param {Object} eventData - Dados do evento
     */
    async logAuditEvent(eventData) {
        try {
            const AuditModel = require('../models/audit');
            
            await AuditModel.logEvent({
                entityType: 'SUBSCRIPTION',
                entityId: eventData.subscriptionId,
                action: eventData.action,
                userId: eventData.userId,
                details: eventData.details,
                severity: 'INFO'
            });
        } catch (error) {
            console.error('Erro ao registrar evento de auditoria:', error);
            // Não quebrar o fluxo principal por erro de auditoria
        }
    }

    /**
     * Limpa assinaturas expiradas antigas
     * @param {number} daysOld - Dias para considerar "antigo"
     * @returns {Promise<number>} - Número de registros limpos
     */
    async cleanupExpiredSubscriptions(daysOld = 365) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await dbRun(`
                DELETE FROM subscriptions 
                WHERE status IN ('expired', 'cancelled') 
                AND updated_at < ?
                AND cackto_transaction_id IS NOT NULL
            `, [cutoffDate.toISOString()]);

            console.log(`Limpeza: ${result.changes} assinaturas antigas removidas`);
            
            return result.changes;

        } catch (error) {
            throw new AppError(
                'Erro ao limpar assinaturas antigas',
                ERROR_TYPES.DATABASE_ERROR,
                { daysOld, originalError: error.message }
            );
        }
    }
}

// Singleton
const cacktoSubscriptionAdapter = new CacktoSubscriptionAdapter();

module.exports = cacktoSubscriptionAdapter;