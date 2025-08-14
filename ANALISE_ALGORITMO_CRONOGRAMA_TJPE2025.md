# ANÁLISE CRÍTICA: ALGORITMO DE CRONOGRAMA TJPE2025

## RESUMO EXECUTIVO

**🔴 CONCLUSÃO: O algoritmo NÃO está respeitando corretamente os pesos das disciplinas**

O usuário está sendo **PREJUDICADO** pela má priorização das disciplinas no plano TJPE2025. A análise quantitativa revelou graves problemas na distribuição de sessões que não condizem com os pesos estabelecidos.

---

## 📊 DADOS ANALISADOS

### Período de Análise
- **Cronograma**: Próximas 3 semanas (14/08 a 02/09/2025)
- **Total de Sessões**: 178 sessões programadas
- **Plano**: TJPE2025 (ID: 1005)
- **Usuário**: 3@3.com (ID: 1000)

### Pesos Esperados vs Realidade
| Disciplina | Peso | Tópicos | Sessões Reais | % do Total | Status |
|------------|------|---------|---------------|------------|--------|
| **Direito Civil** | **5** | 10 | **16** | **9.0%** | 🔴 **CRÍTICO** |
| Direito Administrativo | 4 | 30 | 45 | 25.3% | ⚠️ Excesso |
| Direito Constitucional | 4 | 15 | 22 | 12.4% | ✅ OK |
| Direito Processual Civil | 4 | 21 | 30 | 16.9% | ⚠️ Leve excesso |
| Direito Penal | 4 | 12 | 24 | 13.5% | ✅ OK |
| Direito Processual Penal | 4 | 11 | 15 | 8.4% | ⚠️ Déficit |
| Legislação | 3 | 7 | 9 | 5.1% | 🔴 Déficit crítico |
| Língua Portuguesa | 2 | 17 | 13 | 7.3% | ✅ OK |
| **Raciocínio Lógico** | **1** | 8 | **1** | **0.6%** | 🔴 **EXTREMAMENTE BAIXO** |

---

## 🔍 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **INVERSÃO DE PRIORIDADES** 🔴
- **Direito Civil (Peso 5)** deveria ter a **MAIOR frequência** mas tem apenas 16 sessões (9.0%)
- **Direito Administrativo (Peso 4)** tem 45 sessões (25.3%) - mais que o dobro de Direito Civil
- Esta inversão **prejudica gravemente** a preparação do usuário

### 2. **SUBDISTRIBUIÇÃO EXTREMA** 🔴
- **Raciocínio Lógico**: apenas 1 sessão (0.6% do total) - praticamente ignorado
- **Legislação**: apenas 9 sessões (5.1% do total) - muito abaixo do esperado
- **Direito Civil**: -44.8% abaixo do esperado

### 3. **SUPERDISTRIBUIÇÃO PROBLEMÁTICA** 🟠
- **Direito Administrativo**: +95.7% acima do esperado (45 vs 23 sessões)
- Monopoliza o cronograma em detrimento de disciplinas mais importantes

---

## 📈 ANÁLISE QUANTITATIVA DETALHADA

### Variações em relação ao esperado:
1. **Direito Civil**: **-44.8%** 🔴 (16 sessões vs 29 esperadas)
2. **Direito Administrativo**: **+95.7%** 🔴 (45 sessões vs 23 esperadas) 
3. **Direito Constitucional**: **-4.3%** ✅ (22 sessões vs 23 esperadas)
4. **Direito Processual Civil**: **+30.4%** ⚠️ (30 sessões vs 23 esperadas)
5. **Direito Processual Penal**: **-34.8%** ⚠️ (15 sessões vs 23 esperadas)
6. **Legislação**: **-47.1%** 🔴 (9 sessões vs 17 esperadas)
7. **Língua Portuguesa**: **+18.2%** ✅ (13 sessões vs 11 esperadas)
8. **Raciocínio Lógico**: **-83.3%** 🔴 (1 sessão vs 6 esperadas)

### Padrões Identificados:
- **Disciplinas com mais tópicos** estão sendo super-priorizadas (Direito Administrativo: 30 tópicos = 45 sessões)
- **Disciplinas com menos tópicos** estão sendo sub-priorizadas (Direito Civil: 10 tópicos = 16 sessões)
- O algoritmo parece estar priorizando **quantidade de tópicos** ao invés de **peso da disciplina**

