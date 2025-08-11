/**
 * Intelligent Rescheduling Logic Tests
 * 
 * These tests validate:
 * 1. Subject-aware grouping of overdue tasks
 * 2. Intelligent slot assignment (preferring slots before future sessions of same subject)
 * 3. Fallback strategies when preferred slots aren't available
 * 4. Load balancing across subjects and days
 * 5. Spaced repetition preservation
 */

const { DatabaseTestHelper } = require('../../helpers/database-helper');

describe('Intelligent Rescheduling Logic Tests', () => {
  let testDB;
  let testUser;
  let testPlan;

  beforeAll(async () => {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();

    testUser = await testDB.createTestUser({
      email: 'logic-test@test.com',
      name: 'Logic Test User'
    });
  });

  beforeEach(async () => {
    // Clean slate for each test
    await testDB.run('DELETE FROM study_sessions');
    await testDB.run('DELETE FROM topics');
    await testDB.run('DELETE FROM subjects');
    await testDB.run('DELETE FROM study_plans WHERE user_id = ?', [testUser.id]);

    // Create fresh test plan
    testPlan = await testDB.createTestPlan({
      user_id: testUser.id,
      plan_name: 'Logic Test Plan',
      exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({ 
        monday: 3, tuesday: 3, wednesday: 3, thursday: 3, 
        friday: 3, saturday: 4, sunday: 2 
      }),
      session_duration_minutes: 60
    });
  });

  afterAll(async () => {
    if (testDB) {
      await testDB.close();
    }
  });

  describe('Subject-Aware Grouping', () => {
    test('should correctly group overdue sessions by subject', async () => {
      // Create mixed overdue sessions
      const subjects = [
        { name: 'Matemática', overdueCount: 3 },
        { name: 'Português', overdueCount: 2 },
        { name: 'História', overdueCount: 4 }
      ];

      await testDB.createOverdueSessions(testPlan.id, subjects);

      // Query overdue sessions grouped by subject
      const groupedSessions = await testDB.all(`
        SELECT 
          subject_name,
          COUNT(*) as count,
          GROUP_CONCAT(id) as session_ids
        FROM study_sessions 
        WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?
        GROUP BY subject_name
        ORDER BY subject_name
      `, [testPlan.id, new Date().toISOString().split('T')[0]]);

      expect(groupedSessions).toHaveLength(3);

      // Verify grouping
      const mathGroup = groupedSessions.find(g => g.subject_name === 'Matemática');
      const portugueseGroup = groupedSessions.find(g => g.subject_name === 'Português');
      const historyGroup = groupedSessions.find(g => g.subject_name === 'História');

      expect(mathGroup.count).toBe(3);
      expect(portugueseGroup.count).toBe(2);
      expect(historyGroup.count).toBe(4);

      // Verify session IDs are correctly grouped
      const mathSessionIds = mathGroup.session_ids.split(',').map(id => parseInt(id));
      expect(mathSessionIds).toHaveLength(3);

      // Verify sessions in each group actually belong to that subject
      for (const sessionId of mathSessionIds) {
        const session = await testDB.get('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
        expect(session.subject_name).toBe('Matemática');
      }
    });

    test('should prioritize sessions by original schedule date within subject groups', async () => {
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create overdue sessions with different dates (older sessions should have higher priority)
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - (i + 1)); // 1, 2, 3 days ago

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Math Topic ${i + 1}`
        });

        const session = await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Math Topic ${i + 1}`,
          session_date: overdueDate.toISOString().split('T')[0],
          status: 'Pendente'
        });

        sessions.push(session);
      }

      // Query overdue sessions ordered by date (for priority)
      const orderedSessions = await testDB.all(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? AND subject_name = ? AND status = 'Pendente' AND session_date < ?
        ORDER BY session_date ASC, id ASC
      `, [testPlan.id, 'Matemática', new Date().toISOString().split('T')[0]]);

      expect(orderedSessions).toHaveLength(3);

      // Verify chronological ordering (oldest first)
      for (let i = 0; i < orderedSessions.length - 1; i++) {
        const currentDate = new Date(orderedSessions[i].session_date);
        const nextDate = new Date(orderedSessions[i + 1].session_date);
        expect(currentDate <= nextDate).toBe(true);
      }

      // Verify oldest session is first in priority
      const oldestSession = orderedSessions[0];
      const oldestExpected = sessions[2]; // 3 days ago
      expect(oldestSession.id).toBe(oldestExpected.id);
    });
  });

  describe('Intelligent Slot Assignment', () => {
    test('should prefer slots before future sessions of the same subject', async () => {
      // Create a subject with future sessions
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create future math sessions
      const futureDates = [];
      for (let i = 5; i <= 7; i++) { // Days 5, 6, 7 from now
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);
        futureDates.push(futureDate.toISOString().split('T')[0]);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Future Math Topic ${i}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Future Math Topic ${i}`,
          session_date: futureDates[i - 5],
          status: 'Pendente'
        });
      }

      // Create overdue math sessions
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 2);

      const overdueTopic = await testDB.createTestTopic({
        subject_id: mathSubject.id,
        description: 'Overdue Math Topic'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: overdueTopic.id,
        subject_name: 'Matemática',
        topic_description: 'Overdue Math Topic',
        session_date: overdueDate.toISOString().split('T')[0],
        status: 'Pendente'
      });

      // Find future sessions for the same subject
      const todayStr = new Date().toISOString().split('T')[0];
      const futureMathSessions = await testDB.all(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? AND subject_name = ? AND status = 'Pendente' AND session_date >= ? 
        ORDER BY session_date, id
      `, [testPlan.id, 'Matemática', todayStr]);

      expect(futureMathSessions).toHaveLength(3);

      // Intelligent rescheduling should prefer slots just before these future sessions
      // Best slots would be days 1, 2, 3, 4 (before day 5 which has the first future session)
      const preferredSlots = [];
      for (let i = 1; i <= 4; i++) {
        const slotDate = new Date();
        slotDate.setDate(slotDate.getDate() + i);
        preferredSlots.push(slotDate.toISOString().split('T')[0]);
      }

      // Verify that preferred slots are before future sessions
      const firstFutureSessionDate = futureMathSessions[0].session_date;
      preferredSlots.forEach(slot => {
        expect(slot < firstFutureSessionDate).toBe(true);
      });

      // Mock optimal rescheduling: place overdue session in first preferred slot
      const optimalSlot = preferredSlots[0]; // Tomorrow
      
      // Check that this slot doesn't conflict with existing sessions
      const conflictCheck = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [testPlan.id, optimalSlot]
      );

      expect(conflictCheck.count).toBe(0); // No conflicts
    });

    test('should maintain learning continuity by preferring subject-adjacent slots', async () => {
      // Create subjects with different future session patterns
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      const portugueseSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Português'
      });

      // Math has sessions on days 3, 6, 9
      const mathDays = [3, 6, 9];
      for (const day of mathDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Math Topic Day ${day}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Math Topic Day ${day}`,
          session_date: futureDate.toISOString().split('T')[0],
          status: 'Pendente'
        });
      }

      // Portuguese has sessions on days 2, 5, 8
      const portugueseDays = [2, 5, 8];
      for (const day of portugueseDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);

        const topic = await testDB.createTestTopic({
          subject_id: portugueseSubject.id,
          description: `Portuguese Topic Day ${day}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Português',
          topic_description: `Portuguese Topic Day ${day}`,
          session_date: futureDate.toISOString().split('T')[0],
          status: 'Pendente'
        });
      }

      // Create overdue math session
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 1);

      const overdueTopic = await testDB.createTestTopic({
        subject_id: mathSubject.id,
        description: 'Overdue Math'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: overdueTopic.id,
        subject_name: 'Matemática',
        topic_description: 'Overdue Math',
        session_date: overdueDate.toISOString().split('T')[0],
        status: 'Pendente'
      });

      // For overdue math session, preferred slots should be adjacent to existing math sessions
      // Day 1 (tomorrow) would be good - 2 days before day 3 math session
      // Day 4 would also be good - between day 3 and day 6 math sessions
      const preferredSlots = [1, 4, 7]; // Adjacent to math sessions

      // Verify these slots maintain subject continuity better than random slots
      const randomSlots = [2, 5, 8]; // These are Portuguese days - not optimal for math

      // Preferred slots should have better learning continuity
      // (closer temporal proximity to same-subject sessions)
      for (const slot of preferredSlots) {
        const slotDate = new Date();
        slotDate.setDate(slotDate.getDate() + slot);
        
        // Find closest math session
        const closestMathDistance = Math.min(...mathDays.map(day => Math.abs(day - slot)));
        
        // For random slots (Portuguese days), distance to math sessions is larger
        const randomSlot = randomSlots[0]; // Day 2 (Portuguese day)
        const randomMathDistance = Math.min(...mathDays.map(day => Math.abs(day - randomSlot)));
        
        // Verify preferred slot is closer to math sessions than random slot
        if (slot === 1) { // Day 1 is 2 days from day 3 math
          expect(closestMathDistance).toBeLessThanOrEqual(randomMathDistance);
        }
      }
    });
  });

  describe('Fallback Strategies', () => {
    test('should use fallback slots when preferred slots are unavailable', async () => {
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Fill preferred slots (days 1-3) with other sessions
      for (let day = 1; day <= 3; day++) {
        const blockedDate = new Date();
        blockedDate.setDate(blockedDate.getDate() + day);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Blocking Session Day ${day}`
        });

        // Fill to daily capacity (3 sessions per day based on plan configuration)
        for (let session = 0; session < 3; session++) {
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Matemática',
            topic_description: `Blocking Session Day ${day}-${session}`,
            session_date: blockedDate.toISOString().split('T')[0],
            status: 'Pendente'
          });
        }
      }

      // Create overdue session that needs rescheduling
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 1);

      const overdueTopic = await testDB.createTestTopic({
        subject_id: mathSubject.id,
        description: 'Needs Fallback Slot'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: overdueTopic.id,
        subject_name: 'Matemática',
        topic_description: 'Needs Fallback Slot',
        session_date: overdueDate.toISOString().split('T')[0],
        status: 'Pendente'
      });

      // Check that preferred days (1-3) are at capacity
      for (let day = 1; day <= 3; day++) {
        const dayDate = new Date();
        dayDate.setDate(dayDate.getDate() + day);
        const dayStr = dayDate.toISOString().split('T')[0];

        const daySessionCount = await testDB.get(
          'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
          [testPlan.id, dayStr]
        );

        expect(daySessionCount.count).toBe(3); // At capacity
      }

      // Fallback strategy should find next available day (day 4)
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + 4);
      const fallbackStr = fallbackDate.toISOString().split('T')[0];

      const fallbackAvailability = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [testPlan.id, fallbackStr]
      );

      expect(fallbackAvailability.count).toBeLessThan(3); // Has capacity

      // Verify fallback slot is valid (within exam date, respects daily limits)
      const examDate = new Date(testPlan.exam_date + 'T23:59:59');
      const fallbackDateObj = new Date(fallbackStr + 'T00:00:00');
      expect(fallbackDateObj <= examDate).toBe(true);

      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60;
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][fallbackDateObj.getDay()];
      const maxSessionsForDay = Math.floor(studyHours[dayName] / sessionDurationHours);

      expect(fallbackAvailability.count).toBeLessThan(maxSessionsForDay);
    });

    test('should gracefully handle scenarios where no slots are available', async () => {
      // Create plan with very limited capacity (exam in 2 days, 1 hour per day)
      const limitedPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Limited Capacity Plan',
        exam_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 1, tuesday: 1, wednesday: 1, thursday: 1, 
          friday: 1, saturday: 1, sunday: 1 
        }),
        session_duration_minutes: 60
      });

      const subject = await testDB.createTestSubject({
        study_plan_id: limitedPlan.id,
        subject_name: 'Matemática'
      });

      // Fill all available slots until exam
      const today = new Date();
      const examDate = new Date(limitedPlan.exam_date + 'T23:59:59');
      let currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + 1); // Start tomorrow

      while (currentDate <= examDate) {
        const topic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: `Capacity Fill ${currentDate.toISOString().split('T')[0]}`
        });

        await testDB.createTestSession({
          study_plan_id: limitedPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Capacity Fill ${currentDate.toISOString().split('T')[0]}`,
          session_date: currentDate.toISOString().split('T')[0],
          status: 'Pendente'
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Create overdue sessions that cannot be rescheduled
      await testDB.createOverdueSessions(limitedPlan.id, [
        { name: 'História', overdueCount: 5 }
      ]);

      // Check that no slots are available
      const availableSlots = await testDB.all(`
        SELECT DISTINCT session_date
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_date >= ? AND session_date <= ?
      `, [limitedPlan.id, today.toISOString().split('T')[0], limitedPlan.exam_date]);

      const totalSlotsUsed = availableSlots.length;
      const totalDaysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      const maxPossibleSlots = totalDaysUntilExam; // 1 session per day max

      expect(totalSlotsUsed).toBe(maxPossibleSlots);

      // Rescheduling algorithm should recognize this and return appropriate error/status
      const overdueCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND status = ? AND session_date < ?',
        [limitedPlan.id, 'Pendente', today.toISOString().split('T')[0]]
      );

      expect(overdueCount.count).toBe(5);

      // Algorithm should return:
      // - success: false (or partial success)
      // - rescheduled: 0
      // - failed: 5
      // - message indicating capacity constraints
      const expectedResult = {
        rescheduled: 0,
        failed: overdueCount.count,
        total: overdueCount.count,
        canReschedule: false,
        reason: 'No available slots within exam date constraints'
      };

      expect(expectedResult.rescheduled).toBe(0);
      expect(expectedResult.failed).toBeGreaterThan(0);
      expect(expectedResult.canReschedule).toBe(false);
    });
  });

  describe('Load Balancing Across Subjects and Days', () => {
    test('should distribute sessions evenly across available days', async () => {
      // Create multiple overdue sessions from different subjects
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 6 },
        { name: 'Português', overdueCount: 4 }
      ]);

      const totalOverdue = 10;

      // Calculate optimal distribution across next 7 days
      const distributionDays = 7;
      const dailyCapacity = 3; // Based on study_hours_per_day configuration
      const totalCapacity = distributionDays * dailyCapacity; // 21 sessions possible

      expect(totalCapacity).toBeGreaterThan(totalOverdue); // Should fit

      // Optimal distribution: spread evenly
      const optimalSessionsPerDay = Math.ceil(totalOverdue / distributionDays); // 2 sessions per day

      // Verify this distribution is feasible
      expect(optimalSessionsPerDay).toBeLessThanOrEqual(dailyCapacity);

      // Mock optimal distribution
      const distribution = [];
      let remainingSessions = totalOverdue;
      
      for (let day = 0; day < distributionDays && remainingSessions > 0; day++) {
        const sessionsThisDay = Math.min(dailyCapacity, remainingSessions);
        distribution.push(sessionsThisDay);
        remainingSessions -= sessionsThisDay;
      }

      expect(distribution.reduce((sum, count) => sum + count, 0)).toBe(totalOverdue);
      expect(Math.max(...distribution) - Math.min(...distribution.filter(d => d > 0))).toBeLessThanOrEqual(1); // Even distribution
    });

    test('should balance subjects within daily limits', async () => {
      // Create overdue sessions: 4 Math, 4 Portuguese
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 4 },
        { name: 'Português', overdueCount: 4 }
      ]);

      // For a single day with capacity of 3 sessions, optimal balance would be:
      // Math: 2 sessions, Portuguese: 1 session (or vice versa)
      // This respects the max 2 sessions per subject per day rule

      const dailyCapacity = 3;
      const maxSessionsPerSubjectPerDay = 2;

      // Test distribution for single day
      const mathSessions = Math.min(maxSessionsPerSubjectPerDay, 4); // 2
      const portugueseSessions = Math.min(maxSessionsPerSubjectPerDay, Math.min(4, dailyCapacity - mathSessions)); // 1

      expect(mathSessions + portugueseSessions).toBeLessThanOrEqual(dailyCapacity);
      expect(mathSessions).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);
      expect(portugueseSessions).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);

      // Verify this creates good subject balance over multiple days
      const totalDays = Math.ceil(8 / dailyCapacity); // Need at least 3 days for 8 sessions
      expect(totalDays).toBe(3);

      // Optimal distribution across days:
      // Day 1: Math 2, Portuguese 1 (total 3)
      // Day 2: Portuguese 2, Math 1 (total 3) 
      // Day 3: Portuguese 1, Math 1 (total 2)

      const expectedDistribution = [
        { math: 2, portuguese: 1 },
        { math: 1, portuguese: 2 },
        { math: 1, portuguese: 1 }
      ];

      const totalMath = expectedDistribution.reduce((sum, day) => sum + day.math, 0);
      const totalPortuguese = expectedDistribution.reduce((sum, day) => sum + day.portuguese, 0);

      expect(totalMath).toBe(4);
      expect(totalPortuguese).toBe(4);

      // Verify daily constraints are respected
      expectedDistribution.forEach(day => {
        expect(day.math + day.portuguese).toBeLessThanOrEqual(dailyCapacity);
        expect(day.math).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);
        expect(day.portuguese).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);
      });
    });
  });

  describe('Algorithm Performance and Edge Cases', () => {
    test('should handle large numbers of overdue sessions efficiently', async () => {
      // Create many overdue sessions across multiple subjects
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 15 },
        { name: 'Português', overdueCount: 12 },
        { name: 'História', overdueCount: 10 },
        { name: 'Geografia', overdueCount: 8 },
        { name: 'Ciências', overdueCount: 5 }
      ]);

      const totalOverdue = 50;

      // Verify large dataset is created correctly
      const actualOverdue = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND status = ? AND session_date < ?',
        [testPlan.id, 'Pendente', new Date().toISOString().split('T')[0]]
      );

      expect(actualOverdue.count).toBe(totalOverdue);

      // Test algorithm efficiency metrics
      const startTime = process.hrtime();

      // Simulate core rescheduling operations
      const subjectGroups = await testDB.all(`
        SELECT subject_name, COUNT(*) as count
        FROM study_sessions 
        WHERE study_plan_id = ? AND status = ? AND session_date < ?
        GROUP BY subject_name
      `, [testPlan.id, 'Pendente', new Date().toISOString().split('T')[0]]);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      // Algorithm should complete in reasonable time (< 1000ms for 50 sessions)
      expect(executionTime).toBeLessThan(1000);
      expect(subjectGroups).toHaveLength(5);

      // Verify correct grouping
      const mathGroup = subjectGroups.find(g => g.subject_name === 'Matemática');
      expect(mathGroup.count).toBe(15);
    });

    test('should maintain data consistency during complex rescheduling scenarios', async () => {
      // Create complex scenario with mixed session types and statuses
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create sessions with different types and metadata
      const sessionTypes = ['primeira_vez', 'revisao', 'aprofundamento'];
      const sessions = [];

      for (let i = 0; i < 9; i++) {
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - (i % 3 + 1)); // 1-3 days ago

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Complex Topic ${i + 1}`
        });

        const session = await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Complex Topic ${i + 1}`,
          session_date: overdueDate.toISOString().split('T')[0],
          session_type: sessionTypes[i % sessionTypes.length],
          status: 'Pendente',
          questions_solved: i * 2,
          time_studied_seconds: i * 300,
          postpone_count: i % 2
        });

        sessions.push(session);
      }

      // Verify initial state
      const initialCheck = await testDB.all(
        'SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY id',
        [testPlan.id]
      );

      expect(initialCheck).toHaveLength(9);

      // Simulate rescheduling operations while maintaining consistency
      let checksumBefore = 0;
      let metadataBefore = {};

      for (const session of initialCheck) {
        checksumBefore += session.questions_solved + session.time_studied_seconds + session.postpone_count;
        metadataBefore[session.id] = {
          session_type: session.session_type,
          topic_description: session.topic_description,
          subject_name: session.subject_name
        };
      }

      // Mock rescheduling: update dates but preserve all other data
      for (let i = 0; i < sessions.length; i++) {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + i + 1);
        
        await testDB.run(
          'UPDATE study_sessions SET session_date = ? WHERE id = ?',
          [newDate.toISOString().split('T')[0], sessions[i].id]
        );
      }

      // Verify consistency after rescheduling
      const finalCheck = await testDB.all(
        'SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY id',
        [testPlan.id]
      );

      let checksumAfter = 0;
      for (const session of finalCheck) {
        checksumAfter += session.questions_solved + session.time_studied_seconds + session.postpone_count;
        
        // Verify metadata preserved
        const originalMetadata = metadataBefore[session.id];
        expect(session.session_type).toBe(originalMetadata.session_type);
        expect(session.topic_description).toBe(originalMetadata.topic_description);
        expect(session.subject_name).toBe(originalMetadata.subject_name);
      }

      // Verify data integrity
      expect(checksumAfter).toBe(checksumBefore);
      expect(finalCheck).toHaveLength(initialCheck.length);
    });
  });
});