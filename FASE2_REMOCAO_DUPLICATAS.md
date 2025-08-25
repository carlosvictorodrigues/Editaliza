# 📋 FASE 2 - RELATÓRIO DE REMOÇÃO DE DUPLICATAS

**Data:** 25/08/2025
**Hora:** 08:35:58

## 📊 RESUMO

- **Total de rotas processadas:** 26
- **Rotas removidas com sucesso:** 25
- **Rotas mantidas (falha):** 1
- **Taxa de sucesso:** 96.2%

## ✅ ROTAS REMOVIDAS

| Rota | Módulo | Linhas Removidas |
|------|--------|------------------|
| GET /api/profile | profile.routes.js | 49 |
| PATCH /api/profile | profile.routes.js | 173 |
| GET /api/plans/:planId | plans.routes.js | 37 |
| DELETE /api/plans/:planId | plans.routes.js | 26 |
| PATCH /api/plans/:planId/settings | plans.routes.js | 33 |
| POST /api/plans/:planId/subjects_with_topics | plans.routes.js | 37 |
| PATCH /api/subjects/:subjectId | subjects.routes.js | 22 |
| DELETE /api/subjects/:subjectId | subjects.routes.js | 27 |
| GET /api/plans/:planId/subjects_with_topics | plans.routes.js | 52 |
| GET /api/subjects/:subjectId/topics | topics.routes.js | 24 |
| PATCH /api/topics/batch_update | topics.routes.js | 89 |
| PATCH /api/topics/batch_update_details | topics.routes.js | 59 |
| PATCH /api/topics/:topicId | topics.routes.js | 42 |
| DELETE /api/topics/:topicId | topics.routes.js | 37 |
| POST /api/plans/:planId/generate | schedule.routes.js | 662 |
| GET /api/plans/:planId/exclusions | plans.routes.js | 46 |
| GET /api/plans/:planId/excluded-topics | plans.routes.js | 73 |
| GET /api/plans/:planId/statistics | plans.routes.js | 130 |
| GET /api/plans/:planId/overdue_check | sessions.routes.js | 19 |
| PATCH /api/sessions/batch_update_status | sessions.routes.js | 45 |
| POST /api/sessions/:sessionId/reinforce | sessions.routes.js | 25 |
| PATCH /api/sessions/:sessionId | sessions.routes.js | 29 |
| PATCH /api/sessions/:sessionId/postpone | sessions.routes.js | 55 |
| POST /api/sessions/:sessionId/time | sessions.routes.js | 40 |
| GET /api/plans/:planId/share-progress | plans.routes.js | 75 |

## ⚠️ ROTAS MANTIDAS (REQUEREM ATENÇÃO)

| Rota | Módulo | Razão |
|------|--------|-------|
| GET /api/plans/:planId/schedule | sessions.routes.js | Módulo não está respondendo corretamente |

## 📈 IMPACTO

- **Linhas removidas do server.js:** 1906
- **Redução estimada:** ~44.6% das duplicações

## 🔍 PRÓXIMOS PASSOS

1. Investigar rotas que falharam
2. Verificar configuração dos módulos
3. Testar funcionalidades no frontend
4. Prosseguir para FASE 3 (Extração de SQL)

## 📝 LOGS DE TESTE

```
GET /api/profile: REMOVIDA 
PATCH /api/profile: REMOVIDA 
GET /api/plans/:planId: REMOVIDA 
DELETE /api/plans/:planId: REMOVIDA 
PATCH /api/plans/:planId/settings: REMOVIDA 
POST /api/plans/:planId/subjects_with_topics: REMOVIDA 
PATCH /api/subjects/:subjectId: REMOVIDA 
DELETE /api/subjects/:subjectId: REMOVIDA 
GET /api/plans/:planId/subjects_with_topics: REMOVIDA 
GET /api/subjects/:subjectId/topics: REMOVIDA 
PATCH /api/topics/batch_update: REMOVIDA 
PATCH /api/topics/batch_update_details: REMOVIDA 
PATCH /api/topics/:topicId: REMOVIDA 
DELETE /api/topics/:topicId: REMOVIDA 
POST /api/plans/:planId/generate: REMOVIDA 
GET /api/plans/:planId/exclusions: REMOVIDA 
GET /api/plans/:planId/excluded-topics: REMOVIDA 
GET /api/plans/:planId/statistics: REMOVIDA 
GET /api/plans/:planId/overdue_check: REMOVIDA 
GET /api/plans/:planId/schedule: MANTIDA (Módulo não funcional)
PATCH /api/sessions/batch_update_status: REMOVIDA 
POST /api/sessions/:sessionId/reinforce: REMOVIDA 
PATCH /api/sessions/:sessionId: REMOVIDA 
PATCH /api/sessions/:sessionId/postpone: REMOVIDA 
POST /api/sessions/:sessionId/time: REMOVIDA 
GET /api/plans/:planId/share-progress: REMOVIDA 
```
