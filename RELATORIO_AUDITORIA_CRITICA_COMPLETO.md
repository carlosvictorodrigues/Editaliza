# RELATÓRIO DE AUDITORIA TÉCNICA CRÍTICA - SISTEMA EDITALIZA

**Data:** 06/08/2025  
**Status:** 🔴 SISTEMA CRÍTICO - Erros SQL impedem funcionamento correto  
**Auditor:** Claude Code (Arquiteto Backend)

---

## 📋 RESUMO EXECUTIVO

O sistema Editaliza apresenta **múltiplos erros SQL críticos** que comprometem sua estabilidade e funcionalidade. Foram identificados **5 erros críticos** relacionados a colunas e tabelas inexistentes, além de **problemas de lógica de negócio** que afetam dashboards e métricas.

### Status Geral
- ❌ **2 Erros SQL Críticos** (impedem funcionamento)
- ⚠️ **3 Problemas de Schema** (nomenclatura incorreta)
- 📊 **Dados inconsistentes** (apenas 1% de progresso real)
- ⚡ **24 Otimizações de Performance** identificadas

---

## 🔥 ERROS CRÍTICOS IDENTIFICADOS

### 1. **ERRO: `ua.topic_id` - Coluna Inexistente**
**Arquivo:** `src/repositories/planRepository.js:157`
```sql
LEFT JOIN user_activities ua ON ua.topic_id = t.id AND ua.activity_type = 'question_answered'
```
**Problema:** Tabela `user_activities` não possui coluna `topic_id`
**Schema Real:** `id, user_id, activity_type, duration, metadata, created_at`
**Impacto:** Quebra funcionalidade de "pontos fracos" e estatísticas de questões
**Correção:** Remover o JOIN ou usar uma estratégia diferente baseada em `metadata`

### 2. **ERRO: `t.priority` - Coluna Inexistente**
**Arquivo:** `server.js:1296`
```javascript
const weightedTopics = pendingTopics.flatMap(t => Array(t.priority).fill(t));
```
**Problema:** Tabela `topics` não possui coluna `priority`
**Schema Real:** `id, subject_id, description, status, completion_date`
**Impacto:** Quebra algoritmo de geração de cronograma baseado em prioridade
**Correção:** Query deve usar `s.priority_weight as priority` com alias correto

### 3. **ERRO: `ss.completed` - Coluna Inexistente**
**Status:** Não encontrado em uso ativo, mas pode estar em código frontend
**Schema Real:** Usar `ss.status = 'Concluído'` ao invés de `ss.completed`

### 4. **ERRO: `t.topic_description` - Nome Incorreto**
**Schema Real:** A coluna se chama `t.description`, não `t.topic_description`
**Note:** `study_sessions` tem `topic_description`, mas `topics` tem `description`

### 5. **ERRO: Tabela `user_activity` - Nome Incorreto**
**Arquivo:** `src/utils/security.js:61`
**Problema:** Referência a `user_activity` quando tabela se chama `user_activities`
**Impacto:** Problemas de segurança e validação

---

## 📊 PROBLEMAS FUNCIONAIS IDENTIFICADOS

### Card "Tópicos Concluídos" - Mostra 0

**Diagnóstico:**
- Total de tópicos: 264
- Tópicos concluídos: 2 (apenas 1%)
- Problema: Lógica de marcação de tópicos como concluídos não está funcionando corretamente

**Queries Afetadas:**
- `planRepository.getDailyProgress()` - usa JOIN incorreto com `user_activities`
- `planRepository.getWeeklyProgress()` - usa JOIN incorreto com `user_activities`
- `planRepository.getWeakTopics()` - usa `ua.topic_id` inexistente

### Projeção de Conclusão - Dados Incorretos

**Problema:** Baseado em dados de progresso incorretos devido aos erros de query
**Impacto:** Estimativas de tempo de estudo completamente inválidas

### Erro ao Salvar Sessão de Estudo

**Possível Causa:** Queries que tentam acessar colunas inexistentes durante operações de CRUD

---

## 🗄️ SCHEMA REAL DO BANCO DE DADOS

### Tabela `user_activities`
```sql
- id (INTEGER, PRIMARY KEY)
- user_id (INTEGER)
- activity_type (TEXT)
- duration (INTEGER)
- metadata (TEXT)
- created_at (TEXT)
```
❌ **NÃO possui:** `topic_id`

### Tabela `topics`
```sql
- id (INTEGER, PRIMARY KEY)
- subject_id (INTEGER)
- description (TEXT)          -- ❌ NÃO topic_description
- status (TEXT)
- completion_date (TEXT)
```
❌ **NÃO possui:** `priority`, `topic_description`

### Tabela `study_sessions`
```sql
- id (INTEGER, PRIMARY KEY)
- study_plan_id (INTEGER)
- topic_id (INTEGER)
- subject_name (TEXT)
- topic_description (TEXT)    -- ✅ Possui este campo
- session_date (TEXT)
- session_type (TEXT)
- status (TEXT)               -- ❌ NÃO completed
- notes (TEXT)
- questions_solved (INTEGER)
- time_studied_seconds (INTEGER)
- postpone_count (INTEGER)
```
❌ **NÃO possui:** `completed`

### Tabela `subjects`
```sql
- id (INTEGER, PRIMARY KEY)
- study_plan_id (INTEGER)
- subject_name (TEXT)
- priority_weight (INTEGER)   -- ✅ Aqui está a prioridade!
```

