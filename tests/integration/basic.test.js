/**
 * FASE 9 - BASIC INTEGRATION TEST
 * 
 * Teste básico de integração para verificar funcionalidade principal
 * sem dependências externas complexas
 */

const request = require('supertest');
const { createTestServer } = require('./setup');

describe('🎯 Basic Integration Tests', () => {
    let testServer;
    let server;

    beforeAll(() => {
        testServer = createTestServer();
        server = testServer.listen(0);
    });

    afterAll((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    describe('Authentication Flow', () => {
        it('should register a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'TestPassword123!',
                confirmPassword: 'TestPassword123!',
                name: 'Test User'
            };

            const response = await request(testServer)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.user.email).toBe(userData.email);
            expect(response.body.tokens.accessToken).toBeTruthy();
        });

        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'test.user@editaliza.com',
                password: 'TestPassword123!'
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.user.email).toBe(loginData.email);
        });

        it('should reject login with invalid credentials', async () => {
            const invalidLogin = {
                email: 'wrong@example.com',
                password: 'wrongpassword'
            };

            const response = await request(testServer)
                .post('/api/auth/login')
                .send(invalidLogin)
                .expect(401);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
        });

        it('should get user info when authenticated', async () => {
            const response = await request(testServer)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer mock-access-token')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test.user@editaliza.com');
        });

        it('should reject unauthenticated requests', async () => {
            const response = await request(testServer)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });

        it('should logout successfully', async () => {
            const response = await request(testServer)
                .post('/api/auth/logout')
                .set('Authorization', 'Bearer mock-access-token')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('Plans Management', () => {
        it('should list user plans', async () => {
            const response = await request(testServer)
                .get('/api/plans')
                .set('Authorization', 'Bearer mock-access-token')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plans');
            expect(Array.isArray(response.body.plans)).toBe(true);
        });

        it('should create a new plan', async () => {
            const planData = {
                plan_name: 'Test Plan',
                exam_date: '2025-06-15'
            };

            const response = await request(testServer)
                .post('/api/plans')
                .set('Authorization', 'Bearer mock-access-token')
                .send(planData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plan');
            expect(response.body.plan.plan_name).toBe(planData.plan_name);
            expect(response.body.plan.exam_date).toBe(planData.exam_date);
        });
    });

    describe('System Health', () => {
        it('should return health status', async () => {
            const response = await request(testServer)
                .get('/api/auth/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('features');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 for non-existent routes', async () => {
            const response = await request(testServer)
                .get('/api/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'NOT_FOUND');
        });
    });
});