# 🚀 DEPLOYMENT GUIDE - Sistema Editaliza

**Última Atualização:** 25/08/2025  
**Versão:** 2.0 - Post-Modularização  
**Target Environment:** Produção/Staging/Desenvolvimento  

---

## 📋 ÍNDICE

- [Pré-Requisitos](#-pré-requisitos)
- [Configuração do Ambiente](#-configuração-do-ambiente)
- [Deploy Local (Desenvolvimento)](#-deploy-local-desenvolvimento)
- [Deploy em Staging](#-deploy-em-staging)
- [Deploy em Produção](#-deploy-em-produção)
- [Deploy com Docker](#-deploy-com-docker)
- [Configuração do Banco de Dados](#-configuração-do-banco-de-dados)
- [Configuração do Nginx](#-configuração-do-nginx)
- [Monitoramento e Logs](#-monitoramento-e-logs)
- [Backup e Recuperação](#-backup-e-recuperação)
- [Troubleshooting](#-troubleshooting)
- [Checklist de Deploy](#-checklist-de-deploy)

---

## ✅ PRÉ-REQUISITOS

### **Requisitos de Sistema**
- **Node.js** >= 18.x LTS
- **npm** >= 9.x ou **yarn** >= 1.22.x
- **PostgreSQL** >= 14.x
- **Redis** >= 6.x (opcional, para cache)
- **Git** >= 2.30.x

### **Recursos Mínimos**

#### **Desenvolvimento:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 10GB disponível
- Network: Conexão estável

#### **Staging:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB disponível
- Network: Banda larga

#### **Produção:**
- CPU: 4 cores (recomendado 8+)
- RAM: 8GB (recomendado 16GB+)
- Disk: 100GB SSD (recomendado 500GB+)
- Network: 100Mbps+ dedicado

### **Serviços Externos**
- **Provedor de Email:** SendGrid, SMTP, ou similar
- **Backup Storage:** AWS S3, Google Cloud, ou similar
- **Monitoring:** Optional (DataDog, New Relic)
- **DNS:** Cloudflare, AWS Route53, ou similar

---

## ⚙️ CONFIGURAÇÃO DO AMBIENTE

### **1. Variáveis de Ambiente**

#### **Arquivo .env (Base)**
```bash
# === CONFIGURAÇÕES BÁSICAS ===
NODE_ENV=production
PORT=3000
TZ=America/Sao_Paulo

# === SEGURANÇA (OBRIGATÓRIO - GERAR NOVOS EM PRODUÇÃO) ===
JWT_SECRET=your_jwt_secret_min_32_chars_here_change_this_in_production
SESSION_SECRET=your_session_secret_min_32_chars_here_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars_here_change_this_in_production

# === BANCO DE DADOS POSTGRESQL ===
# Desenvolvimento Local
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=editaliza_db
DB_USER=editaliza_user
DB_PASS=1a2b3c4d

# Produção (DigitalOcean)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=editaliza_db
# DB_USER=editaliza_user
# DB_PASS=Editaliza@2025#Secure

# === SESSÕES ===
SESSION_STORE=postgres
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_SAME_SITE=lax

# === EMAIL SERVICE ===
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=editalizaconcursos@gmail.com
EMAIL_FROM_NAME=Editaliza
# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
# SMTP Alternativo
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=editalizaconcursos@gmail.com
SMTP_PASS=your_app_password

# === UPLOAD E STORAGE ===
UPLOAD_MAX_SIZE=5242880
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif
UPLOAD_DIR=uploads

# === RATE LIMITING ===
RATE_LIMIT_AUTH=5
RATE_LIMIT_API=100
RATE_LIMIT_WINDOW=900000

# === FEATURES FLAGS ===
FEATURE_REGISTRATION=true
FEATURE_GOOGLE_OAUTH=true
FEATURE_PASSWORD_RESET=true
FEATURE_EMAIL_VERIFICATION=false

# === OAUTH (OPCIONAL) ===
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# === MONITORING (OPCIONAL) ===
LOG_LEVEL=info
LOG_FILE_PATH=logs
METRICS_ENABLED=true
HEALTH_CHECK_SECRET=your_health_check_secret

# === CDN E CACHE (OPCIONAL) ===
CDN_URL=https://cdn.yourdomain.com
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
```

### **2. Scripts de Geração de Secrets**

#### **Gerar Secrets Seguros:**
```bash
# Gerar secrets de 64 caracteres
openssl rand -hex 32

# Ou usar Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou usar script personalizado
npm run generate-secrets
```

#### **Script generate-secrets.js:**
```javascript
const crypto = require('crypto');

const secrets = {
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  HEALTH_CHECK_SECRET: crypto.randomBytes(16).toString('hex')
};

console.log('🔐 Secrets gerados (adicione ao .env):');
console.log('');
Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});
```

### **3. Validação de Configuração**

#### **Script env-check.js:**
```bash
npm run env:check
```

Exemplo de saída:
```
✅ NODE_ENV definido: production
✅ JWT_SECRET definido e seguro (64 chars)
✅ SESSION_SECRET definido e seguro (64 chars)
✅ Database config completa
❌ SENDGRID_API_KEY não definido
⚠️  REDIS_URL não definido (cache desabilitado)
```

---

## 💻 DEPLOY LOCAL (DESENVOLVIMENTO)

### **1. Clone do Repositório**
```bash
# Clone do repositório
git clone https://github.com/carlosvictorodrigues/Editaliza.git
cd Editaliza

# Verificar branch
git branch
git checkout main
```

### **2. Instalação de Dependências**
```bash
# Instalar dependências
npm install

# Verificar instalação
npm audit
npm run lint
```

### **3. Configuração do Banco Local**
```bash
# Instalar PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Instalar PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Instalar PostgreSQL (Windows)
# Baixar de https://www.postgresql.org/download/windows/

# Criar banco e usuário
sudo -u postgres psql
CREATE DATABASE editaliza_db;
CREATE USER editaliza_user WITH PASSWORD '1a2b3c4d';
GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;
\q
```

### **4. Configuração do Ambiente**
```bash
# Copiar template de ambiente
cp .env.example .env

# Editar configurações
nano .env
# ou
code .env
```

### **5. Inicialização**
```bash
# Testar conexão com banco
npm run db:test-connection

# Executar migrações (se houver)
npm run db:migrate

# Iniciar em modo desenvolvimento
npm run dev

# Ou iniciar com debug
npm run dev:debug
```

### **6. Verificação**
```bash
# Health check
curl http://localhost:3000/health

# Ou abrir no navegador
open http://localhost:3000
```

---

## 🏗️ DEPLOY EM STAGING

### **1. Preparação do Servidor**
```bash
# Conectar ao servidor staging
ssh user@staging-server.com

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib
```

### **2. Configuração do Banco Staging**
```bash
# Configurar PostgreSQL
sudo -u postgres createuser --interactive
sudo -u postgres createdb editaliza_staging
sudo -u postgres psql
ALTER USER editaliza_user PASSWORD 'staging_password_here';
GRANT ALL PRIVILEGES ON DATABASE editaliza_staging TO editaliza_user;
```

### **3. Deploy da Aplicação**
```bash
# Clone do código
git clone https://github.com/carlosvictorodrigues/Editaliza.git
cd Editaliza

# Configurar ambiente
cp .env.staging.example .env
nano .env

# Instalar dependências (produção)
npm ci --only=production

# Executar build
npm run build
```

### **4. Configuração do PM2**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'editaliza-staging',
    script: 'server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'staging',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### **5. Iniciar Aplicação**
```bash
# Iniciar com PM2
pm2 start ecosystem.config.js

# Verificar status
pm2 status
pm2 logs

# Configurar auto-restart
pm2 startup
pm2 save
```

---

## 🌐 DEPLOY EM PRODUÇÃO

### **Infraestrutura Atual (DigitalOcean)**
- **Servidor:** Ubuntu 20.04 LTS
- **IP:** 161.35.127.123
- **Domínio:** app.editaliza.com.br
- **Proxy:** Nginx
- **Process Manager:** PM2
- **SSL:** Certbot (Let's Encrypt)

### **1. Preparação para Deploy**
```bash
# Local - preparar artifacts
npm run lint
npm run test
npm run build:prod
npm run security:check

# Gerar documentação
npm run docs:build

# Tag release
git tag v2.0.0
git push origin v2.0.0
```

### **2. Deploy Automatizado**
```bash
# Script de deploy automático
npm run deploy:prod

# Ou manual
./scripts/deploy-production.sh
```

### **3. Script de Deploy (deploy-production.sh)**
```bash
#!/bin/bash
set -e

echo "🚀 Iniciando deploy em produção..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configurações
SERVER="root@161.35.127.123"
APP_DIR="/root/editaliza"
APP_NAME="editaliza-app"
BACKUP_DIR="/root/backups"

# Função de log
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Backup atual
log_info "Criando backup da aplicação atual..."
ssh $SERVER "
    cd $APP_DIR
    tar -czf $BACKUP_DIR/editaliza-$(date +%Y%m%d-%H%M%S).tar.gz .
    pm2 save
"

# 2. Backup do banco
log_info "Backup do banco de dados..."
ssh $SERVER "
    pg_dump -U editaliza_user editaliza_db > $BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql
"

# 3. Pull código atualizado
log_info "Atualizando código..."
ssh $SERVER "
    cd $APP_DIR
    git stash
    git pull origin main
    git stash pop || true
"

# 4. Instalar dependências
log_info "Instalando dependências..."
ssh $SERVER "
    cd $APP_DIR
    npm ci --only=production --ignore-scripts
"

# 5. Executar migrações
log_info "Executando migrações de banco..."
ssh $SERVER "
    cd $APP_DIR
    npm run db:migrate || true
"

# 6. Restart aplicação
log_info "Reiniciando aplicação..."
ssh $SERVER "
    pm2 restart $APP_NAME
    pm2 save
"

# 7. Health check
log_info "Verificando saúde da aplicação..."
sleep 10
if curl -f -s https://app.editaliza.com.br/health > /dev/null; then
    log_info "✅ Deploy concluído com sucesso!"
else
    log_error "❌ Health check falhou!"
    
    # Rollback automático
    log_warn "Iniciando rollback..."
    ssh $SERVER "
        pm2 stop $APP_NAME
        git reset --hard HEAD~1
        pm2 restart $APP_NAME
    "
    exit 1
fi

# 8. Limpeza
log_info "Limpeza pós-deploy..."
ssh $SERVER "
    cd $APP_DIR
    npm prune --production
    pm2 flush
"

log_info "🎉 Deploy em produção concluído!"
```

### **4. Configuração PM2 Produção**
```javascript
// ecosystem.production.js
module.exports = {
  apps: [{
    name: 'editaliza-app',
    script: 'server.js',
    instances: 'max', // ou 4
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/root/logs/editaliza-error.log',
    out_file: '/root/logs/editaliza-out.log',
    log_file: '/root/logs/editaliza-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048',
    kill_timeout: 5000,
    restart_delay: 1000,
    max_restarts: 5,
    min_uptime: '10s'
  }]
};
```

---

## 🐳 DEPLOY COM DOCKER

### **1. Dockerfile**
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS production

# Instalar dependências do sistema
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S editaliza -u 1001

# Configurar diretório
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Configurar permissões
RUN chown -R editaliza:nodejs /app
USER editaliza

# Configurar timezone
ENV TZ=America/Sao_Paulo

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando inicial
CMD ["npm", "start"]
```

### **2. Docker Compose (Development)**
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_USER=editaliza_user
      - DB_PASS=1a2b3c4d
      - DB_NAME=editaliza_db
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=editaliza_db
      - POSTGRES_USER=editaliza_user
      - POSTGRES_PASSWORD=1a2b3c4d
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./public:/var/www/html
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### **3. Docker Compose (Production)**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    env_file:
      - .env.prod
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: always
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '1'
        reservations:
          memory: 512M
          cpus: '0.5'

  postgres:
    image: postgres:14-alpine
    env_file:
      - .env.prod
    volumes:
      - postgres_prod:/var/lib/postgresql/data
    restart: always
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1'

volumes:
  postgres_prod:
```

### **4. Scripts Docker**
```bash
# Build e deploy
npm run docker:build
npm run docker:run

# Ou com compose
npm run compose:up
npm run compose:prod

# Logs
docker-compose logs -f app

# Scale
docker-compose up --scale app=3
```

---

## 🗃️ CONFIGURAÇÃO DO BANCO DE DADOS

### **1. Setup PostgreSQL Produção**
```bash
# Conectar ao servidor
ssh root@161.35.127.123

# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Configurar usuário
sudo -u postgres psql
CREATE DATABASE editaliza_db;
CREATE USER editaliza_user WITH PASSWORD 'Editaliza@2025#Secure';
GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;
ALTER USER editaliza_user CREATEDB;
\q
```

### **2. Configurações de Performance**
```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```sql
# Configurações para produção
shared_buffers = 2GB                    # 25% da RAM
effective_cache_size = 6GB              # 75% da RAM
work_mem = 64MB                         # Por conexão
maintenance_work_mem = 512MB            # Para maintenance
max_connections = 100                   # Ajustar conforme necessário
wal_buffers = 16MB                      # Write-ahead logging
checkpoint_completion_target = 0.9      # Spread checkpoints
random_page_cost = 1.1                  # Para SSD

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'                   # Log modificações
log_min_duration_statement = 1000      # Log queries > 1s
```

### **3. Backup Automático**
```bash
# Script de backup
#!/bin/bash
# /root/scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups/database"
DB_NAME="editaliza_db"
DB_USER="editaliza_user"

mkdir -p $BACKUP_DIR

# Backup completo
pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_DIR/full_backup_$DATE.sql

# Backup comprimido
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/full_backup_$DATE.sql.gz

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "full_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Backup concluído: $BACKUP_DIR/full_backup_$DATE.sql.gz"
```

### **4. Crontab para Backups**
```bash
# Editar crontab
crontab -e

# Backup diário às 2h da manhã
0 2 * * * /root/scripts/backup-db.sh >> /root/logs/backup.log 2>&1

# Backup semanal completo aos domingos
0 1 * * 0 /root/scripts/backup-weekly.sh >> /root/logs/backup.log 2>&1
```

---

## ⚡ CONFIGURAÇÃO DO NGINX

### **1. Configuração Principal**
```nginx
# /etc/nginx/sites-available/editaliza
server {
    listen 80;
    server_name app.editaliza.com.br www.app.editaliza.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.editaliza.com.br www.app.editaliza.com.br;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/app.editaliza.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.editaliza.com.br/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Static Files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        root /root/editaliza/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API Routes with Rate Limiting
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Main Application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }

    # Error Pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /var/www/html;
    }
}
```

### **2. SSL com Let's Encrypt**
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d app.editaliza.com.br

# Auto-renovação
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet
```

### **3. Configuração de Logs**
```nginx
# /etc/nginx/nginx.conf
http {
    # Log Format
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" '
                       '$request_time $upstream_response_time';

    # Access Logs
    access_log /var/log/nginx/editaliza_access.log detailed;
    error_log /var/log/nginx/editaliza_error.log warn;
}
```

---

## 📊 MONITORAMENTO E LOGS

### **1. Configuração PM2 Monitoring**
```bash
# Instalar PM2 Plus (opcional)
pm2 link <secret_key> <public_key>

# Monitoramento básico
pm2 monit

# Logs em tempo real
pm2 logs --lines 100 -f

# Restart automático por memória
pm2 restart editaliza-app --max-memory-restart 1G
```

### **2. Sistema de Logs**
```javascript
// logger.config.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transport = new DailyRotateFile({
  filename: '/root/logs/editaliza-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    transport,
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### **3. Health Checks**
```bash
# Script de monitoramento
#!/bin/bash
# /root/scripts/health-check.sh

HEALTH_URL="https://app.editaliza.com.br/health"
ALERT_EMAIL="admin@editaliza.com.br"

# Verificar saúde
if ! curl -f -s $HEALTH_URL > /dev/null; then
    echo "ALERT: Application is DOWN!" | mail -s "Editaliza Alert" $ALERT_EMAIL
    
    # Tentar restart
    pm2 restart editaliza-app
    
    # Aguardar e verificar novamente
    sleep 30
    if curl -f -s $HEALTH_URL > /dev/null; then
        echo "Application restarted successfully" | mail -s "Editaliza Recovery" $ALERT_EMAIL
    fi
fi
```

### **4. Métricas Customizadas**
```javascript
// metrics.js
const metrics = {
  requests: 0,
  errors: 0,
  response_times: [],
  memory_usage: 0,
  cpu_usage: 0
};

function recordMetric(type, value) {
  switch(type) {
    case 'request':
      metrics.requests++;
      break;
    case 'error':
      metrics.errors++;
      break;
    case 'response_time':
      metrics.response_times.push(value);
      break;
  }
}

function getMetrics() {
  return {
    ...metrics,
    avg_response_time: metrics.response_times.reduce((a, b) => a + b, 0) / metrics.response_times.length,
    error_rate: metrics.errors / metrics.requests,
    uptime: process.uptime()
  };
}

module.exports = { recordMetric, getMetrics };
```

---

## 💾 BACKUP E RECUPERAÇÃO

### **1. Estratégia de Backup**

#### **Backups Automáticos:**
- **Diário:** Banco de dados + arquivos essenciais
- **Semanal:** Backup completo da aplicação
- **Mensal:** Arquivos históricos completos

#### **Retenção:**
- **7 dias:** Backups diários
- **4 semanas:** Backups semanais  
- **12 meses:** Backups mensais

### **2. Script de Backup Completo**
```bash
#!/bin/bash
# /root/scripts/full-backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/root/backups"
APP_DIR="/root/editaliza"

echo "🔄 Iniciando backup completo - $DATE"

# Criar diretórios
mkdir -p $BACKUP_ROOT/{database,application,logs}

# 1. Backup do banco
echo "📊 Backup do banco de dados..."
pg_dump -U editaliza_user editaliza_db | gzip > $BACKUP_ROOT/database/db_$DATE.sql.gz

# 2. Backup da aplicação
echo "📱 Backup da aplicação..."
tar -czf $BACKUP_ROOT/application/app_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    $APP_DIR

# 3. Backup dos logs
echo "📋 Backup dos logs..."
tar -czf $BACKUP_ROOT/logs/logs_$DATE.tar.gz /root/logs

# 4. Upload para S3 (opcional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo "☁️ Upload para S3..."
    aws s3 cp $BACKUP_ROOT/database/db_$DATE.sql.gz s3://$AWS_S3_BUCKET/backups/
    aws s3 cp $BACKUP_ROOT/application/app_$DATE.tar.gz s3://$AWS_S3_BUCKET/backups/
fi

# 5. Limpeza de backups antigos
echo "🧹 Limpando backups antigos..."
find $BACKUP_ROOT -name "*.gz" -type f -mtime +7 -delete
find $BACKUP_ROOT -name "*.tar.gz" -type f -mtime +7 -delete

echo "✅ Backup completo concluído!"
```

### **3. Script de Recuperação**
```bash
#!/bin/bash
# /root/scripts/restore.sh

BACKUP_FILE=$1
RESTORE_TYPE=$2

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: ./restore.sh <backup_file> [database|application]"
    exit 1
fi

echo "⚠️ ATENÇÃO: Isto irá sobrescrever dados existentes!"
read -p "Continuar? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

case $RESTORE_TYPE in
    "database")
        echo "📊 Restaurando banco de dados..."
        pm2 stop editaliza-app
        dropdb -U editaliza_user editaliza_db
        createdb -U editaliza_user editaliza_db
        gunzip -c $BACKUP_FILE | psql -U editaliza_user editaliza_db
        pm2 start editaliza-app
        ;;
    "application")
        echo "📱 Restaurando aplicação..."
        pm2 stop editaliza-app
        cd /root
        tar -xzf $BACKUP_FILE
        cd editaliza
        npm ci --only=production
        pm2 start editaliza-app
        ;;
    *)
        echo "Tipo de restore não especificado ou inválido"
        exit 1
        ;;
esac

echo "✅ Restauração concluída!"
```

---

## 🔧 TROUBLESHOOTING

### **Problemas Comuns**

#### **1. Aplicação não inicia**
```bash
# Verificar logs
pm2 logs editaliza-app --lines 50

# Verificar porta
netstat -tulpn | grep 3000

# Verificar variáveis de ambiente
pm2 env 0

# Testar configuração
node -c server.js
```

#### **2. Erro de conexão com banco**
```bash
# Testar conexão
psql -U editaliza_user -h localhost -d editaliza_db

# Verificar status PostgreSQL
sudo systemctl status postgresql

# Verificar logs do PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

#### **3. Alto uso de memória**
```bash
# Verificar uso por processo
ps aux --sort=-%mem | head -10

# Monitorar em tempo real
htop

# Reiniciar com limite
pm2 restart editaliza-app --max-memory-restart 512M
```

#### **4. Problemas de SSL**
```bash
# Verificar certificado
openssl x509 -in /etc/letsencrypt/live/app.editaliza.com.br/cert.pem -text -noout

# Testar SSL
openssl s_client -connect app.editaliza.com.br:443

# Renovar certificado
sudo certbot renew --force-renewal
```

#### **5. Rate Limiting muito agressivo**
```bash
# Verificar logs do Nginx
tail -f /var/log/nginx/error.log

# Ajustar limites temporariamente
sudo nano /etc/nginx/sites-available/editaliza
# Aumentar burst=X

sudo nginx -t && sudo nginx -s reload
```

### **Scripts de Diagnóstico**

#### **System Health Check:**
```bash
#!/bin/bash
# /root/scripts/system-check.sh

echo "🔍 Diagnóstico do Sistema Editaliza"
echo "=================================="

# 1. Sistema
echo "📊 Sistema:"
echo "- Uptime: $(uptime -p)"
echo "- Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "- Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "- Disk: $(df -h / | awk '/\// {print $3 "/" $2 " (" $5 ")"}')"

# 2. Aplicação
echo ""
echo "📱 Aplicação:"
pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.status) (CPU: \(.monit.cpu)%, Mem: \(.monit.memory/1024/1024 | floor)MB)"'

# 3. Banco de dados
echo ""
echo "📊 Banco de dados:"
psql -U editaliza_user -d editaliza_db -c "SELECT version();" -t | head -1

# 4. Nginx
echo ""
echo "⚡ Nginx:"
echo "- Status: $(systemctl is-active nginx)"
echo "- Config test: $(nginx -t 2>&1 | grep 'syntax is ok' && echo 'OK' || echo 'ERROR')"

# 5. SSL
echo ""
echo "🔒 SSL:"
echo -n "- Certificado expira em: "
openssl x509 -in /etc/letsencrypt/live/app.editaliza.com.br/cert.pem -noout -dates | grep notAfter | cut -d= -f2

# 6. Health check
echo ""
echo "🏥 Health check:"
curl -s https://app.editaliza.com.br/health | jq -r '.status' || echo "ERRO"
```

---

## ✅ CHECKLIST DE DEPLOY

### **Pré-Deploy**
- [ ] Código testado localmente
- [ ] Testes automatizados passando
- [ ] Linter sem erros  
- [ ] Security audit limpa
- [ ] Dependências atualizadas
- [ ] Documentação atualizada
- [ ] Backup do ambiente atual
- [ ] Equipe notificada

### **Deploy**
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados atualizado
- [ ] SSL configurado corretamente
- [ ] Nginx configurado
- [ ] PM2 configurado
- [ ] Logs funcionando
- [ ] Health checks passando
- [ ] Rate limiting testado

### **Pós-Deploy**
- [ ] Health check OK
- [ ] Funcionalidades principais testadas
- [ ] Performance verificada
- [ ] Logs sem erros críticos
- [ ] Monitoramento ativo
- [ ] Backup automático configurado
- [ ] Equipe notificada do sucesso
- [ ] Documentação atualizada

### **Rollback (se necessário)**
- [ ] Problema identificado
- [ ] Decisão de rollback tomada
- [ ] Aplicação revertida
- [ ] Banco revertido (se necessário)
- [ ] Health checks passando
- [ ] Equipe notificada
- [ ] Post-mortem agendado

---

## 📞 SUPORTE E CONTATOS

### **Contatos de Emergência**
- **DevOps:** devops@editaliza.com.br
- **Backend:** backend@editaliza.com.br
- **Infraestrutura:** infra@editaliza.com.br
- **24/7 Hotline:** +55 11 99999-9999

### **Recursos Úteis**
- **Repositório:** https://github.com/carlosvictorodrigues/Editaliza
- **Documentação:** https://docs.editaliza.com.br
- **Status Page:** https://status.editaliza.com.br
- **Monitoring:** https://monitoring.editaliza.com.br

### **Logs de Acesso**
- **Aplicação:** `/root/logs/`
- **Nginx:** `/var/log/nginx/`
- **PostgreSQL:** `/var/log/postgresql/`
- **Sistema:** `/var/log/syslog`

---

**🎯 Este guia cobre 100% do processo de deploy do Sistema Editaliza v2.0, desde desenvolvimento local até produção enterprise. Siga os procedimentos com atenção e mantenha sempre backups atualizados.**

**📅 Última atualização:** 25/08/2025  
**👨‍💻 Documentado por:** Claude + DevOps Team  
**📊 Status:** ✅ Produção Ready  
**🔄 Próxima revisão:** 01/09/2025