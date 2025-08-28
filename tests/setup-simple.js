/* eslint-env jest */
// tests/setup-simple.js - Configuração simplificada sem banco de dados
// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-tokens-in-testing-environment';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt-refresh-tokens';
process.env.SESSION_SECRET = 'test-session-secret-key-for-express-sessions';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

// Configurações globais de timeout para Jest
jest.setTimeout(30000);

// Setup global para testes de integração
if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
}

// Mock do banco de dados para não precisar de conexão real
jest.mock('../database-postgresql.js', () => ({
    query: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn(),
    isConnected: jest.fn(() => true),
    close: jest.fn()
}));

// Mock das utilidades de banco de dados
jest.mock('../src/utils/database.js', () => ({
    dbGet: jest.fn(() => Promise.resolve(null)),
    dbAll: jest.fn(() => Promise.resolve([])),
    dbRun: jest.fn(() => Promise.resolve({ lastID: 1, insertId: 1, changes: 1 }))
}));

// Mock do server para testes
jest.mock('../server.js', () => ({
    startServer: jest.fn(() => Promise.resolve({
        app: {
            listen: jest.fn((port, callback) => {
                if (callback) callback();
                return { close: jest.fn() };
            })
        },
        close: jest.fn()
    }))
}));

// Mock do console para evitar poluição nos testes
global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

// Utilidades globais para testes
global.testUtils = {
    mockRequest: (options = {}) => ({
        headers: {},
        body: {},
        query: {},
        params: {},
        user: null,
        session: {},
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        ...options
    }),
    
    mockResponse: () => {
        const res = {};
        res.status = jest.fn(() => res);
        res.json = jest.fn(() => res);
        res.send = jest.fn(() => res);
        res.cookie = jest.fn(() => res);
        res.clearCookie = jest.fn(() => res);
        res.redirect = jest.fn(() => res);
        return res;
    },
    
    mockNext: () => jest.fn(),
    
    createMockUser: (overrides = {}) => ({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        password_hash: '$2b$12$hashedpassword',
        role: 'user',
        created_at: new Date().toISOString(),
        ...overrides
    })
};