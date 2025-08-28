/**
 * Frontend Test Setup - Ultra Simplified
 * Configure JSDOM environment and global mocks for frontend testing
 */

// Mock global browser APIs
global.fetch = jest.fn();
global.Request = jest.fn();
global.Response = jest.fn();

// Mock localStorage
const localStorageMock = {
    store: {},
    getItem: jest.fn((key) => localStorageMock.store[key] || null),
    setItem: jest.fn((key, value) => {
        localStorageMock.store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
        delete localStorageMock.store[key];
    }),
    clear: jest.fn(() => {
        localStorageMock.store = {};
    }),
    key: jest.fn((index) => Object.keys(localStorageMock.store)[index] || null),
    get length() {
        return Object.keys(localStorageMock.store).length;
    }
};

// Mock sessionStorage
const sessionStorageMock = {
    store: {},
    getItem: jest.fn((key) => sessionStorageMock.store[key] || null),
    setItem: jest.fn((key, value) => {
        sessionStorageMock.store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
        delete sessionStorageMock.store[key];
    }),
    clear: jest.fn(() => {
        sessionStorageMock.store = {};
    }),
    key: jest.fn((index) => Object.keys(sessionStorageMock.store)[index] || null),
    get length() {
        return Object.keys(sessionStorageMock.store).length;
    }
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock
});

// Mock timers
jest.useFakeTimers();

// Mock DOM methods
HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));

// Clean up after each test
afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear localStorage and sessionStorage
    localStorageMock.clear();
    sessionStorageMock.clear();
    
    // Clear fetch mock
    fetch.mockClear();
    
    // Clear document body
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Clear any timers
    jest.clearAllTimers();
    
    // Clean up global objects
    if (window.app) delete window.app;
    if (window.components) delete window.components;
    if (window.StudyChecklist) delete window.StudyChecklist;
    if (window.TimerSystem) delete window.TimerSystem;
});

// Helper function to create mock JWT token
global.createMockJWT = (payload = { sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 }) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadB64 = btoa(JSON.stringify(payload));
    const signature = 'mock-signature';
    return `${header}.${payloadB64}.${signature}`;
};

// Helper function to create DOM elements for testing
global.createTestDOM = (htmlContent) => {
    document.body.innerHTML = htmlContent;
};

// Helper function to wait for DOM updates
global.waitForDOM = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to mock successful API response
global.mockApiSuccess = (data) => {
    fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => data,
        headers: new Headers({ 'content-type': 'application/json' })
    });
};

// Helper to mock API error
global.mockApiError = (status = 500, message = 'Server Error') => {
    fetch.mockResolvedValueOnce({
        ok: false,
        status,
        statusText: message,
        json: async () => ({ error: message }),
        headers: new Headers({ 'content-type': 'application/json' })
    });
};