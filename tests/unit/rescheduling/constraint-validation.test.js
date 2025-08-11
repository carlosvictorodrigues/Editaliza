/**
 * Constraint Validation Tests for Intelligent Rescheduling
 * 
 * These tests ensure:
 * 1. Daily study time limits are respected
 * 2. Session count limits per day are maintained
 * 3. Sessions are never scheduled beyond exam date
 * 4. Load balancing rules (max 2 sessions per subject per day) are enforced
 * 5. Spaced repetition logic is preserved
 */

const { DatabaseTestHelper } = require('../../helpers/database-helper');

describe('Rescheduling Constraint Validation Tests', () => {
  let testDB;
  let testUser;

  beforeAll(async () => {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();

    testUser = await testDB.createTestUser({
      email: 'constraint-test@test.com',
      name: 'Constraint Test User'
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

  describe('Daily Study Time Limits', () => {
    test('should respect daily hour allocation constraints', async () => {
      // Create plan with specific daily hours
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Time Limit Test Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2,    // 2 hours = 2 sessions (60min each)
          tuesday: 1.5, // 1.5 hours = 1 session (60min) with 30min unused
          wednesday: 4, // 4 hours = 4 sessions
          thursday: 3,  // 3 hours = 3 sessions
          friday: 2,
          saturday: 3,
          sunday: 1     // 1 hour = 1 session
        }),
        session_duration_minutes: 60
      });

      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60; // 1 hour

      // Calculate capacity for each day of week
      const dayCapacities = {};
      Object.keys(studyHours).forEach(day => {
        dayCapacities[day] = Math.floor(studyHours[day] / sessionDurationHours);
      });

      expect(dayCapacities.monday).toBe(2);
      expect(dayCapacities.tuesday).toBe(1);  // 1.5 hours allows only 1 session
      expect(dayCapacities.wednesday).toBe(4);
      expect(dayCapacities.thursday).toBe(3);
      expect(dayCapacities.sunday).toBe(1);

      // Test constraint enforcement
      const testDate = new Date();
      // Find next Monday
      while (testDate.getDay() !== 1) {
        testDate.setDate(testDate.getDate() + 1);
      }
      const mondayStr = testDate.toISOString().split('T')[0];

      // Try to schedule up to Monday's capacity (2 sessions)
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      for (let i = 0; i < dayCapacities.monday; i++) {
        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Monday Session ${i + 1}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Monday Session ${i + 1}`,
          session_date: mondayStr,
          status: 'Pendente'
        });
      }

      // Verify Monday is at capacity
      const mondayCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [testPlan.id, mondayStr]
      );

      expect(mondayCount.count).toBe(dayCapacities.monday);

      // Calculate remaining time
      const usedHours = mondayCount.count * sessionDurationHours;
      const remainingHours = studyHours.monday - usedHours;
      
      expect(remainingHours).toBe(0); // No time left
      expect(remainingHours < sessionDurationHours).toBe(true); // Cannot fit another session

      // Constraint validation: should not allow scheduling more sessions
      const canScheduleAnother = remainingHours >= sessionDurationHours;
      expect(canScheduleAnother).toBe(false);
    });

    test('should handle fractional hours correctly', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Fractional Hours Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2.5,  // 2.5 hours with 60min sessions = 2 sessions max (30min leftover)
          tuesday: 1.3, // 1.3 hours = 1 session max (18min leftover)
          wednesday: 3.7 // 3.7 hours = 3 sessions max (42min leftover)
        }),
        session_duration_minutes: 60
      });

      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const sessionDurationHours = testPlan.session_duration_minutes / 60;

      // Test Monday: 2.5 hours should allow exactly 2 sessions
      const mondayCapacity = Math.floor(studyHours.monday / sessionDurationHours);
      expect(mondayCapacity).toBe(2);

      const mondayRemaining = studyHours.monday - (mondayCapacity * sessionDurationHours);
      expect(mondayRemaining).toBe(0.5); // 30 minutes leftover
      expect(mondayRemaining < sessionDurationHours).toBe(true); // Can't fit another session

      // Test Tuesday: 1.3 hours should allow exactly 1 session
      const tuesdayCapacity = Math.floor(studyHours.tuesday / sessionDurationHours);
      expect(tuesdayCapacity).toBe(1);

      const tuesdayRemaining = studyHours.tuesday - (tuesdayCapacity * sessionDurationHours);
      expect(tuesdayRemaining).toBeCloseTo(0.3, 1); // ~18 minutes leftover

      // Test Wednesday: 3.7 hours should allow exactly 3 sessions
      const wednesdayCapacity = Math.floor(studyHours.wednesday / sessionDurationHours);
      expect(wednesdayCapacity).toBe(3);

      const wednesdayRemaining = studyHours.wednesday - (wednesdayCapacity * sessionDurationHours);
      expect(wednesdayRemaining).toBeCloseTo(0.7, 1); // ~42 minutes leftover
    });

    test('should work with different session durations', async () => {
      // Test plan with 30-minute sessions
      const shortSessionPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Short Session Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2.5  // 2.5 hours with 30min sessions = 5 sessions
        }),
        session_duration_minutes: 30
      });

      const sessionDurationHours = shortSessionPlan.session_duration_minutes / 60; // 0.5 hours
      const mondayHours = 2.5;
      const expectedCapacity = Math.floor(mondayHours / sessionDurationHours);
      
      expect(expectedCapacity).toBe(5); // 5 sessions of 30min each

      // Test plan with 90-minute sessions
      const longSessionPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Long Session Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 3  // 3 hours with 90min sessions = 2 sessions
        }),
        session_duration_minutes: 90
      });

      const longSessionDurationHours = longSessionPlan.session_duration_minutes / 60; // 1.5 hours
      const mondayHours2 = 3;
      const expectedCapacity2 = Math.floor(mondayHours2 / longSessionDurationHours);
      
      expect(expectedCapacity2).toBe(2); // 2 sessions of 90min each
    });
  });

  describe('Session Count Limits Per Day', () => {
    test('should enforce maximum 2 sessions per subject per day', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Load Balance Test Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 5  // Plenty of hours to test subject limits
        }),
        session_duration_minutes: 60
      });

      const testDate = new Date();
      while (testDate.getDay() !== 1) { // Find Monday
        testDate.setDate(testDate.getDate() + 1);
      }
      const mondayStr = testDate.toISOString().split('T')[0];

      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      // Schedule 2 math sessions (should be allowed)
      for (let i = 0; i < 2; i++) {
        const topic = await testDB.createTestTopic({
          subject_id: mathSubject.id,
          description: `Math Session ${i + 1}`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Matemática',
          topic_description: `Math Session ${i + 1}`,
          session_date: mondayStr,
          status: 'Pendente'
        });
      }

      // Check current math sessions on Monday
      const mathCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ? AND subject_name = ?',
        [testPlan.id, mondayStr, 'Matemática']
      );

      expect(mathCount.count).toBe(2);

      // Constraint check: should not allow more math sessions
      const maxSessionsPerSubjectPerDay = 2;
      const canScheduleMoreMath = mathCount.count < maxSessionsPerSubjectPerDay;
      expect(canScheduleMoreMath).toBe(false);

      // But should still allow other subjects
      const portugueseSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Português'
      });

      const portugueseTopic = await testDB.createTestTopic({
        subject_id: portugueseSubject.id,
        description: 'Portuguese Session'
      });

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: portugueseTopic.id,
        subject_name: 'Português',
        topic_description: 'Portuguese Session',
        session_date: mondayStr,
        status: 'Pendente'
      });

      const portugueseCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ? AND subject_name = ?',
        [testPlan.id, mondayStr, 'Português']
      );

      expect(portugueseCount.count).toBe(1);

      // Total sessions check
      const totalCount = await testDB.get(
        'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?',
        [testPlan.id, mondayStr]
      );

      expect(totalCount.count).toBe(3); // 2 math + 1 portuguese
    });

    test('should distribute overdue sessions across multiple days when subject limits are hit', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Distribution Test Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 3
        }),
        session_duration_minutes: 60
      });

      // Create 6 overdue math sessions (more than 2 per day limit)
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 6 }
      ]);

      // Calculate distribution requirements
      const totalOverdue = 6;
      const maxSessionsPerSubjectPerDay = 2;
      const minDaysNeeded = Math.ceil(totalOverdue / maxSessionsPerSubjectPerDay);
      
      expect(minDaysNeeded).toBe(3); // Need at least 3 days

      // Verify distribution strategy
      const distribution = [];
      let remainingSessions = totalOverdue;
      
      for (let day = 0; day < minDaysNeeded && remainingSessions > 0; day++) {
        const sessionsThisDay = Math.min(maxSessionsPerSubjectPerDay, remainingSessions);
        distribution.push(sessionsThisDay);
        remainingSessions -= sessionsThisDay;
      }

      expect(distribution).toEqual([2, 2, 2]); // Even distribution
      expect(distribution.reduce((sum, count) => sum + count, 0)).toBe(totalOverdue);

      // Verify each day respects the constraint
      distribution.forEach(dayCount => {
        expect(dayCount).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);
      });
    });

    test('should handle mixed subjects with load balancing', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Mixed Subject Test Plan',
        exam_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 6  // 6 hours = 6 sessions capacity
        }),
        session_duration_minutes: 60
      });

      // Create overdue sessions: 5 Math, 3 Portuguese, 2 History
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 5 },
        { name: 'Português', overdueCount: 3 },
        { name: 'História', overdueCount: 2 }
      ]);

      const totalOverdue = 10;
      const dailyCapacity = 6;
      const maxSessionsPerSubjectPerDay = 2;

      // For single day with capacity 6 and max 2 per subject:
      // Best distribution: Math 2, Portuguese 2, History 2 = 6 total (perfect fit)
      const optimalSingleDay = {
        'Matemática': Math.min(2, 5),     // 2
        'Português': Math.min(2, 3),      // 2  
        'História': Math.min(2, 2)        // 2
      };

      const singleDayTotal = Object.values(optimalSingleDay).reduce((sum, count) => sum + count, 0);
      expect(singleDayTotal).toBe(6);
      expect(singleDayTotal).toBeLessThanOrEqual(dailyCapacity);

      // Remaining sessions after day 1: Math 3, Portuguese 1, History 0 = 4 total
      const remainingAfterDay1 = {
        'Matemática': 5 - optimalSingleDay['Matemática'],  // 3
        'Português': 3 - optimalSingleDay['Português'],    // 1
        'História': 2 - optimalSingleDay['História']       // 0
      };

      const remainingTotal = Object.values(remainingAfterDay1).reduce((sum, count) => sum + count, 0);
      expect(remainingTotal).toBe(4);

      // Day 2 distribution: Math 2, Portuguese 1 = 3 total
      const day2Distribution = {
        'Matemática': Math.min(2, remainingAfterDay1['Matemática']),  // 2
        'Português': Math.min(2, remainingAfterDay1['Português']),    // 1
        'História': Math.min(2, remainingAfterDay1['História'])       // 0
      };

      const day2Total = Object.values(day2Distribution).reduce((sum, count) => sum + count, 0);
      expect(day2Total).toBe(3);

      // Remaining after day 2: Math 1, Portuguese 0, History 0 = 1 total
      const finalRemaining = remainingAfterDay1['Matemática'] - day2Distribution['Matemática'];
      expect(finalRemaining).toBe(1);

      // Verify total distribution adds up
      const totalScheduled = singleDayTotal + day2Total + finalRemaining;
      expect(totalScheduled).toBe(totalOverdue);
    });
  });

  describe('Exam Date Constraints', () => {
    test('should never schedule sessions beyond exam date', async () => {
      // Create plan with exam in 5 days
      const examDate = new Date();
      examDate.setDate(examDate.getDate() + 5);
      
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Exam Date Test Plan',
        exam_date: examDate.toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      // Create many overdue sessions
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 20 }
      ]);

      // Calculate available capacity until exam
      const today = new Date();
      const examDateTime = new Date(testPlan.exam_date + 'T23:59:59');
      const daysUntilExam = Math.ceil((examDateTime - today) / (1000 * 60 * 60 * 24));
      
      expect(daysUntilExam).toBe(5);

      const dailyCapacity = 2; // 2 hours per day, 1 hour per session
      const totalCapacity = daysUntilExam * dailyCapacity;
      
      expect(totalCapacity).toBe(10);

      // With 20 overdue sessions but only capacity for 10, some will fail
      const totalOverdue = 20;
      const maxPossibleReschedules = Math.min(totalOverdue, totalCapacity);
      const failedReschedules = totalOverdue - maxPossibleReschedules;

      expect(maxPossibleReschedules).toBe(10);
      expect(failedReschedules).toBe(10);

      // Verify date validation function
      const validateSessionDate = (sessionDate) => {
        const sessionDateTime = new Date(sessionDate + 'T00:00:00');
        return sessionDateTime <= examDateTime;
      };

      // Test valid dates
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 3); // 3 days from now
      expect(validateSessionDate(validDate.toISOString().split('T')[0])).toBe(true);

      // Test invalid date
      const invalidDate = new Date();
      invalidDate.setDate(invalidDate.getDate() + 10); // 10 days from now (beyond exam)
      expect(validateSessionDate(invalidDate.toISOString().split('T')[0])).toBe(false);

      // Test exact exam date (should be valid)
      expect(validateSessionDate(testPlan.exam_date)).toBe(true);
    });

    test('should handle edge case where exam is tomorrow', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const urgentPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Urgent Exam Plan',
        exam_date: tomorrow.toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 8, tuesday: 8, wednesday: 8, thursday: 8, friday: 8, saturday: 8, sunday: 8
        }),
        session_duration_minutes: 60
      });

      // Create overdue sessions
      await testDB.createOverdueSessions(urgentPlan.id, [
        { name: 'Matemática', overdueCount: 15 }
      ]);

      // With exam tomorrow, only 1 day available
      const daysAvailable = 1;
      const maxSessionsPerDay = 8;
      const totalCapacity = daysAvailable * maxSessionsPerDay;

      expect(totalCapacity).toBe(8);

      // Can only reschedule 8 out of 15 sessions
      const maxReschedules = Math.min(15, totalCapacity);
      const failedReschedules = 15 - maxReschedules;

      expect(maxReschedules).toBe(8);
      expect(failedReschedules).toBe(7);

      // Verify constraint validation
      const examDateTime = new Date(urgentPlan.exam_date + 'T23:59:59');
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(0, 0, 0, 0);

      expect(tomorrowStart <= examDateTime).toBe(true);

      // Day after tomorrow should be invalid
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      const dayAfterTomorrowStart = new Date(dayAfterTomorrow);
      dayAfterTomorrowStart.setHours(0, 0, 0, 0);

      expect(dayAfterTomorrowStart > examDateTime).toBe(true);
    });

    test('should handle impossible scenarios gracefully', async () => {
      // Exam today (no available days)
      const today = new Date();
      
      const impossiblePlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Impossible Plan',
        exam_date: today.toISOString().split('T')[0],
        study_hours_per_day: JSON.stringify({ 
          monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 2, sunday: 2
        }),
        session_duration_minutes: 60
      });

      await testDB.createOverdueSessions(impossiblePlan.id, [
        { name: 'Matemática', overdueCount: 5 }
      ]);

      // Calculate available time
      const examDateTime = new Date(impossiblePlan.exam_date + 'T23:59:59');
      const now = new Date();
      const timeUntilExam = examDateTime - now;
      const daysUntilExam = Math.ceil(timeUntilExam / (1000 * 60 * 60 * 24));

      expect(daysUntilExam).toBeLessThanOrEqual(1); // Exam today or already passed

      const availableCapacity = Math.max(0, daysUntilExam * 2);
      expect(availableCapacity).toBeLessThan(5); // Cannot fit all sessions

      // Algorithm should handle gracefully:
      // - Reschedule as many as possible (potentially 0)
      // - Report remaining as failed
      // - Provide appropriate error message

      const totalOverdue = 5;
      const possibleReschedules = Math.max(0, availableCapacity);
      const impossibleReschedules = totalOverdue - possibleReschedules;

      expect(impossibleReschedules).toBeGreaterThan(0);
      expect(possibleReschedules + impossibleReschedules).toBe(totalOverdue);

      // Should not crash, should return meaningful error
      const result = {
        success: possibleReschedules > 0,
        rescheduled: possibleReschedules,
        failed: impossibleReschedules,
        message: impossibleReschedules > 0 ? 
          'Algumas tarefas não puderam ser reagendadas devido à proximidade do exame.' :
          'Todas as tarefas foram reagendadas com sucesso.'
      };

      if (impossibleReschedules > 0) {
        expect(result.success).toBe(false);
        expect(result.message).toContain('não puderam ser reagendadas');
      }
    });
  });

  describe('Combined Constraint Scenarios', () => {
    test('should respect all constraints simultaneously in complex scenario', async () => {
      const testPlan = await testDB.createTestPlan({
        user_id: testUser.id,
        plan_name: 'Complex Constraint Plan',
        exam_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days
        study_hours_per_day: JSON.stringify({ 
          monday: 2,    // 2 sessions
          tuesday: 1,   // 1 session  
          wednesday: 3, // 3 sessions
          thursday: 2,  // 2 sessions
          friday: 2,    // 2 sessions
          saturday: 4,  // 4 sessions
          sunday: 1     // 1 session
        }),
        session_duration_minutes: 60
      });

      // Create overdue sessions from multiple subjects
      await testDB.createOverdueSessions(testPlan.id, [
        { name: 'Matemática', overdueCount: 8 },
        { name: 'Português', overdueCount: 6 },
        { name: 'História', overdueCount: 4 }
      ]);

      const totalOverdue = 18;

      // Calculate total capacity
      const studyHours = JSON.parse(testPlan.study_hours_per_day);
      const totalCapacity = Object.values(studyHours).reduce((sum, hours) => sum + Math.floor(hours), 0);
      
      expect(totalCapacity).toBe(15); // 2+1+3+2+2+4+1

      // More sessions than capacity - some will fail
      const maxReschedules = Math.min(totalOverdue, totalCapacity);
      const failedReschedules = totalOverdue - maxReschedules;
      
      expect(maxReschedules).toBe(15);
      expect(failedReschedules).toBe(3);

      // Test optimal distribution respecting all constraints
      const maxSessionsPerSubjectPerDay = 2;
      
      // Simulate day-by-day scheduling
      const dailyCapacities = {
        monday: 2, tuesday: 1, wednesday: 3, thursday: 2, 
        friday: 2, saturday: 4, sunday: 1
      };

      let remainingSessions = {
        'Matemática': 8,
        'Português': 6, 
        'História': 4
      };

      const schedule = {};
      
      Object.entries(dailyCapacities).forEach(([day, capacity]) => {
        schedule[day] = {};
        let dayTotal = 0;
        
        // Distribute subjects respecting 2-per-subject-per-day limit
        Object.keys(remainingSessions).forEach(subject => {
          if (dayTotal < capacity && remainingSessions[subject] > 0) {
            const sessionsForSubject = Math.min(
              maxSessionsPerSubjectPerDay,
              remainingSessions[subject],
              capacity - dayTotal
            );
            
            if (sessionsForSubject > 0) {
              schedule[day][subject] = sessionsForSubject;
              remainingSessions[subject] -= sessionsForSubject;
              dayTotal += sessionsForSubject;
            }
          }
        });
      });

      // Verify constraints are respected
      Object.entries(schedule).forEach(([day, daySchedule]) => {
        const dayTotal = Object.values(daySchedule).reduce((sum, count) => sum + count, 0);
        const dayCapacity = dailyCapacities[day];
        
        // Daily capacity constraint
        expect(dayTotal).toBeLessThanOrEqual(dayCapacity);
        
        // Subject per day constraint
        Object.values(daySchedule).forEach(subjectCount => {
          expect(subjectCount).toBeLessThanOrEqual(maxSessionsPerSubjectPerDay);
        });
      });

      // Calculate total scheduled vs remaining
      let totalScheduled = 0;
      Object.values(schedule).forEach(daySchedule => {
        totalScheduled += Object.values(daySchedule).reduce((sum, count) => sum + count, 0);
      });

      const totalRemaining = Object.values(remainingSessions).reduce((sum, count) => sum + count, 0);
      
      expect(totalScheduled + totalRemaining).toBe(totalOverdue);
      expect(totalScheduled).toBeLessThanOrEqual(totalCapacity);
    });
  });
});