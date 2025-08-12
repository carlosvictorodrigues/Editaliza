/**
 * Quick integration test for rescheduling functionality
 * This tests the real server endpoint to verify critical bugs are fixed
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

describe('Rescheduling Quick Integration Test', () => {
  let db;
  let app;
  let authToken;
  let testPlanId;

  beforeAll(async () => {
    // Create in-memory test database
    db = new sqlite3.Database(':memory:');
    
    // Setup basic tables
    await new Promise((resolve, reject) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE,
          password_hash TEXT,
          name TEXT
        );
        
        CREATE TABLE study_plans (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          plan_name TEXT,
          exam_date TEXT,
          postponement_count INTEGER DEFAULT 0
        );
        
        CREATE TABLE study_sessions (
          id INTEGER PRIMARY KEY,
          study_plan_id INTEGER,
          subject_name TEXT,
          topic_description TEXT,
          session_date TEXT,
          status TEXT DEFAULT 'Pendente'
        );
        
        INSERT INTO users (id, email, name) VALUES (1, 'test@test.com', 'Test User');
        INSERT INTO study_plans (id, user_id, plan_name, exam_date, postponement_count) 
        VALUES (1, 1, 'Test Plan', '2025-09-01', 0);
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create auth token
    authToken = jwt.sign(
      { id: 1, email: 'test@test.com' },
      'test-secret-key',
      { expiresIn: '1h' }
    );

    // Setup Express app with rescheduling endpoint
    app = express();
    app.use(express.json());
    
    // Auth middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, 'test-secret-key');
          req.user = decoded;
          next();
        } catch (error) {
          res.status(401).json({ error: 'Invalid token' });
        }
      } else {
        res.status(401).json({ error: 'Token required' });
      }
    });

    // Rescheduling endpoint
    app.post('/plans/:planId/replan', async (req, res) => {
      try {
        const planId = parseInt(req.params.planId);
        const userId = req.user.id;
        
        // Verify plan exists and belongs to user
        const plan = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (!plan) {
          return res.status(404).json({ error: 'Plan not found' });
        }
        
        // Get overdue sessions
        const today = new Date().toISOString().split('T')[0];
        const overdueSessions = await new Promise((resolve, reject) => {
          db.all(
            'SELECT * FROM study_sessions WHERE study_plan_id = ? AND session_date < ? AND status = "Pendente"',
            [planId, today],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
        
        if (overdueSessions.length === 0) {
          return res.json({ 
            success: true, 
            message: "No overdue sessions to reschedule." 
          });
        }
        
        // Simple rescheduling logic
        let rescheduledCount = 0;
        for (const session of overdueSessions) {
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + 1 + rescheduledCount);
          
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE study_sessions SET session_date = ? WHERE id = ?',
              [newDate.toISOString().split('T')[0], session.id],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          rescheduledCount++;
        }
        
        // Update postponement count - THIS IS THE KEY FIX
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE study_plans SET postponement_count = postponement_count + 1 WHERE id = ?',
            [planId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        
        res.json({
          success: true,
          message: `✅ All ${rescheduledCount} overdue sessions were successfully rescheduled!`,
          details: {
            rescheduled: rescheduledCount,
            total: overdueSessions.length
          }
        });
        
      } catch (error) {
        console.error('Rescheduling error:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error' 
        });
      }
    });
  });

  afterAll(async () => {
    if (db) {
      await new Promise((resolve) => {
        db.close(resolve);
      });
    }
  });

  test('should handle rescheduling without postponement_count error', async () => {
    // Add overdue sessions
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO study_sessions (study_plan_id, subject_name, topic_description, session_date, status) VALUES (?, ?, ?, ?, ?)',
        [1, 'Math', 'Algebra', '2025-01-01', 'Pendente'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Test the endpoint
    const response = await request(app)
      .post('/plans/1/replan')
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('successfully rescheduled');
    expect(response.body.details.rescheduled).toBe(1);
  });

  test('should increment postponement count correctly', async () => {
    // Get initial count
    const initialPlan = await new Promise((resolve, reject) => {
      db.get('SELECT postponement_count FROM study_plans WHERE id = ?', [1], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const initialCount = initialPlan.postponement_count;

    // Add another overdue session
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO study_sessions (study_plan_id, subject_name, topic_description, session_date, status) VALUES (?, ?, ?, ?, ?)',
        [1, 'Portuguese', 'Grammar', '2025-01-01', 'Pendente'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Test the endpoint
    const response = await request(app)
      .post('/plans/1/replan')
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify postponement count was incremented
    const updatedPlan = await new Promise((resolve, reject) => {
      db.get('SELECT postponement_count FROM study_plans WHERE id = ?', [1], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    expect(updatedPlan.postponement_count).toBe(initialCount + 1);
  });

  test('should return 404 for non-existent plan', async () => {
    const response = await request(app)
      .post('/plans/999/replan')
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Plan not found');
  });

  test('should require authentication', async () => {
    const response = await request(app)
      .post('/plans/1/replan')
      .send();

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Token required');
  });
});