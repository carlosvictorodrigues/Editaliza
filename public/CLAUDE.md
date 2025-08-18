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

## 🔄 PREVENÇÃO DE EFEITOS COLATERAIS - REGRAS CRÍTICAS:

### ⚠️ REGRA DE OURO: MUDANÇAS CIRÚRGICAS
**NUNCA remova funcionalidades ao tentar resolver um problema específico**

### 📋 CHECKLIST ANTES DE QUALQUER CORREÇÃO:

#### 1. **ANÁLISE DE IMPACTO** (OBRIGATÓRIO):
```
❓ O que exatamente está quebrado?
❓ O que está funcionando que NÃO deve ser afetado?
❓ Quais outras funcionalidades dependem do que vou modificar?
❓ Existem múltiplos sistemas interagindo aqui?
```

#### 2. **IDENTIFICAÇÃO PRECISA** (OBRIGATÓRIO):
```
✅ Identifique a CAUSA RAIZ específica
✅ Separe o problema real de sintomas secundários
✅ Liste TODAS as funcionalidades relacionadas
✅ Documente o estado atual vs estado desejado
```

#### 3. **ESTRATÉGIA CIRÚRGICA** (OBRIGATÓRIO):
```
✅ Use seletores CSS/JS específicos, não genéricos
✅ Prefira `.classe-problema-especifico` em vez de `.tema-*`
✅ Use condicionais em vez de remoções totais
✅ Mantenha funcionalidades core intactas
```

### 🎯 EXEMPLOS DE BOAS PRÁTICAS:

#### ❌ **ERRADO** - Remoção Total:
```css
/* Remove TUDO relacionado a tema */
.theme-toggle, .theme-switch { display: none !important; }
```

#### ✅ **CORRETO** - Remoção Cirúrgica:
```css
/* Remove APENAS elementos fixos problemáticos */
.theme-toggle[style*="position: fixed"] { display: none !important; }
/* Mantém funcionalidade de navegação */
.theme-toggle-nav { display: inline-flex !important; }
```

#### ❌ **ERRADO** - Substituição Destrutiva:
```javascript
// Remove toda funcionalidade de tema
allToggles.forEach(toggle => toggle.remove());
```

#### ✅ **CORRETO** - Substituição Seletiva:
```javascript
// Remove apenas elementos problemáticos específicos
const problematicToggles = document.querySelectorAll('.floating-theme, .fab-theme');
problematicToggles.forEach(toggle => toggle.remove());
// Mantém navegação funcional
```

### 🚨 SINAIS DE ALERTA - PARE IMEDIATAMENTE:

#### Quando ver estes padrões, RECONSIDERE:
```
🚩 Usando seletores muito amplos (.theme-*, .btn-*, a { })
🚩 Removendo arquivos/scripts inteiros
🚩 Comentando grandes blocos de código
🚩 Usando !important em tudo
🚩 "display: none" em classes genéricas
🚩 Substituindo sistemas inteiros por "soluções simples"
```

### 🔍 METODOLOGIA DE TESTE PROGRESSIVO:

#### Sempre siga esta ordem:
```
1. TESTE a funcionalidade atual (anote o que funciona)
2. IMPLEMENTE a menor mudança possível
3. TESTE novamente (confirme que o problema foi resolvido)
4. TESTE funcionalidades relacionadas (confirme que não quebrou)
5. Se quebrou algo, REVERTA e tente abordagem mais específica
```

### 📝 DOCUMENTAÇÃO DE MUDANÇAS:

#### Para cada correção, documente:
```
✅ Problema original: "Barra branca fixa aparecendo"
✅ Funcionalidades mantidas: "Toggle de tema na navegação"
✅ Estratégia: "Remover apenas elementos fixos, manter navegação"
✅ Impacto: "Sem efeitos colaterais identificados"
```

### 🔗 PRINCÍPIO DE DEPENDÊNCIAS:

