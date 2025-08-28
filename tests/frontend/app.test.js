/**
 * Frontend Tests - Core App.js
 * Tests for the main application logic, authentication, and utilities
 */

// Load the app.js file
const fs = require('fs');
const path = require('path');

// Load app.js content and evaluate it in the test environment
const appJsPath = path.join(__dirname, '../../public/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Create a script element to load app.js in JSDOM
function loadAppJs() {
    const script = document.createElement('script');
    script.textContent = appJsContent;
    document.head.appendChild(script);
}

describe('App.js Core Functionality', () => {
    beforeEach(() => {
        // Reset DOM and load app.js
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        loadAppJs();
    });

    afterEach(() => {
        // Clean up global app object
        if (window.app) {
            delete window.app;
        }
    });

    describe('App Initialization', () => {
        test('should initialize app object with default state', () => {
            expect(window.app).toBeDefined();
            expect(window.app.state).toBeDefined();
            expect(window.app.state.token).toBeNull();
            expect(window.app.state.plans).toEqual([]);
            expect(window.app.state.activePlanId).toBeNull();
        });

        test('should have correct configuration', () => {
            expect(window.app.config).toBeDefined();
            expect(window.app.config.apiUrl).toBe('http://localhost:3000');
            expect(window.app.config.tokenKey).toBe('editaliza_token');
            expect(window.app.config.planKey).toBe('selectedPlanId');
        });

        test('should have notification configuration', () => {
            expect(window.app.config.notifications).toBeDefined();
            expect(window.app.config.notifications.enabled).toBe(true);
            expect(window.app.config.notifications.maxPerDay).toBe(6);
        });
    });

    describe('Authentication', () => {
        test('isAuthenticated should return false with no token', () => {
            expect(window.app.isAuthenticated()).toBe(false);
        });

        test('isAuthenticated should return true with valid token', () => {
            const validToken = createMockJWT();
            localStorage.setItem('editaliza_token', validToken);
            window.app.state.token = validToken;
            
            expect(window.app.isAuthenticated()).toBe(true);
        });

        test('isAuthenticated should return false with expired token', () => {
            const expiredToken = createMockJWT({ 
                sub: '1', 
                exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
            });
            localStorage.setItem('editaliza_token', expiredToken);
            window.app.state.token = expiredToken;
            
            expect(window.app.isAuthenticated()).toBe(false);
        });

        test('logout should clear all stored data', () => {
            // Set up some data
            localStorage.setItem('editaliza_token', 'test-token');
            localStorage.setItem('selectedPlanId', '123');
            sessionStorage.setItem('test', 'data');
            window.app.state.token = 'test-token';

            // Mock window.location.href
            delete window.location;
            window.location = { href: '' };

            window.app.logout();

            expect(localStorage.getItem('editaliza_token')).toBeNull();
            expect(localStorage.getItem('selectedPlanId')).toBeNull();
            expect(window.app.state.token).toBeNull();
            expect(window.location.href).toBe('login.html');
        });
    });

    describe('API Utilities', () => {
        test('apiFetch should make requests with proper headers', async () => {
            const mockData = { success: true };
            mockApiSuccess(mockData);
            
            window.app.state.token = 'test-token';
            
            const result = await window.app.apiFetch('/api/test');
            
            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-token'
                    })
                })
            );
            expect(result).toEqual(mockData);
        });

        test('apiFetch should handle 401 responses by logging out', async () => {
            mockApiError(401, 'Unauthorized');
            
            // Mock logout function
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            window.app.state.token = 'invalid-token';
            
            await expect(window.app.apiFetch('/api/test')).rejects.toThrow();
            expect(logoutSpy).toHaveBeenCalled();
        });

        test('apiFetch should handle network errors gracefully', async () => {
            fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
            
            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'Erro de conexão. Verifique sua internet e tente novamente.'
            );
        });
    });

    describe('Input Validation', () => {
        test('validateInput should validate email addresses', () => {
            expect(window.app.validateInput('test@example.com', 'email')).toBe(true);
            expect(window.app.validateInput('invalid-email', 'email')).toBe(false);
            expect(window.app.validateInput('test@', 'email')).toBe(false);
        });

        test('validateInput should validate passwords', () => {
            expect(window.app.validateInput('123456', 'password')).toBe(true);
            expect(window.app.validateInput('12345', 'password')).toBe(false);
            expect(window.app.validateInput('longpassword', 'password', { minLength: 8 })).toBe(true);
        });

        test('validateInput should validate numbers', () => {
            expect(window.app.validateInput('10', 'number')).toBe(true);
            expect(window.app.validateInput('10', 'number', { min: 5, max: 15 })).toBe(true);
            expect(window.app.validateInput('20', 'number', { min: 5, max: 15 })).toBe(false);
            expect(window.app.validateInput('abc', 'number')).toBe(false);
        });

        test('validateInput should validate text length', () => {
            expect(window.app.validateInput('hello', 'text', { minLength: 3, maxLength: 10 })).toBe(true);
            expect(window.app.validateInput('hi', 'text', { minLength: 3 })).toBe(false);
            expect(window.app.validateInput('verylongtext', 'text', { maxLength: 5 })).toBe(false);
        });
    });

    describe('Security Functions', () => {
        test('sanitizeHtml should escape HTML entities', () => {
            const maliciousHtml = '<script>alert("xss")</script>';
            const sanitized = window.app.sanitizeHtml(maliciousHtml);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('&lt;script&gt;');
        });

        test('isValidUrl should validate URLs correctly', () => {
            // Mock location for this test
            Object.defineProperty(window, 'location', {
                value: { origin: 'http://localhost:3000' },
                writable: true
            });

            expect(window.app.isValidUrl('/dashboard')).toBe(true);
            expect(window.app.isValidUrl('http://localhost:3000/profile')).toBe(true);
            expect(window.app.isValidUrl('https://evil.com')).toBe(false);
            expect(window.app.isValidUrl('javascript:alert(1)')).toBe(false);
        });
    });

    describe('Local Storage Utilities', () => {
        test('saveLocal should encrypt and save data', () => {
            const testData = { test: 'data' };
            window.app.saveLocal('testkey', testData);
            
            const stored = localStorage.getItem('editaliza_testkey');
            expect(stored).toBeDefined();
            expect(stored).not.toBe(JSON.stringify(testData)); // Should be encoded
        });

        test('getLocal should decrypt and retrieve data', () => {
            const testData = { test: 'data' };
            window.app.saveLocal('testkey', testData);
            
            const retrieved = window.app.getLocal('testkey');
            expect(retrieved).toEqual(testData);
        });

        test('getLocal should return null for non-existent keys', () => {
            const retrieved = window.app.getLocal('nonexistent');
            expect(retrieved).toBeNull();
        });
    });

    describe('Subject Style Generation', () => {
        test('should return predefined styles for known subjects', () => {
            const style = window.app.getSubjectStyle('Constitucional');
            expect(style.color).toBe('border-green-500');
            expect(style.icon).toBe('⚖️');
        });

        test('should return consistent random styles for unknown subjects', () => {
            const style1 = window.app.getSubjectStyle('Unknown Subject');
            const style2 = window.app.getSubjectStyle('Unknown Subject');
            
            expect(style1.color).toBe(style2.color); // Should be consistent
            expect(style1.icon).toBe('📚');
        });

        test('should handle empty subject names', () => {
            const style = window.app.getSubjectStyle('');
            expect(style.color).toBe('border-gray-400');
            expect(style.icon).toBe('📚');
        });
    });

    describe('Toast Notifications', () => {
        test('should create and display toast messages', () => {
            // Create toast container
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);

            window.app.showToast('Test message', 'success');

            expect(toastContainer.children.length).toBe(1);
            const toast = toastContainer.firstChild;
            expect(toast.textContent).toContain('Test message');
            expect(toast.textContent).toContain('✓');
        });

        test('should handle error toasts with different styling', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);

            window.app.showToast('Error message', 'error');

            const toast = toastContainer.firstChild;
            expect(toast.textContent).toContain('Error message');
            expect(toast.textContent).toContain('✕');
            expect(toast.className).toContain('bg-red-500');
        });

        test('should sanitize toast messages', () => {
            const toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);

            window.app.showToast('<script>alert("xss")</script>', 'success');

            const toast = toastContainer.firstChild;
            expect(toast.innerHTML).not.toContain('<script>');
            expect(toast.innerHTML).toContain('&lt;script&gt;');
        });
    });

    describe('Spinner Management', () => {
        test('should show and hide spinner correctly', () => {
            const spinner = document.createElement('div');
            spinner.id = 'spinner-overlay';
            spinner.className = 'hidden';
            spinner.dataset.count = '0';
            document.body.appendChild(spinner);

            window.app.showSpinner();
            expect(spinner.classList.contains('hidden')).toBe(false);
            expect(spinner.dataset.count).toBe('1');

            window.app.hideSpinner();
            expect(spinner.classList.contains('hidden')).toBe(true);
            expect(spinner.dataset.count).toBe('0');
        });

        test('should handle multiple spinner calls correctly', () => {
            const spinner = document.createElement('div');
            spinner.id = 'spinner-overlay';
            spinner.className = 'hidden';
            spinner.dataset.count = '0';
            document.body.appendChild(spinner);

            window.app.showSpinner();
            window.app.showSpinner();
            expect(spinner.dataset.count).toBe('2');
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();
            expect(spinner.dataset.count).toBe('1');
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();
            expect(spinner.dataset.count).toBe('0');
            expect(spinner.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Debounce Utility', () => {
        test('should debounce function calls', (done) => {
            let callCount = 0;
            const debouncedFn = window.app.debounce(() => {
                callCount++;
            }, 100);

            debouncedFn();
            debouncedFn();
            debouncedFn();

            expect(callCount).toBe(0);

            setTimeout(() => {
                expect(callCount).toBe(1);
                done();
            }, 150);
        });
    });

    describe('Token Expiry Handling', () => {
        test('checkTokenExpiry should logout with expired token', () => {
            const expiredToken = createMockJWT({ 
                sub: '1', 
                exp: Math.floor(Date.now() / 1000) - 3600 
            });
            localStorage.setItem('editaliza_token', expiredToken);
            
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            window.app.checkTokenExpiry();
            expect(logoutSpy).toHaveBeenCalled();
        });

        test('checkTokenExpiry should not logout with valid token', () => {
            const validToken = createMockJWT();
            localStorage.setItem('editaliza_token', validToken);
            
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            window.app.checkTokenExpiry();
            expect(logoutSpy).not.toHaveBeenCalled();
        });

        test('checkTokenExpiry should logout with invalid token format', () => {
            localStorage.setItem('editaliza_token', 'invalid-token-format');
            
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            window.app.checkTokenExpiry();
            expect(logoutSpy).toHaveBeenCalled();
        });
    });

    describe('Plan Management', () => {
        test('getPlans should return cached plans when available', async () => {
            window.app.state.plans = [{ id: 1, name: 'Test Plan' }];
            
            const plans = await window.app.getPlans();
            expect(plans).toEqual([{ id: 1, name: 'Test Plan' }]);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('getPlans should fetch plans when cache is empty', async () => {
            const mockPlans = [{ id: 1, name: 'Test Plan' }];
            mockApiSuccess(mockPlans);
            window.app.state.token = 'test-token';

            const plans = await window.app.getPlans();
            
            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/plans',
                expect.any(Object)
            );
            expect(plans).toEqual(mockPlans);
            expect(window.app.state.plans).toEqual(mockPlans);
        });

        test('getPlans should force refresh when requested', async () => {
            window.app.state.plans = [{ id: 1, name: 'Old Plan' }];
            const mockPlans = [{ id: 1, name: 'New Plan' }];
            mockApiSuccess(mockPlans);
            window.app.state.token = 'test-token';

            const plans = await window.app.getPlans(true);
            
            expect(fetch).toHaveBeenCalled();
            expect(plans).toEqual(mockPlans);
        });
    });
});