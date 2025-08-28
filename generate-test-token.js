/**
 * Gera um token JWT válido para testes
 */

const jwt = require('jsonwebtoken');

// Dados do usuário de teste
const testUser = {
    id: 80,
    email: 'teste@editaliza.com',
    name: 'Usuário Teste'
};

// Gerar token com validade de 24 horas
const token = jwt.sign(
    testUser,
    process.env.JWT_SECRET || 'default-dev-secret',
    { 
        expiresIn: '24h',
        issuer: 'editaliza'
    }
);

console.log('===========================================');
console.log('         TOKEN DE TESTE GERADO');
console.log('===========================================\n');
console.log('Token completo (copie tudo):');
console.log(token);
console.log('\n===========================================');
console.log('Informações do token:');
console.log('- User ID:', testUser.id);
console.log('- Email:', testUser.email);
console.log('- Válido por: 24 horas');
console.log('===========================================\n');
console.log('Para usar no teste:');
console.log('export TEST_TOKEN="' + token + '"');
console.log('node test-session-patch.js');