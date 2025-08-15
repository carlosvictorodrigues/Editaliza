// cache.js - Sistema de cache inteligente para assinaturas
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');

class CacheService {
    constructor() {
        this.memoryCache = new Map();
        this.redisClient = null;
        this.defaultTTL = 300; // 5 minutos
        this.maxMemoryItems = 1000;
        
        // Configurar Redis se disponível
        this.initializeRedis();
        
        // Limpeza periódica do cache em memória
        this.setupMemoryCleanup();
    }

    /**
     * Inicializa conexão Redis se disponível
     */
    async initializeRedis() {
        if (process.env.REDIS_URL) {
            try {
                const redis = require('redis');
                this.redisClient = redis.createClient({
                    url: process.env.REDIS_URL,
                    retry_strategy: (options) => {
                        if (options.error && options.error.code === 'ECONNREFUSED') {
                            console.warn('Redis connection refused, using memory cache only');
                            return undefined;
                        }
                        return Math.min(options.attempt * 100, 3000);
                    }
                });
                
                await this.redisClient.connect();
                console.log('Cache Redis conectado com sucesso');
                
            } catch (error) {
                console.warn('Falha ao conectar Redis, usando cache em memória:', error.message);
                this.redisClient = null;
            }
        }
    }

    /**
     * Configura limpeza periódica do cache em memória
     */
    setupMemoryCleanup() {
        setInterval(() => {
            this.cleanupMemoryCache();
        }, 60000); // A cada minuto
    }

    /**
     * Armazena valor no cache
     * @param {string} key - Chave do cache
     * @param {*} value - Valor a ser armazenado
     * @param {number} ttl - TTL em segundos
     * @returns {Promise<boolean>} - Se foi armazenado com sucesso
     */
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const serializedValue = JSON.stringify({
                data: value,
                timestamp: Date.now(),
                ttl: ttl * 1000 // Converter para ms
            });
            
            // Tentar Redis primeiro
            if (this.redisClient) {
                try {
                    await this.redisClient.setEx(key, ttl, serializedValue);
                    return true;
                } catch (redisError) {
                    console.warn('Erro no Redis, usando cache em memória:', redisError.message);
                }
            }
            
