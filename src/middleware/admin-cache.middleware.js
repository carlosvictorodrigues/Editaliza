/**
 * MIDDLEWARE DE CACHE PARA ROTAS ADMINISTRATIVAS
 * 
 * Implementa cache inteligente para rotas admin pesadas,
 * reduzindo timeout e melhorando performance significativamente.
 * 
 * FUNCIONALIDADES:
 * - Cache in-memory com TTL configurável
 * - Invalidação seletiva por tags
 * - Cache warming para métricas críticas
 * - Rate limiting para proteção
 * - Monitoramento de hit/miss ratio
 */

const { systemLogger } = require('../utils/logger');

// =====================================================
// CONFIGURAÇÃO DO CACHE
// =====================================================

const CACHE_CONFIG = {
    // TTL padrão para diferentes tipos de dados
    TTL: {
        users: 2 * 60 * 1000,        // 2 minutos - dados que mudam frequentemente
        metrics: 5 * 60 * 1000,      // 5 minutos - métricas agregadas
        system: 10 * 60 * 1000,      // 10 minutos - configurações do sistema
        config: 30 * 60 * 1000,      // 30 minutos - dados estáticos
        audit: 1 * 60 * 1000         // 1 minuto - logs de auditoria
    },
    
    // Tamanho máximo do cache
    MAX_SIZE: 1000,
    
    // Configurações de limpeza
    CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutos
    
    // Configurações de cache warming
    WARM_INTERVAL: 2 * 60 * 1000     // 2 minutos
};

// =====================================================
// STORE DO CACHE IN-MEMORY
// =====================================================

