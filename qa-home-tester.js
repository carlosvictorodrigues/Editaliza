// QA Script - Teste automatizado de elementos em home.html
// Executar no console do navegador após o mapeamento

(function() {
    console.log('🧪 QA - Iniciando testes automatizados...\n');
    
    if (!window.qaMapping) {
        console.error('❌ Execute primeiro o script qa-home-mapper.js');
        return;
    }
    
    const issues = [];
    let testIndex = 0;
    
    // Capturar erros do console
    const originalError = console.error;
    const originalWarn = console.warn;
    const consoleErrors = [];
    
    console.error = function() {
        const args = Array.from(arguments);
        consoleErrors.push({
            type: 'error',
            message: args.join(' '),
            timestamp: new Date().toISOString()
        });
        originalError.apply(console, arguments);
    };
    
    console.warn = function() {
        const args = Array.from(arguments);
        consoleErrors.push({
            type: 'warning',
            message: args.join(' '),
            timestamp: new Date().toISOString()
        });
        originalWarn.apply(console, arguments);
    };
    
    // Interceptar requisições de rede
    const originalFetch = window.fetch;
    const networkRequests = [];
    
    window.fetch = async function() {
        const url = arguments[0];
        const options = arguments[1] || {};
        const startTime = Date.now();
        
        try {
            const response = await originalFetch.apply(window, arguments);
            const endTime = Date.now();
            
            networkRequests.push({
                url: url,
                method: options.method || 'GET',
                status: response.status,
                statusText: response.statusText,
                duration: endTime - startTime,
                timestamp: new Date().toISOString(),
                ok: response.ok
            });
            
            if (!response.ok) {
                issues.push({
                    id: `NET-${issues.length + 1}`,
                    element: 'network',
                    symptom: `Request failed: ${options.method || 'GET'} ${url}`,
                    network: {
                        url: url,
                        status: response.status,
                        statusText: response.statusText
                    },
                    risk: response.status >= 500 ? 'alto' : 'médio'
                });
            }
            
            return response;
        } catch (error) {
            networkRequests.push({
                url: url,
                method: options.method || 'GET',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            issues.push({
                id: `NET-${issues.length + 1}`,
                element: 'network',
                symptom: `Network error: ${error.message}`,
                network: {
                    url: url,
                    error: error.message
                },
                risk: 'alto'
            });
            
            throw error;
        }
    };
    
    // Função para testar um elemento
    async function testElement(element) {
        console.log(`📋 Testando [${testIndex + 1}/${window.qaMapping.elements.length}]: ${element.selector}`);
        
        const beforeErrors = consoleErrors.length;
        const beforeRequests = networkRequests.length;
        
        try {
            const elem = document.querySelector(element.selector);
            if (!elem) {
                console.log(`   ⚠️ Elemento não encontrado: ${element.selector}`);
                return;
            }
            
            if (!elem.offsetParent && !element.selector.includes('modal')) {
                console.log(`   👻 Elemento invisível, pulando: ${element.selector}`);
                return;
            }
            
            // Simular interação baseada no tipo
            if (element.type === 'button' && !elem.disabled) {
                console.log(`   🖱️ Clicando botão: ${element.label}`);
                
                // Verificar se tem handler
                if (elem.onclick || elem.getAttribute('onclick')) {
                    elem.click();
                    await new Promise(resolve => setTimeout(resolve, 500)); // Aguardar possíveis animações
                } else {
                    console.log(`   ℹ️ Botão sem handler onclick`);
                }
                
            } else if (element.type === 'link' && element.href && !element.href.includes('#')) {
                console.log(`   🔗 Link detectado: ${element.href}`);
                // Não clicar em links que navegam para fora
                
            } else if (element.type === 'select' && !elem.disabled) {
                console.log(`   📝 Select detectado: ${element.id}`);
                // Apenas verificar se tem opções
                if (elem.options.length === 0) {
                    issues.push({
                        id: `UI-${issues.length + 1}`,
                        element: element.selector,
                        symptom: 'Select sem opções',
                        risk: 'baixo'
                    });
                }
            }
            
            // Verificar se gerou erros
            const newErrors = consoleErrors.slice(beforeErrors);
            const newRequests = networkRequests.slice(beforeRequests).filter(r => !r.ok);
            
            if (newErrors.length > 0) {
                newErrors.forEach(error => {
                    issues.push({
                        id: `JS-${issues.length + 1}`,
                        element: element.selector,
                        label: element.label,
                        symptom: `Console ${error.type}: ${error.message}`,
                        console: error.message,
                        risk: error.type === 'error' ? 'médio' : 'baixo'
                    });
                });
            }
            
            if (newRequests.length > 0) {
                newRequests.forEach(request => {
                    if (!request.ok && request.status !== 401) { // Ignorar 401 (não autenticado esperado)
                        issues.push({
                            id: `API-${issues.length + 1}`,
                            element: element.selector,
                            label: element.label,
                            symptom: `API error após clique`,
                            network: {
                                url: request.url,
                                status: request.status
                            },
                            risk: request.status >= 500 ? 'alto' : 'médio'
                        });
                    }
                });
            }
            
        } catch (error) {
            issues.push({
                id: `EX-${issues.length + 1}`,
                element: element.selector,
                label: element.label,
                symptom: `Exception: ${error.message}`,
                console: error.stack,
                risk: 'alto'
            });
        }
        
        testIndex++;
    }
    
    // Executar testes
    async function runTests() {
        console.log('🚀 Iniciando bateria de testes...\n');
        
        // Testar apenas botões visíveis primeiro
        const buttonsToTest = window.qaMapping.elements.filter(e => 
            e.type === 'button' && 
            e.visible !== false && 
            !e.disabled &&
            !e.selector.includes('modal') // Evitar modais por enquanto
        );
        
        for (const element of buttonsToTest) {
            await testElement(element);
            await new Promise(resolve => setTimeout(resolve, 300)); // Delay entre testes
        }
        
        // Restaurar console
        console.error = originalError;
        console.warn = originalWarn;
        window.fetch = originalFetch;
        
        // Gerar relatório
        const report = {
            page: '/home.html',
            timestamp: new Date().toISOString(),
            interactive_map: window.qaMapping.elements,
            issues: issues,
            summary: {
                total_elements: window.qaMapping.elements.length,
                tested_elements: testIndex,
                issues_found: issues.length,
                high_risk: issues.filter(i => i.risk === 'alto').length,
                medium_risk: issues.filter(i => i.risk === 'médio').length,
                low_risk: issues.filter(i => i.risk === 'baixo').length
            },
            console_errors: consoleErrors,
            network_requests: networkRequests
        };
        
        window.qaReport = report;
        
        console.log('\n📊 RELATÓRIO DE TESTES:');
        console.log('Elementos testados:', report.summary.tested_elements);
        console.log('Issues encontradas:', report.summary.issues_found);
        console.log('- Alto risco:', report.summary.high_risk);
        console.log('- Médio risco:', report.summary.medium_risk);
        console.log('- Baixo risco:', report.summary.low_risk);
        
        if (issues.length > 0) {
            console.log('\n🐛 ISSUES ENCONTRADAS:');
            console.table(issues);
        }
        
        console.log('\n✅ Relatório completo salvo em window.qaReport');
        console.log('Use JSON.stringify(window.qaReport, null, 2) para exportar');
        
        return report;
    }
    
    // Iniciar testes
    runTests();
})();