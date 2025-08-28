/**
 * Jest Configuration for Frontend Testing
 * Tests JavaScript code that runs in the browser environment
 */

module.exports = {
    // Use jsdom environment to simulate browser
    testEnvironment: 'jsdom',
    
    // Test files pattern for frontend tests
    testMatch: [
        '<rootDir>/tests/frontend/**/*.test.js'
    ],
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/backup-before-cackto-2025-*/',
        '<rootDir>/tests/legacy/',
        '<rootDir>/tests/manual/'
    ],
    
    // Setup files for frontend testing
    setupFilesAfterEnv: [
        '<rootDir>/tests/frontend/setup/frontend-setup.js'
    ],
    
    // Module paths for frontend code
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/public/js/$1'
    },
    
    // Coverage collection from frontend files
    collectCoverageFrom: [
        'public/js/**/*.js',
        '!public/js/**/*.test.js',
        '!public/js/nonce-generator.js',
        '!public/js/force-light-mode.js'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Coverage directory
    coverageDirectory: 'coverage/frontend',
    
    // Coverage reporters
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    
    // Test timeout
    testTimeout: 15000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks after each test
    restoreMocks: true
};