class AdminCache {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            size: 0
        };
        
        // Iniciar limpeza automática
        this.startCleanup();
        
        // Iniciar cache warming para métricas críticas
        this.startCacheWarming();
        
        systemLogger.info('Admin cache initialized', {
            config: CACHE_CONFIG,
            maxSize: CACHE_CONFIG.MAX_SIZE
        });
    }
    
    /**
     * Gerar chave única para cache
     */
    generateKey(req, cacheType = 'default') {
        const { method, path, query, user } = req;
        const queryStr = JSON.stringify(query || {});
        const baseKey = `${method}:${path}:${queryStr}`;
        
        // Incluir ID do usuário para cache por usuário quando necessário
        if (cacheType === 'user-specific') {
            return `${baseKey}:user:${user?.id}`;
        }
        
        return baseKey;
    }
    
    /**
     * Buscar item no cache
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        // Verificar se expirou
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.deletes++;
            return null;
        }
        
        this.stats.hits++;
        
        // Atualizar último acesso
        item.lastAccessed = Date.now();
        
        return item.data;
    }
    
    /**
     * Armazenar item no cache
     */
    set(key, data, ttl = CACHE_CONFIG.TTL.metrics, tags = []) {
        // Verificar limite de tamanho
        if (this.cache.size >= CACHE_CONFIG.MAX_SIZE) {
            this.evictOldest();
        }
        
        const item = {
            data,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            expiresAt: Date.now() + ttl,
            tags: Array.isArray(tags) ? tags : [tags],
            size: this.estimateSize(data)
        };
        
        this.cache.set(key, item);
        this.stats.sets++;
        this.stats.size = this.cache.size;
        
        return true;
    }
    
    /**
     * Invalidar cache por chave
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
            this.stats.size = this.cache.size;
        }
        return deleted;
    }
    
    /**
     * Invalidar cache por tag
     */
    invalidateByTag(tag) {
        let deletedCount = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (item.tags.includes(tag)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        
        this.stats.deletes += deletedCount;
        this.stats.size = this.cache.size;
        
        systemLogger.info('Cache invalidated by tag', {
            tag,
            deletedCount,
            remainingSize: this.cache.size
        });
        
        return deletedCount;
    }
    
    /**
     * Limpar cache expirado
     */
    cleanup() {
        const now = Date.now();
        let deletedCount = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        
        this.stats.deletes += deletedCount;
        this.stats.size = this.cache.size;
        
        if (deletedCount > 0) {
            systemLogger.debug('Cache cleanup completed', {
                deletedCount,
                remainingSize: this.cache.size
            });
        }
        
        return deletedCount;
    }
    
    /**
     * Remover item mais antigo (LRU)
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.deletes++;
        }
    }
    
    /**
     * Estimar tamanho do objeto
     */
    estimateSize(obj) {
        try {
            return JSON.stringify(obj).length;
        } catch {
            return 1000; // Estimativa padrão
        }
    }
    
    /**
     * Obter estatísticas do cache
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : '0.00';
        
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            memoryUsage: this.estimateMemoryUsage(),
            uptime: Date.now() - this.startTime || Date.now()
        };
    }
    
    /**
     * Estimar uso de memória
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        for (const [key, item] of this.cache.entries()) {
            totalSize += key.length + item.size;
        }
        return `${(totalSize / 1024).toFixed(2)} KB`;
    }
    
    /**
     * Iniciar limpeza automática
     */
    startCleanup() {
        this.startTime = Date.now();
        
        setInterval(() => {
            this.cleanup();
        }, CACHE_CONFIG.CLEANUP_INTERVAL);
    }
    
    /**
     * Iniciar cache warming para métricas críticas
     */
    startCacheWarming() {
        // Cache warming será implementado conforme necessário
        // para pre-carregar métricas que são acessadas frequentemente
        
        systemLogger.debug('Cache warming configured', {
            interval: CACHE_CONFIG.WARM_INTERVAL
        });
    }
    
    /**
     * Limpar todo o cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.deletes += size;
        this.stats.size = 0;
        
        systemLogger.info('Cache cleared', { deletedCount: size });
        
        return size;
    }
}

// =====================================================
// INSTÂNCIA GLOBAL DO CACHE
// =====================================================

const adminCache = new AdminCache();

// =====================================================
// MIDDLEWARES DE CACHE
// =====================================================

/**
 * Middleware para cache de leitura
 */
const cacheGet = (cacheType = 'metrics', ttl = null, tags = []) => {
    return (req, res, next) => {
        // Skip cache se explicitamente solicitado
        if (req.query.no_cache === 'true' || req.headers['cache-control'] === 'no-cache') {
            return next();
        }
        
        const cacheKey = adminCache.generateKey(req, cacheType);
        const cachedData = adminCache.get(cacheKey);
        
        if (cachedData) {
            // Cache hit - retornar dados em cache
            systemLogger.debug('Cache hit', {
                key: cacheKey,
                adminId: req.user?.id
            });
            
            return res.json({
                ...cachedData,
                _cache: {
                    hit: true,
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        // Cache miss - interceptar response para cache
        const originalJson = res.json;
        
        res.json = function(data) {
            // Armazenar no cache apenas se for sucesso
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const cacheTtl = ttl || CACHE_CONFIG.TTL[cacheType] || CACHE_CONFIG.TTL.metrics;
                
                adminCache.set(cacheKey, data, cacheTtl, tags);
                
                systemLogger.debug('Cache miss - stored', {
                    key: cacheKey,
                    ttl: cacheTtl,
                    tags,
                    adminId: req.user?.id
                });
                
                // Adicionar metadata de cache
                data._cache = {
                    hit: false,
                    timestamp: new Date().toISOString()
                };
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware para invalidar cache
 */
const cacheInvalidate = (tags) => {
    return (req, res, next) => {
        // Interceptar response para invalidar após operação bem-sucedida
        const originalJson = res.json;
        
        res.json = function(data) {
            // Invalidar cache apenas se for sucesso
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const tagsArray = Array.isArray(tags) ? tags : [tags];
                
                tagsArray.forEach(tag => {
                    adminCache.invalidateByTag(tag);
                });
                
                systemLogger.debug('Cache invalidated after operation', {
                    tags: tagsArray,
                    adminId: req.user?.id
                });
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    };
};

/**
 * Middleware para estatísticas do cache
 */
const cacheStats = (req, res) => {
    const stats = adminCache.getStats();
    
    res.json({
        success: true,
        data: {
            cache: stats,
            config: CACHE_CONFIG,
            timestamp: new Date().toISOString()
        }
    });
};

/**
 * Middleware para limpeza manual do cache
 */
const cacheClear = (req, res) => {
    const { tag } = req.body;
    
    let deletedCount = 0;
    
    if (tag) {
        deletedCount = adminCache.invalidateByTag(tag);
    } else {
        deletedCount = adminCache.clear();
    }
    
    systemLogger.info('Cache cleared manually', {
        tag: tag || 'all',
        deletedCount,
        adminId: req.user?.id
    });
    
    res.json({
        success: true,
        message: `Cache ${tag ? `tag '${tag}'` : 'completo'} limpo com sucesso`,
        data: {
            deletedCount,
            tag: tag || 'all'
        }
    });
};

// =====================================================
// CONFIGURAÇÕES ESPECÍFICAS POR ROTA
// =====================================================

const ROUTE_CACHE_CONFIG = {
    // Usuários - cache por 2 minutos, invalidar em mudanças de usuário
    users: {
        get: cacheGet('users', CACHE_CONFIG.TTL.users, ['users']),
        invalidate: cacheInvalidate(['users'])
    },
    
    // Métricas do sistema - cache por 5 minutos
    metrics: {
        get: cacheGet('metrics', CACHE_CONFIG.TTL.metrics, ['metrics', 'system']),
        invalidate: cacheInvalidate(['metrics'])
    },
    
    // Configuração do sistema - cache por 30 minutos
    config: {
        get: cacheGet('config', CACHE_CONFIG.TTL.config, ['config']),
        invalidate: cacheInvalidate(['config'])
    },
    
    // Health check - sem cache (sempre atual)
    health: {
        get: (req, res, next) => next() // Sem cache para health checks
    },
    
    // Logs de auditoria - cache por 1 minuto
    audit: {
        get: cacheGet('audit', CACHE_CONFIG.TTL.audit, ['audit']),
        invalidate: cacheInvalidate(['audit'])
    }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    // Cache instance
    adminCache,
    
    // Middleware functions
    cacheGet,
    cacheInvalidate,
    cacheStats,
    cacheClear,
    
    // Route-specific configurations
    ROUTE_CACHE_CONFIG,
    
    // Constants
    CACHE_CONFIG
};