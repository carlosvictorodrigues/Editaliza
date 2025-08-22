#!/bin/bash

# Script para configurar Redis Sessions no servidor
# Substitui SQLite por Redis para melhor performance

echo "🔄 Configurando Redis Sessions..."

# 1. Fazer backup do server.js
echo "📦 Criando backup do server.js..."
cp /root/editaliza/server.js /root/editaliza/server.js.backup-redis-migration
echo "✅ Backup criado: server.js.backup-redis-migration"

# 2. Criar arquivo de configuração Redis
echo "📝 Criando configuração Redis..."
cat > /root/editaliza/src/config/redisSession.js << 'EOF'
/**
 * Redis Session Configuration - Simplified Production Version
 */

const session = require('express-session');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

async function createRedisSessionConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Redis client
    const redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    console.error('❌ Redis: Muitas tentativas de reconexão');
                    return new Error('Redis connection failed');
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    // Event handlers
    redisClient.on('error', (err) => console.error('❌ Redis Error:', err));
    redisClient.on('ready', () => console.log('✅ Redis Sessions pronto'));

    // Connect
    try {
        await redisClient.connect();
        console.log('✅ Redis conectado para sessões');
    } catch (error) {
        console.error('❌ Erro ao conectar Redis:', error);
        throw error;
    }

    // Create store
    const redisStore = new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: 24 * 60 * 60 // 24 hours
    });

    // Session config
    return {
        store: redisStore,
        secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: true, // Important for OAuth
        rolling: true,
        name: 'editaliza.sid',
        cookie: {
            secure: isProduction,
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: isProduction ? 'none' : 'lax',
            domain: isProduction ? '.editaliza.com.br' : undefined
        },
        redisClient: redisClient
    };
}

module.exports = { createRedisSessionConfig };
EOF

echo "✅ Configuração Redis criada"

# 3. Criar patch para server.js
echo "📝 Criando patch para server.js..."
cat > /tmp/redis_patch.js << 'EOF'
const fs = require('fs');

// Ler server.js
let content = fs.readFileSync('/root/editaliza/server.js', 'utf8');

// Adicionar import do Redis após session require
if (!content.includes('redisSession')) {
    content = content.replace(
        "const session = require('express-session');",
        `const session = require('express-session');
const { createRedisSessionConfig } = require('./src/config/redisSession');`
    );
}

// Comentar SQLiteStore se existir
content = content.replace(
    /^const SQLiteStore = require\('connect-sqlite3'\)\(session\);/gm,
    '// const SQLiteStore = require(\'connect-sqlite3\')(session); // Substituído por Redis'
);

// Substituir configuração de sessão
const sessionConfigRegex = /const sessionConfig = \{[\s\S]*?\};[\s\S]*?app\.use\(session\(sessionConfig\)\);/;

if (content.match(sessionConfigRegex)) {
    content = content.replace(sessionConfigRegex, `// Redis Session Configuration
let redisSessionConfig;

// Initialize Redis Sessions
(async () => {
    try {
        redisSessionConfig = await createRedisSessionConfig();
        app.use(session(redisSessionConfig));
        console.log('✅ Redis Sessions ativado');
    } catch (error) {
        console.error('❌ Erro ao inicializar Redis Sessions:', error);
        // Fallback para configuração anterior
        const sessionConfig = {
            secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: true,
            name: 'editaliza.sid',
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                domain: process.env.NODE_ENV === 'production' ? '.editaliza.com.br' : undefined
            }
        };
        app.use(session(sessionConfig));
        console.warn('⚠️ Usando sessão em memória como fallback');
    }
})();`);
}

// Salvar
fs.writeFileSync('/root/editaliza/server.js', content);
console.log('✅ server.js atualizado para usar Redis');
EOF

# 4. Executar patch
echo "🔧 Aplicando patch no server.js..."
cd /root/editaliza
node /tmp/redis_patch.js

# 5. Verificar se Redis está rodando
echo "🔍 Verificando Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis está rodando"
    
    # Mostrar estatísticas
    echo "📊 Estatísticas do Redis:"
    redis-cli INFO stats | grep -E "total_connections_received|connected_clients|used_memory_human"
    
    # Listar sessões existentes
    echo ""
    echo "📋 Sessões existentes:"
    redis-cli --scan --pattern "sess:*" | head -5
    SESSION_COUNT=$(redis-cli --scan --pattern "sess:*" | wc -l)
    echo "Total de sessões: $SESSION_COUNT"
else
    echo "❌ Redis não está rodando!"
    echo "Execute: sudo systemctl start redis-server"
    exit 1
fi

# 6. Limpar sessões SQLite antigas
echo ""
echo "🧹 Limpando sessões SQLite antigas..."
if [ -f "/root/editaliza/sessions.db" ]; then
    rm -f /root/editaliza/sessions.db
    echo "✅ sessions.db removido"
fi

# 7. Reiniciar aplicação
echo ""
echo "🔄 Reiniciando aplicação..."
pm2 restart editaliza-app

# 8. Aguardar e verificar logs
sleep 3
echo ""
echo "📋 Logs da aplicação:"
pm2 logs editaliza-app --lines 5 --nostream | grep -E "Redis|session"

echo ""
echo "✅ Migração para Redis Sessions concluída!"
echo ""
echo "🔍 Para monitorar Redis em tempo real:"
echo "   redis-cli monitor"
echo ""
echo "📊 Para ver todas as sessões:"
echo "   redis-cli --scan --pattern 'sess:*'"
echo ""
echo "🧹 Para limpar todas as sessões (cuidado!):"
echo "   redis-cli --scan --pattern 'sess:*' | xargs redis-cli del"
echo ""
echo "⚠️ Se houver problemas, restaure o backup:"
echo "   cp /root/editaliza/server.js.backup-redis-migration /root/editaliza/server.js"
echo "   pm2 restart editaliza-app"