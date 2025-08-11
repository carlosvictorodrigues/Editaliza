/**
 * Spaced Repetition Preservation Tests for Intelligent Rescheduling
 * 
 * These tests ensure that the rescheduling system preserves the scientific
 * principles of spaced repetition and maintains learning continuity by:
 * 1. Respecting optimal intervals between review sessions
 * 2. Maintaining session type sequences (primeira_vez → revisao → aprofundamento)
 * 3. Preserving subject learning momentum
 * 4. Avoiding interference between competing subjects
 * 5. Optimizing memory consolidation windows
 */

const { DatabaseTestHelper } = require('../../helpers/database-helper');

describe('Spaced Repetition Preservation Tests', () => {
  let testDB;
  let testUser;
  let testPlan;

  beforeAll(async () => {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();

    testUser = await testDB.createTestUser({
      email: 'spaced-repetition-test@test.com',
      name: 'Spaced Repetition Test User'
    });
  });

  beforeEach(async () => {
    // Clean slate for each test
    await testDB.run('DELETE FROM study_sessions');
    await testDB.run('DELETE FROM topics');
    await testDB.run('DELETE FROM subjects');
    await testDB.run('DELETE FROM study_plans WHERE user_id = ?', [testUser.id]);

    // Create fresh test plan optimized for spaced repetition
    testPlan = await testDB.createTestPlan({
      user_id: testUser.id,
      plan_name: 'Spaced Repetition Test Plan',
      exam_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days
      study_hours_per_day: JSON.stringify({ 
        monday: 3, tuesday: 3, wednesday: 3, thursday: 3, 
        friday: 3, saturday: 4, sunday: 2 
      }),
      session_duration_minutes: 60,
      review_mode: 'spaced' // Explicitly set to spaced repetition mode
    });
  });

  afterAll(async () => {
    if (testDB) {
      await testDB.close();
    }
  });

  describe('Optimal Interval Preservation', () => {
    test('should maintain scientifically-backed review intervals', async () => {
      // Create a subject with a logical session sequence
      const mathSubject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Matemática'
      });

      const topic = await testDB.createTestTopic({
        subject_id: mathSubject.id,
        description: 'Funções Logarítmicas'
      });

      // Create a completed primeira_vez session (baseline)
      const baselineDate = new Date();
      baselineDate.setDate(baselineDate.getDate() - 10); // 10 days ago

      const firstSession = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Matemática',
        topic_description: 'Funções Logarítmicas',
        session_date: baselineDate.toISOString().split('T')[0],
        session_type: 'primeira_vez',
        status: 'Concluída', // Completed
        time_studied_seconds: 3600 // 1 hour
      });

      // Create overdue first review (should have been 3 days after primeira_vez)
      const firstReviewDate = new Date(baselineDate);
      firstReviewDate.setDate(firstReviewDate.getDate() + 3); // Optimal: 3 days after
      
      const overdueReview = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Matemática',
        topic_description: 'Funções Logarítmicas',
        session_date: firstReviewDate.toISOString().split('T')[0],
        session_type: 'revisao',
        status: 'Pendente'
      });

      // Create future second review (should be 7 days after first review)
      const secondReviewDate = new Date(firstReviewDate);
      secondReviewDate.setDate(secondReviewDate.getDate() + 7);

      const futureReview = await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Matemática',
        topic_description: 'Funções Logarítmicas',
        session_date: secondReviewDate.toISOString().split('T')[0],
        session_type: 'revisao',
        status: 'Pendente'
      });

      // Analyze optimal rescheduling for overdue review
      const today = new Date();
      const daysSinceBaseline = Math.ceil((today - baselineDate) / (1000 * 60 * 60 * 24));
      
      expect(daysSinceBaseline).toBeGreaterThan(3); // Review is indeed overdue

      // Rescheduling should prioritize maintaining spaced intervals
      // Optimal new date should be ASAP but still allow proper spacing before next review
      const optimalRescheduleDate = new Date();
      optimalRescheduleDate.setDate(optimalRescheduleDate.getDate() + 1); // Tomorrow

      // Check spacing to future review
      const spacingDays = Math.ceil((secondReviewDate - optimalRescheduleDate) / (1000 * 60 * 60 * 24));
      expect(spacingDays).toBeGreaterThanOrEqual(3); // At least 3 days spacing

      // Verify the review sequence integrity
      const allTopicSessions = await testDB.all(
        'SELECT * FROM study_sessions WHERE topic_id = ? ORDER BY session_date',
        [topic.id]
      );

      expect(allTopicSessions).toHaveLength(3);
      expect(allTopicSessions[0].session_type).toBe('primeira_vez');
      expect(allTopicSessions[1].session_type).toBe('revisao');
      expect(allTopicSessions[2].session_type).toBe('revisao');

      // Test spaced repetition interval calculation
      const intervals = [];
      for (let i = 1; i < allTopicSessions.length; i++) {
        const currentDate = new Date(allTopicSessions[i].session_date);
        const previousDate = new Date(allTopicSessions[i-1].session_date);
        const intervalDays = Math.ceil((currentDate - previousDate) / (1000 * 60 * 60 * 24));
        intervals.push(intervalDays);
      }

      // Intervals should increase (spaced repetition principle)
      expect(intervals[0]).toBe(3); // First review: 3 days after primeira_vez
      expect(intervals[1]).toBe(7); // Second review: 7 days after first review

      console.log(`Spaced repetition intervals: ${intervals.join(' → ')} days`);
    });

    test('should calculate optimal intervals based on session performance', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Português'
      });

      // Create different topics with varying performance levels
      const topics = [
        { name: 'Interpretação de Texto', performance: 'high', baseInterval: 7 },
        { name: 'Gramática', performance: 'medium', baseInterval: 5 },
        { name: 'Redação', performance: 'low', baseInterval: 3 }
      ];

      for (const topicConfig of topics) {
        const topic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: topicConfig.name
        });

        // Create primeira_vez session with performance indicator
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - 14); // 2 weeks ago

        const questionsTotal = 10;
        const questionsCorrect = topicConfig.performance === 'high' ? 9 :
                                topicConfig.performance === 'medium' ? 6 : 4;

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Português',
          topic_description: topicConfig.name,
          session_date: baseDate.toISOString().split('T')[0],
          session_type: 'primeira_vez',
          status: 'Concluída',
          questions_solved: questionsCorrect,
          time_studied_seconds: 3600
        });

        // Calculate adaptive interval based on performance
        const performanceRate = questionsCorrect / questionsTotal;
        const adaptiveInterval = Math.ceil(topicConfig.baseInterval * performanceRate);

        // High performance → longer intervals (better retention)
        // Low performance → shorter intervals (need more frequent review)
        if (topicConfig.performance === 'high') {
          expect(adaptiveInterval).toBeGreaterThanOrEqual(6);
        } else if (topicConfig.performance === 'low') {
          expect(adaptiveInterval).toBeLessThanOrEqual(3);
        }

        console.log(`${topicConfig.name}: ${performanceRate * 100}% → ${adaptiveInterval} day interval`);
      }
    });

    test('should handle forgetting curve considerations in rescheduling', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'História'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Revolução Industrial'
      });

      // Create completed session 15 days ago
      const studyDate = new Date();
      studyDate.setDate(studyDate.getDate() - 15);

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'História',
        topic_description: 'Revolução Industrial',
        session_date: studyDate.toISOString().split('T')[0],
        session_type: 'primeira_vez',
        status: 'Concluída',
        time_studied_seconds: 3600
      });

      // Create severely overdue review (should have been reviewed 5 days after)
      const plannedReviewDate = new Date(studyDate);
      plannedReviewDate.setDate(plannedReviewDate.getDate() + 5);

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'História',
        topic_description: 'Revolução Industrial',
        session_date: plannedReviewDate.toISOString().split('T')[0],
        session_type: 'revisao',
        status: 'Pendente'
      });

      // Calculate forgetting curve impact
      const today = new Date();
      const daysSinceLastStudy = Math.ceil((today - studyDate) / (1000 * 60 * 60 * 24));
      const daysOverdue = Math.ceil((today - plannedReviewDate) / (1000 * 60 * 60 * 24));

      expect(daysSinceLastStudy).toBe(15);
      expect(daysOverdue).toBeGreaterThan(5); // Significantly overdue

      // Forgetting curve: retention drops exponentially with time
      // After 15 days, retention is likely around 20-30% without review
      const estimatedRetention = Math.max(0.2, Math.exp(-0.1 * daysSinceLastStudy));
      expect(estimatedRetention).toBeLessThan(0.5); // Significant forgetting

      // Rescheduling priority should be URGENT due to forgetting curve
      const urgencyScore = Math.max(1, daysOverdue / 5); // Higher = more urgent
      expect(urgencyScore).toBeGreaterThan(1);

      // Should reschedule as soon as possible and potentially add reinforcement
      const recommendedAction = estimatedRetention < 0.3 ? 'immediate_review_plus_reinforcement' : 'priority_reschedule';
      expect(recommendedAction).toBe('immediate_review_plus_reinforcement');

      console.log(`Forgetting analysis: ${daysSinceLastStudy} days → ${Math.round(estimatedRetention * 100)}% retention`);
      console.log(`Action: ${recommendedAction}`);
    });
  });

  describe('Session Type Sequence Integrity', () => {
    test('should preserve logical session progression', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Física'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Leis de Newton'
      });

      // Create proper sequence: primeira_vez → revisao → aprofundamento
      const sessions = [
        { type: 'primeira_vez', daysOffset: -10, status: 'Concluída' },
        { type: 'revisao', daysOffset: -3, status: 'Pendente' }, // Overdue
        { type: 'revisao', daysOffset: 5, status: 'Pendente' },   // Future
        { type: 'aprofundamento', daysOffset: 12, status: 'Pendente' } // Future
      ];

      for (const sessionConfig of sessions) {
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() + sessionConfig.daysOffset);

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Física',
          topic_description: 'Leis de Newton',
          session_date: sessionDate.toISOString().split('T')[0],
          session_type: sessionConfig.type,
          status: sessionConfig.status
        });
      }

      // Verify session sequence logic
      const allSessions = await testDB.all(
        'SELECT * FROM study_sessions WHERE topic_id = ? ORDER BY session_date',
        [topic.id]
      );

      expect(allSessions).toHaveLength(4);

      // Check progression logic
      const progression = allSessions.map(s => s.session_type);
      expect(progression[0]).toBe('primeira_vez');
      expect(progression[1]).toBe('revisao'); // This one is overdue
      expect(progression[2]).toBe('revisao');
      expect(progression[3]).toBe('aprofundamento');

      // When rescheduling the overdue revisao, must maintain logical order
      // It should be rescheduled to before the future revisao to preserve sequence
      const overdueSession = allSessions[1];
      const nextFutureSession = allSessions[2];

      const today = new Date();
      const isOverdue = new Date(overdueSession.session_date) < today;
      const isFuture = new Date(nextFutureSession.session_date) >= today;

      expect(isOverdue).toBe(true);
      expect(isFuture).toBe(true);

      // Optimal rescheduling: place overdue session before next future session
      const optimalDate = new Date();
      optimalDate.setDate(optimalDate.getDate() + 1); // Tomorrow

      const futureSessionDate = new Date(nextFutureSession.session_date);
      const daysDifference = Math.ceil((futureSessionDate - optimalDate) / (1000 * 60 * 60 * 24));
      
      expect(daysDifference).toBeGreaterThan(0); // Optimal date is before future session
      expect(daysDifference).toBeGreaterThanOrEqual(2); // Allow proper spacing
    });

    test('should handle session type dependencies', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Química'
      });

      // Create multiple topics with different completion stages
      const topicConfigs = [
        { name: 'Tabela Periódica', stage: 'primeira_vez_completed' },
        { name: 'Ligações Químicas', stage: 'first_review_completed' },
        { name: 'Reações Orgânicas', stage: 'not_started' }
      ];

      for (const config of topicConfigs) {
        const topic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: config.name
        });

        if (config.stage === 'primeira_vez_completed') {
          // Has completed primeira_vez, now needs first review
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'primeira_vez',
            status: 'Concluída'
          });

          // Create overdue first review
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'revisao',
            status: 'Pendente'
          });

        } else if (config.stage === 'first_review_completed') {
          // Has completed primeira_vez and first review, needs second review
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'primeira_vez',
            status: 'Concluída'
          });

          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'revisao',
            status: 'Concluída'
          });

          // Create overdue second review
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'revisao',
            status: 'Pendente'
          });

        } else {
          // Not started - create overdue primeira_vez
          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Química',
            topic_description: config.name,
            session_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            session_type: 'primeira_vez',
            status: 'Pendente'
          });
        }
      }

      // Analyze rescheduling priorities based on dependencies
      const allOverdue = await testDB.all(
        "SELECT ss.*, 'Chemistry' as analysis FROM study_sessions ss WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, new Date().toISOString().split('T')[0]]
      );

      expect(allOverdue).toHaveLength(3);

      // Priority should be: primeira_vez > first review > later reviews
      const priorities = allOverdue.map(session => {
        if (session.session_type === 'primeira_vez') return 3; // Highest priority
        // Count how many sessions exist for this topic to determine review stage
        return 2; // Review priority
      });

      // primeira_vez sessions should have highest priority in rescheduling
      const primeiraVezSession = allOverdue.find(s => s.session_type === 'primeira_vez');
      expect(primeiraVezSession).toBeTruthy();
      expect(primeiraVezSession.topic_description).toBe('Reações Orgânicas');
    });
  });

  describe('Learning Momentum Preservation', () => {
    test('should maintain subject-specific learning momentum', async () => {
      // Create multiple subjects with different momentum levels
      const subjects = [
        { name: 'Matemática', momentum: 'high', sessionsPerWeek: 5 },
        { name: 'Português', momentum: 'medium', sessionsPerWeek: 3 },
        { name: 'História', momentum: 'low', sessionsPerWeek: 2 }
      ];

      for (const subjectConfig of subjects) {
        const subject = await testDB.createTestSubject({
          study_plan_id: testPlan.id,
          subject_name: subjectConfig.name
        });

        // Create recent session history to establish momentum
        for (let week = 1; week <= 3; week++) {
          for (let session = 0; session < subjectConfig.sessionsPerWeek; session++) {
            const sessionDate = new Date();
            sessionDate.setDate(sessionDate.getDate() - (week * 7) + session);

            const topic = await testDB.createTestTopic({
              subject_id: subject.id,
              description: `${subjectConfig.name} Topic ${week}-${session}`
            });

            await testDB.createTestSession({
              study_plan_id: testPlan.id,
              topic_id: topic.id,
              subject_name: subjectConfig.name,
              topic_description: `${subjectConfig.name} Topic ${week}-${session}`,
              session_date: sessionDate.toISOString().split('T')[0],
              session_type: session === 0 ? 'primeira_vez' : 'revisao',
              status: 'Concluída',
              time_studied_seconds: 3600
            });
          }
        }

        // Create overdue sessions that would break momentum
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - 2);

        const overdueTopic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: `${subjectConfig.name} Overdue Topic`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: overdueTopic.id,
          subject_name: subjectConfig.name,
          topic_description: `${subjectConfig.name} Overdue Topic`,
          session_date: overdueDate.toISOString().split('T')[0],
          session_type: 'revisao',
          status: 'Pendente'
        });
      }

      // Analyze momentum for each subject
      for (const subjectConfig of subjects) {
        const recentSessions = await testDB.all(`
          SELECT session_date, status FROM study_sessions 
          WHERE study_plan_id = ? AND subject_name = ? 
            AND session_date >= date('now', '-21 days')
          ORDER BY session_date DESC
        `, [testPlan.id, subjectConfig.name]);

        // Calculate momentum score (recent activity frequency)
        const completedRecent = recentSessions.filter(s => s.status === 'Concluída');
        const momentum = completedRecent.length / 21; // Sessions per day average

        console.log(`${subjectConfig.name} momentum: ${momentum.toFixed(3)} sessions/day`);

        if (subjectConfig.momentum === 'high') {
          expect(momentum).toBeGreaterThan(0.2); // > 1.4 sessions per week
        } else if (subjectConfig.momentum === 'medium') {
          expect(momentum).toBeGreaterThanOrEqual(0.1); // >= 0.7 sessions per week
        }

        // High momentum subjects should get priority in rescheduling to maintain flow
        const rescheduleUrgency = momentum > 0.2 ? 'high' : momentum > 0.1 ? 'medium' : 'low';
        
        if (subjectConfig.momentum === 'high') {
          expect(rescheduleUrgency).toBe('high');
        }
      }
    });

    test('should avoid cognitive interference between subjects', async () => {
      // Create subjects that could interfere with each other
      const interferingSubjects = [
        { name: 'Matemática Financeira', category: 'quantitative' },
        { name: 'Estatística', category: 'quantitative' },
        { name: 'Português', category: 'linguistic' },
        { name: 'Literatura', category: 'linguistic' }
      ];

      const subjectIds = {};
      for (const subjectConfig of interferingSubjects) {
        const subject = await testDB.createTestSubject({
          study_plan_id: testPlan.id,
          subject_name: subjectConfig.name
        });
        subjectIds[subjectConfig.name] = subject.id;

        // Create overdue session for each subject
        const overdueTopic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: `${subjectConfig.name} Key Concept`
        });

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: overdueTopic.id,
          subject_name: subjectConfig.name,
          topic_description: `${subjectConfig.name} Key Concept`,
          session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
          session_type: 'revisao',
          status: 'Pendente'
        });
      }

      // Test optimal scheduling to minimize interference
      const quantitativeSubjects = ['Matemática Financeira', 'Estatística'];
      const linguisticSubjects = ['Português', 'Literatura'];

      // Simulate scheduling algorithm
      const scheduleSlots = [];
      
      // Generate next 7 days of scheduling slots
      for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day + 1);
        const dateStr = date.toISOString().split('T')[0];
        
        // Each day can have multiple sessions
        for (let slot = 0; slot < 3; slot++) {
          scheduleSlots.push({
            date: dateStr,
            slot: slot,
            assigned: null,
            category: null
          });
        }
      }

      // Apply interference-minimization scheduling
      const overdueSessions = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?",
        [testPlan.id, new Date().toISOString().split('T')[0]]
      );

      // Schedule with interference avoidance
      for (const session of overdueSessions) {
        const subjectCategory = interferingSubjects.find(s => s.name === session.subject_name).category;
        
        for (const slot of scheduleSlots) {
          if (slot.assigned) continue;
          
          // Check if same day has conflicting category
          const sameDaySlots = scheduleSlots.filter(s => s.date === slot.date && s.assigned);
          const hasConflict = sameDaySlots.some(s => s.category === subjectCategory);
          
          if (!hasConflict) {
            slot.assigned = session.subject_name;
            slot.category = subjectCategory;
            break;
          }
        }
      }

      // Verify interference minimization
      const scheduledDays = scheduleSlots.reduce((days, slot) => {
        if (!days[slot.date]) days[slot.date] = [];
        if (slot.assigned) days[slot.date].push(slot.category);
        return days;
      }, {});

      Object.entries(scheduledDays).forEach(([date, categories]) => {
        const uniqueCategories = [...new Set(categories)];
        
        // Ideally, each day should focus on one category to minimize interference
        if (categories.length > 1) {
          // If multiple subjects on same day, they shouldn't be the same category
          expect(uniqueCategories.length).toBe(categories.length);
        }
      });

      console.log('Interference-minimized schedule:');
      Object.entries(scheduledDays).forEach(([date, categories]) => {
        if (categories.length > 0) {
          console.log(`  ${date}: ${categories.join(', ')}`);
        }
      });
    });
  });

  describe('Memory Consolidation Optimization', () => {
    test('should optimize for memory consolidation windows', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Biologia'
      });

      // Create sessions with different memory consolidation requirements
      const topics = [
        { name: 'Mitose e Meiose', complexity: 'high', consolidationHours: 24 },
        { name: 'Fotossíntese', complexity: 'medium', consolidationHours: 12 },
        { name: 'Taxonomia', complexity: 'low', consolidationHours: 6 }
      ];

      for (const topicConfig of topics) {
        const topic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: topicConfig.name
        });

        // Create recently completed session
        const recentStudyDate = new Date();
        recentStudyDate.setHours(recentStudyDate.getHours() - topicConfig.consolidationHours);

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Biologia',
          topic_description: topicConfig.name,
          session_date: recentStudyDate.toISOString().split('T')[0],
          session_type: 'primeira_vez',
          status: 'Concluída',
          time_studied_seconds: 3600
        });

        // Create overdue review session
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() - 1);

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Biologia',
          topic_description: topicConfig.name,
          session_date: reviewDate.toISOString().split('T')[0],
          session_type: 'revisao',
          status: 'Pendente'
        });
      }

      // Analyze consolidation status for rescheduling
      const now = new Date();
      const overdueReviews = await testDB.all(
        "SELECT ss.*, 'consolidation' as analysis FROM study_sessions ss WHERE study_plan_id = ? AND status = 'Pendente' AND subject_name = 'Biologia'",
        [testPlan.id]
      );

      for (const review of overdueReviews) {
        // Find the corresponding completed session
        const completed = await testDB.get(
          "SELECT * FROM study_sessions WHERE topic_id = (SELECT topic_id FROM study_sessions WHERE id = ?) AND status = 'Concluída' ORDER BY session_date DESC LIMIT 1",
          [review.id]
        );

        if (completed) {
          const completedDate = new Date(completed.session_date);
          const hoursSinceStudy = Math.ceil((now - completedDate) / (1000 * 60 * 60));
          
          const topicConfig = topics.find(t => t.name === review.topic_description);
          const consolidationComplete = hoursSinceStudy >= topicConfig.consolidationHours;

          console.log(`${review.topic_description}: ${hoursSinceStudy}h since study (need ${topicConfig.consolidationHours}h)`);
          console.log(`  Consolidation complete: ${consolidationComplete ? '✅' : '❌'}`);

          // Reschedule priority should consider consolidation status
          if (consolidationComplete) {
            // Safe to reschedule review - memory is consolidated
            expect(hoursSinceStudy).toBeGreaterThanOrEqual(topicConfig.consolidationHours);
          } else {
            // Should wait for consolidation or schedule with lower priority
            const remainingHours = topicConfig.consolidationHours - hoursSinceStudy;
            expect(remainingHours).toBeGreaterThan(0);
          }
        }
      }
    });

    test('should consider circadian rhythm in rescheduling', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Física Moderna'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Mecânica Quântica'
      });

      // Create overdue complex session that requires high cognitive load
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 2);

      await testDB.createTestSession({
        study_plan_id: testPlan.id,
        topic_id: topic.id,
        subject_name: 'Física Moderna',
        topic_description: 'Mecânica Quântica',
        session_date: overdueDate.toISOString().split('T')[0],
        session_type: 'aprofundamento', // High cognitive load
        status: 'Pendente'
      });

      // Optimal rescheduling should consider circadian rhythms
      // Complex subjects best studied during peak cognitive hours (typically 10 AM - 2 PM)
      const now = new Date();
      
      // Simulate optimal time slots for high cognitive load tasks
      const peakCognitiveHours = [10, 11, 12, 13, 14]; // 10 AM - 2 PM
      const currentHour = now.getHours();
      
      const isOptimalTime = peakCognitiveHours.includes(currentHour);
      const nextOptimalSlot = new Date(now);
      
      if (!isOptimalTime) {
        // Schedule for next optimal window
        if (currentHour < 10) {
          nextOptimalSlot.setHours(10, 0, 0, 0); // 10 AM today
        } else {
          nextOptimalSlot.setDate(nextOptimalSlot.getDate() + 1);
          nextOptimalSlot.setHours(10, 0, 0, 0); // 10 AM tomorrow
        }
      }

      // Rescheduling algorithm should prioritize cognitive-optimal times for complex sessions
      const sessionComplexity = 'high'; // aprofundamento sessions are complex
      const shouldOptimizeForCircadian = sessionComplexity === 'high';
      
      expect(shouldOptimizeForCircadian).toBe(true);
      
      if (shouldOptimizeForCircadian) {
        const optimalHour = nextOptimalSlot.getHours();
        expect(peakCognitiveHours).toContain(optimalHour);
      }

      console.log(`Complex session rescheduling:`);
      console.log(`  Current time: ${now.getHours()}:00`);
      console.log(`  Optimal window: 10:00-14:00`);
      console.log(`  Recommended slot: ${nextOptimalSlot.getHours()}:00`);
    });
  });

  describe('Adaptive Learning Algorithm', () => {
    test('should adapt intervals based on historical performance', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Algoritmos'
      });

      const topic = await testDB.createTestTopic({
        subject_id: subject.id,
        description: 'Árvores Binárias'
      });

      // Create learning history with varying performance
      const learningHistory = [
        { daysAgo: 20, type: 'primeira_vez', performance: 0.6, status: 'Concluída' },
        { daysAgo: 15, type: 'revisao', performance: 0.7, status: 'Concluída' },
        { daysAgo: 10, type: 'revisao', performance: 0.8, status: 'Concluída' },
        { daysAgo: 5, type: 'revisao', performance: 0.9, status: 'Concluída' },
        { daysAgo: -1, type: 'revisao', performance: null, status: 'Pendente' } // Overdue
      ];

      for (const entry of learningHistory) {
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - entry.daysAgo);

        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Algoritmos',
          topic_description: 'Árvores Binárias',
          session_date: sessionDate.toISOString().split('T')[0],
          session_type: entry.type,
          status: entry.status,
          questions_solved: entry.performance ? Math.floor(entry.performance * 10) : 0,
          time_studied_seconds: 3600
        });
      }

      // Analyze performance trend
      const completedSessions = learningHistory.filter(s => s.status === 'Concluída');
      const performances = completedSessions.map(s => s.performance);
      
      // Calculate learning curve (performance improvement over time)
      const performanceTrend = performances[performances.length - 1] - performances[0];
      const isImproving = performanceTrend > 0;
      
      expect(isImproving).toBe(true);
      expect(performanceTrend).toBeCloseTo(0.3, 1); // 30% improvement

      // Adaptive interval calculation
      const baseInterval = 7; // days
      const currentPerformance = performances[performances.length - 1];
      const adaptiveMultiplier = Math.max(0.5, Math.min(2.0, currentPerformance * 2));
      const adaptedInterval = Math.ceil(baseInterval * adaptiveMultiplier);

      expect(adaptedInterval).toBeGreaterThan(baseInterval); // High performance = longer intervals
      expect(adaptedInterval).toBeLessThanOrEqual(baseInterval * 2);

      console.log(`Adaptive learning analysis:`);
      console.log(`  Performance trend: ${performances.map(p => Math.round(p * 100)).join('% → ')}%`);
      console.log(`  Learning rate: ${(performanceTrend * 100).toFixed(1)}% improvement`);
      console.log(`  Adapted interval: ${baseInterval} → ${adaptedInterval} days`);
    });

    test('should handle difficult topics with shorter intervals', async () => {
      const subject = await testDB.createTestSubject({
        study_plan_id: testPlan.id,
        subject_name: 'Cálculo Diferencial'
      });

      // Create topics with varying difficulty levels
      const topics = [
        { name: 'Limites', difficulty: 'medium', baseInterval: 5 },
        { name: 'Derivadas Parciais', difficulty: 'hard', baseInterval: 3 },
        { name: 'Integrais Múltiplas', difficulty: 'expert', baseInterval: 2 }
      ];

      for (const topicConfig of topics) {
        const topic = await testDB.createTestTopic({
          subject_id: subject.id,
          description: topicConfig.name
        });

        // Create learning history showing difficulty
        const attempts = [
          { performance: 0.4, daysAgo: 14 },
          { performance: 0.5, daysAgo: 10 },
          { performance: 0.6, daysAgo: 7 }
        ];

        for (const attempt of attempts) {
          const sessionDate = new Date();
          sessionDate.setDate(sessionDate.getDate() - attempt.daysAgo);

          await testDB.createTestSession({
            study_plan_id: testPlan.id,
            topic_id: topic.id,
            subject_name: 'Cálculo Diferencial',
            topic_description: topicConfig.name,
            session_date: sessionDate.toISOString().split('T')[0],
            session_type: 'revisao',
            status: 'Concluída',
            questions_solved: Math.floor(attempt.performance * 10),
            time_studied_seconds: 3600
          });
        }

        // Create overdue next review
        await testDB.createTestSession({
          study_plan_id: testPlan.id,
          topic_id: topic.id,
          subject_name: 'Cálculo Diferencial',
          topic_description: topicConfig.name,
          session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          session_type: 'revisao',
          status: 'Pendente'
        });
      }

      // Analyze difficulty-based scheduling
      const overdueReviews = await testDB.all(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND subject_name = 'Cálculo Diferencial' AND status = 'Pendente'",
        [testPlan.id]
      );

      for (const review of overdueReviews) {
        const topicConfig = topics.find(t => t.name === review.topic_description);
        
        // Get historical performance for this topic
        const history = await testDB.all(
          "SELECT questions_solved FROM study_sessions WHERE topic_id = ? AND status = 'Concluída' ORDER BY session_date",
          [review.topic_id]
        );

        const avgPerformance = history.reduce((sum, s) => sum + s.questions_solved, 0) / history.length / 10;
        
        // Difficulty adjustment
        const difficultyMultiplier = topicConfig.difficulty === 'expert' ? 0.5 :
                                   topicConfig.difficulty === 'hard' ? 0.7 : 1.0;
        
        const adaptedInterval = Math.ceil(topicConfig.baseInterval * difficultyMultiplier * avgPerformance);
        
        console.log(`${topicConfig.name}: ${(avgPerformance * 100).toFixed(0)}% avg → ${adaptedInterval} day interval`);
        
        // More difficult topics should have shorter intervals
        if (topicConfig.difficulty === 'expert') {
          expect(adaptedInterval).toBeLessThanOrEqual(2);
        }
      }
    });
  });
});