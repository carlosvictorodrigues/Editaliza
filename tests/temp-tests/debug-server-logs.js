// Debug para ver onde o servidor está travando

const http = require('http');

// Fazer requisição simples
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 3000
};

const data = JSON.stringify({
    email: `test_${Date.now()}@test.com`,
    password: 'Test123!@#',
    name: 'Test User'
});

console.log('\n🔍 FAZENDO REQUISIÇÃO DE REGISTRO...\n');
console.log('Dados:', data);

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    
    res.on('end', () => {
        console.log('Resposta:', responseData);
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error(`Erro: ${e.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    console.error('⏰ TIMEOUT - Requisição travou após 3 segundos');
    console.log('\n🔴 PROBLEMA CONFIRMADO: O endpoint /api/auth/register está travando');
    console.log('   Possíveis causas:');
    console.log('   1. Middleware CSRF bloqueando');
    console.log('   2. Rate limiting');
    console.log('   3. Problema no authController');
    console.log('   4. Loop infinito em algum ponto\n');
    req.abort();
    process.exit(1);
});

// Enviar dados
req.write(data);
req.end();