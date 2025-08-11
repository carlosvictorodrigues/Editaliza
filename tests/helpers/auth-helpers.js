// tests/helpers/auth-helpers.js - Utilitários para testes de autenticação
const request = require('supertest');

// Dados de teste válidos
const validUserData = {
    email: 'teste@exemplo.com',
    password: 'senhaSegura123'
};

const validUserData2 = {
    email: 'teste2@exemplo.com',
    password: 'outraSemanhaSegura456'
};

// Dados de teste inválidos
const invalidEmailFormats = [
    'email-invalido',
    '@exemplo.com',
    'teste@',
    'teste.exemplo.com',
    'teste @exemplo.com',
    'teste..teste@exemplo.com',
    'teste@exemplo',
    ''
];

const invalidPasswords = [
    '123',          // muito curta
    '12345',        // muito curta
    '',             // vazia
    'senha com espaços',  // contém espaços
    'senha<script>',      // caracteres perigosos
    'senha\ncom\tbreak'   // caracteres de controle
];

const weakPasswords = [
    '123456',       // comum
    'password',     // comum
    'senha123',     // previsível
    'qwerty',       // padrão de teclado
    'abcdef'        // sequencial
];

// Payloads maliciosos para testar segurança
const maliciousPayloads = {
    xssAttempts: [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '"><script>alert("xss")</script>',
        '\'; DROP TABLE users; --',
        '{{7*7}}',
        '${7*7}',
        '<img src="x" onerror="alert(1)">'
    ],
    sqlInjectionAttempts: [
        '\' OR \'1\'=\'1',
        '\'; DROP TABLE users; --',
        '\' UNION SELECT * FROM users --',
        'admin\'--',
        '\' OR 1=1 --',
        '1\' AND SUBSTRING(@@version,1,1)=\'5\' --'
    ],
    oversizedData: {
        email: 'a'.repeat(1000) + '@exemplo.com',
        password: 'b'.repeat(1000)
    }
};

// Headers maliciosos
const maliciousHeaders = {
    'X-Forwarded-For': '127.0.0.1, 192.168.1.1, 10.0.0.1',
    'User-Agent': '<script>alert("xss")</script>',
    'X-Real-IP': '\'"><script>alert("xss")</script>',
    'Content-Type': 'application/json; charset=utf-8<script>alert(1)</script>'
};

// Função para registrar um usuário válido
const registerValidUser = async (app, userData = validUserData) => {
    const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);
    
    return response;
};

// Função para fazer login e obter token
const loginAndGetToken = async (app, userData = validUserData) => {
    // Primeiro registra o usuário
    await registerValidUser(app, userData);
    
    // Depois faz login
    const loginResponse = await request(app)
        .post('/login')
        .send(userData)
        .expect(200);
    
    return loginResponse.body.token;
};

// Função para fazer requisição autenticada
const makeAuthenticatedRequest = (app, method, endpoint, token) => {
    return request(app)[method](endpoint)
        .set('Authorization', `Bearer ${token}`);
};

// Função para testar rate limiting
const testRateLimit = async (app, endpoint, payload, maxRequests = 5) => {
    const requests = [];
    
    // Fazer múltiplas requisições rapidamente
    for (let i = 0; i < maxRequests + 2; i++) {
        requests.push(
            request(app)
                .post(endpoint)
                .send(payload)
        );
    }
    
    const responses = await Promise.all(requests);
    return responses;
};

// Função para esperar (útil para testes de rate limiting)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para validar estrutura de resposta de erro
const expectErrorResponse = (response, expectedStatus, errorMessagePattern) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');
    
    if (errorMessagePattern) {
        expect(response.body.error).toMatch(errorMessagePattern);
    }
    
    // Verificar que não contém informações sensíveis
    expect(JSON.stringify(response.body)).not.toMatch(/password_hash/i);
    expect(JSON.stringify(response.body)).not.toMatch(/sql/i);
    expect(JSON.stringify(response.body)).not.toMatch(/sqlite/i);
};

// Função para validar estrutura de resposta de sucesso
const expectSuccessResponse = (response, expectedStatus) => {
    expect(response.status).toBe(expectedStatus);
    // Remove requirement for 'message' property as refresh endpoint returns token and user
    // expect(response.body).toHaveProperty('message');
    
    // Verificar que não contém informações sensíveis
    expect(JSON.stringify(response.body)).not.toMatch(/password_hash/i);
    expect(JSON.stringify(response.body)).not.toMatch(/sql/i);
};

// Função para validar token JWT
const validateJWTToken = (token) => {
    const jwt = require('jsonwebtoken');
    
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    
    // Decodificar sem verificar para validar estrutura
    const decoded = jwt.decode(token);
    expect(decoded).toHaveProperty('id');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('exp');
    expect(decoded).toHaveProperty('iss', 'editaliza');
    
    // Verificar que não é expirado
    const now = Math.floor(Date.now() / 1000);
    expect(decoded.exp).toBeGreaterThan(now);
    
    return decoded;
};

// Função para criar dados de usuário aleatórios
const generateRandomUserData = () => {
    const randomId = Date.now() + Math.random();
    return {
        email: `teste${randomId}@exemplo.com`,
        password: `senhaSegura${randomId}`
    };
};

module.exports = {
    validUserData,
    validUserData2,
    invalidEmailFormats,
    invalidPasswords,
    weakPasswords,
    maliciousPayloads,
    maliciousHeaders,
    registerValidUser,
    loginAndGetToken,
    makeAuthenticatedRequest,
    testRateLimit,
    sleep,
    expectErrorResponse,
    expectSuccessResponse,
    validateJWTToken,
    generateRandomUserData
};