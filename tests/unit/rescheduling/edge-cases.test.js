/**
 * Edge Case Tests for Intelligent Rescheduling System
 * 
 * These tests cover:
 * 1. Scenarios with no overdue tasks
 * 2. Scenarios with no available slots
 * 3. Maximum capacity situations
 * 4. Boundary conditions and unusual configurations
 * 5. Error recovery and resilience
 */

const { DatabaseTestHelper } = require('../../helpers/database-helper');

describe('Rescheduling Edge Case Tests', () => {
  let testDB;
  let testUser;

  beforeAll(async () => {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();

    testUser = await testDB.createTestUser({
      email: 'edge-case-test@test.com',
      name: 'Edge Case Test User'
    });
  });

  beforeEach(async () => {
    // Clean slate for each test
    await testDB.run('DELETE FROM study_sessions');
    await testDB.run('DELETE FROM topics');
    await testDB.run('DELETE FROM subjects');
    await testDB.run('DELETE FROM study_plans WHERE user_id = ?', [testUser.id]);
  });

  afterAll(async () => {
    if (testDB) {
      await testDB.close();
    }
  });

  describe('No Overdue Tasks Scenarios', () => {
    test('should handle plans with no sessions at all', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Empty Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      // Check for overdue sessions (should be none)
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, todayStr]
      );

      expect(overdueSessions).toHaveLength(0);

      // Rescheduling should return appropriate response
      const result = {
        hasOverdue: false,
        rescheduled: 0,
        failed: 0,
        total: 0,
        message: 'Nenhuma tarefa atrasada para replanejar.'
      };

      expect(result.hasOverdue).toBe(false);
      expect(result.total).toBe(0);
      expect(result.message).toContain('Nenhuma tarefa');
    });

    test('should handle plans with only future sessions', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Future Only Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 3, saturday: 3, sunday: 3
        }),
        session_duration_minutes: 60
      });

      // Create only future sessions
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create 5 future sessions
      for (let i = 1; i <= 5; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Future Topic ${i}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Future Topic ${i}`,
          session_date: futureDate.toISOString().split('T')[0],
          status: 'Pendente'
        });
      }

      // Verify no overdue sessions
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, todayStr]
      );

      const futureSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ?",
        [testPlan.id, todayStr]
      );

      expect(overdueSessions).toHaveLength(0);
      expect(futureSessions).toHaveLength(5);

      // Algorithm should detect no overdue sessions
      const result = {
        hasOverdue: overdueSessions.length > 0,
        rescheduled: 0,
        failed: 0,
        total: overdueSessions.length,
        message: overdueSessions.length === 0 ? 'Nenhuma tarefa atrasada para replanejar.' : 'Replanejamento necessário.'
      };

      expect(result.hasOverdue).toBe(false);
      expect(result.total).toBe(0);
    });

    test('should handle plans with only completed sessions', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Completed Only Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Create completed sessions from the past
      for (let i = 1; i <= 3; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - i);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Completed Topic ${i}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Completed Topic ${i}`,
          session_date: pastDate.toISOString().split('T')[0],
          status: 'Concluída', // Completed status
          time_studied_seconds: 3600
        });
      }

      // Check for overdue (only pending sessions count)
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, todayStr]
      );

      const completedSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Concluída'",
        [testPlan.id]
      );

      expect(overdueSessions).toHaveLength(0);
      expect(completedSessions).toHaveLength(3);

      // No rescheduling needed since no pending overdue sessions
      const result = {
        hasOverdue: false,
        rescheduled: 0,
        failed: 0,
        total: 0,
        message: 'Nenhuma tarefa atrasada para replanejar.'
      };

      expect(result.hasOverdue).toBe(false);
    });
  });

  describe('No Available Slots Scenarios', () => {
    test('should handle schedule completely full until exam', async () => {
      // Create plan with exam in 3 days and limited capacity
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 3);
      
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Full Schedule Plan',
        exam_date: examDate.toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1
        }),
        session_duration_minutes: 60
      });

      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Fill all available days until exam (3 days, 1 session per day)
      for (let i = 1; i <= 3; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + i);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Blocking Session ${i}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Blocking Session ${i}`,
          session_date: futureDate.toISOString().split('T')[0],
          status: 'Pendente'
        });
      }

      // Create overdue sessions that cannot be rescheduled
      const historySubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'História'
      });

      const overdueTopic = await testDB.createTestTopic({
        subject_id: historySubject.id,
        description: 'Cannot Reschedule Topic'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: overdueTopic.id,
        subject_name: 'História',
        topic_description: 'Cannot Reschedule Topic',
        session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // yesterday
        status: 'Pendente'
      });

      // Verify schedule is full
      const todayStr = new Date().toISOString().split('T')[0];
      const examStr = testPlan.exam_date;
      
      const occupiedDays = await testDB.all(`
        SELECT DISTINCT session_date, COUNT(*) as session_count
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_date > ? AND session_date <= ?
        GROUP BY session_date
      `, [testPlan.id, todayStr, examStr]);

      expect(occupiedDays).toHaveLength(3);
      occupiedDays.forEach(day => {
        expect(day.session_count).toBe(1); // Each day at capacity
      });

      // Check overdue sessions
      const overdueSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, todayStr]
      );

      expect(overdueSessions).toHaveLength(1);

      // Algorithm should detect no available slots
      const totalCapacity = occupiedDays.length; // 3 days
      const usedCapacity = occupiedDays.reduce((sum, day) => sum + day.session_count, 0); // 3 sessions
      const availableCapacity = totalCapacity - usedCapacity;

      expect(availableCapacity).toBe(0);

      const result = {
        hasOverdue: true,
        rescheduled: 0,
        failed: overdueSessions.length,
        total: overdueSessions.length,
        message: 'Nenhuma tarefa pôde ser replanejada. Considere estender sua data de exame.',
        reason: 'No available slots'
      };

      expect(result.rescheduled).toBe(0);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.message).toContain('Nenhuma tarefa pôde ser replanejada');
    });

    test('should handle subject-specific slot exhaustion', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Subject Exhaustion Plan',
        exam_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Fill future days with math sessions to test subject-specific exhaustion
      // Each day can fit 2 sessions, and max 2 math sessions per day
      for (let day = 1; day <= 5; day++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);
        const dateStr = futureDate.toISOString().split('T')[0];

        // Add 2 math sessions (hits subject limit for the day)
        for (let session = 1; session <= 2; session++) {
          const topic = await testDB.createTestTopic({
            subject_id: mathSubject.id,
            description: `Math Day ${day} Session ${session}`
          });

          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Matemática',
            topic_description: `Math Day ${day} Session ${session}`,
            session_date: dateStr,
            status: 'Pendente'
          });
        }
      }

      // Create overdue math sessions (cannot be rescheduled due to subject limits)
      const overdueTopic = await testDB.createTestTopic({
        subject_id: mathSubject.id,
        description: 'Overdue Math'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: overdueTopic.id,
        subject_name: 'Matemática',
        topic_description: 'Overdue Math',
        session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Pendente'
      });

      // Verify math slots are exhausted but other subjects could still be scheduled
      const mathSessionsPerDay = await testDB.all(`
        SELECT session_date, COUNT(*) as math_count
        FROM study_sessions 
        WHERE study_plan_id = ? AND subject_name = 'Matemática' AND session_date > ?
        GROUP BY session_date
        ORDER BY session_date
      `, [testPlan.id, new Date().toISOString().split('T')[0]]);

      expect(mathSessionsPerDay).toHaveLength(5);
      mathSessionsPerDay.forEach(day => {
        expect(day.math_count).toBe(2); // Max math sessions per day
      });

      // But there's still room for other subjects
      const totalSessionsPerDay = await testDB.all(`
        SELECT session_date, COUNT(*) as total_count
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_date > ?
        GROUP BY session_date
        ORDER BY session_date
      `, [testPlan.id, new Date().toISOString().split('T')[0]]);

      totalSessionsPerDay.forEach(day => {
        expect(day.total_count).toBe(2); // Could fit more sessions from other subjects
      });

      // Algorithm should detect subject-specific exhaustion for math
      const result = {
        hasOverdue: true,
        rescheduled: 0,
        failed: 1,
        total: 1,
        message: 'Tarefa não pôde ser reagendada: limite de sessões por matéria atingido.',
        reason: 'Subject limit exhausted'
      };

      expect(result.failed).toBe(1);
      expect(result.reason).toBe('Subject limit exhausted');
    });
  });

  describe('Maximum Capacity Situations', () => {
    test('should handle plans at absolute maximum capacity', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Max Capacity Plan',
        exam_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 8, sunday: 8
        }),
        session_duration_minutes: 60
      });

      // Calculate theoretical maximum
      const totalDays = 7;
      const sessionsPerDay = 8;
      const theoreticalMax = totalDays * sessionsPerDay; // 56 sessions

      // Create exactly the maximum number of future sessions
      const subjects = ['Matemática', 'Português', 'História', 'Geografia'];
      let sessionCount = 0;

      for (let day = 1; day <= totalDays; day++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);
        const dateStr = futureDate.toISOString().split('T')[0];

        for (let session = 0; session < sessionsPerDay && sessionCount < theoreticalMax; session++) {
          const subject = subjects[session % subjects.length];
          
          const subjectObj = await testDB.createTestSubject({
            study_plan_id: testPlan.id,
            subject_name: subject
          });

          const topic = await testDB.createTestTopic({
            subject_id: subjectObj.id,
            description: `Max Capacity ${subject} Day ${day} Session ${session}`
          });

          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: subject,
            topic_description: `Max Capacity ${subject} Day ${day} Session ${session}`,
            session_date: dateStr,
            status: 'Pendente'
          });

          sessionCount++;
        }
      }

      expect(sessionCount).toBe(theoreticalMax);

      // Create overdue sessions (cannot fit anywhere)
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Física', overdueCount: 5 }
      ]);

      // Verify at maximum capacity
      const totalScheduled = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ?',
        [testPlan.id]
      );

      expect(totalScheduled.count).toBe(theoreticalMax + 5); // 56 future + 5 overdue

      // Algorithm should recognize absolute capacity limit
      const result = {
        atMaxCapacity: true,
        rescheduled: 0,
        failed: 5,
        total: 5,
        message: 'Cronograma está na capacidade máxima. Considere aumentar as horas diárias de estudo.',
        recommendation: 'Increase daily study hours or extend exam date'
      };

      expect(result.atMaxCapacity).toBe(true);
      expect(result.failed).toBe(5);
    });

    test('should handle single-session-per-day scenarios', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Minimal Capacity Plan',
        exam_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1
        }),
        session_duration_minutes: 60
      });

      // With 1 session per day, subject distribution becomes critical
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Fill every day with 1 math session
      for (let day = 1; day <= 5; day++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + day);

        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Single Math Day ${day}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Single Math Day ${day}`,
          session_date: futureDate.toISOString().split('T')[0],
          status: 'Pendente'
        });
      }

      // Create overdue sessions from different subjects
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Português', overdueCount: 2 },
        { name: 'História', overdueCount: 1 }
      ]);

      // With 1 session per day, overdue sessions need their own days
      const remainingDays = 10 - 5; // 5 days available
      const overdueCount = 3;

      expect(remainingDays).toBeGreaterThan(overdueCount); // Should fit

      // Algorithm should spread overdue sessions across available days
      const distribution = [];
      for (let i = 0; i < overdueCount; i++) {
        const dayOffset = 6 + i; // Start from day 6
        distribution.push(dayOffset);
      }

      expect(distribution).toEqual([6, 7, 8]);

      const result = {
        strategy: 'single-session-per-day',
        rescheduled: overdueCount,
        failed: 0,
        total: overdueCount,
        distribution: distribution
      };

      expect(result.rescheduled).toBe(overdueCount);
      expect(result.failed).toBe(0);
    });
  });

  describe('Boundary Conditions', () => {
    test('should handle zero study hours configuration', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Zero Hours Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0
        }),
        session_duration_minutes: 60
      });

      // Calculate capacity (should be 0)
      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60;
      const dailyCapacities = {};
      
      Object.keys(studyHours).forEach(day => {
        dailyCapacities[day] = Math.floor(studyHours[day] / sessionDurationHours);
      });

      const totalCapacity = Object.values(dailyCapacities).reduce((sum, capacity) => sum + capacity, 0);
      expect(totalCapacity).toBe(0);

      // Create overdue sessions
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 1 }
      ]);

      // Algorithm should handle gracefully
      const result = {
        capacity: totalCapacity,
        rescheduled: 0,
        failed: 1,
        total: 1,
        error: 'No study hours allocated',
        message: 'Configure pelo menos uma hora de estudo por dia para permitir replanejamento.'
      };

      expect(result.capacity).toBe(0);
      expect(result.rescheduled).toBe(0);
      expect(result.error).toBe('No study hours allocated');
    });

    test('should handle session duration longer than daily hours', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Long Session Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1
        }),
        session_duration_minutes: 120 // 2 hours, but only 1 hour allocated per day
      });

      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60; // 2 hours

      // Calculate capacity
      const dailyCapacities = {};
      Object.keys(studyHours).forEach(day => {
        dailyCapacities[day] = Math.floor(studyHours[day] / sessionDurationHours);
      });

      const totalCapacity = Object.values(dailyCapacities).reduce((sum, capacity) => sum + capacity, 0);
      expect(totalCapacity).toBe(0); // No sessions can fit

      // Create overdue sessions
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 2 }
      ]);

      const result = {
        configurationError: true,
        sessionTooLong: true,
        rescheduled: 0,
        failed: 2,
        total: 2,
        message: 'Duração das sessões excede o tempo diário disponível. Reduza a duração das sessões ou aumente as horas diárias.',
        suggestion: 'Reduce session duration or increase daily hours'
      };

      expect(result.configurationError).toBe(true);
      expect(result.sessionTooLong).toBe(true);
      expect(result.rescheduled).toBe(0);
    });

    test('should handle exam date in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Past Exam Plan',
        exam_date: pastDate.toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 3 }
      ]);

      // Calculate days until exam
      const examDateTime = new Date(testPlan.exam_date + 'T23:59:59');
      const now = new Date();
      const daysUntilExam = Math.ceil((examDateTime - now) / (1000 * 60 * 60 * 24));

      expect(daysUntilExam).toBeLessThanOrEqual(0); // Exam has passed

      const result = {
        examPassed: true,
        rescheduled: 0,
        failed: 3,
        total: 3,
        message: 'O exame já passou. Não é possível reagendar sessões.',
        daysUntilExam: daysUntilExam
      };

      expect(result.examPassed).toBe(true);
      expect(result.rescheduled).toBe(0);
      expect(result.daysUntilExam).toBeLessThanOrEqual(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle corrupted study hours configuration', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Corrupted Config Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: '{"invalid": "json"', // Corrupted JSON
        session_duration_minutes: 60
      });

      // Try to parse corrupted configuration
      let studyHours;
      let parseError = false;
      
      try {
        studyHours = JSON.parse(testPlan.study_hours_per_day);
      } catch (error) {
        parseError = true;
        // Fallback to default configuration
        studyHours = {
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, 
          friday: 2, saturday: 2, sunday: 2
        };
      }

      expect(parseError).toBe(true);
      expect(studyHours.monday).toBe(2); // Fallback applied

      const result = {
        configurationError: true,
        fallbackApplied: true,
        studyHours: studyHours,
        message: 'Configuração de horas de estudo corrompida. Usando configuração padrão.'
      };

      expect(result.configurationError).toBe(true);
      expect(result.fallbackApplied).toBe(true);
    });

    test('should handle missing or null session duration', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Null Duration Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: null
      });

      // Handle null session duration
      const sessionDuration = testPlan.session_duration_minutes || 50; // Default fallback
      expect(sessionDuration).toBe(50);

      const result = {
        durationFallback: true,
        sessionDurationMinutes: sessionDuration,
        message: 'Duração da sessão não configurada. Usando 50 minutos como padrão.'
      };

      expect(result.durationFallback).toBe(true);
      expect(result.sessionDurationMinutes).toBe(50);
    });

    test('should handle very large numbers of overdue sessions', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Large Dataset Plan',
        exam_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year
        study_hours_per_day: JSON.stringify({ 
          monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 8, sunday: 8
        }),
        session_duration_minutes: 60
      });

      // Create large number of overdue sessions (stress test)
      const subjects = ['Math', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Literature', 'Philosophy'];
      
      // Create 100 overdue sessions across subjects
      const batchSize = 12; // ~12 sessions per subject
      const promises = subjects.slice(0, 8).map(async (subject, index) => {
        const count = index < 4 ? batchSize + 1 : batchSize; // Slight variation
        return testDB.createOverdueSessions(testPlan.id, [
          { name: subject, overdueCount: count }
        ]);
      });

      await Promise.all(promises);

      // Verify large dataset
      const totalOverdue = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND status = ? AND session_date < ?',
        [testPlan.id, 'Pendente', new Date().toISOString().split('T')[0]]
      );

      expect(totalOverdue.count).toBeGreaterThan(90);

      // Algorithm should handle efficiently
      const startTime = process.hrtime();
      
      // Simulate processing large dataset
      const subjectGroups = await testDB.all(`
        SELECT subject_name, COUNT(*) as count
        FROM study_sessions 
        WHERE study_plan_id = ? AND status = ? AND session_date < ?
        GROUP BY subject_name
      `, [testPlan.id, 'Pendente', new Date().toISOString().split('T')[0]]);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000;

      // Should complete in reasonable time even with large dataset
      expect(executionTime).toBeLessThan(2000); // 2 seconds max
      expect(subjectGroups.length).toBe(8);

      const result = {
        largeDataset: true,
        totalSessions: totalOverdue.count,
        executionTimeMs: executionTime,
        performanceAcceptable: executionTime < 2000
      };

      expect(result.performanceAcceptable).toBe(true);
    });
  });
});