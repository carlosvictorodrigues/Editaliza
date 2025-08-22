/**
 * Manual Test Scripts for Rescheduling System
 * 
 * These scripts allow manual testing and validation of the rescheduling system
 * against real database scenarios. They can be run individually to test specific
 * aspects of the system or validate production data scenarios.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ReschedulingDataFactory } = require('../fixtures/rescheduling-data-factory');

class ManualReschedulingTester {
  constructor(databasePath = null) {
    this.databasePath = databasePath || path.join(__dirname, '..', '..', 'db.sqlite');
    this.db = null;
  }

  /**
   * Connect to database (production or test)
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.databasePath, (err) => {
        if (err) {
          console.error('Failed to connect to database:', err.message);
          reject(err);
        } else {
          console.log(`Connected to database: ${this.databasePath}`);
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          } else {
            console.log('Database connection closed.');
          }
          resolve();
        });
      });
    }
  }

  /**
   * Execute SQL query
   */
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Execute SQL update/insert
   */
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Test 1: Validate real user 3@3.com scenario
   */
  async testUser3Scenario() {
    console.log('\n=== Testing User 3@3.com Scenario ===');
    
    try {
      // Check if user 3@3.com exists
      const user = await this.query('SELECT * FROM users WHERE email = ?', ['3@3.com']);
      
      if (user.length === 0) {
        console.log('❌ User 3@3.com not found in database');
        console.log('Creating test user and scenario...');
        
        // Create test user and scenario
        const testUser = await this.createTestUser3();
        return await this.analyzeUserPlan(testUser.id);
      } else {
        console.log('✅ User 3@3.com found');
        return await this.analyzeUserPlan(user[0].id);
      }
    } catch (error) {
      console.error('❌ Error in user 3@3.com test:', error.message);
    }
  }

  /**
   * Create test user 3@3.com if not exists
   */
  async createTestUser3() {
    const userId = await this.run(
      'INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)',
      ['3@3.com', 'Manual Test User 3', new Date().toISOString()]
    );

    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 45);

    const planId = await this.run(`
      INSERT INTO study_plans (user_id, plan_name, exam_date, study_hours_per_day, session_duration_minutes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId.id,
      'Manual Test Plan - User 3',
      examDate.toISOString().split('T')[0],
      JSON.stringify({ monday: 4, tuesday: 4, wednesday: 4, thursday: 4, friday: 4, saturday: 6, sunday: 3 }),
      75
    ]);

    // Create overdue sessions
    await this.createOverdueSessions(planId.id, userId.id);

    return { id: userId.id, planId: planId.id };
  }

  /**
   * Create 7 overdue sessions for test scenario
   */
  async createOverdueSessions(planId, userId) {
    const subjects = [
      'Direito Constitucional',
      'Direito Administrativo', 
      'Matemática e RLM',
      'Português'
    ];

    const sessionCounts = [2, 2, 2, 1]; // Total: 7 sessions
    let sessionId = 1;

    for (let i = 0; i < subjects.length; i++) {
      for (let j = 0; j < sessionCounts[i]; j++) {
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - (Math.floor(Math.random() * 7) + 1));

        await this.run(`
          INSERT INTO study_sessions 
          (study_plan_id, subject_name, topic_description, session_date, session_type, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          planId,
          subjects[i],
          `${subjects[i]} - Tópico ${sessionId}`,
          overdueDate.toISOString().split('T')[0],
          j === 0 ? 'primeira_vez' : 'revisao',
          'Pendente'
        ]);

        sessionId++;
      }
    }
  }

  /**
   * Analyze user's study plan and overdue sessions
   */
  async analyzeUserPlan(userId) {
    console.log(`\nAnalyzing study plan for user ID: ${userId}`);

    // Get user's active plans
    const plans = await this.query(
      'SELECT * FROM study_plans WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    if (plans.length === 0) {
      console.log('❌ No study plans found for user');
      return;
    }

    for (const plan of plans) {
      console.log(`\n--- Plan: ${plan.plan_name} (ID: ${plan.id}) ---`);
      console.log(`Exam Date: ${plan.exam_date}`);
      console.log(`Session Duration: ${plan.session_duration_minutes} minutes`);
      console.log(`Postponement Count: ${plan.postponement_count || 0}`);

      // Calculate days until exam
      const examDate = new Date(plan.exam_date);
      const today = new Date();
      const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      console.log(`Days until exam: ${daysUntilExam}`);

      // Get overdue sessions
      const todayStr = today.toISOString().split('T')[0];
      const overdueSessions = await this.query(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ?
        ORDER BY session_date
      `, [plan.id, todayStr]);

      console.log(`\nOverdue Sessions: ${overdueSessions.length}`);
      
      if (overdueSessions.length > 0) {
        // Group by subject
        const bySubject = {};
        overdueSessions.forEach(session => {
          if (!bySubject[session.subject_name]) {
            bySubject[session.subject_name] = [];
          }
          bySubject[session.subject_name].push(session);
        });

        console.log('\nOverdue by Subject:');
        Object.entries(bySubject).forEach(([subject, sessions]) => {
          console.log(`  ${subject}: ${sessions.length} sessions`);
        });

        // Analyze rescheduling feasibility
        await this.analyzeReschedulingFeasibility(plan, overdueSessions);
      }

      // Get future sessions
      const futureSessions = await this.query(`
        SELECT * FROM study_sessions 
        WHERE study_plan_id = ? AND status = 'Pendente' AND session_date >= ?
        ORDER BY session_date
      `, [plan.id, todayStr]);

      console.log(`Future Sessions: ${futureSessions.length}`);
    }
  }

  /**
   * Analyze if rescheduling is feasible for a plan
   */
  async analyzeReschedulingFeasibility(plan, overdueSessions) {
    console.log('\n--- Rescheduling Feasibility Analysis ---');

    const studyHours = JSON.parse(plan.study_hours_per_day);
    const sessionDurationHours = plan.session_duration_minutes / 60;
    const examDate = new Date(plan.exam_date);
    const today = new Date();

    // Calculate total capacity until exam
    let totalCapacity = 0;
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow

    const dailyCapacities = [];
    while (currentDate <= examDate) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[currentDate.getDay()];
      const dayHours = studyHours[dayName] || 0;
      const dayCapacity = Math.floor(dayHours / sessionDurationHours);
      
      totalCapacity += dayCapacity;
      dailyCapacities.push({
        date: currentDate.toISOString().split('T')[0],
        dayName,
        capacity: dayCapacity
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Total theoretical capacity until exam: ${totalCapacity} sessions`);
    console.log(`Overdue sessions to reschedule: ${overdueSessions.length}`);

    // Check current usage of future days
    const futureUsage = await this.query(`
      SELECT session_date, COUNT(*) as count
      FROM study_sessions 
      WHERE study_plan_id = ? AND session_date > ? AND session_date <= ?
      GROUP BY session_date
    `, [plan.id, today.toISOString().split('T')[0], plan.exam_date]);

    const usageMap = {};
    futureUsage.forEach(day => {
      usageMap[day.session_date] = day.count;
    });

    let availableCapacity = 0;
    dailyCapacities.forEach(day => {
      const used = usageMap[day.date] || 0;
      const available = day.capacity - used;
      availableCapacity += available;
    });

    console.log(`Available capacity (after existing sessions): ${availableCapacity} sessions`);

    const feasibility = availableCapacity >= overdueSessions.length;
    console.log(`Rescheduling feasible: ${feasibility ? '✅ YES' : '❌ NO'}`);

    if (!feasible && overdueSessions.length > 0) {
      const canReschedule = Math.min(availableCapacity, overdueSessions.length);
      const willFail = overdueSessions.length - canReschedule;
      console.log(`Can reschedule: ${canReschedule} sessions`);
      console.log(`Will fail: ${willFail} sessions`);
    }

    // Analyze subject distribution constraints
    await this.analyzeSubjectConstraints(plan.id, overdueSessions, dailyCapacities, usageMap);
  }

  /**
   * Analyze subject distribution constraints
   */
  async analyzeSubjectConstraints(planId, overdueSessions, dailyCapacities, currentUsage) {
    console.log('\n--- Subject Distribution Analysis ---');

    // Group overdue by subject
    const overdueBySubject = {};
    overdueSessions.forEach(session => {
      if (!overdueBySubject[session.subject_name]) {
        overdueBySubject[session.subject_name] = [];
      }
      overdueBySubject[session.subject_name].push(session);
    });

    console.log('Overdue sessions by subject:');
    Object.entries(overdueBySubject).forEach(([subject, sessions]) => {
      console.log(`  ${subject}: ${sessions.length} sessions`);
    });

    // Check subject constraints per day (max 2 per subject per day)
    const maxPerSubjectPerDay = 2;
    const subjectSchedulingNeeds = {};

    Object.entries(overdueBySubject).forEach(([subject, sessions]) => {
      const sessionCount = sessions.length;
      const minDaysNeeded = Math.ceil(sessionCount / maxPerSubjectPerDay);
      subjectSchedulingNeeds[subject] = {
        sessions: sessionCount,
        minDaysNeeded
      };
      console.log(`  ${subject}: needs minimum ${minDaysNeeded} days`);
    });

    // Analyze if subject distribution is feasible
    const totalMinDaysNeeded = Math.max(...Object.values(subjectSchedulingNeeds).map(s => s.minDaysNeeded));
    const availableDays = dailyCapacities.filter(day => day.capacity > 0).length;
    
    console.log(`Total days available: ${availableDays}`);
    console.log(`Maximum days needed by any subject: ${totalMinDaysNeeded}`);
    console.log(`Subject distribution feasible: ${totalMinDaysNeeded <= availableDays ? '✅ YES' : '❌ NO'}`);
  }

  /**
   * Test 2: Check all users with overdue sessions
   */
  async testAllUsersWithOverdue() {
    console.log('\n=== Testing All Users With Overdue Sessions ===');

    try {
      const usersWithOverdue = await this.query(`
        SELECT DISTINCT u.id, u.email, u.name, COUNT(ss.id) as overdue_count
        FROM users u
        JOIN study_plans sp ON u.id = sp.user_id
        JOIN study_sessions ss ON sp.id = ss.study_plan_id
        WHERE ss.status = 'Pendente' AND ss.session_date < date('now')
        GROUP BY u.id, u.email, u.name
        ORDER BY overdue_count DESC
      `);

      console.log(`Found ${usersWithOverdue.length} users with overdue sessions:`);

      for (const user of usersWithOverdue.slice(0, 5)) { // Test top 5
        console.log(`\n--- User: ${user.email} (${user.overdue_count} overdue) ---`);
        await this.analyzeUserPlan(user.id);
      }

    } catch (error) {
      console.error('❌ Error testing users with overdue:', error.message);
    }
  }

  /**
   * Test 3: Performance test with large dataset
   */
  async testPerformance() {
    console.log('\n=== Performance Testing ===');

    try {
      const start = Date.now();

      // Get statistics
      const stats = await Promise.all([
        this.query('SELECT COUNT(*) as count FROM users'),
        this.query('SELECT COUNT(*) as count FROM study_plans'),
        this.query('SELECT COUNT(*) as count FROM study_sessions'),
        this.query(`
          SELECT COUNT(*) as count FROM study_sessions 
          WHERE status = 'Pendente' AND session_date < date('now')
        `)
      ]);

      const [userCount, planCount, sessionCount, overdueCount] = stats;

      console.log(`Database Statistics:`);
      console.log(`  Users: ${userCount[0].count}`);
      console.log(`  Study Plans: ${planCount[0].count}`);
      console.log(`  Total Sessions: ${sessionCount[0].count}`);
      console.log(`  Overdue Sessions: ${overdueCount[0].count}`);

      // Test complex query performance
      const complexQueryStart = Date.now();
      const complexResult = await this.query(`
        SELECT 
          sp.id as plan_id,
          sp.plan_name,
          sp.exam_date,
          u.email,
          COUNT(ss.id) as total_sessions,
          COUNT(CASE WHEN ss.status = 'Pendente' AND ss.session_date < date('now') THEN 1 END) as overdue,
          COUNT(CASE WHEN ss.status = 'Pendente' AND ss.session_date >= date('now') THEN 1 END) as future,
          COUNT(CASE WHEN ss.status = 'Concluída' THEN 1 END) as completed
        FROM study_plans sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN study_sessions ss ON sp.id = ss.study_plan_id
        GROUP BY sp.id, sp.plan_name, sp.exam_date, u.email
        HAVING overdue > 0
        ORDER BY overdue DESC
        LIMIT 10
      `);

      const complexQueryTime = Date.now() - complexQueryStart;
      console.log(`\nComplex query executed in ${complexQueryTime}ms`);
      console.log(`Found ${complexResult.length} plans with overdue sessions`);

      const totalTime = Date.now() - start;
      console.log(`\nTotal performance test completed in ${totalTime}ms`);

    } catch (error) {
      console.error('❌ Error in performance test:', error.message);
    }
  }

  /**
   * Test 4: Simulate rescheduling workflow
   */
  async testReschedulingWorkflow(planId) {
    console.log(`\n=== Simulating Rescheduling Workflow for Plan ${planId} ===`);

    try {
      // Get plan details
      const plan = await this.query('SELECT * FROM study_plans WHERE id = ?', [planId]);
      if (plan.length === 0) {
        console.log('❌ Plan not found');
        return;
      }

      const planData = plan[0];
      console.log(`Plan: ${planData.plan_name}`);
      console.log(`Exam Date: ${planData.exam_date}`);

      // Get overdue sessions before rescheduling
      const todayStr = new Date().toISOString().split('T')[0];
      const overdueBefore = await this.query(
        "SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = 'Pendente' AND session_date < ? ORDER BY session_date",
        [planId, todayStr]
      );

      console.log(`\nOverdue sessions before rescheduling: ${overdueBefore.length}`);

      if (overdueBefore.length === 0) {
        console.log('✅ No overdue sessions to reschedule');
        return;
      }

      // Display overdue sessions
      console.log('\nOverdue sessions:');
      overdueBefore.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session.subject_name} - ${session.topic_description} (${session.session_date})`);
      });

      // Simulate rescheduling algorithm
      console.log('\n--- Simulating Rescheduling ---');
      const rescheduled = await this.simulateRescheduling(planData, overdueBefore);

      console.log(`\nRescheduling Results:`);
      console.log(`  Successfully rescheduled: ${rescheduled.success}`);
      console.log(`  Failed to reschedule: ${rescheduled.failed}`);
      console.log(`  Total: ${rescheduled.total}`);

      if (rescheduled.details.length > 0) {
        console.log('\nRescheduled sessions:');
        rescheduled.details.forEach(detail => {
          console.log(`  ${detail.subject} - ${detail.topic} → ${detail.newDate} (${detail.strategy})`);
        });
      }

    } catch (error) {
      console.error('❌ Error in rescheduling workflow test:', error.message);
    }
  }

  /**
   * Simulate the rescheduling algorithm
   */
  async simulateRescheduling(plan, overdueSessions) {
    const studyHours = JSON.parse(plan.study_hours_per_day);
    const sessionDurationHours = plan.session_duration_minutes / 60;
    const examDate = new Date(plan.exam_date + 'T23:59:59');
    const today = new Date();

    const getDayCapacity = (dateStr) => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()];
      return Math.floor((studyHours[dayName] || 0) / sessionDurationHours);
    };

    // Get current usage
    const currentUsage = await this.query(`
      SELECT session_date, subject_name, COUNT(*) as count
      FROM study_sessions 
      WHERE study_plan_id = ? AND session_date > ? AND session_date <= ?
      GROUP BY session_date, subject_name
    `, [plan.id, today.toISOString().split('T')[0], plan.exam_date]);

    const usageByDate = {};
    const usageBySubjectDate = {};

    currentUsage.forEach(usage => {
      if (!usageByDate[usage.session_date]) {
        usageByDate[usage.session_date] = 0;
      }
      usageByDate[usage.session_date] += usage.count;

      const key = `${usage.session_date}-${usage.subject_name}`;
      usageBySubjectDate[key] = usage.count;
    });

    let success = 0;
    let failed = 0;
    const details = [];

    // Try to reschedule each session
    for (const session of overdueSessions) {
      let rescheduled = false;

      // Try each future date
      for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
        const candidateDate = new Date(today);
        candidateDate.setDate(candidateDate.getDate() + dayOffset);
        
        if (candidateDate > examDate) break;

        const dateStr = candidateDate.toISOString().split('T')[0];
        const dayCapacity = getDayCapacity(dateStr);
        const currentDayUsage = usageByDate[dateStr] || 0;
        
        // Check daily capacity
        if (currentDayUsage >= dayCapacity) continue;

        // Check subject limit (max 2 per subject per day)
        const subjectKey = `${dateStr}-${session.subject_name}`;
        const subjectUsage = usageBySubjectDate[subjectKey] || 0;
        if (subjectUsage >= 2) continue;

        // Can schedule here
        usageByDate[dateStr] = currentDayUsage + 1;
        usageBySubjectDate[subjectKey] = subjectUsage + 1;

        details.push({
          subject: session.subject_name,
          topic: session.topic_description,
          originalDate: session.session_date,
          newDate: dateStr,
          strategy: dayOffset <= 7 ? 'preferred' : 'fallback'
        });

        success++;
        rescheduled = true;
        break;
      }

      if (!rescheduled) {
        failed++;
      }
    }

    return {
      success,
      failed,
      total: overdueSessions.length,
      details
    };
  }

  /**
   * Test 5: Database health check
   */
  async testDatabaseHealth() {
    console.log('\n=== Database Health Check ===');

    try {
      // Check for orphaned sessions
      const orphanedSessions = await this.query(`
        SELECT COUNT(*) as count
        FROM study_sessions ss
        LEFT JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE sp.id IS NULL
      `);

      console.log(`Orphaned sessions: ${orphanedSessions[0].count}`);

      // Check for invalid dates
      const invalidDates = await this.query(`
        SELECT COUNT(*) as count
        FROM study_sessions
        WHERE session_date IS NULL OR session_date = ''
      `);

      console.log(`Sessions with invalid dates: ${invalidDates[0].count}`);

      // Check for sessions beyond exam dates
      const beyondExam = await this.query(`
        SELECT COUNT(*) as count
        FROM study_sessions ss
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE ss.session_date > sp.exam_date
      `);

      console.log(`Sessions scheduled beyond exam date: ${beyondExam[0].count}`);

      // Check for negative postponement counts
      const negativePostponements = await this.query(`
        SELECT COUNT(*) as count
        FROM study_sessions
        WHERE postpone_count < 0
      `);

      console.log(`Sessions with negative postpone counts: ${negativePostponements[0].count}`);

      // Check for corrupted study hours
      const plans = await this.query('SELECT id, study_hours_per_day FROM study_plans');
      let corruptedPlans = 0;

      plans.forEach(plan => {
        try {
          JSON.parse(plan.study_hours_per_day);
        } catch (error) {
          corruptedPlans++;
        }
      });

      console.log(`Plans with corrupted study hours: ${corruptedPlans}`);

      const totalIssues = orphanedSessions[0].count + invalidDates[0].count + 
                         beyondExam[0].count + negativePostponements[0].count + corruptedPlans;

      console.log(`\nTotal database health issues: ${totalIssues}`);
      console.log(`Database health: ${totalIssues === 0 ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION'}`);

    } catch (error) {
      console.error('❌ Error in database health check:', error.message);
    }
  }
}

