// queue.js - Sistema de fila para processamento de webhooks com retry
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../models/audit');

class WebhookQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.retryConfig = {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffFactor: 2
        };
        
        // Iniciar processamento da fila
        this.startQueueProcessor();
    }

    /**
     * Adiciona webhook à fila para processamento
     * @param {Object} webhookData - Dados do webhook
     * @returns {Promise<string>} - ID da tarefa na fila
     */
    async enqueue(webhookData) {
        const taskId = crypto.randomUUID();
        const task = {
            id: taskId,
            webhook: webhookData.webhook,
            attempt: webhookData.attempt || 1,
            processingId: webhookData.processingId,
            originalRequest: webhookData.originalRequest,
            enqueuedAt: Date.now(),
            scheduledFor: Date.now() + this.calculateDelay(webhookData.attempt || 1),
            lastError: null
        };
        
        this.queue.push(task);
        
        // Ordenar fila por scheduledFor
        this.queue.sort((a, b) => a.scheduledFor - b.scheduledFor);
        
        await AuditModel.logEvent({
            entityType: 'WEBHOOK_QUEUE',
            entityId: taskId,
            action: 'ENQUEUED',
            userId: null,
            details: {
                webhookId: webhookData.webhook.payload.id,
                eventType: webhookData.webhook.payload.event_type,
                attempt: task.attempt,
                scheduledFor: new Date(task.scheduledFor).toISOString(),
                queueSize: this.queue.length
            },
            severity: 'INFO'
        });
        
        return taskId;
    }

    /**
     * Inicia processamento contínuo da fila
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.processing || this.queue.length === 0) {
                return;
            }
            
            await this.processQueue();
        }, 5000); // Verificar a cada 5 segundos
    }

    /**
     * Processa itens da fila
     */
    async processQueue() {
        if (this.processing) return;
        
        this.processing = true;
        
        try {
            const now = Date.now();
            const readyTasks = this.queue.filter(task => task.scheduledFor <= now);
            
            for (const task of readyTasks) {
                try {
                    await this.processTask(task);
                    
                    // Remover tarefa da fila após sucesso
                    this.queue = this.queue.filter(t => t.id !== task.id);
                    
                } catch (error) {
                    await this.handleTaskFailure(task, error);
                }
            }
        } finally {
            this.processing = false;
        }
    }

    /**
     * Processa uma tarefa individual
     * @param {Object} task - Tarefa da fila
     */
    async processTask(task) {
        const WebhookProcessor = require('./processor');
        const processor = new WebhookProcessor();
        
        await AuditModel.logEvent({
            entityType: 'WEBHOOK_QUEUE',
            entityId: task.id,
            action: 'PROCESSING_RETRY',
            userId: null,
            details: {
                webhookId: task.webhook.payload.id,
                eventType: task.webhook.payload.event_type,
                attempt: task.attempt,
                processingId: task.processingId,
                waitTime: Date.now() - task.enqueuedAt
            },
            severity: 'INFO'
        });
        
        // Simular request para o processador
        const mockRequest = {
            ip: task.originalRequest.ip,
            headers: {
                'user-agent': task.originalRequest.userAgent
            }
        };
        
        const result = await processor.processWebhook(task.webhook, mockRequest);
        
        await AuditModel.logEvent({
            entityType: 'WEBHOOK_QUEUE',
            entityId: task.id,
            action: 'RETRY_SUCCESS',
            userId: null,
            details: {
                webhookId: task.webhook.payload.id,
                eventType: task.webhook.payload.event_type,
                attempt: task.attempt,
                processingId: task.processingId,
                result
            },
            severity: 'INFO'
        });
        
        return result;
    }

    /**
     * Trata falha no processamento de tarefa
     * @param {Object} task - Tarefa que falhou
     * @param {Error} error - Erro ocorrido
     */
    async handleTaskFailure(task, error) {
        task.lastError = error.message;
        task.attempt++;
        
        if (task.attempt <= this.retryConfig.maxRetries) {
            // Reagendar para nova tentativa
            task.scheduledFor = Date.now() + this.calculateDelay(task.attempt);
            
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_QUEUE',
                entityId: task.id,
                action: 'RETRY_SCHEDULED',
                userId: null,
                details: {
                    webhookId: task.webhook.payload.id,
                    eventType: task.webhook.payload.event_type,
                    attempt: task.attempt,
                    error: error.message,
                    nextRetryAt: new Date(task.scheduledFor).toISOString()
                },
                severity: 'WARN'
            });
            
        } else {
            // Máximo de tentativas atingido
            await this.moveToDeadLetterQueue(task, error);
            
            // Remover da fila principal
            this.queue = this.queue.filter(t => t.id !== task.id);
        }
    }

    /**
     * Move tarefa para fila de mensagens mortas
     * @param {Object} task - Tarefa falhada
     * @param {Error} error - Último erro
     */
    async moveToDeadLetterQueue(task, error) {
        const db = require('../utils/database');
        
        const query = `
            INSERT INTO webhook_dead_letter_queue (
                id, webhook_id, event_type, payload, attempts,
                last_error, failed_at, original_processing_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        try {
            await db.run(query, [
                crypto.randomUUID(),
                task.webhook.payload.id,
                task.webhook.payload.event_type,
                JSON.stringify(task.webhook.payload),
                task.attempt,
                error.message,
                new Date().toISOString(),
                task.processingId
            ]);
            
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_QUEUE',
                entityId: task.id,
                action: 'MOVED_TO_DLQ',
                userId: null,
                details: {
                    webhookId: task.webhook.payload.id,
                    eventType: task.webhook.payload.event_type,
                    totalAttempts: task.attempt,
                    finalError: error.message,
                    processingId: task.processingId
                },
                severity: 'ERROR'
            });
            
            // Notificar administradores sobre falha crítica
            await this.notifyAdmins(task, error);
            
        } catch (dbError) {
            console.error('Erro ao mover para dead letter queue:', dbError);
        }
    }

    /**
     * Calcula delay para próxima tentativa (exponential backoff)
     * @param {number} attempt - Número da tentativa
     * @returns {number} - Delay em milissegundos
     */
    calculateDelay(attempt) {
        const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    /**
     * Notifica administradores sobre falhas críticas
     * @param {Object} task - Tarefa falhada
     * @param {Error} error - Erro final
     */
    async notifyAdmins(task, error) {
        // Implementar notificação por email, Slack, etc.
        console.error('WEBHOOK FALHOU DEFINITIVAMENTE:', {
            webhookId: task.webhook.payload.id,
            eventType: task.webhook.payload.event_type,
            attempts: task.attempt,
            error: error.message,
            processingId: task.processingId
        });
        
        // TODO: Integrar com sistema de notificações
        // await NotificationService.sendCriticalAlert({
        //     type: 'webhook_failure',
        //     data: task,
        //     error: error.message
        // });
    }

    /**
     * Obtém estatísticas da fila
     * @returns {Object} - Estatísticas
     */
    getQueueStats() {
        const now = Date.now();
        const pending = this.queue.filter(task => task.scheduledFor > now).length;
        const ready = this.queue.filter(task => task.scheduledFor <= now).length;
        
        return {
            total: this.queue.length,
            pending,
            ready,
            processing: this.processing,
            oldestTask: this.queue.length > 0 ? 
                Math.min(...this.queue.map(t => t.enqueuedAt)) : null
        };
    }

    /**
     * Reprocessa itens da dead letter queue
     * @param {string} webhookId - ID do webhook para reprocessar
     * @returns {Promise<boolean>} - Se foi reprocessado com sucesso
     */
    async reprocessFromDLQ(webhookId) {
        const db = require('../utils/database');
        
        try {
            const dlqItem = await db.get(
                'SELECT * FROM webhook_dead_letter_queue WHERE webhook_id = ?',
                [webhookId]
            );
            
            if (!dlqItem) {
                throw new AppError(
                    'Item não encontrado na dead letter queue',
                    ERROR_TYPES.NOT_FOUND,
                    { webhookId }
                );
            }
            
            const payload = JSON.parse(dlqItem.payload);
            
            // Recriar webhook para reprocessamento
            const webhook = {
                payload,
                validationId: crypto.randomUUID(),
                validationTime: 0
            };
            
            // Adicionar à fila com tentativa resetada
            const taskId = await this.enqueue({
                webhook,
                attempt: 1,
                processingId: crypto.randomUUID(),
                originalRequest: {
                    ip: 'reprocess',
                    userAgent: 'DLQ-Reprocess'
                }
            });
            
            // Remover da dead letter queue
            await db.run(
                'DELETE FROM webhook_dead_letter_queue WHERE webhook_id = ?',
                [webhookId]
            );
            
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_QUEUE',
                entityId: taskId,
                action: 'REPROCESSED_FROM_DLQ',
                userId: null,
                details: {
                    webhookId,
                    originalProcessingId: dlqItem.original_processing_id,
                    newTaskId: taskId
                },
                severity: 'INFO'
            });
            
            return true;
            
        } catch (error) {
            throw new AppError(
                'Erro ao reprocessar item da DLQ',
                ERROR_TYPES.DATABASE_ERROR,
                { webhookId, originalError: error.message }
            );
        }
    }

    /**
     * Lista itens da dead letter queue
     * @param {Object} options - Opções de listagem
     * @returns {Promise<Array>} - Itens da DLQ
     */
    async listDLQ(options = {}) {
        const db = require('../utils/database');
        const { limit = 50, offset = 0, eventType } = options;
        
        let query = 'SELECT * FROM webhook_dead_letter_queue';
        const params = [];
        
        if (eventType) {
            query += ' WHERE event_type = ?';
            params.push(eventType);
        }
        
        query += ' ORDER BY failed_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        try {
            const items = await db.all(query, params);
            
            return items.map(item => ({
                ...item,
                payload: JSON.parse(item.payload)
            }));
        } catch (error) {
            throw new AppError(
                'Erro ao listar dead letter queue',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Limpa itens antigos da dead letter queue
     * @param {number} daysOld - Idade em dias
     * @returns {Promise<number>} - Número de itens removidos
     */
    async cleanupDLQ(daysOld = 30) {
        const db = require('../utils/database');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        try {
            const result = await db.run(
                'DELETE FROM webhook_dead_letter_queue WHERE failed_at < ?',
                [cutoffDate.toISOString()]
            );
            
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_QUEUE',
                entityId: crypto.randomUUID(),
                action: 'DLQ_CLEANUP',
                userId: null,
                details: {
                    itemsRemoved: result.changes,
                    cutoffDate: cutoffDate.toISOString(),
                    daysOld
                },
                severity: 'INFO'
            });
            
            return result.changes;
        } catch (error) {
            throw new AppError(
                'Erro ao limpar dead letter queue',
                ERROR_TYPES.DATABASE_ERROR,
                { originalError: error.message }
            );
        }
    }
}

// Singleton para garantir uma única instância da fila
const queueInstance = new WebhookQueue();

module.exports = queueInstance;