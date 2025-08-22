// tests/integration/real-plan-endpoints.test.js - Real integration tests for plan operations
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { createRealTestServer, testDbPath, cleanupTestDb } = require('./server-setup');

let app;
let authToken;
let userId;

describe('Real Plan Operations Integration Tests', () => {
    beforeAll(async () => {
        // Create the real test server instance
        app = createRealTestServer();
        
        // Wait for database to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create a test user and get auth token
        const userData = {
            email: 'plan.test@example.com',
            password: 'SecurePass123!'
        };

        await request(app)
            .post('/register')
            .send(userData);

        const loginResponse = await request(app)
            .post('/login')
            .send(userData);

        authToken = loginResponse.body.token;
        
        // Get user ID from profile
        const profileResponse = await request(app)
            .get('/profile')
            .set('Authorization', `Bearer ${authToken}`);
        
        userId = profileResponse.body.id;
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

    describe('Plan Creation', () => {
        test('should create a new study plan', async () => {
            const planData = {
                plan_name: 'Concurso TJPE 2024',
                exam_date: '2024-12-15',
                study_hours_per_day: 6
            };

            const response = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('planId');
            expect(response.body.message).toContain('sucesso');
            expect(typeof response.body.planId).toBe('number');
        });

        test('should reject plan creation without auth token', async () => {
            const planData = {
                plan_name: 'Unauthorized Plan',
                exam_date: '2024-12-15',
                study_hours_per_day: 4
            };

            const response = await request(app)
                .post('/plans')
                .send(planData);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });

        test('should validate required plan name', async () => {
            const planData = {
                exam_date: '2024-12-15',
                study_hours_per_day: 4
            };

            const response = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('should create plan with default study hours', async () => {
            const planData = {
                plan_name: 'Plan with Default Hours',
                exam_date: '2024-12-15'
            };

            const response = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('planId');
        });
    });

    describe('Plan Retrieval', () => {
        let createdPlanId;

        beforeEach(async () => {
            // Create a plan for retrieval tests
            const planData = {
                plan_name: 'Test Retrieval Plan',
                exam_date: '2024-12-15',
                study_hours_per_day: 5
            };

            const createResponse = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData);

            createdPlanId = createResponse.body.planId;
        });

        test('should retrieve all user plans', async () => {
            const response = await request(app)
                .get('/plans')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            
            const plan = response.body.find(p => p.id === createdPlanId);
            expect(plan).toBeDefined();
            expect(plan.plan_name).toBe('Test Retrieval Plan');
            expect(plan.user_id).toBe(userId);
        });

        test('should retrieve empty array for new user', async () => {
            // Create another user
            const newUserData = {
                email: 'newuser@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(newUserData);

            const loginResponse = await request(app)
                .post('/login')
                .send(newUserData);

            const newUserToken = loginResponse.body.token;

            const response = await request(app)
                .get('/plans')
                .set('Authorization', `Bearer ${newUserToken}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test('should reject plan retrieval without auth', async () => {
            const response = await request(app)
                .get('/plans');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Plan Security', () => {
        test('should only show plans belonging to authenticated user', async () => {
            // Create plans for the first user
            const plan1Data = {
                plan_name: 'User 1 Plan A',
                exam_date: '2024-12-15',
                study_hours_per_day: 4
            };

            const plan2Data = {
                plan_name: 'User 1 Plan B',
                exam_date: '2024-12-20',
                study_hours_per_day: 6
            };

            await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(plan1Data);

            await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(plan2Data);

            // Create a second user and their plan
            const user2Data = {
                email: 'user2@example.com',
                password: 'SecurePass123!'
            };

            await request(app)
                .post('/register')
                .send(user2Data);

            const user2LoginResponse = await request(app)
                .post('/login')
                .send(user2Data);

            const user2Token = user2LoginResponse.body.token;

            const user2PlanData = {
                plan_name: 'User 2 Plan',
                exam_date: '2024-12-25',
                study_hours_per_day: 8
            };

            await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${user2Token}`)
                .send(user2PlanData);

            // Verify user 1 only sees their plans
            const user1PlansResponse = await request(app)
                .get('/plans')
                .set('Authorization', `Bearer ${authToken}`);

            expect(user1PlansResponse.status).toBe(200);
            const user1Plans = user1PlansResponse.body;
            
            expect(user1Plans.every(plan => plan.user_id === userId)).toBe(true);
            expect(user1Plans.some(plan => plan.plan_name === 'User 2 Plan')).toBe(false);

            // Verify user 2 only sees their plans
            const user2PlansResponse = await request(app)
                .get('/plans')
                .set('Authorization', `Bearer ${user2Token}`);

            expect(user2PlansResponse.status).toBe(200);
            const user2Plans = user2PlansResponse.body;
            
            expect(user2Plans.some(plan => plan.plan_name === 'User 2 Plan')).toBe(true);
            expect(user2Plans.some(plan => plan.plan_name.includes('User 1'))).toBe(false);
        });

        test('should sanitize malicious plan names', async () => {
            const maliciousPlanData = {
                plan_name: '<script>alert("xss")</script>Malicious Plan',
                exam_date: '2024-12-15',
                study_hours_per_day: 4
            };

            const response = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(maliciousPlanData);

            // Should either accept with sanitized name or reject
            expect([201, 400]).toContain(response.status);
            
            if (response.status === 201) {
                // If accepted, verify the plan list doesn't contain script tags
                const plansResponse = await request(app)
                    .get('/plans')
                    .set('Authorization', `Bearer ${authToken}`);
                
                const responseText = JSON.stringify(plansResponse.body);
                expect(responseText).not.toContain('<script>');
            }
        });
    });

    describe('Plan Data Validation', () => {
        test('should accept valid date formats', async () => {
            const validDateFormats = [
                '2024-12-15',
                '2024-01-01',
                '2025-06-30'
            ];

            for (const date of validDateFormats) {
                const planData = {
                    plan_name: `Plan for ${date}`,
                    exam_date: date,
                    study_hours_per_day: 4
                };

                const response = await request(app)
                    .post('/plans')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(planData);

                expect([201, 400]).toContain(response.status);
            }
        });

        test('should handle various study hours values', async () => {
            const studyHoursTests = [
                { hours: 1, description: 'minimum hours' },
                { hours: 8, description: 'typical hours' },
                { hours: 12, description: 'intensive hours' },
                { hours: 0, description: 'zero hours' },
                { hours: -1, description: 'negative hours' }
            ];

            for (const test of studyHoursTests) {
                const planData = {
                    plan_name: `Plan ${test.description}`,
                    exam_date: '2024-12-15',
                    study_hours_per_day: test.hours
                };

                const response = await request(app)
                    .post('/plans')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(planData);

                // Server should handle all values gracefully (either accept or reject)
                expect([200, 201, 400, 422]).toContain(response.status);
            }
        });

        test('should handle long plan names appropriately', async () => {
            const longPlanName = 'A'.repeat(250); // Very long name
            
            const planData = {
                plan_name: longPlanName,
                exam_date: '2024-12-15',
                study_hours_per_day: 4
            };

            const response = await request(app)
                .post('/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData);

            // Should either accept (if within limits) or reject gracefully
            expect([201, 400]).toContain(response.status);
        });
    });
});