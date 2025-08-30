const db = require('../../database-postgres-direct');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const TEST_USER = {
  email: 'test.user@example.com',
  password: 'password123',
  name: 'Test User'
};

async function createTestUser() {
  // Clean up any previous test user
  await cleanUpTestUser();

  const hashedPassword = await bcrypt.hash(TEST_USER.password, 10);
  const userResult = await db.run(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
    [TEST_USER.email, hashedPassword, TEST_USER.name]
  );
  const userId = userResult.id || userResult.lastID;

  const planResult = await db.run(
    'INSERT INTO study_plans (user_id, plan_name, exam_date) VALUES ($1, $2, $3) RETURNING id',
    [userId, 'Test Plan', '2025-12-31']
  );
  const planId = planResult.id || planResult.lastID;

  // Create a subject and topic
  const subjectResult = await db.run(
    'INSERT INTO subjects (study_plan_id, subject_name) VALUES ($1, $2) RETURNING id',
    [planId, 'Test Subject']
  );
  const subjectId = subjectResult.id || subjectResult.lastID;

  const topicResult = await db.run(
    'INSERT INTO topics (subject_id, topic_name) VALUES ($1, $2) RETURNING id',
    [subjectId, 'Test Topic']
  );
  const topicId = topicResult.id || topicResult.lastID;

  // Create a study session for today
  const today = new Date().toLocaleDateString("en-CA", {timeZone: "America/Sao_Paulo"});
  await db.run(
    'INSERT INTO study_sessions (study_plan_id, topic_id, session_date, session_type, status, subject_name, topic_description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [planId, topicId, today, 'Novo Tópico', 'Pendente', 'Test Subject', 'Test Topic']
  );

  const token = jwt.sign({ id: userId, email: TEST_USER.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  return { testToken: token, testUserId: userId, testPlanId: planId };
}

async function cleanUpTestUser() {
  console.log('Cleaning up test user...');
  const user = await db.get('SELECT id FROM users WHERE email = $1', [TEST_USER.email]);
  if (user) {
    await db.run('DELETE FROM study_plans WHERE user_id = $1', [user.id]);
    await db.run('DELETE FROM users WHERE id = $1', [user.id]);
  }
}

module.exports = { createTestUser, cleanUpTestUser };