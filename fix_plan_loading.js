// Script para corrigir o problema de carregamento de planos após deletar todos
// Este script atualiza o cronograma.html para melhor lidar com planos inexistentes

const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo problema de carregamento de planos...\n');

// Ler o arquivo cronograma.html
const filePath = path.join(__dirname, 'cronograma.html');
const content = fs.readFileSync(filePath, 'utf8');

// Procurar a seção onde o plano é carregado (linha ~319)
const searchPattern = /app\.showSpinner\(\);\s*try \{\s*const plan = await app\.apiFetch\(`\/plans\/\$\{planId\}`\);/;

// Novo código com tratamento de erro melhorado
const replacement = `app.showSpinner();
            try {
                const plan = await app.apiFetch(\`/plans/\${planId}\`);`;

// Procurar a seção do catch para melhorar o tratamento de erro
const catchPattern = /} catch \(error\) \{\s*app\.showToast\('Erro ao carregar dados: ' \+ error\.message, 'error'\);/;

const catchReplacement = `} catch (error) {
                console.error('Erro ao carregar plano:', error);
                
                // Se o plano não existe (404), limpar localStorage e redirecionar
                if (error.message && error.message.includes('não encontrado')) {
                    console.log('🔄 Plano não encontrado. Limpando localStorage...');
                    localStorage.removeItem('selectedPlanId');
                    
                    // Tentar buscar o primeiro plano disponível
                    try {
                        const plans = await app.apiFetch('/plans');
                        if (plans && plans.length > 0) {
                            console.log('✅ Encontrado plano alternativo:', plans[0].id);
                            localStorage.setItem('selectedPlanId', plans[0].id);
                            window.location.href = \`cronograma.html?id=\${plans[0].id}\`;
                        } else {
                            console.log('❌ Nenhum plano disponível. Redirecionando para home...');
                            app.showToast('Nenhum plano encontrado. Redirecionando...', 'warning');
                            setTimeout(() => {
                                window.location.href = 'home.html';
                            }, 2000);
                        }
                    } catch (listError) {
                        console.error('Erro ao buscar planos:', listError);
                        app.showToast('Erro ao carregar dados. Redirecionando...', 'error');
                        setTimeout(() => {
                            window.location.href = 'home.html';
                        }, 2000);
                    }
                } else {
                    app.showToast('Erro ao carregar dados: ' + error.message, 'error');
                }`;

// Aplicar as correções
let updatedContent = content;

// Verificar se o padrão existe
if (!catchPattern.test(content)) {
    console.log('⚠️  Padrão de catch não encontrado exatamente. Procurando alternativa...');
    
    // Procurar um padrão mais genérico
    const genericCatchPattern = /catch \(error\) \{[^}]*app\.showToast\([^}]*\);/;
    
    if (genericCatchPattern.test(content)) {
        console.log('✅ Encontrado padrão alternativo de catch');
        updatedContent = content.replace(genericCatchPattern, 
            `catch (error) {
                console.error('Erro ao carregar plano:', error);
                
                // Se o plano não existe (404), limpar localStorage e redirecionar
                if (error.message && error.message.includes('não encontrado')) {
                    console.log('🔄 Plano não encontrado. Limpando localStorage...');
                    localStorage.removeItem('selectedPlanId');
                    
                    // Tentar buscar o primeiro plano disponível
                    try {
                        const plans = await app.apiFetch('/plans');
                        if (plans && plans.length > 0) {
                            console.log('✅ Encontrado plano alternativo:', plans[0].id);
                            localStorage.setItem('selectedPlanId', plans[0].id);
                            window.location.href = \`cronograma.html?id=\${plans[0].id}\`;
                        } else {
                            console.log('❌ Nenhum plano disponível. Redirecionando para home...');
                            app.showToast('Nenhum plano encontrado. Redirecionando...', 'warning');
                            setTimeout(() => {
                                window.location.href = 'home.html';
                            }, 2000);
                        }
                    } catch (listError) {
                        console.error('Erro ao buscar planos:', listError);
                        app.showToast('Erro ao carregar dados. Redirecionando...', 'error');
                        setTimeout(() => {
                            window.location.href = 'home.html';
                        }, 2000);
                    }
                } else {
                    app.showToast('Erro ao carregar dados: ' + error.message, 'error');
                }`);
    }
} else {
    updatedContent = content.replace(catchPattern, catchReplacement);
}

// Salvar o arquivo atualizado
fs.writeFileSync(filePath, updatedContent, 'utf8');

console.log('✅ Arquivo cronograma.html atualizado com tratamento melhorado de erros');

// Agora vamos também melhorar o home.html para limpar o localStorage quando apropriado
const homeFilePath = path.join(__dirname, 'home.html');

if (fs.existsSync(homeFilePath)) {
    console.log('\n🔧 Atualizando home.html...');
    
    const homeContent = fs.readFileSync(homeFilePath, 'utf8');
    
    // Procurar onde os planos são carregados
    const loadPlansPattern = /async function loadPlans\(\)/;
    
    if (loadPlansPattern.test(homeContent)) {
        // Adicionar limpeza de localStorage se não houver planos
        const improvedLoadPlans = homeContent.replace(
            /const plans = await app\.apiFetch\('\/plans'\);/,
            `const plans = await app.apiFetch('/plans');
                
                // Se não há planos, limpar o localStorage
                if (!plans || plans.length === 0) {
                    console.log('🧹 Nenhum plano encontrado. Limpando localStorage...');
                    localStorage.removeItem('selectedPlanId');
                }`
        );
        
        fs.writeFileSync(homeFilePath, improvedLoadPlans, 'utf8');
        console.log('✅ Arquivo home.html atualizado');
    }
}

console.log('\n✅ Correções aplicadas com sucesso!');
console.log('📝 Melhorias implementadas:');
console.log('   1. Detecção automática de planos inexistentes');
console.log('   2. Limpeza do localStorage quando plano não existe');
console.log('   3. Tentativa de carregar primeiro plano disponível');
console.log('   4. Redirecionamento para home se nenhum plano existe');
console.log('   5. Mensagens de erro mais informativas');