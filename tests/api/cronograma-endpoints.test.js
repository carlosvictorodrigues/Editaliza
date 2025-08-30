const request = require('supertest');
const app = require('../../server');
const jwt = require('jsonwebtoken');

describe('Cronograma API Endpoints', () => {
  let authToken;
  let server;
  const userId = 1;
  const planId = 1;
  const sessionId = 1;

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
  });

  describe('GET /api/sessions/by-date/:planId', () => {
    test('should return sessions grouped by date', async () => {
      const response = await request(server)
        .get(`/api/sessions/by-date/${planId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Object);
      // Response should be an object with date keys
      const dates = Object.keys(response.body);
      if (dates.length > 0) {
        expect(response.body[dates[0]]).toBeInstanceOf(Array);
      }
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/sessions/by-date/${planId}`)
        .expect(401);
    });
  });

  describe('GET /api/sessions/overdue-check/:planId', () => {
    test('should return overdue count and sessions', async () => {
      const response = await request(server)
        .get(`/api/sessions/overdue-check/${planId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/sessions/overdue-check/${planId}`)
        .expect(401);
    });
  });

  describe('PATCH /api/sessions/:sessionId', () => {
    test('should update session status to Concluído', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'Concluído' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should reject invalid status', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'InvalidStatus' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .patch(`/api/sessions/${sessionId}`)
        .send({ status: 'Concluído' })
        .expect(401);
    });
  });

  describe('PATCH /api/sessions/:sessionId/postpone', () => {
    test('should postpone session to next day', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}/postpone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ days: 'next' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('newDate');
    });

    test('should postpone session by 7 days', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}/postpone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ days: 7 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('newDate');
    });

    test('should reject invalid days value', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}/postpone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ days: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should reject days > 30', async () => {
      const response = await request(server)
        .patch(`/api/sessions/${sessionId}/postpone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ days: 31 })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/sessions/:sessionId/reinforce', () => {
    test('should create reinforcement session', async () => {
      const response = await request(server)
        .post(`/api/sessions/${sessionId}/reinforce`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('newSessionId');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .post(`/api/sessions/${sessionId}/reinforce`)
        .expect(401);
    });
  });

  describe('POST /api/plans/:planId/replan', () => {
    test('should replan overdue sessions', async () => {
      const response = await request(server)
        .post(`/api/plans/${planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('rescheduledCount');
      expect(typeof response.body.rescheduledCount).toBe('number');
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .post(`/api/plans/${planId}/replan`)
        .expect(401);
    });
  });

  describe('GET /api/plans/:planId/exclusions', () => {
    test('should return exclusions data for Reta Final mode', async () => {
      const response = await request(server)
        .get(`/api/plans/${planId}/exclusions`)
        .set('Authorization', `Bearer ${authToken}`);

      // Can be 200 or 404 depending on if plan is in Reta Final mode
      if (response.status === 200) {
        expect(response.body).toHaveProperty('isRetaFinalActive');
        expect(response.body).toHaveProperty('totalExclusions');
        expect(response.body).toHaveProperty('exclusionsBySubject');
      } else {
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
      }
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get(`/api/plans/${planId}/exclusions`)
        .expect(401);
    });
  });

  describe('GET /api/plans', () => {
    test('should return list of user plans', async () => {
      const response = await request(server)
        .get('/api/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('plan_name');
      }
    });

    test('should return 401 without auth', async () => {
      await request(server)
        .get('/api/plans')
        .expect(401);
    });
  });
});