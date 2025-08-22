/**
 * SOLUÇÃO 2: Distribuição Equilibrada de Tópicos por Peso
 * 
 * Substitui o algoritmo atual de embaralhamento aleatório por
 * uma distribuição que garante equilíbrio temporal das matérias
 */

const createBalancedWeightedDistribution = (pendingTopics) => {
    // 1. Agrupar tópicos por matéria
    const topicsBySubject = {};
    const subjectWeights = {};
    
    pendingTopics.forEach(topic => {
        if (!topicsBySubject[topic.subject_name]) {
            topicsBySubject[topic.subject_name] = [];
            subjectWeights[topic.subject_name] = topic.priority;
        }
        topicsBySubject[topic.subject_name].push(topic);
    });
    
    // 2. Criar lista de matérias baseada em peso
    const weightedSubjects = [];
    Object.entries(subjectWeights).forEach(([subject, weight]) => {
        for (let i = 0; i < weight; i++) {
            weightedSubjects.push(subject);
        }
    });
    
    // 3. Embaralhar as matérias (não os tópicos)
    shuffleArray(weightedSubjects);
    
    // 4. Distribuir tópicos de forma equilibrada
    const distributedTopics = [];
    const subjectCounters = {};
    
    // Inicializar contadores
    Object.keys(topicsBySubject).forEach(subject => {
        subjectCounters[subject] = 0;
    });
    
    // Distribuir baseado na sequência de matérias embaralhadas
    for (const subject of weightedSubjects) {
        const subjectTopics = topicsBySubject[subject];
        const currentIndex = subjectCounters[subject];
        
        if (currentIndex < subjectTopics.length) {
            distributedTopics.push(subjectTopics[currentIndex]);
            subjectCounters[subject]++;
        }
    }
    
    // 5. Adicionar tópicos restantes (para matérias com muitos tópicos)
    Object.entries(topicsBySubject).forEach(([subject, topics]) => {
        const startIndex = subjectCounters[subject];
        for (let i = startIndex; i < topics.length; i++) {
            distributedTopics.push(topics[i]);
        }
    });
    
    // 6. Aplicar embaralhamento leve para evitar padrões muito rígidos
    return applyLightShuffle(distributedTopics);
};

/**
 * Embaralhamento leve que mantém distribuição mas adiciona variabilidade
 */
const applyLightShuffle = (topics) => {
    const result = [...topics];
    const shuffleStrength = 0.3; // 30% de chance de troca
    
    for (let i = result.length - 1; i > 0; i--) {
        if (Math.random() < shuffleStrength) {
            // Trocar apenas com elementos próximos (máximo 3 posições)
            const maxDistance = Math.min(3, i);
            const j = Math.max(0, i - Math.floor(Math.random() * maxDistance));
            
            // Só trocar se não for da mesma matéria (evita concentração)
            if (result[i].subject_name !== result[j].subject_name) {
                [result[i], result[j]] = [result[j], result[i]];
            }
        }
    }
    
    return result;
};

/**
 * Análise da distribuição resultante (para debugging/validação)
 */
const analyzeDistribution = (distributedTopics) => {
    const analysis = {
        totalTopics: distributedTopics.length,
        subjectDistribution: {},
        consecutiveSubjectGroups: 0,
        maxConsecutiveSubject: 0,
        averageGapBetweenSameSubject: {}
    };
    
    // Análise por matéria
    const subjectPositions = {};
    distributedTopics.forEach((topic, index) => {
        const subject = topic.subject_name;
        
        if (!analysis.subjectDistribution[subject]) {
            analysis.subjectDistribution[subject] = 0;
            subjectPositions[subject] = [];
        }
        
        analysis.subjectDistribution[subject]++;
        subjectPositions[subject].push(index);
    });
    
    // Análise de consecutividade
    let currentSubject = null;
    let currentConsecutiveCount = 0;
    let maxConsecutive = 0;
    
    distributedTopics.forEach(topic => {
        if (topic.subject_name === currentSubject) {
            currentConsecutiveCount++;
        } else {
            maxConsecutive = Math.max(maxConsecutive, currentConsecutiveCount);
            currentSubject = topic.subject_name;
            currentConsecutiveCount = 1;
        }
    });
    
    analysis.maxConsecutiveSubject = Math.max(maxConsecutive, currentConsecutiveCount);
    
    // Análise de gaps entre mesma matéria
    Object.entries(subjectPositions).forEach(([subject, positions]) => {
        if (positions.length > 1) {
            const gaps = [];
            for (let i = 1; i < positions.length; i++) {
                gaps.push(positions[i] - positions[i-1] - 1);
            }
            analysis.averageGapBetweenSameSubject[subject] = 
                gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
        }
    });
    
    return analysis;
};

/**
 * Validação da qualidade da distribuição
 */
const validateDistributionQuality = (analysis) => {
    const quality = {
        score: 100,
        issues: [],
        recommendations: []
    };
    
    // Penalizar muitos tópicos consecutivos da mesma matéria
    if (analysis.maxConsecutiveSubject > 3) {
        quality.score -= 20;
        quality.issues.push(`Até ${analysis.maxConsecutiveSubject} tópicos consecutivos da mesma matéria`);
        quality.recommendations.push('Aplicar embaralhamento mais agressivo');
    }
    
    // Verificar distribuição equilibrada
    const subjectCounts = Object.values(analysis.subjectDistribution);
    const minCount = Math.min(...subjectCounts);
    const maxCount = Math.max(...subjectCounts);
    const imbalanceRatio = maxCount / minCount;
    
    if (imbalanceRatio > 3) {
        quality.score -= 15;
        quality.issues.push(`Desbalanceamento entre matérias: ${imbalanceRatio.toFixed(1)}x`);
        quality.recommendations.push('Revisar pesos das matérias');
    }
    
    // Verificar gaps muito pequenos
    const avgGaps = Object.values(analysis.averageGapBetweenSameSubject);
    const minGap = Math.min(...avgGaps.filter(gap => !isNaN(gap)));
    
    if (minGap < 2) {
        quality.score -= 10;
        quality.issues.push('Tópicos da mesma matéria muito próximos');
        quality.recommendations.push('Aumentar espaçamento mínimo entre tópicos da mesma matéria');
    }
    
    // Classificação final
    if (quality.score >= 90) quality.level = 'Excelente';
    else if (quality.score >= 75) quality.level = 'Boa';
    else if (quality.score >= 60) quality.level = 'Aceitável';
    else quality.level = 'Necessita melhoria';
    
    return quality;
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

module.exports = {
    createBalancedWeightedDistribution,
    analyzeDistribution,
    validateDistributionQuality
};