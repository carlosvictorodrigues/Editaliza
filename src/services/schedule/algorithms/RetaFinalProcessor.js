const { DateCalculator } = require('../utils');
const logger = require('../../../utils/logger');

/**
 * Processador de Reta Final
 * Implementa o algoritmo de exclusão inteligente do server.js (linhas 2060-2133)
 * 
 * Funcionalidades:
 * - Exclusão baseada em prioridade combinada: (subject_priority * 10) + topic_priority
 * - Seleção dos N tópicos mais importantes
 * - Registro de exclusões para auditoria
 * - Mensagens de warning sobre exclusões
 * - Manutenção de integridade das tabelas de exclusão
 */
class RetaFinalProcessor {
    
    /**
     * Processa modo reta final quando há mais tópicos que slots disponíveis
     * Lógica EXATA do server.js (linhas 2060-2133)
     * 
     * @param {Array} pendingTopics - Tópicos pendentes de agendamento
     * @param {number} availableSlots - Slots disponíveis para agendamento
     * @param {number} planId - ID do plano de estudo
     * @param {boolean} isRetaFinalEnabled - Se modo reta final está habilitado
     * @param {Function} dbExecutor - Função para executar operações no banco
     * @returns {Object} Resultado do processamento
     */
    static async processRetaFinal(pendingTopics, availableSlots, planId, isRetaFinalEnabled, dbExecutor) {
        logger.info(`[RetaFinal] Processando ${pendingTopics.length} tópicos para ${availableSlots} slots`);
        
        // Verificar se precisa do modo reta final
        if (pendingTopics.length <= availableSlots) {
            logger.info(`[RetaFinal] Todos os ${pendingTopics.length} tópicos cabem nos ${availableSlots} slots disponíveis`);
            
            // Limpar exclusões antigas se não há mais necessidade
            await this._clearExclusions(planId, dbExecutor);
            
            return {
                needsRetaFinal: false,
                topicsToSchedule: pendingTopics,
                excludedTopics: [],
                prioritizedSubjects: [],
                message: `Todos os ${pendingTopics.length} tópicos serão agendados`
            };
        }
        
        // Verificar se modo reta final está habilitado
        if (!isRetaFinalEnabled) {
            const error = `❌ CRONOGRAMA INVIÁVEL: ${pendingTopics.length} tópicos para apenas ${availableSlots} sessões. Ative o Modo Reta Final para priorizar as disciplinas mais importantes.`;
            logger.error(`[RetaFinal] ${error}`);
            
            return {
                needsRetaFinal: true,
                isEnabled: false,
                error,
                topicsCount: pendingTopics.length,
                availableSlots
            };
        }
        
        // Executar priorização e exclusões
        const result = await this._executeRetaFinalLogic(
            pendingTopics,
            availableSlots,
            planId,
            dbExecutor
        );
        
        logger.info(`[RetaFinal] Processamento concluído: ${result.topicsToSchedule.length} selecionados, ${result.excludedTopics.length} excluídos`);
        
        return result;
    }
    
    /**
     * Executa a lógica principal do modo reta final
     * Implementa linhas 2068-2133 do server.js
     * 
     * @param {Array} pendingTopics - Tópicos pendentes
     * @param {number} availableSlots - Slots disponíveis
     * @param {number} planId - ID do plano
     * @param {Function} dbExecutor - Executor de banco
     * @returns {Object} Resultado da execução
     */
    static async _executeRetaFinalLogic(pendingTopics, availableSlots, planId, dbExecutor) {
        // Combinar peso da disciplina e do tópico para priorização (linhas 2069-2073)
        const sortedTopics = this._sortTopicsByPriority(pendingTopics);
        
        // Dividir em tópicos selecionados e excluídos (linhas 2074-2075)
        const topicsToSchedule = sortedTopics.slice(0, availableSlots);
        const excludedTopics = sortedTopics.slice(availableSlots);
        
        // Criar mapa de disciplinas priorizadas (linhas 2077-2083)
        const prioritizedSubjects = this._extractPrioritizedSubjects(topicsToSchedule);
        
        // Processar exclusões no banco de dados (linhas 2086-2133)
        await this._processExclusions(excludedTopics, planId, dbExecutor);
        
        const message = this._generateRetaFinalMessage(
            topicsToSchedule.length,
            excludedTopics.length,
            availableSlots
        );
        
        return {
            needsRetaFinal: true,
            isEnabled: true,
            topicsToSchedule,
            excludedTopics,
            prioritizedSubjects,
            message,
            statistics: this._generateStatistics(sortedTopics, topicsToSchedule, excludedTopics)
        };
    }
    
