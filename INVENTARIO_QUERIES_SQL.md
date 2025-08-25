# 🗄️ INVENTÁRIO DE QUERIES SQL

**Data:** 25/08/2025
**Hora:** 08:29:33

## 📊 ESTATÍSTICAS

- **Total de queries SQL em server.js:** 102
- **Queries por tipo:**
  - SELECT: 70
  - INSERT: 9
  - UPDATE: 16
  - DELETE: 10

## 📝 QUERIES ENCONTRADAS

| Linha | Query (preview) | Repository Sugerido |
|-------|----------------|--------------------|
| L312 | `'SELECT * FROM users WHERE google_id = ?',...` | users.repository.js |
| L328 | `'SELECT * FROM users WHERE email = ?',...` | users.repository.js |
| L341 | `'UPDATE users SET google_id = ?, auth_provider = "google", g...` | users.repository.js |
| L353 | `'SELECT * FROM users WHERE id = ?',...` | users.repository.js |
| L369 | ``INSERT INTO users (email, name, google_id, auth_provider, g...` | users.repository.js |
| L376 | `'SELECT * FROM users WHERE id = ?',...` | users.repository.js |
| L405 | `'SELECT * FROM users WHERE id = ?',...` | users.repository.js |
| L445 | `const user = await dbGet('SELECT profile_picture FROM users ...` | users.repository.js |
| L450 | `await dbRun('UPDATE users SET profile_picture = ? WHERE id =...` | users.repository.js |
| L748 | `await dbRun('INSERT INTO users (email, password_hash, name, ...` | users.repository.js |
| L807 | `const user = await dbGet('SELECT * FROM users WHERE email = ...` | users.repository.js |
| L939 | `const user = await dbGet('SELECT * FROM users WHERE email = ...` | users.repository.js |
| L954 | `await dbRun('UPDATE users SET reset_token = ?, reset_token_e...` | users.repository.js |
| L1000 | `const user = await dbGet('SELECT * FROM users WHERE reset_to...` | users.repository.js |
| L1005 | `await dbRun('UPDATE users SET password_hash = ?, reset_token...` | users.repository.js |
| L1194 | `const sql = `UPDATE users SET ${updates.join(', ')} WHERE id...` | users.repository.js |
| L1258 | `const test2 = await dbAll('SELECT COUNT(*) as count FROM stu...` | plans.repository.js |
| L1273 | `const rows = await dbAll('SELECT * FROM study_plans WHERE us...` | plans.repository.js |
| L1312 | `INSERT INTO study_plans...` | plans.repository.js |
| L1333 | `const row = await dbGet('SELECT * FROM study_plans WHERE id ...` | plans.repository.js |
| L1373 | `const plan = await dbGet('SELECT id FROM study_plans WHERE i...` | plans.repository.js |
| L1377 | `await dbRun('DELETE FROM study_sessions WHERE study_plan_id ...` | sessions.repository.js |
| L1378 | `await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT ...` | general.repository.js |
| L1379 | `await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', ...` | general.repository.js |
| L1411 | `const sql = 'UPDATE study_plans SET daily_question_goal = ?,...` | plans.repository.js |
| L1448 | `const plan = await dbGet('SELECT id FROM study_plans WHERE i...` | plans.repository.js |
| L1454 | `const result = await dbRun('INSERT INTO subjects (study_plan...` | general.repository.js |
| L1462 | `await dbRun('INSERT INTO topics (subject_id, topic_name, pri...` | general.repository.js |
| L1486 | `UPDATE subjects SET subject_name = ?, priority_weight = ?...` | general.repository.js |
| L1487 | `WHERE id = ? AND study_plan_id IN (SELECT id FROM study_plan...` | plans.repository.js |
| L1509 | `SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_p...` | plans.repository.js |
| L1515 | `await dbRun('DELETE FROM study_sessions WHERE topic_id IN (S...` | sessions.repository.js |
| L1515 | `await dbRun('DELETE FROM study_sessions WHERE topic_id IN (S...` | sessions.repository.js |
| L1517 | `await dbRun('DELETE FROM subjects WHERE id = ?', [subjectId]...` | general.repository.js |
| L1537 | `const plan = await dbGet('SELECT id FROM study_plans WHERE i...` | plans.repository.js |
| L1542 | `const subjects = await dbAll('SELECT * FROM subjects WHERE s...` | general.repository.js |
| L1590 | `SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_p...` | plans.repository.js |
| L1595 | `const rows = await dbAll('SELECT id, topic_name, topic_name ...` | general.repository.js |
| L1681 | `SELECT id FROM subjects WHERE study_plan_id IN (...` | general.repository.js |
| L1741 | `SELECT id FROM subjects WHERE study_plan_id IN (...` | general.repository.js |
| L1773 | `UPDATE topics SET description = ?, priority_weight = ?...` | general.repository.js |
| L1775 | `SELECT id FROM subjects WHERE study_plan_id IN (...` | general.repository.js |
| L1783 | `UPDATE topics SET description = ?...` | general.repository.js |
| L1785 | `SELECT id FROM subjects WHERE study_plan_id IN (...` | general.repository.js |
| L1814 | `SELECT t.id FROM topics t...` | general.repository.js |
| L1828 | `await dbRun('DELETE FROM study_sessions WHERE topic_id = ?',...` | sessions.repository.js |
| L1880 | `await dbRun('UPDATE study_plans SET daily_question_goal = ?,...` | plans.repository.js |
| L1885 | `const plan = await dbGet('SELECT * FROM study_plans WHERE id...` | plans.repository.js |
| L1899 | `await dbRun('DELETE FROM study_sessions WHERE study_plan_id ...` | sessions.repository.js |
| L2083 | `await dbRun('DELETE FROM reta_final_exclusions WHERE plan_id...` | general.repository.js |

... e mais 52 queries
