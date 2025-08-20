# 🤖 INSTRUÇÕES CRÍTICAS PARA CLAUDE

## 🚀 MODO DEPLOY - TRABALHE NO SERVIDOR:

### ⚠️ IMPORTANTE - ESTAMOS EM PRODUÇÃO:
- **SEMPRE** use `ssh editaliza` para trabalhar no servidor
- **NUNCA** faça alterações apenas localmente
- **SEMPRE** atualize os arquivos diretamente no servidor de produção

### Comandos essenciais:
```bash
# Conectar ao servidor
ssh editaliza

# Navegar para o diretório do projeto
cd /root/editaliza

# Ver logs do servidor
pm2 logs editaliza-app --lines 100

# Reiniciar servidor após mudanças
pm2 restart editaliza-app

# Verificar status
pm2 status
```

### Fluxo de trabalho em produção:
1. Conecte ao servidor: `ssh editaliza`
2. Faça as alterações necessárias em `/root/editaliza`
3. Para arquivos públicos, copie também para `/var/www/html`
4. Reinicie o servidor: `pm2 restart editaliza-app`
5. Verifique logs: `pm2 logs editaliza-app`

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
- `ACESSO_COMPLETO.md`
- `COMANDOS_RAPIDOS.md`
- `ESTADO_SISTEMA.md`
- `DIGITALOCEAN_*.md`
- `PRODUCTION_*.md`
- `DEPLOY_*.md`
- `*_CREDENTIALS.md`
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
- **IMPORTANTE**: O sistema usa **PostgreSQL**, NÃO SQLite!
- **NUNCA** use SQLite ou referencias a `db.sqlite`
- Configuração do PostgreSQL está em `.env` (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- Tabela `study_plans`: usa `plan_name` (não `name` ou `exam_name`)
- Tabela `study_sessions`: usa `time_studied_seconds`
- Tabela `study_time_logs`: usa `duration_seconds`

## ⚡ PERFORMANCE:

### Sempre:
- Reinicie o servidor após mudanças em arquivos .js do backend
- Limpe cache do navegador se mudanças não aparecerem
- Use `Ctrl+F5` para forçar recarga sem cache

## 🤖 USANDO GEMINI COMO SEU ASSISTENTE DE IA:

### 🎯 QUANDO USAR O GEMINI:
Use o Gemini como seu copiloto para:
- **Análise de erros complexos**: Envie logs e stack traces para o Gemini analisar
- **Segunda opinião**: Valide suas soluções antes de implementar
- **Debugging difícil**: Quando precisar de outra perspectiva sobre um bug
- **Revisão de código**: Peça ao Gemini para revisar código crítico
- **Análise de performance**: Identifique gargalos e otimizações
- **Pesquisa de soluções**: Quando não souber como resolver algo específico

### 📝 MÉTODO 1 - Via Bash (FUNCIONANDO):
```bash
# Use o modelo gemini-2.5-flash para respostas rápidas
gemini -p "sua pergunta aqui" -m gemini-2.5-flash

# Use o modelo gemini-2.5-pro para análises complexas
gemini -p "sua pergunta aqui" -m gemini-2.5-pro

# Exemplos práticos:

# 1. Analisar erro do servidor
ssh editaliza "pm2 logs --lines 100" | gemini -p "Analise estes logs e identifique o problema principal. Sugira solução específica." -m gemini-2.5-pro

# 2. Revisar código antes de aplicar
cat server.js | gemini -p "Revise este código focando em: 1) Segurança 2) Performance 3) Possíveis bugs. Liste apenas problemas críticos." -m gemini-2.5-pro

# 3. Debugar problema específico
echo "Erro: OAuth callback não mantém sessão após login" | gemini -p "$(cat) - Considerando que uso Redis para sessões e cookies com domain .editaliza.com.br, quais são as causas mais prováveis?" -m gemini-2.5-pro

# 4. Validar solução antes de implementar
echo "Vou corrigir o OAuth adicionando req.session.save() antes do redirect" | gemini -p "$(cat) - Esta solução está correta? Há riscos ou melhores alternativas?" -m gemini-2.5-pro

# 5. Analisar arquivo específico do servidor
ssh editaliza "cat /root/editaliza/src/controllers/oauthController.js" | gemini -p "Identifique problemas neste controller OAuth. Foque em: falhas de segurança, erros de lógica, e problemas de sessão." -m gemini-2.5-pro
```

### 🔧 MÉTODO 2 - Via MCP (NO CLAUDE CODE VS CODE):
```python
# NOTA: Requer reiniciar VS Code após configuração
# Use após configurar com: claude mcp add -s user gemini-cli gemini -- mcp
mcp__gemini-cli__ask-gemini(
    prompt="sua pergunta aqui",
    model="gemini-2.5-flash",  # Use flash para respostas rápidas
    changeMode=False  # Use True apenas para sugestões de edição estruturadas
)

# Modelo Pro para análises complexas:
mcp__gemini-cli__ask-gemini(
    prompt="análise complexa aqui",
    model="gemini-2.5-pro",
    changeMode=False
)
```

### 💡 DICAS DE USO EFETIVO:

#### Para Debug de Erros:
```bash
# Combine contexto + erro + pergunta específica
ssh editaliza "pm2 logs --lines 50 | grep -A5 -B5 'error'" | gemini -p "Contexto: Sistema de autenticação OAuth com Redis. Erro aparece após callback do Google. Analise e sugira correção específica." -m gemini-2.5-pro
```

#### Para Revisão de Segurança:
```bash
# Foque em vulnerabilidades específicas
cat src/routes/authRoutes.js | gemini -p "Revise APENAS aspectos de segurança: SQL injection, XSS, CSRF, exposição de dados sensíveis. Liste apenas problemas encontrados com severidade." -m gemini-2.5-pro
```

#### Para Otimização:
```bash
# Peça métricas e sugestões práticas
cat server.js | gemini -p "Identifique os 3 principais gargalos de performance neste código. Para cada um, sugira uma correção específica com exemplo de código." -m gemini-2.5-pro
```

### ⚠️ LIMITAÇÕES E CUIDADOS:

1. **Rate Limits**: Gemini tem limite de requisições. Use com moderação.
2. **Contexto**: Sempre forneça contexto específico do problema
3. **Validação**: Sempre valide sugestões do Gemini antes de aplicar
4. **Segurança**: NUNCA envie credenciais ou dados sensíveis ao Gemini
5. **Especificidade**: Faça perguntas específicas para respostas melhores

### 🚀 WORKFLOW RECOMENDADO:

1. **Identifique o problema** nos logs ou código
2. **Prepare o contexto** relevante (não envie arquivos inteiros desnecessariamente)
3. **Formule pergunta específica** com objetivo claro
4. **Analise a resposta** do Gemini criticamente
5. **Implemente com cuidado** testando cada mudança
6. **Valide o resultado** antes de considerar resolvido

### 📊 CASOS DE USO COMPROVADOS:

```bash
# 1. OAuth não mantendo sessão (RESOLVIDO)
ssh editaliza "cat src/controllers/oauthController.js" | gemini -p "O usuário faz login mas a sessão não persiste. Usando Redis + express-session. Identifique o problema específico no callback." -m gemini-2.5-pro

# 2. Memory leak em produção (RESOLVIDO)
ssh editaliza "pm2 monit" | gemini -p "Aplicação Node.js com memory leak. Memória cresce 100MB/hora. Quais são as causas mais comuns e como diagnosticar?" -m gemini-2.5-pro

# 3. Performance ruim no dashboard (RESOLVIDO)
cat public/js/dashboard.js | gemini -p "Dashboard lento com 1000+ items. Sugira implementação de virtualização ou paginação. Código exemplo específico." -m gemini-2.5-pro
```

### 🔄 CONFIGURAÇÃO DO MCP PARA CLAUDE CODE (VS Code):

#### Método 1 - Configuração Automática (RECOMENDADO):
```bash
# Adicionar Gemini como servidor MCP
claude mcp add -s user gemini-cli gemini -- mcp

# Configurar API key como variável de ambiente permanente
setx GEMINI_API_KEY "sua-api-key-aqui"

# Verificar se está funcionando
claude mcp list

# Reiniciar VS Code após configuração
```

#### Método 2 - Para Claude Desktop:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "C:\\Users\\Gabriel\\AppData\\Roaming\\npm\\gemini.cmd",
      "args": ["mcp"],
      "env": {
        "GEMINI_API_KEY": "sua-api-key-aqui"
      }
    }
  }
}
```
Local: `~/AppData/Roaming/Claude/claude_desktop_config.json`
Após salvar: Reiniciar Claude Desktop

### 📈 MÉTRICAS DE SUCESSO:
- ✅ Problemas resolvidos mais rápido com segunda opinião
- ✅ Bugs críticos identificados antes de produção
- ✅ Código mais seguro após revisão
- ✅ Performance melhorada com sugestões específicas

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
**Última atualização:** 20/08/2025 (v2)
**Motivos:** 
- Atualizado configuração do Gemini para Claude Code (VS Code)
- Corrigido comandos de instalação MCP: `claude mcp add`
- Ajustado modelos recomendados (flash para rápido, pro para complexo)
- Adicionado instruções para configurar variável de ambiente GEMINI_API_KEY
- Diferenciado configuração entre Claude Code e Claude Desktop