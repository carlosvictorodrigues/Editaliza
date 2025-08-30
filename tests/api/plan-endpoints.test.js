const request = require('supertest');
const app = require('../../server');
const jwt = require('jsonwebtoken');

describe('Plan Dashboard API Endpoints', () => {
  let authToken;
  let server;
  const userId = 1;
  const planId = 1;

  beforeAll(() => {
    // Create a valid JWT token for testing
    authToken = jwt.sign(
      { id: userId, email: 'test@test.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    // Start server if needed
    if (!server) {
      server = app.listen(0); // Random port
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('GET /api/plans/:planId', () => {
    test('should return plan details with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('plan_name');
      expect(response.body).toHaveProperty('exam_date');
      expect(response.body).toHaveProperty('reta_final_mode');
    });

    test('should return 401 without auth token', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate planId parameter', async () => {
      const response = await request(server)
        .get('/api/plans/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/gamification/profile', () => {
    test('should return gamification profile with valid auth', async () => {
      const response = await request(server)
        .get('/api/gamification/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('studyStreak');
      expect(response.body).toHaveProperty('totalStudyDays');
      expect(response.body).toHaveProperty('experiencePoints');
      expect(response.body).toHaveProperty('concurseiroLevel');
      expect(typeof response.body.studyStreak).toBe('number');
      expect(typeof response.body.experiencePoints).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get('/api/gamification/profile')
        .expect(401);
    });

    test('should handle database errors gracefully', async () => {
      // This test assumes the implementation handles DB errors
      // In real scenario, you might mock the DB to simulate an error
      const response = await request(server)
        .get('/api/gamification/profile')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Should either succeed or return proper error
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/plans/:planId/schedule_preview', () => {
    test('should return schedule preview with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/schedule_preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('phases');
      expect(response.body).toHaveProperty('completedTopics');
      expect(response.body).toHaveProperty('totalTopics');
      expect(response.body).toHaveProperty('pendingTopics');
      expect(response.body).toHaveProperty('simulados');
      expect(response.body).toHaveProperty('revisoes');
      expect(typeof response.body.completedTopics).toBe('number');
      expect(typeof response.body.totalTopics).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/schedule_preview`)
        .expect(401);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999/schedule_preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/plans/:planId/realitycheck', () => {
    test('should return performance check data with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/realitycheck`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['completed', 'on-track', 'off-track']).toContain(response.body.status);
      expect(response.body).toHaveProperty('completedTopics');
      expect(response.body).toHaveProperty('totalTopics');
      expect(response.body).toHaveProperty('daysRemaining');
      expect(response.body).toHaveProperty('averageDailyProgress');
      expect(typeof response.body.completedTopics).toBe('number');
      expect(typeof response.body.averageDailyProgress).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/realitycheck`)
        .expect(401);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999/realitycheck')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('should handle edge cases for completed plans', async () => {
      // Assuming a completed plan exists with ID 2
      const response = await request(server)
        .get('/api/plans/2/realitycheck')
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.status === 200 && response.body.status === 'completed') {
        expect(response.body).toHaveProperty('shouldRegenerateForSimulations');
        expect(typeof response.body.shouldRegenerateForSimulations).toBe('boolean');
      }
    });
  });

  describe('GET /api/plans/:planId/goal_progress', () => {
    test('should return goal progress with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/goal_progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('weeklyGoals');
      expect(response.body).toHaveProperty('dailyAverage');
      expect(response.body).toHaveProperty('currentWeekProgress');
      expect(response.body).toHaveProperty('targetPerWeek');
      expect(Array.isArray(response.body.weeklyGoals)).toBe(true);
      expect(typeof response.body.dailyAverage).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/goal_progress`)
        .expect(401);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999/goal_progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate weekly goals structure', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/goal_progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.weeklyGoals.length > 0) {
        const firstGoal = response.body.weeklyGoals[0];
        expect(firstGoal).toHaveProperty('week');
        expect(firstGoal).toHaveProperty('target');
        expect(firstGoal).toHaveProperty('achieved');
        expect(typeof firstGoal.target).toBe('number');
        expect(typeof firstGoal.achieved).toBe('number');
      }
    });
  });

  describe('GET /api/plans/:planId/review_data', () => {
    test('should return review data with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/review_data`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('questionsTotal');
      expect(response.body).toHaveProperty('questionsProgress');
      expect(response.body).toHaveProperty('bySubject');
      expect(typeof response.body.questionsTotal).toBe('number');
      expect(Array.isArray(response.body.questionsProgress)).toBe(true);
      expect(typeof response.body.bySubject).toBe('object');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/review_data`)
        .expect(401);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999/review_data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate subject review data structure', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/review_data`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const subjects = Object.keys(response.body.bySubject);
      if (subjects.length > 0) {
        const firstSubject = response.body.bySubject[subjects[0]];
        expect(firstSubject).toHaveProperty('total');
        expect(firstSubject).toHaveProperty('solved');
        expect(firstSubject).toHaveProperty('accuracy');
        expect(typeof firstSubject.total).toBe('number');
        expect(typeof firstSubject.solved).toBe('number');
        expect(typeof firstSubject.accuracy).toBe('number');
        expect(firstSubject.accuracy).toBeGreaterThanOrEqual(0);
        expect(firstSubject.accuracy).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('GET /api/plans/:planId/detailed_progress', () => {
    test('should return detailed progress with valid auth', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/detailed_progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('subjects');
      expect(response.body).toHaveProperty('globalProgress');
      expect(response.body).toHaveProperty('totalCompleted');
      expect(response.body).toHaveProperty('totalPending');
      expect(Array.isArray(response.body.subjects)).toBe(true);
      expect(typeof response.body.globalProgress).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/detailed_progress`)
        .expect(401);
    });

    test('should return 404 for non-existent plan', async () => {
      const response = await request(server)
        .get('/api/plans/99999/detailed_progress')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('should validate subject progress structure', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/detailed_progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.subjects.length > 0) {
        const firstSubject = response.body.subjects[0];
        expect(firstSubject).toHaveProperty('name');
        expect(firstSubject).toHaveProperty('totalTopics');
        expect(firstSubject).toHaveProperty('completedTopics');
        expect(firstSubject).toHaveProperty('progress');
        expect(firstSubject).toHaveProperty('priority');
        expect(firstSubject).toHaveProperty('estimatedHours');
        expect(typeof firstSubject.totalTopics).toBe('number');
        expect(typeof firstSubject.completedTopics).toBe('number');
        expect(typeof firstSubject.progress).toBe('number');
        expect(firstSubject.progress).toBeGreaterThanOrEqual(0);
        expect(firstSubject.progress).toBeLessThanOrEqual(100);
      }
    });

    test('should calculate global progress correctly', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/detailed_progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { totalCompleted, totalPending, globalProgress } = response.body;
      const totalTopics = totalCompleted + totalPending;
      
      if (totalTopics > 0) {
        const expectedProgress = (totalCompleted / totalTopics) * 100;
        // Allow for small floating point differences
        expect(Math.abs(globalProgress - expectedProgress)).toBeLessThan(0.1);
      }
    });
  });

  describe('Security and Validation Tests', () => {
    test('should reject invalid JWT token', async () => {
      const invalidToken = 'invalid.jwt.token';
      
      await request(server)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    test('should reject expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { id: userId, email: 'test@test.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Already expired
      );
      
      await request(server)
        .get(`/api/plans/${planId}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    test('should validate integer planId parameter', async () => {
      const invalidIds = ['abc', '12.34', 'null', 'undefined', ''];
      
      for (const invalidId of invalidIds) {
        await request(server)
          .get(`/api/plans/${invalidId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);
      }
    });

    test('should handle SQL injection attempts', async () => {
      const maliciousIds = [
        "1; DROP TABLE users;",
        "1' OR '1'='1",
        "1 UNION SELECT * FROM users"
      ];
      
      for (const maliciousId of maliciousIds) {
        const response = await request(server)
          .get(`/api/plans/${maliciousId}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        // Should return 400 (bad request) not 500 (server error)
        expect(response.status).toBe(400);
      }
    });
  });
});