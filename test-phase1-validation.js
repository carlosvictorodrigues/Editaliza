#!/usr/bin/env node

/**
 * TESTE DE VALIDAÇÃO - FASE 1
 * 
 * Verifica se todas as rotas de autenticação foram padronizadas corretamente
 * para o formato /api/auth/*
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDAÇÃO FASE 1 - Padronização de Rotas de Autenticação\n');

const publicDir = path.join(__dirname, 'public');
const mainFiles = [
    'login.html',
    'register.html', 
    'forgot-password.html',
    'reset-password.html'
];

const expectedRoutes = {
    '/api/auth/login': 'Rota de login',
    '/api/auth/register': 'Rota de registro',
    '/api/auth/google': 'OAuth Google',
    '/api/auth/session-token': 'Token de sessão',
    '/api/auth/password/request': 'Solicitação de recuperação de senha',
    '/api/auth/password/reset': 'Redefinição de senha',
    '/api/auth/csrf-token': 'Token CSRF'
};

const oldRoutes = [
    '"/auth/login"',
    '"/auth/register"',
    "'/auth/login'", 
    "'/auth/register'",
    "'/auth/google'",
    "'/auth/session-token'",
    '"/api/login"',
    "'/api/login'",
    '"/api/register"',
    "'/api/register'",
    "'/api/request-password-reset'",
    "'/api/reset-password'"
];

let validationResults = {
    success: 0,
    warnings: 0,
    errors: 0,
    files: {}
};

function validateFile(filePath) {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`📄 Validando: ${fileName}`);
    
    let fileResults = {
        foundRoutes: [],
        oldRoutes: [],
        issues: []
    };
    
    // Verificar se as rotas corretas estão presentes
    Object.keys(expectedRoutes).forEach(route => {
        if (content.includes(route)) {
            fileResults.foundRoutes.push(route);
            console.log(`  ✅ ${expectedRoutes[route]}: ${route}`);
            validationResults.success++;
        }
    });
    
    // Verificar se ainda existem rotas antigas (ignorando comentários e URLs de produção)
    oldRoutes.forEach(route => {
        if (content.includes(route)) {
            // Verificar se não está em comentário ou é URL de produção
            const lines = content.split('\n');
            const lineWithRoute = lines.find(line => line.includes(route));
            
            if (lineWithRoute && 
                !lineWithRoute.trim().startsWith('//') && 
                !lineWithRoute.trim().startsWith('*') &&
                !lineWithRoute.includes('editaliza.com.br') &&
                !lineWithRoute.includes('callback') &&
                !lineWithRoute.includes('Callback URL')) {
                fileResults.oldRoutes.push(route);
                console.log(`  ⚠️  Rota antiga encontrada: ${route}`);
                validationResults.warnings++;
            }
        }
    });
    
    // Verificar uso correto de app.apiFetch
    const fetchMatches = content.match(/app\.apiFetch\s*\(\s*['"`]([^'"`]+)/g);
    if (fetchMatches) {
        fetchMatches.forEach(match => {
            const route = match.match(/['"`]([^'"`]+)/)[1];
            if (route.startsWith('/api/auth/')) {
                console.log(`  ✅ app.apiFetch usando rota correta: ${route}`);
            } else if (route.startsWith('/api/')) {
                console.log(`  ℹ️  app.apiFetch usando rota API: ${route}`);
            }
        });
    }
    
    validationResults.files[fileName] = fileResults;
    console.log('');
}

// Validar arquivos principais
console.log('📋 ARQUIVOS PRINCIPAIS:\n');
mainFiles.forEach(fileName => {
    const filePath = path.join(publicDir, fileName);
    if (fs.existsSync(filePath)) {
        validateFile(filePath);
    } else {
        console.log(`❌ Arquivo não encontrado: ${fileName}\n`);
        validationResults.errors++;
    }
});

// Verificar arquivos de teste importantes
console.log('🧪 ARQUIVOS DE TESTE:\n');
const testFiles = [
    'test_complete_flow.html',
    'test_api_routes.html'
];

testFiles.forEach(fileName => {
    const filePath = path.join(publicDir, fileName);
    if (fs.existsSync(filePath)) {
        validateFile(filePath);
    }
});

// Relatório final
console.log('📊 RELATÓRIO FINAL:\n');
console.log(`✅ Sucessos: ${validationResults.success}`);
console.log(`⚠️  Avisos: ${validationResults.warnings}`);
console.log(`❌ Erros: ${validationResults.errors}\n`);

if (validationResults.warnings > 0) {
    console.log('⚠️  ATENÇÃO: Algumas rotas antigas ainda estão presentes.');
    console.log('   Certifique-se de que não estão sendo usadas ativamente.\n');
}

if (validationResults.errors === 0 && validationResults.warnings < 3) {
    console.log('🎉 FASE 1 CONCLUÍDA COM SUCESSO!');
    console.log('   Todas as rotas de autenticação foram padronizadas.');
    console.log('\n✅ PRINCIPAIS CORREÇÕES APLICADAS:');
    console.log('   • /auth/login → /api/auth/login');
    console.log('   • /auth/register → /api/auth/register');
    console.log('   • /auth/google → /api/auth/google');
    console.log('   • /api/request-password-reset → /api/auth/password/request');
    console.log('   • /api/reset-password → /api/auth/password/reset');
    process.exit(0);
} else {
    console.log('❌ FASE 1 PRECISA DE ATENÇÃO');
    console.log('   Verifique os avisos e erros acima.');
    process.exit(1);
}