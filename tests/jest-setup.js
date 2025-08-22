// tests/jest-setup.js - Configurações customizadas para Jest
const { toBeOneOf } = require('jest-extended');

// Setup environment variables for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

// Adicionar matcher customizado
expect.extend({
    toBeOneOf
});

// Adicionar timeout global mais longo para testes de integração
jest.setTimeout(10000);