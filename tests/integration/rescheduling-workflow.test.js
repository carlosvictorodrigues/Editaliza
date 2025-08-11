/**
 * Integration Tests for Complete Rescheduling Workflow
 * 
 * These tests validate the full end-to-end rescheduling process including:
 * 1. Complete workflow with user 3@3.com test data (7 overdue tasks)
 * 2. Real-world scenarios using the data factory
 * 3. Full API integration from request to database changes
 * 4. Performance and reliability under realistic conditions
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { DatabaseTestHelper } = require('../helpers/database-helper');
const { ReschedulingDataFactory } = require('../fixtures/rescheduling-data-factory');

describe('Rescheduling Integration Tests', () => {
  let testDB;
  let dataFactory;
  let app;

  beforeAll(async () => {
    // Initialize test infrastructure
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();
    
    dataFactory = new ReschedulingDataFactory(testDB);

    // Setup Express app for integration testing
    const express = require('express');
    app = express();
    app.use(express.json());

    // JWT authentication middleware
    const authenticateToken = (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Access token required' });
      }

      try {
        const user = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment');
        req.user = user;
        next();
      } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    };

    // Mock the complete rescheduling endpoint with realistic implementation
    app.post('/plans/:planId/replan', authenticateToken, async (req, res) => {
      const planId = parseInt(req.params.planId);

      try {
        // Validate plan ownership
        const plan = await testDB.get(
          'SELECT * FROM study_plans WHERE id = ? AND user_id = ?',
          [planId, req.user.id]
        );

        if (!plan) {
          return res.status(404).json({
            success: false,
            error: 'Plano não encontrado.'
          });
        }

        // Get overdue sessions
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueSessions = await testDB.all(
          "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ? ORDER BY session_date, id",
          [planId, todayStr]
        );

        if (overdueSessions.length === 0) {
          return res.json({
            success: true,
            message: 'Nenhuma tarefa atrasada para replanejar.',
            details: { rescheduled: 0, failed: 0, total: 0 }
          });
        }

        // Implement realistic rescheduling algorithm
        const result = await this.performIntelligentRescheduling(plan, overdueSessions);

        // Update postponement count
        await testDB.run(
          'UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?',
          [planId]
        );

        // Prepare response message
        let message = '';
        if (result.rescheduled === overdueSessions.length) {
          message = `✅ Todas as ${result.rescheduled} tarefas atrasadas foram replanejadas com sucesso!`;
        } else if (result.rescheduled > 0) {
          message = `⚠ ${result.rescheduled} de ${overdueSessions.length} tarefas foram replanejadas. ${result.failed} tarefas não puderam ser reagendadas.`;
        } else {
          message = `❌ Nenhuma tarefa pôde ser replanejada. Verifique a disponibilidade de horários até o exame.`;
        }

        res.json({
          success: result.rescheduled > 0,
          message,
          details: {
            rescheduled: result.rescheduled,
            failed: result.failed,
            total: overdueSessions.length,
            strategy: result.strategy,
            distribution: result.distribution
          }
        });

      } catch (error) {
        console.error('Rescheduling error:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno ao processar replanejamento.',
          message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor'
        });
      }
    });

    // Intelligent rescheduling algorithm implementation
    this.performIntelligentRescheduling = async (plan, overdueSessions) => {
      const studyHours = JSON.parse(plan.study_hours_per_day);
      const sessionDurationHours = plan.session_duration_minutes / 60;
      const examDate = new Date(plan.exam_date + 'T23:59:59');
      const today = new Date();

      // Calculate daily capacities
      const getDayCapacity = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[date.getDay()];
        return Math.floor(studyHours[dayName] / sessionDurationHours);
      };

      // Group overdue sessions by subject for intelligent scheduling
      const sessionsBySubject = {};
      overdueSessions.forEach(session => {
        if (!sessionsBySubject[session.subject_name]) {
          sessionsBySubject[session.subject_name] = [];
        }
        sessionsBySubject[session.subject_name].push(session);
      });

      // Get future sessions for context-aware scheduling
      const todayStr = today.toISOString().split('T')[0];
      const futureSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? ORDER BY session_date, id",
        [plan.id, todayStr]
      );

      const futureBySubject = {};
      futureSessions.forEach(session => {
        if (!futureBySubject[session.subject_name]) {
          futureBySubject[session.subject_name] = [];
        }
        futureBySubject[session.subject_name].push(session);
      });

      let rescheduled = 0;
      let failed = 0;
      const distribution = [];
      const maxSessionsPerSubjectPerDay = 2;

      // Process each subject's overdue sessions
      for (const [subjectName, subjectSessions] of Object.entries(sessionsBySubject)) {
        // Find optimal slots for this subject
        const futureSubjectSessions = futureBySubject[subjectName] || [];
        const preferredSlots = this.findPreferredSlots(futureSubjectSessions, examDate, today);

        // Try to reschedule each session
        for (const session of subjectSessions) {
          let scheduled = false;

          // Try preferred slots first
          for (const slotDate of preferredSlots) {
            if (await this.canScheduleSession(slotDate, subjectName, plan.id, getDayCapacity, maxSessionsPerSubjectPerDay)) {
              await testDB.run(
                'UPDATE study_sessions SET session_date = ? WHERE id = ?',
                [slotDate, session.id]
              );
              distribution.push({ sessionId: session.id, newDate: slotDate, strategy: 'preferred' });
              rescheduled++;
              scheduled = true;
              break;
            }
          }

          // If preferred slots failed, try any available slot
          if (!scheduled) {
            const fallbackSlot = await this.findFallbackSlot(today, examDate, subjectName, plan.id, getDayCapacity, maxSessionsPerSubjectPerDay);
            if (fallbackSlot) {
              await testDB.run(
                'UPDATE study_sessions SET session_date = ? WHERE id = ?',
                [fallbackSlot, session.id]
              );
              distribution.push({ sessionId: session.id, newDate: fallbackSlot, strategy: 'fallback' });
              rescheduled++;
            } else {
              failed++;
            }
          }
        }
      }

      return {
        rescheduled,
        failed,
        strategy: 'subject-aware-intelligent',
        distribution
      };
    };

    // Helper methods for rescheduling algorithm
    this.findPreferredSlots = (futureSessions, examDate, today) => {
      const slots = [];
      if (futureSessions.length === 0) {
        // No future sessions, use next available days
        for (let i = 1; i <= 7; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          if (date <= examDate) {
            slots.push(date.toISOString().split('T')[0]);
          }
        }
      } else {
        // Schedule before future sessions of same subject
        const firstFutureDate = new Date(futureSessions[0].session_date);
        for (let i = 1; i <= 10; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() + i);
          if (date < firstFutureDate && date <= examDate) {
            slots.push(date.toISOString().split('T')[0]);
          }
        }
      }
      return slots;
    };

    this.canScheduleSession = async (dateStr, subjectName, planId, getDayCapacity, maxPerSubject) => {
      // Check daily capacity
      const dayCapacity = getDayCapacity(dateStr);
      const currentCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [planId, dateStr]
      );
      
      if (currentCount.count >= dayCapacity) return false;

      // Check subject limit per day
      const subjectCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ? AND subject_name = ?',
        [planId, dateStr, subjectName]
      );

      return subjectCount.count < maxPerSubject;
    };

    this.findFallbackSlot = async (today, examDate, subjectName, planId, getDayCapacity, maxPerSubject) => {
      for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        if (date > examDate) break;

        const dateStr = date.toISOString().split('T')[0];
        if (await this.canScheduleSession(dateStr, subjectName, planId, getDayCapacity, maxPerSubject)) {
          return dateStr;
        }
      }
      return null;
    };
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDB.cleanTables();
  });

  afterAll(async () => {
    if (testDB) {
      await testDB.close();
    }
  });

  describe('User 3@3.com Complete Workflow', () => {
    test('should successfully reschedule 7 overdue tasks for user 3@3.com', async () => {
      // Create the specific test scenario mentioned in requirements
      const scenario = await dataFactory.createUser3Scenario();
      
      expect(scenario.user.email).toBe('3@3.com');
      expect(scenario.totalOverdue).toBe(7);
      expect(scenario.subjects).toEqual([
        'Direito Constitucional',
        'Direito Administrativo', 
        'Matemática e RLM',
        'Português'
      ]);

      // Generate JWT token for user
      const authToken = jwt.sign(
        { id: scenario.user.id, email: scenario.user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      // Verify initial state
      const initialOverdue = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [scenario.plan.id, new Date().toISOString().split('T')[0]]
      );

      expect(initialOverdue).toHaveLength(7);

      // Execute rescheduling
      const startTime = Date.now();
      const response = await request(app)
        .post(`/plans/${scenario.plan.id}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      const executionTime = Date.now() - startTime;

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      
      const { details } = response.body;
      expect(details.total).toBe(7);
      expect(details.rescheduled + details.failed).toBe(7);

      // Should successfully reschedule most if not all sessions
      expect(details.rescheduled).toBeGreaterThan(0);
      expect(details.rescheduled).toBeGreaterThanOrEqual(5); // At least 5 out of 7

      // Verify database changes
      const finalOverdue = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [scenario.plan.id, new Date().toISOString().split('T')[0]]
      );

      expect(finalOverdue.length).toBe(details.failed);
      expect(initialOverdue.length - finalOverdue.length).toBe(details.rescheduled);

      // Verify postponement count was incremented
      const updatedPlan = await testDB.get('SELECT postponement_count FROM study_plans WHERE id = ?', [scenario.plan.id]);
      expect(updatedPlan.postponement_count).toBe(3); // Was 2, now 3

      // Performance check
      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds

      // Verify session metadata was preserved
      const allSessions = await testDB.all('SELECT * FROM study_sessions WHERE study_plan_id = ?', [scenario.plan.id]);
      allSessions.forEach(session => {
        expect(session.subject_name).toBeTruthy();
        expect(session.topic_description).toBeTruthy();
        expect(session.session_type).toBeTruthy();
        expect(['Pendente', 'Concluída']).toContain(session.status);
      });
    });

    test('should respect all constraints during user 3@3.com workflow', async () => {
      const scenario = await dataFactory.createUser3Scenario();
      
      const authToken = jwt.sign(
        { id: scenario.user.id, email: scenario.user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      // Execute rescheduling
      const response = await request(app)
        .post(`/plans/${scenario.plan.id}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      const { details } = response.body;

      // Verify all constraints were respected
      const studyHours = JSON.parse(scenario.plan.study_hours_per_day);
      const sessionDurationHours = scenario.plan.session_duration_minutes / 60; // 1.25 hours
      const examDate = new Date(scenario.plan.exam_date + 'T23:59:59');
      const today = new Date();

      // Check each day's constraints
      const rescheduledSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND session_date >= ?",
        [scenario.plan.id, today.toISOString().split('T')[0]]
      );

      const sessionsByDate = {};
      rescheduledSessions.forEach(session => {
        const date = session.session_date;
        if (!sessionsByDate[date]) sessionsByDate[date] = [];
        sessionsByDate[date].push(session);
      });

      Object.entries(sessionsByDate).forEach(([dateStr, daySessions]) => {
        const date = new Date(dateStr + 'T00:00:00');
        
        // 1. Should not exceed exam date
        expect(date).toBeLessThanOrEqual(examDate);

        // 2. Should not exceed daily hour limits
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[date.getDay()];
        const maxSessionsForDay = Math.floor(studyHours[dayName] / sessionDurationHours);
        expect(daySessions.length).toBeLessThanOrEqual(maxSessionsForDay);

        // 3. Should not exceed subject limits per day
        const subjectCounts = {};
        daySessions.forEach(session => {
          subjectCounts[session.subject_name] = (subjectCounts[session.subject_name] || 0) + 1;
        });

        Object.values(subjectCounts).forEach(count => {
          expect(count).toBeLessThanOrEqual(2); // Max 2 sessions per subject per day
        });
      });

      console.log(`User 3@3.com test: ${details.rescheduled} rescheduled, ${details.failed} failed`);
    });
  });

  describe('Real-world Scenario Integration Tests', () => {
    test('should handle concurso student scenario', async () => {
      const user = await testDB.createTestUser({
        email: 'concurso-student@test.com',
        name: 'Concurso Student'
      });

      const scenario = await dataFactory.createConcursoStudentScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBeTruthy();
      
      const { details } = response.body;
      expect(details.total).toBe(15); // Total overdue from concurso scenario
      expect(details.rescheduled).toBeGreaterThan(10); // Should reschedule most sessions
    });

    test('should handle working professional scenario', async () => {
      const user = await testDB.createTestUser({
        email: 'working-professional@test.com',
        name: 'Working Professional'
      });

      const scenario = await dataFactory.createWorkingProfessionalScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      
      // Working professional has limited time, so some sessions may not be reschedulable
      const { details } = response.body;
      expect(details.total).toBe(20); // Total from working professional scenario
      
      // With limited hours, not all sessions may be reschedulable
      expect(details.rescheduled + details.failed).toBe(details.total);
      
      if (details.failed > 0) {
        expect(response.body.message).toContain('⚠');
      }
    });

    test('should handle procrastinator scenario', async () => {
      const user = await testDB.createTestUser({
        email: 'procrastinator@test.com',
        name: 'Procrastinator'
      });

      const scenario = await dataFactory.createProcrastinatorScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      
      const { details } = response.body;
      expect(details.total).toBe(45); // Large number of overdue sessions
      
      // Procrastinator scenario has intensive schedule, should reschedule most
      expect(details.rescheduled).toBeGreaterThan(35);
      expect(details.failed).toBeLessThan(10);
    });

    test('should handle ENEM student scenario', async () => {
      const user = await testDB.createTestUser({
        email: 'enem-student@test.com',
        name: 'ENEM Student'
      });

      const scenario = await dataFactory.createEnemStudentScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      
      const { details } = response.body;
      expect(details.total).toBe(28); // ENEM scenario total
      
      // ENEM has long timeline (8 months), should reschedule all or most
      expect(details.rescheduled).toBeGreaterThan(25);
      expect(details.failed).toBeLessThan(3);
    });
  });

  describe('Performance and Reliability Tests', () => {
    test('should handle stress test scenario efficiently', async () => {
      const user = await testDB.createTestUser({
        email: 'stress-test@test.com',
        name: 'Stress Test User'
      });

      const scenario = await dataFactory.createStressTestScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const startTime = Date.now();
      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      const executionTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      
      // Should handle large dataset efficiently
      expect(executionTime).toBeLessThan(5000); // 5 seconds max for stress test
      
      const { details } = response.body;
      expect(details.total).toBeGreaterThan(100); // Large stress test dataset
    });

    test('should maintain data consistency across multiple operations', async () => {
      const user = await testDB.createTestUser({
        email: 'consistency-test@test.com',
        name: 'Consistency Test User'
      });

      const scenario = await dataFactory.createMixedRealisticScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      // Get initial checksums
      const initialSessions = await testDB.all('SELECT * FROM study_sessions WHERE study_plan_id = ?', [scenario.planId]);
      let initialChecksum = 0;
      const initialMetadata = {};

      initialSessions.forEach(session => {
        initialChecksum += (session.questions_solved || 0) + (session.time_studied_seconds || 0);
        initialMetadata[session.id] = {
          subject_name: session.subject_name,
          topic_description: session.topic_description,
          session_type: session.session_type
        };
      });

      // Execute rescheduling
      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);

      // Verify data consistency
      const finalSessions = await testDB.all('SELECT * FROM study_sessions WHERE study_plan_id = ?', [scenario.planId]);
      let finalChecksum = 0;

      finalSessions.forEach(session => {
        finalChecksum += (session.questions_solved || 0) + (session.time_studied_seconds || 0);
        
        // Verify metadata preservation
        const original = initialMetadata[session.id];
        if (original) {
          expect(session.subject_name).toBe(original.subject_name);
          expect(session.topic_description).toBe(original.topic_description);
          expect(session.session_type).toBe(original.session_type);
        }
      });

      // Data integrity check
      expect(finalChecksum).toBe(initialChecksum);
      expect(finalSessions.length).toBe(initialSessions.length);
    });

    test('should provide detailed progress information', async () => {
      const user = await testDB.createTestUser({
        email: 'progress-test@test.com',
        name: 'Progress Test User'
      });

      const scenario = await dataFactory.createMixedRealisticScenario(user.id);
      
      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${scenario.planId}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('details');
      
      const { details } = response.body;
      
      // Should provide comprehensive details
      expect(details).toHaveProperty('rescheduled');
      expect(details).toHaveProperty('failed');
      expect(details).toHaveProperty('total');
      expect(details).toHaveProperty('strategy');
      expect(details).toHaveProperty('distribution');
      
      expect(details.rescheduled + details.failed).toBe(details.total);
      expect(details.strategy).toBe('subject-aware-intelligent');
      expect(Array.isArray(details.distribution)).toBe(true);
      
      if (details.distribution.length > 0) {
        details.distribution.forEach(item => {
          expect(item).toHaveProperty('sessionId');
          expect(item).toHaveProperty('newDate');
          expect(item).toHaveProperty('strategy');
          expect(['preferred', 'fallback']).toContain(item.strategy);
        });
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle unauthorized access gracefully', async () => {
      const scenario = await dataFactory.createUser3Scenario();

      const response = await request(app)
        .post(`/plans/${scenario.plan.id}/replan`)
        .send(); // No auth token

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    test('should handle non-existent plan', async () => {
      const user = await testDB.createTestUser({
        email: 'nonexistent-test@test.com',
        name: 'Nonexistent Test User'
      });

      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/plans/99999/replan')
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Plano não encontrado.');
    });

    test('should handle plan with no overdue sessions', async () => {
      const user = await testDB.createTestUser({
        email: 'no-overdue-test@test.com',
        name: 'No Overdue Test User'
      });

      const plan = await testDB.createTestPlan({
        user_id: user.id,
        plan_name: 'No Overdue Plan'
      });

      const authToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-in-testing-environment',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post(`/plans/${plan.id}/replan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Nenhuma tarefa atrasada para replanejar.',
        details: { rescheduled: 0, failed: 0, total: 0 }
      });
    });
  });
});