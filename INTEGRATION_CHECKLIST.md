# 📋 CHECKLIST DE INTEGRAÇÃO - CRONOGRAMA.HTML

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

-- Tabela study_sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    subject_name VARCHAR(255) NOT NULL,
    topic_description TEXT,
    session_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Pendente',
    scheduled_date DATE,
    time_studied_seconds INTEGER DEFAULT 0,
    questions_solved INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela topic_exclusions (para Reta Final)
CREATE TABLE IF NOT EXISTS topic_exclusions (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES study_plans(id),
    subject_name VARCHAR(255),
    topic_description TEXT,
    priority_combined INTEGER,
    exclusion_date DATE,
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

-- Inserir sessões de estudo
INSERT INTO study_sessions (plan_id, subject_name, topic_description, session_type, status, scheduled_date) VALUES 
(1, 'Português', 'Concordância Verbal', 'Novo Tópico', 'Pendente', '2025-08-29'),
(1, 'Matemática', 'Geometria Plana', 'Revisão Consolidada', 'Pendente', '2025-08-29'),
(1, 'Direito', 'Direito Constitucional', 'Novo Tópico', 'Pendente', '2025-08-30'),
(1, 'História', 'Brasil Colonial', 'Novo Tópico', 'Concluído', '2025-08-28');
```

## 🧪 Comandos para Rodar Testes

```bash
# Instalar dependências
npm install

# Rodar testes de API (Supertest)
npm test tests/api/cronograma-endpoints.test.js

# Rodar testes E2E (Playwright)
npx playwright test tests/e2e/cronograma.spec.js

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
- [ ] Nome do plano exibido corretamente
- [ ] Data da prova exibida
- [ ] Sessões carregadas e agrupadas por data

### 2. Filtros
- [ ] Filtro "Esta Semana" funciona
- [ ] Filtro "Este Mês" funciona
- [ ] Filtro "Tudo" funciona
- [ ] Filtro ativo fica destacado

### 3. Interações com Sessões
- [ ] Checkbox marca sessão como concluída
- [ ] Toast de sucesso aparece
- [ ] Status persiste após reload
- [ ] Botão "Adiar" abre modal
- [ ] Adiar para próximo dia funciona
- [ ] Adiar em 7 dias funciona
- [ ] Botão "Reforçar" cria nova sessão

### 4. Tarefas Atrasadas
- [ ] Alerta aparece se houver tarefas atrasadas
- [ ] Contador mostra número correto
- [ ] Botão "Replanejar" redistribui tarefas
- [ ] Alerta desaparece após replanejamento

### 5. Exportação
- [ ] Botão abre modal de exportação
- [ ] Links do Google Calendar funcionam
- [ ] Download de arquivo .ics funciona
- [ ] Período de exportação pode ser alterado

### 6. Modo Reta Final (se ativo)
- [ ] Badge aparece no cabeçalho
- [ ] Seção de transparência é exibida
- [ ] Contador de tópicos excluídos correto
- [ ] Relatório detalhado abre em modal
- [ ] Export CSV funciona
- [ ] Toggle minimizar/expandir funciona

### 7. Tratamento de Erros
- [ ] Erro 401 redireciona para login
- [ ] Erro 404 mostra mensagem apropriada
- [ ] Erro 500 mostra toast de erro
- [ ] Falha de rede mostra mensagem

## 📊 Fluxo Request → Response → UI

### Exemplo: Marcar Sessão como Concluída

1. **UI Action**: User clicks checkbox
2. **Request**:
   ```javascript
   PATCH /api/sessions/123
   Authorization: Bearer <token>
   Content-Type: application/json
   
   {
     "status": "Concluído"
   }
   ```

3. **Backend Processing**:
   - Validate JWT token
   - Validate session ownership
   - Update database
   - Return response

4. **Response**:
   ```json
   {
     "success": true,
     "message": "Status atualizado com sucesso"
   }
   ```

5. **UI Update**:
   - Show success toast
   - Update checkbox state
   - Apply visual feedback (opacity/strikethrough)
   - Invalidate plan cache for statistics

## 🔍 Logs Importantes

### Backend Logs
```javascript
console.log('[AUTH] User ${userId} accessing plan ${planId}');
console.log('[CTRL] Updating session ${sessionId} status to ${status}');
console.log('[DB] Query executed in ${duration}ms');
```

### Frontend Logs
```javascript
console.log('[CRONOGRAMA] Loading plan data');
console.error('[CRONOGRAMA] API error:', error);
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
- **Cache**: Plan data é cacheado no frontend por 5 minutos
- **Rate Limiting**: API tem limite de 100 requests/minuto por IP
- **Session Timeout**: 24 horas
- **CORS**: Configurado para permitir localhost:3000 em dev