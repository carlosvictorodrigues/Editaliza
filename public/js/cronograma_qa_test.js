// Script de teste QA para cronograma.html
// Executa análise completa da página

console.log('🔍 INICIANDO ANÁLISE QA DE CRONOGRAMA.HTML');
console.log('='.'repeat(50));

// Capturar erros globais
const originalError = console.error;
const errors = [];
console.error = function(...args) {
    errors.push({
        type: 'console.error',
        message: args.join(' '),
        timestamp: new Date().toISOString(),
        stack: new Error().stack
    });
    originalError.apply(console, args);
};

// Monitorar requisições de rede
const originalFetch = window.fetch;
const networkRequests = [];
window.fetch = async function(...args) {
    const startTime = Date.now();
    const url = args[0];
    
    try {
        const response = await originalFetch.apply(this, args);
        const duration = Date.now() - startTime;
        
        networkRequests.push({
            url: url,
            method: args[1]?.method || 'GET',
            status: response.status,
            ok: response.ok,
            duration: duration,
            timestamp: new Date().toISOString()
        });
        
        if (!response.ok) {
            console.warn(`❌ Requisição falhou: ${url} - Status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        networkRequests.push({
            url: url,
            method: args[1]?.method || 'GET',
            error: error.message,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
};

// Função para verificar caracteres corrompidos
function checkCorruptedCharacters() {
    const issues = [];
    const textNodes = [];
    
    // Coletar todos os nós de texto
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim()) {
            textNodes.push(node);
        }
    }
    
    // Procurar por caracteres problemáticos
    const corruptedPatterns = [
        /[ÃƒÂ¢â‚¬â„¢]/g,  // Caracteres UTF-8 mal codificados
        /�/g,              // Replacement character
        /[!¿]/g,           // Possíveis erros de encoding
        /â€[œ™]/g,         // Aspas mal codificadas
        /Ã§Ã£/g,           // ç e ã mal codificados
        /[ÒÓ](?![a-zA-Z])/g  // Caracteres especiais isolados
    ];
    
    textNodes.forEach(node => {
        const text = node.nodeValue;
        corruptedPatterns.forEach(pattern => {
            if (pattern.test(text)) {
                const parent = node.parentElement;
                issues.push({
                    element: parent ? parent.tagName + (parent.id ? '#' + parent.id : '') : 'TEXT_NODE',
                    text: text.substring(0, 100),
                    pattern: pattern.toString(),
                    location: parent ? getElementPath(parent) : 'unknown'
                });
            }
        });
    });
    
    return issues;
}

// Função para obter o caminho do elemento
function getElementPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let selector = element.tagName.toLowerCase();
        if (element.id) {
            selector += '#' + element.id;
            path.unshift(selector);
            break;
        } else if (element.className) {
            selector += '.' + element.className.split(' ').join('.');
        }
        path.unshift(selector);
        element = element.parentElement;
    }
    return path.join(' > ');
}

// Função para testar elementos interativos
function testInteractiveElements() {
    const results = [];
    
    // Lista de elementos para testar
    const elementsToTest = [
        { selector: '.filter-btn', event: 'click' },
        { selector: '#exportButton', event: 'click' },
        { selector: '#cancelPostponeButton', event: 'click' },
        { selector: '#downloadIcsButton', event: 'click' },
        { selector: '#closeCalendarModalButton', event: 'click' },
        { selector: '#viewFullReportBtn', event: 'click' },
        { selector: '#exportExclusionsBtn', event: 'click' },
        { selector: '#toggleTransparencyBtn', event: 'click' },
        { selector: '#replanButton', event: 'click' },
        { selector: 'input[type="checkbox"]', event: 'change' },
        { selector: 'button[onclick*="postpone"]', event: 'click' },
        { selector: 'button[onclick*="reinforce"]', event: 'click' }
    ];
    
    elementsToTest.forEach(test => {
        const elements = document.querySelectorAll(test.selector);
        
        if (elements.length === 0) {
            results.push({
                selector: test.selector,
                status: 'NOT_FOUND',
                message: 'Elemento não encontrado no DOM'
            });
        } else {
            elements.forEach((element, index) => {
                try {
                    // Verificar se tem listener
                    const hasListener = element.onclick || 
                                      element.getAttribute('onclick') || 
                                      element.dataset.action ||
                                      getEventListeners(element)[test.event];
                    
                    // Verificar se está visível
                    const isVisible = element.offsetParent !== null;
                    
                    // Verificar se está habilitado
                    const isEnabled = !element.disabled;
                    
                    results.push({
                        selector: test.selector + (elements.length > 1 ? `[${index}]` : ''),
                        status: 'FOUND',
                        hasListener: !!hasListener,
                        isVisible: isVisible,
                        isEnabled: isEnabled,
                        text: element.textContent?.trim().substring(0, 50)
                    });
                    
                } catch (error) {
                    results.push({
                        selector: test.selector,
                        status: 'ERROR',
                        error: error.message
                    });
                }
            });
        }
    });
    
    return results;
}

// Função auxiliar para obter event listeners (Chrome DevTools)
function getEventListeners(element) {
    // Esta função só funciona no Chrome DevTools
    if (typeof window.getEventListeners === 'function') {
        return window.getEventListeners(element);
    }
    return {};
}

// Função para verificar requisições de API
async function checkAPIEndpoints() {
    const endpoints = [
        '/api/plans/1',
        '/api/sessions/overdue-check/',
        '/api/sessions/by-date/1',
        '/api/plans/1/exclusions'
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('editaliza_token')
                }
            });
            
            results.push({
                endpoint: endpoint,
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });
        } catch (error) {
            results.push({
                endpoint: endpoint,
                error: error.message
            });
        }
    }
    
    return results;
}

// Executar análise completa
async function runFullAnalysis() {
    console.log('\n📋 1. VERIFICANDO CARACTERES CORROMPIDOS...');
    const corruptedChars = checkCorruptedCharacters();
    if (corruptedChars.length > 0) {
        console.error('❌ Caracteres corrompidos encontrados:', corruptedChars);
    } else {
        console.log('✅ Nenhum caractere corrompido detectado');
    }
    
    console.log('\n🔘 2. TESTANDO ELEMENTOS INTERATIVOS...');
    const interactiveResults = testInteractiveElements();
    const problematicElements = interactiveResults.filter(r => 
        r.status === 'NOT_FOUND' || 
        r.status === 'ERROR' || 
        (r.status === 'FOUND' && (!r.hasListener || !r.isVisible || !r.isEnabled))
    );
    
    if (problematicElements.length > 0) {
        console.error('❌ Problemas em elementos interativos:', problematicElements);
    } else {
        console.log('✅ Todos elementos interativos funcionais');
    }
    
    console.log('\n🌐 3. VERIFICANDO ENDPOINTS DE API...');
    const apiResults = await checkAPIEndpoints();
    const failedAPIs = apiResults.filter(r => !r.ok || r.error);
    
    if (failedAPIs.length > 0) {
        console.error('❌ APIs com problemas:', failedAPIs);
    } else {
        console.log('✅ Todas APIs respondendo corretamente');
    }
    
    console.log('\n⚠️ 4. ERROS DE CONSOLE CAPTURADOS:');
    if (errors.length > 0) {
        console.error('❌ Erros encontrados:', errors);
    } else {
        console.log('✅ Nenhum erro de console');
    }
    
    console.log('\n📊 5. REQUISIÇÕES DE REDE:');
    const failedRequests = networkRequests.filter(r => !r.ok || r.error);
    if (failedRequests.length > 0) {
        console.error('❌ Requisições falhadas:', failedRequests);
    } else {
        console.log('✅ Todas requisições bem-sucedidas');
    }
    
    // Gerar relatório final
    const report = {
        page: 'cronograma.html',
        timestamp: new Date().toISOString(),
        corruptedCharacters: corruptedChars,
        interactiveElements: problematicElements,
        apiEndpoints: failedAPIs,
        consoleErrors: errors,
        networkFailures: failedRequests,
        summary: {
            totalIssues: corruptedChars.length + problematicElements.length + failedAPIs.length + errors.length + failedRequests.length,
            critical: failedAPIs.length + errors.length,
            medium: problematicElements.length + failedRequests.length,
            low: corruptedChars.length
        }
    };
    
    console.log('\n📊 RELATÓRIO FINAL:');
    console.log(report);
    
    // Salvar relatório
    localStorage.setItem('qa_report_cronograma_' + Date.now(), JSON.stringify(report));
    
    return report;
}

// Executar análise quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runFullAnalysis);
} else {
    runFullAnalysis();
}

console.log('\n💡 Para executar novamente, chame: runFullAnalysis()');