---

## 🔧 DIAGNÓSTICO DO ALGORITMO

### Problema na Fórmula de Distribuição:
```javascript
// ATUAL (PROBLEMÁTICA):
const combinedPriority = Math.max(1, t.subject_priority + t.topic_priority - 3);

// RESULTADO: Não há diferenciação suficiente entre pesos
// Direito Civil (peso 5): prioridade combinada ≈ 5
// Direito Administrativo (peso 4): prioridade combinada ≈ 4  
// Diferença: apenas 25% - INSUFICIENTE
```

### O que está acontecendo:
1. **Fórmula Linear**: A soma simples não cria diferenciação suficiente
2. **Distribuição por Quantidade**: Disciplinas com mais tópicos dominam o cronograma
3. **Embaralhamento Insuficiente**: O shuffle não compensa a má distribuição inicial

---

## 💡 SOLUÇÕES RECOMENDADAS

### 1. **CORREÇÃO IMEDIATA** 🚨
```javascript
// FÓRMULA CORRIGIDA (Uso de Multiplicação):
const combinedPriority = t.subject_priority * (t.topic_priority || 3) * weightMultiplier;

// Onde weightMultiplier seria:
// Peso 5: 3.0x
// Peso 4: 2.0x  
// Peso 3: 1.5x
// Peso 2: 1.0x
// Peso 1: 0.5x
```

### 2. **IMPLEMENTAÇÃO DE COTAS** 📊
- **Direito Civil (Peso 5)**: Mínimo 20% das sessões
- **Pesos 4**: Máximo 15% cada disciplina
- **Raciocínio Lógico (Peso 1)**: Máximo 5% das sessões

### 3. **VALIDAÇÃO PÓS-GERAÇÃO** ✅
```javascript
// Verificar após gerar cronograma:
if (direitoCivilSessions < maxSessionsBySubject) {
    throw new Error("Direito Civil deve ter o maior número de sessões");
}
```

---

## 🎯 IMPACTO NO USUÁRIO

### **PREJUÍZOS ATUAIS**:
- ❌ **Direito Civil subestudado**: -44.8% de sessões
- ❌ **Raciocínio Lógico praticamente ignorado**: apenas 1 sessão
- ❌ **Sobrecarga em Direito Administrativo**: +95.7% de sessões
- ❌ **Preparação desequilibrada** para a prova

### **BENEFÍCIOS APÓS CORREÇÃO**:
- ✅ Priorização correta: Direito Civil em evidência
- ✅ Balanceamento adequado entre todas as disciplinas  
- ✅ Otimização do tempo de estudo
- ✅ Melhor preparação para o concurso

---

## 🚀 PLANO DE AÇÃO

### **FASE 1: CORREÇÃO DO ALGORITMO**
1. Implementar nova fórmula de priorização
2. Adicionar sistema de cotas por peso
3. Implementar validação pós-geração

### **FASE 2: TESTES**
1. Testar com dados TJPE2025
2. Validar distribuição por peso
3. Verificar balanceamento geral

### **FASE 3: RE-GERAÇÃO**
1. Re-gerar cronograma do usuário
2. Validar nova distribuição
3. Monitorar métricas de qualidade

---

## 📋 CHECKLIST DE VALIDAÇÃO

Para considerar o algoritmo **CORRIGIDO**, verificar:

- [ ] **Direito Civil** tem a maior frequência absoluta
- [ ] **Raciocínio Lógico** tem a menor frequência absoluta  
- [ ] Nenhuma disciplina varia mais que ±30% do esperado
- [ ] Distribuição respeita hierarquia de pesos (5>4>3>2>1)
- [ ] Total de sessões permanece consistente

---

## 🏁 CONCLUSÃO

O algoritmo atual **falha criticamente** em respeitar os pesos das disciplinas, criando um cronograma que prejudica a preparação do usuário para o TJPE2025. 

**A correção é URGENTE** para garantir que:
1. Disciplinas mais importantes recebam o tempo adequado
2. A preparação seja otimizada conforme a importância real de cada matéria
3. O usuário tenha as melhores chances de aprovação

**Status**: 🔴 **NECESSITA CORREÇÃO IMEDIATA**

---

*Análise realizada em: 14/08/2025*  
*Script de análise: `analyze_schedule_weights.js`*  
*Dados: Plano TJPE2025 - Usuário 3@3.com*