            // Fallback para cache em memória
            this.setMemoryCache(key, serializedValue, ttl * 1000);
            return true;
            
        } catch (error) {
            console.error('Erro ao armazenar no cache:', error);
            return false;
        }
    }

    /**
     * Recupera valor do cache
     * @param {string} key - Chave do cache
     * @returns {Promise<*>} - Valor armazenado ou null
     */
    async get(key) {
        try {
            let cachedValue = null;
            
            // Tentar Redis primeiro
            if (this.redisClient) {
                try {
                    cachedValue = await this.redisClient.get(key);
                } catch (redisError) {
                    console.warn('Erro no Redis, tentando cache em memória:', redisError.message);
                }
            }
            
            // Fallback para cache em memória
            if (!cachedValue) {
                cachedValue = this.getMemoryCache(key);
            }
            
            if (!cachedValue) {
                return null;
            }
            
            const parsed = JSON.parse(cachedValue);
            
            // Verificar se expirou
            if (Date.now() > parsed.timestamp + parsed.ttl) {
                await this.delete(key);
                return null;
            }
            
            return parsed.data;
            
        } catch (error) {
            console.error('Erro ao recuperar do cache:', error);
            return null;
        }
    }

    /**
     * Remove chave do cache
     * @param {string} key - Chave a ser removida
     * @returns {Promise<boolean>} - Se foi removida com sucesso
     */
    async delete(key) {
        try {
            let deleted = false;
            
            // Redis
            if (this.redisClient) {
                try {
                    await this.redisClient.del(key);
                    deleted = true;
                } catch (redisError) {
                    console.warn('Erro ao deletar do Redis:', redisError.message);
                }
            }
            
            // Memória
            if (this.memoryCache.has(key)) {
                this.memoryCache.delete(key);
                deleted = true;
            }
            
            return deleted;
            
        } catch (error) {
            console.error('Erro ao deletar do cache:', error);
            return false;
        }
    }

    /**
     * Limpa cache por padrão
     * @param {string} pattern - Padrão de chaves
     * @returns {Promise<number>} - Número de chaves removidas
     */
    async deletePattern(pattern) {
        try {
            let deletedCount = 0;
            
            // Redis
            if (this.redisClient) {
                try {
                    const keys = await this.redisClient.keys(pattern);
                    if (keys.length > 0) {
                        await this.redisClient.del(keys);
                        deletedCount += keys.length;
                    }
                } catch (redisError) {
                    console.warn('Erro ao deletar padrão do Redis:', redisError.message);
                }
            }
            
            // Memória
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            for (const key of this.memoryCache.keys()) {
                if (regex.test(key)) {
                    this.memoryCache.delete(key);
                    deletedCount++;
                }
            }
            
            return deletedCount;
            
        } catch (error) {
            console.error('Erro ao deletar padrão do cache:', error);
            return 0;
        }
    }

    /**
     * Invalida cache de assinatura do usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<boolean>} - Se foi invalidado com sucesso
     */
    async invalidateUserSubscription(userId) {
        const patterns = [
            `subscription:active:${userId}`,
            `subscription:*:${userId}`,
            `user:${userId}:*`
        ];
        
        let totalDeleted = 0;
        
        for (const pattern of patterns) {
            totalDeleted += await this.deletePattern(pattern);
        }
        
        return totalDeleted > 0;
    }

    /**
     * Cache específico para dados de assinatura
     * @param {number} userId - ID do usuário
     * @param {Object} subscription - Dados da assinatura
     * @param {number} ttl - TTL em segundos
     * @returns {Promise<boolean>} - Se foi armazenado
     */
    async cacheUserSubscription(userId, subscription, ttl = 300) {
        const key = `subscription:active:${userId}`;
        return await this.set(key, subscription, ttl);
    }

    /**
     * Recupera cache de assinatura do usuário
     * @param {number} userId - ID do usuário
     * @returns {Promise<Object|null>} - Dados da assinatura
     */
    async getUserSubscription(userId) {
        const key = `subscription:active:${userId}`;
        return await this.get(key);
    }

    /**
     * Cache com fallback automático
     * @param {string} key - Chave do cache
     * @param {Function} fallbackFunction - Função para buscar dados
     * @param {number} ttl - TTL em segundos
     * @returns {Promise<*>} - Dados do cache ou fallback
     */
    async getOrSet(key, fallbackFunction, ttl = this.defaultTTL) {
        try {
            // Tentar buscar no cache
            let cachedValue = await this.get(key);
            
            if (cachedValue !== null) {
                return cachedValue;
            }
            
            // Executar função fallback
            const freshValue = await fallbackFunction();
            
            // Armazenar no cache se o valor não for null/undefined
            if (freshValue !== null && freshValue !== undefined) {
                await this.set(key, freshValue, ttl);
            }
            
            return freshValue;
            
        } catch (error) {
            console.error('Erro no getOrSet:', error);
            
            // Em caso de erro, tentar executar apenas o fallback
            try {
                return await fallbackFunction();
            } catch (fallbackError) {
                throw new AppError(
                    'Erro ao recuperar dados (cache e fallback falharam)',
                    ERROR_TYPES.CACHE_ERROR,
                    {
                        cacheError: error.message,
                        fallbackError: fallbackError.message
                    }
                );
            }
        }
    }

    /**
     * Armazena no cache em memória
     * @param {string} key - Chave
     * @param {string} value - Valor serializado
     * @param {number} ttlMs - TTL em milissegundos
     */
    setMemoryCache(key, value, ttlMs) {
        // Verificar limite de itens
        if (this.memoryCache.size >= this.maxMemoryItems) {
            this.cleanupMemoryCache();
        }
        
        this.memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Recupera do cache em memória
     * @param {string} key - Chave
     * @returns {string|null} - Valor serializado
     */
    getMemoryCache(key) {
        const item = this.memoryCache.get(key);
        
        if (!item) {
            return null;
        }
        
        if (Date.now() > item.expiresAt) {
            this.memoryCache.delete(key);
            return null;
        }
        
        return item.value;
    }

    /**
     * Limpa itens expirados do cache em memória
     */
    cleanupMemoryCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, item] of this.memoryCache.entries()) {
            if (now > item.expiresAt) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        // Se ainda estiver muito cheio, remover os mais antigos
        if (this.memoryCache.size > this.maxMemoryItems * 0.8) {
            const entries = Array.from(this.memoryCache.entries())
                .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
            
            const toRemove = Math.floor(this.maxMemoryItems * 0.2);
            
            for (let i = 0; i < toRemove && i < entries.length; i++) {
                this.memoryCache.delete(entries[i][0]);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cache em memória limpo: ${cleanedCount} itens removidos`);
        }
    }

    /**
     * Obtém estatísticas do cache
     * @returns {Object} - Estatísticas
     */
    getStats() {
        return {
            memory: {
                size: this.memoryCache.size,
                maxItems: this.maxMemoryItems,
                usage: `${Math.round((this.memoryCache.size / this.maxMemoryItems) * 100)}%`
            },
            redis: {
                connected: !!this.redisClient,
                url: process.env.REDIS_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]'
            },
            defaultTTL: this.defaultTTL
        };
    }

    /**
     * Testa conectividade do cache
     * @returns {Promise<Object>} - Resultado do teste
     */
    async healthCheck() {
        const testKey = `health:${Date.now()}`;
        const testValue = { test: true, timestamp: Date.now() };
        
        try {
            // Testar escrita
            await this.set(testKey, testValue, 10);
            
            // Testar leitura
            const retrieved = await this.get(testKey);
            
            // Testar remoção
            await this.delete(testKey);
            
            const isHealthy = retrieved && retrieved.test === true;
            
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                memory: {
                    working: true,
                    size: this.memoryCache.size
                },
                redis: {
                    connected: !!this.redisClient,
                    working: this.redisClient ? true : null
                },
                lastCheck: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastCheck: new Date().toISOString()
            };
        }
    }

    /**
     * Limpa todo o cache
     * @returns {Promise<boolean>} - Se foi limpo com sucesso
     */
    async flush() {
        try {
            // Redis
            if (this.redisClient) {
                await this.redisClient.flushAll();
            }
            
            // Memória
            this.memoryCache.clear();
            
            return true;
            
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            return false;
        }
    }
}

// Singleton para garantir uma única instância
const cacheService = new CacheService();

module.exports = cacheService;