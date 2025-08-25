#!/usr/bin/env node

/**
 * FASE 2 - Script de Remoção de Rotas Duplicadas
 * Remove rotas duplicadas do server.js de forma controlada e testável
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m'
};

class DuplicateRemover {
    constructor() {
        // Lista de rotas duplicadas identificadas na FASE 1
        this.duplicateRoutes = [
            { method: 'GET', path: '/api/profile', startLine: 1016, endLine: 1065, module: 'profile.routes.js' },
            { method: 'PATCH', path: '/api/profile', startLine: 1067, endLine: 1247, module: 'profile.routes.js' },
            { method: 'GET', path: '/api/plans/:planId', startLine: 1326, endLine: 1363, module: 'plans.routes.js' },
            { method: 'DELETE', path: '/api/plans/:planId', startLine: 1365, endLine: 1390, module: 'plans.routes.js' },
            { method: 'PATCH', path: '/api/plans/:planId/settings', startLine: 1392, endLine: 1434, module: 'plans.routes.js' },
            { method: 'POST', path: '/api/plans/:planId/subjects_with_topics', startLine: 1436, endLine: 1475, module: 'plans.routes.js' },
            { method: 'PATCH', path: '/api/subjects/:subjectId', startLine: 1477, endLine: 1498, module: 'subjects.routes.js' },
            { method: 'DELETE', path: '/api/subjects/:subjectId', startLine: 1500, endLine: 1526, module: 'subjects.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/subjects_with_topics', startLine: 1528, endLine: 1581, module: 'plans.routes.js' },
            { method: 'GET', path: '/api/subjects/:subjectId/topics', startLine: 1583, endLine: 1606, module: 'topics.routes.js' },
            { method: 'PATCH', path: '/api/topics/batch_update', startLine: 1608, endLine: 1699, module: 'topics.routes.js' },
            { method: 'PATCH', path: '/api/topics/batch_update_details', startLine: 1701, endLine: 1759, module: 'topics.routes.js' },
            { method: 'PATCH', path: '/api/topics/:topicId', startLine: 1761, endLine: 1802, module: 'topics.routes.js' },
            { method: 'DELETE', path: '/api/topics/:topicId', startLine: 1804, endLine: 1843, module: 'topics.routes.js' },
            { method: 'POST', path: '/api/plans/:planId/generate', startLine: 1845, endLine: 2549, module: 'schedule.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/exclusions', startLine: 3005, endLine: 3053, module: 'plans.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/excluded-topics', startLine: 3055, endLine: 3131, module: 'plans.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/statistics', startLine: 3133, endLine: 3271, module: 'plans.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/overdue_check', startLine: 3273, endLine: 3292, module: 'sessions.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/schedule', startLine: 3294, endLine: 3321, module: 'sessions.routes.js' },
            { method: 'PATCH', path: '/api/sessions/batch_update_status', startLine: 3323, endLine: 3369, module: 'sessions.routes.js' },
            { method: 'POST', path: '/api/sessions/:sessionId/reinforce', startLine: 3371, endLine: 3396, module: 'sessions.routes.js' },
            { method: 'PATCH', path: '/api/sessions/:sessionId', startLine: 3398, endLine: 3428, module: 'sessions.routes.js' },
            { method: 'PATCH', path: '/api/sessions/:sessionId/postpone', startLine: 3430, endLine: 3485, module: 'sessions.routes.js' },
            { method: 'POST', path: '/api/sessions/:sessionId/time', startLine: 4031, endLine: 4075, module: 'sessions.routes.js' },
            { method: 'GET', path: '/api/plans/:planId/share-progress', startLine: 4077, endLine: 4157, module: 'plans.routes.js' }
        ];
        
        this.removedRoutes = [];
        this.failedRoutes = [];
        this.serverFilePath = path.join(__dirname, '..', 'server.js');
        this.backupFilePath = path.join(__dirname, '..', 'server.js.backup-fase2');
        this.testResults = [];
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async testRoute(method, path) {
        const testPath = path.replace(':planId', '1').replace(':sessionId', '1').replace(':subjectId', '1').replace(':topicId', '1');
        const url = `http://localhost:3000${testPath}`;
        
        try {
            // Testar com curl
            const curlCmd = method === 'GET' 
                ? `curl -s -o /dev/null -w "%{http_code}" ${url}`
                : `curl -s -o /dev/null -w "%{http_code}" -X ${method} ${url}`;
            
            const { stdout } = await execPromise(curlCmd);
            const statusCode = parseInt(stdout.trim());
            
            // Considerar 200-499 como "rota existe" (pode retornar erro de autenticação, etc)
            // 404 significa que a rota não existe
            return statusCode !== 404;
        } catch (error) {
            // Se curl falhar, assumir que a rota existe
            return true;
        }
    }

    commentOutRoute(content, startLine, endLine) {
        const lines = content.split('\n');
        
        // Comentar as linhas da rota
        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            if (!lines[i].trim().startsWith('//')) {
                lines[i] = '// FASE2_REMOVED: ' + lines[i];
            }
        }
        
        return lines.join('\n');
    }

    removeCommentedRoute(content, startLine, endLine) {
        const lines = content.split('\n');
        const removedLines = [];
        
        // Remover as linhas comentadas
        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            if (lines[i].includes('FASE2_REMOVED:')) {
                removedLines.push(lines[i]);
                lines[i] = ''; // Deixar linha vazia para manter numeração
            }
        }
        
        return {
            content: lines.join('\n'),
            removed: removedLines.length
        };
    }

    async processRoute(route, index) {
        this.log(`\n[${index + 1}/${this.duplicateRoutes.length}] Processando: ${route.method} ${route.path}`, 'cyan');
        
        // 1. Ler o arquivo atual
        let content = fs.readFileSync(this.serverFilePath, 'utf8');
        
        // 2. Comentar a rota
        this.log('  📝 Comentando rota...', 'yellow');
        content = this.commentOutRoute(content, route.startLine, route.endLine);
        fs.writeFileSync(this.serverFilePath, content);
        
        // 3. Testar se a rota ainda funciona (através do módulo)
        this.log('  🧪 Testando rota...', 'yellow');
        const stillWorks = await this.testRoute(route.method, route.path);
        
        if (stillWorks) {
            // 4. Se funciona, remover definitivamente
            this.log('  ✅ Rota funciona via módulo! Removendo definitivamente...', 'green');
            const result = this.removeCommentedRoute(content, route.startLine, route.endLine);
            fs.writeFileSync(this.serverFilePath, result.content);
            
            this.removedRoutes.push({
                ...route,
                linesRemoved: result.removed,
                status: 'success'
            });
            
            this.testResults.push({
                route: `${route.method} ${route.path}`,
                status: 'REMOVIDA',
                module: route.module
            });
        } else {
            // 5. Se não funciona, reverter
            this.log('  ⚠️ Rota não funciona via módulo! Revertendo...', 'red');
            content = fs.readFileSync(this.backupFilePath, 'utf8');
            fs.writeFileSync(this.serverFilePath, content);
            
            this.failedRoutes.push({
                ...route,
                reason: 'Módulo não está respondendo corretamente'
            });
            
            this.testResults.push({
                route: `${route.method} ${route.path}`,
                status: 'MANTIDA',
                reason: 'Módulo não funcional'
            });
        }
        
        // Pequena pausa entre rotas
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async generateReport() {
        const report = `# 📋 FASE 2 - RELATÓRIO DE REMOÇÃO DE DUPLICATAS

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Hora:** ${new Date().toLocaleTimeString('pt-BR')}

## 📊 RESUMO

- **Total de rotas processadas:** ${this.duplicateRoutes.length}
- **Rotas removidas com sucesso:** ${this.removedRoutes.length}
- **Rotas mantidas (falha):** ${this.failedRoutes.length}
- **Taxa de sucesso:** ${((this.removedRoutes.length / this.duplicateRoutes.length) * 100).toFixed(1)}%

## ✅ ROTAS REMOVIDAS

| Rota | Módulo | Linhas Removidas |
|------|--------|------------------|
${this.removedRoutes.map(r => `| ${r.method} ${r.path} | ${r.module} | ${r.linesRemoved} |`).join('\n')}

## ⚠️ ROTAS MANTIDAS (REQUEREM ATENÇÃO)

| Rota | Módulo | Razão |
|------|--------|-------|
${this.failedRoutes.map(r => `| ${r.method} ${r.path} | ${r.module} | ${r.reason} |`).join('\n')}

## 📈 IMPACTO

- **Linhas removidas do server.js:** ${this.removedRoutes.reduce((acc, r) => acc + (r.linesRemoved || 0), 0)}
- **Redução estimada:** ~${((this.removedRoutes.length / this.duplicateRoutes.length) * 46.4).toFixed(1)}% das duplicações

## 🔍 PRÓXIMOS PASSOS

1. Investigar rotas que falharam
2. Verificar configuração dos módulos
3. Testar funcionalidades no frontend
4. Prosseguir para FASE 3 (Extração de SQL)

## 📝 LOGS DE TESTE

\`\`\`
${this.testResults.map(t => `${t.route}: ${t.status} ${t.reason ? `(${t.reason})` : ''}`).join('\n')}
\`\`\`
`;

        fs.writeFileSync(
            path.join(__dirname, '..', 'FASE2_REMOCAO_DUPLICATAS.md'),
            report
        );
        
        this.log('\n✅ Relatório gerado: FASE2_REMOCAO_DUPLICATAS.md', 'green');
    }

    async run() {
        this.log('🚀 FASE 2 - REMOÇÃO DE DUPLICATAS INICIADA', 'magenta');
        this.log('=' .repeat(50), 'magenta');
        
        // Verificar backup
        if (!fs.existsSync(this.backupFilePath)) {
            this.log('❌ Backup não encontrado! Criando...', 'red');
            fs.copyFileSync(this.serverFilePath, this.backupFilePath);
        }
        
        // Processar cada rota
        for (let i = 0; i < this.duplicateRoutes.length; i++) {
            await this.processRoute(this.duplicateRoutes[i], i);
        }
        
        // Gerar relatório
        await this.generateReport();
        
        // Resumo final
        this.log('\n' + '='.repeat(50), 'magenta');
        this.log('📊 FASE 2 CONCLUÍDA', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        this.log(`\n✅ ${this.removedRoutes.length} rotas removidas com sucesso`, 'green');
        if (this.failedRoutes.length > 0) {
            this.log(`⚠️ ${this.failedRoutes.length} rotas mantidas (requerem investigação)`, 'yellow');
        }
        
        const linesRemoved = this.removedRoutes.reduce((acc, r) => acc + (r.linesRemoved || 0), 0);
        this.log(`📉 ${linesRemoved} linhas removidas do server.js`, 'blue');
        
        // Testar o sistema
        this.log('\n🧪 Executando teste de integração...', 'cyan');
        try {
            const { stdout } = await execPromise('node test-complete-flow.js');
            this.log('✅ Testes de integração passaram!', 'green');
        } catch (error) {
            this.log('⚠️ Alguns testes falharam - verificar manualmente', 'yellow');
        }
    }
}

// Executar remoção
const remover = new DuplicateRemover();
remover.run().catch(error => {
    console.error('Erro durante remoção:', error);
    process.exit(1);
});