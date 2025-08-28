// Teste direto do middleware de autenticação
require('dotenv').config();

// Simular req/res
const req = {
    headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdGVAdGVzdGUuY29tIiwiaWF0IjoxNzU2MjIwMDg0LCJleHAiOjE3NTYzMDY0ODR9.QhRWGSxs8EfKp6S6QIAqkbNkbbN-sV56tUb5R0z5ySw'
    },
    ip: '127.0.0.1',
    originalUrl: '/api/plans',
    method: 'GET',
    get: (header) => req.headers[header.toLowerCase()]
};

const res = {
    status: (code) => {
        console.log(`Response status: ${code}`);
        return res;
    },
    json: (data) => {
        console.log('Response data:', data);
        return res;
    }
};

const next = (error) => {
    if (error) {
        console.error('Next called with error:', error);
    } else {
        console.log('✅ Next called successfully - authentication passed!');
    }
};

// Testar o middleware
const authMiddleware = require('./src/middleware/auth.middleware');

console.log('\n🔍 TESTANDO MIDDLEWARE DE AUTENTICAÇÃO\n');

// Testar authenticateToken
const authenticate = authMiddleware.authenticateToken();

authenticate(req, res, next).then(() => {
    console.log('\n✅ Teste concluído');
    if (req.user) {
        console.log('User autenticado:', req.user);
    }
    process.exit(0);
}).catch(error => {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
});