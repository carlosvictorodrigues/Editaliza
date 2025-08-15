// cacktoService.js - Cliente API robusto para integração com CACKTO
const axios = require('axios');
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../../subscription/models/audit');
const cacktoConfig = require('../config/cackto.config');

class CacktoService {
    constructor() {
        this.config = cacktoConfig;
        this.apiKey = this.config.auth.apiKey;
        this.secretKey = this.config.auth.secretKey;
        this.baseURL = this.config.api.baseURL;
        this.timeout = this.config.api.timeout;
        
        if (!this.apiKey || !this.secretKey) {
            throw new Error('Credenciais CACKTO não configuradas');
        }
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Editaliza/1.0',
                'X-API-Key': this.apiKey
            }
        });
        
        // Interceptadores para logging e retry
        this.setupInterceptors();
        
        // Circuit breaker
        this.circuitBreaker = {
            failures: 0,
            maxFailures: this.config.circuitBreaker.maxFailures,
            resetTimeout: this.config.circuitBreaker.resetTimeout,
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            lastFailureTime: null
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
                
                // Adicionar assinatura para requisições sensíveis
                if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
                    config.headers['X-Cackto-Signature'] = this.generateRequestSignature(config);
                }
                
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
     * Gera assinatura para requisições
     * @param {Object} config - Configuração da requisição
     * @returns {string} - Assinatura da requisição
     */
    generateRequestSignature(config) {
        const timestamp = Math.floor(Date.now() / 1000);
        const method = config.method.toUpperCase();
        const url = config.url;
        const body = config.data ? JSON.stringify(config.data) : '';
        
        const signaturePayload = `${timestamp}.${method}.${url}.${body}`;
        
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(signaturePayload, 'utf8')
            .digest('hex');
        
        config.headers['X-Cackto-Timestamp'] = timestamp.toString();
        
        return `sha256=${signature}`;
    }

    /**
     * Busca detalhes de uma transação
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object>} - Dados da transação
     */
    async getTransaction(transactionId) {
        this.checkCircuitBreaker();
        
        try {
            const response = await this.client.get(`/v1/transactions/${transactionId}`);
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
                entityId: transactionId,
                action: 'GET_TRANSACTION',
                userId: null,
                details: {
                    transactionId,
                    status: response.data.status,
                    amount: response.data.amount
                },
                severity: 'INFO'
            });
            
            return response.data;
        } catch (error) {
            throw new AppError(
                'Erro ao buscar transação na CACKTO',
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
            const response = await this.client.get(`/v1/orders/${orderId}`);
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
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
                'Erro ao buscar pedido na CACKTO',
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
            const response = await this.client.get(`/v1/subscriptions/${subscriptionId}`);
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
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
                'Erro ao buscar assinatura na CACKTO',
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
            const response = await this.client.get(`/v1/transactions?${params}`);
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
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
                'Erro ao listar transações na CACKTO',
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
            const response = await this.client.post(`/v1/subscriptions/${subscriptionId}/cancel`, {
                reason,
                cancel_at_period_end: false // Cancelar imediatamente
            });
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
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
                'Erro ao cancelar assinatura na CACKTO',
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
            const response = await this.client.post(`/v1/transactions/${transactionId}/refund`, {
                amount,
                reason,
                refund_type: 'partial' // ou 'full'
            });
            
            await AuditModel.logEvent({
                entityType: 'CACKTO_API',
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
                'Erro ao processar reembolso na CACKTO',
                ERROR_TYPES.EXTERNAL_API_ERROR,
                { transactionId, amount, reason, originalError: error.message }
            );
        }
    }

    /**
     * Sincroniza dados de assinatura com CACKTO
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object>} - Dados sincronizados
     */
    async syncSubscription(subscriptionId) {
        try {
            const cacktoData = await this.getSubscription(subscriptionId);
            const SubscriptionModel = require('../../subscription/models/subscription');
            
            // Buscar assinatura local
            const localSubscription = await SubscriptionModel.findByCacktoTransactionId(subscriptionId);
            
            if (!localSubscription) {
                throw new AppError(
                    'Assinatura não encontrada localmente',
                    ERROR_TYPES.NOT_FOUND,
                    { subscriptionId }
                );
            }
            
            // Verificar se há diferenças
            const needsUpdate = this.compareSubscriptionData(localSubscription, cacktoData);
            
            if (needsUpdate.length > 0) {
                // Atualizar dados locais
                const updateData = this.mapCacktoToLocal(cacktoData);
                
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
                    action: 'SYNCED_WITH_CACKTO',
                    userId: null,
                    details: {
                        subscriptionId,
                        changes: needsUpdate,
                        cacktoStatus: cacktoData.status,
                        localStatus: localSubscription.status
                    },
                    severity: 'INFO'
                });
            }
            
            return {
                synchronized: true,
                changes: needsUpdate,
                data: cacktoData
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
     * Verifica status de conectividade com CACKTO
     * @returns {Promise<Object>} - Status da conectividade
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            
            // Fazer uma requisição simples para testar conectividade
            const response = await this.client.get('/v1/health', {
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
     * Compara dados de assinatura local vs CACKTO
     * @param {Object} local - Dados locais
     * @param {Object} cackto - Dados da CACKTO
     * @returns {Array} - Lista de diferenças
     */
    compareSubscriptionData(local, cackto) {
        const differences = [];
        
        // Mapear status da CACKTO para status local
        const statusMapping = {
            'active': 'active',
            'cancelled': 'cancelled',
            'suspended': 'suspended',
            'expired': 'expired',
            'trial': 'trial'
        };
        
        const mappedStatus = statusMapping[cackto.status] || cackto.status;
        
        if (local.status !== mappedStatus) {
            differences.push({
                field: 'status',
                local: local.status,
                cackto: mappedStatus
            });
        }
        
        if (cackto.expires_at && local.expires_at !== cackto.expires_at) {
            differences.push({
                field: 'expires_at',
                local: local.expires_at,
                cackto: cackto.expires_at
            });
        }
        
        return differences;
    }

    /**
     * Mapeia dados da CACKTO para formato local
     * @param {Object} cacktoData - Dados da CACKTO
     * @returns {Object} - Dados no formato local
     */
    mapCacktoToLocal(cacktoData) {
        const statusMapping = {
            'active': 'active',
            'cancelled': 'cancelled',
            'suspended': 'suspended',
            'expired': 'expired',
            'trial': 'trial'
        };
        
        return {
            status: statusMapping[cacktoData.status] || cacktoData.status,
            expires_at: cacktoData.expires_at,
            next_billing_at: cacktoData.next_billing_at
        };
    }

    /**
     * Registra chamada de API
     */
    async logAPICall(config, response, duration) {
        try {
            await AuditModel.logEvent({
                entityType: 'CACKTO_API_CALL',
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
     */
    async logAPIError(config, error, duration) {
        try {
            await AuditModel.logEvent({
                entityType: 'CACKTO_API_CALL',
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
     */
    transformError(error) {
        if (error.response) {
            return new AppError(
                `Erro na API CACKTO: ${error.response.data?.message || error.message}`,
                ERROR_TYPES.EXTERNAL_API_ERROR,
                {
                    status: error.response.status,
                    data: error.response.data
                }
            );
        } else if (error.request) {
            return new AppError(
                'Erro de conectividade com CACKTO',
                ERROR_TYPES.NETWORK_ERROR,
                { originalError: error.message }
            );
        } else {
            return new AppError(
                'Erro interno na integração com CACKTO',
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
                    'Integração com CACKTO temporariamente indisponível',
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
const cacktoService = new CacktoService();

module.exports = cacktoService;