    /**
     * Ordena tópicos por prioridade combinada
     * Implementa a fórmula EXATA: (subject_priority * 10) + topic_priority (linhas 2069-2073)
     * 
     * @param {Array} topics - Tópicos para ordenar
     * @returns {Array} Tópicos ordenados por prioridade decrescente
     */
    static _sortTopicsByPriority(topics) {
        logger.debug(`[RetaFinal] Ordenando ${topics.length} tópicos por prioridade combinada`);
        
        const sortedTopics = [...topics].sort((a, b) => {
            // Fórmula EXATA do server.js (linhas 2070-2071)
            const priorityA = (a.subject_priority * 10) + a.topic_priority;
            const priorityB = (b.subject_priority * 10) + b.topic_priority;
            
            logger.debug(`[RetaFinal] Comparando: ${a.subject_name}/${a.description} (${priorityA}) vs ${b.subject_name}/${b.description} (${priorityB})`);
            
            // Ordenação decrescente (maior prioridade primeiro) - linha 2072
            return priorityB - priorityA;
        });
        
        // Log dos tópicos ordenados para debug
        sortedTopics.slice(0, 5).forEach((topic, index) => {
            const priority = (topic.subject_priority * 10) + topic.topic_priority;
            logger.debug(`[RetaFinal] Top ${index + 1}: ${topic.subject_name} - ${topic.description} (Prioridade: ${priority})`);
        });
        
        return sortedTopics;
    }
    
    /**
     * Extrai disciplinas priorizadas dos tópicos selecionados
     * Implementa lógica das linhas 2077-2083 do server.js
     * 
     * @param {Array} topicsToSchedule - Tópicos que serão agendados
     * @returns {Array} Lista de disciplinas priorizadas
     */
    static _extractPrioritizedSubjects(topicsToSchedule) {
        logger.debug(`[RetaFinal] Extraindo disciplinas priorizadas de ${topicsToSchedule.length} tópicos`);
        
        // Lógica EXATA do server.js (linhas 2077-2083)
        const subjectsMap = new Map();
        
        topicsToSchedule.forEach(topic => {
            if (!subjectsMap.has(topic.subject_name)) {
                subjectsMap.set(topic.subject_name, {
                    name: topic.subject_name,
                    weight: topic.subject_priority,
                    topicCount: 1
                });
            } else {
                subjectsMap.get(topic.subject_name).topicCount++;
            }
        });
        
        const prioritizedSubjects = Array.from(subjectsMap.values());
        
        logger.info(`[RetaFinal] Disciplinas priorizadas: ${prioritizedSubjects.map(s => `${s.name} (${s.topicCount} tópicos)`).join(', ')}`);
        
        return prioritizedSubjects;
    }
    
    /**
     * Processa exclusões no banco de dados
     * Implementa lógica EXATA das linhas 2086-2133 do server.js
     * 
     * @param {Array} excludedTopics - Tópicos excluídos
     * @param {number} planId - ID do plano
     * @param {Function} dbExecutor - Executor de banco com métodos run/get
     * @returns {Promise} Promessa de conclusão
     */
    static async _processExclusions(excludedTopics, planId, dbExecutor) {
        logger.info(`[RetaFinal] Processando ${excludedTopics.length} exclusões para plano ${planId}`);
        
        if (excludedTopics.length > 0) {
            // Limpar registros antigos de ambas as tabelas (linhas 2089-2090)
            await this._clearExclusions(planId, dbExecutor);
            
            // Processar cada exclusão individualmente (linhas 2092-2128)
            for (const excludedTopic of excludedTopics) {
                await this._processExclusion(excludedTopic, planId, dbExecutor);
            }
        } else {
            // Se não há exclusões, limpar registros antigos (linhas 2130-2132)
            await this._clearExclusions(planId, dbExecutor);
        }
    }
    
