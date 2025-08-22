const sqlite3 = require('sqlite3').verbose();

const mockDb = new sqlite3.Database(':memory:');
jest.mock('../../../database', () => mockDb);
const scheduleRepository = require('../../../src/repositories/scheduleRepository');

describe('Reschedule completion date', () => {
  beforeAll((done) => {
    mockDb.serialize(() => {
      mockDb.run('CREATE TABLE study_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER)');
      mockDb.run('CREATE TABLE subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, study_plan_id INTEGER, subject_name TEXT)');
      mockDb.run('CREATE TABLE topics (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER, description TEXT, status TEXT DEFAULT "Pendente", completion_date TEXT)');
      mockDb.run('CREATE TABLE study_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, study_plan_id INTEGER, topic_id INTEGER, subject_name TEXT, topic_description TEXT, session_date TEXT, session_type TEXT, status TEXT DEFAULT "Pendente", notes TEXT, questions_solved INTEGER, time_studied_seconds INTEGER, postpone_count INTEGER)', done);
    });
  });

  beforeEach((done) => {
    mockDb.serialize(() => {
      mockDb.run('DELETE FROM study_sessions');
      mockDb.run('DELETE FROM topics');
      mockDb.run('DELETE FROM subjects');
      mockDb.run('DELETE FROM study_plans', done);
    });
  });

  test('uses rescheduled session date as topic completion date', async () => {
    const planId = await new Promise((resolve, reject) => {
      mockDb.run('INSERT INTO study_plans (user_id) VALUES (1)', function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    const subjectId = await new Promise((resolve, reject) => {
      mockDb.run('INSERT INTO subjects (study_plan_id, subject_name) VALUES (?, ?)', [planId, 'Matemática'], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    const topicId = await new Promise((resolve, reject) => {
      mockDb.run('INSERT INTO topics (subject_id, description) VALUES (?, ?)', [subjectId, 'Derivadas'], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    const sessionId = await new Promise((resolve, reject) => {
      mockDb.run(
        'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [planId, topicId, 'Matemática', 'Derivadas', '2024-01-01', 'Novo Tópico', 'Pendente'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const newDate = '2024-01-05';
    await scheduleRepository.updateSession(sessionId, { session_date: newDate }, 1);
    await scheduleRepository.updateSessionStatus(sessionId, 'Concluído', 1);

    const topic = await new Promise((resolve, reject) => {
      mockDb.get('SELECT completion_date FROM topics WHERE id = ?', [topicId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    expect(topic.completion_date).toBe(newDate);
  });
});
