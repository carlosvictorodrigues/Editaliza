// Correção para implementar Round-Robin Ponderado no algoritmo de geração de cronograma
// Este código substitui as linhas 2169-2209 do server.js

// ALGORITMO DE ROUND-ROBIN PONDERADO
console.log(`[CRONOGRAMA] Iniciando Round-Robin Ponderado para ${topicsToSchedule.length} tópicos`);

// Agrupar tópicos por disciplina
const disciplineGroups = new Map();
sortedByPriority.forEach(topic => {
    if (!topic || !topic.subject_name || !topic.id) {
        console.warn('[CRONOGRAMA] Tópico inválido ignorado:', topic);
        return;
    }
    
    if (!disciplineGroups.has(topic.subject_name)) {
        disciplineGroups.set(topic.subject_name, {
            topics: [],
            weight: topic.subject_priority || 1,
            priority: (topic.subject_priority || 1) * 10 + 3, // Prioridade calculada
            currentIndex: 0
        });
    }
    disciplineGroups.get(topic.subject_name).topics.push(topic);
});

// Calcular total de prioridades para proporção
let totalPriority = 0;
disciplineGroups.forEach(group => {
    totalPriority += group.priority;
});

console.log('[CRONOGRAMA] Prioridades das disciplinas:');
disciplineGroups.forEach((group, name) => {
    const percentage = ((group.priority / totalPriority) * 100).toFixed(1);
    console.log(`  - ${name}: prioridade ${group.priority} (${percentage}% das sessões)`);
});

// IMPLEMENTAÇÃO DO ROUND-ROBIN PONDERADO
const uniquePendingTopicsInOrder = [];
const seenTopics = new Set();

// Criar estrutura para round-robin ponderado
const disciplineQueues = [];
disciplineGroups.forEach((group, name) => {
    disciplineQueues.push({
        name: name,
        topics: [...group.topics], // Cópia dos tópicos
        weight: group.priority, // Usar a prioridade como peso
        credits: group.priority, // Créditos iniciais = peso
        originalWeight: group.priority
    });
});

// Ordenar por peso (maior primeiro)
disciplineQueues.sort((a, b) => b.weight - a.weight);

console.log('[CRONOGRAMA] Iniciando distribuição com Round-Robin Ponderado');

// Distribuir tópicos usando round-robin ponderado
let totalDistributed = 0;
const maxIterations = topicsToSchedule.length * 2; // Proteção contra loop infinito
let iteration = 0;

while (totalDistributed < topicsToSchedule.length && iteration < maxIterations) {
    iteration++;
    let hasDistributedInRound = false;
    
    for (const queue of disciplineQueues) {
        // Se a disciplina tem créditos e ainda tem tópicos
        if (queue.credits >= 1 && queue.topics.length > 0) {
            const topic = queue.topics.shift(); // Remove o primeiro tópico
            
            if (topic && topic.id && !seenTopics.has(topic.id)) {
                uniquePendingTopicsInOrder.push(topic);
                seenTopics.add(topic.id);
                totalDistributed++;
                hasDistributedInRound = true;
                
                // Deduzir 1 crédito
                queue.credits -= 1;
                
                const description = topic.description ? topic.description.substring(0, 30) : 'Sem descrição';
                console.log(`[CRONOGRAMA] #${totalDistributed}: ${topic.subject_name} - ${description}... (créditos restantes: ${queue.credits.toFixed(1)})`);
                
                if (totalDistributed >= topicsToSchedule.length) break;
            }
        }
    }
    
    // Recarregar créditos proporcionalmente quando todos ficam sem créditos
    const hasCredits = disciplineQueues.some(q => q.credits >= 1 && q.topics.length > 0);
    if (!hasCredits) {
        console.log('[CRONOGRAMA] Recarregando créditos proporcionalmente...');
        disciplineQueues.forEach(queue => {
            if (queue.topics.length > 0) {
                queue.credits += queue.originalWeight;
            }
        });
    }
    
    // Se não distribuiu nada nesta rodada, parar para evitar loop infinito
    if (!hasDistributedInRound) {
        console.log('[CRONOGRAMA] Nenhuma distribuição nesta rodada, finalizando...');
        break;
    }
}

console.log(`[CRONOGRAMA] Distribuição final com Round-Robin Ponderado: ${uniquePendingTopicsInOrder.length} tópicos`);

// Análise da distribuição final
const finalDistribution = {};
uniquePendingTopicsInOrder.forEach(topic => {
    if (!finalDistribution[topic.subject_name]) {
        finalDistribution[topic.subject_name] = 0;
    }
    finalDistribution[topic.subject_name]++;
});

console.log('[CRONOGRAMA] Distribuição final por disciplina:');
Object.entries(finalDistribution).forEach(([name, count]) => {
    const percentage = ((count / uniquePendingTopicsInOrder.length) * 100).toFixed(1);
    console.log(`  - ${name}: ${count} sessões (${percentage}%)`);
});

// VALIDAÇÃO FINAL
if (uniquePendingTopicsInOrder.length === 0) {
    console.log('[CRONOGRAMA] Nenhum tópico válido encontrado para agendamento');
    await dbRun('COMMIT');
    console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
    return res.json({ message: 'Cronograma gerado com sucesso!' });
}