/**
 * Global Test Setup
 * Configures environment and shared test utilities
 */

const path = require('path');

// Setup environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.PORT = '0'; // Random available port

// Global test timeout
jest.setTimeout(10000);

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Keep log and error for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

// Global test utilities
global.testUtils = {
  /**
   * Create a mock request object
   */
  mockRequest: (overrides = {}) => ({
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    session: {},
    user: null,
    ...overrides
  }),

  /**
   * Create a mock response object
   */
  mockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    return res;
  },

  /**
   * Create a mock next function
   */
  mockNext: () => jest.fn(),

  /**
   * Wait for a promise to resolve/reject
   */
  waitFor: async (fn, timeout = 1000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (error) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('waitFor timeout');
  },

  /**
   * Generate test user data
   */
  generateTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    phone: '11999999999',
    occupation: 'Tester',
    ...overrides
  }),

  /**
   * Generate test JWT payload
   */
  generateJWTPayload: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  })
};

// Global cleanup
afterAll(async () => {
  // Clean up any global resources
  if (global.testDatabase) {
    await global.testDatabase.close();
  }
});

module.exports = {};