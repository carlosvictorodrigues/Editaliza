#!/usr/bin/env node

/**
 * Frontend Test Runner
 * Executes all frontend tests and generates comprehensive coverage report
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function colorize(text, color) {
    return `${colors[color]}${text}${colors.reset}`;
}

function printBanner() {
    console.log(colorize('\n🧪 FRONTEND TEST SUITE - EDITALIZA', 'cyan'));
    console.log(colorize('=' .repeat(60), 'cyan'));
    console.log(`${colorize('📅 Data/Hora:', 'blue')} ${new Date().toLocaleString('pt-BR')}`);
    console.log(`${colorize('🔧 Ambiente:', 'blue')} ${process.env.NODE_ENV || 'development'}`);
    console.log(colorize('=' .repeat(60), 'cyan'));
}

function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        console.log(colorize(`\n▶️  Executando: ${command} ${args.join(' ')}`, 'yellow'));
        
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function checkDependencies() {
    console.log(colorize('\n🔍 VERIFICANDO DEPENDÊNCIAS', 'blue'));
    
    const requiredPackages = [
        'jest',
        'jest-environment-jsdom',
        'jsdom'
    ];

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { 
        ...packageJson.dependencies, 
        ...packageJson.devDependencies 
    };

    let missingPackages = [];

    requiredPackages.forEach(pkg => {
        if (!allDeps[pkg]) {
            missingPackages.push(pkg);
        } else {
            console.log(colorize(`✅ ${pkg}`, 'green'));
        }
    });

    if (missingPackages.length > 0) {
        console.log(colorize(`❌ Pacotes faltando: ${missingPackages.join(', ')}`, 'red'));
        console.log(colorize('Execute: npm install', 'yellow'));
        process.exit(1);
    }
}

async function runTestSuite(suiteName, command, args) {
    console.log(colorize(`\n🧪 ${suiteName.toUpperCase()}`, 'bold'));
    console.log(colorize('-'.repeat(40), 'cyan'));
    
    const startTime = Date.now();
    
    try {
        await runCommand(command, args);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(colorize(`✅ ${suiteName} - Sucesso (${duration}s)`, 'green'));
        return { name: suiteName, status: 'success', duration };
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(colorize(`❌ ${suiteName} - Falhou (${duration}s)`, 'red'));
        return { name: suiteName, status: 'failed', duration, error: error.message };
    }
}

function generateReport(results) {
    console.log(colorize('\n📊 RELATÓRIO FINAL', 'bold'));
    console.log(colorize('=' .repeat(60), 'cyan'));
    
    let totalTests = results.length;
    let passedTests = results.filter(r => r.status === 'success').length;
    let failedTests = totalTests - passedTests;
    
    console.log(`${colorize('📈 Total de Suites:', 'blue')} ${totalTests}`);
    console.log(`${colorize('✅ Sucesso:', 'green')} ${passedTests}`);
    console.log(`${colorize('❌ Falhas:', 'red')} ${failedTests}`);
    console.log(`${colorize('📊 Taxa de Sucesso:', 'cyan')} ${((passedTests/totalTests)*100).toFixed(1)}%`);
    
    if (failedTests > 0) {
        console.log(colorize('\n❌ FALHAS DETECTADAS:', 'red'));
        results.filter(r => r.status === 'failed').forEach(result => {
            console.log(colorize(`   • ${result.name}: ${result.error}`, 'red'));
        });
    }
    
    console.log(colorize('\n📂 Relatórios de Cobertura:', 'blue'));
    console.log('   • HTML: coverage/frontend/lcov-report/index.html');
    console.log('   • LCOV: coverage/frontend/lcov.info');
    
    console.log(colorize('\n🏁 TESTES CONCLUÍDOS', 'bold'));
    console.log(colorize('=' .repeat(60), 'cyan'));
}

async function checkFiles() {
    console.log(colorize('\n📁 VERIFICANDO ARQUIVOS DE TESTE', 'blue'));
    
    const testFiles = [
        'tests/frontend/app.test.js',
        'tests/frontend/auth-frontend.test.js',
        'tests/frontend/api-client.test.js',
        'tests/frontend/dom-manipulation.test.js',
        'tests/frontend/form-validation.test.js',
        'tests/frontend/setup/frontend-setup.js',
        'jest.frontend.config.js'
    ];
    
    let missingFiles = [];
    
    testFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(colorize(`✅ ${file}`, 'green'));
        } else {
            console.log(colorize(`❌ ${file}`, 'red'));
            missingFiles.push(file);
        }
    });
    
    if (missingFiles.length > 0) {
        console.log(colorize(`\n⚠️  Arquivos faltando: ${missingFiles.length}`, 'yellow'));
        return false;
    }
    
    return true;
}

async function main() {
    printBanner();
    
    try {
        // Verificações preliminares
        await checkDependencies();
        
        const filesOK = await checkFiles();
        if (!filesOK) {
            console.log(colorize('\n❌ Alguns arquivos de teste estão faltando. Criando estrutura...', 'red'));
            process.exit(1);
        }
        
        // Suites de teste
        const testSuites = [
            {
                name: 'Core App Logic',
                command: 'npm',
                args: ['run', 'test:frontend:app']
            },
            {
                name: 'Authentication',
                command: 'npm',
                args: ['run', 'test:frontend:auth']
            },
            {
                name: 'API Client',
                command: 'npm',
                args: ['run', 'test:frontend:api']
            },
            {
                name: 'DOM Manipulation',
                command: 'npm',
                args: ['run', 'test:frontend:dom']
            },
            {
                name: 'Form Validation',
                command: 'npm',
                args: ['run', 'test:frontend:forms']
            }
        ];
        
        console.log(colorize(`\n🚀 Iniciando ${testSuites.length} suites de teste...`, 'bold'));
        
        const results = [];
        
        // Executa cada suite
        for (const suite of testSuites) {
            const result = await runTestSuite(suite.name, suite.command, suite.args);
            results.push(result);
        }
        
        // Executa teste de cobertura completa
        console.log(colorize('\n📊 EXECUTANDO COBERTURA COMPLETA', 'bold'));
        try {
            await runCommand('npm', ['run', 'test:frontend:coverage']);
            console.log(colorize('✅ Relatório de cobertura gerado', 'green'));
        } catch (error) {
            console.log(colorize('⚠️  Cobertura falhou, mas testes individuais foram executados', 'yellow'));
        }
        
        // Gerar relatório
        generateReport(results);
        
        // Exit code baseado nos resultados
        const hasFailures = results.some(r => r.status === 'failed');
        process.exit(hasFailures ? 1 : 0);
        
    } catch (error) {
        console.log(colorize(`\n❌ Erro fatal: ${error.message}`, 'red'));
        process.exit(1);
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main, runTestSuite, generateReport };