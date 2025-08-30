#!/usr/bin/env node

/**
 * Script para remover rotas duplicadas do server.js
 * 
 * FASE 4.1 - Remoção segura de rotas já modularizadas
 * 
 * Este script:
 * 1. Cria backup do server.js atual
 * 2. Remove rotas que já estão implementadas na arquitetura modular
 * 3. Mantém rotas complexas ainda não migradas
 * 4. Gera relatório das mudanças
 */

const fs = require('fs');
const path = require('path');

// Configuração
const SERVER_JS_PATH = path.join(__dirname, '../server.js');
const BACKUP_DIR = path.join(__dirname, '../backups');
const LOGS_DIR = path.join(__dirname, '../logs');

// Rotas duplicadas identificadas pelo script anterior (seguras para remoção)
const SAFE_TO_REMOVE_ROUTES = [
    'POST /api/profile/upload-photo',
    'POST /api/register',
    'POST /api/login',
    'GET /auth/google',
    'GET /auth/google/callback',
    'GET /auth/session-token',
    'GET /auth/google/status',
    'POST /api/logout',
    'POST /api/request-password-reset',
    'POST /api/reset-password',
    'GET /api/profile',
    'PATCH /api/profile',
    'GET /api/plans',
    'POST /api/plans',
    'GET /api/plans/:planId',
    'DELETE /api/plans/:planId',
    'PATCH /api/plans/:planId/settings',
    'POST /api/plans/:planId/subjects_with_topics',
    'PATCH /api/subjects/:subjectId',
    'DELETE /api/subjects/:subjectId',
    'GET /api/plans/:planId/subjects_with_topics',
    'GET /api/subjects/:subjectId/topics',
    'PATCH /api/topics/batch_update',
    'PATCH /api/topics/batch_update_details',
    'PATCH /api/topics/:topicId',
    'DELETE /api/topics/:topicId',
    'POST /api/plans/:planId/generate',
    'GET /api/plans/:planId/exclusions',
    'GET /api/plans/:planId/excluded-topics',
    'GET /api/plans/:planId/statistics',
    'GET /api/plans/:planId/overdue_check',
    'GET /api/plans/:planId/schedule'
];

/**
 * Criar backup do server.js
 */
function createBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `server-js-backup-${timestamp}.js`);
    
    fs.copyFileSync(SERVER_JS_PATH, backupPath);
    console.log(`💾 Backup criado: ${backupPath}`);
    return backupPath;
}

/**
 * Detectar e marcar rotas para remoção
 */
function detectRouteBlocks(content) {
    const lines = content.split('\n');
    const blocks = [];
    let currentBlock = null;
    let braceCount = 0;
    let inRouteHandler = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Detectar início de rota
        const routeMatch = line.match(/app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (routeMatch) {
            const method = routeMatch[1].toUpperCase();
            const path = routeMatch[2];
            const route = `${method} ${path}`;
            
            // Verificar se é uma rota comentada (legacy)
            const isLegacyComment = 
                lines.slice(Math.max(0, i - 5), i).some(prevLine => 
                    prevLine.includes('LEGACY ROUTE') || 
                    prevLine.includes('MIGRATED TO MODULAR') ||
                    prevLine.includes('REPLACED BY src/routes')
                );
            
            if (isLegacyComment) {
                // Pular rotas já comentadas
                continue;
            }
            
            currentBlock = {
                route,
                startLine: i,
                endLine: i,
                shouldRemove: SAFE_TO_REMOVE_ROUTES.includes(route),
                lines: [line]
            };
            
            braceCount = 0;
            inRouteHandler = true;
        }
        
        if (inRouteHandler && currentBlock) {
            if (i > currentBlock.startLine) {
                currentBlock.lines.push(line);
            }
            
            // Contar chaves para encontrar o final da função
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            // Se chegamos ao final da função da rota
            if (braceCount <= 0 && line.includes(');')) {
                currentBlock.endLine = i;
                blocks.push(currentBlock);
                currentBlock = null;
                inRouteHandler = false;
            }
        }
    }
    
    return blocks;
}

/**
 * Processar remoção das rotas
 */
function processRemoval(content) {
    const blocks = detectRouteBlocks(content);
    const lines = content.split('\n');
    const removedRoutes = [];
    const keptRoutes = [];
    
    // Marcar linhas para remoção
    const linesToRemove = new Set();
    
    blocks.forEach(block => {
        if (block.shouldRemove) {
            for (let i = block.startLine; i <= block.endLine; i++) {
                linesToRemove.add(i);
            }
            removedRoutes.push({
                route: block.route,
                startLine: block.startLine + 1, // +1 para numeração humana
                endLine: block.endLine + 1,
                linesCount: block.endLine - block.startLine + 1
            });
        } else {
            keptRoutes.push(block.route);
        }
    });
    
    // Criar novo conteúdo sem as linhas removidas
    const newLines = lines.filter((_, index) => !linesToRemove.has(index));
    const newContent = newLines.join('\n');
    
    return {
        newContent,
        removedRoutes,
        keptRoutes,
        originalLines: lines.length,
        newLines: newLines.length,
        removedLines: lines.length - newLines.length
    };
}

/**
 * Adicionar comentários explicativos
 */
