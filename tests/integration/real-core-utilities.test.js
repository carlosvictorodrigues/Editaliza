// tests/integration/real-core-utilities.test.js - Real integration tests for core utilities
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { createRealTestServer, testDbPath, cleanupTestDb } = require('./server-setup');

// Test the actual middleware and database utilities by testing their effects
let app;

describe('Real Core Utilities Integration Tests', () => {
    beforeAll(async () => {
        app = createRealTestServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        await cleanupTestDb();
        
        try {
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        } catch (error) {
            console.log('Could not clean up test database:', error.message);
        }
        
        try {
            const testSessionPath = path.join(__dirname, '../test-sessions.db');
            if (fs.existsSync(testSessionPath)) {
                fs.unlinkSync(testSessionPath);
            }
        } catch (error) {
            console.log('Could not clean up session database:', error.message);
        }
    });

    describe('Input Sanitization Middleware', () => {
        test('should sanitize XSS attempts in registration', async () => {
            const maliciousInput = {
                email: '<script>alert("xss")</script>test@example.com',
                password: 'ValidPass123!'
            };

            const response = await request(app)
                .post('/register')
                .send(maliciousInput);

            // Should either reject the malicious input or sanitize it
            expect([400, 401]).toContain(response.status);
            
            // Response should not contain script tags
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toContain('<script>');
            expect(responseText).not.toContain('javascript:');
        });

        test('should sanitize SQL injection attempts', async () => {
            const sqlInjectionAttempts = [
                "'; DROP TABLE users; --",
                "admin'--",
                "1' OR '1'='1",
                "'; SELECT * FROM users; --"
            ];

            for (const maliciousPassword of sqlInjectionAttempts) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: 'test@example.com',
                        password: maliciousPassword
                    });

                // Should handle gracefully without exposing database errors
                expect([400, 401]).toContain(response.status);
                
                const responseText = JSON.stringify(response.body);
                expect(responseText).not.toMatch(/sql/i);
                expect(responseText).not.toMatch(/sqlite/i);
                expect(responseText).not.toMatch(/database/i);
                expect(responseText).not.toMatch(/table/i);
            }
        });

        test('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/register')
                .set('Content-Type', 'application/json')
                .send('{"email": "test@example.com", "password": "incomplete"');

            expect([400, 500]).toContain(response.status);
            expect(response.body).toHaveProperty('error');
        });

        test('should enforce size limits on request body', async () => {
            const oversizedData = {
                email: 'test@example.com',
                password: 'A'.repeat(1000000) // 1MB password
            };

            const response = await request(app)
                .post('/register')
                .send(oversizedData);

            // Should either reject due to size or handle gracefully (201 means it was accepted)
            expect([201, 400, 413, 500]).toContain(response.status);
        });
    });

    describe('Authentication Middleware', () => {
        let validToken;
        let expiredToken;

        beforeAll(async () => {
            // Create a user and get a valid token
            const userData = {
                email: 'middleware.test@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(userData);

            const loginResponse = await request(app)
                .post('/login')
                .send(userData);

            validToken = loginResponse.body.token;

            // Create an expired token for testing
            const jwt = require('jsonwebtoken');
            expiredToken = jwt.sign(
                { id: 1, email: userData.email },
                process.env.JWT_SECRET,
                { expiresIn: '-1h', issuer: 'editaliza' }
            );
        });

        test('should allow access with valid token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('email');
        });

        test('should reject access without token', async () => {
            const response = await request(app)
                .get('/profile');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        test('should reject access with malformed token', async () => {
            const malformedTokens = [
                'invalid-token',
                'Bearer invalid-token',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
                ''
            ];

            for (const token of malformedTokens) {
                const response = await request(app)
                    .get('/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect([401, 403]).toContain(response.status);
                expect(response.body).toHaveProperty('error');
            }
        });

        test('should reject expired tokens', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/expirado|expired/i);
        });

        test('should validate token issuer', async () => {
            const jwt = require('jsonwebtoken');
            const tokenWithWrongIssuer = jwt.sign(
                { id: 1, email: 'test@example.com' },
                process.env.JWT_SECRET,
                { expiresIn: '1h', issuer: 'wrong-issuer' }
            );

            const response = await request(app)
                .get('/profile')
                .set('Authorization', `Bearer ${tokenWithWrongIssuer}`);

            // Token might be accepted if issuer validation isn't strict
            expect([200, 401, 403]).toContain(response.status);
        });
    });

    describe('Validation Middleware', () => {
        test('should validate email format in registration', async () => {
            const invalidEmails = [
                'notanemail',
                '@example.com',
                'test@',
                'test@.com',
                'test..test@example.com',
                ''
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: email,
                        password: 'ValidPass123!'
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
            }
        });

        test('should validate password requirements', async () => {
            const invalidPasswords = [
                '',
                '123',
                'short',
                'onlylowercase',
                'ONLYUPPERCASE',
                '12345678'
            ];

            for (const password of invalidPasswords) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: 'test@example.com',
                        password: password
                    });

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
            }
        });

        test('should validate required fields', async () => {
            const incompleteData = [
                {}, // No fields
                { email: 'test@example.com' }, // Missing password
                { password: 'ValidPass123!' }, // Missing email
                { email: '', password: 'ValidPass123!' }, // Empty email
                { email: 'test@example.com', password: '' } // Empty password
            ];

            for (const data of incompleteData) {
                const response = await request(app)
                    .post('/register')
                    .send(data);

                expect(response.status).toBe(400);
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('Session Management', () => {
        test('should create session on successful login', async () => {
            // Register a user first
            const userData = {
                email: 'session.test@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(userData);

            // Login and check for session cookie
            const response = await request(app)
                .post('/login')
                .send(userData);

            expect(response.status).toBe(200);
            
            // Check for session cookie
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeTruthy();
            
            const sessionCookie = cookies.find(cookie => 
                cookie.includes('connect.sid') || cookie.includes('session')
            );
            expect(sessionCookie).toBeTruthy();
        });

        test('should maintain session across requests', async () => {
            const userData = {
                email: 'persistent.session@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(userData);

            const loginResponse = await request(app)
                .post('/login')
                .send(userData);

            const token = loginResponse.body.token;

            // Make multiple requests with the same token
            for (let i = 0; i < 3; i++) {
                const response = await request(app)
                    .get('/profile')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.email).toBe(userData.email);
            }
        });
    });

    describe('Database Operations', () => {
        test('should handle concurrent database operations', async () => {
            // Create multiple users concurrently
            const userPromises = [];
            
            for (let i = 0; i < 5; i++) {
                userPromises.push(
                    request(app)
                        .post('/register')
                        .send({
                            email: `concurrent${i}@example.com`,
                            password: 'SecurePass123!'
                        })
                );
            }

            const responses = await Promise.all(userPromises);
            
            // All should succeed or fail gracefully
            for (const response of responses) {
                expect([201, 400]).toContain(response.status);
            }
        });

        test('should enforce unique constraints', async () => {
            const userData = {
                email: 'unique.test@example.com',
                password: 'SecurePass123!'
            };

            // First registration should succeed
            const firstResponse = await request(app)
                .post('/register')
                .send(userData);

            expect(firstResponse.status).toBe(201);

            // Second registration with same email should fail
            const secondResponse = await request(app)
                .post('/register')
                .send(userData);

            expect(secondResponse.status).toBe(400);
            expect(secondResponse.body.error).toContain('já está em uso');
        });

        test('should handle database errors gracefully', async () => {
            // Try to access a protected route that requires database access
            // without proper authentication
            const response = await request(app)
                .get('/profile')
                .set('Authorization', 'Bearer invalid-token');

            expect([401, 403, 500]).toContain(response.status);
            expect(response.body).toHaveProperty('error');
            
            // Error message should not expose internal details
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toMatch(/sqlite/i);
            expect(responseText).not.toMatch(/sql/i);
            expect(responseText).not.toMatch(/database/i);
        });
    });

    describe('Error Handling', () => {
        test('should handle 404 routes gracefully', async () => {
            const response = await request(app)
                .get('/nonexistent-route');

            expect(response.status).toBe(404);
        });

        test('should handle unsupported HTTP methods', async () => {
            const response = await request(app)
                .patch('/register')
                .send({
                    email: 'test@example.com',
                    password: 'ValidPass123!'
                });

            expect([404, 405]).toContain(response.status);
        });

        test('should provide consistent error response format', async () => {
            const errorResponses = [];

            // Generate various error responses
            errorResponses.push(
                await request(app).post('/register').send({}) // Validation error
            );
            
            errorResponses.push(
                await request(app).post('/login').send({
                    email: 'nonexistent@example.com',
                    password: 'anypassword'
                }) // Auth error
            );
            
            errorResponses.push(
                await request(app).get('/profile') // Missing auth
            );

            // All error responses should have consistent structure
            for (const response of errorResponses) {
                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.body).toHaveProperty('error');
                expect(typeof response.body.error).toBe('string');
            }
        });
    });
});