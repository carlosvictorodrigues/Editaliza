/**
 * FASE 9 - INTEGRATION TESTS: AUTHENTICATION
 * 
 * Teste completo do sistema de autenticação:
 * - Login/logout com validações
 * - Registro de usuários
 * - Reset de senha
 * - Tokens JWT
 * - Google OAuth
 * - Rate limiting
 * - CSRF protection
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('🔐 Authentication Integration Tests', () => {
    let testUser;
    let authToken;
    let testServer;

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear test data
        await dbRun('DELETE FROM users WHERE email LIKE %test%');
        
        // Create test user
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        const result = await dbRun(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            ['test.auth@editaliza.com', hashedPassword, 'Test User', 'user']
        );
        
        testUser = {
            id: result.rows[0].id,
            email: 'test.auth@editaliza.com',
            password: 'TestPassword123!',
            name: 'Test User'
        };
    });

    afterAll(async () => {
        // Clean up test data
        if (testUser) {
            await dbRun('DELETE FROM users WHERE id = $1', [testUser.id]);
        }
        
        // Close server
        if (testServer) {
            await new Promise(resolve => testServer.close(resolve));
        }
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const newUser = {
                email: 'newuser.test@editaliza.com',
                password: 'NewUser123!',
                confirmPassword: 'NewUser123!',
                name: 'New Test User'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', newUser.email);
            expect(response.body.user).toHaveProperty('name', newUser.name);
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.tokens).toHaveProperty('accessToken');
            expect(response.body.tokens).toHaveProperty('refreshToken');

            // Verify user was created in database
            const dbUser = await dbGet('SELECT * FROM users WHERE email = $1', [newUser.email]);
            expect(dbUser).toBeTruthy();
            expect(dbUser.email).toBe(newUser.email);

            // Verify password was hashed
            expect(dbUser.password_hash).not.toBe(newUser.password);
            const isValidPassword = await bcrypt.compare(newUser.password, dbUser.password_hash);
            expect(isValidPassword).toBe(true);

            // Clean up
            await dbRun('DELETE FROM users WHERE id = $1', [dbUser.id]);
        }, 15000);

        it('should reject registration with invalid email', async () => {
            const invalidUser = {
                email: 'invalid-email',
                password: 'TestPassword123!',
                confirmPassword: 'TestPassword123!',
                name: 'Test User'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(invalidUser)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            expect(response.body.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'email',
                        message: expect.stringContaining('Email inválido')
                    })
                ])
            );
        });

        it('should reject registration with weak password', async () => {
            const weakPasswordUser = {
                email: 'weak.password@editaliza.com',
                password: '123',
                confirmPassword: '123',
                name: 'Test User'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(weakPasswordUser)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            expect(response.body.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'password'
                    })
                ])
            );
        });

        it('should reject registration with existing email', async () => {
            const duplicateUser = {
                email: testUser.email,
                password: 'TestPassword123!',
                confirmPassword: 'TestPassword123!',
                name: 'Duplicate User'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(duplicateUser)
                .expect(409);

            expect(response.body).toHaveProperty('error', 'Email já está em uso');
            expect(response.body).toHaveProperty('code', 'EMAIL_ALREADY_EXISTS');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const loginData = {
                email: testUser.email,
                password: testUser.password
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.tokens).toHaveProperty('accessToken');
            expect(response.body.tokens).toHaveProperty('refreshToken');

            // Store token for other tests
            authToken = response.body.tokens.accessToken;

            // Check if cookies were set
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const authCookie = cookies.find(cookie => cookie.startsWith('authToken='));
            const refreshCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
            expect(authCookie).toBeDefined();
            expect(refreshCookie).toBeDefined();
        });

        it('should reject login with invalid email', async () => {
            const invalidLogin = {
                email: 'nonexistent@editaliza.com',
                password: testUser.password
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(invalidLogin)
                .expect(401);

            expect(response.body).toHaveProperty('error', 'Email ou senha incorretos');
            expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
        });

        it('should reject login with invalid password', async () => {
            const invalidLogin = {
                email: testUser.email,
                password: 'WrongPassword123!'
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(invalidLogin)
                .expect(401);

            expect(response.body).toHaveProperty('error', 'Email ou senha incorretos');
            expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
        });

        it('should reject login with malformed email', async () => {
            const malformedLogin = {
                email: 'not-an-email',
                password: testUser.password
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(malformedLogin)
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user data when authenticated', async () => {
            if (!authToken) {
                // Login first to get token
                const loginResponse = await request(testServer)
                    .post('/api/auth/login')
                    .send({
                        email: testUser.email,
                        password: testUser.password
                    });
                authToken = loginResponse.body.tokens.accessToken;
            }

            const response = await request(testServer)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
            expect(response.body.user).toHaveProperty('name', testUser.name);
            expect(response.body.user).not.toHaveProperty('password');
            expect(response.body.user).not.toHaveProperty('password_hash');
        });

        it('should reject request without authentication', async () => {
            const response = await request(testServer)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(testServer)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully when authenticated', async () => {
            if (!authToken) {
                // Login first to get token
                const loginResponse = await request(testServer)
                    .post('/api/auth/login')
                    .send({
                        email: testUser.email,
                        password: testUser.password
                    });
                authToken = loginResponse.body.tokens.accessToken;
            }

            const response = await request(testServer)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', 'Logout realizado com sucesso');

            // Check if cookies were cleared
            const cookies = response.headers['set-cookie'];
            if (cookies) {
                const authCookie = cookies.find(cookie => cookie.startsWith('authToken='));
                const refreshCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
                
                if (authCookie) {
                    expect(authCookie).toContain('authToken=;');
                }
                if (refreshCookie) {
                    expect(refreshCookie).toContain('refreshToken=;');
                }
            }
        });

        it('should reject logout without authentication', async () => {
            const response = await request(testServer)
                .post('/api/auth/logout')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Password Reset Flow', () => {
        it('should handle password reset request', async () => {
            const response = await request(testServer)
                .post('/api/auth/request-password-reset')
                .send({ email: testUser.email })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            
            // In development mode, reset token should be included
            if (process.env.NODE_ENV !== 'production') {
                expect(response.body).toHaveProperty('resetToken');
            }

            // Verify reset token was stored in database
            const dbUser = await dbGet(
                'SELECT reset_token, reset_token_expires FROM users WHERE email = $1',
                [testUser.email]
            );
            expect(dbUser.reset_token).toBeTruthy();
            expect(dbUser.reset_token_expires).toBeTruthy();
        });

        it('should reset password with valid token', async () => {
            // First, request password reset
            const resetRequestResponse = await request(testServer)
                .post('/api/auth/request-password-reset')
                .send({ email: testUser.email });

            let resetToken;
            if (process.env.NODE_ENV !== 'production') {
                resetToken = resetRequestResponse.body.resetToken;
            } else {
                // In production, get token from database
                const dbUser = await dbGet(
                    'SELECT reset_token FROM users WHERE email = $1',
                    [testUser.email]
                );
                resetToken = dbUser.reset_token;
            }

            const newPassword = 'NewPassword123!';
            const response = await request(testServer)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken,
                    password: newPassword,
                    confirmPassword: newPassword
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify password was updated and token was cleared
            const dbUser = await dbGet(
                'SELECT password_hash, reset_token, reset_token_expires FROM users WHERE email = $1',
                [testUser.email]
            );
            
            const isNewPasswordValid = await bcrypt.compare(newPassword, dbUser.password_hash);
            expect(isNewPasswordValid).toBe(true);
            expect(dbUser.reset_token).toBeNull();
            expect(dbUser.reset_token_expires).toBeNull();

            // Update testUser password for other tests
            testUser.password = newPassword;
        });

        it('should reject password reset with invalid token', async () => {
            const response = await request(testServer)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    password: 'NewPassword123!',
                    confirmPassword: 'NewPassword123!'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Token inválido ou expirado');
            expect(response.body).toHaveProperty('code', 'INVALID_RESET_TOKEN');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limiting on login attempts', async () => {
            const loginData = {
                email: 'nonexistent@editaliza.com',
                password: 'WrongPassword123!'
            };

            // Make multiple failed login attempts
            const attempts = [];
            const maxAttempts = process.env.NODE_ENV === 'production' ? 6 : 51; // Slightly over the limit

            for (let i = 0; i < maxAttempts; i++) {
                attempts.push(
                    request(testServer)
                        .post('/api/auth/login')
                        .send(loginData)
                );
            }

            const responses = await Promise.all(attempts);
            
            // At least the last few should be rate limited
            const rateLimitedResponses = responses.filter(res => res.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);

            if (rateLimitedResponses.length > 0) {
                expect(rateLimitedResponses[0].body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
                expect(rateLimitedResponses[0].body).toHaveProperty('retryAfter');
            }
        }, 30000);
    });

    describe('CSRF Protection', () => {
        it('should provide CSRF token', async () => {
            const response = await request(testServer)
                .get('/api/auth/csrf-token')
                .expect(200);

            expect(response.body).toHaveProperty('csrfToken');
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('Health Check', () => {
        it('should return auth system health status', async () => {
            const response = await request(testServer)
                .get('/api/auth/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('features');
            expect(response.body.features).toHaveProperty('registration');
            expect(response.body.features).toHaveProperty('googleOAuth');
            expect(response.body.features).toHaveProperty('passwordReset');
            expect(response.body.features).toHaveProperty('csrf');
        });
    });

    describe('Edge Cases & Security', () => {
        it('should handle SQL injection attempts safely', async () => {
            const maliciousLogin = {
                email: "'; DROP TABLE users; --",
                password: 'password'
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(maliciousLogin)
                .expect(400);

            // Should reject due to email validation, not cause SQL injection
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');

            // Verify users table still exists
            const users = await dbAll('SELECT COUNT(*) as count FROM users');
            expect(users[0].count).toBeGreaterThan(0);
        });

        it('should handle XSS attempts safely', async () => {
            const xssAttempt = {
                email: 'xss@test.com',
                password: 'TestPassword123!',
                confirmPassword: 'TestPassword123!',
                name: '<script>alert("XSS")</script>'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(xssAttempt);

            if (response.status === 201) {
                // If registration succeeded, name should be sanitized
                expect(response.body.user.name).not.toContain('<script>');
                
                // Clean up
                await dbRun('DELETE FROM users WHERE email = $1', [xssAttempt.email]);
            }
        });

        it('should handle extremely long inputs', async () => {
            const longString = 'a'.repeat(10000);
            const longInputUser = {
                email: longString + '@test.com',
                password: 'TestPassword123!',
                confirmPassword: 'TestPassword123!',
                name: longString
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(longInputUser);

            // Should be rejected due to validation
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });
});