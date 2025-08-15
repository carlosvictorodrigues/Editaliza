// kiwify.js - Cliente API robusto para integração com Kiwify
const axios = require('axios');
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../models/audit');

class KiwifyService {
    constructor() {
        this.apiKey = process.env.KIWIFY_API_KEY;
        this.baseURL = process.env.KIWIFY_API_URL || 'https://api.kiwify.com.br';
        this.timeout = 30000; // 30 segundos
        
        if (!this.apiKey) {
            throw new Error('KIWIFY_API_KEY não configurado');
        }
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Editaliza/1.0'
            }
        });
        
        // Interceptadores para logging e retry
        this.setupInterceptors();
        
        // Circuit breaker
        this.circuitBreaker = {
            failures: 0,
            maxFailures: 5,
            resetTimeout: 60000,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };
    }

    /**
     * Configura interceptadores do axios
     */
    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                this.logAPICall(response.config, response, duration);
                this.resetCircuitBreaker();
                return response;
            },
            (error) => {
                const duration = error.config?.metadata ? 
                    Date.now() - error.config.metadata.startTime : 0;
                
                this.logAPIError(error.config, error, duration);
                this.recordFailure();
                
                return Promise.reject(this.transformError(error));
            }
        );
    }

    /**
     * Busca detalhes de uma transação
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object>} - Dados da transação
     */
    async getTransaction(transactionId) {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.get(`/transactions/${transactionId}`);
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: transactionId,
                action: 'GET_TRANSACTION',
                userId: null,
                details: {
                    transactionId,
                    status: response.data.status
                },
                severity: 'INFO'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao buscar transação no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { transactionId, originalError: error.message }
            );
        }
    }

    /**
     * Busca detalhes de um pedido
     * @param {string} orderId - ID do pedido
     * @returns {Promise<Object>} - Dados do pedido
     */
    async getOrder(orderId) {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.get(`/orders/${orderId}`);
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: orderId,
                action: 'GET_ORDER',
                userId: null,
                details: {
                    orderId,
                    status: response.data.status,
                    amount: response.data.amount
                },
                severity: 'INFO'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao buscar pedido no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { orderId, originalError: error.message }
            );
        }
    }

    /**
     * Busca detalhes de uma assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object>} - Dados da assinatura
     */
    async getSubscription(subscriptionId) {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.get(`/subscriptions/${subscriptionId}`);
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: subscriptionId,
                action: 'GET_SUBSCRIPTION',
                userId: null,
                details: {
                    subscriptionId,
                    status: response.data.status,
                    plan: response.data.plan
                },
                severity: 'INFO'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao buscar assinatura no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Lista transações com filtros
     * @param {Object} filters - Filtros de busca
     * @returns {Promise<Object>} - Lista de transações
     */
    async listTransactions(filters = {}) {
        this.checkCircuitBreaker();
        
        const {
            startDate,
            endDate,
            status,
            customerId,
            page = 1,
            limit = 50
        } = filters;
        
        const params = new URLSearchParams();
        
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (status) params.append('status', status);
        if (customerId) params.append('customer_id', customerId);
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        
        try {
            const response = await this.client.get(`/transactions?${params}`);
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: `list_${Date.now()}`,
                action: 'LIST_TRANSACTIONS',
                userId: null,
                details: {
                    filters,
                    resultCount: response.data.data?.length || 0
                },
                severity: 'INFO'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao listar transações no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { filters, originalError: error.message }
            );
        }
    }

    /**
     * Cancela uma assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {string} reason - Razão do cancelamento
     * @returns {Promise<Object>} - Resultado do cancelamento
     */
    async cancelSubscription(subscriptionId, reason = 'user_request') {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.post(`/subscriptions/${subscriptionId}/cancel`, {
                reason
            });
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: subscriptionId,
                action: 'CANCEL_SUBSCRIPTION',
                userId: null,
                details: {
                    subscriptionId,
                    reason,
                    success: response.data.success
                },
                severity: 'WARN'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao cancelar assinatura no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { subscriptionId, reason, originalError: error.message }
            );
        }
    }

    /**
     * Processa reembolso de uma transação
     * @param {string} transactionId - ID da transação
     * @param {number} amount - Valor do reembolso
     * @param {string} reason - Razão do reembolso
     * @returns {Promise<Object>} - Resultado do reembolso
     */
    async refundTransaction(transactionId, amount, reason = 'customer_request') {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.post(`/transactions/${transactionId}/refund`, {
                amount,
                reason
            });
            
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API',
                entityId: transactionId,
                action: 'REFUND_TRANSACTION',
                userId: null,
                details: {
                    transactionId,
                    amount,
                    reason,
                    refundId: response.data.refund_id
                },
                severity: 'WARN'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao processar reembolso no Kiwify',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { transactionId, amount, reason, originalError: error.message }
            );
        }
    }

    /**
     * Sincroniza dados de assinatura com Kiwify
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object>} - Dados sincronizados
     */
    async syncSubscription(subscriptionId) {
        try {
            const kiwifyData = await this.getSubscription(subscriptionId);
            const SubscriptionModel = require('../models/subscription');
            
            // Buscar assinatura local
            const localSubscription = await SubscriptionModel.findByKiwifyTransactionId(subscriptionId);
            
            if (!localSubscription) {
                throw new AppError(
                    'Assinatura não encontrada localmente',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId }
                );
            }
            
            // Verificar se há diferenças
            const needsUpdate = this.compareSubscriptionData(localSubscription, kiwifyData);
            
            if (needsUpdate.length > 0) {
                // Atualizar dados locais
                const updateData = this.mapKiwifyToLocal(kiwifyData);
                
                await SubscriptionModel.updateStatus(localSubscription.id, {
                    ...updateData,
                    userId: localSubscription.user_id,
                    metadata: {
                        syncedAt: new Date().toISOString(),
                        syncReason: 'manual_sync',
                        changes: needsUpdate
                    }
                });
                
                await AuditModel.logEvent({
                    entityType: 'SUBSCRIPTION_SYNC',
                    entityId: localSubscription.id,
                    action: 'SYNCED_WITH_KIWIFY',
                    userId: null,
                    details: {
                        subscriptionId,
                        changes: needsUpdate,
                        kiwifyStatus: kiwifyData.status,
                        localStatus: localSubscription.status
                    },
                    severity: 'INFO'
                });
            }
            
            return {
                synchronized: true,
                changes: needsUpdate,
                data: kiwifyData
            };
            
        } catch (error) {
            throw new AppError(
                'Erro ao sincronizar assinatura',
                ERROR_TYPES.SYNC_ERROR,
                { subscriptionId, originalError: error.message }
            );
        }
    }

    /**
     * Verifica status de conectividade com Kiwify
     * @returns {Promise<Object>} - Status da conectividade
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            
            // Fazer uma requisição simples para testar conectividade
            const response = await this.client.get('/health', {
                timeout: 10000 // 10 segundos para health check
            });
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: 'healthy',
                responseTime,
                circuitBreakerState: this.circuitBreaker.state,
                lastCheck: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                circuitBreakerState: this.circuitBreaker.state,
                lastCheck: new Date().toISOString()
            };
        }
    }

    /**
     * Compara dados de assinatura local vs Kiwify
     * @param {Object} local - Dados locais
     * @param {Object} kiwify - Dados do Kiwify
     * @returns {Array} - Lista de diferenças
     */
    compareSubscriptionData(local, kiwify) {
        const differences = [];
        
        // Mapear status do Kiwify para status local
        const statusMapping = {
            'active': 'active',
            'cancelled': 'cancelled',
            'suspended': 'suspended',
            'expired': 'expired'
        };
        
        const mappedStatus = statusMapping[kiwify.status] || kiwify.status;
        
        if (local.status !== mappedStatus) {
            differences.push({
                field: 'status',
                local: local.status,
                kiwify: mappedStatus
            });
        }
        
        if (kiwify.expires_at && local.expires_at !== kiwify.expires_at) {
            differences.push({
                field: 'expires_at',
                local: local.expires_at,
                kiwify: kiwify.expires_at
            });
        }
        
        return differences;
    }

    /**
     * Mapeia dados do Kiwify para formato local
     * @param {Object} kiwifyData - Dados do Kiwify
     * @returns {Object} - Dados no formato local
     */
    mapKiwifyToLocal(kiwifyData) {
        const statusMapping = {
            'active': 'active',
            'cancelled': 'cancelled',
            'suspended': 'suspended',
            'expired': 'expired'
        };
        
        return {
            status: statusMapping[kiwifyData.status] || kiwifyData.status,
            expires_at: kiwifyData.expires_at
        };
    }

    /**
     * Registra chamada de API
     * @param {Object} config - Configuração da requisição
     * @param {Object} response - Resposta da API
     * @param {number} duration - Duração da requisição
     */
    async logAPICall(config, response, duration) {
        try {
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API_CALL',
                entityId: crypto.randomUUID(),
                action: 'API_SUCCESS',
                userId: null,
                details: {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    status: response.status,
                    duration,
                    dataSize: JSON.stringify(response.data).length
                },
                severity: 'DEBUG'
            });
        } catch (error) {
            console.error('Erro ao registrar chamada de API:', error);
        }
    }

    /**
     * Registra erro de API
     * @param {Object} config - Configuração da requisição
     * @param {Error} error - Erro ocorrido
     * @param {number} duration - Duração da requisição
     */
    async logAPIError(config, error, duration) {
        try {
            await AuditModel.logEvent({
                entityType: 'KIWIFY_API_CALL',
                entityId: crypto.randomUUID(),
                action: 'API_ERROR',
                userId: null,
                details: {
                    method: config?.method?.toUpperCase(),
                    url: config?.url,
                    error: error.message,
                    status: error.response?.status,
                    duration
                },
                severity: 'ERROR'
            });
        } catch (logError) {
            console.error('Erro ao registrar erro de API:', logError);
        }
    }

    /**
     * Transforma erro do axios em AppError
     * @param {Error} error - Erro do axios
     * @returns {AppError} - Erro transformado
     */
    transformError(error) {
        if (error.response) {
            // Erro de resposta HTTP
            return new AppError(
                `Erro na API Kiwify: ${error.response.data?.message || error.message}`,
                ERROR_TYPES.EXTERNAL_API_ERROR,
                {
                    status: error.response.status,
                    data: error.response.data
                }
            );
        } else if (error.request) {
            // Erro de rede
            return new AppError(
                'Erro de conectividade com Kiwify',
                ERROR_TYPES.NETWORK_ERROR,
                { originalError: error.message }
            );
        } else {
            // Erro de configuração
            return new AppError(
                'Erro interno na integração com Kiwify',
                ERROR_TYPES.INTERNAL_ERROR,
                { originalError: error.message }
            );
        }
    }

    /**
     * Verifica estado do circuit breaker
     */
    checkCircuitBreaker() {
        if (this.circuitBreaker.state === 'OPEN') {
            const now = Date.now();
            if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
                this.circuitBreaker.state = 'HALF_OPEN';
                this.circuitBreaker.failures = 0;
            } else {
                throw new AppError(
                    'Integração com Kiwify temporariamente indisponível',
                    ERROR_TYPES.SERVICE_UNAVAILABLE,
                    { circuitBreakerState: this.circuitBreaker.state }
                );
            }
        }
    }

    /**
     * Registra falha no circuit breaker
     */
    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailureTime = Date.now();
        
        if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
            this.circuitBreaker.state = 'OPEN';
        }
    }

    /**
     * Reseta circuit breaker após sucesso
     */
    resetCircuitBreaker() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'CLOSED';
    }
}

// Singleton para reutilizar cliente
const kiwifyService = new KiwifyService();

module.exports = kiwifyService;