function addExplanatoryComments(content) {
    const headerComment = `
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 FASE 4.1 - MIGRAÇÃO PARA ARQUITETURA MODULAR CONCLUÍDA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este arquivo foi otimizado para remover ${SAFE_TO_REMOVE_ROUTES.length} rotas duplicadas que já foram
 * migradas para a nova arquitetura modular.
 * 
 * ✅ Rotas migradas para:
 * • /src/routes/plans.routes.js    - Operações de planos de estudo
 * • /src/routes/sessions.routes.js - Gerenciamento de sessões
 * • /src/routes/auth.routes.js     - Autenticação e autorização
 * • /src/routes/profile.routes.js  - Perfil do usuário
 * • /src/routes/subjects.routes.js - Disciplinas
 * • /src/routes/topics.routes.js   - Tópicos
 * 
 * ⏳ Rotas complexas ainda não migradas (permanecem neste arquivo):
 * • GET  /api/plans/:planId/replan-preview     - Preview de replanejamento
 * • POST /api/plans/:planId/replan             - Replanejamento inteligente
 * • GET  /api/plans/:planId/progress           - Progresso detalhado
 * • GET  /api/plans/:planId/goal_progress      - Progresso de metas
 * • GET  /api/plans/:planId/question_radar     - Radar de questões
 * • GET  /api/plans/:planId/review_data        - Dados de revisão
 * • GET  /api/plans/:planId/detailed_progress  - Progresso detalhado
 * • GET  /api/plans/:planId/activity_summary   - Resumo de atividades
 * • GET  /api/plans/:planId/realitycheck       - Diagnóstico de performance
 * 
 * 🎯 Progresso da migração: 78% (32/41 rotas migradas)
 * 
 * Data da otimização: ${new Date().toISOString()}
 * ═══════════════════════════════════════════════════════════════════════════
 */

`;
    
    // Encontrar onde inserir o comentário (depois dos imports, antes das rotas)
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // Procurar uma boa posição para inserir (depois dos requires, antes das rotas)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('app.') && (line.includes('.get(') || line.includes('.post(') || line.includes('.patch(') || line.includes('.delete('))) {
            insertIndex = i;
            break;
        }
    }
    
    lines.splice(insertIndex, 0, headerComment);
    return lines.join('\n');
}

/**
 * Gerar relatório detalhado
 */
function generateReport(result, backupPath) {
    const report = `
🔄 RELATÓRIO DE REMOÇÃO DE ROTAS DUPLICADAS - FASE 4.1
${'═'.repeat(80)}

📊 ESTATÍSTICAS:
• Linhas originais: ${result.originalLines}
• Linhas após remoção: ${result.newLines}
• Linhas removidas: ${result.removedLines}
• Rotas removidas: ${result.removedRoutes.length}
• Rotas mantidas: ${result.keptRoutes.length}

💾 BACKUP:
• Arquivo de backup: ${path.basename(backupPath)}
• Localização: ${backupPath}

✅ ROTAS REMOVIDAS (já modularizadas):
${result.removedRoutes.map((route, index) => 
    `${index + 1}. ${route.route}
   └─ Linhas ${route.startLine}-${route.endLine} (${route.linesCount} linhas)`
).join('\n')}

🔴 ROTAS MANTIDAS (complexas ou de sistema):
${result.keptRoutes.map((route, index) => `${index + 1}. ${route}`).join('\n')}

🎯 PRÓXIMOS PASSOS:
1. Testar a aplicação para garantir que tudo funciona
2. Executar testes automatizados: npm test
3. Verificar se todas as funcionalidades estão operacionais
4. Migrar as 9 rotas complexas restantes na Fase 4.2

⚠️  IMPORTANTE:
Se algo não funcionar, restaure o backup com:
cp "${backupPath}" "${SERVER_JS_PATH}"

Data: ${new Date().toISOString()}
Progresso da migração: 78% concluído
`;

    // Salvar relatório
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    
    const reportPath = path.join(LOGS_DIR, `route-removal-report-${Date.now()}.txt`);
    fs.writeFileSync(reportPath, report);
    
    console.log(report);
    console.log(`\n📄 Relatório salvo em: ${reportPath}`);
    
    return reportPath;
}

/**
 * Execução principal
 */
function main() {
    try {
        console.log('🔄 INICIANDO REMOÇÃO DE ROTAS DUPLICADAS - FASE 4.1');
        console.log('═'.repeat(60));
        
        // 1. Criar backup
        const backupPath = createBackup();
        
        // 2. Ler arquivo atual
        const originalContent = fs.readFileSync(SERVER_JS_PATH, 'utf8');
        
        // 3. Processar remoção
        console.log('\n🔍 Analisando rotas...');
        const result = processRemoval(originalContent);
        
        if (result.removedRoutes.length === 0) {
            console.log('ℹ️  Nenhuma rota duplicada encontrada para remoção.');
            return;
        }
        
        // 4. Adicionar comentários explicativos
        console.log('\n📝 Adicionando comentários explicativos...');
        const finalContent = addExplanatoryComments(result.newContent);
        
        // 5. Salvar arquivo modificado
        console.log('\n💾 Salvando arquivo otimizado...');
        fs.writeFileSync(SERVER_JS_PATH, finalContent);
        
        // 6. Gerar relatório
        console.log('\n📊 Gerando relatório...');
        generateReport(result, backupPath);
        
        console.log('\n🎉 REMOÇÃO CONCLUÍDA COM SUCESSO!');
        console.log(`✅ ${result.removedRoutes.length} rotas duplicadas removidas`);
        console.log(`📉 Arquivo reduzido em ${result.removedLines} linhas`);
        console.log("🚀 Sistema 78% migrado para arquitetura modular");
        
        console.log('\n🔧 PRÓXIMOS PASSOS:');
        console.log('1. Testar a aplicação: npm run dev');
        console.log('2. Executar testes: npm test');
        console.log('3. Verificar endpoints no frontend');
        
    } catch (error) {
        console.error('❌ Erro durante a remoção:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main, SAFE_TO_REMOVE_ROUTES };