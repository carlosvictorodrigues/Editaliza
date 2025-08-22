# 🚀 Configuração do GitHub para Deploy Seguro - Editaliza

## 📋 Índice
1. [Branch Protection Rules (Rulesets)](#branch-protection-rules)
2. [Configuração de Deploy Automático](#deploy-automático)
3. [Secrets e Variáveis de Ambiente](#secrets-e-variáveis)
4. [GitHub Actions para CI/CD](#github-actions)
5. [Integração com Serviços de Deploy](#serviços-de-deploy)
6. [Checklist de Segurança](#checklist-de-segurança)

## 🔒 Branch Protection Rules (Rulesets)

### Por que é importante?
- **Previne acidentes**: Evita que código quebrado vá para produção
- **Força revisão**: Garante que todo código seja revisado
- **Mantém histórico**: Previne force push e reescrita de histórico
- **Automatiza qualidade**: Roda testes antes de permitir merge

### Configuração Recomendada para `main`

#### 1. Criar Ruleset
```
Nome: Proteção Branch Principal
Enforcement: Active
Target branches: main
```

#### 2. Configurações Essenciais

**✅ Marcar estas opções:**

```yaml
Branch Protection:
  ☑ Require a pull request before merging
    ☑ Require approvals: 1 (mínimo)
    ☑ Dismiss stale pull request approvals when new commits are pushed
    ☑ Require review from CODEOWNERS
  
  ☑ Require status checks to pass before merging
    ☑ Require branches to be up to date before merging
    Status checks:
      - tests (se tiver)
      - build
      - security-scan
  
  ☑ Require conversation resolution before merging
  
  ☑ Require signed commits (opcional mas recomendado)
  
  ☑ Include administrators (força regras até para admins)
  
  ☑ Restrict who can push to matching branches
    - Adicione apenas: você e CI/CD bot
```

#### 3. Bypass List (Exceções)
```yaml
Bypass para emergências:
  - Seu usuário (para hotfixes críticos)
  - Deploy bot (para auto-deploy)
```

## 🚀 Deploy Automático

### Opção 1: Vercel (Mais Fácil)

1. **Conectar Repositório**
   ```bash
   # No Vercel Dashboard
   1. Import Git Repository
   2. Selecione carlosvictorodrigues/Editaliza
   3. Configure:
      - Framework Preset: Other
      - Build Command: npm run build (se tiver)
      - Output Directory: ./
      - Install Command: npm install
   ```

2. **Variáveis de Ambiente no Vercel**
   ```env
   NODE_ENV=production
   JWT_SECRET=seu_secret_aqui
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxx
   # ... todas do .env
   ```

### Opção 2: Railway (Recomendado)

1. **Deploy Direto**
   ```bash
   # Railway CLI
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```

2. **Configure no GitHub**
   - Settings → Integrations → Railway
   - Auto-deploy on push to main

### Opção 3: Render

1. **Criar Web Service**
   ```yaml
   Build Command: npm install
   Start Command: node server.js
   Environment: Node
   Plan: Free ou Starter ($7/mês)
   ```

### Opção 4: VPS Próprio (DigitalOcean, AWS, etc)

1. **GitHub Actions para Deploy**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Production
   
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Deploy to server
           uses: appleboy/ssh-action@master
           with:
             host: ${{ secrets.HOST }}
             username: ${{ secrets.USERNAME }}
             key: ${{ secrets.SSH_KEY }}
             script: |
               cd /var/www/editaliza
               git pull origin main
               npm install
               npm run migrate
               pm2 restart editaliza
   ```

## 🔐 Secrets e Variáveis de Ambiente

### No GitHub (Settings → Secrets → Actions)

**Secrets de Produção:**
```env
# Básicos
NODE_ENV=production
JWT_SECRET=xxxxxxxxxxxxx
JWT_REFRESH_SECRET=xxxxxxxxxxxxx

# Database (se usar PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/editaliza

# Email
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# OAuth
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxx

# Pagamento
CACKTO_API_KEY=xxxxxxxxxxxxx
CACKTO_SECRET_KEY=xxxxxxxxxxxxx

# Deploy (para GitHub Actions)
SSH_KEY=-----BEGIN RSA PRIVATE KEY-----...
HOST=seu.servidor.com
USERNAME=deploy
```

## 🎯 GitHub Actions para CI/CD

### Criar arquivo: `.github/workflows/ci.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
    
    - name: Run linter
      run: npm run lint
    
    - name: Security audit
      run: npm audit --production
    
    - name: Build
      run: npm run build
      if: github.ref == 'refs/heads/main'

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Seu comando de deploy aqui
```

## 🌐 Serviços de Deploy Recomendados

### Para começar (Grátis/Barato):

1. **Vercel** 
   - ✅ Deploy automático
   - ✅ SSL grátis
   - ✅ Preview deployments
   - ⚠️ Limite de execução (10s no free)

2. **Railway**
   - ✅ PostgreSQL incluído
   - ✅ Deploy fácil
   - ✅ $5 de crédito grátis/mês
   - ✅ Suporta Node.js backend

3. **Render**
   - ✅ PostgreSQL grátis
   - ✅ Auto-deploy do GitHub
   - ✅ SSL grátis
   - ⚠️ Free tier hiberna após 15min

### Para produção séria:

1. **AWS EC2 + RDS**
   - ✅ Controle total
   - ✅ Escalabilidade
   - 💰 ~$20-50/mês

2. **DigitalOcean App Platform**
   - ✅ Simples como Heroku
   - ✅ Bom custo-benefício
   - 💰 $12/mês

3. **Google Cloud Run**
   - ✅ Paga por uso
   - ✅ Escala automaticamente
   - 💰 Muito barato para baixo tráfego

## ✅ Checklist de Segurança para Deploy

### Antes do Deploy:
- [ ] Branch protection configurado
- [ ] Secrets no GitHub, não no código
- [ ] `.env` no `.gitignore`
- [ ] Dependências atualizadas (`npm audit fix`)
- [ ] HTTPS/SSL configurado
- [ ] Rate limiting ativo
- [ ] Logs configurados (Winston)
- [ ] Backup automático configurado

### Configurações de Produção:
- [ ] `NODE_ENV=production`
- [ ] Email provider não é Gmail
- [ ] Database é PostgreSQL (não SQLite)
- [ ] Sessões usando Redis (se alto tráfego)
- [ ] CDN para assets estáticos
- [ ] Monitoramento configurado (Sentry, etc)

### DNS e Domínio:
- [ ] Domínio apontando para servidor
- [ ] SSL certificado válido
- [ ] www e non-www redirecionamento
- [ ] SPF, DKIM, DMARC para emails

## 🔄 Workflow Recomendado

```mermaid
graph LR
    A[Develop] --> B[Create PR]
    B --> C[Tests Run]
    C --> D[Code Review]
    D --> E[Merge to Main]
    E --> F[Auto Deploy]
    F --> G[Production]
```

1. **Desenvolvimento em branch separado**
   ```bash
   git checkout -b feature/nova-funcionalidade
   git add .
   git commit -m "feat: adicionar nova funcionalidade"
   git push origin feature/nova-funcionalidade
   ```

2. **Criar Pull Request**
   - Tests rodam automaticamente
   - Aguardar review
   - Merge apenas após aprovação

3. **Deploy Automático**
   - Merge em main trigger deploy
   - Rollback automático se falhar

## 🚨 Configuração de Emergência

### Hotfix Process:
```bash
# Para mudanças críticas urgentes
git checkout -b hotfix/correcao-critica main
# fazer correção
git add .
git commit -m "hotfix: corrigir bug crítico"
git push origin hotfix/correcao-critica

# No GitHub: criar PR com label "hotfix"
# Bypass de algumas proteções para hotfix
```

## 📊 Monitoramento Pós-Deploy

### Ferramentas Recomendadas:
1. **Sentry** - Erros em tempo real
2. **LogRocket** - Replay de sessões
3. **Datadog** - Métricas e logs
4. **UptimeRobot** - Monitoring de uptime

### Configurar Alertas para:
- Erro 500+ por minuto
- CPU > 80%
- Memória > 90%
- Response time > 2s
- Bounce rate de email > 5%

## 🔧 Scripts Úteis

### package.json scripts para deploy:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "lint": "eslint .",
    "build": "npm run lint && npm test",
    "migrate": "node scripts/migrate.js",
    "deploy": "npm run build && npm run migrate",
    "postinstall": "npm run migrate"
  }
}
```

---

## 💡 Dica Final

**Comece simples:**
1. Use Railway ou Render para começar (fácil e barato)
2. Configure branch protection básico
3. Adicione CI/CD gradualmente
4. Migre para solução mais robusta quando crescer

**Prioridades:**
1. 🔒 Segurança (secrets, HTTPS)
2. 🔄 Backup automático
3. 📊 Monitoramento básico
4. 🚀 Deploy automático

---

**Última atualização**: 15/08/2025  
**Versão**: 1.0