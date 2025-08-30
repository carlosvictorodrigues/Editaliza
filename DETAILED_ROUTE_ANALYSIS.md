# 📊 ANÁLISE DETALHADA DE ROTAS - EDITALIZA BACKEND

## 🎯 RESUMO EXECUTIVO

**Status Atual:** 47 rotas mapeadas no server.js (4400+ linhas)
**Fase Atual:** Migração modular em andamento (Fase 1 - Autenticação ✅)
**Próximas Fases:** Migração sistemática das rotas restantes por domínio

---

## 🗂️ INVENTÁRIO COMPLETO DE ROTAS

### 🔐 AUTENTICAÇÃO (JÁ MIGRADO - Fase 1 ✅)
- `POST /api/register` - Registro de usuários
- `POST /api/login` - Login com email/senha
- `GET /auth/google` - OAuth Google início
- `GET /auth/google/callback` - OAuth Google callback
- `GET /auth/session-token` - Token de sessão
- `GET /auth/google/status` - Status OAuth
- `POST /api/logout` - Logout de usuário
- `POST /api/request-password-reset` - Recuperação de senha
- `POST /api/reset-password` - Reset de senha
- `GET /api/csrf-token` - Token CSRF

### 👤 PERFIL DE USUÁRIO (Fase 2 - PRIORIDADE ALTA)
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/profile` | GET | 🟢 Baixa | authenticateToken, db queries | Baixo |
| `/api/profile` | PATCH | 🟡 Média | authenticateToken, validators, file upload | Médio - Upload de arquivos |
| `/api/profile/upload-photo` | POST | 🔴 Alta | multer, authenticateToken, file system | Alto - File handling |

**Dependências Críticas:**
- Multer para upload de arquivos
- Sistema de validação de arquivos
- Tratamento de erros de file system
- Middleware de autenticação

---

### 📚 PLANOS DE ESTUDO (Fase 3 - CORE BUSINESS)

#### 📋 CRUD Básico de Planos
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans` | GET | 🟢 Baixa | authenticateToken, JSON parsing | Baixo |
| `/api/plans` | POST | 🟡 Média | authenticateToken, validators | Médio |
| `/api/plans/:planId` | GET | 🟢 Baixa | authenticateToken, validators | Baixo |
| `/api/plans/:planId` | DELETE | 🔴 Alta | authenticateToken, transactions | **Alto - Cascading deletes** |
| `/api/plans/:planId/settings` | PATCH | 🟡 Média | authenticateToken, validators | Médio |

#### 🎯 GERAÇÃO DE CRONOGRAMAS (COMPLEXIDADE EXTREMA)
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/generate` | POST | 🔴🔴🔴 **EXTREMA** | Algoritmos complexos, transações | **CRÍTICO** |
| `/api/plans/:planId/replan-preview` | GET | 🔴 Alta | Algoritmos de previsão | Alto |
| `/api/plans/:planId/replan` | POST | 🔴🔴 Muito Alta | Algoritmos complexos, transações | **CRÍTICO** |

**⚠️ ALGORITMO DE GERAÇÃO DE CRONOGRAMAS - ANÁLISE CRÍTICA:**
- **700+ linhas de código complexo**
- **Round-robin ponderado por disciplina**
- **Modo "Reta Final" com exclusão de tópicos**
- **Cálculos de data brasileiro com timezone**
- **Transações de banco complexas**
- **Cache de datas disponíveis**
- **Algoritmo de distribuição inteligente**

**Dependências Ultra-Críticas:**
```javascript
// Funções auxiliares essenciais:
- getBrazilianDateString()
- getAvailableDates()
- findNextAvailableSlot()
- getNextSaturdayForReview()
- Round-robin ponderado
- Gestão de exclusões em modo reta final
```

---

### 📖 DISCIPLINAS E TÓPICOS (Fase 4 - MEDIUM PRIORITY)

#### 📚 Gerenciamento de Disciplinas
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/subjects` | GET | 🟢 Baixa | authenticateToken, validators | Baixo |
| `/api/plans/:planId/subjects_with_topics` | POST | 🟡 Média | Transações, bulk inserts | Médio |
| `/api/plans/:planId/subjects_with_topics` | GET | 🟡 Média | JOIN queries complexas | Médio |
| `/api/subjects/:subjectId` | PATCH | 🟢 Baixa | authenticateToken, validators | Baixo |
| `/api/subjects/:subjectId` | DELETE | 🔴 Alta | Cascading deletes | Alto |

