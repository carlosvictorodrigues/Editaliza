# 📊 FASE 3 - RELATÓRIO DE EXTRAÇÃO SQL

**Data:** 25/08/2025
**Hora:** 09:01:12

## 📈 RESUMO

- **Total de queries identificadas:** 131
- **Repositories sugeridos:** 6
- **Validação:** ✅ Passou

## 🗄️ QUERIES POR REPOSITORY


### user.repository.js (17 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 311 | `SELECT * FROM users WHERE google_id = ?` | global |
| 327 | `SELECT * FROM users WHERE email = ?` | global |
| 340 | `UPDATE users SET google_id = ?, auth_provider = ` | global |
| 352 | `SELECT * FROM users WHERE id = ?` | global |
| 368 | `INSERT INTO users (email, name, google_id, auth_provider, google_avatar, created_at) 
             ...` | global |
| 375 | `SELECT * FROM users WHERE id = ?` | global |
| 404 | `SELECT * FROM users WHERE id = ?` | global |
| 445 | `SELECT profile_picture FROM users WHERE id = ?` | /api/profile/upload-photo |
| 450 | `UPDATE users SET profile_picture = ? WHERE id = ?` | /api/profile/upload-photo |
| 748 | `INSERT INTO users (email, password_hash, name, created_at) VALUES (?,?,?,?)` | /api/register |

... e mais 7 queries

### general.repository.js (31 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 1254 | `SELECT 1 as test` | /api/test-db |
| 1514 | `BEGIN` | /api/subjects/:subjectId |
| 1518 | `COMMIT` | /api/subjects/:subjectId |
| 1521 | `ROLLBACK` | /api/subjects/:subjectId |
| 1620 | `BEGIN` | /api/topics/batch_update |
| 1691 | `COMMIT` | global |
| 1694 | `ROLLBACK` | global |
| 1713 | `BEGIN` | /api/topics/batch_update_details |
| 1751 | `COMMIT` | global |
| 1754 | `ROLLBACK` | global |

... e mais 21 queries

### plan.repository.js (37 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 1258 | `SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?` | /api/test-db |
| 1273 | `SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC` | /api/plans |
| 1333 | `SELECT * FROM study_plans WHERE id = ? AND user_id = ?` | /api/plans/:planId |
| 1373 | `SELECT id FROM study_plans WHERE id = ? AND user_id = ?` | /api/plans/:planId |
| 1376 | `BEGIN` | /api/plans/:planId |
| 1380 | `DELETE FROM study_plans WHERE id = ?` | /api/plans/:planId |
| 1381 | `COMMIT` | /api/plans/:planId |
| 1385 | `ROLLBACK` | /api/plans/:planId |
| 1448 | `SELECT id FROM study_plans WHERE id = ? AND user_id = ?` | /api/plans/:planId/subjects_with_topics |
| 1453 | `BEGIN` | /api/plans/:planId/subjects_with_topics |

... e mais 27 queries

### session.repository.js (27 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 1377 | `DELETE FROM study_sessions WHERE study_plan_id = ?` | /api/plans/:planId |
| 1515 | `DELETE FROM study_sessions WHERE topic_id IN (SELECT id FROM topics WHERE subject_id = ?)` | /api/subjects/:subjectId |
| 1828 | `DELETE FROM study_sessions WHERE topic_id = ?` | /api/topics/:topicId |
| 1899 | `DELETE FROM study_sessions WHERE study_plan_id = ?` | global |
| 2562 | `SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \` | /api/plans/:planId/replan-preview |
| 2595 | `
                SELECT * FROM study_sessions 
                WHERE study_plan_id = ? AND status ...` | /api/plans/:planId/replan-preview |
| 2723 | `SELECT * FROM study_sessions WHERE study_plan_id = ? AND status = \` | /api/plans/:planId/replan |
| 2762 | `SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ? AND session_date = ?` | findNextAvailableSlot |
| 2786 | `SELECT id, subject_name FROM study_sessions WHERE study_plan_id = ? AND session_date = ?` | loadSessionsForDate |
| 2810 | `
                    SELECT * FROM study_sessions 
                    WHERE study_plan_id = ? AND...` | loadSessionsForDate |

... e mais 17 queries

### subject.repository.js (9 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 1378 | `DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)` | /api/plans/:planId |
| 1379 | `DELETE FROM subjects WHERE study_plan_id = ?` | /api/plans/:planId |
| 1454 | `INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)` | /api/plans/:planId/subjects_with_topics |
| 1517 | `DELETE FROM subjects WHERE id = ?` | /api/subjects/:subjectId |
| 1542 | `SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY id DESC` | /api/plans/:planId/subjects_with_topics |
| 3070 | `
                SELECT 
                    e.*,
                    t.topic_name,
            ...` | /api/plans/:planId/excluded-topics |
| 3495 | `SELECT s.subject_name, t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_...` | /api/plans/:planId/progress |
| 3648 | `SELECT id, subject_name FROM subjects WHERE study_plan_id = ?` | /api/plans/:planId/detailed_progress |
| 3956 | `SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_...` | /api/plans/:planId/realitycheck |

### topic.repository.js (10 queries)

| Linha | Query | Contexto |
|-------|-------|----------|
| 1462 | `INSERT INTO topics (subject_id, topic_name, priority_weight) VALUES (?,?,?)` | /api/plans/:planId/subjects_with_topics |
| 1516 | `DELETE FROM topics WHERE subject_id = ?` | /api/subjects/:subjectId |
| 1549 | `
                SELECT id, subject_id, topic_name, topic_name as description, status, completion_d...` | /api/plans/:planId/subjects_with_topics |
| 1595 | `SELECT id, topic_name, topic_name as description, status, completion_date, priority_weight FROM topi...` | /api/subjects/:subjectId/topics |
| 1829 | `DELETE FROM topics WHERE id = ?` | /api/topics/:topicId |
| 2084 | `DELETE FROM reta_final_excluded_topics WHERE plan_id = ?` | global |
| 2095 | `SELECT id FROM topics WHERE id = ?` | global |
| 2111 | `INSERT INTO reta_final_excluded_topics (plan_id, subject_id, topic_id, reason) VALUES (?, ?, ?, ?)` | global |
| 2126 | `DELETE FROM reta_final_excluded_topics WHERE plan_id = ?` | global |
| 2416 | `SELECT id FROM topics WHERE id IN (${placeholders})` | global |

## ⚠️ IMPORTANTE

**NÃO REMOVA NADA DO SERVER.JS AINDA!**

1. Revise os arquivos .new.js gerados
2. Teste cada repository individualmente
3. Integre com controllers gradualmente
4. Só remova do server.js após validação completa

## 🔍 PRÓXIMOS PASSOS

1. Revisar repositories gerados em src/repositories/*.new.js
2. Renomear .new.js para .js após revisão
3. Criar testes para cada repository
4. Integrar repositories nos controllers
5. Validar funcionamento completo
6. Só então remover queries do server.js