#### Sempre considere:
```
❓ Este elemento é usado por outros sistemas?
❓ Outras partes do código dependem desta classe/função?
❓ Existem eventos/listeners que podem quebrar?
❓ O CSS/JS tem hierarquias que podem ser afetadas?
```

### ⚡ RECUPERAÇÃO RÁPIDA:

#### Se quebrou algo acidentalmente:
```
1. PARE imediatamente
2. IDENTIFIQUE exatamente o que quebrou
3. REVERTA a última mudança
4. REAVALIE a abordagem
5. IMPLEMENTE versão mais cirúrgica
```

### 🎯 MANTRA PARA LEMBRAR:
**"Correção cirúrgica: resolva o problema específico sem afetar funcionalidades que já funcionam"**

## 🎨 CORREÇÕES DE UI/CSS - ABORDAGEM DIRETA:

### 🚀 QUANDO RESOLVER PROBLEMAS DE CORES/ESTILOS:

#### 1. **IDENTIFICAÇÃO RÁPIDA DO PROBLEMA**:
```
✅ Localizar EXATAMENTE onde está o elemento (arquivo e linha)
✅ Verificar se há CSS inline, classes ou variáveis CSS
✅ Usar Grep para encontrar todas as ocorrências
✅ Ler o arquivo para entender o contexto
```

#### 2. **APLICAÇÃO DIRETA DA SOLUÇÃO**:
```
✅ Para cores: Use valores hexadecimais diretos (#ffffff, #374151, etc.)
✅ Para forçar estilos: Use inline styles com !important quando necessário
✅ Para remover estilos: Use 'transparent' ou 'none' conforme apropriado
✅ Para variáveis CSS não definidas: Substitua por valores diretos
```

#### 3. **PADRÕES COMUNS DE CORREÇÃO**:

##### Cor de texto em botões/cards:
```html
<!-- Adicione inline style para garantir -->
style="color: white !important;"
```

##### Remover cor de fundo:
```css
background: transparent;  /* em vez de background: white; */
```

##### Cor de bordas/linhas divisórias:
```css
border-color: #d1d5db;  /* cinza claro em vez de preto */
border-bottom: 1px solid #d1d5db;
```

##### Elementos ativos/selecionados:
```css
.nav-link-active {
    background: linear-gradient(135deg, #0528f2, #3b82f6) !important;
    color: white !important;
}
```

### 📌 EXEMPLOS PRÁTICOS RECENTES:

#### Problema: "Botão com texto preto, precisa ser branco"
**Solução imediata:**
```javascript
<button style="color: white !important;">
    <span style="color: white !important;">Texto</span>
</button>
```

#### Problema: "Linha divisória preta está feia"
**Solução imediata:**
```javascript
border-bottom: 1px solid #d1d5db;  /* cinza claro */
```

#### Problema: "Botão com fundo cinza indesejado"
**Solução imediata:**
```css
background: transparent;  /* remove o fundo */
```

### ⚡ VELOCIDADE DE RESOLUÇÃO:
```
1. NÃO tente entender todo o sistema de estilos
2. FOQUE no elemento específico mencionado
3. USE força bruta com !important se necessário
4. COPIE sempre para /public após mudanças
5. TESTE uma correção por vez
```

### 🔥 LEMBRE-SE:
**Quando o usuário reporta problemas de cores/estilos visuais:**
- Vá direto ao ponto
- Use inline styles com !important
- Não perca tempo com soluções "elegantes"
- Resolva primeiro, refatore depois (se necessário)
- SEMPRE copie para /public

---
**Última atualização:** 18/08/2025
**Motivos:** 
- Prevenção de exposição de credenciais após incidente de segurança
- Documentação sobre duplicação de arquivos estáticos (pasta public)
- Prevenção de efeitos colaterais ao corrigir problemas (toggle de tema removido acidentalmente)
- **NOVO:** Abordagem direta para correções de UI/CSS baseada em sucessos recentes