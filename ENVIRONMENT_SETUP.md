# 🔧 CONFIGURAÇÃO DE AMBIENTES - DESENVOLVIMENTO vs PRODUÇÃO

## 📋 RESUMO RÁPIDO

### Como funciona:
1. **Localmente**: Usa `localhost:3000`, banco local, sem HTTPS
2. **Produção**: Usa `app.editaliza.com.br`, banco produção, HTTPS, cookies seguros
3. **Código único**: O MESMO código funciona nos dois ambientes!

## 🚀 SETUP INICIAL

### 1. Crie seu arquivo `.env` local:
```bash
# Copie o exemplo
cp .env.example .env

# Edite com suas configurações locais
notepad .env  # ou use seu editor preferido
```

### 2. Configure o básico no `.env`:
```env
NODE_ENV=development
APP_URL=http://localhost:3000

# Banco local (instale PostgreSQL localmente)
DB_HOST=localhost
DB_NAME=editaliza_dev
DB_USER=postgres
DB_PASSWORD=sua_senha_local
```

## 🎯 COMO O CÓDIGO SE ADAPTA

### Exemplo no código:
```javascript
const config = require('./src/config/environment');

// Em desenvolvimento:
console.log(config.APP_URL);  // http://localhost:3000
console.log(config.COOKIES.SECURE);  // false

// Em produção (automaticamente):
console.log(config.APP_URL);  // https://app.editaliza.com.br
console.log(config.COOKIES.SECURE);  // true
```

## 📊 TABELA DE DIFERENÇAS

| Configuração | Desenvolvimento | Produção |
|--------------|----------------|----------|
| **URL** | `http://localhost:3000` | `https://app.editaliza.com.br` |
| **Banco** | `editaliza_dev` (local) | `editaliza_db` (servidor) |
| **Redis** | Opcional | Obrigatório |
| **HTTPS** | Não | Sim |
| **Cookies Seguros** | Não | Sim |
| **Debug Logs** | Habilitado | Desabilitado |
| **Rate Limiting** | Desabilitado | Habilitado |
| **OAuth Callback** | `localhost:3000/auth/...` | `app.editaliza.com.br/auth/...` |

## 🔄 FLUXO DE TRABALHO

### Desenvolvimento Local:
```bash
# 1. Instale dependências
npm install

# 2. Configure .env (apenas uma vez)
cp .env.example .env
# Edite o .env com suas configs

# 3. Rode localmente
npm run dev

# 4. Acesse
http://localhost:3000
```

### Deploy para Produção:
```bash
# 1. Teste localmente
npm test

# 2. Commit e push
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 3. No servidor (automático ou manual)
ssh editaliza "cd /root/editaliza && git pull && pm2 restart editaliza-app"
```

## 🎨 EXEMPLOS PRÁTICOS

### 1. Conectando ao Banco:
```javascript
// src/utils/database.js
const config = require('../config/environment');

const pool = new Pool({
    host: config.DB.HOST,     // localhost ou servidor
    port: config.DB.PORT,     // 5432
    database: config.DB.NAME, // editaliza_dev ou editaliza_db
    user: config.DB.USER,
    password: config.DB.PASSWORD
});
```

### 2. Configurando CORS:
```javascript
// server.js
const config = require('./src/config/environment');

app.use(cors({
    origin: config.CORS.ORIGIN,  // localhost:3000 ou app.editaliza.com.br
    credentials: config.CORS.CREDENTIALS
}));
```

### 3. Configurando Cookies:
```javascript
// Para sessões
app.use(session({
    cookie: {
        secure: config.COOKIES.SECURE,     // false local, true produção
        domain: config.COOKIES.DOMAIN,     // localhost ou .editaliza.com.br
        httpOnly: config.COOKIES.HTTP_ONLY,
        sameSite: config.COOKIES.SAME_SITE
    }
}));
```

### 4. URLs Dinâmicas:
```javascript
// Em emails ou redirects
const loginUrl = `${config.APP_URL}/login`;
// Desenvolvimento: http://localhost:3000/login
// Produção: https://app.editaliza.com.br/login
```

## 🔐 SEGURANÇA

### NO `.env` LOCAL:
- ✅ Use senhas simples/teste
- ✅ Use secrets de desenvolvimento
- ✅ Pode commitar `.env.example`

### NO SERVIDOR:
- ✅ Senhas fortes únicas
- ✅ Secrets seguros (32+ caracteres)
- ❌ NUNCA commite `.env` real
- ❌ NUNCA exponha credenciais

## 🐛 TROUBLESHOOTING

### Problema: "Cannot connect to database"
```bash
# Desenvolvimento: Verifique se PostgreSQL está rodando
pg_ctl status  # ou
sudo service postgresql status

# Verifique .env
DB_HOST=localhost  # não 127.0.0.1
```

### Problema: "CORS error"
```javascript
// Verifique config/environment.js
CORS: {
    ORIGIN: process.env.CORS_ORIGIN || (isProduction 
        ? ['https://app.editaliza.com.br']
        : ['http://localhost:3000'])  // Adicione sua porta se diferente
}
```

### Problema: "Cookie not setting"
```javascript
// Em desenvolvimento, cookies precisam:
COOKIE_SECURE=false  # não true
COOKIE_DOMAIN=localhost  # não .localhost
```

## 📚 COMANDOS ÚTEIS

### Ver configuração atual:
```javascript
// Adicione temporariamente no server.js
const config = require('./src/config/environment');
console.log('Ambiente:', config.NODE_ENV);
console.log('URL:', config.APP_URL);
console.log('DB:', config.DB.NAME);
```

### Testar com produção local:
```bash
# Force modo produção localmente (para testes)
NODE_ENV=production npm start

# Volte para desenvolvimento
NODE_ENV=development npm run dev
```

## ✅ CHECKLIST DE CONFIGURAÇÃO

### Desenvolvimento:
- [ ] PostgreSQL instalado localmente
- [ ] `.env` criado com configs locais
- [ ] `NODE_ENV=development`
- [ ] Banco `editaliza_dev` criado
- [ ] Redis opcional (ou desabilitado)

### Produção (Servidor):
- [ ] `.env` com credenciais reais
- [ ] `NODE_ENV=production`
- [ ] PostgreSQL configurado
- [ ] Redis rodando
- [ ] SSL/HTTPS configurado
- [ ] Domínio apontando corretamente

## 🎯 RESUMO FINAL

1. **Um código, múltiplos ambientes** ✅
2. **Configurações automáticas por ambiente** ✅
3. **Segurança separada (dev vs prod)** ✅
4. **Fácil de testar localmente** ✅
5. **Deploy sem mudanças de código** ✅

---
**Dica Pro:** Use sempre `config.ALGUMA_COISA` ao invés de `process.env.ALGUMA_COISA` direto no código. Isso centraliza toda lógica de ambiente em um só lugar!