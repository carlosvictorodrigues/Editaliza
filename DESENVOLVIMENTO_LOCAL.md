# 🚀 Guia de Desenvolvimento Local - Editaliza

## 📋 Configuração Rápida

### 1. Configurar o arquivo `.env` para desenvolvimento local

```bash
# Copie o exemplo para .env
cp .env.local.example .env
```

**OU** edite manualmente o `.env` com estas configurações essenciais:

```env
# Ambiente
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Cookies (importante para localhost)
COOKIE_SECURE=false
COOKIE_DOMAIN=localhost
COOKIE_SAME_SITE=lax

# Google OAuth (se usar)
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

### 2. Iniciar o servidor local

```bash
# Verificar se a porta 3000 está livre
netstat -ano | findstr :3000

# Se estiver ocupada, liberar a porta
taskkill //F //PID <PID_DO_PROCESSO>

# Iniciar o servidor
npm start
```

### 3. Acessar a aplicação

Abra o navegador em: http://localhost:3000

## 🔧 Problemas Comuns e Soluções

### Problema: Redirecionamento para produção (app.editaliza.com.br)

**Causa:** O arquivo `.env` está com `APP_URL` apontando para produção.

**Solução:**
1. Edite o arquivo `.env`
2. Altere `APP_URL=www.editaliza.com.br` para `APP_URL=http://localhost:3000`
3. Adicione também `CLIENT_URL` e `FRONTEND_URL` com o mesmo valor
4. Reinicie o servidor

### Problema: Porta 3000 em uso

**Solução Windows:**
```bash
# Ver qual processo está usando a porta
netstat -ano | findstr :3000

# Matar o processo
taskkill //F //PID <numero_do_pid>
```

**Solução Linux/Mac:**
```bash
# Ver qual processo está usando a porta
lsof -i :3000

# Matar o processo
kill -9 <numero_do_pid>
```

### Problema: Cookies não funcionam no localhost

**Solução:** Adicione ao `.env`:
```env
COOKIE_SECURE=false
COOKIE_DOMAIN=localhost
COOKIE_SAME_SITE=lax
```

## 📝 Fluxo de Desenvolvimento Recomendado

### 1. **Desenvolvimento Local**
- Faça as alterações no código
- Teste localmente com `npm start`
- Verifique no navegador: http://localhost:3000

### 2. **Testes**
```bash
# Rodar testes
npm test

# Verificar lint
npm run lint
```

### 3. **Commit e Push**
```bash
# Adicionar mudanças
git add .

# Commit com mensagem descritiva
git commit -m "fix: corrigir problema de login"

# Push para o GitHub
git push origin main
```

### 4. **Deploy para Produção**
```bash
# Conectar ao servidor
ssh editaliza

# Atualizar código
cd /root/editaliza && git pull origin main

# Reiniciar aplicação
pm2 restart editaliza-app

# Verificar logs
pm2 logs editaliza-app --lines 50
```

## 🎯 Diferenças entre Desenvolvimento e Produção

| Configuração | Desenvolvimento | Produção |
|-------------|----------------|----------|
| NODE_ENV | `development` | `production` |
| APP_URL | `http://localhost:3000` | `https://app.editaliza.com.br` |
| COOKIE_SECURE | `false` | `true` |
| COOKIE_DOMAIN | `localhost` | `.editaliza.com.br` |
| DB_HOST | `127.0.0.1` | `localhost` |
| DB_PASSWORD | `1a2b3c4d` | `Editaliza@2025#Secure` |
| Redis | Desabilitado | Habilitado |
| Rate Limiting | Desabilitado | Habilitado |

## 🔍 Debug e Logs

### Ver logs em tempo real
```bash
# Desenvolvimento
npm start

# Produção
ssh editaliza "pm2 logs editaliza-app --follow"
```

### Debug de autenticação
1. Abra o DevTools do navegador (F12)
2. Vá na aba Network
3. Tente fazer login
4. Verifique as requisições para `/api/auth/login`
5. Check o Console para erros JavaScript

### Verificar tokens no localStorage
```javascript
// No console do navegador
localStorage.getItem('authToken')
localStorage.getItem('refreshToken')
```

## 📦 Estrutura de Arquivos Importantes

```
editaliza/
├── .env                    # Configurações locais (NÃO COMMITAR!)
├── .env.local.example      # Exemplo de configurações locais
├── server.js               # Servidor principal
├── public/                 # Arquivos estáticos
│   ├── login.html         # Página de login
│   └── js/
│       └── login-fallback.js  # Script de login resiliente
├── js/                     # Scripts (duplicado em public/js)
│   └── login-fallback.js  # Mesmo script
└── src/
    ├── config/
    │   └── environment.js  # Configuração de ambiente
    └── routes/
        └── auth.routes.js  # Rotas de autenticação
```

## ⚠️ Importante

1. **NUNCA commite o arquivo `.env`** - ele contém credenciais sensíveis
2. **Sempre teste localmente antes de fazer deploy**
3. **Mantenha arquivos em `/js` e `/public/js` sincronizados**
4. **Use `NODE_ENV=development` para desenvolvimento local**

## 🆘 Precisa de Ajuda?

1. Verifique os logs: `npm start` ou `pm2 logs`
2. Consulte o arquivo `CLAUDE.md` para instruções detalhadas
3. Check o status do banco: `psql -U editaliza_user -d editaliza_db`
4. Verifique se o PostgreSQL está rodando: `pg_isready`

---
**Última atualização:** 28/08/2025
**Versão:** 1.0