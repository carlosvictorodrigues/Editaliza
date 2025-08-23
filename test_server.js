/**
 * Script para testar se o servidor está servindo os avatares corretamente
 */

const http = require('http');
const fs = require('fs');

console.log('🌐 Testando servidor HTTP...\n');

const baseUrl = 'http://localhost:3000';
let totalTests = 0;
let passedTests = 0;

function testUrl(url, testName) {
    return new Promise((resolve) => {
        totalTests++;
        
        const request = http.get(url, (response) => {
            if (response.statusCode === 200) {
                console.log(`✅ ${testName} - Status: ${response.statusCode}`);
                passedTests++;
                resolve(true);
            } else {
                console.log(`❌ ${testName} - Status: ${response.statusCode}`);
                resolve(false);
            }
        });
        
        request.on('error', (error) => {
            console.log(`❌ ${testName} - Erro: ${error.message}`);
            resolve(false);
        });
        
        request.setTimeout(5000, () => {
            console.log(`❌ ${testName} - Timeout`);
            request.destroy();
            resolve(false);
        });
    });
}

async function runServerTests() {
    console.log('Testando URLs do servidor...\n');
    
    const testUrls = [
        { url: `${baseUrl}/profile.html`, name: 'Página profile.html' },
        { url: `${baseUrl}/test_profile.html`, name: 'Página de teste' },
        { url: `${baseUrl}/images/avatars/adventurer/avatar1.svg`, name: 'Avatar adventurer 1' },
        { url: `${baseUrl}/images/avatars/pixel-art/pixel1.svg`, name: 'Avatar pixel art 1' },
        { url: `${baseUrl}/images/avatars/bots/bot1.svg`, name: 'Avatar bot 1' },
        { url: `${baseUrl}/images/avatars/miniavs/miniav1.svg`, name: 'Avatar minimalista 1' },
        { url: `${baseUrl}/js/app.js`, name: 'Script app.js' },
        { url: `${baseUrl}/js/components.js`, name: 'Script components.js' }
    ];
    
    for (const test of testUrls) {
        await testUrl(test.url, test.name);
    }
    
    // Resumo
    console.log('\n📊 RESUMO DOS TESTES DE SERVIDOR:');
    console.log(`Total: ${totalTests}`);
    console.log(`Passou: ${passedTests}`);
    console.log(`Falhou: ${totalTests - passedTests}`);
    console.log(`Taxa de sucesso: ${Math.round(passedTests/totalTests*100)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 Servidor está funcionando corretamente!');
    } else {
        console.log('\n⚠️  Alguns recursos não estão acessíveis via servidor.');
    }
}

// Executar testes
runServerTests().catch(console.error);