#### 📝 Gerenciamento de Tópicos
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/subjects/:subjectId/topics` | GET | 🟢 Baixa | Basic queries | Baixo |
| `/api/topics/batch_update` | PATCH | 🔴 Alta | Bulk operations, transactions | **Alto** |
| `/api/topics/batch_update_details` | PATCH | 🔴 Alta | Complex bulk operations | **Alto** |
| `/api/topics/:topicId` | PATCH | 🟡 Média | Validators | Médio |
| `/api/topics/:topicId` | DELETE | 🔴 Alta | Cascading deletes | Alto |

**Dependências Críticas:**
- Sistema de transações para bulk operations
- Validação de dados em lote
- Gerenciamento de relacionamentos FK

---

### 📅 SESSÕES E CRONOGRAMAS (Fase 5 - CORE BUSINESS)

#### 🗓️ Gerenciamento de Sessões
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/schedule` | GET | 🟡 Média | Date handling, timezone | Médio |
| `/api/sessions/batch_update_status` | PATCH | 🔴 Alta | Bulk updates, validations | **Alto** |
| `/api/sessions/:sessionId/reinforce` | POST | 🟡 Média | Business logic | Médio |
| `/api/sessions/:sessionId` | PATCH | 🟡 Média | Status management | Médio |
| `/api/sessions/:sessionId/postpone` | PATCH | 🟡 Média | Date calculations | Médio |
| `/api/sessions/:sessionId/time` | POST | 🟡 Média | Time tracking | Médio |

#### 🔍 Verificações e Validações
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/overdue_check` | GET | 🟡 Média | Date calculations | Médio |
| `/api/plans/:planId/exclusions` | GET | 🟢 Baixa | Basic queries | Baixo |
| `/api/plans/:planId/excluded-topics` | GET | 🟢 Baixa | Basic queries | Baixo |

---

### 📊 ESTATÍSTICAS E MÉTRICAS (Fase 6 - ANALYTICS)

#### 📈 Análises de Progresso
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/statistics` | GET | 🔴🔴 Muito Alta | Complex SQL, CTEs recursivas | **Alto** |
| `/api/plans/:planId/progress` | GET | 🟡 Média | Aggregation queries | Médio |
| `/api/plans/:planId/goal_progress` | GET | 🟡 Média | Goal calculations | Médio |
| `/api/plans/:planId/question_radar` | GET | 🟡 Média | Radar chart data | Médio |
| `/api/plans/:planId/review_data` | GET | 🟡 Média | Review statistics | Médio |
| `/api/plans/:planId/detailed_progress` | GET | 🔴 Alta | Complex aggregations | Alto |
| `/api/plans/:planId/activity_summary` | GET | 🟡 Média | Activity tracking | Médio |
| `/api/plans/:planId/realitycheck` | GET | 🟡 Média | Reality check logic | Médio |
| `/api/plans/:planId/share-progress` | GET | 🟡 Média | Shareable statistics | Médio |

**⚠️ ROTA DE ESTATÍSTICAS - ANÁLISE CRÍTICA:**
- **CTEs recursivas para cálculo de streak**
- **Queries PostgreSQL avançadas**
- **Cálculos de média temporal**
- **Fallback para queries simplificadas**
- **Timezone brasileiro integrado**

---

### 🎮 GAMIFICAÇÃO (Fase 7 - ENGAGEMENT)

| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/api/plans/:planId/gamification` | GET | 🔴 Alta | Complex XP calculations, achievements | Alto |

**📊 SISTEMA DE GAMIFICAÇÃO - ANÁLISE:**
- **Sistema de níveis dinâmico (8 níveis)**
- **Cálculo de XP baseado em atividades**
- **Sistema de conquistas humorísticas**
- **Streaks de estudo consecutivos**
- **Títulos com humor brasileiro**

---

### 🔧 ADMINISTRAÇÃO (Fase 8 - ADMIN TOOLS)

| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/admin/email/status` | GET | 🟢 Baixa | Email service status | Baixo |
| `/admin/email/test` | POST | 🟡 Média | Email service integration | Médio |
| `/admin/email/reset-limits` | POST | 🟡 Média | Rate limit service | Médio |

### 🏥 SISTEMA DE SAÚDE
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/health` | GET | 🟢 Baixa | Basic status | Baixo |
| `/ready` | GET | 🟢 Baixa | Readiness check | Baixo |
| `/metrics` | GET | 🟢 Baixa | Basic metrics | Baixo |
| `/api/test-db` | GET | 🟢 Baixa | DB connection test | Baixo |

### 🌐 ARQUIVOS ESTÁTICOS
| Rota | Método | Complexidade | Dependências | Riscos |
|------|--------|-------------|--------------|--------|
| `/*` (arquivos estáticos) | GET | 🟢 Baixa | File system | Baixo |
| `/` (index) | GET | 🟢 Baixa | Static serving | Baixo |

---

## 🔍 ANÁLISE DE DEPENDÊNCIAS CRÍTICAS

### 📦 MIDDLEWARES ESSENCIAIS
```javascript
// Middleware de segurança
- authenticateToken (usado em 35+ rotas)
- validators.* (validação de entrada)
- handleValidationErrors
- sanitizeMiddleware
- rate limiting específico

// Middleware de arquivo
- multer (upload de fotos)
- bodyParser/express.json

// Middleware de sessão
- session management
- CSRF protection
```

### 🗄️ DEPENDÊNCIAS DE BANCO
```javascript
// Funções de banco críticas
- dbGet() - queries simples
- dbAll() - queries múltiplas  
- dbRun() - execução/updates
- Transações (BEGIN/COMMIT/ROLLBACK)
- PostgreSQL specific queries (CTEs, JOINs)
```

### 🛠️ UTILIDADES CRÍTICAS
```javascript
// Funções auxiliares essenciais
- getBrazilianDateString() (timezone brasileiro)
- fetchTopicsWithSubjects() (otimização)
- fetchSessionsWithRelatedData() (otimização)
- executeCachedQuery() (cache)
- Email service integration
- Rate limiting service
```

---

## ⚠️ ANÁLISE DE RISCOS POR CATEGORIA

### 🔴 RISCOS CRÍTICOS (Atenção Máxima)
1. **Geração de Cronogramas** (`/api/plans/:planId/generate`)
   - 700+ linhas de algoritmo complexo
   - Transações críticas
   - Lógica de negócio fundamental
   - **RISCO: Alta probabilidade de quebra**

2. **Batch Operations** (`/api/topics/batch_update*`, `/api/sessions/batch_update_status`)
   - Operações em lote no banco
   - Transações complexas
   - **RISCO: Corrupção de dados**

3. **Cascading Deletes** (`DELETE /api/plans/:planId`, `DELETE /api/subjects/:subjectId`)
   - Exclusões em cascata
   - Múltiplas tabelas afetadas
   - **RISCO: Perda de dados**

### 🟡 RISCOS MÉDIOS (Cuidado)
1. **Upload de Arquivos** (`/api/profile/upload-photo`)
   - File system operations
   - **RISCO: Falhas de upload**

2. **Estatísticas Complexas** (`/api/plans/:planId/statistics`)
   - CTEs recursivas
   - **RISCO: Performance issues**

3. **Timezone Handling** (várias rotas)
   - Cálculos de data brasileiro
   - **RISCO: Problemas de fuso horário**

### 🟢 RISCOS BAIXOS (Monitoramento)
- CRUDs simples
- Queries básicas
- Rotas de status

---

## 🎯 PLANO DE MIGRAÇÃO RECOMENDADO

### 📅 CRONOGRAMA ESTRATÉGICO

#### **FASE 2: PERFIL DE USUÁRIO** (1-2 dias)
- **Prioridade:** ALTA (dependência de autenticação)
- **Complexidade:** Média
- **Riscos:** Upload de arquivos

```bash
Arquivos alvo:
- src/routes/profileRoutes.js
- src/controllers/profileController.js
- src/middleware/uploadMiddleware.js (multer)
```

#### **FASE 3: PLANOS BÁSICOS** (2-3 dias)
- **Prioridade:** ALTA (core business)
- **Complexidade:** Média
- **Riscos:** Transações

```bash
Arquivos alvo:
- src/routes/planRoutes.js
- src/controllers/planController.js
- Manter geração de cronograma no server.js temporariamente
```

#### **FASE 4: DISCIPLINAS E TÓPICOS** (2-3 dias)
- **Prioridade:** MÉDIA
- **Complexidade:** Média-Alta
- **Riscos:** Bulk operations

```bash
Arquivos alvo:
- src/routes/subjectRoutes.js
- src/routes/topicRoutes.js
- src/controllers/subjectController.js
- src/controllers/topicController.js
```

#### **FASE 5: SESSÕES E CRONOGRAMAS** (1-2 dias)
- **Prioridade:** ALTA
- **Complexidade:** Média
- **Riscos:** Date handling

```bash
Arquivos alvo:
- src/routes/sessionRoutes.js
- src/controllers/sessionController.js
- src/utils/dateUtils.js
```

#### **FASE 6: ESTATÍSTICAS** (2-3 dias)
- **Prioridade:** MÉDIA
- **Complexidade:** Alta
- **Riscos:** Performance

```bash
Arquivos alvo:
- src/routes/statisticsRoutes.js
- src/controllers/statisticsController.js
- src/services/analyticsService.js
```

#### **FASE 7: GAMIFICAÇÃO** (1 dia)
- **Prioridade:** BAIXA
- **Complexidade:** Média
- **Riscos:** Baixo

```bash
Arquivos alvo:
- src/routes/gamificationRoutes.js
- src/controllers/gamificationController.js
- src/services/achievementService.js
```

#### **FASE 8: ADMINISTRAÇÃO** (1 dia)
- **Prioridade:** BAIXA
- **Complexidade:** Baixa
- **Riscos:** Baixo

```bash
Arquivos alvo:
- src/routes/adminRoutes.js
- src/controllers/adminController.js
```

#### **FASE 9: GERAÇÃO DE CRONOGRAMAS** (3-5 dias) ⚠️
- **Prioridade:** CRÍTICA
- **Complexidade:** EXTREMA
- **Riscos:** MÁXIMO

```bash
⚠️ ATENÇÃO ESPECIAL - ÚLTIMA FASE
Arquivos alvo:
- src/services/scheduleGenerationService.js
- src/utils/algorithmUtils.js
- src/utils/dateCalculationUtils.js
- Testes extensivos obrigatórios
```

---

## 📋 CHECKLIST PRÉ-MIGRAÇÃO

### ✅ Antes de Cada Fase:
- [ ] Backup completo do banco de dados
- [ ] Testes locais funcionando
- [ ] Identificar todas as dependências
- [ ] Mapear todos os middlewares utilizados
- [ ] Verificar imports e exports
- [ ] Documentar edge cases conhecidos

### ✅ Durante a Migração:
- [ ] Preservar TODA lógica existente
- [ ] Manter middlewares de segurança
- [ ] Não alterar validações
- [ ] Preservar tratamento de erros
- [ ] Manter logs de debug
- [ ] Testes unitários para cada rota

### ✅ Após Cada Fase:
- [ ] Commit com mensagem descritiva
- [ ] Deploy de teste
- [ ] Verificação funcional completa
- [ ] Rollback plan documentado
- [ ] Atualização da documentação

---

## 📊 MÉTRICAS DE COMPLEXIDADE

### 📈 Por Domínio de Negócio:
| Domínio | Rotas | Complexidade Média | Riscos |
|---------|-------|-------------------|--------|
| Autenticação | 10 | 🟡 Média | ✅ Migrado |
| Perfil | 3 | 🟡 Média | Upload files |
| Planos | 5 | 🟡 Média | Transações |
| **Geração Cronograma** | 3 | 🔴🔴🔴 EXTREMA | **CRÍTICO** |
| Disciplinas/Tópicos | 9 | 🟡 Média-Alta | Bulk ops |
| Sessões | 6 | 🟡 Média | Date handling |
| Estatísticas | 9 | 🔴 Alta | Complex SQL |
| Gamificação | 1 | 🔴 Alta | Algorithms |
| Admin | 3 | 🟢 Baixa | Service deps |

### 🎯 Estimativa de Esforço Total:
- **Horas estimadas:** 40-60 horas
- **Dias úteis:** 8-12 dias
- **Fases críticas:** 2 (Geração de cronograma + Estatísticas)
- **Rotas de risco:** 8 rotas

---

## 🚨 ALERTAS CRÍTICOS PARA O DESENVOLVEDOR

### ⚠️ NÃO SIMPLIFIQUE NADA
- O algoritmo de geração de cronograma tem 700+ linhas por um motivo
- Cada validação existe por necessidade de segurança
- Timezone brasileiro é crítico para o negócio
- Rate limiting é essencial para produção

### ⚠️ MANTENHA TODA COMPLEXIDADE
- Round-robin ponderado é necessário
- Modo "Reta Final" é feature solicitada pelos usuários
- Cálculos de XP são balanceados
- Fallbacks nas queries existem por estabilidade

### ⚠️ PRESERVE RELACIONAMENTOS
- Foreign keys entre tabelas são críticas
- Cascading deletes são intencionais
- Transações garantem consistência
- Cache otimiza performance real

### ⚠️ TESTES SÃO OBRIGATÓRIOS
- Cada rota migrada DEVE ser testada
- Edge cases são reais e já foram encontrados
- Rollback deve estar sempre pronto
- Dados de produção são insubstituíveis

---

## 📞 SUPORTE E EMERGÊNCIA

### 🆘 Se Algo Der Errado:
1. **ROLLBACK IMEDIATO** - `git reset --hard HEAD~1`
2. **RESTAURAR BANCO** - backup pré-migração
3. **VERIFICAR LOGS** - `pm2 logs editaliza-app`
4. **COMUNICAR STATUS** - usuários podem ser afetados

### 📱 Comandos de Emergência:
```bash
# Rollback do código
git reset --hard <commit-seguro>

# Restart da aplicação  
pm2 restart editaliza-app

# Verificar status
curl https://app.editaliza.com.br/health
```

---

**🎯 CONCLUSÃO:** Este é um sistema maduro e complexo em produção. Cada linha de código existe por um motivo. A migração deve ser CAUTELOSA, SISTEMÁTICA e REVERSÍVEL a qualquer momento.

**👨💻 LEMBRE-SE:** Você está mexendo no coração de um sistema que serve usuários reais estudando para concursos. Um erro pode impactar sonhos e carreiras.

**🚀 PRÓXIMOS PASSOS:** Começar pela Fase 2 (Perfil), seguir o cronograma proposto, testar TUDO, e deixar a geração de cronogramas por último.

---
**Documento criado em:** 24/08/2025  
**Última atualização:** 24/08/2025  
**Versão:** 1.0 - Análise Completa Inicial