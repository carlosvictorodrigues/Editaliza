// cacheService.js - Serviço de cache para otimização da integração CACKTO
const db = require('../../../database');
const crypto = require('crypto');

class CacheService {
    constructor() {
        this.defaultTTL = parseInt(process.env.CACKTO_CACHE_TTL_SUBSCRIPTION || '300');
        this.transactionTTL = parseInt(process.env.CACKTO_CACHE_TTL_TRANSACTION || '600');
        this.productTTL = parseInt(process.env.CACKTO_CACHE_TTL_PRODUCT || '3600');
        this.memoryCache = new Map();
        this.cleanupInterval = null;
    }

    /**
     * Inicializa o serviço de cache
     */
    async initialize() {
        console.log('🔧 Inicializando serviço de cache CACKTO...');
        
        // Limpar cache expirado no startup
        await this.cleanupExpired();
        
        // Agendar limpeza periódica a cada 5 minutos
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpired().catch(console.error);
        }, 5 * 60 * 1000);
        
        console.log('✅ Serviço de cache CACKTO inicializado');
    }

    /**
     * Obtém valor do cache
     * @param {string} key - Chave do cache
     * @returns {Promise<any|null>} - Valor do cache ou null se não encontrado/expirado
     */
    async get(key) {
        try {
            // Verificar cache em memória primeiro
            if (this.memoryCache.has(key)) {
                const cached = this.memoryCache.get(key);
                if (new Date(cached.expiresAt) > new Date()) {
                    return cached.value;
                }
                this.memoryCache.delete(key);
            }

            // Verificar cache no banco
            const result = await db.get(
                `SELECT cache_value, expires_at 
                 FROM cackto_cache 
                 WHERE cache_key = ? AND expires_at > datetime('now')`,
                [key]
            );

            if (result) {
                const value = JSON.parse(result.cache_value);
                
                // Adicionar ao cache em memória
                this.memoryCache.set(key, {
                    value,
                    expiresAt: result.expires_at
                });
                
                return value;
            }

            return null;
        } catch (error) {
            console.error('Erro ao obter cache:', error);
            return null;
        }
    }

    /**
     * Define valor no cache
     * @param {string} key - Chave do cache
     * @param {any} value - Valor a ser armazenado
     * @param {number} ttl - TTL em segundos (opcional)
     * @returns {Promise<boolean>} - Se o cache foi armazenado com sucesso
     */
    async set(key, value, ttl = null) {
        try {
            const ttlSeconds = ttl || this.defaultTTL;
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
            const cacheValue = JSON.stringify(value);

            // Armazenar no banco
            await db.run(
                `INSERT OR REPLACE INTO cackto_cache (cache_key, cache_value, expires_at, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [key, cacheValue, expiresAt.toISOString()]
            );

            // Armazenar em memória
            this.memoryCache.set(key, {
                value,
                expiresAt: expiresAt.toISOString()
            });

            return true;
        } catch (error) {
            console.error('Erro ao definir cache:', error);
            return false;
        }
    }

    /**
     * Remove valor do cache
     * @param {string} key - Chave do cache
     * @returns {Promise<boolean>} - Se o cache foi removido com sucesso
     */
    async delete(key) {
        try {
            // Remover da memória
            this.memoryCache.delete(key);

            // Remover do banco
            await db.run(
                'DELETE FROM cackto_cache WHERE cache_key = ?',
                [key]
            );

            return true;
        } catch (error) {
            console.error('Erro ao deletar cache:', error);
            return false;
        }
    }

    /**
     * Limpa cache por padrão
     * @param {string} pattern - Padrão para limpeza (ex: 'subscription:*')
     * @returns {Promise<number>} - Número de itens removidos
     */
    async clearPattern(pattern) {
        try {
            const sqlPattern = pattern.replace('*', '%');
            
            // Limpar da memória
            let memoryDeleted = 0;
            for (const key of this.memoryCache.keys()) {
                if (this.matchPattern(key, pattern)) {
                    this.memoryCache.delete(key);
                    memoryDeleted++;
                }
            }

            // Limpar do banco
            const result = await db.run(
                'DELETE FROM cackto_cache WHERE cache_key LIKE ?',
                [sqlPattern]
            );

            return result.changes + memoryDeleted;
        } catch (error) {
            console.error('Erro ao limpar cache por padrão:', error);
            return 0;
        }
    }

    /**
     * Limpa todo o cache
     * @returns {Promise<boolean>} - Se o cache foi limpo com sucesso
     */
    async clearAll() {
        try {
            // Limpar memória
            this.memoryCache.clear();

            // Limpar banco
            await db.run('DELETE FROM cackto_cache');

            return true;
        } catch (error) {
            console.error('Erro ao limpar todo o cache:', error);
            return false;
        }
    }

    /**
     * Limpa cache expirado
     * @returns {Promise<number>} - Número de itens removidos
     */
    async cleanupExpired() {
        try {
            // Limpar da memória
            let memoryDeleted = 0;
            const now = new Date();
            for (const [key, value] of this.memoryCache.entries()) {
                if (new Date(value.expiresAt) <= now) {
                    this.memoryCache.delete(key);
                    memoryDeleted++;
                }
            }

            // Limpar do banco
            const result = await db.run(
                'DELETE FROM cackto_cache WHERE expires_at <= datetime("now")'
            );

            const total = result.changes + memoryDeleted;
            if (total > 0) {
                console.log(`🧹 Cache: ${total} itens expirados removidos`);
            }

            return total;
        } catch (error) {
            console.error('Erro ao limpar cache expirado:', error);
            return 0;
        }
    }

    /**
     * Cache de assinatura
     * @param {string} subscriptionId - ID da assinatura
     * @param {Object} data - Dados da assinatura
     * @returns {Promise<boolean>} - Se foi armazenado com sucesso
     */
    async cacheSubscription(subscriptionId, data) {
        const key = `subscription:${subscriptionId}`;
        return await this.set(key, data, this.defaultTTL);
    }

    /**
     * Obtém assinatura do cache
     * @param {string} subscriptionId - ID da assinatura
     * @returns {Promise<Object|null>} - Dados da assinatura ou null
     */
    async getSubscription(subscriptionId) {
        const key = `subscription:${subscriptionId}`;
        return await this.get(key);
    }

    /**
     * Cache de transação
     * @param {string} transactionId - ID da transação
     * @param {Object} data - Dados da transação
     * @returns {Promise<boolean>} - Se foi armazenado com sucesso
     */
    async cacheTransaction(transactionId, data) {
        const key = `transaction:${transactionId}`;
        return await this.set(key, data, this.transactionTTL);
    }

    /**
     * Obtém transação do cache
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object|null>} - Dados da transação ou null
     */
    async getTransaction(transactionId) {
        const key = `transaction:${transactionId}`;
        return await this.get(key);
    }

    /**
     * Cache de produto
     * @param {string} productId - ID do produto
     * @param {Object} data - Dados do produto
     * @returns {Promise<boolean>} - Se foi armazenado com sucesso
     */
    async cacheProduct(productId, data) {
        const key = `product:${productId}`;
        return await this.set(key, data, this.productTTL);
    }

    /**
     * Obtém produto do cache
     * @param {string} productId - ID do produto
     * @returns {Promise<Object|null>} - Dados do produto ou null
     */
    async getProduct(productId) {
        const key = `product:${productId}`;
        return await this.get(key);
    }

    /**
     * Cache de webhook processado (para evitar duplicação)
     * @param {string} webhookId - ID do webhook
     * @param {Object} result - Resultado do processamento
     * @returns {Promise<boolean>} - Se foi armazenado com sucesso
     */
    async cacheWebhookResult(webhookId, result) {
        const key = `webhook:${webhookId}`;
        // Manter por 24 horas para evitar reprocessamento
        return await this.set(key, result, 86400);
    }

    /**
     * Verifica se webhook já foi processado
     * @param {string} webhookId - ID do webhook
     * @returns {Promise<boolean>} - Se já foi processado
     */
    async isWebhookProcessed(webhookId) {
        const key = `webhook:${webhookId}`;
        const result = await this.get(key);
        return result !== null;
    }

    /**
     * Gera chave de cache única
     * @param {string} prefix - Prefixo da chave
     * @param {Object} params - Parâmetros para gerar a chave
     * @returns {string} - Chave de cache
     */
    generateKey(prefix, params) {
        const hash = crypto
            .createHash('md5')
            .update(JSON.stringify(params))
            .digest('hex');
        return `${prefix}:${hash}`;
    }

    /**
     * Verifica se uma chave corresponde a um padrão
     * @param {string} key - Chave a verificar
     * @param {string} pattern - Padrão (com * como wildcard)
     * @returns {boolean} - Se corresponde ao padrão
     */
    matchPattern(key, pattern) {
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        return regex.test(key);
    }

    /**
     * Obtém estatísticas do cache
     * @returns {Promise<Object>} - Estatísticas do cache
     */
    async getStats() {
        try {
            const dbStats = await db.get(`
                SELECT 
                    COUNT(*) as total_entries,
                    COUNT(CASE WHEN expires_at > datetime('now') THEN 1 END) as active_entries,
                    COUNT(CASE WHEN expires_at <= datetime('now') THEN 1 END) as expired_entries
                FROM cackto_cache
            `);

            return {
                memory: {
                    entries: this.memoryCache.size,
                    estimatedSize: this._estimateMemorySize()
                },
                database: dbStats,
                ttl: {
                    default: this.defaultTTL,
                    transaction: this.transactionTTL,
                    product: this.productTTL
                }
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas do cache:', error);
            return null;
        }
    }

    /**
     * Estima o tamanho do cache em memória
     * @returns {string} - Tamanho estimado
     */
    _estimateMemorySize() {
        let totalSize = 0;
        for (const [key, value] of this.memoryCache.entries()) {
            totalSize += key.length + JSON.stringify(value).length;
        }
        
        if (totalSize < 1024) {
            return `${totalSize} bytes`;
        } else if (totalSize < 1024 * 1024) {
            return `${(totalSize / 1024).toFixed(2)} KB`;
        } else {
            return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
        }
    }

    /**
     * Destrutor - limpa intervalos
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.memoryCache.clear();
    }
}

// Singleton
const cacheService = new CacheService();

module.exports = cacheService;