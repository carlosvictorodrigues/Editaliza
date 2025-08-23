#!/usr/bin/env node

/**
 * Script de migração: SQLite Sessions → Redis Sessions
 * 
 * Este script atualiza o server.js para usar Redis ao invés de SQLite
 * Mantém backup do arquivo original
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Iniciando migração para Redis Sessions...\n');

// Caminho do server.js
const serverPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.backup-sqlite-sessions');

// Fazer backup
console.log('📦 Criando backup do server.js...');
fs.copyFileSync(serverPath, backupPath);
console.log(`✅ Backup salvo em: ${backupPath}\n`);

// Ler conteúdo atual
let serverContent = fs.readFileSync(serverPath, 'utf8');

// 1. Remover import do SQLiteStore
console.log('1️⃣ Removendo SQLiteStore...');
serverContent = serverContent.replace(
    /const SQLiteStore = require\(['"]connect-sqlite3['"]\)\(session\);?\n?/g,
    ''
);

// 2. Adicionar import do Redis
console.log('2️⃣ Adicionando imports do Redis...');
const redisImport = `// Redis Session Store (substitui SQLite)
const { createRedisSessionConfig, sessionUtils } = require('./src/config/redisSession');
`;

// Adicionar após outros requires
serverContent = serverContent.replace(
    /(const session = require\(['"]express-session['"]\);)/,
    `$1\n${redisImport}`
);

// 3. Substituir configuração de sessão
console.log('3️⃣ Substituindo configuração de sessão...');

// Encontrar e substituir a configuração de sessão antiga
const oldSessionConfig = /\/\/ Configuração de sessão[\s\S]*?app\.use\(session\(sessionConfig\)\);/;

const newSessionConfig = `// Configuração de sessão com Redis
let sessionConfig;
let redisClient;

// Inicializar Redis Session de forma assíncrona
(async () => {
    try {
        const config = await createRedisSessionConfig();
        sessionConfig = config;
        redisClient = config.redisClient;
        
        // Aplicar configuração de sessão
        app.use(session(sessionConfig));
        
        console.log('✅ Redis Session configurado com sucesso');
        
        // Opcional: Mostrar estatísticas de sessões
        if (process.env.NODE_ENV !== 'production') {
            const stats = await sessionUtils.getSessionStats(redisClient);
            console.log('📊 Estatísticas de sessões:', stats);
        }
    } catch (error) {
        console.error('❌ Erro ao configurar Redis Session:', error);
        
        // Fallback para configuração básica em memória (APENAS desenvolvimento)
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️ Usando MemoryStore como fallback (desenvolvimento)');
            app.use(session({
                secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
                resave: false,
                saveUninitialized: false,
                name: 'editaliza.sid',
                cookie: {
                    secure: false,
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000,
                    sameSite: 'lax'
                }
            }));
        } else {
            // Em produção, falhar se Redis não funcionar
            process.exit(1);
        }
    }
})();`;

// Se não encontrar o padrão antigo, procurar por configuração inline
if (serverContent.match(oldSessionConfig)) {
    serverContent = serverContent.replace(oldSessionConfig, newSessionConfig);
} else {
    console.log('⚠️ Configuração de sessão não encontrada no formato esperado');
    console.log('   Procurando configuração alternativa...');
    
    // Tentar substituir configuração inline
    const inlineSessionConfig = /app\.use\(session\(\{[\s\S]*?\}\)\);/;
    if (serverContent.match(inlineSessionConfig)) {
        serverContent = serverContent.replace(inlineSessionConfig, newSessionConfig);
    } else {
        console.error('❌ Não foi possível encontrar configuração de sessão para substituir');
        console.log('   Por favor, faça a migração manualmente');
        process.exit(1);
    }
}

// 4. Adicionar cleanup no graceful shutdown
console.log('4️⃣ Adicionando cleanup no shutdown...');

const shutdownAddition = `
    // Fechar conexão Redis
    if (redisClient) {
        await redisClient.quit();
        console.log('✅ Redis desconectado');
    }
`;

// Procurar por process.on('SIGTERM' ou 'SIGINT'
const shutdownPattern = /(process\.on\(['"]SIGTERM['"],[\s\S]*?)\}\);/;
if (serverContent.match(shutdownPattern)) {
    serverContent = serverContent.replace(
        shutdownPattern,
        `$1${shutdownAddition}});`
    );
}

// 5. Salvar arquivo modificado
console.log('5️⃣ Salvando server.js modificado...');
fs.writeFileSync(serverPath, serverContent);

console.log('\n✅ Migração concluída com sucesso!\n');
console.log('📝 Próximos passos:');
console.log('   1. Revise as mudanças em server.js');
console.log('   2. Teste a aplicação localmente');
console.log('   3. Se houver problemas, restaure o backup:');
console.log(`      cp ${backupPath} ${serverPath}`);
console.log('   4. Deploy para produção quando estiver pronto');
console.log('\n💡 Dica: Use "redis-cli monitor" para ver operações em tempo real');