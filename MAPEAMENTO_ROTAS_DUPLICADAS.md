# 📋 MAPEAMENTO DE ROTAS DUPLICADAS

**Data:** 25/08/2025
**Hora:** 08:29:33

## 📊 ESTATÍSTICAS GERAIS

- **Total de rotas em server.js:** 56
- **Total de rotas modulares:** 71
- **Rotas duplicadas:** 26
- **Taxa de duplicação:** 46.4%

## 🔄 ROTAS DUPLICADAS

| Rota | server.js (linha) | Arquivo Modular (linha) | Ação Recomendada |
|------|------------------|------------------------|------------------|
| `GET /api/profile` | L1016 | src/routes/profile.routes.js L44 | Remover de server.js |
| `PATCH /api/profile` | L1067 | src/routes/profile.routes.js L53 | Remover de server.js |
| `GET /api/plans/:planId` | L1326 | src/routes/plans.routes.js L61 | Remover de server.js |
| `DELETE /api/plans/:planId` | L1365 | src/routes/plans.routes.js L73 | Remover de server.js |
| `PATCH /api/plans/:planId/settings` | L1392 | src/routes/plans.routes.js L85 | Remover de server.js |
| `POST /api/plans/:planId/subjects_with_topics` | L1436 | src/routes/plans.routes.js L107 | Remover de server.js |
| `PATCH /api/subjects/:subjectId` | L1477 | src/routes/subjects.routes.js L53 | Remover de server.js |
| `DELETE /api/subjects/:subjectId` | L1500 | src/routes/subjects.routes.js L70 | Remover de server.js |
| `GET /api/plans/:planId/subjects_with_topics` | L1528 | src/routes/plans.routes.js L122 | Remover de server.js |
| `GET /api/subjects/:subjectId/topics` | L1583 | src/routes/topics.routes.js L29 | Remover de server.js |
| `PATCH /api/topics/batch_update` | L1608 | src/routes/topics.routes.js L49 | Remover de server.js |
| `PATCH /api/topics/batch_update_details` | L1701 | src/routes/topics.routes.js L85 | Remover de server.js |
| `PATCH /api/topics/:topicId` | L1761 | src/routes/topics.routes.js L115 | Remover de server.js |
| `DELETE /api/topics/:topicId` | L1804 | src/routes/topics.routes.js L135 | Remover de server.js |
| `POST /api/plans/:planId/generate` | L1845 | src/routes/schedule.routes.js L52 | Remover de server.js |
| `GET /api/plans/:planId/exclusions` | L3005 | src/routes/plans.routes.js L186 | Remover de server.js |
| `GET /api/plans/:planId/excluded-topics` | L3055 | src/routes/plans.routes.js L198 | Remover de server.js |
| `GET /api/plans/:planId/statistics` | L3133 | src/routes/plans.routes.js L174 | Remover de server.js |
| `GET /api/plans/:planId/overdue_check` | L3273 | src/routes/sessions.routes.js L163 | Remover de server.js |
| `GET /api/plans/:planId/schedule` | L3294 | src/routes/sessions.routes.js L162 | Remover de server.js |
| `PATCH /api/sessions/batch_update_status` | L3323 | src/routes/sessions.routes.js L159 | Remover de server.js |
| `POST /api/sessions/:sessionId/reinforce` | L3371 | src/routes/sessions.routes.js L139 | Remover de server.js |
| `PATCH /api/sessions/:sessionId` | L3398 | src/routes/sessions.routes.js L97 | Remover de server.js |
| `PATCH /api/sessions/:sessionId/postpone` | L3430 | src/routes/sessions.routes.js L111 | Remover de server.js |
| `POST /api/sessions/:sessionId/time` | L4031 | src/routes/sessions.routes.js L125 | Remover de server.js |
| `GET /api/plans/:planId/share-progress` | L4077 | src/routes/plans.routes.js L226 | Remover de server.js |

## 📌 ROTAS ÚNICAS EM SERVER.JS

| Rota | Linha | Ação Recomendada |
|------|-------|------------------|
| `GET /${file}` | L160 | Mover para api.routes.js |
| `POST /api/profile/upload-photo` | L426 | Mover para users.routes.js |
| `POST /api/register` | L738 | Mover para auth.routes.js |
| `POST /api/login` | L799 | Mover para auth.routes.js |
| `GET /auth/google` | L842 | Mover para auth.routes.js |
| `GET /auth/google/callback` | L847 | Mover para auth.routes.js |
| `GET /auth/session-token` | L879 | Mover para auth.routes.js |
| `GET /auth/google/status` | L895 | Mover para auth.routes.js |
| `POST /api/logout` | L908 | Mover para api.routes.js |
| `POST /api/request-password-reset` | L918 | Mover para api.routes.js |
| `POST /api/reset-password` | L993 | Mover para api.routes.js |
| `GET /api/test-db` | L1249 | Mover para api.routes.js |
| `GET /api/plans` | L1269 | Mover para plans.routes.js |
| `POST /api/plans` | L1303 | Mover para plans.routes.js |
| `GET /api/plans/:planId/replan-preview` | L2551 | Mover para plans.routes.js |
| `POST /api/plans/:planId/replan` | L2712 | Mover para plans.routes.js |
| `GET /api/plans/:planId/progress` | L3487 | Mover para plans.routes.js |
| `GET /api/plans/:planId/goal_progress` | L3528 | Mover para plans.routes.js |
| `GET /api/plans/:planId/question_radar` | L3561 | Mover para plans.routes.js |
| `GET /api/plans/:planId/review_data` | L3589 | Mover para plans.routes.js |
| `GET /api/plans/:planId/detailed_progress` | L3636 | Mover para plans.routes.js |
| `GET /api/plans/:planId/activity_summary` | L3877 | Mover para plans.routes.js |
| `GET /api/plans/:planId/realitycheck` | L3945 | Mover para plans.routes.js |
| `GET /` | L4192 | Mover para api.routes.js |
| `GET /health` | L4198 | Mover para api.routes.js |
| `GET /ready` | L4213 | Mover para api.routes.js |
| `GET /metrics` | L4218 | Mover para api.routes.js |
| `GET /admin/email/status` | L4246 | Mover para admin.routes.js |
| `POST /admin/email/test` | L4266 | Mover para admin.routes.js |
| `POST /admin/email/reset-limits` | L4295 | Mover para admin.routes.js |
