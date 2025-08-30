#!/usr/bin/env node

/**
 * Script para identificar rotas duplicadas entre server.js e a arquitetura modular
 * 
 * FASE 4.1 - Script de análise para migração segura
 * 
 * Este script:
 * 1. Analisa todas as rotas em server.js
 * 2. Compara com as rotas implementadas na arquitetura modular
 * 3. Identifica rotas seguras para remoção
 * 4. Gera relatório detalhado
 */

const fs = require('fs');
const path = require('path');

// Configuração do projeto
const SERVER_JS_PATH = path.join(__dirname, '../server.js');
const ROUTES_DIR = path.join(__dirname, '../src/routes');

// Rotas modularizadas (implementadas)
const MODULAR_ROUTES = {
    'plans.routes.js': [
        'GET /api/plans',
        'POST /api/plans', 
        'GET /api/plans/:planId',
        'DELETE /api/plans/:planId',
        'PATCH /api/plans/:planId/settings',
        'POST /api/plans/:planId/subjects_with_topics',
        'GET /api/plans/:planId/subjects_with_topics', 
        'GET /api/plans/:planId/statistics',
        'GET /api/plans/:planId/exclusions',
        'GET /api/plans/:planId/excluded-topics',
        'GET /api/plans/:planId/gamification',
        'GET /api/plans/:planId/share-progress',
        'GET /api/plans/:planId/schedule',
        'GET /api/plans/:planId/overdue_check', // ✅ IMPLEMENTADO AGORA
        'POST /api/plans/:planId/generate'
    ],
    'sessions.routes.js': [
        'GET /api/sessions/by-date/:planId',
        'GET /api/sessions/overdue-check/:planId',
        'GET /api/sessions/statistics/:planId', 
        'GET /api/sessions/question-progress/:planId',
        'PATCH /api/sessions/batch-update-status',
        'PATCH /api/sessions/:sessionId',
        'PATCH /api/sessions/:sessionId/postpone',
        'POST /api/sessions/:sessionId/time',
        'POST /api/sessions/:sessionId/reinforce'
    ],
    'auth.routes.js': [
        'POST /api/register',
        'POST /api/login',
        'GET /auth/google',
        'GET /auth/google/callback',
        'GET /auth/session-token',
        'GET /auth/google/status',
        'POST /api/logout',
        'POST /api/request-password-reset',
        'POST /api/reset-password'
    ],
    'profile.routes.js': [
        'GET /api/profile',
        'PATCH /api/profile',
        'POST /api/profile/upload-photo'
    ],
    'subjects.routes.js': [
        'PATCH /api/subjects/:subjectId',
        'DELETE /api/subjects/:subjectId',
        'GET /api/subjects/:subjectId/topics'
    ],
    'topics.routes.js': [
        'PATCH /api/topics/batch_update',
        'PATCH /api/topics/batch_update_details',
        'PATCH /api/topics/:topicId',
        'DELETE /api/topics/:topicId'
    ]
};

// Rotas complexas ainda não migradas (MANTEM NO SERVER.JS)
const COMPLEX_ROUTES_NOT_MIGRATED = [
    'GET /api/plans/:planId/replan-preview',
    'POST /api/plans/:planId/replan',
    'GET /api/plans/:planId/progress',
    'GET /api/plans/:planId/goal_progress',
    'GET /api/plans/:planId/question_radar',
    'GET /api/plans/:planId/review_data',
    'GET /api/plans/:planId/detailed_progress',
    'GET /api/plans/:planId/activity_summary',
    'GET /api/plans/:planId/realitycheck'
];

// Rotas de sistema (MANTEM NO SERVER.JS)
const SYSTEM_ROUTES = [
    'GET /',
    'GET /health',
    'GET /ready', 
    'GET /metrics',
    'GET /admin/email/status',
    'POST /admin/email/test',
    'POST /admin/email/reset-limits',
    'GET /api/test-db'
];

/**
 * Extrai rotas do arquivo server.js
 */
function extractRoutesFromServerJs() {
    const content = fs.readFileSync(SERVER_JS_PATH, 'utf8');
    const routeRegex = /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    const routes = [];
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const path = match[2];
        routes.push(`${method} ${path}`);
    }
    
    return routes;
}

/**
 * Obter todas as rotas modularizadas
 */
function getAllModularRoutes() {
    const allModular = [];
    for (const [file, routes] of Object.entries(MODULAR_ROUTES)) {
        allModular.push(...routes);
    }
    return allModular;
}

/**
 * Normalizar rota para comparação
 */
