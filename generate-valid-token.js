// Gerar um token JWT válido
require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'default-dev-secret';
console.log('Using JWT_SECRET:', secret.substring(0, 10) + '...');

const payload = {
    userId: 1,
    id: 1, // Adicionar ambos para compatibilidade
    email: 'teste@teste.com',
    name: 'Usuário Teste',
    role: 'user'
};

const token = jwt.sign(payload, secret, {
    expiresIn: '24h',
    issuer: 'editaliza'
});

console.log('\n✅ Token JWT gerado com sucesso!\n');
console.log('Token:', token);
console.log('\n📋 Payload:', payload);

// Verificar o token
try {
    const decoded = jwt.verify(token, secret, {
        issuer: 'editaliza'
    });
    console.log('\n✅ Token válido! Expira em:', new Date(decoded.exp * 1000));
} catch (error) {
    console.error('\n❌ Erro ao verificar token:', error.message);
}

// Comando curl para teste
console.log('\n🚀 Use este comando para testar:');
console.log(`curl -X GET http://localhost:3000/api/plans -H "Authorization: Bearer ${token}"`);