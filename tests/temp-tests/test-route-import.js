// Teste de importação da rota
const { authenticateToken } = require('./src/middleware/auth.middleware');

console.log('\n🔍 TESTE DE IMPORTAÇÃO\n');
console.log('authenticateToken tipo:', typeof authenticateToken);
console.log('authenticateToken é função?', typeof authenticateToken === 'function');

// Ver a assinatura da função
console.log('\nauthenticateToken.toString() primeiras 200 caracteres:');
console.log(authenticateToken.toString().substring(0, 200));

// Testar chamada
console.log('\nTestando chamada authenticateToken():');
const middleware = authenticateToken();
console.log('Retorno tipo:', typeof middleware);
console.log('Retorno é função?', typeof middleware === 'function');