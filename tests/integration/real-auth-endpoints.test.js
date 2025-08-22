// tests/integration/real-auth-endpoints.test.js - Real integration tests for authentication
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { createRealTestServer, testDbPath, cleanupTestDb } = require('./server-setup');

let app;

describe('Real Authentication Endpoints Integration Tests', () => {
    beforeAll(async () => {
        // Create the real test server instance
        app = createRealTestServer();
        
        // Wait for database to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        // Close database connection first
        await cleanupTestDb();
        
        // Then clean up database files
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

    describe('User Registration', () => {
        test('should create a new user with valid data', async () => {
            const userData = {
                email: 'integration.test@example.com',
                password: 'SecurePass123!'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);


            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('sucesso');
        });

        test('should reject duplicate email registration', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'SecurePass123!'
            };

            // First registration
            await request(app)
                .post('/register')
                .send(userData);

            // Second registration with same email
            const response = await request(app)
                .post('/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('já está em uso');
        });

        test('should validate email format', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'SecurePass123!'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('should validate password requirements', async () => {
            const userData = {
                email: 'valid@example.com',
                password: '123' // Too short
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('User Login', () => {
        beforeEach(async () => {
            // Create a test user for login tests
            const userData = {
                email: 'login.test@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(userData);
        });

        test('should login with valid credentials', async () => {
            const loginData = {
                email: 'login.test@example.com',
                password: 'SecurePass123!'
            };

            const response = await request(app)
                .post('/login')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('token');
            expect(response.body.message).toContain('bem-sucedido');
            expect(typeof response.body.token).toBe('string');
        });

        test('should reject invalid credentials', async () => {
            const loginData = {
                email: 'login.test@example.com',
                password: 'WrongPassword123!'
            };

            const response = await request(app)
                .post('/login')
                .send(loginData);

            expect(response.status).toBe(401);
            expect(response.body.error).toContain('inválidos');
        });

        test('should reject non-existent user', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'SecurePass123!'
            };

            const response = await request(app)
                .post('/login')
                .send(loginData);

            expect(response.status).toBe(401);
            expect(response.body.error).toContain('inválidos');
        });
    });

    describe('Protected Routes', () => {
        let authToken;

        beforeEach(async () => {
            // Create user and get auth token
            const userData = {
                email: 'protected.test@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(userData);

            const loginResponse = await request(app)
                .post('/login')
                .send(userData);

            authToken = loginResponse.body.token;
        });

        test('should access profile with valid token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('email');
            expect(response.body.email).toBe('protected.test@example.com');
        });

        test('should reject access without token', async () => {
            const response = await request(app)
                .get('/profile');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        test('should reject access with invalid token', async () => {
            const response = await request(app)
                .get('/profile')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Health Check', () => {
        test('should return health status', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body.status).toBe('ok');
        });
    });

    describe('Security Features', () => {
        test('should sanitize malicious input', async () => {
            const maliciousData = {
                email: '<script>alert("xss")</script>@example.com',
                password: 'SecurePass123!'
            };

            const response = await request(app)
                .post('/register')
                .send(maliciousData);

            // Should either reject with validation error or sanitize input
            expect(response.status).toBeOneOf([400, 401]);
            
            // Response should not contain script tags
            const responseText = JSON.stringify(response.body);
            expect(responseText).not.toContain('<script>');
        });

        test('should handle long input gracefully', async () => {
            const longData = {
                email: 'test@example.com',
                password: 'ValidPass123_' + 'A'.repeat(50) // Reasonable length test
            };

            const response = await request(app)
                .post('/register')
                .send(longData);

            // Should either accept (if valid) or reject gracefully
            expect([201, 400]).toContain(response.status);
        });
    });
});