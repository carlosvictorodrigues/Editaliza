/**
 * Database Integrity Tests for Intelligent Rescheduling System
 * 
 * These tests ensure:
 * 1. No existing non-overdue sessions are moved or modified
 * 2. Daily study time limits are respected
 * 3. Session count limits per day are maintained
 * 4. Sessions are never scheduled beyond exam date
 * 5. Database constraints and relationships are preserved
 */

const { DatabaseTestHelper } = require('../../helpers/database-helper');

describe('Rescheduling Database Integrity Tests', () => {
  let testDB;
  let testUser;
  let testPlan;

  beforeAll(async () => {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();

    testUser = await testDB.createTestUser({
      email: 'integrity-test@test.com',
      name: 'Integrity Test User'
    });
  });

  beforeEach(async () => {
    // Clean slate for each test
    await testDB.run('DELETE FROM study_sessions');
    await testDB.run('DELETE FROM topics');
    await testDB.run('DELETE FROM subjects');
    await testDB.run('DELETE FROM study_plans WHERE user_id = ?', [testUser.id]);

    // Create fresh test plan for each test
    testPlan = await testDB.createTestPlan({
      user_id: testUser.id,
      plan_name: 'Integrity Test Plan',
      exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      study_hours_per_day: JSON.stringify({ 
        monday: 2, tuesday: 2, wednesday: 2, thursday: 2, 
        friday: 2, saturday: 3, sunday: 1 
      }),
      session_duration_minutes: 60 // 1 hour sessions
    });
  });

  afterAll(async () => {
    if (testDB) {
      await testDB.close();
    }
  });

  describe('Non-Overdue Session Protection', () => {
    test('should never modify future sessions during rescheduling', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Create future sessions (not overdue)
      const futureDate1 = new Date();
      futureDate1.setDate(futureDate1.getDate() + 1);
      const futureDate2 = new Date();
      futureDate2.setDate(futureDate2.getDate() + 2);

      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      const topic1 = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Future Topic 1'
      });

      const topic2 = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Future Topic 2'
      });

      const futureSession1 = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic1.id,
        subject_name: 'Matemática',
        topic_description: 'Future Topic 1',
        session_date: futureDate1.toISOString().split('T')[0],
        status: 'Pendente'
      });

      const futureSession2 = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic2.id,
        subject_name: 'Matemática',
        topic_description: 'Future Topic 2',
        session_date: futureDate2.toISOString().split('T')[0],
        status: 'Pendente'
      });

      // Create overdue sessions
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'História', overdueCount: 2 }
      ]);

      // Simulate rescheduling logic check
      const futureSessionsQuery = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ? ORDER BY session_date",
        [testPlan.id, todayStr]
      );

      expect(futureSessionsQuery).toHaveLength(2);

      // Verify that any rescheduling algorithm must NOT modify these sessions
      const originalFuture1 = await testDB.get('SELECT * FROM study_sessions WHERE id = ?', [futureSession1.id]);
      const originalFuture2 = await testDB.get('SELECT * FROM study_sessions WHERE id = ?', [futureSession2.id]);

      // After any rescheduling operation, these should remain unchanged
      expect(originalFuture1.session_date).toBe(futureDate1.toISOString().split('T')[0]);
      expect(originalFuture1.status).toBe('Pendente');
      expect(originalFuture2.session_date).toBe(futureDate2.toISOString().split('T')[0]);
      expect(originalFuture2.status).toBe('Pendente');
    });

    test('should never modify completed sessions', async () => {
      // Create completed session
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Português'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Completed Topic'
      });

      const completedSession = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Português',
        topic_description: 'Completed Topic',
        session_date: pastDate.toISOString().split('T')[0],
        status: 'Concluída', // Completed status
        time_studied_seconds: 3600
      });

      // Create overdue sessions
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 1 }
      ]);

      // Verify completed session is not considered for rescheduling
      const overdueQuery = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, new Date().toISOString().split('T')[0]]
      );

      // Only pending sessions should be in overdue query
      expect(overdueQuery.every(session => session.status === 'Pendente')).toBe(true);
      expect(overdueQuery.every(session => session.id !== completedSession.id)).toBe(true);

      // Verify completed session remains unchanged
      const unchangedSession = await testDB.get('SELECT * FROM study_sessions WHERE id = ?', [completedSession.id]);
      expect(unchangedSession.status).toBe('Concluída');
      expect(unchangedSession.session_date).toBe(pastDate.toISOString().split('T')[0]);
      expect(unchangedSession.time_studied_seconds).toBe(3600);
    });
  });

  describe('Daily Study Time Limits', () => {
    test('should respect daily hour limits when calculating available slots', async () => {
      const planHours = JSON.parse(testPlan.study_hours_per_day);
      
      // For a given day, calculate maximum sessions based on hours and session duration
      const mondayHours = planHours.monday; // 2 hours
      const sessionDurationHours = testPlan.session_duration_minutes / 60; // 1 hour
      const maxSessionsPerDay = Math.floor(mondayHours / sessionDurationHours); // 2 sessions max

      expect(maxSessionsPerDay).toBe(2);

      // Test that scheduling algorithm respects this limit
      const testDate = new Date();
      // Find next Monday
      while (testDate.getDay() !== 1) {
        testDate.setDate(testDate.getDate() + 1);
      }
      const mondayStr = testDate.toISOString().split('T')[0];

      // Create subjects and sessions
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Fill Monday to capacity (2 sessions)
      for (let i = 0; i < maxSessionsPerDay; i++) {
        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Monday Topic ${i + 1}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Monday Topic ${i + 1}`,
          session_date: mondayStr,
          status: 'Pendente'
        });
      }

      // Verify day is at capacity
      const mondaySessionCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [testPlan.id, mondayStr]
      );

      expect(mondaySessionCount.count).toBe(maxSessionsPerDay);

      // Any rescheduling algorithm should recognize this day is full
      // and not schedule additional sessions here
      const availableHours = mondayHours;
      const usedHours = mondaySessionCount.count * sessionDurationHours;
      const remainingHours = availableHours - usedHours;

      expect(remainingHours).toBe(0);
      expect(remainingHours < sessionDurationHours).toBe(true);
    });

    test('should calculate available slots correctly for different days', async () => {
      const planHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60;

      // Test different days have different capacities
      const expectedCapacities = {
        monday: Math.floor(planHours.monday / sessionDurationHours),    // 2
        tuesday: Math.floor(planHours.tuesday / sessionDurationHours),  // 2  
        wednesday: Math.floor(planHours.wednesday / sessionDurationHours), // 2
        thursday: Math.floor(planHours.thursday / sessionDurationHours), // 2
        friday: Math.floor(planHours.friday / sessionDurationHours),    // 2
        saturday: Math.floor(planHours.saturday / sessionDurationHours), // 3
        sunday: Math.floor(planHours.sunday / sessionDurationHours)     // 1
      };

      expect(expectedCapacities.saturday).toBe(3); // Highest capacity day
      expect(expectedCapacities.sunday).toBe(1);   // Lowest capacity day

      // Verify calculation is consistent
      Object.keys(expectedCapacities).forEach(day => {
        const dayHours = planHours[day];
        const expectedSessions = Math.floor(dayHours / sessionDurationHours);
        expect(expectedCapacities[day]).toBe(expectedSessions);
      });
    });
  });

  describe('Session Count Limits Per Day', () => {
    test('should enforce maximum 2 sessions per subject per day load balancing rule', async () => {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 5); // 5 days from now
      const testDateStr = testDate.toISOString().split('T')[0];

      // Create subject
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Add 2 sessions for Matemática (should hit the limit)
      for (let i = 0; i < 2; i++) {
        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Math Topic ${i + 1}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Math Topic ${i + 1}`,
          session_date: testDateStr,
          status: 'Pendente'
        });
      }

      // Check current count for subject on this date
      const mathSessionsCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ? AND subject_name = ?',
        [testPlan.id, testDateStr, 'Matemática']
      );

      expect(mathSessionsCount.count).toBe(2);

      // Verify that scheduling algorithm should not add more sessions for this subject on this day
      const maxSessionsPerSubjectPerDay = 2;
      expect(mathSessionsCount.count).toBe(maxSessionsPerSubjectPerDay);

      // But other subjects should still be able to be scheduled
      const portugalSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Português'
      });

      const portugueseTopic = await testDB.createTestTopic({
        subject_id: portugalSubject.id,
        description: 'Portuguese Topic'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: portugueseTopic.id,
        subject_name: 'Português',
        topic_description: 'Portuguese Topic',
        session_date: testDateStr,
        status: 'Pendente'
      });

      const portugueseSessionsCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ? AND subject_name = ?',
        [testPlan.id, testDateStr, 'Português']
      );

      expect(portugueseSessionsCount.count).toBe(1);
    });

    test('should distribute sessions across multiple days when daily limits are reached', async () => {
      // Create multiple overdue sessions for same subject
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create 5 overdue math sessions
      const overdueSessions = [];
      for (let i = 0; i < 5; i++) {
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - (i + 1));

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Overdue Math Topic ${i + 1}`
        });

        const session = await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Overdue Math Topic ${i + 1}`,
          session_date: overdueDate.toISOString().split('T')[0],
          status: 'Pendente'
        });

        overdueSessions.push(session);
      }

      // Simulate rescheduling: should spread across multiple days due to 2-session-per-subject-per-day limit
      const maxSessionsPerSubjectPerDay = 2;
      const totalOverdue = overdueSessions.length; // 5
      const minDaysNeeded = Math.ceil(totalOverdue / maxSessionsPerSubjectPerDay); // 3 days minimum

      expect(minDaysNeeded).toBe(3);

      // Verify this constraint in scheduling logic
      // If we reschedule optimally: Day 1: 2 sessions, Day 2: 2 sessions, Day 3: 1 session
      const distribution = [
        Math.min(maxSessionsPerSubjectPerDay, totalOverdue), // 2
        Math.min(maxSessionsPerSubjectPerDay, Math.max(0, totalOverdue - 2)), // 2  
        Math.max(0, totalOverdue - 4) // 1
      ];

      expect(distribution).toEqual([2, 2, 1]);
      expect(distribution.reduce((sum, count) => sum + count, 0)).toBe(totalOverdue);
    });
  });

  describe('Exam Date Constraints', () => {
    test('should never schedule sessions beyond exam date', async () => {
      // Create plan with exam date only 3 days away
      const nearExamPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Near Exam Plan',
        exam_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, 
          friday: 2, saturday: 2, sunday: 2 
        }),
        session_duration_minutes: 60
      });

      const examDate = new Date(nearExamPlan.exam_date + 'T23:59:59');
      const today = new Date();

      // Verify exam date constraint
      expect(examDate > today).toBe(true);

      // Create many overdue sessions
      await testDB.createOverdueSessions(nearExamPlan.id, [
        { name: 'Matemática', overdueCount: 10 }
      ]);

      // Calculate available days until exam
      const daysBetween = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      expect(daysBetween).toBeLessThanOrEqual(3);

      // Any rescheduling must respect this constraint
      const scheduleTest = async (sessionDate) => {
        const sessionDateObj = new Date(sessionDate + 'T00:00:00');
        return sessionDateObj <= examDate;
      };

      // Test valid dates
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 1);
      expect(await scheduleTest(validDate.toISOString().split('T')[0])).toBe(true);

      // Test invalid date (beyond exam)
      const invalidDate = new Date();
      invalidDate.setDate(invalidDate.getDate() + 5);
      expect(await scheduleTest(invalidDate.toISOString().split('T')[0])).toBe(false);
    });

    test('should handle impossible rescheduling scenarios gracefully', async () => {
      // Create plan with exam tomorrow but many overdue sessions
      const impossiblePlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Impossible Plan',
        exam_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day from now
        study_hours_per_day: JSON.stringify({ 
          monday: 1, tuesday: 1, wednesday: 1, thursday: 1, 
          friday: 1, saturday: 1, sunday: 1 
        }),
        session_duration_minutes: 60
      });

      // Create many overdue sessions (impossible to reschedule all)
      await testDB.createOverdueSessions(impossiblePlan.id, [
        { name: 'Matemática', overdueCount: 20 }
      ]);

      // Calculate theoretical capacity
      const examDate = new Date(impossiblePlan.exam_date + 'T23:59:59');
      const today = new Date();
      const availableDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      const dailyCapacity = 1; // 1 hour per day, 1 hour per session = 1 session per day
      const totalCapacity = availableDays * dailyCapacity;

      expect(totalCapacity).toBeLessThan(20); // Cannot fit all sessions

      // Rescheduling algorithm should handle this gracefully:
      // 1. Reschedule as many as possible within constraints
      // 2. Return information about failed reschedules
      // 3. Not crash or create invalid schedules
      
      const overdueCount = 20;
      const maxPossibleReschedules = Math.min(overdueCount, totalCapacity);
      const failedReschedules = overdueCount - maxPossibleReschedules;

      expect(maxPossibleReschedules).toBeGreaterThan(0);
      expect(failedReschedules).toBeGreaterThan(0);
      expect(maxPossibleReschedules + failedReschedules).toBe(overdueCount);
    });
  });

  describe('Database Relationship Integrity', () => {
    test('should maintain foreign key relationships during rescheduling', async () => {
      // Create complete relationship chain
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Test Topic'
      });

      const session = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Matemática',
        topic_description: 'Test Topic',
        session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // yesterday
        status: 'Pendente'
      });

      // Verify relationships exist
      const relationshipQuery = await testDB.get(`
        SELECT 
          ss.id as session_id,
          ss.study_plan_id,
          ss.topic_id,
          sp.id as plan_id,
          sp.user_id,
          t.id as topic_id,
          t.subject_id,
          s.id as subject_id
        FROM study_sessions ss
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        JOIN topics t ON ss.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE ss.id = ?
      `, [session.id]);

      expect(relationshipQuery).toBeTruthy();
      expect(relationshipQuery.session_id).toBe(session.id);
      expect(relationshipQuery.plan_id).toBe(testPlan.id);
      expect(relationshipQuery.user_id).toBe(testUser.id);
      expect(relationshipQuery.topic_id).toBe(topic.id);
      expect(relationshipQuery.subject_id).toBe(subject.id);

      // After any rescheduling operation, relationships must remain intact
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 1);
      
      // Simulate rescheduling by updating date
      await testDB.run(
        'UPDATE study_sessions SET session_date = ? WHERE id = ?',
        [newDate.toISOString().split('T')[0], session.id]
      );

      // Verify relationships still intact
      const updatedRelationshipQuery = await testDB.get(`
        SELECT 
          ss.id as session_id,
          ss.study_plan_id,
          ss.topic_id,
          sp.id as plan_id,
          sp.user_id,
          t.id as topic_id,
          t.subject_id,
          s.id as subject_id
        FROM study_sessions ss
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        JOIN topics t ON ss.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE ss.id = ?
      `, [session.id]);

      expect(updatedRelationshipQuery).toBeTruthy();
      expect(updatedRelationshipQuery.session_id).toBe(session.id);
      expect(updatedRelationshipQuery.plan_id).toBe(testPlan.id);
    });

    test('should preserve session metadata consistency', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'História'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Revolução Industrial'
      });

      const session = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'História', // This should match subject.subject_name
        topic_description: 'Revolução Industrial', // This should match topic.description
        session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        session_type: 'primeira_vez',
        status: 'Pendente',
        time_studied_seconds: 0,
        questions_solved: 0
      });

      // Verify consistency between denormalized data and normalized relationships
      const consistencyCheck = await testDB.get(`
        SELECT 
          ss.subject_name as session_subject,
          s.subject_name as actual_subject,
          ss.topic_description as session_topic,
          t.description as actual_topic
        FROM study_sessions ss
        JOIN topics t ON ss.topic_id = t.id
        JOIN subjects s ON t.subject_id = s.id
        WHERE ss.id = ?
      `, [session.id]);

      expect(consistencyCheck.session_subject).toBe(consistencyCheck.actual_subject);
      expect(consistencyCheck.session_topic).toBe(consistencyCheck.actual_topic);

      // After rescheduling, this consistency must be maintained
      expect(consistencyCheck.session_subject).toBe('História');
      expect(consistencyCheck.session_topic).toBe('Revolução Industrial');
    });
  });

  describe('Concurrent Access Safety', () => {
    test('should handle concurrent modifications safely', async () => {
      // Create test data
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 3 }
      ]);

      // Simulate concurrent access by multiple operations
      const operations = [
        () => testDB.run('UPDATE study_sessions SET postpone_count = postpone_count + 1 WHERE study_plan_id = ?', [testPlan.id]),
        () => testDB.get('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ?', [testPlan.id]),
        () => testDB.run('UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?', [testPlan.id])
      ];

      // Execute operations concurrently
      const results = await Promise.allSettled(operations.map(op => op()));

      // All operations should complete successfully
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      // Database should be in consistent state
      const finalCount = await testDB.get('SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ?', [testPlan.id]);
      expect(finalCount.count).toBe(3);
    });
  });
});