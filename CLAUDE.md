# 🤖 INSTRUÇÕES PARA CLAUDE - FLUXO DE DESENVOLVIMENTO PROFISSIONAL

## 🔄 FLUXO DE DESENVOLVIMENTO (GitFlow Simplificado)

### 📌 REGRA DE OURO: 
**NUNCA faça mudanças diretamente no servidor!**  
**SEMPRE desenvolva localmente → teste → commit → push → deploy**

### 🎯 Fluxo de Trabalho Profissional:

```mermaid
LOCAL (desenvolvimento) → GitHub (repositório) → SERVIDOR (produção)
```

#### 1️⃣ **DESENVOLVIMENTO LOCAL**
```bash
# Sempre comece sincronizando com o repositório
git pull origin main

# Crie uma branch para sua feature/fix
git checkout -b feature/nova-funcionalidade
# ou
git checkout -b fix/corrigir-bug

# Desenvolva e teste localmente
npm run dev
npm test
```

#### 2️⃣ **COMMIT E PUSH**
```bash
# Adicione suas mudanças
git add .

# Commit com mensagem descritiva
git commit -m "feat: adicionar sistema de notificações"
# ou
git commit -m "fix: corrigir memory leak no servidor"

# Push para o GitHub
git push origin feature/nova-funcionalidade
```

#### 3️⃣ **PULL REQUEST (Opcional mas Recomendado)**
- Crie PR no GitHub para revisão
- Faça merge após aprovação
- Delete a branch após merge

#### 4️⃣ **DEPLOY PARA PRODUÇÃO**
```bash
# No servidor, atualize o código
ssh editaliza "cd /root/editaliza && git pull origin main"

# Instale dependências se necessário
ssh editaliza "cd /root/editaliza && npm install --production"

# Reinicie a aplicação
ssh editaliza "pm2 restart editaliza-app"

# Verifique os logs
ssh editaliza "pm2 logs editaliza-app --lines 50"
```

## 🏢 COMO AS EMPRESAS FAZEM (Best Practices)

### 🔧 **Ambientes Separados**
1. **Local** - Desenvolvimento
2. **Staging** - Testes/Homologação  
3. **Production** - Produção

### 🚀 **CI/CD Pipeline**
```yaml
# Exemplo de GitHub Actions
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - Checkout código
      - Rodar testes
      - Build
      - Deploy automático
```

### 🛡️ **Proteções**
- Branch `main` protegida
- Code review obrigatório
- Testes automáticos
- Deploy automático após merge

## 📋 CHECKLIST PRÉ-DEPLOY

### ✅ Antes de fazer push:
- [ ] Código testado localmente
- [ ] Testes passando (`npm test`)
- [ ] Linter sem erros (`npm run lint`)
- [ ] Sem console.log desnecessários
- [ ] Sem credenciais hardcoded
- [ ] Package.json atualizado

### ✅ Após o deploy:
- [ ] Verificar logs do PM2
- [ ] Testar funcionalidades críticas
- [ ] Monitorar memória/CPU
- [ ] Verificar health check

## 🔴 NUNCA FAÇA ISSO:

1. ❌ **Editar arquivos direto no servidor**
2. ❌ **Commitar credenciais (.env)**
3. ❌ **Deploy sem testar**
4. ❌ **Force push na main**
5. ❌ **Deploy sexta-feira às 18h**

## 🟢 SEMPRE FAÇA ISSO:

1. ✅ **Desenvolva em branches**
2. ✅ **Teste antes de commitar**
3. ✅ **Use mensagens de commit descritivas**
4. ✅ **Documente mudanças importantes**
5. ✅ **Monitore após deploy**

## 🚨 COMANDOS DE EMERGÊNCIA

### Se algo der errado no deploy:
```bash
# Reverter para versão anterior
ssh editaliza "cd /root/editaliza && git reset --hard HEAD~1"
ssh editaliza "pm2 restart editaliza-app"

# Ver últimos deploys
ssh editaliza "cd /root/editaliza && git log --oneline -10"

# Rollback para commit específico
ssh editaliza "cd /root/editaliza && git reset --hard <commit-hash>"
```

## 📊 MONITORAMENTO

### Comandos úteis:
```bash
# Status da aplicação
ssh editaliza "pm2 status"

# Logs em tempo real
ssh editaliza "pm2 logs editaliza-app"

# Monitorar recursos
ssh editaliza "pm2 monit"

# Health check
curl https://app.editaliza.com.br/health
```

## 🔧 CONFIGURAÇÃO ATUAL

### Repositório GitHub:
- URL: `https://github.com/carlosvictorodrigues/Editaliza`
- Branch principal: `main`

### Servidor DigitalOcean:
- IP: 161.35.127.123
- Diretório: `/root/editaliza`
- PM2 App: `editaliza-app`
- Porta: 3000

### Banco de Dados:
- PostgreSQL (local no servidor)
- Nome: `editaliza_db`
- Usuário: `editaliza_user`

## 🤖 USANDO GEMINI COMO ASSISTENTE

### 🔧 Configuração do MCP Gemini no Claude Code (VS Code)

#### Configuração Atual:
O MCP Gemini está configurado para funcionar com o Claude Code no VS Code através do arquivo `.claude.json`:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "type": "stdio",
      "command": "npx",
      "args": ["@google/gemini-cli", "mcp-server"],
      "env": {
        "GEMINI_API_KEY": "AIzaSyD3qgG6NREyKUPgTdKuYPZ_vBO80BUBgx8"
      }
    }
  }
}
```

#### Para Reconfigurar (se necessário):
```bash
# Remover configuração antiga
claude mcp remove gemini-cli

# Adicionar nova configuração
claude mcp add gemini-cli npx @google/gemini-cli mcp-server

# Editar manualmente .claude.json para adicionar a API key
```

#### Verificar Status:
```bash
# Listar MCPs configurados
claude mcp list

# Ver detalhes do MCP
/mcp
```

#### Ativar o MCP:
1. Após configurar, recarregue o VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. O MCP deve conectar automaticamente
3. Se não conectar, verifique os logs no VS Code

### Para análise e debugging via Bash:
```bash
# Analisar logs de erro
ssh editaliza "pm2 logs --lines 100" | gemini -p "Analise estes logs e identifique o problema" -m gemini-2.5-flash

# Revisar código antes de deploy
cat server.js | gemini -p "Revise este código para problemas de segurança e performance" -m gemini-2.5-flash
```

### 📌 Notas Importantes:
- O MCP funciona diferente no Claude Code (VS Code) vs Claude Desktop
- A configuração fica em `C:\Users\Gabriel\.claude.json` no escopo do projeto
- Use `npx` para garantir sempre a versão mais recente do gemini-cli
- Se houver problemas de conexão, reinstale: `npm install -g @google/gemini-cli@latest`

## 📝 CONVENÇÕES DE COMMIT

Use Conventional Commits:
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Tarefas gerais

## 🔐 SEGURANÇA

### Checklist de segurança:
- [ ] Variáveis de ambiente no `.env`
- [ ] `.env` no `.gitignore`
- [ ] Secrets no GitHub Secrets (para CI/CD)
- [ ] HTTPS habilitado
- [ ] Rate limiting configurado
- [ ] CORS configurado corretamente

---
**Última atualização:** 20/08/2025
**Versão:** 3.0 - Fluxo Profissional de Desenvolvimento