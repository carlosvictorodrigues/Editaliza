/**
 * TopicPriorizer - Algoritmo de priorização de tópicos
 * 
 * Implementa o algoritmo Round-Robin Ponderado para distribuir
 * tópicos de forma balanceada entre disciplinas, respeitando
 * as prioridades definidas.
 */

const logger = require('../../../../src/utils/logger');

class TopicPriorizer {
    /**
     * Prioriza tópicos usando Round-Robin Ponderado
     * @param {Array} topics - Lista de tópicos a priorizar
     * @param {Object} config - Configuração de priorização
     * @returns {Array} Tópicos priorizados
     */
    static async prioritize(topics, config) {
        logger.info('Iniciando priorização de tópicos', {
            totalTopics: topics.length,
            planId: config.planId
        });
        
        // Filtrar apenas tópicos pendentes
        const pendingTopics = topics.filter(t => 
            t.status !== 'completed' && 
            t.status !== 'concluido'
        );
        
        if (pendingTopics.length === 0) {
            logger.warn('Nenhum tópico pendente para priorizar');
            return [];
        }
        
        // Agrupar tópicos por disciplina
        const disciplineGroups = this.groupByDiscipline(pendingTopics);
        
        // Calcular pesos ponderados
        const disciplineWeights = this.calculateWeights(disciplineGroups);
        
        // Aplicar Round-Robin Ponderado
        const prioritized = this.applyWeightedRoundRobin(
            disciplineGroups, 
            disciplineWeights
        );
        
        logger.info('Priorização concluída', {
            original: topics.length,
            prioritized: prioritized.length,
            disciplines: Object.keys(disciplineGroups).length
        });
        
        return prioritized;
    }
    
    /**
     * Agrupa tópicos por disciplina
     */
    static groupByDiscipline(topics) {
        const groups = {};
        
        for (const topic of topics) {
            const discipline = topic.subject_name || 'Sem Disciplina';
            
            if (!groups[discipline]) {
                groups[discipline] = {
                    name: discipline,
                    priority: topic.subject_priority || 1,
                    topics: []
                };
            }
            
            groups[discipline].topics.push(topic);
        }
        
        // Ordenar tópicos dentro de cada disciplina por prioridade
        for (const discipline in groups) {
            groups[discipline].topics.sort((a, b) => {
                const priorityA = a.topic_priority || 3;
                const priorityB = b.topic_priority || 3;
                
                if (priorityA !== priorityB) {
                    return priorityB - priorityA; // Maior prioridade primeiro
                }
                
                return a.id - b.id; // Ordem de criação como desempate
            });
        }
        
        return groups;
    }
    
    /**
     * Calcula pesos ponderados para cada disciplina
     */
    static calculateWeights(disciplineGroups) {
        const weights = {};
        let totalWeight = 0;
        
        // Calcular peso total
        for (const discipline in disciplineGroups) {
            const group = disciplineGroups[discipline];
            // Peso = prioridade da disciplina * 10 + bonus baseado em quantidade
            const weight = (group.priority * 10) + Math.min(group.topics.length / 10, 3);
            weights[discipline] = weight;
            totalWeight += weight;
        }
        
        // Normalizar pesos para soma = 1
        for (const discipline in weights) {
            weights[discipline] = weights[discipline] / totalWeight;
        }
        
        logger.debug('Pesos calculados', weights);
        
        return weights;
    }
    
    /**
     * Aplica algoritmo Round-Robin Ponderado
     */
    static applyWeightedRoundRobin(disciplineGroups, weights) {
        const result = [];
        const queues = [];
        
        // Criar filas para cada disciplina
        for (const discipline in disciplineGroups) {
            queues.push({
                name: discipline,
                topics: [...disciplineGroups[discipline].topics],
                weight: weights[discipline],
                credits: 0,
                distributed: 0
            });
        }
        
        // Ordenar filas por peso (maior primeiro)
        queues.sort((a, b) => b.weight - a.weight);
        
        // Distribuir tópicos
        const maxIterations = 10000; // Proteção contra loop infinito
        let iteration = 0;
        let hasTopics = true;
        
        while (hasTopics && iteration < maxIterations) {
            hasTopics = false;
            
            for (const queue of queues) {
                // Adicionar créditos baseados no peso
                queue.credits += queue.weight;
                
                // Se tem crédito suficiente e tópicos disponíveis
                while (queue.credits >= 1 && queue.topics.length > 0) {
                    const topic = queue.topics.shift();
                    result.push({
                        ...topic,
                        distribution_order: result.length + 1,
                        distribution_discipline: queue.name
                    });
                    
                    queue.credits -= 1;
                    queue.distributed++;
                    hasTopics = true;
                }
                
                // Verificar se ainda há tópicos em alguma fila
                if (queue.topics.length > 0) {
                    hasTopics = true;
                }
            }
            
            iteration++;
        }
        
        // Adicionar tópicos restantes (caso haja)
        for (const queue of queues) {
            while (queue.topics.length > 0) {
                const topic = queue.topics.shift();
                result.push({
                    ...topic,
                    distribution_order: result.length + 1,
                    distribution_discipline: queue.name
                });
            }
        }
        
        // Log de distribuição
        const distribution = queues.reduce((acc, q) => {
            acc[q.name] = q.distributed;
            return acc;
        }, {});
        
        logger.info('Distribuição por disciplina', distribution);
        
        return result;
    }
    
    /**
     * Reordena tópicos para evitar monotonia
     * (alterna disciplinas quando possível)
     */
    static alternateTopics(topics) {
        if (topics.length <= 1) return topics;
        
        const result = [];
        let lastDiscipline = null;
        const remaining = [...topics];
        
        while (remaining.length > 0) {
            // Encontrar próximo tópico de disciplina diferente
            let nextIndex = 0;
            
            if (lastDiscipline) {
                for (let i = 0; i < remaining.length; i++) {
                    if (remaining[i].subject_name !== lastDiscipline) {
                        nextIndex = i;
                        break;
                    }
                }
            }
            
            const topic = remaining.splice(nextIndex, 1)[0];
            result.push(topic);
            lastDiscipline = topic.subject_name;
        }
        
        return result;
    }
}

module.exports = TopicPriorizer;