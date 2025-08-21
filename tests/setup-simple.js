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
jest.setTimeout(10000);

// Mock do banco de dados para não precisar de conexão real
jest.mock('../database-postgresql.js', () => ({
    query: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn(),
    isConnected: jest.fn(() => true),
    close: jest.fn()
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