# 🤖 GUIA DE AGENTES DO EDITALIZA

## 🎯 Visão Geral

O projeto Editaliza agora conta com **38 agentes especializados** (36 originais + 2 personalizados) integrados ao Claude Code para acelerar o desenvolvimento. Cada agente é especializado em uma área específica e pode ser ativado automaticamente ou sob demanda.

## ⚙️ Configuração

### Arquivo de Configuração (`.claude.json`)
```json
{
  "agentDirectory": "./agents",
  "agents": {
    "enabled": true,
    "proactiveAgents": [
      "studio-coach",
      "test-writer-fixer", 
      "whimsy-injector",
      "experiment-tracker"
    ],
    "contextualAgents": {
      "editaliza-frontend": ["frontend-developer", "ui-designer", "ux-researcher"],
      "editaliza-backend": ["backend-architect", "devops-automator", "api-tester"],
      "editaliza-features": ["rapid-prototyper", "ai-engineer", "performance-benchmarker"],
      "editaliza-business": ["feedback-synthesizer", "analytics-reporter", "growth-hacker"],
      "editaliza-launch": ["app-store-optimizer", "content-creator", "project-shipper"]
    }
  }
}
```

### Estrutura de Diretórios
```
agents/
├── engineering/ (7 agentes + 1 personalizado)
├── product/ (3 agentes + 1 personalizado)  
├── design/ (5 agentes)
├── marketing/ (7 agentes)
├── project-management/ (3 agentes)
├── studio-operations/ (5 agentes)
├── testing/ (5 agentes)
└── bonus/ (2 agentes)
```

## 🚀 Como Usar os Agentes

### 1. Ativação Automática (Proativa)
Alguns agentes são ativados automaticamente em contextos específicos:

- **studio-coach**: Ativa em tarefas complexas multi-agentes
- **test-writer-fixer**: Ativa após implementações de código
- **whimsy-injector**: Ativa após mudanças na UI/UX
- **experiment-tracker**: Ativa quando feature flags são adicionadas

### 2. Ativação Manual (Explícita)
Você pode chamar agentes específicos mencionando seus nomes:

```
"Use o rapid-prototyper para criar um sistema de flashcards"
"Preciso que o feedback-synthesizer analise esses comentários dos usuários"
"O backend-architect pode revisar esta API?"
```

### 3. Ativação Contextual
O Claude Code ativa agentes automaticamente baseado no contexto:

- **Trabalhando no frontend** → `frontend-developer`, `ui-designer`
- **Problemas de performance** → `performance-benchmarker`
- **Deploy e DevOps** → `devops-automator`, `infrastructure-maintainer`

## 🎯 Agentes Prioritários para o Editaliza

### 🔧 **Desenvolvimento (Engineering)**

#### `editaliza-rapid-prototyper` ⭐ PERSONALIZADO
- **Quando usar**: Criar funcionalidades educacionais específicas
- **Especialidade**: Cronogramas, gamificação, algoritmos de estudo
- **Exemplo**: "Implementar sistema de spaced repetition para revisões"

#### `backend-architect`
- **Quando usar**: Arquitetura de APIs, database design, scalability
- **Exemplo**: "Preciso otimizar as queries do cronograma para 100k+ usuários"

#### `frontend-developer`
- **Quando usar**: Melhorias na interface, componentes JS
- **Exemplo**: "Criar componente de timer mais responsivo"

#### `test-writer-fixer`
- **Quando usar**: Escrever testes, debugar problemas
- **Exemplo**: "Criar testes para o sistema de autenticação OAuth"

### 📊 **Produto (Product)**

#### `editaliza-feedback-synthesizer` ⭐ PERSONALIZADO
- **Quando usar**: Analisar feedback de concurseiros
- **Especialidade**: UX educacional, motivação, gamificação
- **Exemplo**: "Usuários reclamam que o cronograma não se adapta aos atrasos"

#### `trend-researcher`
- **Quando usar**: Identificar oportunidades no mercado de concursos
- **Exemplo**: "Que funcionalidades estão trending em apps educacionais?"

#### `sprint-prioritizer`
- **Quando usar**: Planejar sprints, priorizar features
- **Exemplo**: "Temos 10 features pedidas, qual priorizar para próximo sprint?"

### 🎨 **Design e UX**

#### `ui-designer`
- **Quando usar**: Melhorar interfaces, criar componentes visuais
- **Exemplo**: "Redesenhar dashboard de progresso dos estudos"

#### `ux-researcher`
- **Quando usar**: Entender comportamento dos usuários
- **Exemplo**: "Por que usuários abandonam após criar o cronograma?"

#### `whimsy-injector`
- **Quando usar**: Adicionar elementos de delight
- **Exemplo**: "Tornar as notificações de conquistas mais envolventes"

