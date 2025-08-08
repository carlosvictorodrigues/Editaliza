/**
 * @file test-home-manual.js
 * @description Teste manual para verificar se a tela inicial está funcionando
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function testHomePageManually() {
    console.log('🔍 INICIANDO TESTES MANUAIS DA TELA INICIAL...\n');
    
    // 1. Verificar se arquivos existem
    console.log('📁 VERIFICANDO ARQUIVOS:');
    const files = [
        'home.html',
        'js/app.js',
        'js/components.js',
        'js/checklist.js',
        'js/timer.js',
        'css/style.css'
    ];
    
    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        const exists = fs.existsSync(filePath);
        const status = exists ? '✅' : '❌';
        const size = exists ? `(${fs.statSync(filePath).size} bytes)` : '';
        console.log(`  ${status} ${file} ${size}`);
    });
    
    // 2. Verificar se servidor está rodando
    console.log('\n🌐 VERIFICANDO SERVIDOR:');
    
    try {
        const serverResponse = await makeRequest('http://localhost:3000/health');
        console.log('  ✅ Servidor está rodando');
        console.log(`  📊 Status: ${serverResponse.status}`);
    } catch (error) {
        console.log('  ❌ Servidor não está rodando ou não responde');
        console.log('  💡 Execute: npm start');
        return;
    }
    
    // 3. Testar endpoints da API
    console.log('\n🔌 TESTANDO ENDPOINTS DA API:');
    
    const endpoints = [
        '/profile',
        '/plans/1',
        '/plans/1/progress',
        '/schedules/1/range?startDate=2024-01-01&endDate=2024-01-01'
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(`http://localhost:3000${endpoint}`);
            console.log(`  ✅ ${endpoint} - Status: ${response.status}`);
        } catch (error) {
            console.log(`  ⚠️  ${endpoint} - Erro: ${error.message}`);
        }
    }
    
    // 4. Verificar conteúdo do home.html
    console.log('\n📄 ANALISANDO CONTEÚDO DO HOME.HTML:');
    
    const homeContent = fs.readFileSync(path.join(__dirname, 'home.html'), 'utf-8');
    
    const checks = [
        { name: 'Título correto', test: () => homeContent.includes('Painel Principal - Editaliza') },
        { name: 'Tailwind CSS', test: () => homeContent.includes('tailwindcss.com') },
        { name: 'Scripts principais', test: () => ['app.js', 'components.js', 'checklist.js', 'timer.js'].every(script => homeContent.includes(script)) },
        { name: 'Elementos principais', test: () => ['welcomeMessage', 'userAvatar', 'todaySchedule'].every(id => homeContent.includes(`id="${id}"`)) },
        { name: 'Modal de estudo', test: () => homeContent.includes('studySessionModal') },
        { name: 'Cores da marca', test: () => homeContent.includes('#0528f2') && homeContent.includes('#1ad937') }
    ];
    
    checks.forEach(check => {
        const result = check.test();
        const status = result ? '✅' : '❌';
        console.log(`  ${status} ${check.name}`);
    });
    
    // 5. Simular carregamento da página
    console.log('\n🖥️  SIMULANDO CARREGAMENTO DA PÁGINA:');
    
    try {
        const pageResponse = await makeRequest('http://localhost:3000/home.html');
        console.log(`  ✅ Página carregada - Status: ${pageResponse.status}`);
        
        if (pageResponse.data) {
            const hasBasicStructure = pageResponse.data.includes('<html') && 
                                    pageResponse.data.includes('<head>') && 
                                    pageResponse.data.includes('<body>');
            console.log(`  ${hasBasicStructure ? '✅' : '❌'} Estrutura HTML válida`);
            
            const hasScripts = pageResponse.data.includes('app.js');
            console.log(`  ${hasScripts ? '✅' : '❌'} Scripts incluídos`);
        }
        
    } catch (error) {
        console.log(`  ❌ Erro ao carregar página: ${error.message}`);
    }
    
    // 6. Relatório final
    console.log('\n📊 RELATÓRIO FINAL:');
    console.log('='*50);
    
    const totalChecks = files.length + endpoints.length + checks.length + 1; // +1 para servidor
    const passedChecks = files.filter(f => fs.existsSync(path.join(__dirname, f))).length +
                        checks.filter(c => c.test()).length + 2; // +2 estimados para servidor e página
    
    const successRate = Math.round((passedChecks / totalChecks) * 100);
    
    console.log(`✅ Taxa de sucesso estimada: ${successRate}%`);
    
    if (successRate >= 80) {
        console.log('🎉 TELA INICIAL PARECE ESTAR FUNCIONANDO CORRETAMENTE!');
    } else if (successRate >= 60) {
        console.log('⚠️  TELA INICIAL TEM ALGUNS PROBLEMAS, MAS FUNCIONA BÁSICAMENTE');
    } else {
        console.log('❌ TELA INICIAL TEM PROBLEMAS SÉRIOS');
    }
    
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('1. Acesse http://localhost:3000/home.html');
    console.log('2. Verifique se não há erros no console do navegador');
    console.log('3. Teste a navegação e funcionalidades manualmente');
    console.log('4. Verifique se os dados carregam corretamente');
    
    console.log('\n🏁 TESTE MANUAL FINALIZADO!\n');
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            let data = '';
            
            response.on('data', chunk => {
                data += chunk;
            });
            
            response.on('end', () => {
                resolve({
                    status: response.statusCode,
                    data: data
                });
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
        
        request.setTimeout(5000, () => {
            request.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Executar teste se chamado diretamente
if (require.main === module) {
    testHomePageManually().catch(console.error);
}

module.exports = { testHomePageManually };