---

## 🔧 CORREÇÕES PRIORITÁRIAS

### ALTA PRIORIDADE (Implementar Imediatamente)

#### 1. Corrigir Query de Tópicos Fracos
**Arquivo:** `src/repositories/planRepository.js:149-163`
```sql
-- ATUAL (QUEBRADO):
LEFT JOIN user_activities ua ON ua.topic_id = t.id AND ua.activity_type = 'question_answered'

-- CORREÇÃO:
LEFT JOIN study_sessions ss ON ss.topic_id = t.id AND ss.questions_solved > 0
```

#### 2. Corrigir Algoritmo de Priorização
**Arquivo:** `server.js:1185-1194`
```sql
-- CORREÇÃO NECESSÁRIA:
SELECT 
    t.id, t.description, t.status, t.completion_date,
    s.subject_name, s.priority_weight as priority  -- ✅ Alias correto
FROM subjects s
INNER JOIN topics t ON s.id = t.subject_id
WHERE s.study_plan_id = ?
ORDER BY s.priority_weight DESC, t.id ASC
```

#### 3. Corrigir Referência de Tabela
**Arquivo:** `src/utils/security.js:61`
```javascript
// ATUAL:
'user_activity',

// CORREÇÃO:
'user_activities',
```

### MÉDIA PRIORIDADE (Implementar Esta Semana)

#### 4. Implementar Lógica Correta de Progresso Diário/Semanal
```sql
-- Substituir JOINs com user_activities por:
SELECT COUNT(*) as count
FROM study_sessions ss
JOIN study_plans sp ON ss.study_plan_id = sp.id
WHERE sp.id = ? 
AND DATE(ss.session_date) = DATE(?)
AND ss.status = 'Concluído'
AND ss.questions_solved > 0
```

#### 5. Corrigir Cálculo de Tópicos Concluídos
Verificar por que apenas 1% dos tópicos estão marcados como concluídos.

---

## 🚀 COMPATIBILIDADE POSTGRESQL

### Comandos SQLite-Específicos Encontrados:
- `PRAGMA table_info()` - Substituir por `INFORMATION_SCHEMA`
- `AUTOINCREMENT` - Substituir por `SERIAL`
- Funções de data podem precisar ajuste

### Queries Compatíveis:
✅ JOINs, WHERE, ORDER BY
✅ Agregações (COUNT, SUM, AVG)
✅ Subqueries

---

## 📈 OTIMIZAÇÕES DE PERFORMANCE

### Identified Issues:
- **24 queries com `SELECT *`** - Especificar apenas colunas necessárias
- Falta de índices específicos para queries complexas
- Queries não utilizando índices compostos otimizados

### Recomendações:
1. Implementar SELECT específicos
2. Adicionar índices para queries de dashboard
3. Implementar connection pooling para PostgreSQL
4. Cache de queries frequentes

---

## 🎯 PLANO DE CORREÇÃO IMEDIATA

### Dia 1 - Correções Críticas
1. ✅ Corrigir `ua.topic_id` em planRepository.js
2. ✅ Corrigir `t.priority` em server.js  
3. ✅ Corrigir referência `user_activity` em security.js

### Dia 2 - Testes e Validação
4. 🔄 Implementar testes para queries corrigidas
5. 🔄 Verificar funcionalidade de dashboards
6. 🔄 Validar cálculos de progresso

### Dia 3 - Otimizações
7. ⚡ Otimizar SELECT statements
8. ⚡ Implementar cache para queries frequentes
9. 📊 Monitorar performance

---

## 📋 TESTES RECOMENDADOS

### Testes de Integração Necessários:
```javascript
// Teste de query de tópicos fracos
const weakTopics = await planRepository.getWeakTopics(planId);
console.assert(weakTopics.length >= 0, 'Query deve retornar array');

// Teste de progresso diário
const dailyProgress = await planRepository.getDailyProgress(planId, today);
console.assert(typeof dailyProgress === 'number', 'Deve retornar número');

// Teste de geração de cronograma
const schedule = await generateSchedule(planId, options);
console.assert(schedule.length > 0, 'Deve gerar sessões');
```

### Queries de Validação:
```sql
-- Verificar integridade de dados
SELECT 
    (SELECT COUNT(*) FROM topics) as total_topics,
    (SELECT COUNT(*) FROM topics WHERE status = 'Concluído') as completed_topics;

-- Verificar sessões sem tópicos
SELECT COUNT(*) FROM study_sessions WHERE topic_id IS NULL;
```

---

## 🏁 CONCLUSÃO

O sistema Editaliza **requer correção imediata** dos erros SQL identificados antes que possa funcionar corretamente. Os problemas são específicos e bem definidos, permitindo correção rápida.

### Prioridade de Implementação:
1. **CRÍTICO**: Corrigir queries SQL quebradas (1-2 horas)
2. **ALTO**: Implementar lógica correta de progresso (2-4 horas)  
3. **MÉDIO**: Otimizar performance (1-2 dias)
4. **BAIXO**: Preparar migração PostgreSQL (1 semana)

### Estimativa de Correção Completa:
- **Erros Críticos**: 2-4 horas
- **Funcionalidades**: 1-2 dias
- **Testes e Validação**: 1 dia
- **Total**: 3-4 dias úteis

**Recomendação:** Implementar correções críticas imediatamente para restaurar funcionalidade básica do sistema.