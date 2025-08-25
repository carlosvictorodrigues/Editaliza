# 📋 PLANO DE MIGRAÇÃO - FASE 1: PADRONIZAÇÃO E CONSOLIDAÇÃO

## 🔍 ANÁLISE ATUAL DO SISTEMA

### Estrutura Existente:
```
✅ JÁ MODULARIZADO:
/src
  /config      - Configurações (passport, database, environment)
  /controllers - Lógica de negócio parcial
  /routes      - Rotas parciais (auth, plans, users, schedules)
  /services    - Serviços (email, auth, OAuth)
  /middleware  - Middlewares de segurança
  /utils       - Utilitários diversos

❌ PROBLEMAS IDENTIFICADOS:
1. ROTAS DUPLICADAS:
   - /api/login existe em server.js (linha 783) E em authRoutes.js
   - /api/register existe em server.js (linha 738) E em authRoutes.js
   - Rotas OAuth em múltiplos lugares

2. INCONSISTÊNCIA DE ROTAS:
   - Algumas usam /api/auth/* (modular)
   - Outras usam /api/* (legado)
   - OAuth usa /auth/* (sem /api)

3. SERVER.JS MONOLÍTICO:
   - 4400+ linhas
   - Lógica misturada com configuração
   - Rotas legadas hardcoded
```

## 🎯 OBJETIVO DA FASE 1

**Padronizar TODAS as rotas sem quebrar NADA**, consolidando a estrutura modular existente.

## 📝 TAREFAS DETALHADAS

### 1. CRIAR MAPA DE ROTAS COMPLETO
```javascript
// AUTENTICAÇÃO (conflito detectado)
POST /api/login          → MOVER PARA → POST /api/auth/login
POST /api/register        → MOVER PARA → POST /api/auth/register  
POST /api/logout          → MOVER PARA → POST /api/auth/logout
GET  /api/csrf-token      → MOVER PARA → GET  /api/auth/csrf-token
POST /api/request-password-reset → MOVER PARA → POST /api/auth/password/request
POST /api/reset-password  → MOVER PARA → POST /api/auth/password/reset
GET  /auth/google         → MOVER PARA → GET  /api/auth/google
GET  /auth/google/callback → MOVER PARA → GET /api/auth/google/callback
GET  /auth/session-token  → MOVER PARA → GET  /api/auth/session-token
GET  /auth/google/status  → MOVER PARA → GET  /api/auth/google/status

// PERFIL
GET  /api/profile         → MOVER PARA → GET  /api/users/profile
POST /api/profile/upload-photo → MOVER PARA → POST /api/users/profile/photo

// PLANOS (já modularizado em /api/plans)
✅ GET    /api/plans
✅ POST   /api/plans
✅ GET    /api/plans/:id
✅ DELETE /api/plans/:id
✅ GET    /api/plans/:id/subjects
✅ POST   /api/plans/:id/subjects_with_topics
✅ GET    /api/plans/:id/subjects_with_topics
✅ POST   /api/plans/:id/generate
✅ GET    /api/plans/:id/replan-preview
✅ POST   /api/plans/:id/replan
✅ GET    /api/plans/:id/exclusions
✅ GET    /api/plans/:id/excluded-topics
✅ GET    /api/plans/:id/statistics
✅ GET    /api/plans/:id/overdue_check
✅ GET    /api/plans/:id/progress
✅ GET    /api/plans/:id/goal_progress
✅ GET    /api/plans/:id/question_radar
✅ GET    /api/plans/:id/review_data
✅ GET    /api/plans/:id/detailed_progress
✅ GET    /api/plans/:id/activity_summary
✅ GET    /api/plans/:id/realitycheck
✅ GET    /api/plans/:id/gamification
✅ GET    /api/plans/:id/share-progress

// CRONOGRAMAS
GET  /api/plans/:id/schedule → MOVER PARA → GET /api/schedules/:planId
POST /api/sessions/:id/reinforce → MOVER PARA → POST /api/schedules/sessions/:id/reinforce
POST /api/sessions/:id/time → MOVER PARA → POST /api/schedules/sessions/:id/time

// DISCIPLINAS E TÓPICOS
DELETE /api/subjects/:id → MOVER PARA → DELETE /api/plans/subjects/:id
GET    /api/subjects/:id/topics → MOVER PARA → GET /api/plans/subjects/:id/topics
DELETE /api/topics/:id → MOVER PARA → DELETE /api/plans/topics/:id
```

