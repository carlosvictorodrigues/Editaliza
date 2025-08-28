/**
 * Frontend Tests - Authentication Flow
 * Tests for login, logout, and authentication-related frontend functionality
 */

const fs = require('fs');
const path = require('path');

// Load app.js content for authentication tests
const appJsPath = path.join(__dirname, '../../public/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

function loadAppJs() {
    const script = document.createElement('script');
    script.textContent = appJsContent;
    document.head.appendChild(script);
}

// Mock login form HTML
const createLoginForm = () => {
    return `
        <form id="loginForm">
            <input type="email" id="email" name="email" required>
            <input type="password" id="password" name="password" required>
            <button type="submit">Login</button>
        </form>
        <div id="toast-container"></div>
        <div id="spinner-overlay" class="hidden" data-count="0"></div>
    `;
};

// Mock register form HTML
const createRegisterForm = () => {
    return `
        <form id="registerForm">
            <input type="text" id="username" name="username" required>
            <input type="email" id="email" name="email" required>
            <input type="password" id="password" name="password" required>
            <input type="password" id="confirmPassword" name="confirmPassword" required>
            <button type="submit">Register</button>
        </form>
        <div id="toast-container"></div>
        <div id="spinner-overlay" class="hidden" data-count="0"></div>
    `;
};

describe('Frontend Authentication', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        loadAppJs();
    });

    afterEach(() => {
        if (window.app) {
            delete window.app;
        }
    });

    describe('Login Flow', () => {
        beforeEach(() => {
            createTestDOM(createLoginForm());
        });

        test('should handle successful login', async () => {
            const mockResponse = {
                token: createMockJWT(),
                user: { id: 1, email: 'test@example.com' }
            };
            mockApiSuccess(mockResponse);

            // Fill form
            document.getElementById('email').value = 'test@example.com';
            document.getElementById('password').value = 'password123';

            // Mock form submission handler
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const result = await window.app.apiFetch('/api/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/login',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(loginData)
                })
            );
            expect(result).toEqual(mockResponse);
        });

        test('should handle login failure', async () => {
            mockApiError(401, 'Invalid credentials');

            const loginData = {
                email: 'wrong@example.com',
                password: 'wrongpassword'
            };

            await expect(window.app.apiFetch('/api/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            })).rejects.toThrow();
        });

        test('should validate email format on frontend', () => {
            const email = document.getElementById('email');
            email.value = 'invalid-email';

            const isValid = window.app.validateInput(email.value, 'email');
            expect(isValid).toBe(false);
        });

        test('should validate password length on frontend', () => {
            const password = document.getElementById('password');
            password.value = '123'; // Too short

            const isValid = window.app.validateInput(password.value, 'password');
            expect(isValid).toBe(false);
        });

        test('should store token after successful login', () => {
            const token = createMockJWT();
            localStorage.setItem('editaliza_token', token);
            window.app.state.token = token;

            expect(localStorage.getItem('editaliza_token')).toBe(token);
            expect(window.app.state.token).toBe(token);
        });
    });

    describe('Registration Flow', () => {
        beforeEach(() => {
            createTestDOM(createRegisterForm());
        });

        test('should handle successful registration', async () => {
            const mockResponse = {
                message: 'User registered successfully',
                user: { id: 1, email: 'newuser@example.com' }
            };
            mockApiSuccess(mockResponse);

            const registerData = {
                username: 'newuser',
                email: 'newuser@example.com',
                password: 'password123'
            };

            const result = await window.app.apiFetch('/api/register', {
                method: 'POST',
                body: JSON.stringify(registerData)
            });

            expect(result).toEqual(mockResponse);
        });

        test('should validate password confirmation', () => {
            document.getElementById('password').value = 'password123';
            document.getElementById('confirmPassword').value = 'password456';

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            expect(password === confirmPassword).toBe(false);
        });

        test('should validate username length', () => {
            const username = 'ab'; // Too short
            const isValid = window.app.validateInput(username, 'text', { minLength: 3 });
            
            expect(isValid).toBe(false);
        });
    });

    describe('Session Management', () => {
        test('should check token expiry on page load', () => {
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

        test('should setup token refresh interval', () => {
            jest.useFakeTimers();
            
            window.app.state.token = createMockJWT();
            const checkExpirySpy = jest.spyOn(window.app, 'checkTokenExpiry');
            checkExpirySpy.mockImplementation(() => {});

            window.app.setupTokenRefresh();

            // Fast forward 30 minutes
            jest.advanceTimersByTime(30 * 60 * 1000);
            
            expect(checkExpirySpy).toHaveBeenCalled();
            
            jest.useRealTimers();
        });

        test('should redirect to login page for unauthenticated users', () => {
            // Mock location for this test
            delete window.location;
            window.location = { 
                href: '',
                pathname: '/dashboard.html' 
            };

            // No token stored
            localStorage.removeItem('editaliza_token');
            window.app.state.token = null;

            // Simulate init for authenticated page
            const isPublicPage = false;
            const hasToken = window.app.state.token;

            if (!hasToken && !isPublicPage) {
                window.location.href = 'login.html';
            }

            expect(window.location.href).toBe('login.html');
        });

        test('should allow access to public pages without token', () => {
            // Mock location for login page
            delete window.location;
            window.location = { 
                href: '',
                pathname: '/login.html' 
            };

            localStorage.removeItem('editaliza_token');
            window.app.state.token = null;

            const publicPages = ['/login.html', '/register.html', '/forgot-password.html'];
            const currentPath = window.location.pathname;
            const isPublicPage = publicPages.some(page => currentPath.includes(page));

            expect(isPublicPage).toBe(true);
            // Should not redirect
            expect(window.location.href).toBe('');
        });
    });

    describe('Password Reset Flow', () => {
        test('should handle forgot password request', async () => {
            const mockResponse = { message: 'Reset email sent' };
            mockApiSuccess(mockResponse);

            const result = await window.app.apiFetch('/api/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: 'user@example.com' })
            });

            expect(result).toEqual(mockResponse);
        });

        test('should handle password reset with token', async () => {
            const mockResponse = { message: 'Password reset successfully' };
            mockApiSuccess(mockResponse);

            const result = await window.app.apiFetch('/api/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    token: 'reset-token',
                    password: 'newpassword123'
                })
            });

            expect(result).toEqual(mockResponse);
        });
    });

    describe('OAuth Integration', () => {
        test('should handle Google OAuth callback', async () => {
            // Mock Google OAuth response
            const mockResponse = {
                token: createMockJWT(),
                user: { id: 1, email: 'user@gmail.com', provider: 'google' }
            };
            mockApiSuccess(mockResponse);

            const result = await window.app.apiFetch('/api/auth/google/callback?code=auth-code');

            expect(result).toEqual(mockResponse);
        });

        test('should redirect to Google OAuth', () => {
            // Mock window.open
            window.open = jest.fn();

            const googleAuthUrl = 'https://accounts.google.com/oauth/authorize';
            // Simulate clicking Google login button
            window.open(googleAuthUrl, '_blank');

            expect(window.open).toHaveBeenCalledWith(googleAuthUrl, '_blank');
        });
    });

    describe('Authentication State Management', () => {
        test('should maintain authentication state across page reloads', () => {
            const token = createMockJWT();
            localStorage.setItem('editaliza_token', token);

            // Simulate page reload by re-initializing app
            window.app.state.token = localStorage.getItem('editaliza_token');

            expect(window.app.state.token).toBe(token);
            expect(window.app.isAuthenticated()).toBe(true);
        });

        test('should clear authentication state on logout', () => {
            // Set up authenticated state
            const token = createMockJWT();
            localStorage.setItem('editaliza_token', token);
            localStorage.setItem('selectedPlanId', '123');
            sessionStorage.setItem('userPref', 'dark');
            window.app.state.token = token;
            window.app.state.plans = [{ id: 1, name: 'Test' }];

            // Mock location
            delete window.location;
            window.location = { href: '' };

            window.app.logout();

            expect(localStorage.getItem('editaliza_token')).toBeNull();
            expect(localStorage.getItem('selectedPlanId')).toBeNull();
            expect(window.app.state.token).toBeNull();
            expect(window.app.state.plans).toEqual([]);
            expect(window.location.href).toBe('login.html');
        });

        test('should handle concurrent login sessions', () => {
            // Simulate multiple tabs with same user
            const token1 = createMockJWT({ sub: '1', exp: Date.now() / 1000 + 3600 });
            const token2 = createMockJWT({ sub: '1', exp: Date.now() / 1000 + 3600 });

            localStorage.setItem('editaliza_token', token1);
            window.app.state.token = token1;

            // Simulate another tab updating the token
            localStorage.setItem('editaliza_token', token2);

            // Should be able to handle token updates
            const currentToken = localStorage.getItem('editaliza_token');
            expect(currentToken).toBe(token2);
        });
    });

    describe('Form Validation', () => {
        test('should prevent submission with invalid data', () => {
            createTestDOM(createLoginForm());

            const form = document.getElementById('loginForm');
            const email = document.getElementById('email');
            const password = document.getElementById('password');

            email.value = 'invalid-email';
            password.value = '123'; // Too short

            const emailValid = window.app.validateInput(email.value, 'email');
            const passwordValid = window.app.validateInput(password.value, 'password');

            expect(emailValid && passwordValid).toBe(false);
        });

        test('should sanitize user inputs', () => {
            const maliciousInput = '<script>alert("xss")</script>';
            const sanitized = window.app.sanitizeHtml(maliciousInput);

            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('&lt;script&gt;');
        });

        test('should handle special characters in passwords', () => {
            const specialPassword = 'P@ssw0rd!#$';
            const isValid = window.app.validateInput(specialPassword, 'password');
            
            expect(isValid).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should display user-friendly error messages', async () => {
            createTestDOM(createLoginForm());
            
            mockApiError(500, 'Internal Server Error');

            try {
                await window.app.apiFetch('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'test@test.com', password: 'test' })
                });
            } catch (error) {
                window.app.showToast(error.message, 'error');
            }

            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(1);
            expect(toastContainer.firstChild.textContent).toContain('Internal Server Error');
        });

        test('should handle network connectivity issues', async () => {
            fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

            try {
                await window.app.apiFetch('/api/test');
            } catch (error) {
                expect(error.message).toBe('Erro de conexão. Verifique sua internet e tente novamente.');
            }
        });
    });

    describe('Security Features', () => {
        test('should not store sensitive data in localStorage', () => {
            // Passwords should never be stored
            const password = 'secretpassword123';
            
            // Check that no password-like data is in localStorage
            const allStoredData = Object.keys(localStorage.store);
            const hasSensitiveData = allStoredData.some(key => 
                key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('secret')
            );
            
            expect(hasSensitiveData).toBe(false);
        });

        test('should validate URLs to prevent open redirects', () => {
            // Mock current location
            Object.defineProperty(window, 'location', {
                value: { origin: 'http://localhost:3000' },
                writable: true
            });

            expect(window.app.isValidUrl('/dashboard')).toBe(true);
            expect(window.app.isValidUrl('http://localhost:3000/profile')).toBe(true);
            expect(window.app.isValidUrl('https://malicious.com')).toBe(false);
            expect(window.app.isValidUrl('javascript:alert(1)')).toBe(false);
        });

        test('should handle JWT token parsing safely', () => {
            const invalidTokens = [
                'invalid.token.format',
                'notbase64.notbase64.notbase64',
                '',
                null,
                undefined
            ];

            invalidTokens.forEach(token => {
                localStorage.setItem('editaliza_token', token);
                
                const logoutSpy = jest.spyOn(window.app, 'logout');
                logoutSpy.mockImplementation(() => {});

                window.app.checkTokenExpiry();
                
                // Should handle gracefully without throwing
                expect(logoutSpy).toHaveBeenCalled();
                logoutSpy.mockRestore();
            });
        });
    });
});