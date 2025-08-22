# 🎯 **PRIMEIRO PASSO: Deploy do Editaliza**

## 🚀 **O que você vai fazer agora:**

1. **Preparar o código** (5 minutos)
2. **Criar conta no GitHub** (2 minutos)
3. **Subir código para GitHub** (3 minutos)
4. **Deploy no Railway** (5 minutos)
5. **Testar aplicação** (2 minutos)

**Tempo total: ~17 minutos**

---

## 📋 **PASSO 1: Preparar o Código**

### **1.1 Abrir o Terminal/Prompt de Comando**

**Windows:**
- Pressione `Windows + R`
- Digite `cmd` e pressione Enter
- Navegue até a pasta do projeto:
```bash
cd "C:\Users\Gabriel\OneDrive\Área de Trabalho\Editaliza"
```

**Mac/Linux:**
- Abra o Terminal
- Navegue até a pasta do projeto:
```bash
cd /caminho/para/editaliza
```

### **1.2 Executar o Script de Setup**

```bash
# Dar permissão de execução (Mac/Linux)
chmod +x setup-deploy.sh

# Executar o script
./setup-deploy.sh
```

**O que o script vai fazer:**
- ✅ Verificar se Node.js está instalado
- ✅ Gerar secrets seguros automaticamente
- ✅ Criar arquivo .env com configurações
- ✅ Criar arquivo .gitignore
- ✅ Instalar dependências
- ✅ Testar aplicação

---

## 🌐 **PASSO 2: Criar Conta no GitHub**

### **2.1 Acessar GitHub**
- Vá para: https://github.com/
- Clique em "Sign up" (Cadastrar)

### **2.2 Criar Conta**
- **Username**: escolha um nome (ex: `gabriel-editaliza`)
- **Email**: seu email
- **Password**: senha forte
- Clique em "Create account"

### **2.3 Verificar Email**
- Verifique seu email
- Clique no link de confirmação

---

## 📁 **PASSO 3: Criar Repositório**

### **3.1 Criar Novo Repositório**
- Acesse: https://github.com/new
- **Repository name**: `editaliza`
- **Description**: `Aplicativo de cronograma de estudos`
- **Visibility**: Public (recomendado)
- **NÃO** marque "Add a README file"
- Clique em "Create repository"

### **3.2 Copiar URL do Repositório**
- Anote a URL: `https://github.com/SEU_USUARIO/editaliza.git`

---

## 🚀 **PASSO 4: Subir Código**

### **4.1 No Terminal, execute:**

```bash
# Adicionar todos os arquivos
git add .

# Fazer primeiro commit
git commit -m "Primeira versão do Editaliza"

# Adicionar repositório remoto (SUBSTITUA SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/editaliza.git

# Enviar para GitHub
git push -u origin main
```

**Substitua `SEU_USUARIO` pelo seu username do GitHub**

---

## 🎯 **PASSO 5: Deploy no Railway**

### **5.1 Acessar Railway**
- Vá para: https://railway.app/
- Clique em "Login with GitHub"
- Autorize o Railway

### **5.2 Criar Projeto**
- Clique em "New Project"
- Selecione "Deploy from GitHub repo"
- Escolha seu repositório `editaliza`
- Clique em "Deploy Now"

### **5.3 Configurar Variáveis**
- Clique no projeto criado
- Vá em "Variables"
- Adicione estas variáveis:

```
NODE_ENV=production
PORT=3000
SESSION_SECRET=SEU_SESSION_SECRET_AQUI
JWT_SECRET=SEU_JWT_SECRET_AQUI
ALLOWED_ORIGINS=https://seu-app.railway.app
```

**Os secrets foram gerados pelo script. Copie-os do arquivo `.env`**

### **5.4 Configurar Domínio**
- Vá em "Settings"
- Clique em "Generate Domain"
- Copie o domínio gerado (ex: `editaliza-production.up.railway.app`)

### **5.5 Atualizar ALLOWED_ORIGINS**
- Volte em "Variables"
- Atualize `ALLOWED_ORIGINS` com o domínio gerado:
```
ALLOWED_ORIGINS=https://editaliza-production.up.railway.app
```

---

## ✅ **PASSO 6: Testar Aplicação**

### **6.1 Aguardar Deploy**
- Railway vai fazer deploy automaticamente
- Aguarde 2-5 minutos
- Status deve ficar "Deployed"

### **6.2 Acessar Aplicação**
- Clique no domínio gerado
- Ou acesse: `https://editaliza-production.up.railway.app`

### **6.3 Testar Funcionalidades**
- ✅ Página inicial carrega
- ✅ Cadastro de usuário funciona
- ✅ Login funciona
- ✅ Criação de plano funciona

---

## 🎉 **PARABÉNS!**

**Seu aplicativo Editaliza está ONLINE!**

### **URL da Aplicação:**
`https://editaliza-production.up.railway.app`

### **Próximos Passos:**
1. **Testar todas as funcionalidades**
2. **Compartilhar com amigos**
3. **Configurar domínio personalizado** (opcional)
4. **Monitorar performance**

---

## 🆘 **Se Algo Der Errado**

### **Problema: "Cannot find module"**
- No Railway, adicione: `NPM_CONFIG_PRODUCTION=false`

### **Problema: "Port already in use"**
- Railway usa PORT automaticamente, não precisa configurar

### **Problema: "CORS error"**
- Verifique se `ALLOWED_ORIGINS` está correto

### **Problema: "Database not found"**
- Railway cria banco automaticamente, aguarde alguns minutos

---

## 📞 **Precisa de Ajuda?**

1. **Verifique os logs** no Railway
2. **Consulte o arquivo** `DEPLOY_RAILWAY_GUIDE.md`
3. **Teste localmente primeiro**
4. **Verifique variáveis de ambiente**

---

## 🎊 **BOA SORTE!**

**Seu aplicativo Editaliza estará funcionando em poucos minutos!**

**Lembre-se:** O deploy é automático. Qualquer mudança que você fizer no código e enviar para o GitHub será automaticamente deployada no Railway.