### 2. RESOLVER CONFLITOS DE ROTAS

#### A. Remover rotas duplicadas do server.js:
- [ ] Comentar rotas legadas que já existem em módulos
- [ ] Adicionar redirecionamentos temporários (301) das rotas antigas
- [ ] Manter log de rotas deprecadas

#### B. Consolidar authRoutes.js:
- [ ] Adicionar rotas faltantes (csrf-token, password reset)
- [ ] Padronizar validações e rate limiting
- [ ] Garantir compatibilidade com frontend

### 3. CRIAR SISTEMA DE COMPATIBILIDADE

```javascript
// compatibility.middleware.js
const routeCompatibility = (req, res, next) => {
    // Mapa de rotas antigas para novas
    const routeMap = {
        '/api/login': '/api/auth/login',
        '/api/register': '/api/auth/register',
        '/auth/google': '/api/auth/google',
        // ... todas as rotas
    };
    
    if (routeMap[req.path]) {
        console.log(`[DEPRECATED] Route ${req.path} → Redirecting to ${routeMap[req.path]}`);
        req.url = routeMap[req.path];
    }
    next();
};
```

### 4. ATUALIZAR FRONTEND

#### Arquivos a atualizar:
- [ ] login.html - `/api/login` → `/api/auth/login`
- [ ] register.html - `/api/register` → `/api/auth/register`
- [ ] forgot-password.html - rotas de password
- [ ] reset-password.html - rotas de password
- [ ] app.js - todas as chamadas de API
- [ ] Outros arquivos HTML com fetch

### 5. CRIAR TESTES DE VALIDAÇÃO

```javascript
// test-route-migration.js
const routes = [
    { old: '/api/login', new: '/api/auth/login', method: 'POST' },
    { old: '/api/register', new: '/api/auth/register', method: 'POST' },
    // ... todas as rotas
];

// Testar que ambas funcionam durante migração
// Testar que antiga redireciona para nova
// Testar que nova responde corretamente
```

## 📊 MÉTRICAS DE SUCESSO

1. **Zero Downtime** - Sistema continua funcionando durante migração
2. **100% Compatibilidade** - Todas as rotas antigas continuam funcionando
3. **Logs Claros** - Saber exatamente quais rotas estão sendo usadas
4. **Performance** - Não degradar tempo de resposta
5. **Segurança** - Manter todas as proteções (CSRF, rate limiting, etc)

## 🔧 ORDEM DE EXECUÇÃO

### DIA 1 - Preparação (2-3 horas)
1. Backup completo do sistema
2. Criar branch `feature/route-standardization`
3. Implementar sistema de logging detalhado
4. Criar middleware de compatibilidade

### DIA 2 - Migração Backend (3-4 horas)
1. Consolidar rotas de autenticação
2. Remover duplicações do server.js
3. Adicionar redirecionamentos
4. Testar todas as rotas

### DIA 3 - Migração Frontend (2-3 horas)
1. Atualizar todas as chamadas de API
2. Testar login/registro/OAuth
3. Validar fluxos completos

### DIA 4 - Validação (1-2 horas)
1. Executar suite de testes
2. Monitorar logs em produção
3. Coletar métricas de uso

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Quebrar login | Baixa | Alto | Testes extensivos + rollback rápido |
| OAuth parar | Média | Alto | Manter rotas antigas temporariamente |
| Frontend desync | Média | Médio | Deploy coordenado front+back |
| Rate limiting falhar | Baixa | Médio | Manter configurações duplicadas |

## 📈 BENEFÍCIOS ESPERADOS

1. **Manutenibilidade**: Código 70% mais organizado
2. **Debugging**: Problemas localizados em módulos específicos
3. **Escalabilidade**: Fácil adicionar novas features
4. **Testabilidade**: Cada módulo testado isoladamente
5. **Performance**: Menos código carregado por request
6. **Segurança**: Validações centralizadas e consistentes

## 🚀 PRÓXIMOS PASSOS

Após conclusão da Fase 1:
- **Fase 2**: Migrar lógica de negócio restante do server.js
- **Fase 3**: Implementar testes automatizados completos
- **Fase 4**: Otimizar performance e caching
- **Fase 5**: Documentação completa da API

---

**Status**: PRONTO PARA INICIAR
**Tempo estimado**: 8-12 horas
**Complexidade**: Alta
**Risco**: Médio (com mitigações adequadas)