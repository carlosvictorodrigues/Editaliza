# 📋 PLANO DE INTEGRAÇÃO FRONTEND-BACKEND - SISTEMA EDITALIZA

## 📊 STATUS ATUAL

- **Backend:** ✅ 9 fases migradas (100% modularizado)
- **Frontend:** ⚠️ Desincronizado com novas rotas
- **Criticidade:** 🔴 ALTA - Funcionalidades quebradas

## 🎯 RESUMO EXECUTIVO

### Problemas Críticos Identificados:
1. **Perfil não carrega** - Rota `/profile` sem `/api/users`
2. **Cronograma quebrado** - Usa `/api/schedules` em vez de `/api/sessions`
3. **Sessões falham** - Ações sem prefixo `/api`
4. **Auth inconsistente** - Mistura fetch direto com apiFetch

### Impacto:
- **30% das funcionalidades** com rotas incorretas
- **4 páginas principais** afetadas
- **10+ arquivos JS** precisam correção

## 📋 PLANO DE INTEGRAÇÃO EM 7 FASES

### FASE 1: AUTENTICAÇÃO (2-4h) 🔴 CRÍTICO
**Arquivos:** login.html, register.html, forgot-password.html, reset-password.html
```javascript
// Correções:
fetch('/auth/session-token') → app.apiFetch('/api/auth/session-token')
'/api/login' → '/api/auth/login'
'/api/register' → '/api/auth/register'
```

### FASE 2: PERFIL (1-2h) 🔴 CRÍTICO
**Arquivos:** home.html, profile.html, components.js
```javascript
// Correções:
app.apiFetch("/profile") → app.apiFetch("/api/users/profile")
app.apiFetch("/api/profile") → app.apiFetch("/api/users/profile")
```

### FASE 3: SESSÕES (3-5h) 🔴 CRÍTICO
**Arquivos:** cronograma.html, home.html
```javascript
// Correções:
"/api/schedules/${planId}" → "/api/sessions/by-date/${planId}"
"/sessions/${id}/reinforce" → "/api/sessions/${id}/reinforce"
"/sessions/${id}/postpone" → "/api/sessions/${id}/postpone"
```

### FASE 4: PADRONIZAÇÃO (2-3h) 🟡 ALTO
**Problema:** Mistura de fetch() direto com app.apiFetch()
```javascript
// Padronizar TODAS as chamadas:
fetch('/api/...') → app.apiFetch('/api/...')
```

### FASE 5: INTERCEPTADORES (4-6h) 🟢 MÉDIO
**Implementar em app.js:**
- Renovação automática de token
- Retry em falhas de rede
- Logging centralizado
- Cache inteligente

### FASE 6: TRATAMENTO DE ERROS (2-3h) 🟢 MÉDIO
- Sistema padronizado de notificações
- Loading states consistentes
- Error boundaries

### FASE 7: LIMPEZA (3-4h) 🔵 BAIXO
- Remover arquivos de teste não utilizados
- Limpar código comentado
- Otimizar chamadas duplicadas

## 📊 MAPEAMENTO COMPLETO DE ROTAS

### ✅ ROTAS CORRETAS (Já funcionando)
| Frontend | Backend | Status |
|----------|---------|--------|
| `/api/auth/login` | `/api/auth/login` | ✅ OK |
| `/api/auth/register` | `/api/auth/register` | ✅ OK |
| `/api/plans` | `/api/plans` | ✅ OK |
| `/api/plans/:id/statistics` | `/api/plans/:id/statistics` | ✅ OK |

### ❌ ROTAS INCORRETAS (Precisam correção)
| Frontend Atual | Backend Correto | Prioridade |
|----------------|-----------------|------------|
| `/profile` | `/api/users/profile` | 🔴 CRÍTICO |
| `/api/profile` | `/api/users/profile` | 🔴 CRÍTICO |
| `/api/schedules/:id` | `/api/sessions/by-date/:id` | 🔴 CRÍTICO |
| `/sessions/:id/reinforce` | `/api/sessions/:id/reinforce` | 🔴 CRÍTICO |
| `/sessions/:id/postpone` | `/api/sessions/:id/postpone` | 🔴 CRÍTICO |

## 🚀 ESTRATÉGIA DE EXECUÇÃO

### Semana 1 (Crítico)
- [ ] FASE 1: Autenticação
- [ ] FASE 2: Perfil
- [ ] FASE 3: Sessões

### Semana 2 (Otimizações)
- [ ] FASE 4: Padronização
- [ ] FASE 5: Interceptadores

### Semana 3 (Finalização)
- [ ] FASE 6: Tratamento de Erros
- [ ] FASE 7: Limpeza

## 📈 MÉTRICAS DE SUCESSO

- **100% das rotas** sincronizadas
- **0 erros 404** em produção
- **< 500ms** tempo de resposta médio
- **100% cobertura** de tratamento de erros

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Quebra de funcionalidades em produção | ALTO | Deploy gradual com feature flags |
| Incompatibilidade com cache do browser | MÉDIO | Forçar limpeza de cache |
| Perda de dados em formulários | BAIXO | Implementar auto-save |

## 📝 CHECKLIST PRÉ-DEPLOY

### Para cada fase:
- [ ] Testes locais completos
- [ ] Validação em staging
- [ ] Backup dos arquivos originais
- [ ] Monitoramento de erros ativo
- [ ] Plano de rollback preparado

## 🔧 COMANDOS ÚTEIS

```bash
# Encontrar todas as chamadas de API no frontend
grep -r "apiFetch\|fetch(" public/ js/ --include="*.html" --include="*.js"

# Validar rotas do backend
npm run test:routes

# Iniciar servidor em modo debug
DEBUG=* npm start

# Monitorar logs em tempo real
tail -f logs/app-*.log | grep -i error
```

## 📅 CRONOGRAMA

- **Início:** 25/08/2025
- **Fase 1-3:** 25-26/08 (2 dias)
- **Fase 4-5:** 27-28/08 (2 dias)
- **Fase 6-7:** 29-30/08 (2 dias)
- **Testes finais:** 31/08-01/09 (2 dias)
- **Deploy:** 02/09/2025

## 👥 RESPONSABILIDADES

- **Frontend:** Correção de rotas e chamadas API
- **Backend:** Garantir compatibilidade e disponibilidade
- **QA:** Validação de cada fase
- **DevOps:** Deploy gradual e monitoramento

---

**Última atualização:** 25/08/2025
**Status:** 🟡 EM ANDAMENTO
**Próxima ação:** Iniciar FASE 1 - Autenticação