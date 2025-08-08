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

      // Study plans
      `CREATE TABLE IF NOT EXISTS study_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        target_exam TEXT,
        duration_weeks INTEGER,
        weekly_hours INTEGER,
        subjects TEXT,
        difficulty_level TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Study schedules
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
   * Create a test study plan
   */
  async createTestPlan(planData = {}, userId = 1) {
    const defaultData = {
      user_id: userId,
      name: 'Test Study Plan',
      description: 'Test description',
      target_exam: 'Test Exam',
      duration_weeks: 12,
      weekly_hours: 20,
      subjects: JSON.stringify(['Test Subject']),
      difficulty_level: 'intermediate',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const plan = { ...defaultData, ...planData };
    
    const result = await this.run(`
      INSERT INTO study_plans (user_id, name, description, target_exam, duration_weeks,
                              weekly_hours, subjects, difficulty_level, is_active,
                              created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      plan.user_id, plan.name, plan.description, plan.target_exam,
      plan.duration_weeks, plan.weekly_hours, plan.subjects,
      plan.difficulty_level, plan.is_active, plan.created_at, plan.updated_at
    ]);

    return { ...plan, id: result.id };
  }

  /**
   * Clean all tables
   */
  async cleanTables() {
    const tables = [
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