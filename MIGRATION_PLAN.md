# 🗄️ Plano de Migração para PostgreSQL - Editaliza

## 📋 Visão Geral

Este documento define quando e como migrar do SQLite para PostgreSQL quando o projeto atingir a escala necessária.

## 🎯 Critérios de Migração

### **Indicadores de Performance**
- [ ] **Usuários simultâneos**: >1000
- [ ] **Usuários totais**: >10.000
- [ ] **Queries lentas**: >2s em média
- [ ] **Locks frequentes**: >5% das operações
- [ ] **Crescimento**: >50% ao mês

### **Indicadores de Negócio**
- [ ] **Sistema de assinatura**: Implementado
- [ ] **Relatórios avançados**: Necessários
- [ ] **Analytics em tempo real**: Requerido
- [ ] **Backup automático**: Crítico

## 🏗️ Arquitetura Proposta

### **Estrutura do PostgreSQL**
```sql
-- Tabelas principais (migradas do SQLite)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    profile_picture TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE study_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_name VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    study_hours_per_day JSONB,
    daily_question_goal INTEGER DEFAULT 50,
    weekly_question_goal INTEGER DEFAULT 300,
    session_duration_minutes INTEGER DEFAULT 50,
    review_mode VARCHAR(50) DEFAULT 'completo',
    postponement_count INTEGER DEFAULT 0,
    has_essay BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    study_plan_id INTEGER REFERENCES study_plans(id),
    subject_name VARCHAR(255) NOT NULL,
    priority_weight INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id),
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    completion_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE study_sessions (
    id SERIAL PRIMARY KEY,
    study_plan_id INTEGER REFERENCES study_plans(id),
    topic_id INTEGER REFERENCES topics(id),
    subject_name VARCHAR(255) NOT NULL,
    topic_description TEXT NOT NULL,
    session_date DATE NOT NULL,
    session_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    notes TEXT,
    questions_solved INTEGER DEFAULT 0,
    time_studied_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Novas tabelas para funcionalidades avançadas
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    price_cents INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    features JSONB,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Processo de Migração

### **Fase 1: Preparação (1-2 semanas)**
```bash
# 1. Instalar dependências PostgreSQL
npm install pg pg-pool

# 2. Configurar variáveis de ambiente
DATABASE_URL=postgresql://user:password@localhost:5432/editaliza
DB_HOST=localhost
DB_NAME=editaliza
DB_USER=editaliza_user
DB_PASSWORD=secure_password

# 3. Criar script de migração
node scripts/migrate-to-postgres.js
```

### **Fase 2: Migração de Dados (1 dia)**
```javascript
// scripts/migrate-to-postgres.js
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');

async function migrateData() {
    // 1. Conectar ao SQLite
    const sqliteDb = new sqlite3.Database('./db.sqlite');
    
    // 2. Conectar ao PostgreSQL
    const pgPool = new Pool({
        connectionString: process.env.DATABASE_URL
    });
    
    // 3. Migrar tabelas
    const tables = ['users', 'study_plans', 'subjects', 'topics', 'study_sessions'];
    
    for (const table of tables) {
        console.log(`Migrando tabela ${table}...`);
        await migrateTable(sqliteDb, pgPool, table);
    }
    
    console.log('✅ Migração concluída!');
}

async function migrateTable(sqliteDb, pgPool, tableName) {
    return new Promise((resolve, reject) => {
        sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
            if (err) return reject(err);
            
            for (const row of rows) {
                const columns = Object.keys(row).join(', ');
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                
                await pgPool.query(
                    `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                    values
                );
            }
            
            resolve();
        });
    });
}
```

### **Fase 3: Atualização do Código (1 semana)**
```javascript
// database.js - Nova versão com PostgreSQL
const { Pool } = require('pg');

class Database {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    
    async query(text, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }
    
    async get(text, params) {
        const result = await this.query(text, params);
        return result.rows[0];
    }
    
    async all(text, params) {
        const result = await this.query(text, params);
        return result.rows;
    }
}
```

### **Fase 4: Testes e Validação (1 semana)**
```bash
# 1. Testes unitários
npm test

# 2. Testes de integração
npm run test:integration

# 3. Testes de performance
npm run test:performance

# 4. Validação de dados
node scripts/validate-migration.js
```

### **Fase 5: Deploy (1 dia)**
```bash
# 1. Backup final do SQLite
cp db.sqlite db_backup_final.sqlite

# 2. Deploy com PostgreSQL
./deploy-production.sh

# 3. Verificação pós-deploy
./deploy-production.sh health-check
```

## 🔧 Configurações Recomendadas

### **PostgreSQL Production**
```sql
-- Configurações de performance
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Índices otimizados
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX idx_subjects_study_plan_id ON subjects(study_plan_id);
CREATE INDEX idx_topics_subject_id ON topics(subject_id);
CREATE INDEX idx_sessions_plan_date ON study_sessions(study_plan_id, session_date);
```

### **Connection Pooling**
```javascript
// Configuração otimizada do pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Máximo de conexões
    idleTimeoutMillis: 30000, // 30s
    connectionTimeoutMillis: 2000, // 2s
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

## 📊 Monitoramento

### **Métricas a Acompanhar**
- **Performance**: Tempo médio de query
- **Conexões**: Uso do connection pool
- **Locks**: Contenção de recursos
- **Storage**: Crescimento do banco
- **Backup**: Tempo de backup/restore

### **Alertas Recomendados**
- Query time > 1s
- Connection pool > 80% utilizado
- Disk usage > 80%
- Backup failure

## 🚨 Rollback Plan

### **Se algo der errado:**
```bash
# 1. Parar aplicação
docker-compose down

# 2. Restaurar SQLite
cp db_backup_final.sqlite db.sqlite

# 3. Reverter variáveis de ambiente
# 4. Redeploy com SQLite
./deploy-production.sh
```

## 💰 Custos Estimados

### **PostgreSQL Hosting**
- **AWS RDS**: $25-50/mês (t3.micro)
- **DigitalOcean**: $15/mês (1GB RAM)
- **Heroku Postgres**: $50/mês (Hobby Dev)

### **Desenvolvimento**
- **Tempo de migração**: 3-4 semanas
- **Testes**: 1 semana
- **Deploy**: 1 dia

## 🎯 Conclusão

**Migração para PostgreSQL é recomendada quando:**
- Projeto atingir 1000+ usuários simultâneos
- Performance do SQLite se tornar um gargalo
- Funcionalidades avançadas forem necessárias

**Até lá, SQLite continua sendo a melhor opção** para simplicidade, custo e manutenção.
