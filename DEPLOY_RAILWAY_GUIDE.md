# 🚀 Guia Completo de Deploy no Railway - Editaliza

## 📋 Pré-requisitos

### 1. **Conta no Railway**
- Acesse: https://railway.app/
- Faça login com GitHub (recomendado)

### 2. **Código no GitHub**
- Crie conta no GitHub: https://github.com/
- Faça upload do código (vou te ajudar)

## 🔧 Passo a Passo Completo

### **Passo 1: Preparar o Código**

1. **Criar arquivo `.env` para produção**
```bash
# Copie o arquivo de exemplo
cp env.production.example .env
```

2. **Editar o arquivo `.env`**
```bash
# Abra o arquivo .env e substitua:
NODE_ENV=production
PORT=3000
DOMAIN=https://seu-app.railway.app

# Secrets (vou te ajudar a gerar)
SESSION_SECRET=seu-secret-aqui
JWT_SECRET=seu-jwt-secret-aqui

# CORS
ALLOWED_ORIGINS=https://seu-app.railway.app
```

### **Passo 2: Gerar Secrets Seguros**

Execute estes comandos no terminal:

```bash
# Gerar session secret
openssl rand -base64 32

# Gerar JWT secret  
openssl rand -base64 32
```

**Copie os resultados** e cole no arquivo `.env`

### **Passo 3: Preparar para GitHub**

1. **Criar arquivo `.gitignore`**
```bash
# Crie um arquivo chamado .gitignore
touch .gitignore
```

2. **Adicionar conteúdo ao `.gitignore`**
```
node_modules/
.env
.env.local
.env.production
secrets/
*.log
db.sqlite
db.sqlite-shm
db.sqlite-wal
sessions.db
coverage/
.DS_Store
```

### **Passo 4: Subir para GitHub**

1. **Criar repositório no GitHub**
   - Acesse: https://github.com/new
   - Nome: `editaliza`
   - Público ou privado (sua escolha)
   - Não inicialize com README

2. **Subir código (via terminal)**
```bash
# Inicializar git
git init

# Adicionar arquivos
git add .

# Primeiro commit
git commit -m "Primeira versão do Editaliza"

# Adicionar repositório remoto (substitua SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/editaliza.git

# Enviar para GitHub
git push -u origin main
```

### **Passo 5: Deploy no Railway**

1. **Acessar Railway**
   - Vá para: https://railway.app/
   - Faça login com GitHub

2. **Criar novo projeto**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha seu repositório `editaliza`

3. **Configurar variáveis de ambiente**
   - Clique no projeto criado
   - Vá em "Variables"
   - Adicione as variáveis do `.env`:
   ```
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=seu-session-secret
   JWT_SECRET=seu-jwt-secret
   ALLOWED_ORIGINS=https://seu-app.railway.app
   ```

4. **Configurar domínio**
   - Vá em "Settings"
   - Clique em "Generate Domain"
   - Copie o domínio gerado

5. **Atualizar ALLOWED_ORIGINS**
   - Volte em "Variables"
   - Atualize `ALLOWED_ORIGINS` com o domínio gerado

### **Passo 6: Verificar Deploy**

1. **Aguardar deploy**
   - Railway vai fazer deploy automaticamente
   - Aguarde 2-5 minutos

2. **Testar aplicação**
   - Acesse o domínio gerado
   - Teste: https://seu-app.railway.app

3. **Verificar logs**
   - No Railway, vá em "Deployments"
   - Clique no último deploy
   - Verifique se não há erros

## 🆘 Solução de Problemas

### **Erro: "Cannot find module"**
```bash
# No Railway, adicione esta variável:
NPM_CONFIG_PRODUCTION=false
```

### **Erro: "Port already in use"**
```bash
# Railway usa a variável PORT automaticamente
# Não precisa configurar nada
```

### **Erro: "Database not found"**
```bash
# Railway cria volume automático
# O banco será criado automaticamente
```

### **Erro: "CORS"**
```bash
# Verifique se ALLOWED_ORIGINS está correto
# Deve ser: https://seu-app.railway.app
```

## 🎯 Próximos Passos

### **Após deploy bem-sucedido:**

1. **Testar funcionalidades**
   - Cadastro de usuário
   - Login
   - Criação de plano de estudo
   - Geração de cronograma

2. **Configurar domínio personalizado** (opcional)
   - Comprar domínio (ex: editaliza.com)
   - Configurar DNS no Railway

3. **Monitoramento**
   - Verificar logs regularmente
   - Monitorar performance

## 📞 Suporte

### **Se algo der errado:**

1. **Verificar logs no Railway**
2. **Testar localmente primeiro**
3. **Verificar variáveis de ambiente**
4. **Consultar documentação do Railway**

### **Links Úteis**
- Railway Docs: https://docs.railway.app/
- GitHub: https://github.com/
- Node.js: https://nodejs.org/

---

## 🎉 **Parabéns!**

Seu aplicativo Editaliza estará online e funcionando!

**URL da aplicação:** https://seu-app.railway.app

**Próximo passo:** Testar todas as funcionalidades e começar a usar!
