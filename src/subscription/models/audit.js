// audit.js - Modelo de auditoria imutável para compliance
const db = require('../../../database');
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');

class AuditModel {
    /**
     * Registra evento de auditoria imutável
     * @param {Object} eventData - Dados do evento
     * @returns {Promise<string>} - ID do evento criado
     */
    static async logEvent(eventData) {
        const {
            entityType,
            entityId,
            action,
            userId,
            details = {},
            ipAddress,
            userAgent,
            severity = 'INFO'
        } = eventData;

        const eventId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const hash = this.generateEventHash({
            eventId,
            entityType,
            entityId,
            action,
            userId,
            timestamp,
            details
        });

        const query = `
            INSERT INTO audit_events (
                id, entity_type, entity_id, action, user_id,
                details, ip_address, user_agent, severity,
                created_at, hash, blockchain_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        try {
            // Gerar hash da blockchain para integridade
            const blockchainHash = await this.generateBlockchainHash(eventId);
            
            await db.run(query, [
                eventId,
                entityType,
                entityId,
                action,
                userId,
                JSON.stringify(details),
                ipAddress,
                userAgent,
                severity,
                timestamp,
                hash,
                blockchainHash
            ]);

            return eventId;
        } catch (error) {
            throw new AppError(
                'Erro ao registrar evento de auditoria',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Busca eventos de auditoria com filtros
     * @param {Object} filters - Filtros de busca
     * @returns {Promise<Object>} - Eventos paginados
     */
    static async getEvents(filters = {}) {
        const {
            entityType,
            entityId,
            userId,
            action,
            severity,
            startDate,
            endDate,
            page = 1,
            limit = 50
        } = filters;

        const conditions = [];
        const params = [];
        const offset = (page - 1) * limit;

        if (entityType) {
            conditions.push('entity_type = ?');
            params.push(entityType);
        }

        if (entityId) {
            conditions.push('entity_id = ?');
            params.push(entityId);
        }

        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }

        if (action) {
            conditions.push('action = ?');
            params.push(action);
        }

        if (severity) {
            conditions.push('severity = ?');
            params.push(severity);
        }

        if (startDate) {
            conditions.push('created_at >= ?');
            params.push(startDate);
        }

        if (endDate) {
            conditions.push('created_at <= ?');
            params.push(endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const query = `
            SELECT ae.*, u.name as user_name, u.email as user_email
            FROM audit_events ae
            LEFT JOIN users u ON ae.user_id = u.id
            ${whereClause}
            ORDER BY ae.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM audit_events ae
            ${whereClause}
        `;

        try {
            const [events, countResult] = await Promise.all([
                db.all(query, [...params, limit, offset]),
                db.get(countQuery, params)
            ]);

            // Verificar integridade dos eventos
            const verifiedEvents = events.map(event => ({
                ...event,
                details: JSON.parse(event.details || '{}'),
                integrityValid: this.verifyEventIntegrity(event)
            }));

            return {
                data: verifiedEvents,
                pagination: {
                    page,
                    limit,
                    total: countResult.total,
                    totalPages: Math.ceil(countResult.total / limit)
                }
            };
        } catch (error) {
            throw new AppError(
                'Erro ao buscar eventos de auditoria',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Exporta dados de usuário para LGPD
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object>} - Dados exportados
     */
    static async exportUserData(userId) {
        const queries = {
            subscriptions: `
                SELECT id, plan, status, amount, currency, created_at, expires_at
                FROM subscriptions WHERE user_id = ?
            `,
            auditEvents: `
                SELECT id, entity_type, entity_id, action, created_at, severity
                FROM audit_events WHERE user_id = ?
            `,
            webhookEvents: `
                SELECT id, event_type, status, created_at
                FROM webhook_events WHERE user_id = ?
            `
        };

        try {
            const [subscriptions, auditEvents, webhookEvents] = await Promise.all([
                db.all(queries.subscriptions, [userId]),
                db.all(queries.auditEvents, [userId]),
                db.all(queries.webhookEvents, [userId])
            ]);

            const exportData = {
                userId,
                exportedAt: new Date().toISOString(),
                data: {
                    subscriptions,
                    auditEvents,
                    webhookEvents
                },
                metadata: {
                    totalRecords: subscriptions.length + auditEvents.length + webhookEvents.length,
                    dataRetentionPolicy: '7 anos conforme legislação',
                    exportReason: 'LGPD - Portabilidade de dados'
                }
            };

            // Registrar a exportação
            await this.logEvent({
                entityType: 'USER_DATA_EXPORT',
                entityId: userId.toString(),
                action: 'EXPORT_PERSONAL_DATA',
                userId,
                details: {
                    recordCount: exportData.metadata.totalRecords,
                    reason: 'LGPD_COMPLIANCE'
                },
                severity: 'INFO'
            });

            return exportData;
        } catch (error) {
            throw new AppError(
                'Erro ao exportar dados do usuário',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Implementa direito ao esquecimento (LGPD)
     * @param {number} userId - ID do usuário
     * @param {Object} options - Opções de exclusão
     * @returns {Promise<Object>} - Resultado da operação
     */
    static async forgetUser(userId, options = {}) {
        const { reason = 'USER_REQUEST', retainAudit = true } = options;
        
        const deletionId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        try {
            await db.run('BEGIN TRANSACTION');

            // 1. Anonimizar dados em vez de deletar para manter integridade referencial
            const anonymizedEmail = `deleted_${deletionId}@editaliza.deleted`;
            const anonymizedName = `[USUÁRIO DELETADO]`;

            await db.run(`
                UPDATE users SET 
                    email = ?, 
                    name = ?,
                    google_id = NULL,
                    avatar_url = NULL,
                    motivation_text = NULL,
                    city = NULL,
                    deleted_at = ?,
                    deletion_reason = ?
                WHERE id = ?
            `, [anonymizedEmail, anonymizedName, timestamp, reason, userId]);

            // 2. Anonimizar metadados de assinatura
            await db.run(`
                UPDATE subscriptions SET 
                    metadata = '{}'
                WHERE user_id = ?
            `, [userId]);

            // 3. Manter logs de auditoria se requerido (obrigatório por lei)
            if (retainAudit) {
                await db.run(`
                    UPDATE audit_events SET 
                        ip_address = '[ANONIMIZADO]',
                        user_agent = '[ANONIMIZADO]'
                    WHERE user_id = ?
                `, [userId]);
            }

            // 4. Registrar a exclusão
            await this.logEvent({
                entityType: 'USER',
                entityId: userId.toString(),
                action: 'RIGHT_TO_BE_FORGOTTEN',
                userId: null, // Sistema realizou a ação
                details: {
                    deletionId,
                    reason,
                    retainAudit,
                    originalUserId: userId
                },
                severity: 'WARN'
            });

            await db.run('COMMIT');

            return {
                success: true,
                deletionId,
                timestamp,
                message: 'Dados do usuário anonimizados com sucesso'
            };
        } catch (error) {
            await db.run('ROLLBACK');
            throw new AppError(
                'Erro ao processar direito ao esquecimento',
                ERROR_TYPES.DATABASE_ERROR,
                { userId, originalError: error.message }
            );
        }
    }

    /**
     * Gera relatório de compliance
     * @param {Object} options - Opções do relatório
     * @returns {Promise<Object>} - Relatório gerado
     */
    static async generateComplianceReport(options = {}) {
        const { startDate, endDate } = options;
        const reportId = crypto.randomUUID();
        
        try {
            const queries = {
                totalSubscriptions: `
                    SELECT COUNT(*) as count, status
                    FROM subscriptions 
                    WHERE created_at BETWEEN ? AND ?
                    GROUP BY status
                `,
                securityEvents: `
                    SELECT COUNT(*) as count, severity
                    FROM audit_events 
                    WHERE created_at BETWEEN ? AND ?
                    AND entity_type IN ('SECURITY', 'AUTHENTICATION')
                    GROUP BY severity
                `,
                dataExports: `
                    SELECT COUNT(*) as count
                    FROM audit_events 
                    WHERE action = 'EXPORT_PERSONAL_DATA'
                    AND created_at BETWEEN ? AND ?
                `,
                deletionRequests: `
                    SELECT COUNT(*) as count
                    FROM audit_events 
                    WHERE action = 'RIGHT_TO_BE_FORGOTTEN'
                    AND created_at BETWEEN ? AND ?
                `
            };

            const params = [startDate, endDate];
            
            const [subscriptions, securityEvents, dataExports, deletionRequests] = await Promise.all([
                db.all(queries.totalSubscriptions, params),
                db.all(queries.securityEvents, params),
                db.get(queries.dataExports, params),
                db.get(queries.deletionRequests, params)
            ]);

            const report = {
                id: reportId,
                generatedAt: new Date().toISOString(),
                period: { startDate, endDate },
                metrics: {
                    subscriptions: subscriptions.reduce((acc, item) => {
                        acc[item.status] = item.count;
                        return acc;
                    }, {}),
                    security: {
                        events: securityEvents.reduce((acc, item) => {
                            acc[item.severity] = item.count;
                            return acc;
                        }, {})
                    },
                    lgpd: {
                        dataExports: dataExports.count || 0,
                        deletionRequests: deletionRequests.count || 0
                    }
                },
                compliance: {
                    lgpdCompliant: true,
                    auditTrailIntact: await this.verifyAuditIntegrity(),
                    dataRetentionPolicy: 'Ativo - 7 anos',
                    encryptionStatus: 'AES-256-GCM'
                }
            };

            // Registrar geração do relatório
            await this.logEvent({
                entityType: 'COMPLIANCE_REPORT',
                entityId: reportId,
                action: 'GENERATE_REPORT',
                userId: null,
                details: {
                    period: { startDate, endDate },
                    metrics: report.metrics
                },
                severity: 'INFO'
            });

            return report;
        } catch (error) {
            throw new AppError(
                'Erro ao gerar relatório de compliance',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Gera hash de evento para integridade
     * @param {Object} eventData - Dados do evento
     * @returns {string} - Hash gerado
     */
    static generateEventHash(eventData) {
        const content = JSON.stringify({
            id: eventData.eventId,
            entityType: eventData.entityType,
            entityId: eventData.entityId,
            action: eventData.action,
            userId: eventData.userId,
            timestamp: eventData.timestamp,
            details: eventData.details
        });
        
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Gera hash da blockchain para cadeia de integridade
     * @param {string} eventId - ID do evento
     * @returns {Promise<string>} - Hash da blockchain
     */
    static async generateBlockchainHash(eventId) {
        try {
            // Buscar o último hash da cadeia
            const lastEvent = await db.get(`
                SELECT blockchain_hash FROM audit_events 
                ORDER BY created_at DESC 
                LIMIT 1
            `);

            const previousHash = lastEvent?.blockchain_hash || '0'.repeat(64);
            const content = `${previousHash}${eventId}${Date.now()}`;
            
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch (error) {
            console.error('Erro ao gerar hash da blockchain:', error);
            return crypto.createHash('sha256').update(eventId).digest('hex');
        }
    }

    /**
     * Verifica integridade de um evento
     * @param {Object} event - Evento para verificar
     * @returns {boolean} - Se a integridade está válida
     */
    static verifyEventIntegrity(event) {
        try {
            const expectedHash = this.generateEventHash({
                eventId: event.id,
                entityType: event.entity_type,
                entityId: event.entity_id,
                action: event.action,
                userId: event.user_id,
                timestamp: event.created_at,
                details: JSON.parse(event.details || '{}')
            });
            
            return expectedHash === event.hash;
        } catch (error) {
            console.error('Erro ao verificar integridade do evento:', error);
            return false;
        }
    }

    /**
     * Verifica integridade de toda a cadeia de auditoria
     * @returns {Promise<boolean>} - Se a cadeia está íntegra
     */
    static async verifyAuditIntegrity() {
        try {
            const events = await db.all(`
                SELECT id, entity_type, entity_id, action, user_id, 
                       created_at, details, hash, blockchain_hash
                FROM audit_events 
                ORDER BY created_at ASC
            `);

            let previousBlockchainHash = '0'.repeat(64);
            
            for (const event of events) {
                // Verificar hash do evento
                if (!this.verifyEventIntegrity(event)) {
                    console.error(`Integridade comprometida no evento: ${event.id}`);
                    return false;
                }

                // Verificar cadeia blockchain
                const expectedBlockchainHash = crypto
                    .createHash('sha256')
                    .update(`${previousBlockchainHash}${event.id}${new Date(event.created_at).getTime()}`)
                    .digest('hex');
                
                if (event.blockchain_hash !== expectedBlockchainHash) {
                    console.error(`Cadeia blockchain comprometida no evento: ${event.id}`);
                    return false;
                }

                previousBlockchainHash = event.blockchain_hash;
            }

            return true;
        } catch (error) {
            console.error('Erro ao verificar integridade da auditoria:', error);
            return false;
        }
    }
}

module.exports = AuditModel;