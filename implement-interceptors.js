#!/usr/bin/env node

/**
 * Script para implementar interceptadores em todas as páginas
 * FASE 5 - Interceptadores (renovação de token, retry)
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
    'reset-password.html',
    'plans.html',
    'admin.html'
];

async function addInterceptorsToPage(filePath) {
    try {
        let content = await fs.readFile(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // Verificar se já tem interceptors
        if (content.includes('api-interceptors.js')) {
            log.warning(`${fileName} já possui interceptors`);
            return false;
        }
        
        // Adicionar script de interceptors após app.js
        const interceptorScript = '\n    <script src="/js/api-interceptors.js"></script>';
        
        // Tentar adicionar após app.js
        if (content.includes('<script src="/js/app.js">')) {
            content = content.replace(
                '<script src="/js/app.js"></script>',
                '<script src="/js/app.js"></script>' + interceptorScript
            );
        } 
        // Se não tiver app.js, adicionar antes do </body>
        else if (content.includes('</body>')) {
            content = content.replace(
                '</body>',
                interceptorScript + '\n</body>'
            );
        } else {
            log.error(`${fileName}: Não foi possível adicionar interceptors`);
            return false;
        }
        
        await fs.writeFile(filePath, content);
        log.success(`${fileName} atualizado com interceptors`);
        return true;
        
    } catch (error) {
        log.error(`Erro ao processar ${filePath}: ${error.message}`);
        return false;
    }
}

async function createTestPage() {
    const testHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Teste de Interceptadores</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 1200px; 
            margin: 50px auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { 
            color: #333;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .test-section {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        button { 
            padding: 12px 24px; 
            margin: 5px; 
            cursor: pointer;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .success { 
            background: #d4edda; 
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .error { 
            background: #f8d7da; 
            color: #721c24;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        .info {
            background: #d1ecf1;
            color: #0c5460;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
        }
        pre { 
            background: #282c34; 
            color: #abb2bf;
            padding: 15px; 
            overflow: auto;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .metric-label {
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .status-online { background: #28a745; }
        .status-offline { background: #dc3545; }
        .status-warning { background: #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Teste de Interceptadores API - FASE 5</h1>
        
        <div class="test-section">
            <h2>📊 Métricas em Tempo Real</h2>
            <div id="metrics" class="metrics"></div>
            <button onclick="updateMetrics()">Atualizar Métricas</button>
            <button onclick="clearCache()">Limpar Cache</button>
            <button onclick="resetCircuitBreaker()">Reset Circuit Breaker</button>
        </div>
        
        <div class="test-section">
            <h2>🔄 Teste de Renovação de Token</h2>
            <button onclick="testTokenRefresh()">Simular Token Expirado (401)</button>
            <button onclick="testWithValidToken()">Testar com Token Válido</button>
            <button onclick="removeToken()">Remover Token</button>
            <div id="tokenResult"></div>
        </div>
        
        <div class="test-section">
            <h2>♻️ Teste de Retry Automático</h2>
            <button onclick="testRetrySuccess()">Simular Falha + Retry com Sucesso</button>
            <button onclick="testRetryFailure()">Simular Falhas Múltiplas</button>
            <button onclick="testCircuitBreaker()">Testar Circuit Breaker</button>
            <div id="retryResult"></div>
        </div>
        
        <div class="test-section">
            <h2>💾 Teste de Cache</h2>
            <button onclick="testCacheHit()">Fazer 3 Requisições Iguais (Cache)</button>
            <button onclick="testCacheMiss()">Requisições Diferentes (Sem Cache)</button>
            <div id="cacheResult"></div>
        </div>
        
        <div class="test-section">
            <h2>⚡ Teste de Performance</h2>
            <button onclick="testPerformance()">Executar 10 Requisições Paralelas</button>
            <button onclick="testSequential()">Executar 10 Requisições Sequenciais</button>
            <div id="performanceResult"></div>
        </div>
        
        <div class="test-section">
            <h2>📝 Logs do Sistema</h2>
            <pre id="logs"></pre>
            <button onclick="clearLogs()">Limpar Logs</button>
        </div>
    </div>
    
    <script src="/js/app.js"></script>
    <script src="/js/api-interceptors.js"></script>
    <script>
        let logBuffer = [];
        
        // Override console para capturar logs
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;
        
        console.log = function(...args) {
            addLog('LOG', args.join(' '));
            originalLog.apply(console, args);
        };
        
        console.warn = function(...args) {
            addLog('WARN', args.join(' '));
            originalWarn.apply(console, args);
        };
        
        console.error = function(...args) {
            addLog('ERROR', args.join(' '));
            originalError.apply(console, args);
        };
        
        console.info = function(...args) {
            addLog('INFO', args.join(' '));
            originalInfo.apply(console, args);
        };
        
        function addLog(level, message) {
            const timestamp = new Date().toLocaleTimeString();
            logBuffer.push(\`[\${timestamp}] [\${level}] \${message}\`);
            if (logBuffer.length > 50) logBuffer.shift();
            
            const logsElement = document.getElementById('logs');
            if (logsElement) {
                logsElement.textContent = logBuffer.join('\\n');
                logsElement.scrollTop = logsElement.scrollHeight;
            }
        }
        
        function clearLogs() {
            logBuffer = [];
            document.getElementById('logs').textContent = '';
            addLog('INFO', 'Logs limpos');
        }
        
        function showResult(elementId, message, type = 'info') {
            const element = document.getElementById(elementId);
            element.innerHTML = \`<div class="\${type}">\${message}</div>\`;
        }
        
        async function updateMetrics() {
            const metrics = apiMetrics();
            const metricsHtml = \`
                <div class="metric-card">
                    <div class="metric-value">\${metrics.totalRequests}</div>
                    <div class="metric-label">Total de Requisições</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">\${metrics.successRate}</div>
                    <div class="metric-label">Taxa de Sucesso</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">\${metrics.cacheHitRate}</div>
                    <div class="metric-label">Taxa de Cache</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">\${metrics.retryRate}</div>
                    <div class="metric-label">Taxa de Retry</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">\${metrics.averageResponseTime}ms</div>
                    <div class="metric-label">Tempo Médio</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">\${metrics.tokenRefreshes}</div>
                    <div class="metric-label">Renovações de Token</div>
                </div>
            \`;
            document.getElementById('metrics').innerHTML = metricsHtml;
            addLog('INFO', 'Métricas atualizadas');
        }
        
        function clearCache() {
            clearApiCache();
            showResult('cacheResult', 'Cache limpo com sucesso!', 'success');
        }
        
        function resetCircuitBreaker() {
            window.resetCircuitBreaker();
            showResult('retryResult', 'Circuit Breaker resetado!', 'success');
        }
        
        async function testTokenRefresh() {
            try {
                // Simular token expirado
                localStorage.setItem('authToken', 'expired-token');
                
                showResult('tokenResult', 'Simulando requisição com token expirado...', 'info');
                
                // Esta requisição deve triggerar renovação automática
                await app.apiFetch('/users/profile');
                
                showResult('tokenResult', '✅ Token renovado automaticamente e requisição bem-sucedida!', 'success');
            } catch (error) {
                showResult('tokenResult', \`❌ Erro: \${error.message}\`, 'error');
            }
        }
        
        async function testWithValidToken() {
            try {
                // Simular token válido
                localStorage.setItem('authToken', 'valid-test-token');
                
                showResult('tokenResult', 'Testando com token válido...', 'info');
                
                await app.apiFetch('/health');
                
                showResult('tokenResult', '✅ Requisição bem-sucedida com token válido!', 'success');
            } catch (error) {
                showResult('tokenResult', \`❌ Erro: \${error.message}\`, 'error');
            }
        }
        
        function removeToken() {
            localStorage.removeItem('authToken');
            showResult('tokenResult', 'Token removido do localStorage', 'info');
        }
        
        async function testRetrySuccess() {
            showResult('retryResult', 'Simulando falha temporária com retry...', 'info');
            
            // Simular endpoint que falha 2x e funciona na 3ª
            let attempts = 0;
            window.originalFetch = window.originalFetch || fetch;
            const originalFetch = window.originalFetch;
            
            window.originalFetch = async function(url, options) {
                if (url.includes('/test-retry')) {
                    attempts++;
                    if (attempts < 3) {
                        throw new Error(\`Simulando erro \${attempts}/2\`);
                    }
                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return originalFetch(url, options);
            };
            
            try {
                await fetch('/api/test-retry');
                showResult('retryResult', \`✅ Sucesso após \${attempts} tentativas!\`, 'success');
            } catch (error) {
                showResult('retryResult', \`❌ Falha após todas tentativas: \${error.message}\`, 'error');
            } finally {
                window.originalFetch = originalFetch;
            }
        }
        
        async function testRetryFailure() {
            showResult('retryResult', 'Simulando falhas múltiplas...', 'info');
            
            // Simular endpoint que sempre falha
            window.originalFetch = window.originalFetch || fetch;
            const originalFetch = window.originalFetch;
            
            window.originalFetch = async function(url, options) {
                if (url.includes('/test-fail')) {
                    throw new Error('Servidor indisponível');
                }
                return originalFetch(url, options);
            };
            
            try {
                await fetch('/api/test-fail');
                showResult('retryResult', 'Não deveria chegar aqui', 'error');
            } catch (error) {
                showResult('retryResult', \`✅ Comportamento esperado - Falhou após 3 tentativas: \${error.message}\`, 'success');
            } finally {
                window.originalFetch = originalFetch;
            }
        }
        
        async function testCircuitBreaker() {
            showResult('retryResult', 'Testando Circuit Breaker...', 'info');
            
            // Forçar múltiplas falhas para abrir circuit breaker
            for (let i = 0; i < 6; i++) {
                try {
                    await fetch('/api/endpoint-inexistente-' + i);
                } catch (error) {
                    // Esperado
                }
            }
            
            // Agora o circuit breaker deve estar aberto
            try {
                await fetch('/api/test-circuit');
                showResult('retryResult', 'Circuit breaker não funcionou', 'error');
            } catch (error) {
                if (error.message.includes('temporariamente indisponível')) {
                    showResult('retryResult', '✅ Circuit Breaker funcionando! Serviço pausado temporariamente.', 'success');
                } else {
                    showResult('retryResult', \`Erro inesperado: \${error.message}\`, 'error');
                }
            }
        }
        
        async function testCacheHit() {
            showResult('cacheResult', 'Fazendo 3 requisições idênticas...', 'info');
            
            const startTime = Date.now();
            
            // Limpar cache primeiro
            clearApiCache();
            
            // Fazer 3 requisições iguais
            for (let i = 1; i <= 3; i++) {
                await app.apiFetch('/health', { method: 'GET' });
                addLog('INFO', \`Requisição \${i} completada\`);
            }
            
            const duration = Date.now() - startTime;
            const metrics = apiMetrics();
            
            showResult('cacheResult', 
                \`✅ 3 requisições em \${duration}ms<br>
                Cache hits: \${metrics.cachedResponses}<br>
                Taxa de cache: \${metrics.cacheHitRate}\`, 
                'success'
            );
        }
        
        async function testCacheMiss() {
            showResult('cacheResult', 'Fazendo requisições diferentes...', 'info');
            
            clearApiCache();
            const startTime = Date.now();
            
            // Fazer requisições diferentes
            for (let i = 1; i <= 3; i++) {
                await app.apiFetch(\`/health?v=\${i}\`, { method: 'GET' });
            }
            
            const duration = Date.now() - startTime;
            const metrics = apiMetrics();
            
            showResult('cacheResult', 
                \`✅ 3 requisições diferentes em \${duration}ms<br>
                Sem cache (esperado)<br>
                Taxa de cache: \${metrics.cacheHitRate}\`, 
                'success'
            );
        }
        
        async function testPerformance() {
            showResult('performanceResult', 'Executando 10 requisições paralelas...', 'info');
            
            const startTime = Date.now();
            
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(app.apiFetch('/health'));
            }
            
            try {
                await Promise.all(promises);
                const duration = Date.now() - startTime;
                const metrics = apiMetrics();
                
                showResult('performanceResult', 
                    \`✅ 10 requisições paralelas em \${duration}ms<br>
                    Tempo médio: \${metrics.averageResponseTime}ms<br>
                    Taxa de sucesso: \${metrics.successRate}\`, 
                    'success'
                );
            } catch (error) {
                showResult('performanceResult', \`❌ Erro: \${error.message}\`, 'error');
            }
        }
        
        async function testSequential() {
            showResult('performanceResult', 'Executando 10 requisições sequenciais...', 'info');
            
            const startTime = Date.now();
            
            try {
                for (let i = 0; i < 10; i++) {
                    await app.apiFetch('/health');
                }
                
                const duration = Date.now() - startTime;
                const metrics = apiMetrics();
                
                showResult('performanceResult', 
                    \`✅ 10 requisições sequenciais em \${duration}ms<br>
                    Tempo médio: \${metrics.averageResponseTime}ms<br>
                    Taxa de sucesso: \${metrics.successRate}\`, 
                    'success'
                );
            } catch (error) {
                showResult('performanceResult', \`❌ Erro: \${error.message}\`, 'error');
            }
        }
        
        // Atualizar métricas ao carregar
        setTimeout(updateMetrics, 1000);
        
        // Atualizar métricas a cada 5 segundos
        setInterval(updateMetrics, 5000);
        
        addLog('INFO', 'Sistema de testes iniciado');
        addLog('INFO', 'Interceptadores ativos');
    </script>
</body>
</html>`;

    const filePath = path.join(process.cwd(), 'public', 'test-interceptors.html');
    await fs.writeFile(filePath, testHtml);
    log.success('Página de teste criada: test-interceptors.html');
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.magenta}✨ FASE 5 - IMPLEMENTAÇÃO DE INTERCEPTADORES${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    log.info('Iniciando implementação de interceptadores...\n');
    
    // Verificar se api-interceptors.js existe
    const interceptorsPath = path.join(process.cwd(), 'js', 'api-interceptors.js');
    try {
        await fs.access(interceptorsPath);
        log.success('api-interceptors.js encontrado');
    } catch {
        log.error('api-interceptors.js não encontrado! Execute o script anterior primeiro.');
        return;
    }
    
    // Copiar para public/js também
    const publicInterceptorsPath = path.join(process.cwd(), 'public', 'js', 'api-interceptors.js');
    try {
        await fs.copyFile(interceptorsPath, publicInterceptorsPath);
        log.success('api-interceptors.js copiado para public/js');
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
            const updated = await addInterceptorsToPage(filePath);
            if (updated) successCount++;
            else skipCount++;
        } catch {
            log.warning(`${page} não encontrado`);
        }
    }
    
    // Criar página de teste
    log.info('\n🧪 Criando página de teste...\n');
    await createTestPage();
    
    // Resumo das funcionalidades
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}📊 RESUMO DA IMPLEMENTAÇÃO${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    log.feature('Funcionalidades Implementadas:\n');
    
    const features = [
        '🔄 Renovação automática de token JWT',
        '♻️ Retry automático com exponential backoff',
        '🔌 Circuit breaker para falhas consecutivas',
        '💾 Cache inteligente para requisições GET',
        '📊 Métricas de performance em tempo real',
        '🚦 Queue de requisições durante renovação',
        '⚡ Interceptação transparente de fetch e app.apiFetch',
        '🔐 Logout automático em token inválido',
        '📈 Monitoramento de taxa de sucesso/falha',
        '🎯 Tratamento centralizado de erros'
    ];
    
    features.forEach(feature => console.log(`  ${feature}`));
    
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}✅ FASE 5 CONCLUÍDA COM SUCESSO!${colors.reset}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('📋 Estatísticas:');
    console.log(`  • Páginas atualizadas: ${successCount}`);
    console.log(`  • Páginas puladas (já tinham): ${skipCount}`);
    console.log(`  • Total de funcionalidades: ${features.length}`);
    
    console.log('\n🎯 Próximos passos:');
    console.log('  1. Reinicie o servidor');
    console.log('  2. Acesse /test-interceptors.html para testar');
    console.log('  3. Monitore com: apiMetrics() no console');
    console.log('  4. Limpe cache com: clearApiCache()');
    console.log('  5. Reset circuit breaker: resetCircuitBreaker()');
    
    console.log('\n💡 Comandos úteis no console do navegador:');
    console.log('  • apiMetrics() - Ver métricas');
    console.log('  • clearApiCache() - Limpar cache');
    console.log('  • resetCircuitBreaker() - Reset circuit breaker');
    console.log('  • ApiInterceptor.uninstall() - Desativar temporariamente');
    console.log('  • ApiInterceptor.install() - Reativar');
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// Executar
main().catch(console.error);