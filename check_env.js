// Script para verificar se as variáveis de ambiente estão configuradas
require('dotenv').config();

console.log('=== VERIFICAÇÃO DE CONFIGURAÇÃO DO GOOGLE OAUTH ===\n');

// Verificar variáveis essenciais
const essentialVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'JWT_SECRET',
    'SESSION_SECRET'
];

let allConfigured = true;

essentialVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        // Mostra apenas parte do valor por segurança
        const displayValue = value.length > 10 
            ? value.substring(0, 10) + '...' + (value.includes('.apps.googleusercontent.com') ? '.apps.googleusercontent.com' : '')
            : value;
        console.log(`✅ ${varName}: Configurado (${displayValue})`);
    } else {
        console.log(`❌ ${varName}: NÃO configurado`);
        allConfigured = false;
    }
});

console.log('\n=== RESULTADO ===');
if (allConfigured) {
    console.log('✅ Todas as variáveis essenciais estão configuradas!');
    console.log('📌 O Google OAuth deve funcionar corretamente.');
    console.log('\n⚠️  IMPORTANTE: Você precisa REINICIAR o servidor para as mudanças terem efeito!');
    console.log('   1. Pare o servidor atual (Ctrl+C)');
    console.log('   2. Inicie novamente: npm start');
} else {
    console.log('❌ Algumas variáveis não estão configuradas.');
    console.log('📝 Verifique o arquivo .env e adicione as variáveis faltantes.');
    console.log('\nExemplo de configuração:');
    console.log('GOOGLE_CLIENT_ID=seu_id_aqui.apps.googleusercontent.com');
    console.log('GOOGLE_CLIENT_SECRET=seu_secret_aqui');
    console.log('GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback');
}

// Verificar formato do GOOGLE_CLIENT_ID
if (process.env.GOOGLE_CLIENT_ID) {
    if (!process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
        console.log('\n⚠️  AVISO: GOOGLE_CLIENT_ID deve terminar com .apps.googleusercontent.com');
    }
}

// Verificar URL de callback
if (process.env.GOOGLE_CALLBACK_URL) {
    console.log(`\n📍 URL de Callback configurada: ${process.env.GOOGLE_CALLBACK_URL}`);
    if (!process.env.GOOGLE_CALLBACK_URL.includes('/auth/google/callback')) {
        console.log('⚠️  AVISO: A URL de callback deve terminar com /auth/google/callback');
    }
}

process.exit(0);