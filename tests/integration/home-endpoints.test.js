const request = require('supertest');
const app = require('../../server'); // Assuming your express app instance is exported from server.js
const { createTestUser, cleanUpTestUser } = require('../helpers/auth-helpers');

describe('Home Page Endpoints', () => {
  let token;
  let planId;

  beforeAll(async () => {
    const { testToken, testPlanId } = await createTestUser();
    token = testToken;
    planId = testPlanId;
  });

  afterAll(async () => {
    await cleanUpTestUser();
  });

  describe('GET /api/plans/:planId/progress', () => {
    test('should return 200 and the progress of the plan', async () => {
      const res = await request(app)
        .get(`/api/plans/${planId}/progress`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('percentage');
    });

    test('should return 404 for a non-existent plan', async () => {
      const res = await request(app)
        .get('/api/plans/9999/progress')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(404);
    });
  });

  describe('GET /api/plans/:planId/overdue_details', () => {
    test('should return 200 and the overdue details', async () => {
      const res = await request(app)
        .get(`/api/plans/${planId}/overdue_details`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('replanStrategy');
      expect(res.body).toHaveProperty('overdueCount');
      expect(res.body).toHaveProperty('overdueTasks');
    });

    test('should return 404 for a non-existent plan', async () => {
        const res = await request(app)
            .get('/api/plans/9999/overdue_details')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.statusCode).toEqual(404);
    });
  });
});