### 📈 **Marketing e Growth**

#### `growth-hacker`
- **Quando usar**: Estratégias de crescimento, viral loops
- **Exemplo**: "Como fazer usuários compartilharem seus progressos?"

#### `content-creator`
- **Quando usar**: Criar conteúdo para redes sociais, blog
- **Exemplo**: "Criar posts sobre técnicas de estudo para Instagram"

### 🔍 **Operações e Analytics**

#### `analytics-reporter`
- **Quando usar**: Analisar métricas, criar dashboards
- **Exemplo**: "Criar relatório de engagement dos últimos 30 dias"

#### `performance-benchmarker`
- **Quando usar**: Otimizar performance, load testing
- **Exemplo**: "Por que o dashboard demora para carregar?"

## 📋 Workflows Recomendados

### 🚀 **Implementando Nova Feature**
1. `trend-researcher` - Validar oportunidade
2. `editaliza-rapid-prototyper` - Criar MVP
3. `test-writer-fixer` - Escrever testes
4. `ui-designer` - Polir interface
5. `analytics-reporter` - Implementar tracking

### 🐛 **Corrigindo Bug Crítico**
1. `backend-architect` - Analisar problema
2. `test-writer-fixer` - Reproduzir e corrigir
3. `devops-automator` - Deploy da correção
4. `analytics-reporter` - Monitorar impacto

### 📊 **Analisando Feedback de Usuários**
1. `editaliza-feedback-synthesizer` - Analisar feedback
2. `ux-researcher` - Investigar problemas UX
3. `sprint-prioritizer` - Priorizar melhorias
4. `project-shipper` - Planejar execução

### 🎯 **Melhorando Engagement**
1. `feedback-synthesizer` - Entender desengajamento
2. `whimsy-injector` - Adicionar elementos motivacionais
3. `growth-hacker` - Criar viral loops
4. `analytics-reporter` - Medir impacto

## 💡 Dicas de Uso

### ✅ **Boas Práticas**
- Seja específico sobre o contexto educacional
- Mencione se é para concurseiros especificamente
- Inclua dados relevantes (métricas, feedback, etc.)
- Deixe agentes trabalharem em conjunto
- Use agentes personalizados para contexto do Editaliza

### ❌ **Evite**
- Usar agentes genéricos para problemas específicos do Editaliza
- Misturar contextos (educacional vs comercial genérico)
- Ignorar agentes proativos quando ativarem
- Pedir para agentes fazerem trabalho fora de sua especialidade

## 📈 Exemplos Práticos

### **Cenário 1: Nova Funcionalidade de Revisão**
```
User: "Usuários pedem um sistema de revisão mais inteligente que priorize matérias fracas"

Agentes Ativados:
- editaliza-rapid-prototyper: Implementa algoritmo de priorização
- ai-engineer: Integra ML para detecção de matérias fracas  
- analytics-reporter: Define métricas de sucesso
- test-writer-fixer: Cria testes para o algoritmo
```

### **Cenário 2: Problema de Engagement**
```
User: "Engagement caiu 20% no último mês, usuários estudam menos"

Agentes Ativados:
- editaliza-feedback-synthesizer: Analisa possíveis causas
- analytics-reporter: Identifica patterns nos dados
- whimsy-injector: Propõe elementos motivacionais
- growth-hacker: Sugere estratégias de re-engagement
```

### **Cenário 3: Preparação para Launch**
```
User: "Vamos lançar nova versão, precisa revisar tudo antes do deploy"

Agentes Ativados:
- project-shipper: Coordena checklist de lançamento
- test-writer-fixer: Roda testes completos
- devops-automator: Prepara deploy e monitoring
- content-creator: Prepara materiais de divulgação
```

## 🔧 Troubleshooting

### **Agente não está ativando?**
1. Verifique se está na lista de agentes habilitados
2. Seja mais específico na solicitação
3. Mencione o nome do agente diretamente

### **Múltiplos agentes ativando?**
- Normal para tarefas complexas
- Deixe eles colaborarem
- Use o `studio-coach` para coordenar se necessário

### **Agente dando resposta genérica?**
- Use agentes personalizados (`editaliza-*`) 
- Forneça mais contexto sobre concursos/educação
- Mencione dados específicos do Editaliza

## 📚 Próximos Passos

1. **Teste** os agentes em cenários reais
2. **Monitore** qual agentes são mais úteis
3. **Customize** mais agentes se necessário
4. **Documente** workflows que funcionam bem
5. **Treine** sua equipe nos agentes mais úteis

---

**Última atualização**: 21 de agosto de 2025  
**Status**: ✅ Integração completa e pronta para uso