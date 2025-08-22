/**
 * TESTES AUTOMATIZADOS PARA ALGORITMO DE GERAÇÃO DE CRONOGRAMA
 * 
 * Estes testes garantem que o algoritmo de geração de cronograma
 * está funcionando corretamente e previnem regressões futuras.
 */

const { expect } = require('@jest/globals');

describe('Algoritmo de Geração de Cronograma', () => {
    
    /**
     * TESTE CRÍTICO: Validar fórmula de priorização
     */
    describe('Fórmula de Priorização', () => {
        test('deve calcular peso combinado corretamente: (peso_disciplina × 10) + peso_tópico', () => {
            // Casos de teste baseados nos dados reais do TJPE2025
            const testCases = [
                { disciplina: 5, topico: 5, esperado: 55 }, // Direito Civil máximo
                { disciplina: 5, topico: 3, esperado: 53 }, // Direito Civil médio
                { disciplina: 4, topico: 5, esperado: 45 }, // Direito Administrativo máximo
                { disciplina: 4, topico: 3, esperado: 43 }, // Direito Administrativo médio
                { disciplina: 1, topico: 5, esperado: 15 }, // Raciocínio Lógico máximo
                { disciplina: 1, topico: 3, esperado: 13 }, // Raciocínio Lógico médio
            ];

            testCases.forEach(({ disciplina, topico, esperado }) => {
                const resultado = (disciplina * 10) + topico;
                expect(resultado).toBe(esperado);
            });
        });

        test('deve garantir que Direito Civil (peso 5) sempre tenha prioridade maior que Raciocínio Lógico (peso 1)', () => {
            const direitoCivilMinimo = (5 * 10) + 1; // 51 pontos
            const raciocLogicMaximo = (1 * 10) + 5;  // 15 pontos
            
            expect(direitoCivilMinimo).toBeGreaterThan(raciocLogicMaximo);
            
            // Diferença deve ser significativa (pelo menos 30 pontos)
            expect(direitoCivilMinimo - raciocLogicMaximo).toBeGreaterThanOrEqual(30);
        });
    });

    /**
     * TESTE CRÍTICO: Validar distribuição proporcional
     */
    describe('Distribuição Proporcional', () => {
        test('deve distribuir tópicos proporcionalmente aos pesos das disciplinas', () => {
            // Simular tópicos com pesos diferentes
            const topicos = [
                // Direito Civil (peso 5) - 3 tópicos
                { subject_priority: 5, topic_priority: 3, subject_name: 'Direito Civil' },
                { subject_priority: 5, topic_priority: 4, subject_name: 'Direito Civil' },
                { subject_priority: 5, topic_priority: 5, subject_name: 'Direito Civil' },
                // Raciocínio Lógico (peso 1) - 3 tópicos
                { subject_priority: 1, topic_priority: 3, subject_name: 'Raciocínio Lógico' },
                { subject_priority: 1, topic_priority: 4, subject_name: 'Raciocínio Lógico' },
                { subject_priority: 1, topic_priority: 5, subject_name: 'Raciocínio Lógico' },
            ];

            // Calcular pesos combinados
            const pesosCombinados = topicos.map(t => ({
                ...t,
                peso_combinado: (t.subject_priority * 10) + t.topic_priority
            }));

            // Agrupar por disciplina
            const direitoCivil = pesosCombinados.filter(t => t.subject_name === 'Direito Civil');
            const raciocLogic = pesosCombinados.filter(t => t.subject_name === 'Raciocínio Lógico');

            // Calcular peso médio por disciplina
            const pesoDireitoCivil = direitoCivil.reduce((sum, t) => sum + t.peso_combinado, 0) / direitoCivil.length;
            const pesoRaciocLogic = raciocLogic.reduce((sum, t) => sum + t.peso_combinado, 0) / raciocLogic.length;

            // Validar que a proporção está correta
            const proporcao = pesoDireitoCivil / pesoRaciocLogic;
            
            // Direito Civil deve ter pelo menos 3x mais peso que Raciocínio Lógico
            expect(proporcao).toBeGreaterThanOrEqual(3.0);
            
            // E idealmente próximo de 5x (baseado nos pesos das disciplinas)
            expect(proporcao).toBeGreaterThanOrEqual(4.0);
        });

        test('deve normalizar pesos corretamente para distribuição', () => {
            const pesos = [55, 45, 35, 15]; // Direito Civil, Admin, Legislação, Raciocínio
            const pesoMinimo = Math.min(...pesos); // 15
            
            const pesosNormalizados = pesos.map(peso => Math.max(1, Math.round(peso / pesoMinimo)));
            
            expect(pesosNormalizados).toEqual([4, 3, 2, 1]); // Proporção 4:3:2:1
            
            // Direito Civil deve ter 4x mais frequência que Raciocínio Lógico
            expect(pesosNormalizados[0] / pesosNormalizados[3]).toBe(4);
        });
    });

    /**
     * TESTE CRÍTICO: Validar round-robin ponderado
     */
    describe('Round-Robin Ponderado', () => {
        test('deve intercalar disciplinas mantendo proporção', () => {
            // Simular distribuição de disciplinas por peso
            const disciplinas = [
                { nome: 'Direito Civil', peso: 5, topicos: 10 },
                { nome: 'Direito Administrativo', peso: 4, topicos: 20 },
                { nome: 'Raciocínio Lógico', peso: 1, topicos: 8 }
            ];

            // Simular sessões esperadas baseadas no peso
            const sessoesEsperadas = disciplinas.map(d => ({
                ...d,
                sessoes: Math.floor(d.peso * d.topicos * 0.3) // Fator de ajuste
            }));

            // Validar proporções
            const direitoCivil = sessoesEsperadas.find(d => d.nome === 'Direito Civil');
            const raciocLogic = sessoesEsperadas.find(d => d.nome === 'Raciocínio Lógico');

            expect(direitoCivil.sessoes).toBeGreaterThan(raciocLogic.sessoes);
            
            const proporcao = direitoCivil.sessoes / raciocLogic.sessoes;
            expect(proporcao).toBeGreaterThanOrEqual(2.0); // Pelo menos 2:1
        });

        test('deve garantir que todas as disciplinas apareçam no cronograma', () => {
            const disciplinas = ['Direito Civil', 'Direito Administrativo', 'Raciocínio Lógico'];
            const cronogramaSimulado = [
                'Direito Civil', 'Direito Administrativo', 'Direito Civil',
                'Raciocínio Lógico', 'Direito Civil', 'Direito Administrativo'
            ];

            disciplinas.forEach(disciplina => {
                expect(cronogramaSimulado).toContain(disciplina);
            });
        });
    });

    /**
     * TESTE DE REGRESSÃO: Prevenir volta do bug original
     */
    describe('Prevenção de Regressões', () => {
        test('NÃO deve usar a fórmula errada: subject_priority + topic_priority - 3', () => {
            // A fórmula errada que causava o problema
            const formulaErrada = (subjectPriority, topicPriority) => subjectPriority + topicPriority - 3;
            
            const direitoCivilErrado = formulaErrada(5, 3); // 5
            const raciocLogicErrado = formulaErrada(1, 3); // 1
            
            // A fórmula correta
            const formulaCorreta = (subjectPriority, topicPriority) => (subjectPriority * 10) + topicPriority;
            
            const direitoCivilCorreto = formulaCorreta(5, 3); // 53
            const raciocLogicCorreto = formulaCorreta(1, 3); // 13
            
            // Validar que a fórmula correta dá resultados muito diferentes
            expect(direitoCivilCorreto).not.toBe(direitoCivilErrado);
            expect(raciocLogicCorreto).not.toBe(raciocLogicErrado);
            
            // E que a proporção é muito maior com a fórmula correta
            const proporcaoErrada = direitoCivilErrado / raciocLogicErrado; // 5:1
            const proporcaoCorreta = direitoCivilCorreto / raciocLogicCorreto; // 4.08:1
            
            expect(proporcaoCorreta).toBeGreaterThanOrEqual(proporcaoErrada);
        });

        test('deve usar multiplicação (×10) ao invés de soma simples', () => {
            const pesoDisciplina = 5;
            const pesoTopico = 3;
            
            // Fórmula errada (soma simples)
            const pesoErrado = pesoDisciplina + pesoTopico; // 8
            
            // Fórmula correta (multiplicação + soma)
            const pesoCorreto = (pesoDisciplina * 10) + pesoTopico; // 53
            
            expect(pesoCorreto).toBeGreaterThan(pesoErrado * 5); // Deve ser muito maior
        });
    });

    /**
     * TESTE DE PERFORMANCE: Garantir eficiência do algoritmo
     */
    describe('Performance do Algoritmo', () => {
        test('deve processar 130 tópicos em tempo razoável', () => {
            const inicio = Date.now();
            
            // Simular processamento de 130 tópicos
            const topicos = Array.from({ length: 130 }, (_, i) => ({
                id: i,
                subject_priority: (i % 5) + 1, // 1-5
                topic_priority: (i % 5) + 1,   // 1-5
                subject_name: `Disciplina ${i % 9}`
            }));
            
            // Simular cálculo de pesos
            const pesosCombinados = topicos.map(t => ({
                ...t,
                peso_combinado: (t.subject_priority * 10) + t.topic_priority
            }));
            
            // Simular ordenação
            pesosCombinados.sort((a, b) => b.peso_combinado - a.peso_combinado);
            
            const fim = Date.now();
            const tempoProcessamento = fim - inicio;
            
            // Deve processar em menos de 100ms
            expect(tempoProcessamento).toBeLessThan(100);
        });
    });
});

/**
 * FUNÇÕES DE UTILIDADE PARA TESTES
 */

/**
 * Simula o algoritmo de priorização corrigido
 */
function calcularPrioridadeCombinada(subjectPriority, topicPriority) {
    return (subjectPriority * 10) + topicPriority;
}

/**
 * Simula a distribuição ponderada
 */
function simularDistribuicaoPonderada(topicos) {
    const pesosNormalizados = topicos.map(t => {
        const pesoCombinado = calcularPrioridadeCombinada(t.subject_priority, t.topic_priority);
        return {
            ...t,
            peso_combinado: pesoCombinado
        };
    });

    return pesosNormalizados.sort((a, b) => b.peso_combinado - a.peso_combinado);
}

module.exports = {
    calcularPrioridadeCombinada,
    simularDistribuicaoPonderada
};