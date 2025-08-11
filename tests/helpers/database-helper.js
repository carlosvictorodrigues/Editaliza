/**
 * Database Test Helper
 * Provides utilities for database operations in tests
 */

const sqlite3 = require('sqlite3').verbose();

class DatabaseTestHelper {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Create a test database in memory
   */
  async createTestDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(':memory:', (err) => {
        if (err) {
          reject(err);
        } else {
          this.isConnected = true;
          resolve(this.db);
        }
      });
    });
  }

  /**
   * Setup test tables
   */
  async setupTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        name TEXT,
        phone TEXT,
        occupation TEXT,
        institution TEXT,
        city TEXT,
        study_hours_per_day INTEGER,
        target_score INTEGER,
        difficulties TEXT,
        avatar TEXT,
        auth_provider TEXT DEFAULT 'local',
        google_id TEXT,
        is_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Password reset tokens
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Login attempts
      `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Study plans - matching production schema
      `CREATE TABLE IF NOT EXISTS study_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_name TEXT,
        exam_date TEXT,
        study_hours_per_day TEXT,
        daily_question_goal INTEGER,
        weekly_question_goal INTEGER,
        session_duration_minutes INTEGER DEFAULT 50,
        review_mode TEXT,
        postponement_count INTEGER DEFAULT 0,
        has_essay BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Subjects table
      `CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_plan_id INTEGER,
        subject_name TEXT,
        priority_weight INTEGER,
        FOREIGN KEY (study_plan_id) REFERENCES study_plans (id)
      )`,

      // Topics table
      `CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER,
        description TEXT NOT NULL,
        status TEXT DEFAULT "Pendente",
        completion_date TEXT,
        FOREIGN KEY (subject_id) REFERENCES subjects (id)
      )`,

      // Study sessions - matching production schema for rescheduling
      `CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        study_plan_id INTEGER,
        topic_id INTEGER,
        subject_name TEXT,
        topic_description TEXT,
        session_date TEXT,
        session_type TEXT,
        status TEXT DEFAULT 'Pendente',
        notes TEXT,
        questions_solved INTEGER DEFAULT 0,
        time_studied_seconds INTEGER DEFAULT 0,
        postpone_count INTEGER DEFAULT 0,
        FOREIGN KEY (study_plan_id) REFERENCES study_plans (id),
        FOREIGN KEY (topic_id) REFERENCES topics (id)
      )`,

      // Study schedules - legacy support
      `CREATE TABLE IF NOT EXISTS study_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_id INTEGER,
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        subject TEXT NOT NULL,
        is_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (plan_id) REFERENCES study_plans(id)
      )`,

      // Study progress
      `CREATE TABLE IF NOT EXISTS study_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        planned_hours REAL DEFAULT 0,
        completed_hours REAL DEFAULT 0,
        subjects_studied TEXT,
        efficiency_score INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
  }

  /**
   * Execute a SQL query
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
   * Execute a SELECT query
   */
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Execute a SELECT query returning all rows
   */
  async all(sql, params = []) {
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
   * Create a test user
   */
  async createTestUser(userData = {}) {
    const defaultData = {
      email: 'test@example.com',
      password_hash: '$2b$12$hashedpassword',
      name: 'Test User',
      auth_provider: 'local',
      is_verified: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const user = { ...defaultData, ...userData };
    
    const result = await this.run(`
      INSERT INTO users (email, password_hash, name, phone, occupation, institution, 
                        city, study_hours_per_day, target_score, difficulties, avatar, 
                        auth_provider, google_id, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.email, user.password_hash, user.name, user.phone, user.occupation,
      user.institution, user.city, user.study_hours_per_day, user.target_score,
      user.difficulties, user.avatar, user.auth_provider, user.google_id,
      user.is_verified, user.created_at, user.updated_at
    ]);

    return { ...user, id: result.id };
  }

  /**
   * Create a test study plan - updated for rescheduling tests
   */
  async createTestPlan(planData = {}, userId = 1) {
    // Set exam date 30 days in the future by default
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    const defaultData = {
      user_id: userId,
      plan_name: 'Test Study Plan',
      exam_date: futureDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({ monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2, saturday: 3, sunday: 1 }),
      daily_question_goal: 20,
      weekly_question_goal: 140,
      session_duration_minutes: 50,
      review_mode: 'spaced',
      postponement_count: 0,
      has_essay: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const plan = { ...defaultData, ...planData };
    
    const result = await this.run(`
      INSERT INTO study_plans (user_id, plan_name, exam_date, study_hours_per_day,
                              daily_question_goal, weekly_question_goal, session_duration_minutes,
                              review_mode, postponement_count, has_essay, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      plan.user_id, plan.plan_name, plan.exam_date, plan.study_hours_per_day,
      plan.daily_question_goal, plan.weekly_question_goal, plan.session_duration_minutes,
      plan.review_mode, plan.postponement_count, plan.has_essay, plan.created_at, plan.updated_at
    ]);

    return { ...plan, id: result.id };
  }

  /**
   * Create a test subject
   */
  async createTestSubject(subjectData = {}, planId = 1) {
    const defaultData = {
      study_plan_id: planId,
      subject_name: 'Test Subject',
      priority_weight: 1
    };

    const subject = { ...defaultData, ...subjectData };
    
    const result = await this.run(`
      INSERT INTO subjects (study_plan_id, subject_name, priority_weight)
      VALUES (?, ?, ?)
    `, [subject.study_plan_id, subject.subject_name, subject.priority_weight]);

    return { ...subject, id: result.id };
  }

  /**
   * Create a test topic
   */
  async createTestTopic(topicData = {}, subjectId = 1) {
    const defaultData = {
      subject_id: subjectId,
      description: 'Test Topic',
      status: 'Pendente',
      completion_date: null
    };

    const topic = { ...defaultData, ...topicData };
    
    const result = await this.run(`
      INSERT INTO topics (subject_id, description, status, completion_date)
      VALUES (?, ?, ?, ?)
    `, [topic.subject_id, topic.description, topic.status, topic.completion_date]);

    return { ...topic, id: result.id };
  }

  /**
   * Create a test study session
   */
  async createTestSession(sessionData = {}, planId = 1, topicId = 1) {
    const defaultData = {
      study_plan_id: planId,
      topic_id: topicId,
      subject_name: 'Test Subject',
      topic_description: 'Test Topic',
      session_date: new Date().toISOString().split('T')[0],
      session_type: 'primeira_vez',
      status: 'Pendente',
      notes: null,
      questions_solved: 0,
      time_studied_seconds: 0,
      postpone_count: 0
    };

    const session = { ...defaultData, ...sessionData };
    
    const result = await this.run(`
      INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description,
                                 session_date, session_type, status, notes, questions_solved,
                                 time_studied_seconds, postpone_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      session.study_plan_id, session.topic_id, session.subject_name, session.topic_description,
      session.session_date, session.session_type, session.status, session.notes,
      session.questions_solved, session.time_studied_seconds, session.postpone_count
    ]);

    return { ...session, id: result.id };
  }

  /**
   * Create overdue sessions for testing
   */
  async createOverdueSessions(planId, subjectConfigs = []) {
    const sessions = [];
    
    // Default subjects if none provided
    if (subjectConfigs.length === 0) {
      subjectConfigs = [
        { name: 'Matemática', overdueCount: 3 },
        { name: 'Português', overdueCount: 2 },
        { name: 'História', overdueCount: 2 }
      ];
    }

    for (const subjectConfig of subjectConfigs) {
      // Create subject
      const subject = await this.createTestSubject({
        study_plan_id: planId,
        subject_name: subjectConfig.name,
        priority_weight: 1
      });

      // Create overdue sessions for this subject
      for (let i = 0; i < subjectConfig.overdueCount; i++) {
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - (i + 1)); // 1, 2, 3 days ago

        const topic = await this.createTestTopic({
          subject_id: subject.id,
          description: `${subjectConfig.name} - Tópico ${i + 1}`
        });

        const session = await this.createTestSession({
          study_plan_id: planId,
          topic_id: topic.id,
          subject_name: subjectConfig.name,
          topic_description: `${subjectConfig.name} - Tópico ${i + 1}`,
          session_date: overdueDate.toISOString().split('T')[0],
          session_type: i === 0 ? 'primeira_vez' : 'revisao',
          status: 'Pendente'
        });

        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Create future sessions for testing rescheduling constraints
   */
  async createFutureSessions(planId, subjectName, sessionCount = 3) {
    const sessions = [];
    
    for (let i = 1; i <= sessionCount; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i); // 1, 2, 3 days in the future

      const topic = await this.createTestTopic({
        subject_id: 1, // Assume subject exists
        description: `${subjectName} - Future Topic ${i}`
      });

      const session = await this.createTestSession({
        study_plan_id: planId,
        topic_id: topic.id,
        subject_name: subjectName,
        topic_description: `${subjectName} - Future Topic ${i}`,
        session_date: futureDate.toISOString().split('T')[0],
        session_type: 'primeira_vez',
        status: 'Pendente'
      });

      sessions.push(session);
    }

    return sessions;
  }

  /**
   * Clean all tables
   */
  async cleanTables() {
    const tables = [
      'study_sessions',
      'topics',
      'subjects',
      'study_progress',
      'study_schedules', 
      'study_plans',
      'login_attempts',
      'password_reset_tokens',
      'users'
    ];

    for (const table of tables) {
      await this.run(`DELETE FROM ${table}`);
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db && this.isConnected) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.isConnected = false;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const tables = ['users', 'study_plans', 'study_schedules', 'study_progress'];
    const stats = {};

    for (const table of tables) {
      const result = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result.count;
    }

    return stats;
  }
}

// Create a singleton instance for tests
let testDB = null;

const getTestDatabase = async () => {
  if (!testDB) {
    testDB = new DatabaseTestHelper();
    await testDB.createTestDatabase();
    await testDB.setupTables();
  }
  return testDB;
};

const cleanupTestDatabase = async () => {
  if (testDB) {
    await testDB.cleanTables();
  }
};

const closeTestDatabase = async () => {
  if (testDB) {
    await testDB.close();
    testDB = null;
  }
};

module.exports = {
  DatabaseTestHelper,
  getTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase
};