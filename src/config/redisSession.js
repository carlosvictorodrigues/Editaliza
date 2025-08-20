/**
 * Redis Session Configuration
 * Substitui SQLite por Redis para sessões em produção
 * 
 * Benefícios:
 * - Performance: 100x mais rápido que SQLite
 * - TTL automático: sessões expiram automaticamente
 * - Clustering: suporta múltiplas instâncias
 * - Atomic operations: sem race conditions
 */

const session = require('express-session');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

/**
 * Cria e configura o Redis client e session store
 */
async function createRedisSessionConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Configuração do Redis client
    const redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.error('❌ Redis: Muitas tentativas de reconexão');
                    return new Error('Redis connection failed');
                }
                const delay = Math.min(retries * 100, 3000);
                console.log(`⚠️ Redis reconectando em ${delay}ms...`);
                return delay;
            }
        },
        // Configurações de performance
        pingInterval: 5000, // Keep-alive a cada 5s
        enableReadyCheck: true,
        enableOfflineQueue: true
    });

    // Event handlers
    redisClient.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('🔄 Redis conectando...');
    });

    redisClient.on('ready', () => {
        console.log('✅ Redis pronto para uso');
    });

    redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconectando...');
    });

    // Conectar ao Redis
    try {
        await redisClient.connect();
        console.log('✅ Redis conectado com sucesso');
        
        // Testar conexão
        const pong = await redisClient.ping();
        console.log(`✅ Redis respondeu: ${pong}`);
        
    } catch (error) {
        console.error('❌ Erro ao conectar ao Redis:', error);
        
        // Em desenvolvimento, fallback para MemoryStore
        if (!isProduction) {
            console.warn('⚠️ Usando MemoryStore (desenvolvimento apenas)');
            return {
                secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
                resave: false,
                saveUninitialized: false,
                name: 'editaliza.sid',
                cookie: {
                    secure: false,
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000,
                    sameSite: 'lax'
                }
            };
        }
        
        throw error; // Em produção, falha se Redis não conectar
    }

    // Criar Redis Store
    const redisStore = new RedisStore({
        client: redisClient,
        prefix: 'sess:', // Prefixo para keys no Redis
        ttl: 24 * 60 * 60, // TTL em segundos (24 horas)
        disableTouch: false, // Permite renovar TTL ao acessar sessão
        // Serialização personalizada para melhor performance
        serializer: {
            stringify: JSON.stringify,
            parse: (str) => {
                try {
                    return JSON.parse(str);
                } catch (e) {
                    console.error('Erro ao fazer parse da sessão:', e);
                    return {};
                }
            }
        }
    });

    // Configuração completa da sessão
    const sessionConfig = {
        store: redisStore,
        secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
        resave: false, // Não salva se não houver mudanças
        saveUninitialized: false, // Não cria sessão vazia
        rolling: true, // Renova cookie a cada request
        name: 'editaliza.sid',
        cookie: {
            secure: isProduction, // HTTPS em produção
            httpOnly: true,
            path: '/', // IMPORTANTE: Disponível em todo o site, não apenas /auth
            maxAge: 24 * 60 * 60 * 1000, // 24 horas
            sameSite: isProduction ? 'none' : 'lax', // 'none' para OAuth cross-site
            domain: isProduction ? '.editaliza.com.br' : undefined
        }
    };

    // Adicionar método de limpeza para graceful shutdown
    sessionConfig.cleanup = async () => {
        console.log('🧹 Fechando conexão Redis...');
        await redisClient.quit();
        console.log('✅ Redis desconectado');
    };

    // Adicionar referência ao client para uso direto se necessário
    sessionConfig.redisClient = redisClient;

    return sessionConfig;
}

/**
 * Utilitários para gerenciamento de sessões Redis
 */
const sessionUtils = {
    /**
     * Lista todas as sessões ativas
     */
    async listActiveSessions(redisClient) {
        const keys = await redisClient.keys('sess:*');
        console.log(`📊 Total de sessões ativas: ${keys.length}`);
        return keys;
    },

    /**
     * Limpa todas as sessões (use com cuidado!)
     */
    async clearAllSessions(redisClient) {
        const keys = await redisClient.keys('sess:*');
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🧹 ${keys.length} sessões removidas`);
        }
        return keys.length;
    },

    /**
     * Obtém estatísticas de sessões
     */
    async getSessionStats(redisClient) {
        const keys = await redisClient.keys('sess:*');
        const stats = {
            total: keys.length,
            details: []
        };

        for (const key of keys.slice(0, 10)) { // Limitar a 10 para não sobrecarregar
            try {
                const ttl = await redisClient.ttl(key);
                const data = await redisClient.get(key);
                const session = JSON.parse(data);
                
                stats.details.push({
                    id: key.replace('sess:', ''),
                    ttl: ttl,
                    userId: session.userId || null,
                    loginMethod: session.loginMethod || null
                });
            } catch (e) {
                // Ignorar sessões corrompidas
            }
        }

        return stats;
    }
};

module.exports = {
    createRedisSessionConfig,
    sessionUtils
};