# ANÁLISE DE DISTRIBUIÇÃO DE HORAS - TJPE 2025

## PROBLEMAS IDENTIFICADOS

### 1. ERRO CRÍTICO NA CONFIGURAÇÃO DE HORAS
- **Domingo configurado com 0h** (deveria ser 4h)
- Total semanal atual: 44h
- Total semanal correto: 48h (8h seg-sex + 4h sáb + 4h dom)

### 2. TÓPICOS INCOMPLETOS/FALTANDO
- 15+ tópicos estão simplificados demais no JS
- Detalhamentos importantes do edital foram omitidos
- Erro de numeração no Direito Penal (5.8 duplicado)

### 3. CÁLCULO DE DISTRIBUIÇÃO IDEAL

#### Horas Semanais:
- Segunda a Sexta: 8h x 5 = 40h
- Sábado: 4h
- Domingo: 4h (incluindo redação)
- **TOTAL SEMANAL: 48h**

#### Distribuição por Peso das Disciplinas:

| Disciplina | Peso | % do Total | Horas Semanais Ideais |
|------------|------|------------|----------------------|
| Língua Portuguesa | 5 | 13.2% | 6.3h |
| Raciocínio Lógico | 4 | 10.5% | 5.0h |
| Direito Administrativo | 5 | 13.2% | 6.3h |
| Direito Constitucional | 5 | 13.2% | 6.3h |
| Direito Civil | 4 | 10.5% | 5.0h |
| Direito Processual Civil | 4 | 10.5% | 5.0h |
| Direito Penal | 4 | 10.5% | 5.0h |
| Direito Processual Penal | 3 | 7.9% | 3.8h |
| Legislação Específica | 3 | 7.9% | 3.8h |
| Redação | 1 | 2.6% | 1.3h |
| **TOTAL** | **38** | **100%** | **48h** |

### 4. CORREÇÕES NECESSÁRIAS NO SCRIPT

#### A. Configuração de Horas (linhas 53-60 e 310-318):
```javascript
study_hours_per_day: {
    "0": 4,  // Domingo - 4h (incluindo redação)
    "1": 8,  // Segunda - 8h
    "2": 8,  // Terça - 8h
    "3": 8,  // Quarta - 8h
    "4": 8,  // Quinta - 8h
    "5": 8,  // Sexta - 8h
    "6": 4   // Sábado - 4h
}
```

#### B. Tópicos que precisam ser completados:

**Língua Portuguesa:**
- Tópico 15: Adicionar detalhamento completo
- Tópico 16: Adicionar organização e reorganização de orações
- Tópico 17: Adicionar pronomes de tratamento

**Direito Administrativo:**
- Tópico 1.5: Adicionar contratos administrativos
- Tópico 1.11: Adicionar concessão, permissão e autorização
- Tópico 1.17: Adicionar alienação, imprescritibilidade, impenhorabilidade
- Tópico 1.18: Adicionar responsabilidade civil do Estado
- Tópico 1.28: Adicionar fases e modalidades

**Direito Processual Penal:**
- Corrigir numeração do tópico 5.9
- Tópico 6.4: Adicionar Assistente, Curador, Auxiliar
- Tópico 6.5: Adicionar detalhamentos
- Tópico 6.6: Adicionar "em flagrante" e "decorrente de sentença"
- Tópico 6.8: Adicionar "interlocutórias" e detalhamentos

### 5. VALIDAÇÃO DO MODO RETA FINAL

✅ **Modo Reta Final está ativado** (linha 309 e 339)
✅ **Sessões de 70 minutos** configuradas
✅ **Meta de 150 questões/dia** configurada
❌ **Falta incluir redação aos domingos**

### 6. RECOMENDAÇÕES

1. **URGENTE:** Corrigir configuração de domingo para 4h
2. **IMPORTANTE:** Completar todos os tópicos simplificados
3. **ADICIONAR:** Sistema específico para redação aos domingos
4. **REVISAR:** Pesos dos tópicos baseados no ranking oficial
5. **VALIDAR:** Distribuição final de horas após correções

## CONCLUSÃO

O script tem uma boa estrutura base, mas precisa de correções importantes:
- Adicionar 4h de estudo no domingo
- Completar 15+ tópicos incompletos
- Garantir que redação seja incluída aos domingos
- Ajustar distribuição de horas conforme pesos das disciplinas

Com essas correções, o cronograma estará alinhado com o edital oficial e otimizado para reta final.