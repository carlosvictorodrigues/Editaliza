#!/usr/bin/env node

/**
 * Script para implementar sistema de tratamento de erros
 * FASE 6 - Sistema padronizado de tratamento de erros
 */

const fs = require('fs').promises;
const path = require('path');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.error(`${colors.red}❌${colors.reset} ${msg}`),
    feature: (msg) => console.log(`${colors.magenta}✨${colors.reset} ${msg}`)
};

// Páginas principais para atualizar
const targetPages = [
    'home.html',
    'cronograma.html',
    'profile.html',
    'dashboard.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'reset-password.html'
];

async function addErrorHandlerToPage(filePath) {
    try {
        let content = await fs.readFile(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Verificar se já tem error handler
        if (content.includes('error-handler.js')) {
            log.warning(`${fileName} já possui error handler`);
            return false;
        }
        
        // Adicionar script de error handler após interceptors ou app.js
        const errorHandlerScript = '\n    <script src="/js/error-handler.js"></script>';
        
        // Tentar adicionar após interceptors
        if (content.includes('api-interceptors.js')) {
            content = content.replace(
                '<script src="/js/api-interceptors.js"></script>',
                '<script src="/js/api-interceptors.js"></script>' + errorHandlerScript
            );
        }
        // Ou após app.js
        else if (content.includes('<script src="/js/app.js">')) {
            content = content.replace(
                '<script src="/js/app.js"></script>',
                '<script src="/js/app.js"></script>' + errorHandlerScript
            );
        }
        // Ou antes do </body>
        else if (content.includes('</body>')) {
            content = content.replace(
                '</body>',
                errorHandlerScript + '\n</body>'
            );
        } else {
            log.error(`${fileName}: Não foi possível adicionar error handler`);
            return false;
        }
        
        await fs.writeFile(filePath, content);
        log.success(`${fileName} atualizado com error handler`);
        return true;
        
    } catch (error) {
        log.error(`Erro ao processar ${filePath}: ${error.message}`);
        return false;
    }
}

async function createDemoPage() {
    const demoHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Demo - Sistema de Tratamento de Erros</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        h1 { 
            color: #333;
            margin-bottom: 10px;
            font-size: 32px;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 16px;
        }
        
        .demo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-top: 30px;
        }
        
        .demo-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
        }
        
        .demo-section h2 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .button-group {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            color: white;
            flex: 1;
            min-width: 140px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .btn-error {
            background: linear-gradient(135deg, #f5365c 0%, #d62149 100%);
        }
        
        .btn-warning {
            background: linear-gradient(135deg, #fb6340 0%, #ea5126 100%);
        }
        
        .btn-success {
            background: linear-gradient(135deg, #2dce89 0%, #26a06c 100%);
        }
        
        .btn-info {
            background: linear-gradient(135deg, #11cdef 0%, #0da5c8 100%);
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #dee2e6;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-label {
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }
        
        .console-output {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            min-height: 200px;
            max-height: 400px;
            overflow-y: auto;
            margin-top: 20px;
        }
        
        .log-entry {
            margin: 5px 0;
            padding: 5px;
            border-left: 3px solid #444;
        }
        
        .log-error { border-left-color: #f5365c; }
        .log-warning { border-left-color: #fb6340; }
        .log-success { border-left-color: #2dce89; }
        .log-info { border-left-color: #11cdef; }
        
        .feature-list {
            list-style: none;
            margin-top: 20px;
        }
        
        .feature-list li {
            padding: 10px;
            margin: 5px 0;
            background: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .feature-icon {
            font-size: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ Sistema de Tratamento de Erros</h1>
        <p class="subtitle">FASE 6 - Demonstração de funcionalidades</p>
        
        <div class="demo-grid">
            <!-- Notificações -->
            <div class="demo-section">
                <h2>📢 Notificações Visuais</h2>
                <div class="button-group">
                    <button class="btn-success" onclick="testSuccess()">Sucesso</button>
                    <button class="btn-error" onclick="testError()">Erro</button>
                    <button class="btn-warning" onclick="testWarning()">Aviso</button>
                    <button class="btn-info" onclick="testInfo()">Info</button>
                </div>
            </div>
            
            <!-- Erros de Autenticação -->
            <div class="demo-section">
                <h2>🔐 Erros de Autenticação</h2>
                <div class="button-group">
                    <button class="btn-error" onclick="testAuthError('AUTH_TOKEN_EXPIRED')">Token Expirado</button>
                    <button class="btn-error" onclick="testAuthError('INVALID_CREDENTIALS')">Credenciais Inválidas</button>
                    <button class="btn-error" onclick="testAuthError('PERMISSION_DENIED')">Sem Permissão</button>
                </div>
            </div>
            
            <!-- Erros de Validação -->
            <div class="demo-section">
                <h2>✅ Erros de Validação</h2>
                <div class="button-group">
                    <button class="btn-warning" onclick="testValidationError('INVALID_EMAIL')">Email Inválido</button>
                    <button class="btn-warning" onclick="testValidationError('REQUIRED_FIELD')">Campo Obrigatório</button>
                    <button class="btn-warning" onclick="testValidationError('DUPLICATE_EMAIL')">Email Duplicado</button>
                </div>
            </div>
            
            <!-- Erros de Rede -->
            <div class="demo-section">
                <h2>🌐 Erros de Rede</h2>
                <div class="button-group">
                    <button class="btn-error" onclick="testNetworkError('NETWORK_ERROR')">Erro de Conexão</button>
                    <button class="btn-error" onclick="testNetworkError('TIMEOUT')">Timeout</button>
                    <button class="btn-warning" onclick="testNetworkError('OFFLINE')">Offline</button>
                </div>
            </div>
            
            <!-- Erros de Servidor -->
            <div class="demo-section">
                <h2>🔧 Erros de Servidor</h2>
                <div class="button-group">
                    <button class="btn-error" onclick="testServerError('INTERNAL_ERROR')">Erro Interno</button>
                    <button class="btn-error" onclick="testServerError('DATABASE_ERROR')">Erro de Banco</button>
                    <button class="btn-warning" onclick="testServerError('SERVICE_UNAVAILABLE')">Serviço Indisponível</button>
                </div>
            </div>
            
            <!-- Múltiplas Notificações -->
            <div class="demo-section">
                <h2>🔥 Teste de Stress</h2>
                <div class="button-group">
                    <button class="btn-primary" onclick="testMultiple()">5 Notificações</button>
                    <button class="btn-primary" onclick="testRapidFire()">Rapid Fire</button>
                    <button class="btn-primary" onclick="testMixed()">Mix de Tipos</button>
                </div>
            </div>
            
            <!-- Estatísticas -->
            <div class="demo-section">
                <h2>📊 Estatísticas</h2>
                <div class="stats-grid" id="stats">
                    <div class="stat-card">
                        <div class="stat-value" id="totalErrors">0</div>
                        <div class="stat-label">Total de Erros</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="errorTypes">0</div>
                        <div class="stat-label">Tipos de Erro</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="recentErrors">0</div>
                        <div class="stat-label">Erros Recentes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="recoveries">0</div>
                        <div class="stat-label">Recuperações</div>
                    </div>
                </div>
                <div class="button-group" style="margin-top: 15px;">
                    <button class="btn-info" onclick="updateStats()">Atualizar</button>
                    <button class="btn-warning" onclick="clearHistory()">Limpar</button>
                </div>
            </div>
            
            <!-- Funcionalidades -->
            <div class="demo-section">
                <h2>✨ Funcionalidades</h2>
                <ul class="feature-list">
                    <li><span class="feature-icon">🎨</span> Notificações elegantes com gradientes</li>
                    <li><span class="feature-icon">🔄</span> Auto-dismiss após 5 segundos</li>
                    <li><span class="feature-icon">📝</span> Tradução de códigos de erro</li>
                    <li><span class="feature-icon">🔐</span> Redirecionamento em token expirado</li>
                    <li><span class="feature-icon">📊</span> Histórico de erros para debug</li>
                    <li><span class="feature-icon">🚀</span> Integração com interceptadores</li>
                    <li><span class="feature-icon">💾</span> Persistência em localStorage</li>
                    <li><span class="feature-icon">🎯</span> Recuperação automática</li>
                </ul>
            </div>
        </div>
        
        <!-- Console Output -->
        <div class="demo-section" style="margin-top: 30px;">
            <h2>🖥️ Console de Debug</h2>
            <div class="console-output" id="console">
                <div class="log-entry log-info">Sistema de tratamento de erros iniciado...</div>
            </div>
            <div class="button-group" style="margin-top: 15px;">
                <button class="btn-info" onclick="showReport()">Ver Relatório</button>
                <button class="btn-warning" onclick="clearConsole()">Limpar Console</button>
            </div>
        </div>
    </div>
    
    <script src="/js/app.js"></script>
    <script src="/js/api-interceptors.js"></script>
    <script src="/js/error-handler.js"></script>
    <script>
        let recoveryCount = 0;
        
        function addToConsole(message, type = 'info') {
            const console = document.getElementById('console');
            const entry = document.createElement('div');
            entry.className = \`log-entry log-\${type}\`;
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            console.appendChild(entry);
            console.scrollTop = console.scrollHeight;
        }
        
        function testSuccess() {
            showSuccess('Operação realizada com sucesso! 🎉');
            addToConsole('Notificação de sucesso exibida', 'success');
        }
        
        function testError() {
            showError('Ocorreu um erro ao processar a requisição');
            addToConsole('Notificação de erro exibida', 'error');
        }
        
        function testWarning() {
            showWarning('Atenção: Alguns campos precisam ser revisados');
            addToConsole('Notificação de aviso exibida', 'warning');
        }
        
        function testInfo() {
            showInfo('Dica: Você pode usar Ctrl+S para salvar');
            addToConsole('Notificação informativa exibida', 'info');
        }
        
        function testAuthError(code) {
            const error = { code, type: 'auth' };
            window.errorHandler.handleError(error);
            addToConsole(\`Erro de autenticação: \${code}\`, 'error');
            
            if (code === 'AUTH_TOKEN_EXPIRED') {
                addToConsole('Recuperação: Redirecionamento para login em 2s...', 'warning');
                setTimeout(() => {
                    addToConsole('Redirecionamento cancelado (demo)', 'info');
                    recoveryCount++;
                    updateStats();
                }, 2000);
            }
        }
        
        function testValidationError(code) {
            const error = { code, type: 'validation' };
            window.errorHandler.handleError(error);
            addToConsole(\`Erro de validação: \${code}\`, 'warning');
        }
        
        function testNetworkError(code) {
            const error = { code, type: 'network' };
            window.errorHandler.handleError(error);
            addToConsole(\`Erro de rede: \${code}\`, 'error');
            
            if (code === 'OFFLINE') {
                addToConsole('Monitorando reconexão...', 'info');
                recoveryCount++;
                updateStats();
            }
        }
        
        function testServerError(code) {
            const error = { code, type: 'server' };
            window.errorHandler.handleError(error);
            addToConsole(\`Erro de servidor: \${code}\`, 'error');
            
            if (code === 'SERVICE_UNAVAILABLE') {
                addToConsole('Tentativa de reconexão agendada para 10s', 'info');
                recoveryCount++;
                updateStats();
            }
        }
        
        function testMultiple() {
            addToConsole('Enviando 5 notificações...', 'info');
            setTimeout(() => showError('Erro 1: Falha na conexão'), 0);
            setTimeout(() => showWarning('Aviso 2: Campo obrigatório'), 500);
            setTimeout(() => showInfo('Info 3: Processando...'), 1000);
            setTimeout(() => showSuccess('Sucesso 4: Salvo!'), 1500);
            setTimeout(() => showError('Erro 5: Timeout'), 2000);
            addToConsole('5 notificações enviadas (máximo de 3 visíveis)', 'info');
        }
        
        function testRapidFire() {
            addToConsole('Rapid fire: 10 notificações instantâneas', 'info');
            for (let i = 1; i <= 10; i++) {
                const types = ['error', 'warning', 'info', 'success'];
                const type = types[Math.floor(Math.random() * types.length)];
                const messages = {
                    error: \`Erro #\${i}: Falha no processamento\`,
                    warning: \`Aviso #\${i}: Verifique os dados\`,
                    info: \`Info #\${i}: Processando item\`,
                    success: \`Sucesso #\${i}: Item salvo\`
                };
                
                if (type === 'error') showError(messages[type]);
                else if (type === 'warning') showWarning(messages[type]);
                else if (type === 'info') showInfo(messages[type]);
                else showSuccess(messages[type]);
            }
            addToConsole('Limite de 3 notificações simultâneas aplicado', 'warning');
        }
        
        function testMixed() {
            addToConsole('Testando mix de tipos de erro', 'info');
            
            // Simular diferentes cenários
            showError('Erro de autenticação detectado');
            setTimeout(() => {
                showWarning('Tentando renovar token...');
            }, 1000);
            setTimeout(() => {
                showSuccess('Token renovado com sucesso!');
            }, 2500);
            setTimeout(() => {
                showInfo('Requisição reprocessada');
            }, 3500);
            
            addToConsole('Simulação de recuperação de erro iniciada', 'success');
        }
        
        function updateStats() {
            const report = ErrorHandler.getReport();
            document.getElementById('totalErrors').textContent = report.stats.total;
            document.getElementById('errorTypes').textContent = Object.keys(report.stats.byType).length;
            document.getElementById('recentErrors').textContent = report.stats.recent.length;
            document.getElementById('recoveries').textContent = recoveryCount;
            addToConsole('Estatísticas atualizadas', 'info');
        }
        
        function clearHistory() {
            ErrorHandler.clearHistory();
            recoveryCount = 0;
            updateStats();
            addToConsole('Histórico de erros limpo', 'warning');
        }
        
        function showReport() {
            const report = ErrorHandler.getReport();
            console.log('📊 Relatório Completo:', report);
            addToConsole('Relatório completo exibido no console do navegador (F12)', 'info');
            
            // Mostrar resumo no console da página
            if (report.stats.total > 0) {
                addToConsole(\`Total de erros: \${report.stats.total}\`, 'info');
                Object.entries(report.stats.byType).forEach(([type, count]) => {
                    addToConsole(\`  • \${type}: \${count} erros\`, 'info');
                });
            } else {
                addToConsole('Nenhum erro registrado ainda', 'info');
            }
        }
        
        function clearConsole() {
            const console = document.getElementById('console');
            console.innerHTML = '<div class="log-entry log-info">Console limpo...</div>';
        }
        
        // Atualizar stats periodicamente
        setInterval(updateStats, 5000);
        
        // Mensagem inicial
        setTimeout(() => {
            addToConsole('Sistema pronto! Clique nos botões para testar.', 'success');
        }, 500);
    </script>
</body>
</html>`;

    const filePath = path.join(process.cwd(), 'public', 'error-handler-demo.html');
    await fs.writeFile(filePath, demoHtml);
    log.success('Página de demonstração criada: error-handler-demo.html');
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.magenta}🛡️ FASE 6 - SISTEMA DE TRATAMENTO DE ERROS${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    log.info('Iniciando implementação do sistema de tratamento de erros...\n');
    
    // Verificar se error-handler.js existe
    const errorHandlerPath = path.join(process.cwd(), 'js', 'error-handler.js');
    try {
        await fs.access(errorHandlerPath);
        log.success('error-handler.js encontrado');
    } catch {
        log.error('error-handler.js não encontrado!');
        return;
    }
    
    // Copiar para public/js também
    const publicErrorHandlerPath = path.join(process.cwd(), 'public', 'js', 'error-handler.js');
    try {
        await fs.copyFile(errorHandlerPath, publicErrorHandlerPath);
        log.success('error-handler.js copiado para public/js');
    } catch (error) {
        log.warning('Não foi possível copiar para public/js: ' + error.message);
    }
    
    // Processar páginas
    log.info('\n📄 Atualizando páginas HTML...\n');
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const page of targetPages) {
        const filePath = path.join(process.cwd(), 'public', page);
        
        try {
            await fs.access(filePath);
            const updated = await addErrorHandlerToPage(filePath);
            if (updated) successCount++;
            else skipCount++;
        } catch {
            log.warning(`${page} não encontrado`);
        }
    }
    
    // Criar página de demonstração
    log.info('\n🎨 Criando página de demonstração...\n');
    await createDemoPage();
    
    // Resumo das funcionalidades
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}📊 RESUMO DA IMPLEMENTAÇÃO${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    log.feature('Funcionalidades Implementadas:\n');
    
    const features = [
        '🎨 Notificações visuais elegantes com gradientes',
        '📝 Tradução automática de códigos de erro',
        '🔄 Auto-dismiss configurável (5 segundos)',
        '📊 Histórico completo de erros para debug',
        '💾 Persistência de erros em localStorage',
        '🚀 Integração com interceptadores e app.js',
        '🔐 Recuperação automática em erros de auth',
        '📡 Detecção de status online/offline',
        '🎯 Tratamento específico por tipo de erro',
        '🛡️ Captura global de erros não tratados',
        '📈 Relatórios e estatísticas de erros',
        '🔧 API simples: showSuccess, showError, etc'
    ];
    
    features.forEach(feature => console.log(`  ${feature}`));
    
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}✅ FASE 6 CONCLUÍDA COM SUCESSO!${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('📋 Estatísticas:');
    console.log(`  • Páginas atualizadas: ${successCount}`);
    console.log(`  • Páginas puladas: ${skipCount}`);
    console.log(`  • Total de funcionalidades: ${features.length}`);
    
    console.log('\n🎯 Próximos passos:');
    console.log('  1. Reinicie o servidor');
    console.log('  2. Acesse /error-handler-demo.html para demonstração');
    console.log('  3. Use as funções globais em qualquer página:');
    console.log('     • showSuccess("Mensagem")');
    console.log('     • showError("Mensagem")');
    console.log('     • showWarning("Mensagem")');
    console.log('     • showInfo("Mensagem")');
    
    console.log('\n💡 API do Error Handler:');
    console.log('  • ErrorHandler.success(msg) - Notificação de sucesso');
    console.log('  • ErrorHandler.error(msg) - Notificação de erro');
    console.log('  • ErrorHandler.warning(msg) - Notificação de aviso');
    console.log('  • ErrorHandler.info(msg) - Notificação informativa');
    console.log('  • ErrorHandler.getHistory() - Ver histórico de erros');
    console.log('  • ErrorHandler.getReport() - Relatório completo');
    console.log('  • ErrorHandler.clearHistory() - Limpar histórico');
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// Executar
main().catch(console.error);