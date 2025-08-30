# 📋 CHECKLIST DE INTEGRAÇÃO - PLAN.HTML

## ✅ Variáveis de Ambiente Necessárias

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=editaliza_db
DB_USER=editaliza_user
DB_PASSWORD=1a2b3c4d

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Session
SESSION_SECRET=your_session_secret_here

# Server
PORT=3000
NODE_ENV=development

# Optional
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=your_sendgrid_key
```

## 📦 Dependências NPM

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "supertest": "^6.3.3",
    "jest": "^29.7.0"
  }
}
```

## 🗄️ Estrutura do Banco de Dados

### Tabelas Necessárias:

```sql
-- Tabela users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela study_plans
CREATE TABLE IF NOT EXISTS study_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_name VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    reta_final_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela gamification_stats
CREATE TABLE IF NOT EXISTS gamification_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    study_streak INTEGER DEFAULT 0,
    total_study_days INTEGER DEFAULT 0,
    experience_points INTEGER DEFAULT 0,
    level VARCHAR(100) DEFAULT 'Iniciante',
    achievements JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela subjects
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    name VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 1,
    estimated_hours NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela topics
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Pendente',
    weight INTEGER DEFAULT 1,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela study_sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    topic_id INTEGER REFERENCES topics(id),
    session_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Pendente',
    scheduled_date DATE,
    time_studied_seconds INTEGER DEFAULT 0,
    questions_solved INTEGER DEFAULT 0,
    accuracy NUMERIC(3,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela weekly_goals
CREATE TABLE IF NOT EXISTS weekly_goals (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    week_number INTEGER,
    week_label VARCHAR(50),
    target_topics INTEGER DEFAULT 21,
    achieved_topics INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela review_progress
CREATE TABLE IF NOT EXISTS review_progress (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    subject_id INTEGER REFERENCES subjects(id),
    total_questions INTEGER DEFAULT 0,
    solved_questions INTEGER DEFAULT 0,
    accuracy NUMERIC(3,2),
    last_review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🌱 Dados de Seed para Testes

```sql
-- Inserir usuário de teste
INSERT INTO users (email, password_hash, name) VALUES 
('test@editaliza.com', '$2b$10$YourHashedPasswordHere', 'Usuário Teste');

-- Inserir plano de estudo
INSERT INTO study_plans (user_id, plan_name, exam_date, reta_final_mode) VALUES 
(1, 'Concurso TJ-PE 2025', '2025-03-15', false);

-- Inserir estatísticas de gamificação
INSERT INTO gamification_stats (user_id, study_streak, total_study_days, experience_points, level) VALUES 
(1, 5, 20, 1500, 'Aspirante a Servidor(a) 🌱');

-- Inserir disciplinas
INSERT INTO subjects (plan_id, name, priority, estimated_hours) VALUES 
(1, 'Português', 1, 50),
(1, 'Matemática', 2, 40),
(1, 'Direito Constitucional', 1, 60),
(1, 'Informática', 3, 30);

-- Inserir tópicos
INSERT INTO topics (subject_id, description, status, weight) VALUES 
(1, 'Concordância Verbal', 'Concluído', 3),
(1, 'Regência Nominal', 'Pendente', 2),
(2, 'Geometria Plana', 'Concluído', 2),
(2, 'Álgebra Linear', 'Pendente', 3);

-- Inserir metas semanais
INSERT INTO weekly_goals (plan_id, week_number, week_label, target_topics, achieved_topics, start_date, end_date) VALUES 
(1, 1, 'Semana 1', 21, 15, '2025-08-26', '2025-09-01'),
(1, 2, 'Semana 2', 21, 20, '2025-09-02', '2025-09-08');

-- Inserir progresso de revisão
INSERT INTO review_progress (plan_id, subject_id, total_questions, solved_questions, accuracy) VALUES 
(1, 1, 100, 50, 0.80),
(1, 2, 150, 75, 0.75);
```

## 🧪 Comandos para Rodar Testes

```bash
# Instalar dependências
npm install

# Rodar testes de API (Supertest)
npm test tests/api/plan-endpoints.test.js

# Rodar testes E2E (Playwright)
npx playwright test tests/e2e/plan.spec.js

# Rodar todos os testes
npm test