function normalizeRoute(route) {
    return route
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Análise principal
 */
function analyzeRoutes() {
    console.log('🔍 ANÁLISE DE ROTAS DUPLICADAS - FASE 4.1');
    console.log('═'.repeat(60));
    
    const serverRoutes = extractRoutesFromServerJs();
    const modularRoutes = getAllModularRoutes();
    
    console.log("📊 ESTATÍSTICAS:");
    console.log(`   • Rotas em server.js: ${serverRoutes.length}`);
    console.log(`   • Rotas modularizadas: ${modularRoutes.length}`);
    console.log(`   • Rotas complexas não migradas: ${COMPLEX_ROUTES_NOT_MIGRATED.length}`);
    console.log(`   • Rotas de sistema: ${SYSTEM_ROUTES.length}`);
    console.log();
    
    // Identificar duplicadas
    const duplicates = [];
    const safe_to_remove = [];
    const must_keep = [];
    
    for (const serverRoute of serverRoutes) {
        const normalized = normalizeRoute(serverRoute);
        
        // Verificar se está modularizada
        const isModularized = modularRoutes.some(modRoute => 
            normalizeRoute(modRoute) === normalized
        );
        
        // Verificar se é complexa não migrada
        const isComplexNotMigrated = COMPLEX_ROUTES_NOT_MIGRATED.some(complexRoute =>
            normalizeRoute(complexRoute) === normalized
        );
        
        // Verificar se é rota de sistema
        const isSystemRoute = SYSTEM_ROUTES.some(sysRoute =>
            normalizeRoute(sysRoute) === normalized
        );
        
        if (isModularized) {
            duplicates.push(serverRoute);
            safe_to_remove.push(serverRoute);
        } else if (isComplexNotMigrated || isSystemRoute) {
            must_keep.push(serverRoute);
        }
    }
    
    console.log('🟢 ROTAS SEGURAS PARA REMOÇÃO (já modularizadas):');
    console.log('═'.repeat(50));
    safe_to_remove.forEach((route, index) => {
        console.log(`${index + 1}. ${route}`);
    });
    
    console.log();
    console.log('🔴 ROTAS QUE DEVEM PERMANECER:');
    console.log('═'.repeat(50));
    
    console.log('\n📋 Rotas complexas ainda não migradas:');
    COMPLEX_ROUTES_NOT_MIGRATED.forEach((route, index) => {
        console.log(`${index + 1}. ${route}`);
    });
    
    console.log('\n⚙️  Rotas de sistema:');
    SYSTEM_ROUTES.forEach((route, index) => {
        console.log(`${index + 1}. ${route}`);
    });
    
    console.log();
    console.log('📈 RESUMO DA MIGRAÇÃO:');
    console.log('═'.repeat(50));
    console.log(`✅ Rotas já migradas: ${safe_to_remove.length}`);
    console.log(`⏳ Rotas ainda não migradas: ${COMPLEX_ROUTES_NOT_MIGRATED.length}`);
    console.log(`⚙️  Rotas de sistema: ${SYSTEM_ROUTES.length}`);
    console.log(`🎯 Progresso: ${Math.round((safe_to_remove.length / (safe_to_remove.length + COMPLEX_ROUTES_NOT_MIGRATED.length)) * 100)}%`);
    
    // Gerar arquivo de backup das rotas a remover
    const backupContent = `/*
 * BACKUP DAS ROTAS DUPLICADAS - FASE 4.1
 * Data: ${new Date().toISOString()}
 * 
 * Estas rotas estão duplicadas entre server.js e a arquitetura modular.
 * Elas podem ser removidas do server.js com segurança.
 */

${safe_to_remove.map(route => `// ${route}`).join('\n')}

/*
 * Total de rotas seguras para remoção: ${safe_to_remove.length}
 * 
 * IMPORTANTE: Antes de remover, certifique-se de que:
 * 1. Todas as rotas modularizadas estão funcionando
 * 2. Os testes passaram
 * 3. A aplicação foi testada em ambiente de desenvolvimento
 */
`;
    
    const backupPath = path.join(__dirname, '../logs/duplicate-routes-backup.txt');
    fs.writeFileSync(backupPath, backupContent);
    console.log(`\n💾 Backup das rotas duplicadas salvo em: ${backupPath}`);
    
    return {
        duplicates: safe_to_remove,
        mustKeep: must_keep,
        progress: Math.round((safe_to_remove.length / (safe_to_remove.length + COMPLEX_ROUTES_NOT_MIGRATED.length)) * 100)
    };
}

// Executar análise se chamado diretamente
if (require.main === module) {
    try {
        // Criar diretório de logs se não existir
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const result = analyzeRoutes();
        
        console.log('\n🎉 Análise concluída com sucesso!');
        console.log(`📊 ${result.duplicates.length} rotas duplicadas identificadas`);
        console.log(`🚀 Sistema ${result.progress}% migrado para arquitetura modular`);
        
    } catch (error) {
        console.error('❌ Erro na análise:', error.message);
        process.exit(1);
    }
}

module.exports = { analyzeRoutes, MODULAR_ROUTES, COMPLEX_ROUTES_NOT_MIGRATED };