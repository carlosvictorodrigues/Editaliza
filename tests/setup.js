// tests/setup.js - Configuração global para testes
const { createTestDatabase, closeTestDatabase, clearTestDatabase } = require('./database-test');

// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens-in-testing-environment';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt-refresh-tokens';
process.env.SESSION_SECRET = 'test-session-secret-key-for-express-sessions';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
process.env.RATE_LIMIT_WINDOW_MS = '900000'; // 15 minutos
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // Mais permissivo para testes

// Configurações globais de timeout para Jest
jest.setTimeout(30000);

// Setup antes de todos os testes
beforeAll(async () => {
    // Inicializar banco de dados de teste
    await createTestDatabase();
});

// Limpeza após cada teste
afterEach(async () => {
    // Limpar dados do banco de teste entre os testes
    await clearTestDatabase();
});

// Limpeza após todos os testes
afterAll(async () => {
    // Fechar conexão com banco de dados de teste
    await closeTestDatabase();
});

// Função utilitária para criar usuário de teste
const createTestUser = async (email = 'test@example.com', password = 'testpass123') => {
    const bcrypt = require('bcryptjs');
    const { dbRun } = require('./database-test');
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await dbRun(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        [email, hashedPassword]
    );
    
    return {
        id: result.lastID,
        email,
        password // senha em texto plano para usar nos testes
    };
};

// Função utilitária para gerar token JWT válido
const generateTestToken = (userId, email) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: '24h', issuer: 'editaliza' }
    );
};

// Função utilitária para fazer requisições autenticadas
const authenticatedRequest = (request, token) => {
    return request.set('Authorization', `Bearer ${token}`);
};

// Mock do console para testes mais limpos (opcional)
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
    // Silenciar logs de erro durante os testes (descomente se necessário)
    // console.error = jest.fn();
    // console.log = jest.fn();
});

afterAll(() => {
    // Restaurar console original
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
});

// Exportar utilitários para uso nos testes
global.testUtils = {
    createTestUser,
    generateTestToken,
    authenticatedRequest
};