/**
 * Main execution function
 */
async function runManualTests() {
  console.log('🚀 Starting Manual Rescheduling Tests');
  console.log('====================================');

  const tester = new ManualReschedulingTester();

  try {
    await tester.connect();

    // Parse command line arguments
    const args = process.argv.slice(2);
    const testType = args[0] || 'all';

    switch (testType) {
      case 'user3':
        await tester.testUser3Scenario();
        break;
        
      case 'allusers':
        await tester.testAllUsersWithOverdue();
        break;
        
      case 'performance':
        await tester.testPerformance();
        break;
        
      case 'workflow':
        const planId = args[1];
        if (!planId) {
          console.log('❌ Please provide a plan ID for workflow testing');
          console.log('Usage: node rescheduling-manual-tests.js workflow <planId>');
        } else {
          await tester.testReschedulingWorkflow(parseInt(planId));
        }
        break;
        
      case 'health':
        await tester.testDatabaseHealth();
        break;
        
      case 'all':
      default:
        await tester.testUser3Scenario();
        await tester.testPerformance();
        await tester.testDatabaseHealth();
        break;
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await tester.close();
    console.log('\n✅ Manual testing completed');
  }
}

/**
 * Export for programmatic use
 */
module.exports = { ManualReschedulingTester };

/**
 * Run if called directly
 */
if (require.main === module) {
  runManualTests().catch(console.error);
}