# Rodar testes com coverage
npm run test:coverage
```

## ✅ Checklist de Validação Manual

### 1. Carregamento Inicial
- [ ] Página carrega sem erros no console
- [ ] Token JWT presente no localStorage/cookie
- [ ] Plan ID obtido da URL ou localStorage
- [ ] Nome do plano exibido no header
- [ ] Todos os dashboards carregam corretamente

### 2. Dashboard de Gamificação
- [ ] Sequência de estudos (streak) exibida
- [ ] XP total exibido corretamente
- [ ] Nível do concurseiro visível
- [ ] Conquistas listadas (se houver)
- [ ] Tópicos concluídos contador correto
- [ ] Sessões completas contador correto

### 3. Dashboard de Cronograma
- [ ] Fase atual exibida (Aprendizado/Revisão/Reta Final)
- [ ] Progresso de tópicos (X de Y) correto
- [ ] Contador de simulados (direcionados/gerais)
- [ ] Contador de revisões programadas
- [ ] Ciclos de revisão indicados

### 4. Dashboard de Performance
- [ ] Status exibido (on-track/off-track/completed)
- [ ] Cor do status correta (verde/vermelho/azul)
- [ ] Projeção de conclusão calculada
- [ ] Adiamentos contabilizados
- [ ] Média diária de progresso exibida
- [ ] Link "Regenerar Cronograma" aparece quando 100% completo

### 5. Progresso Detalhado (Accordion)
- [ ] Lista todas as disciplinas
- [ ] Accordion expande ao clicar
- [ ] Accordion colapsa ao clicar novamente
- [ ] Progress bar para cada disciplina
- [ ] Porcentagem de conclusão correta
- [ ] Horas estimadas exibidas
- [ ] Tópicos concluídos/total corretos

### 6. Metas Semanais
- [ ] Metas da semana atual destacadas
- [ ] Progresso semanal exibido
- [ ] Média diária calculada
- [ ] Meta vs Realizado comparação

### 7. Dados de Revisão
- [ ] Total de questões exibido
- [ ] Progresso de questões por data
- [ ] Estatísticas por disciplina
- [ ] Taxa de acerto (accuracy) exibida

### 8. Tratamento de Erros
- [ ] Erro 401 redireciona para login
- [ ] Erro 404 mostra mensagem apropriada
- [ ] Erro 500 mostra botão "Tentar Novamente"
- [ ] Botão retry funciona para gamificação
- [ ] Botão retry funciona para performance check
- [ ] Falha de rede mostra mensagem

### 9. Responsividade
- [ ] Layout adapta em mobile
- [ ] Cards empilham verticalmente
- [ ] Texto legível em telas pequenas
- [ ] Botões tocáveis em mobile

## 📊 Fluxo Request → Response → UI

### Exemplo: Carregar Dashboard de Performance

1. **UI Init**: Page load triggers loadPerformanceCheck()
2. **Request**:
   ```javascript
   GET /api/plans/1/realitycheck
   Authorization: Bearer <token>
   ```

3. **Backend Processing**:
   - Validate JWT token
   - Check plan ownership
   - Calculate metrics
   - Determine status (on-track/off-track/completed)
   - Return response

4. **Response**:
   ```json
   {
     "status": "on-track",
     "completedTopics": 25,
     "totalTopics": 100,
     "daysRemaining": 60,
     "averageDailyProgress": 2.5,
     "postponementCount": 2,
     "isMaintenanceMode": false,
     "shouldRegenerateForSimulations": false,
     "projectedCompletion": "2025-03-01"
   }
   ```

5. **UI Update**:
   - Apply status color class (.on-track/.off-track/.completed)
   - Display metrics in cards
   - Show/hide regenerate link based on status
   - Update progress indicators

## 🔍 Logs Importantes

### Backend Logs
```javascript
console.log('[PLAN] Loading plan ${planId} for user ${userId}');
console.log('[GAMIFICATION] Calculating stats for user ${userId}');
console.log('[PERFORMANCE] Reality check for plan ${planId}');
console.log('[PROGRESS] Detailed analysis for ${subjects.length} subjects');
```

### Frontend Logs
```javascript
console.log('[PLAN] Initializing dashboard');
console.log('[PLAN] Loading gamification data');
console.error('[PLAN] API error:', error);
```

## 🚀 Deploy Checklist

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados com schema atualizado
- [ ] Migrations executadas
- [ ] Seeds aplicados (se necessário)
- [ ] Testes passando
- [ ] Build de produção gerado
- [ ] Logs configurados
- [ ] Monitoring ativo
- [ ] Backup do banco configurado

## 📝 Notas Adicionais

- **Timezone**: Sistema usa horário de Brasília (UTC-3)
- **Cache**: Dashboard data é cacheado no frontend por 5 minutos
- **Rate Limiting**: API tem limite de 100 requests/minuto por IP
- **Session Timeout**: 24 horas
- **CORS**: Configurado para permitir localhost:3000 em dev

## 🔄 Endpoints da API

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/api/plans/:planId` | Detalhes do plano | ✅ |
| GET | `/api/gamification/profile` | Perfil de gamificação | ✅ |
| GET | `/api/plans/:planId/schedule_preview` | Preview do cronograma | ✅ |
| GET | `/api/plans/:planId/realitycheck` | Check de performance | ✅ |
| GET | `/api/plans/:planId/goal_progress` | Progresso de metas | ✅ |
| GET | `/api/plans/:planId/review_data` | Dados de revisão | ✅ |
| GET | `/api/plans/:planId/detailed_progress` | Progresso detalhado | ✅ |

## 🎯 Métricas de Sucesso

- **Tempo de carregamento**: < 2 segundos
- **Taxa de erro**: < 1%
- **Disponibilidade**: > 99.9%
- **Cobertura de testes**: > 80%
- **Performance Score (Lighthouse)**: > 90