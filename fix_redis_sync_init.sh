#!/bin/bash

echo "🔧 Implementando inicialização síncrona do Redis..."

# Criar novo server.js com inicialização síncrona
cat > /tmp/fix_server_sync.js << 'EOF'
const fs = require('fs');
let content = fs.readFileSync('/root/editaliza/server.js', 'utf8');

// Remover inicialização assíncrona antiga
content = content.replace(/\/\/ Initialize Redis Sessions[\s\S]*?\}\)\(\);/g, '');

// Remover app.listen antigo para mover para o final
const listenRegex = /const server = app\.listen[\s\S]*?\}\);/;
const listenCode = content.match(listenRegex);
if (listenCode) {
    content = content.replace(listenRegex, '// Server listen movido para após Redis init');
}

// Adicionar função de inicialização principal no final
const initCode = `
// ============================================================================
// INICIALIZAÇÃO SÍNCRONA - Redis → Session → Passport → Rotas → Server
// ============================================================================
async function initializeApp() {
    try {
        console.log('🚀 Iniciando aplicação...');
        
        // 1. Configurar Redis e Session
        console.log('🔄 Conectando ao Redis...');
        const { createRedisSessionConfig } = require('./src/config/redisSession');
        const redisSessionConfig = await createRedisSessionConfig();
        
        // 2. Aplicar middleware de sessão
        app.use(session(redisSessionConfig));
        console.log('✅ Redis Sessions configurado');
        
        // 3. Inicializar Passport APÓS sessão
        app.use(passport.initialize());
        app.use(passport.session());
        console.log('✅ Passport inicializado');
        
        // 4. Registrar rotas APÓS sessão estar pronta
        const authRoutes = require('./src/routes/authRoutes');
        app.use('/auth', authRoutes);
        
        // Outras rotas
        app.use('/api', require('./src/routes/apiRoutes'));
        app.use('/study-plans', authenticateToken, require('./src/routes/studyPlanRoutes'));
        app.use('/plans', authenticateToken, require('./src/routes/planRoutes'));
        app.use('/users', authenticateToken, require('./src/routes/userRoutes'));
        
        console.log('✅ Rotas registradas');
        
        // 5. Iniciar servidor APENAS quando tudo estiver pronto
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log(\`✅ Servidor rodando na porta \${PORT}\`);
            console.log(\`✅ Ambiente: \${process.env.NODE_ENV || 'development'}\`);
            console.log(\`✅ Health check: http://localhost:\${PORT}/health\`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM recebido, fechando gracefully...');
            server.close(async () => {
                if (redisSessionConfig.redisClient) {
                    await redisSessionConfig.redisClient.quit();
                    console.log('✅ Redis desconectado');
                }
                process.exit(0);
            });
        });
        
        process.on('SIGINT', async () => {
            console.log('SIGINT recebido, fechando gracefully...');
            server.close(async () => {
                if (redisSessionConfig.redisClient) {
                    await redisSessionConfig.redisClient.quit();
                    console.log('✅ Redis desconectado');
                }
                process.exit(0);
            });
        });
        
    } catch (error) {
        console.error('❌ Erro fatal na inicialização:', error);
        process.exit(1);
    }
}

// Iniciar aplicação
initializeApp();
`;

// Adicionar no final do arquivo
content = content + initCode;

// Remover registros de rotas duplicados
content = content.replace(/app\.use\('\/auth', authRoutes\);/g, '// Movido para initializeApp');
content = content.replace(/app\.use\('\/api', require[\s\S]*?\);/g, '// Movido para initializeApp');
content = content.replace(/app\.use\('\/study-plans'[\s\S]*?\);/g, '// Movido para initializeApp');
content = content.replace(/app\.use\('\/plans'[\s\S]*?\);/g, '// Movido para initializeApp');
content = content.replace(/app\.use\('\/users'[\s\S]*?\);/g, '// Movido para initializeApp');

fs.writeFileSync('/root/editaliza/server.js', content);
console.log('✅ Server.js refatorado para inicialização síncrona');
EOF

cd /root/editaliza
node /tmp/fix_server_sync.js

echo "🔄 Reiniciando aplicação..."
pm2 restart editaliza-app

sleep 5

echo "📋 Verificando inicialização:"
pm2 logs editaliza-app --lines 15 --nostream | grep -E "Iniciando|Redis|Passport|Rotas|Servidor|erro"

echo ""
echo "🧪 Testando OAuth:"
curl -i "https://editaliza.com.br/auth/google/direct" 2>/dev/null | head -5

echo ""
echo "✅ Inicialização síncrona implementada!"
echo ""
echo "Se ainda houver problemas, verifique:"
echo "  pm2 logs editaliza-app --err"