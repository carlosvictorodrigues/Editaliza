# 🤖 INSTRUÇÕES PARA CLAUDE - FLUXO DE DESENVOLVIMENTO PROFISSIONAL

## ⚠️ FILOSOFIA DE TRABALHO - CRÍTICO!

### 🎯 PRINCÍPIO FUNDAMENTAL: MENOR INTERVENÇÃO POSSÍVEL
**SEMPRE aplique a menor mudança necessária para resolver o problema específico.**
- ❌ NÃO crie novos problemas ao resolver um existente
- ❌ NÃO faça mudanças bruscas que afetam outras partes
- ❌ NÃO adicione complexidade desnecessária
- ✅ Se uma mudança não resolveu, DESFAÇA-A imediatamente
- ✅ Atenda SOMENTE ao problema informado
- ✅ Teste SEMPRE o impacto da mudança em outras funcionalidades

### 📝 CHECKLIST ANTES DE QUALQUER MUDANÇA:
1. Esta é a menor mudança possível?
2. Isso pode quebrar algo que já funciona?
3. Testei o impacto em outras partes?
4. Se não funcionar, é fácil reverter?

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

### Banco de Dados PostgreSQL:

#### 🏠 DESENVOLVIMENTO LOCAL:
- Host: `127.0.0.1`
- Porta: `5432`
- Banco: `editaliza_db`
- Usuário: `editaliza_user`
- Senha: `1a2b3c4d`

#### 🌐 PRODUÇÃO (DigitalOcean):
- Host: `localhost`
- Porta: `5432`
- Banco: `editaliza_db`
- Usuário: `editaliza_user`
- Senha: `Editaliza@2025#Secure`

### ⚠️ Tabelas Necessárias:
- users (com coluna `password_hash`)
- sessions
- schedules
- plans
- tasks
- progress
- oauth_providers
- study_plans

## 🤖 USANDO GEMINI COMO ASSISTENTE INTEGRADO

### 🚀 MCP Gemini CONECTADO E ATIVO!

O Gemini está agora integrado ao Claude através do MCP (Model Context Protocol) e será usado como assistente para:
- 🔍 **Análise profunda de código** - Aproveitar a janela de contexto longa do Gemini
- 🐛 **Debugging avançado** - Analisar logs e identificar problemas complexos
- 📊 **Revisão de arquitetura** - Avaliar design patterns e estrutura do código
- 🔒 **Análise de segurança** - Identificar vulnerabilidades e sugerir correções
- 🎯 **Otimização de performance** - Encontrar gargalos e sugerir melhorias
- 📝 **Geração de documentação** - Criar docs detalhadas aproveitando o contexto amplo

### 🔧 Como o Claude Usa o Gemini:

#### Via MCP (Integrado):
```python
# Claude usa automaticamente o Gemini para análises complexas
mcp__gemini__gemini_ask(
    prompt="Analise este código e sugira melhorias",
    system="Você é um expert em Node.js e PostgreSQL"
)
```

#### Casos de Uso Práticos:
1. **Antes de Deploy:**
   - Revisão completa do código
   - Análise de impacto das mudanças
   - Identificação de possíveis regressões

2. **Durante Debugging:**
   - Análise de stack traces complexas
   - Correlação de logs dispersos
   - Identificação de memory leaks

3. **Otimização de Queries:**
   - Análise de planos de execução
   - Sugestões de índices
   - Refatoração de queries lentas

### 🔧 Configuração do MCP Gemini no Claude Code (VS Code)

#### Configuração Atual:
O MCP Gemini está configurado para funcionar com o Claude Code no VS Code através do arquivo `.claude.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "type": "stdio",
      "command": "npx",
      "args": ["@gmickel/gemini-cli@latest", "mcp"],
      "env": {
        "GEMINI_API_KEY": "AIzaSyD3qgG6NREyKUPgTdKuYPZ_vBO80BUBgx8"
      }
    }
  }
}
```

#### Status da Integração:
✅ **MCP Gemini CONECTADO** - Pronto para análises avançadas
✅ **Janela de contexto longa disponível** - Ideal para arquivos grandes
✅ **Integração automática** - Claude usa Gemini proativamente

### 📊 Estratégias de Uso:

#### 1. Análise de Código Complexo:
```bash
# Claude + Gemini analisam todo o backend
# Gemini processa arquivos grandes, Claude coordena as mudanças
```

#### 2. Debug de Problemas Difíceis:
```bash
# Claude identifica o problema
# Gemini analisa contexto amplo de logs
# Claude implementa a solução
```

#### 3. Refatoração Massiva:
```bash
# Gemini mapeia todas as dependências
# Claude planeja a refatoração
# Execução coordenada com validações
```

### 🎯 Comandos Úteis:

```bash
# Verificar status do MCP
/mcp

# Ver ferramentas disponíveis
# Claude tem acesso a: mcp__gemini__gemini_ask

# Para análises específicas, Claude usará automaticamente
```

### 📌 Notas Importantes:
- O MCP Gemini está **ATIVO e CONECTADO**
- Claude usará Gemini automaticamente quando apropriado
- A janela de contexto longa do Gemini é ideal para análises complexas
- Integração transparente - você não precisa chamar o Gemini diretamente

## 📧 CREDENCIAIS DE SERVIÇOS

### StayCloud (Email Service):
- **Email:** editalizaconcursos@gmail.com
- **Senha:** @Editaliza2025
- **Uso:** Serviço de email para notificações do sistema

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