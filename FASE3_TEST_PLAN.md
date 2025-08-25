# 🧪 PLANO DE TESTES - FASE 3 MIGRAÇÃO PLANOS

## 📋 ROTAS MIGRADAS PARA TESTAR

### ✅ CRUD BÁSICO DE PLANOS (5 rotas)

#### 1. **GET /api/plans** - Listar planos
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans
```
**Expect**: JSON com array de planos, study_hours_per_day parsed

#### 2. **POST /api/plans** - Criar plano
```bash
curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"plan_name": "Teste", "exam_date": "2025-12-01"}' \
     http://localhost:3000/api/plans
```
**Expect**: Status 201, newPlanId retornado

#### 3. **GET /api/plans/:id** - Obter plano
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1
```
**Expect**: JSON do plano específico

#### 4. **DELETE /api/plans/:id** - Deletar plano
```bash
curl -X DELETE -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1
```
**Expect**: CASCADE delete (sessions, topics, subjects)

#### 5. **PATCH /api/plans/:id/settings** - Configurações
```bash
curl -X PATCH -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"daily_question_goal": 50, "weekly_question_goal": 300, "session_duration_minutes": 60, "has_essay": false, "reta_final_mode": false, "study_hours_per_day": {"0": 0, "1": 4}}' \
     http://localhost:3000/api/plans/1/settings
```

### ✅ DISCIPLINAS E TÓPICOS (2 rotas)

#### 6. **POST /api/plans/:id/subjects_with_topics** - Criar disciplina
```bash
curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"subject_name": "Matemática", "priority_weight": 5, "topics_list": "Álgebra\nGeometria\nCálculo"}' \
     http://localhost:3000/api/plans/1/subjects_with_topics
```
**Expect**: Transação com subject + topics criados

#### 7. **GET /api/plans/:id/subjects_with_topics** - Listar com tópicos
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/subjects_with_topics
```
**Expect**: JSON com subjects e topics aninhados

### ✅ ESTATÍSTICAS E ANÁLISES (3 rotas)

#### 8. **GET /api/plans/:id/statistics** - Estatísticas
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/statistics
```
**Expect**: totalDays, currentStreak, totalPlannedHours

#### 9. **GET /api/plans/:id/exclusions** - Exclusões legado
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/exclusions
```

#### 10. **GET /api/plans/:id/excluded-topics** - Tópicos excluídos
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/excluded-topics
```

### ✅ GAMIFICAÇÃO E COMPARTILHAMENTO (2 rotas)

#### 11. **GET /api/plans/:id/gamification** - Gamificação
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/gamification
```
**Expect**: XP, level, achievements, dailyMissions

#### 12. **GET /api/plans/:id/share-progress** - Compartilhamento
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/plans/1/share-progress
```
**Expect**: Dados formatados para compartilhamento

## 🔧 SETUP DE TESTE

### 1. Iniciar servidor
```bash
cd "C:\Users\Gabriel\OneDrive\Área de Trabalho\Editaliza"
npm run dev
```

### 2. Obter token de auth
```bash
# Login
curl -X POST -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "123456"}' \
     http://localhost:3000/api/auth/login
```

### 3. Usar token nos testes
```bash
export TOKEN="your_jwt_token_here"
# ou no Windows
set TOKEN=your_jwt_token_here
```

## 🚨 PONTOS CRÍTICOS PARA VALIDAR

### ✅ Transações de Banco
1. **DELETE plan** deve apagar em cascata: sessions → topics → subjects → plans
2. **CREATE subject_with_topics** deve ser transacional
3. **Rollback** em caso de erro

### ✅ Validações
1. **numericId** deve rejeitar IDs inválidos
2. **date** deve validar exam_date
3. **jsonField** deve aceitar study_hours_per_day como objeto

### ✅ Segurança
1. **authenticateToken** deve bloquear sem auth
2. **Autorização** deve verificar user_id nas queries
3. **Sanitização** deve limpar inputs

### ✅ Funcionalidades
1. **JSON parsing** de study_hours_per_day
2. **Cache headers** no-cache aplicados
3. **Priority weight** normalização para int

## 📊 CHECKLIST DE REGRESSÃO

### Antes do Deploy
- [ ] Todas as 12 rotas respondem corretamente
- [ ] Transações funcionam sem memory leaks
- [ ] Headers de cache aplicados
- [ ] Validações bloqueiam inputs inválidos
- [ ] Autorização funciona corretamente
- [ ] Logs aparecem no console
- [ ] Performance sem degradação

### Após Deploy
- [ ] Frontend continua funcionando
- [ ] Cronograma não quebrou
- [ ] Gamificação atualiza
- [ ] Estatísticas calculam
- [ ] Nenhum erro 500 nos logs

## 🎯 COMANDOS RÁPIDOS

```bash
# Testar sintaxe
node -c src/controllers/plans.controller.js
node -c src/routes/plans.routes.js

# Verificar estrutura
npm run dev 2>&1 | grep -E "(Error|Cannot|Failed)"

# Logs em tempo real
tail -f logs/app.log # se existir
```

## 📝 NOTAS IMPORTANTES

1. **Duas rotas /api/plans**: As existentes + novas migradas
2. **Ordem de precedência**: Express processa na ordem de registro
3. **Compatibilidade**: Rotas antigas ainda funcionais
4. **Performance**: Sem impacto esperado
5. **Rollback**: Remover require das novas rotas se necessário

---

**PRÓXIMO**: Após validação desta fase, migrar rotas complexas (geração de cronograma, replan)