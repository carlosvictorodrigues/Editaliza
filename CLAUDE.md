# 🤖 INSTRUÇÕES CRÍTICAS PARA CLAUDE

## 🔴 SEGURANÇA - NUNCA FAÇA ISSO:

### ⚠️ NUNCA COMMITE CREDENCIAIS
- **NUNCA** faça `git add .env`
- **NUNCA** faça `git commit` com arquivos que contenham:
  - Senhas
  - API Keys
  - Client Secrets
  - Tokens JWT
  - Senhas de email/SMTP
  - Qualquer credencial sensível

### ✅ SEMPRE VERIFIQUE ANTES DE COMMITAR:
1. Use `git status` para ver o que será commitado
2. Verifique se `.env` está no `.gitignore`
3. Use `git add` específico para cada arquivo (não use `git add .`)
4. Revise o conteúdo antes de commitar

### 📝 BOAS PRÁTICAS:
- Mantenha credenciais apenas no `.env` local
- Use `.env.example` com valores falsos para documentação
- Sempre adicione arquivos sensíveis ao `.gitignore`
- Antes de commitar, pergunte: "Tem alguma credencial aqui?"

## 🛠️ COMANDOS PARA EXECUTAR AUTOMATICAMENTE:

### Ao concluir tarefas:
```bash
npm run lint        # Se existir
npm run typecheck   # Se existir
npm test           # Se existir
```

## 📋 ESTRUTURA DO PROJETO:

### Arquivos Sensíveis (NUNCA COMMITE):
- `.env`
- `*.key`
- `*.pem`
- `*_SECRET*`
- Qualquer arquivo com credenciais

### Estrutura de Pastas:
```
/src
  /config       - Configurações
  /controllers  - Controllers
  /services     - Serviços
  /routes       - Rotas
  /utils        - Utilitários
/public         - Arquivos públicos (IMPORTANTE: veja nota abaixo)
/css            - Estilos CSS (duplicados em /public/css)
/js             - Scripts JS (duplicados em /public/js)
```

### ⚠️ IMPORTANTE - DUPLICAÇÃO DE ARQUIVOS ESTÁTICOS:
O servidor serve arquivos estáticos de DUAS localizações:
1. **Pasta raiz** (`/css`, `/js`) - Arquivos HTML referenciam estes
2. **Pasta public** (`/public/css`, `/public/js`, `/public/*.html`)

**SEMPRE QUE MODIFICAR:**
- Arquivos CSS: Copie para AMBAS `/css` e `/public/css`
- Arquivos JS: Copie para AMBAS `/js` e `/public/js`  
- Arquivos HTML: Copie para `/public/`

**Exemplo após modificar um arquivo:**
```bash
# Após modificar style.css
cp css/style.css public/css/style.css

# Após modificar app.js
cp js/app.js public/js/app.js

# Após modificar login.html
cp login.html public/login.html
```

**Por que isso acontece:**
- O servidor mapeia `/css` → `./css` e `/js` → `./js` (compatibilidade)
- Também serve `/public` como pasta estática
- Mudanças só aparecem quando arquivos estão em AMBOS os lugares

## 🐛 DEBUGGING:

### Para verificar dados de usuários:
- Use scripts de debug temporários
- Nunca exponha hashes de senha em logs
- Delete scripts de teste após uso

### Banco de dados:
- Tabela `study_plans`: usa `plan_name` (não `name` ou `exam_name`)
- Tabela `study_sessions`: usa `time_studied_seconds`
- Tabela `study_time_logs`: usa `duration_seconds`

## ⚡ PERFORMANCE:

### Sempre:
- Reinicie o servidor após mudanças em arquivos .js do backend
- Limpe cache do navegador se mudanças não aparecerem
- Use `Ctrl+F5` para forçar recarga sem cache

## 🚨 INCIDENTE DE SEGURANÇA (15/08/2025):

### O que aconteceu:
- Claude commitou arquivo `.env` com credenciais reais
- GitGuardian detectou exposição de:
  - Google OAuth credentials
  - Gmail SMTP password

### Lição aprendida:
- **SEMPRE** verificar `git status` antes de commitar
- **NUNCA** usar `git add .` sem revisar
- **SEMPRE** manter `.env` no `.gitignore`

### Prevenção:
- Este arquivo serve como lembrete permanente
- Verificar 3x antes de qualquer commit
- Na dúvida, pergunte ao usuário

---
**Última atualização:** 16/08/2025
**Motivos:** 
- Prevenção de exposição de credenciais após incidente de segurança
- Documentação sobre duplicação de arquivos estáticos (pasta public)