    /**
     * Processa uma exclusão individual
     * Implementa lógica das linhas 2092-2128 do server.js
     * 
     * @param {Object} excludedTopic - Tópico excluído
     * @param {number} planId - ID do plano
     * @param {Function} dbExecutor - Executor de banco
     * @returns {Promise} Promessa de conclusão
     */
    static async _processExclusion(excludedTopic, planId, dbExecutor) {
        const priorityCombined = (excludedTopic.subject_priority * 10) + excludedTopic.topic_priority;
        const reason = `Tópico excluído automaticamente no Modo Reta Final devido à falta de tempo. Prioridade combinada: ${priorityCombined.toFixed(2)}`;
        
        logger.debug(`[RetaFinal] 🔍 Processando exclusão: ${excludedTopic.subject_name} - ${excludedTopic.description}`);
        
        try {
            // CORREÇÃO CRÍTICA: Verificar se o topic_id é válido antes da inserção (linhas 2096-2113)
            const topicExists = await dbExecutor.get('SELECT id FROM topics WHERE id = ?', [excludedTopic.id]);
            
            if (topicExists) {
                logger.debug(`[RetaFinal] ✅ Tópico ${excludedTopic.id} encontrado, inserindo em reta_final_exclusions`);
                
                // Salvar na tabela legada (para compatibilidade) - linhas 2106-2110
                await dbExecutor.run(
                    'INSERT INTO reta_final_exclusions (plan_id, topic_id, reason) VALUES (?, ?, ?)',
                    [
                        planId,
                        excludedTopic.id,
                        `${excludedTopic.subject_name} - ${excludedTopic.description} (Prioridade: ${priorityCombined.toFixed(2)})`
                    ]
                );
                
                logger.debug(`[RetaFinal] ✅ Inserção em reta_final_exclusions concluída`);
            } else {
                logger.warn(`[RetaFinal] ⚠️ Tópico com ID ${excludedTopic.id} não encontrado na tabela topics, pulando inserção na reta_final_exclusions`);
            }
            
            logger.debug(`[RetaFinal] ✅ Inserindo em reta_final_excluded_topics`);
            
            // Salvar na nova tabela com mais detalhes (linhas 2117-2121)
            await dbExecutor.run(
                'INSERT INTO reta_final_excluded_topics (plan_id, subject_id, topic_id, reason) VALUES (?, ?, ?, ?)',
                [planId, excludedTopic.subject_id || null, excludedTopic.id, reason]
            );
            
            logger.debug(`[RetaFinal] ✅ Inserção em reta_final_excluded_topics concluída`);
            
        } catch (insertError) {
            // Log EXATO do server.js (linhas 2123-2127)
            logger.error(`[RetaFinal] ❌ ERRO CRÍTICO na inserção do tópico ${excludedTopic.id}:`, insertError.message);
            logger.error(`[RetaFinal] ❌ Stack trace:`, insertError.stack);
            throw insertError; // Re-throw para parar o processo
        }
    }
    
    /**
     * Limpa exclusões antigas do banco
     * Implementa lógica das linhas 2089-2090 e 2131-2132 do server.js
     * 
     * @param {number} planId - ID do plano
     * @param {Function} dbExecutor - Executor de banco
     * @returns {Promise} Promessa de conclusão
     */
    static async _clearExclusions(planId, dbExecutor) {
        logger.debug(`[RetaFinal] Limpando exclusões antigas do plano ${planId}`);
        
        try {
            // Limpar registros antigos de ambas as tabelas (linhas EXATAS do server.js)
            await dbExecutor.run('DELETE FROM reta_final_exclusions WHERE plan_id = ?', [planId]);
            await dbExecutor.run('DELETE FROM reta_final_excluded_topics WHERE plan_id = ?', [planId]);
            
            logger.debug(`[RetaFinal] ✅ Exclusões antigas removidas com sucesso`);
        } catch (error) {
            logger.error(`[RetaFinal] ❌ Erro ao limpar exclusões antigas:`, error.message);
            throw error;
        }
    }
    
