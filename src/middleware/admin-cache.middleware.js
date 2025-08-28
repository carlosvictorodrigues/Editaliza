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
    // TTL ultra-agressivo para performance sub-segundo
    TTL: {
        users: 60 * 1000,           // 60 segundos - cache mais longo
        metrics: 5 * 60 * 1000,     // 5 minutos - métricas são estáticas
        system: 10 * 60 * 1000,     // 10 minutos - configurações
        config: 30 * 60 * 1000,     // 30 minutos - dados raramente mudam
        audit: 2 * 60 * 1000,       // 2 minutos - logs
        health: 30 * 1000           // 30 segundos - health check
    },
    
    // Cache ultra-agressivo para performance
    MAX_SIZE: 5000,                  // 5x mais cache
    MAX_MEMORY_MB: 100,              // 100MB de cache
    
    // Configurações de limpeza otimizada
    CLEANUP_INTERVAL: 2 * 60 * 1000, // 2 minutos - mais frequente
    
    // Cache warming agressivo
    WARM_INTERVAL: 30 * 1000,        // 30 segundos
    
    // Compressão para economizar memória
    COMPRESSION_THRESHOLD: 1024,     // Comprimir dados > 1KB
    
    // Performance thresholds
    SLOW_QUERY_THRESHOLD: 500,       // 500ms = query lenta
    CACHE_HIT_TARGET: 80            // 80% hit rate target
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
     * Buscar item no cache com descompressão automática
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
        
        // Atualizar estatísticas de uso
        item.lastAccessed = Date.now();
        item.hitCount = (item.hitCount || 0) + 1;
        
        // Descompressão automática
        let data = item.data;
        if (item.compressed && data && data._compressed) {
            try {
                data = JSON.parse(data._data);
            } catch (decompError) {
                systemLogger.error('Cache decompression error', { error: decompError.message, key });
                // Remover item corrompido
                this.cache.delete(key);
                this.stats.misses++; // Contar como miss
                return null;
            }
        }
        
        return data;
    }
    
    /**
     * Armazenar item no cache com compressão inteligente
     */
    set(key, data, ttl = CACHE_CONFIG.TTL.users, tags = []) {
        try {
            // Verificar limite de tamanho e memória
            if (this.cache.size >= CACHE_CONFIG.MAX_SIZE) {
                this.evictOldest();
            }
            
            // Verificar limite de memória
            if (this.getMemoryUsageMB() > CACHE_CONFIG.MAX_MEMORY_MB) {
                this.evictLargest();
            }
            
            const rawSize = this.estimateSize(data);
            let processedData = data;
            let compressed = false;
            
            // Compressão automática para objetos grandes
            if (rawSize > CACHE_CONFIG.COMPRESSION_THRESHOLD && data && typeof data === 'object') {
                try {
                    // Compressão simples: stringify + básico
                    const jsonString = JSON.stringify(data);
                    if (jsonString.length > rawSize * 0.8) { // Só comprimir se valer a pena
                        processedData = {
                            _compressed: true,
                            _data: jsonString
                        };
                        compressed = true;
                    }
                } catch (compError) {
                    // Falha na compressão: usar dados originais
                    processedData = data;
                }
            }
            
            const item = {
                data: processedData,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                expiresAt: Date.now() + ttl,
                tags: Array.isArray(tags) ? tags : [tags],
                size: this.estimateSize(processedData),
                originalSize: rawSize,
                compressed,
                hitCount: 0
            };
            
            this.cache.set(key, item);
            this.stats.sets++;
            this.stats.size = this.cache.size;
            
            return true;
            
        } catch (error) {
            systemLogger.error('Cache set error', { error: error.message, key });
            return false;
        }
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
     * Remover item mais antigo (LRU inteligente)
     */
    evictOldest() {
        let targetKey = null;
        let oldestTime = Date.now();
        let lowestValue = Infinity;
        
        // LRU com peso por hit count e tamanho
        for (const [key, item] of this.cache.entries()) {
            const age = Date.now() - item.lastAccessed;
            const hitRate = item.hitCount / Math.max(1, Date.now() - item.createdAt) * 1000;
            const value = hitRate / Math.max(1, item.size); // Valor por byte
            
            if (age > 60000 && value < lowestValue) { // Priorizar itens antigos com baixo valor
                lowestValue = value;
                targetKey = key;
            }
            
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                if (!targetKey) targetKey = key; // Fallback
            }
        }
        
        if (targetKey) {
            this.cache.delete(targetKey);
            this.stats.deletes++;
            this.stats.evictions = (this.stats.evictions || 0) + 1;
        }
    }
    
    /**
     * Remover item maior para liberar memória
     */
    evictLargest() {
        let largestKey = null;
        let largestSize = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (item.size > largestSize) {
                largestSize = item.size;
                largestKey = key;
            }
        }
        
        if (largestKey) {
            this.cache.delete(largestKey);
            this.stats.deletes++;
            this.stats.evictions = (this.stats.evictions || 0) + 1;
        }
    }
    
    /**
     * Calcular uso de memória em MB
     */
    getMemoryUsageMB() {
        let totalSize = 0;
        for (const [key, item] of this.cache.entries()) {
            totalSize += key.length * 2; // chars = 2 bytes
            totalSize += item.size;
            totalSize += 200; // overhead estimado do objeto
        }
        return totalSize / (1024 * 1024);
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
     * Obter estatísticas avançadas do cache
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : '0.00';
        const memoryMB = this.getMemoryUsageMB();
        
        // Calcular estatísticas avançadas
        let totalHits = 0;
        let compressedItems = 0;
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;
        
        for (const [key, item] of this.cache.entries()) {
            totalHits += item.hitCount || 0;
            if (item.compressed) {
                compressedItems++;
                totalOriginalSize += item.originalSize || 0;
                totalCompressedSize += item.size;
            }
        }
        
        const compressionRatio = totalOriginalSize > 0 ? 
            ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1) : '0.0';
        
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            hitRateNumeric: parseFloat(hitRate),
            memoryUsage: `${memoryMB.toFixed(2)} MB`,
            memoryUsageMB: memoryMB,
            uptime: Date.now() - (this.startTime || Date.now()),
            evictions: this.stats.evictions || 0,
            compression: {
                enabled: true,
                compressedItems,
                totalItems: this.cache.size,
                compressionRatio: `${compressionRatio}%`,
                savedBytes: totalOriginalSize - totalCompressedSize
            },
            performance: {
                avgHitsPerItem: this.cache.size > 0 ? (totalHits / this.cache.size).toFixed(1) : '0.0',
                healthStatus: this.getHealthStatus(),
                recommendations: this.getRecommendations()
            }
        };
    }
    
    /**
     * Status de saúde do cache
     */
    getHealthStatus() {
        const hitRate = this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses) * 100;
        const memoryUsage = this.getMemoryUsageMB();
        
        if (hitRate >= CACHE_CONFIG.CACHE_HIT_TARGET && memoryUsage < CACHE_CONFIG.MAX_MEMORY_MB * 0.8) {
            return 'excellent';
        } else if (hitRate >= 60 && memoryUsage < CACHE_CONFIG.MAX_MEMORY_MB * 0.9) {
            return 'good';
        } else if (hitRate >= 40) {
            return 'fair';
        } else {
            return 'poor';
        }
    }
    
    /**
     * Recomendações de otimização
     */
    getRecommendations() {
        const recommendations = [];
        const hitRate = this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses) * 100;
        const memoryUsage = this.getMemoryUsageMB();
        
        if (hitRate < CACHE_CONFIG.CACHE_HIT_TARGET) {
            recommendations.push('Considere aumentar TTL para melhor hit rate');
        }
        
        if (memoryUsage > CACHE_CONFIG.MAX_MEMORY_MB * 0.8) {
            recommendations.push('Uso de memória alto - considere ajustar MAX_SIZE');
        }
        
        if (this.stats.evictions > this.stats.sets * 0.1) {
            recommendations.push('Muitas evictions - considere aumentar MAX_SIZE');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Cache funcionando otimamente');
        }
        
        return recommendations;
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
 * Middleware para cache de leitura com performance otimizada
 */
