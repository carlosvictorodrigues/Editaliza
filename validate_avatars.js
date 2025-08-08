/**
 * Script para validar os avatares da página profile.html
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Iniciando validação dos avatares...\n');

// Configurações
const avatarCategories = {
    "Aventureiros": "adventurer",
    "Pixel Art": "pixel-art", 
    "Bots": "bots",
    "Minimalista": "miniavs"
};

const avatarsDir = path.join(__dirname, 'images', 'avatars');
let totalTests = 0;
let passedTests = 0;

function runTest(testName, testFunction) {
    totalTests++;
    try {
        const result = testFunction();
        if (result) {
            console.log(`✅ ${testName}`);
            passedTests++;
        } else {
            console.log(`❌ ${testName}`);
        }
        return result;
    } catch (error) {
        console.log(`❌ ${testName} - Erro: ${error.message}`);
        return false;
    }
}

// Teste 1: Verificar se o diretório de avatares existe
runTest('Diretório de avatares existe', () => {
    return fs.existsSync(avatarsDir);
});

// Teste 2: Verificar cada categoria
Object.entries(avatarCategories).forEach(([categoryName, categoryKey]) => {
    const categoryDir = path.join(avatarsDir, categoryKey);
    
    runTest(`Categoria "${categoryName}" existe`, () => {
        return fs.existsSync(categoryDir);
    });
    
    // Teste 3: Verificar se todos os 6 avatares existem em cada categoria
    for (let i = 1; i <= 6; i++) {
        const fileName = `${categoryKey === 'adventurer' ? 'avatar' : (categoryKey === 'pixel-art' ? 'pixel' : (categoryKey === 'bots' ? 'bot' : 'miniav'))}${i}.svg`;
        const filePath = path.join(categoryDir, fileName);
        
        runTest(`Avatar ${categoryName}/${fileName}`, () => {
            return fs.existsSync(filePath);
        });
        
        // Teste 4: Verificar se o arquivo não está vazio
        if (fs.existsSync(filePath)) {
            runTest(`Avatar ${categoryName}/${fileName} não está vazio`, () => {
                const stats = fs.statSync(filePath);
                return stats.size > 0;
            });
        }
    }
});

// Teste 5: Verificar se profile.html existe
runTest('Arquivo profile.html existe', () => {
    return fs.existsSync(path.join(__dirname, 'profile.html'));
});

// Teste 6: Verificar se os arquivos JS necessários existem
const requiredJS = ['js/app.js', 'js/components.js'];
requiredJS.forEach(jsFile => {
    runTest(`Arquivo ${jsFile} existe`, () => {
        return fs.existsSync(path.join(__dirname, jsFile));
    });
});

// Teste 7: Verificar se server.js está configurado para servir arquivos estáticos
runTest('server.js existe', () => {
    return fs.existsSync(path.join(__dirname, 'server.js'));
});

// Resumo
console.log('\n📊 RESUMO DOS TESTES:');
console.log(`Total: ${totalTests}`);
console.log(`Passou: ${passedTests}`);
console.log(`Falhou: ${totalTests - passedTests}`);
console.log(`Taxa de sucesso: ${Math.round(passedTests/totalTests*100)}%`);

if (passedTests === totalTests) {
    console.log('\n🎉 Todos os testes passaram! A funcionalidade de avatares está funcionando corretamente.');
} else {
    console.log('\n⚠️  Alguns testes falharam. Verifique os arquivos em falta.');
}

// Teste adicional: Listar todos os arquivos encontrados
console.log('\n📁 ARQUIVOS DE AVATAR ENCONTRADOS:');
Object.entries(avatarCategories).forEach(([categoryName, categoryKey]) => {
    const categoryDir = path.join(avatarsDir, categoryKey);
    if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.svg'));
        console.log(`${categoryName}: ${files.length} arquivos (${files.join(', ')})`);
    }
});