    /**
     * Gera mensagem informativa sobre o processo de reta final
     * 
     * @param {number} scheduledCount - Quantidade de tópicos agendados
     * @param {number} excludedCount - Quantidade de tópicos excluídos
     * @param {number} totalSlots - Total de slots disponíveis
     * @returns {string} Mensagem informativa
     */
    static _generateRetaFinalMessage(scheduledCount, excludedCount, totalSlots) {
        const totalTopics = scheduledCount + excludedCount;
        
        if (excludedCount === 0) {
            return `✅ Todos os ${scheduledCount} tópicos foram agendados nos ${totalSlots} slots disponíveis.`;
        }
        
        const message = [
            `⚠️ MODO RETA FINAL ATIVADO`,
            `• Total de tópicos: ${totalTopics}`,
            `• Slots disponíveis: ${totalSlots}`,
            `• Tópicos selecionados: ${scheduledCount} (prioridade mais alta)`,
            `• Tópicos excluídos: ${excludedCount} (prioridade mais baixa)`,
            ``,
            `Os tópicos foram priorizados pela fórmula: (peso_disciplina × 10) + peso_tópico`,
            `Apenas os tópicos mais importantes foram mantidos no cronograma.`
        ].join('\n');
        
        return message;
    }
    
    /**
     * Gera estatísticas detalhadas do processamento
     * 
     * @param {Array} allTopics - Todos os tópicos ordenados
     * @param {Array} selected - Tópicos selecionados
     * @param {Array} excluded - Tópicos excluídos
     * @returns {Object} Estatísticas detalhadas
     */
    static _generateStatistics(allTopics, selected, excluded) {
        const stats = {
            total: allTopics.length,
            selected: selected.length,
            excluded: excluded.length,
            selectionRate: ((selected.length / allTopics.length) * 100).toFixed(1),
            priorityRange: {
                highest: 0,
                lowest: 0,
                selectedHighest: 0,
                selectedLowest: 0,
                excludedHighest: 0,
                excludedLowest: 0
            },
            subjectDistribution: {
                selected: {},
                excluded: {}
            }
        };
        
        if (allTopics.length > 0) {
            // Calcular faixas de prioridade
            const priorities = allTopics.map(t => (t.subject_priority * 10) + t.topic_priority);
            stats.priorityRange.highest = Math.max(...priorities);
            stats.priorityRange.lowest = Math.min(...priorities);
            
            if (selected.length > 0) {
                const selectedPriorities = selected.map(t => (t.subject_priority * 10) + t.topic_priority);
                stats.priorityRange.selectedHighest = Math.max(...selectedPriorities);
                stats.priorityRange.selectedLowest = Math.min(...selectedPriorities);
            }
            
            if (excluded.length > 0) {
                const excludedPriorities = excluded.map(t => (t.subject_priority * 10) + t.topic_priority);
                stats.priorityRange.excludedHighest = Math.max(...excludedPriorities);
                stats.priorityRange.excludedLowest = Math.min(...excludedPriorities);
            }
        }
        
        // Distribuição por disciplina
        selected.forEach(topic => {
            const subject = topic.subject_name || 'Desconhecida';
            stats.subjectDistribution.selected[subject] = (stats.subjectDistribution.selected[subject] || 0) + 1;
        });
        
        excluded.forEach(topic => {
            const subject = topic.subject_name || 'Desconhecida';
            stats.subjectDistribution.excluded[subject] = (stats.subjectDistribution.excluded[subject] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * Calcula prioridade combinada de um tópico
     * Implementa a fórmula EXATA: (subject_priority * 10) + topic_priority
     * 
     * @param {Object} topic - Tópico com propriedades de prioridade
     * @returns {number} Prioridade combinada
     */
    static calculateCombinedPriority(topic) {
        if (!topic.subject_priority || !topic.topic_priority) {
            logger.warn(`[RetaFinal] Tópico ${topic.id} tem prioridades inválidas:`, {
                subject_priority: topic.subject_priority,
                topic_priority: topic.topic_priority
            });
            return 0;
        }
        
        // Fórmula EXATA do server.js
        return (topic.subject_priority * 10) + topic.topic_priority;
    }
    
    /**
     * Valida dados de entrada para processamento
     * 
     * @param {Array} pendingTopics - Tópicos pendentes
     * @param {number} availableSlots - Slots disponíveis
     * @param {number} planId - ID do plano
     * @returns {Object} Resultado da validação
     */
    static validateInput(pendingTopics, availableSlots, planId) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Validar tópicos pendentes
        if (!Array.isArray(pendingTopics)) {
            validation.isValid = false;
            validation.errors.push('pendingTopics deve ser um array');
        } else if (pendingTopics.length === 0) {
            validation.warnings.push('Nenhum tópico pendente fornecido');
        } else {
            // Validar estrutura dos tópicos
            pendingTopics.forEach((topic, index) => {
                if (!topic.id) {
                    validation.errors.push(`Tópico ${index} não possui ID`);
                }
                if (typeof topic.subject_priority !== 'number') {
                    validation.errors.push(`Tópico ${index} não possui subject_priority válida`);
                }
                if (typeof topic.topic_priority !== 'number') {
                    validation.errors.push(`Tópico ${index} não possui topic_priority válida`);
                }
                if (!topic.subject_name) {
                    validation.warnings.push(`Tópico ${index} não possui nome da disciplina`);
                }
                if (!topic.description) {
                    validation.warnings.push(`Tópico ${index} não possui descrição`);
                }
            });
        }
        
        // Validar slots disponíveis
        if (typeof availableSlots !== 'number' || availableSlots < 0) {
            validation.isValid = false;
            validation.errors.push('availableSlots deve ser um número não negativo');
        }
        
        // Validar ID do plano
        if (typeof planId !== 'number' || planId <= 0) {
            validation.isValid = false;
            validation.errors.push('planId deve ser um número positivo');
        }
        
        return validation;
    }
    
    /**
     * Simula processamento de reta final sem executar mudanças no banco
     * Útil para preview e análise
     * 
     * @param {Array} pendingTopics - Tópicos pendentes
     * @param {number} availableSlots - Slots disponíveis
     * @returns {Object} Simulação do resultado
     */
    static simulateRetaFinal(pendingTopics, availableSlots) {
        logger.info(`[RetaFinal] Simulando processamento: ${pendingTopics.length} tópicos, ${availableSlots} slots`);
        
        if (pendingTopics.length <= availableSlots) {
            return {
                needsRetaFinal: false,
                topicsToSchedule: pendingTopics,
                excludedTopics: [],
                message: `Simulação: Todos os ${pendingTopics.length} tópicos cabem nos ${availableSlots} slots`
            };
        }
        
        const sortedTopics = this._sortTopicsByPriority(pendingTopics);
        const topicsToSchedule = sortedTopics.slice(0, availableSlots);
        const excludedTopics = sortedTopics.slice(availableSlots);
        const prioritizedSubjects = this._extractPrioritizedSubjects(topicsToSchedule);
        
        return {
            needsRetaFinal: true,
            topicsToSchedule,
            excludedTopics,
            prioritizedSubjects,
            message: this._generateRetaFinalMessage(
                topicsToSchedule.length,
                excludedTopics.length,
                availableSlots
            ),
            statistics: this._generateStatistics(sortedTopics, topicsToSchedule, excludedTopics),
            isSimulation: true
        };
    }
    
    /**
     * Obtém tópicos excluídos de um plano específico
     * Consulta as tabelas de exclusão
     * 
     * @param {number} planId - ID do plano
     * @param {Function} dbExecutor - Executor de banco
     * @returns {Array} Lista de exclusões registradas
     */
    static async getExclusionsForPlan(planId, dbExecutor) {
        logger.debug(`[RetaFinal] Consultando exclusões para plano ${planId}`);
        
        try {
            // Consultar tabela principal de exclusões
            const exclusions = await dbExecutor.all(
                `SELECT plan_id, topic_id, reason, created_at 
                 FROM reta_final_excluded_topics 
                 WHERE plan_id = ? 
                 ORDER BY created_at DESC`,
                [planId]
            );
            
            logger.info(`[RetaFinal] Encontradas ${exclusions.length} exclusões para plano ${planId}`);
            
            return exclusions;
        } catch (error) {
            logger.error(`[RetaFinal] Erro ao consultar exclusões:`, error.message);
            throw error;
        }
    }
}

module.exports = RetaFinalProcessor;