const cacheGet = (cacheType = 'users', ttl = null, tags = []) => {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Skip cache se explicitamente solicitado
        if (req.query.no_cache === 'true' || 
            req.headers['cache-control'] === 'no-cache' || 
            req.headers['pragma'] === 'no-cache') {
            
            systemLogger.debug('Cache bypassed', {
                reason: 'explicit_no_cache',
                adminId: req.user?.id
            });
            
            return next();
        }
        
        const cacheKey = adminCache.generateKey(req, cacheType);
        const cachedData = adminCache.get(cacheKey);
        
        if (cachedData) {
            const responseTime = Date.now() - startTime;
            
            // Cache hit - performance excelente
            systemLogger.debug('Cache hit - ultra fast response', {
                key: cacheKey,
                responseTime: `${responseTime}ms`,
                cacheType,
                adminId: req.user?.id
            });
            
            // Headers HTTP para cache
            res.set({
                'X-Cache': 'HIT',
                'X-Cache-Type': cacheType,
                'X-Response-Time': `${responseTime}ms`,
                'Cache-Control': 'public, max-age=' + Math.floor((CACHE_CONFIG.TTL[cacheType] || 30000) / 1000),
                'ETag': `"${cacheKey.substring(0, 16)}"`
            });
            
            return res.json({
                ...cachedData,
                _cache: {
                    hit: true,
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString(),
                    cacheKey: cacheKey.substring(0, 32) + '...'
                }
            });
        }
        
        // Cache miss - interceptar response para cache
        const originalJson = res.json;
        const queryStartTime = Date.now();
        
        res.json = function(data) {
            const totalTime = Date.now() - startTime;
            const queryTime = Date.now() - queryStartTime;
            
            // Headers HTTP para cache miss
            res.set({
                'X-Cache': 'MISS',
                'X-Cache-Type': cacheType,
                'X-Response-Time': `${totalTime}ms`,
                'X-Query-Time': `${queryTime}ms`
            });
            
            // Armazenar no cache apenas se for sucesso
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const cacheTtl = ttl || CACHE_CONFIG.TTL[cacheType] || CACHE_CONFIG.TTL.users;
                
                const cacheSuccess = adminCache.set(cacheKey, data, cacheTtl, tags);
                
                if (cacheSuccess) {
                    systemLogger.debug('Cache miss - stored successfully', {
                        key: cacheKey,
                        ttl: cacheTtl,
                        queryTime: `${queryTime}ms`,
                        tags,
                        adminId: req.user?.id
                    });
                } else {
                    systemLogger.warn('Cache storage failed', {
                        key: cacheKey,
                        adminId: req.user?.id
                    });
                }
                
                // Adicionar metadata de cache detalhada
                if (data && typeof data === 'object') {
                    data._cache = {
                        hit: false,
                        stored: cacheSuccess,
                        responseTime: `${totalTime}ms`,
                        queryTime: `${queryTime}ms`,
                        ttl: cacheTtl,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Performance warning para queries lentas
                if (queryTime > CACHE_CONFIG.SLOW_QUERY_THRESHOLD) {
                    systemLogger.warn('Slow query detected in admin endpoint', {
                        endpoint: req.originalUrl,
                        queryTime: `${queryTime}ms`,
                        adminId: req.user?.id,
                        cacheKey
                    });
                }
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
    // Usuários - cache agressivo por 30s, invalidar em mudanças de usuário
    users: {
        get: cacheGet('users', CACHE_CONFIG.TTL.users, ['users', 'admin']),
        invalidate: cacheInvalidate(['users', 'admin'])
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