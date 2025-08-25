# 📋 MAPEAMENTO FRONTEND → BACKEND
**Data:** 25/08/2025 12:00  
**Objetivo:** Mapear TODAS as chamadas do frontend para garantir sincronização

## 🔄 PROTOCOLO DE VALIDAÇÃO
Para CADA rota:
1. ✅ Verificar se frontend está chamando
2. ✅ Testar no backend (curl/Postman)
3. ✅ Testar no navegador (Network tab)
4. ✅ Validar com usuário real

## 📊 TABELA DE MAPEAMENTO

| Frontend (HTML/JS) | Rota Chamada | Método | Status | Controller | Repository |
|-------------------|--------------|---------|---------|------------|------------|
| **dashboard.html** |
| L364 | `/api/plans` | GET | ✅ Modular | plans.controller | planRepo |
| L447 | `/api/plans/${id}` | DELETE | ✅ Modular | plans.controller | planRepo |
| L534 | `/api/plans` | POST | ✅ Modular | plans.controller | planRepo |
| **cronograma.html** |
| L319 | `/api/plans/${id}` | GET | ✅ Modular | plans.controller | planRepo |
| L338 | `/api/plans/${id}/overdue_check` | GET | ⚠️ Server.js | - | - |
| L356 | `/api/plans` | GET | ✅ Modular | plans.controller | planRepo |
| L388 | `/api/sessions/by-date/${id}` | GET | ✅ Modular | sessions.controller | sessionRepo |
| L472 | `/api/sessions/${id}` | PUT | ✅ Modular | sessions.controller | sessionRepo |
| L495 | `/api/sessions/${id}` | PUT | ✅ Modular | sessions.controller | sessionRepo |
| L509 | `/api/sessions/${id}` | PUT | ✅ Modular | sessions.controller | sessionRepo |
| L536 | `/api/sessions/${id}/reinforce` | POST | ⚠️ Server.js | - | - |
| L551 | `/api/sessions/${id}/postpone` | POST | ⚠️ Server.js | - | - |
| L570 | `/api/plans/${id}/replan` | POST | ⚠️ Server.js | - | - |
| L690 | `/api/plans/${id}/exclusions` | GET | ⚠️ Server.js | - | - |
| **app.js** |
| L171 | `/api/csrf-token` | GET | ✅ Modular | auth.middleware | - |
| L276 | `/api/logout` | POST | ✅ Modular | auth.controller | userRepo |
| L290 | `/api/plans` | GET | ✅ Modular | plans.controller | planRepo |
| L338 | `/api/plans/${id}/${dataType}` | GET | ⚠️ Vários | - | - |
| L349 | `/api/plans/${id}/gamification` | GET | ⚠️ Server.js | - | - |

## 🔴 ROTAS AINDA NO SERVER.JS

### Alta Prioridade (usadas frequentemente):
1. `/api/plans/:planId/overdue_check` - Verificação de atrasos
2. `/api/sessions/:sessionId/reinforce` - Reforço de sessão
3. `/api/sessions/:sessionId/postpone` - Adiar sessão
4. `/api/plans/:planId/replan` - Replanejar cronograma
5. `/api/plans/:planId/exclusions` - Exclusões reta final

### Média Prioridade:
6. `/api/plans/:planId/gamification` - Dados de gamificação
7. `/api/plans/:planId/${dataType}` - Dados variados (statistics, progress, etc)

## 🟢 ROTAS JÁ MODULARIZADAS

### Controllers Completos:
- ✅ **auth.controller.js** - Login, registro, logout, OAuth
- ✅ **plans.controller.js** - CRUD básico de planos
- ✅ **sessions.controller.js** - Gestão de sessões
- ✅ **subjects.controller.js** - Disciplinas
- ✅ **topics.controller.js** - Tópicos

### Parcialmente Migrados:
- ⚠️ **statistics.controller.js** - Faltam algumas rotas
- ⚠️ **admin.controller.js** - Faltam rotas administrativas

## 📝 ESTRATÉGIA DE MIGRAÇÃO

### FASE 4.1 - Integrar Repositories (ATUAL)
1. ✅ Criar DatabaseAdapter
2. ✅ Integrar repositories no server.js
3. ⏳ Substituir queries diretas pelos repositories

### FASE 4.2 - Migrar Rotas Críticas
1. [ ] `/api/plans/:planId/overdue_check` → planRepo.getOverdueSessions()
2. [ ] `/api/sessions/:sessionId/reinforce` → sessionRepo.markForReinforcement()
3. [ ] `/api/sessions/:sessionId/postpone` → sessionRepo.postponeSession()
4. [ ] `/api/plans/:planId/replan` → Criar replanService
5. [ ] `/api/plans/:planId/exclusions` → topicRepo.getExcludedTopics()

### FASE 4.3 - Services Layer
1. [ ] **ReplanService** - Lógica complexa de replanejamento
2. [ ] **GamificationService** - Cálculos de XP e achievements
3. [ ] **StatisticsService** - Agregações e dashboards
4. [ ] **NotificationService** - Sistema de notificações

## ⚠️ PONTOS DE ATENÇÃO

### Frontend usando rotas antigas:
- `cronograma_fixed.html` usa `/plans/` ao invés de `/api/plans/`
- Alguns arquivos JS têm URLs hardcoded

### Validações necessárias:
1. **Autenticação:** Todas as rotas precisam do authMiddleware
2. **CSRF:** Token deve estar presente em todas as requisições POST/PUT/DELETE
3. **Ownership:** Validar que usuário é dono do recurso

## 🧪 CHECKLIST DE TESTE

Para CADA rota migrada:
- [ ] Funciona no Postman/curl
- [ ] Frontend consegue chamar
- [ ] Resposta tem mesmo formato
- [ ] Performance não degradou
- [ ] Logs não mostram erros
- [ ] Usuário real consegue usar

## 📊 MÉTRICAS DE PROGRESSO

- **Total de rotas:** ~50
- **Modularizadas:** 30 (60%)
- **No server.js:** 20 (40%)
- **Meta:** 100% modularizadas

---
*Documento atualizado a cada migração*