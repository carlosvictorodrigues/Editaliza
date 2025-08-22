# 🚀 GUIA COMPLETO: IMPLEMENTAÇÃO ONLINE COM SISTEMA DE ASSINATURA - VERSÃO ATUALIZADA

## 📋 ÍNDICE
1. [Visão Geral do Sistema](#visão-geral)
2. [Infraestrutura e Hospedagem](#infraestrutura)
3. [Sistema de Pagamentos](#pagamentos)
4. [Modificações no Código](#modificações-código)
5. [Banco de Dados](#banco-dados)
6. [Segurança e Autenticação](#segurança)
7. [Monitoramento e Analytics](#monitoramento)
8. [Cronograma de Implementação](#cronograma)
9. [Custos Estimados](#custos)
10. [Checklist de Deployment](#checklist)

---

## 🎯 VISÃO GERAL DO SISTEMA {#visão-geral}

### **Arquitetura Atualizada do Sistema de Assinatura**
```
📱 Frontend (HTML/CSS/JS + Tailwind) 
    ↕️
🔐 Sistema de Autenticação (JWT + Sessions)
    ↕️
💳 Gateway de Pagamento (Stripe + Mercado Pago)
    ↕️
🗄️ Banco de Dados (PostgreSQL - Migração do SQLite)
    ↕️
⚙️ Backend (Node.js + Express - Já implementado)
    ↕️
🌐 Servidor (AWS/DigitalOcean/Vercel)
```

### **Fluxo do Usuário Atualizado**
1. **Cadastro**: Email + senha (já implementado)
2. **Trial Gratuito**: 7 dias automático
3. **Escolha do Plano**: Mensal/Trimestral/Semestral/Anual
4. **Pagamento**: Gateway seguro (Stripe + MP)
5. **Ativação**: Automática após confirmação
6. **Uso**: Acesso liberado até vencimento
7. **Renovação**: Automática ou manual
8. **Cancelamento**: Via dashboard

---

## 🏗️ INFRAESTRUTURA E HOSPEDAGEM {#infraestrutura}

### **OPÇÃO 1: AWS (Recomendada para Escala)**

#### **Serviços Necessários:**
- **EC2**: Servidor principal (t3.small → t3.medium)
- **RDS**: Banco PostgreSQL gerenciado
- **CloudFront**: CDN para assets
- **Route 53**: DNS personalizado
- **Certificate Manager**: SSL gratuito
- **S3**: Storage para avatares/arquivos

#### **Configuração Inicial Atualizada:**
```bash
# 1. Criar instância EC2
- AMI: Ubuntu 22.04 LTS
- Tipo: t3.small (2 vCPU, 2GB RAM)
- Storage: 20GB SSD
- Security Group: HTTP(80), HTTPS(443), SSH(22)

# 2. Instalar dependências (atualizado)
sudo apt update
sudo apt install nodejs npm nginx certbot postgresql-client
sudo npm install -g pm2 nodemon

# 3. Configurar Nginx (configuração otimizada)
sudo nano /etc/nginx/sites-available/editaliza
```

#### **Nginx Config Atualizada:**
```nginx
server {
    listen 80;
    server_name app.editaliza.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.editaliza.com;
    
    ssl_certificate /etc/letsencrypt/live/app.editaliza.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.editaliza.com/privkey.pem;
    
    # Otimizações de performance
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **OPÇÃO 2: DigitalOcean (Simplicidade)**

#### **Droplet Recomendado Atualizado:**
- **Basic**: $12/mês (2GB RAM, 1 vCPU, 50GB SSD)
- **App Platform**: $12/mês (deploy automático)
- **Managed Database**: $15/mês (PostgreSQL)

### **OPÇÃO 3: Vercel/Railway (Desenvolvimento Rápido)**

#### **Vercel (Frontend) + Railway (Backend):**
- **Vercel**: Frontend gratuito
- **Railway**: $5/mês backend + $5/mês banco
- **Total**: $10/mês (ideal para começar)

---

## 💳 SISTEMA DE PAGAMENTOS {#pagamentos}

### **OPÇÃO A: Stripe (Internacional)**

#### **Implementação Atualizada:**
```javascript
// 1. Instalar Stripe
npm install stripe

// 2. Configurar no backend (atualizado)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// 3. Planos atualizados com preços competitivos
const plans = {
  mensal: { 
    price: 'price_mensal_id', 
    amount: 2997, // R$ 29,97
    display_name: 'Plano Mensal',
    features: ['Cronogramas ilimitados', 'Todas as funcionalidades', 'Suporte por email']
  },
  trimestral: { 
    price: 'price_trimestral_id', 
    amount: 7997, // R$ 79,97
    display_name: 'Plano Trimestral',
    features: ['Cronogramas ilimitados', 'Todas as funcionalidades', 'Suporte prioritário', 'Economia de R$ 9,94']
  },
  semestral: { 
    price: 'price_semestral_id', 
    amount: 14997, // R$ 149,97
    display_name: 'Plano Semestral',
    features: ['Cronogramas ilimitados', 'Todas as funcionalidades', 'Suporte prioritário', 'Economia de R$ 29,85']
  },
  anual: { 
    price: 'price_anual_id', 
    amount: 23997, // R$ 239,97
    display_name: 'Plano Anual',
    features: ['Cronogramas ilimitados', 'Todas as funcionalidades', 'Suporte prioritário', 'Economia de R$ 119,67']
  }
};

// 4. Criar sessão de checkout (atualizado)
app.post('/create-checkout-session', async (req, res) => {
  const { planType, customerEmail } = req.body;
  
  if (!plans[planType]) {
    return res.status(400).json({ error: 'Plano inválido' });
  }
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: plans[planType].price,
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `${process.env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.DOMAIN}/cancel`,
    customer_email: customerEmail,
    metadata: {
      plan_type: planType,
      user_email: customerEmail
    }
  });
  
  res.json({ sessionId: session.id });
});
```

### **OPÇÃO B: Mercado Pago (Nacional)**

#### **Implementação Atualizada:**
```javascript
// 1. Instalar SDK
npm install mercadopago

// 2. Configurar
const mercadopago = require('mercadopago');
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// 3. Criar preferência (atualizado)
app.post('/create-preference', async (req, res) => {
  const { planType, userEmail } = req.body;
  
  if (!plans[planType]) {
    return res.status(400).json({ error: 'Plano inválido' });
  }
  
  const preference = {
    items: [{
      title: `Editaliza - ${plans[planType].display_name}`,
      quantity: 1,
      currency_id: 'BRL',
      unit_price: plans[planType].amount / 100 // MP espera em reais
    }],
    payer: {
      email: userEmail
    },
    back_urls: {
      success: `${process.env.DOMAIN}/payment-success`,
      failure: `${process.env.DOMAIN}/payment-failure`,
      pending: `${process.env.DOMAIN}/payment-pending`
    },
    auto_return: 'approved',
    external_reference: `plan_${planType}_${Date.now()}`,
    notification_url: `${process.env.DOMAIN}/webhooks/mercadopago`
  };
  
  try {
    const result = await mercadopago.preferences.create(preference);
    res.json({ preferenceId: result.body.id });
  } catch (error) {
    console.error('Erro ao criar preferência MP:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
});
```

---

## 🔧 MODIFICAÇÕES NO CÓDIGO {#modificações-código}

### **1. BANCO DE DADOS - Novas Tabelas (Atualizado)**

```sql
-- Tabela de planos de assinatura (atualizada)
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'mensal', 'trimestral', etc.
    display_name VARCHAR(100) NOT NULL, -- 'Plano Mensal'
    price_cents INTEGER NOT NULL, -- 2997 = R$ 29,97
    duration_days INTEGER NOT NULL, -- 30, 90, 180, 365
    stripe_price_id VARCHAR(100),
    mercadopago_plan_id VARCHAR(100),
    features JSONB, -- {"max_plans": 5, "support": true, "priority": false}
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de assinaturas dos usuários (atualizada)
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'active', 'canceled', 'expired', 'pending', 'trial'
    payment_method VARCHAR(20), -- 'stripe', 'mercadopago'
    external_subscription_id VARCHAR(100), -- ID do Stripe/MP
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    canceled_at TIMESTAMP,
    last_payment_at TIMESTAMP,
    next_payment_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de transações/pagamentos (atualizada)
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    external_transaction_id VARCHAR(100),
    payment_method VARCHAR(20),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    gateway_response JSONB,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar colunas na tabela users (atualizado)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
```

### **2. MIDDLEWARE DE VERIFICAÇÃO DE ASSINATURA (Atualizado)**

```javascript
// middleware/subscription.js (atualizado)
const checkSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Buscar assinatura ativa do usuário
        const subscription = await dbGet(`
            SELECT us.*, sp.name as plan_name, sp.features, sp.display_name
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = ? 
            AND us.status = 'active' 
            AND us.expires_at > NOW()
            ORDER BY us.expires_at DESC 
            LIMIT 1
        `, [userId]);
        
        if (!subscription) {
            // Verificar se ainda está no trial
            const user = await dbGet('SELECT trial_ends_at FROM users WHERE id = ?', [userId]);
            
            if (user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
                req.user.subscription = { 
                    status: 'trial', 
                    plan_name: 'trial',
                    expires_at: user.trial_ends_at
                };
                return next();
            }
            
            return res.status(403).json({
                error: 'subscription_required',
                message: 'Assinatura necessária para acessar este recurso',
                upgrade_url: '/pricing',
                trial_available: true
            });
        }
        
        req.user.subscription = subscription;
        next();
        
    } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

// Middleware para verificar limite de planos
const checkPlanLimit = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const subscription = req.user.subscription;
        
        if (!subscription || subscription.status === 'trial') {
            // Trial: limite de 2 planos
            const planCount = await dbGet('SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?', [userId]);
            if (planCount.count >= 2) {
                return res.status(403).json({
                    error: 'plan_limit_reached',
                    message: 'Limite de planos atingido. Faça upgrade para criar mais planos.',
                    upgrade_url: '/pricing'
                });
            }
        } else {
            // Assinatura ativa: verificar limite baseado no plano
            const features = subscription.features || {};
            const maxPlans = features.max_plans || 5;
            
            const planCount = await dbGet('SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?', [userId]);
            if (planCount.count >= maxPlans) {
                return res.status(403).json({
                    error: 'plan_limit_reached',
                    message: `Limite de ${maxPlans} planos atingido. Faça upgrade para criar mais planos.`,
                    upgrade_url: '/pricing'
                });
            }
        }
        
        next();
    } catch (error) {
        console.error('Erro ao verificar limite de planos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

module.exports = { checkSubscription, checkPlanLimit };
```

### **3. ROTAS PROTEGIDAS (Atualizado)**

```javascript
// server.js - Aplicar middleware nas rotas críticas (atualizado)
const { checkSubscription, checkPlanLimit } = require('./middleware/subscription');

// Proteger rotas principais
app.get('/plans/:planId/generate', authenticateToken, checkSubscription, async (req, res) => {
    // Lógica existente da geração de cronograma
});

app.get('/plans/:planId/schedule', authenticateToken, checkSubscription, async (req, res) => {
    // Lógica existente do cronograma
});

app.post('/plans', authenticateToken, checkSubscription, checkPlanLimit, async (req, res) => {
    // Lógica existente de criação de planos
});

// Rotas livres (apenas visualização)
app.get('/plans/:planId', authenticateToken, async (req, res) => {
    // Visualização permitida, mas sem edição
});

app.get('/profile', authenticateToken, async (req, res) => {
    // Perfil sempre acessível
});

// Nova rota para verificar status da assinatura
app.get('/subscription/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const subscription = await dbGet(`
            SELECT us.*, sp.display_name, sp.features
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = ? 
            AND us.status IN ('active', 'pending')
            ORDER BY us.created_at DESC 
            LIMIT 1
        `, [userId]);
        
        const user = await dbGet('SELECT trial_ends_at, subscription_status FROM users WHERE id = ?', [userId]);
        
        res.json({
            subscription,
            trial_ends_at: user.trial_ends_at,
            subscription_status: user.subscription_status
        });
    } catch (error) {
        console.error('Erro ao buscar status da assinatura:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
```

### **4. SISTEMA DE TRIAL GRATUITO (Atualizado)**

```javascript
// Ao criar novo usuário, dar 7 dias de trial (atualizado)
app.post('/register', async (req, res) => {
    try {
        // ... código existente de criação do usuário
        
        // Adicionar trial de 7 dias
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        
        await dbRun(`
            UPDATE users 
            SET trial_ends_at = ?, subscription_status = 'trial' 
            WHERE id = ?
        `, [trialEnd.toISOString(), userId]);
        
        // Criar registro de assinatura trial
        await dbRun(`
            INSERT INTO user_subscriptions (user_id, plan_id, status, started_at, expires_at, trial_ends_at)
            VALUES (?, NULL, 'trial', NOW(), ?, ?)
        `, [userId, trialEnd.toISOString(), trialEnd.toISOString()]);
        
        // ... resto da lógica
    } catch (error) {
        // ... tratamento de erro
    }
});
```

---

## 🗄️ BANCO DE DADOS {#banco-dados}

### **Migração para PostgreSQL (Atualizada)**

#### **Script de Migração Melhorado:**
```javascript
// migrate-to-postgres.js (atualizado)
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');
const fs = require('fs');

const sqliteDb = new sqlite3.Database('./db.sqlite');
const pgPool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateTable(tableName) {
    return new Promise((resolve, reject) => {
        sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
            if (err) return reject(err);
            
            console.log(`Migrando ${rows.length} registros da tabela ${tableName}...`);
            
            for (const row of rows) {
                const columns = Object.keys(row).join(', ');
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                
                try {
                    await pgPool.query(
                        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                        values
                    );
                } catch (error) {
                    console.error(`Erro ao migrar registro da tabela ${tableName}:`, error);
                }
            }
            
            console.log(`✅ Tabela ${tableName} migrada com sucesso!`);
            resolve();
        });
    });
}

// Executar migração
async function migrate() {
    const tables = ['users', 'study_plans', 'subjects', 'topics', 'study_sessions'];
    
    console.log('🚀 Iniciando migração para PostgreSQL...');
    
    for (const table of tables) {
        try {
            await migrateTable(table);
        } catch (error) {
            console.error(`❌ Erro ao migrar tabela ${table}:`, error);
        }
    }
    
    console.log('✅ Migração concluída!');
    process.exit(0);
}

migrate().catch(console.error);
```

---

## 🔒 SEGURANÇA E AUTENTICAÇÃO {#segurança}

### **1. Variáveis de Ambiente (.env) - Atualizado**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/editaliza
DB_HOST=localhost
DB_NAME=editaliza
DB_USER=editaliza_user
DB_PASSWORD=secure_password_here

# JWT
JWT_SECRET=super_secure_jwt_secret_256_bits_minimum
JWT_EXPIRES_IN=24h

# Stripe
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mercado Pago
MP_PUBLIC_KEY=APP_USR-...
MP_ACCESS_TOKEN=APP_USR-...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@editaliza.com
SMTP_PASS=app_specific_password

# App
NODE_ENV=production
PORT=3000
DOMAIN=https://app.editaliza.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **2. Rate Limiting (Atualizado)**
```javascript
const rateLimit = require('express-rate-limit');

// Rate limit para login (atualizado)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 tentativas
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

app.post('/login', loginLimiter, async (req, res) => {
    // ... lógica de login
});

// Rate limit geral para API (atualizado)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 requests por 15 min
    message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', apiLimiter);

// Rate limit para pagamentos (mais restritivo)
const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // máximo 10 tentativas de pagamento por hora
    message: { error: 'Muitas tentativas de pagamento. Tente novamente em 1 hora.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/create-checkout-session', paymentLimiter);
app.use('/create-preference', paymentLimiter);
```

---

## 📊 MONITORAMENTO E ANALYTICS {#monitoramento}

### **1. Logging com Winston (Atualizado)**
```javascript
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join(__dirname, 'logs', 'error.log'), 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, 'logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Adicionar console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Middleware de logging (atualizado)
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url}`, {
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
    });
    
    next();
});
```

---

## 📅 CRONOGRAMA DE IMPLEMENTAÇÃO {#cronograma}

### **FASE 1: Preparação (1-2 semanas)**
- [ ] **Dia 1-2**: Configurar infraestrutura (servidor + banco)
- [ ] **Dia 3-4**: Migrar para PostgreSQL
- [ ] **Dia 5-7**: Configurar CI/CD e deployment
- [ ] **Dia 8-10**: Implementar sistema de pagamento
- [ ] **Dia 11-14**: Testes de integração

### **FASE 2: Sistema de Assinatura (1-2 semanas)**
- [ ] **Dia 1-3**: Criar tabelas de assinatura
- [ ] **Dia 4-6**: Implementar middleware de verificação
- [ ] **Dia 7-9**: Criar páginas de pricing e checkout
- [ ] **Dia 10-12**: Implementar webhooks
- [ ] **Dia 13-14**: Testes de pagamento em sandbox

### **FASE 3: Integração e Segurança (1 semana)**
- [ ] **Dia 1-2**: Proteger todas as rotas críticas
- [ ] **Dia 3-4**: Implementar rate limiting e validações
- [ ] **Dia 5-7**: Sistema de logs e monitoramento

### **FASE 4: Testes e Launch (1 semana)**
- [ ] **Dia 1-3**: Testes com usuários beta
- [ ] **Dia 4-5**: Correções e ajustes
- [ ] **Dia 6-7**: Deploy para produção

### **TOTAL: 4-6 semanas**

---

## 💰 CUSTOS ESTIMADOS {#custos}

### **CUSTOS MENSAIS RECORRENTES (Atualizado)**

#### **Infraestrutura (Opção AWS):**
- **Servidor EC2 t3.small**: $18
- **Banco RDS PostgreSQL**: $15
- **CloudFront CDN**: $5
- **Route 53 DNS**: $1
- **Certificado SSL**: Gratuito
- **Subtotal Infraestrutura**: ~$40/mês

#### **Serviços de Pagamento:**
- **Stripe**: 3.4% + $0.30 por transação
- **Mercado Pago**: 3.99% PIX, 4.99% cartão
- **Estimativa 100 assinantes/mês**: ~$120 em taxas

#### **Serviços Adicionais:**
- **Monitoramento (DataDog/New Relic)**: $15
- **Email (SendGrid)**: $15
- **Backup automático**: $10
- **Subtotal Serviços**: ~$40/mês

#### **TOTAL MENSAL: ~$200**

### **BREAK-EVEN POINT (Atualizado):**
- **Custo mensal total**: $200
- **Preço médio assinatura**: $30
- **Assinantes necessários**: 7 para cobrir custos
- **Lucro com 50 assinantes**: $1.300/mês
- **Lucro com 200 assinantes**: $5.800/mês

---

## ✅ CHECKLIST DE DEPLOYMENT {#checklist}

### **PRÉ-DEPLOYMENT (Atualizado)**
- [ ] ✅ Código testado localmente
- [ ] ✅ Banco de dados migrado para PostgreSQL
- [ ] ✅ Variáveis de ambiente configuradas
- [ ] ✅ SSL certificado válido
- [ ] ✅ DNS apontando corretamente
- [ ] ✅ Pagamentos testados em sandbox
- [ ] ✅ Webhooks funcionando
- [ ] ✅ Emails sendo enviados
- [ ] ✅ Logs configurados
- [ ] ✅ Backups automáticos
- [ ] ✅ Rate limiting configurado
- [ ] ✅ Monitoramento ativo

### **DEPLOYMENT**
- [ ] 🚀 Deploy da aplicação
- [ ] 🔄 Testes de smoke
- [ ] 📧 Configurar notificações
- [ ] 📊 Verificar analytics
- [ ] 💳 Testar fluxo completo de pagamento
- [ ] 🔍 Monitorar logs por 24h

### **PÓS-DEPLOYMENT**
- [ ] 📈 Configurar métricas de business
- [ ] 🎯 Configurar alertas críticos
- [ ] 📝 Documentar processos
- [ ] 👥 Treinar equipe de suporte
- [ ] 🔄 Configurar backup/restore
- [ ] 📱 Testar em dispositivos móveis

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### **1. COMEÇAR IMEDIATAMENTE:**
```bash
# 1. Configurar repositório Git
git init
git add .
git commit -m "Initial commit - Editaliza base"

# 2. Criar conta nos serviços
# - AWS/DigitalOcean para hospedagem
# - Stripe para pagamentos
# - PostgreSQL para banco

# 3. Configurar ambiente de desenvolvimento
cp .env.example .env
# Preencher variáveis de desenvolvimento
```

### **2. PRIORIDADES:**
1. **URGENTE**: Configurar infraestrutura básica
2. **IMPORTANTE**: Implementar sistema de pagamento
3. **MÉDIO**: Adicionar monitoramento
4. **BAIXO**: Features avançadas

### **3. RECURSOS ADICIONAIS:**
- 📖 **Documentação Stripe**: https://stripe.com/docs
- 📖 **Mercado Pago API**: https://www.mercadopago.com.br/developers
- 📖 **AWS Deploy Guide**: https://docs.aws.amazon.com/
- 📖 **PostgreSQL Migration**: https://www.postgresql.org/docs/

---

## 🆘 SUPORTE E DÚVIDAS

Para dúvidas sobre implementação específica:
1. **Backend/API**: Consultar documentação dos gateways
2. **Frontend**: Usar exemplos do Stripe/MP
3. **Infraestrutura**: Documentação AWS/DigitalOcean
4. **Deployment**: Guias de CI/CD

**BOA SORTE COM O LANÇAMENTO! 🚀🎉**

---

*Este guia foi atualizado para refletir o estado atual do projeto Editaliza e incluir as melhores práticas de 2024.* 