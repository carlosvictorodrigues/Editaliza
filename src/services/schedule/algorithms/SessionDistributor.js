const logger = require('../../../utils/logger');
const DateCalculator = require('../utils/DateCalculator');

/**
 * Algoritmo principal de distribuição de sessões de estudo
 * 
 * Implementa TODA a complexa lógica de distribuição temporal do server.js (linhas 2177-2400)
 * Usa um sistema de "créditos" para balancear disciplinas com Round-Robin ponderado
 * Respeita horários disponíveis por dia da semana e considera feriados
 * 
 * Funcionalidades CRÍTICAS preservadas:
 * - Round-Robin ponderado por prioridade da disciplina
 * - Distribuição respeitando study_hours_per_day (objeto com horas por dia da semana)
 * - Cálculo de sessões disponíveis baseado em session_duration_minutes
 * - Sistema de créditos proporcionais ao peso da disciplina
 * - Postponement de tópicos quando não há slots disponíveis
 * - Cache de datas disponíveis para otimização
 * - Preservação de order e metadados das sessões
 */
class SessionDistributor {
    constructor(config) {
        this.config = {
            sessionDurationMinutes: 50,
            studyHoursPerDay: {}, // Objeto com horas por dia da semana {0: 0, 1: 2, 2: 3, ...}
            examDate: null,
            planId: null,
            ...config
        };
        
        // Cache para datas disponíveis (lógica EXATA do server.js)
        this.availableDatesCache = new Map();
        
        // Agenda de sessões organizadas por data (lógica EXATA do server.js) 
        this.agenda = new Map();
        
        // Logs de debug como no server.js
        logger.info(`[SessionDistributor] Inicializado para plano ${this.config.planId}`, {
            sessionDuration: this.config.sessionDurationMinutes,
            examDate: this.config.examDate,
            studyDays: Object.keys(this.config.studyHoursPerDay).filter(day => this.config.studyHoursPerDay[day] > 0)
        });
    }
    
    /**
     * Distribui tópicos em sessões usando Round-Robin ponderado
     * Lógica EXATA do server.js (linhas 2177-2284)
     * 
     * @param {Array} topicsToSchedule - Tópicos para agendar
     * @param {Date} startDate - Data de início da distribuição
     * @param {Array} completedTopics - Tópicos já concluídos (para revisões)
     * @returns {Object} Resultado da distribuição
     */
    async distributeTopics(topicsToSchedule, startDate, completedTopics = []) {
        const distributionStartTime = Date.now();
        
        logger.info(`[SessionDistributor] Iniciando distribuição de ${topicsToSchedule.length} tópicos`);
        
        try {
            // FASE 1: ROUND-ROBIN PONDERADO (Lógica EXATA do server.js linhas 2177-2250)
            const orderedTopics = await this._executeRoundRobinDistribution(topicsToSchedule);
            
            logger.info(`[SessionDistributor] Round-Robin concluído: ${orderedTopics.length} tópicos ordenados`);
            
            if (orderedTopics.length === 0) {
                logger.warn('[SessionDistributor] Nenhum tópico válido encontrado para agendamento');
                return this._createDistributionResult([], completedTopics, 0);
            }
            
            // FASE 2: DISTRIBUIÇÃO TEMPORAL (Lógica EXATA do server.js linhas 2262-2284)
            const distributedSessions = await this._distributeTopicsToSessions(orderedTopics, startDate);
            
            // FASE 3: AGENDAR REVISÕES (Lógica EXATA do server.js linhas 2274-2283)
            const reviewSessions = await this._scheduleReviews(completedTopics, startDate);
            
            // FASE 4: CONSOLIDAR RESULTADOS
            const totalSessions = distributedSessions + reviewSessions;
            
            const executionTime = Date.now() - distributionStartTime;
            logger.info(`[SessionDistributor] Distribuição concluída em ${executionTime}ms`, {
                totalTopics: topicsToSchedule.length,
                distributedTopics: orderedTopics.length,
                totalSessions,
                reviewSessions,
                agendaDays: this.agenda.size
            });
            
            return this._createDistributionResult(orderedTopics, completedTopics, executionTime);
            
        } catch (error) {
            logger.error(`[SessionDistributor] Erro durante distribuição:`, {
                error: error.message,
                stack: error.stack,
                planId: this.config.planId,
                topicsCount: topicsToSchedule.length
            });
            
            throw new Error(`Falha na distribuição de sessões: ${error.message}`);
        }
    }
    
    /**
     * Executa algoritmo de Round-Robin ponderado
     * Lógica EXATA do server.js (linhas 2177-2250)
     * 
     * @private
     * @param {Array} topicsToSchedule - Tópicos para distribuir
     * @returns {Array} Tópicos ordenados pelo algoritmo
     */
    async _executeRoundRobinDistribution(topicsToSchedule) {
        logger.info(`[SessionDistributor] Iniciando Round-Robin Ponderado`);
        
        // AGRUPAR TÓPICOS POR DISCIPLINA (Lógica do server.js)
        const disciplineGroups = new Map();
        const seenTopics = new Set();
        
        topicsToSchedule.forEach(topic => {
            if (topic && topic.id && !seenTopics.has(topic.id)) {
                const disciplineName = topic.subject_name || 'Disciplina Desconhecida';
                
                if (!disciplineGroups.has(disciplineName)) {
                    disciplineGroups.set(disciplineName, []);
                }
                
                disciplineGroups.get(disciplineName).push(topic);
                seenTopics.add(topic.id);
            }
        });
        
        logger.debug(`[SessionDistributor] Disciplinas agrupadas: ${disciplineGroups.size}`);
        disciplineGroups.forEach((topics, name) => {
            logger.debug(`  - ${name}: ${topics.length} tópicos`);
        });
        
        // CALCULAR TOTAL DE PRIORIDADES (Lógica EXATA do server.js linhas 2180-2187)
        let totalPriority = 0;
        disciplineGroups.forEach((topics, name) => {
            if (topics.length > 0) {
                const priority = (topics[0].subject_priority || 1) * 10 + 3;
                totalPriority += priority;
            }
        });
        
        // CRIAR ESTRUTURA PARA ROUND-ROBIN PONDERADO (Lógica EXATA do server.js linhas 2189-2205)
        const disciplineQueues = [];
        disciplineGroups.forEach((topics, name) => {
            if (topics.length > 0) {
                const priority = (topics[0].subject_priority || 1) * 10 + 3;
                disciplineQueues.push({
                    name: name,
                    topics: [...topics], // Cópia dos tópicos
                    weight: priority, // Usar a prioridade como peso
                    credits: priority, // Créditos iniciais = peso
                    originalWeight: priority
                });
            }
        });
        
        // ORDENAR POR PESO (MAIOR PRIMEIRO) (Lógica EXATA do server.js linha 2205)
        disciplineQueues.sort((a, b) => b.weight - a.weight);
        
        logger.info('[SessionDistributor] Prioridades das disciplinas:');
        disciplineQueues.forEach(queue => {
            const percentage = ((queue.weight / totalPriority) * 100).toFixed(1);
            logger.info(`  - ${queue.name}: prioridade ${queue.weight} (${percentage}% das sessões)`);
        });
        
        // DISTRIBUIR TÓPICOS USANDO ROUND-ROBIN PONDERADO (Lógica EXATA do server.js linhas 2213-2250)
        const uniquePendingTopicsInOrder = [];
        let totalDistributed = 0;
        const maxIterations = topicsToSchedule.length * 2;
        let iteration = 0;
        
        while (totalDistributed < topicsToSchedule.length && iteration < maxIterations) {
            iteration++;
            let hasDistributedInRound = false;
            
            for (const queue of disciplineQueues) {
                // Se a disciplina tem créditos e ainda tem tópicos (Lógica EXATA do server.js linhas 2223-2237)
                if (queue.credits >= 1 && queue.topics.length > 0) {
                    const topic = queue.topics.shift();
                    
                    if (topic && topic.id && !seenTopics.has(`distributed_${topic.id}`)) {
                        uniquePendingTopicsInOrder.push(topic);
                        seenTopics.add(`distributed_${topic.id}`);
                        totalDistributed++;
                        hasDistributedInRound = true;
                        queue.credits -= 1;
                        
                        logger.debug(`[SessionDistributor] Distribuído: ${topic.subject_name} - ${topic.description} (créditos restantes: ${queue.credits})`);
                        
                        if (totalDistributed >= topicsToSchedule.length) break;
                    }
                }
            }
            
            // RECARREGAR CRÉDITOS (Lógica EXATA do server.js linhas 2239-2247)
            const hasCredits = disciplineQueues.some(q => q.credits >= 1 && q.topics.length > 0);
            if (!hasCredits) {
                disciplineQueues.forEach(queue => {
                    if (queue.topics.length > 0) {
                        queue.credits += queue.originalWeight;
                        logger.debug(`[SessionDistributor] Recarregados ${queue.originalWeight} créditos para ${queue.name}`);
                    }
                });
            }
            
            if (!hasDistributedInRound) {
                logger.debug(`[SessionDistributor] Nenhuma distribuição na iteração ${iteration}, finalizando`);
                break;
            }
        }
        
        logger.info(`[SessionDistributor] Distribuição final: ${uniquePendingTopicsInOrder.length} tópicos ordenados`);
        
        return uniquePendingTopicsInOrder;
    }
    
    /**
     * Distribui tópicos ordenados em sessões por data
     * Lógica EXATA do server.js (linhas 2262-2284)
     * 
     * @private
     * @param {Array} orderedTopics - Tópicos já ordenados pelo Round-Robin
     * @param {Date} startDate - Data de início
     * @returns {number} Número de sessões criadas
     */
    async _distributeTopicsToSessions(orderedTopics, startDate) {
        logger.debug(`[SessionDistributor] Distribuindo ${orderedTopics.length} tópicos em sessões`);
        
        let currentDateForNewTopics = new Date(startDate);
        let lastNewTopicDate = null;
        let sessionsCreated = 0;
        
        // Distribuir cada tópico ordenado (Lógica EXATA do server.js linhas 2265-2284)
        for (const topic of orderedTopics) {
            const studyDay = this._findNextAvailableSlot(currentDateForNewTopics, true);
            
            if (!studyDay) {
                logger.warn(`[SessionDistributor] Não foi possível encontrar slot para tópico: ${topic.subject_name} - ${topic.description}`);
                break;
            }
            
            // Adicionar sessão de novo tópico (Lógica EXATA do server.js linha 2269)
            this._addSessionToAgenda(studyDay, {
                topicId: topic.id,
                subjectName: topic.subject_name,
                topicDescription: topic.description,
                sessionType: 'Novo Tópico'
            });
            
            sessionsCreated++;
            lastNewTopicDate = new Date(studyDay);
            currentDateForNewTopics = new Date(studyDay);
            
            logger.debug(`[SessionDistributor] Agendado: ${topic.subject_name} para ${DateCalculator.formatToBrazilianDateString(studyDay)}`);
        }
        
        logger.info(`[SessionDistributor] ${sessionsCreated} sessões de novos tópicos criadas`);
        
        return sessionsCreated;
    }
    
    /**
     * Agenda revisões para tópicos concluídos
     * Lógica EXATA do server.js (linhas 2274-2283)
     * 
     * @private
     * @param {Array} completedTopics - Tópicos concluídos
     * @param {Date} startDate - Data de referência
     * @returns {number} Número de revisões agendadas
     */
    async _scheduleReviews(completedTopics, startDate) {
        logger.debug(`[SessionDistributor] Agendando revisões para ${completedTopics.length} tópicos concluídos`);
        
        let reviewsScheduled = 0;
        
        for (const topic of completedTopics) {
            if (!topic.completion_date) {
                logger.warn(`[SessionDistributor] Tópico sem data de conclusão: ${topic.description}`);
                continue;
            }
            
            // Calcular datas de revisão (7, 14, 28 dias) - Lógica EXATA do server.js
            const reviewDates = DateCalculator.calculateReviewDates(topic.completion_date, this.config.examDate);
            
            for (const reviewInfo of reviewDates) {
                if (!reviewInfo.isValid) continue;
                
                // Encontrar sábado para revisão (Lógica do server.js)
                const reviewDay = this._getNextSaturdayForReview(reviewInfo.targetDate);
                
                if (reviewDay) {
                    this._addSessionToAgenda(reviewDay, {
                        topicId: topic.id,
                        subjectName: topic.subject_name,
                        topicDescription: topic.description,
                        sessionType: reviewInfo.type // 'Revisão 7D', 'Revisão 14D', 'Revisão 28D'
                    });
                    
                    reviewsScheduled++;
                    
                    logger.debug(`[SessionDistributor] Revisão agendada: ${reviewInfo.type} para ${topic.subject_name} em ${DateCalculator.formatToBrazilianDateString(reviewDay)}`);
                }
            }
        }
        
        logger.info(`[SessionDistributor] ${reviewsScheduled} revisões agendadas`);
        
        return reviewsScheduled;
    }
    
    /**
     * Encontra próximo slot disponível para sessão
     * Lógica EXATA do server.js - função findNextAvailableSlot
     * 
     * @private
     * @param {Date} startDate - Data de início da busca
     * @param {boolean} isWeekdayOnly - Se deve buscar apenas dias úteis
     * @returns {Date|null} Próxima data disponível ou null
     */
    _findNextAvailableSlot(startDate, isWeekdayOnly = false) {
        const availableDates = this._getAvailableDates(startDate, this.config.examDate, isWeekdayOnly);
        
        for (const dateInfo of availableDates) {
            // Usar horário de Brasília corretamente (Lógica EXATA do server.js)
            const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
            const currentSessions = this.agenda.get(dateStr)?.length || 0;
            
            if (currentSessions < dateInfo.maxSessions) {
                logger.debug(`[SessionDistributor] Slot encontrado: ${dateStr} (${currentSessions}/${dateInfo.maxSessions})`);
                return dateInfo.date;
            }
        }
        
        logger.warn(`[SessionDistributor] Nenhum slot disponível encontrado a partir de ${DateCalculator.formatToBrazilianDateString(startDate)}`);
        return null;
    }
    
    /**
     * Encontra próximo sábado para revisão
     * Lógica EXATA do server.js - função getNextSaturdayForReview
     * 
     * @private
     * @param {Date} date - Data de referência
     * @returns {Date|null} Próximo sábado disponível
     */
    _getNextSaturdayForReview(date) {
        const saturdayDates = this._getAvailableDates(date, this.config.examDate).filter(d => d.dayOfWeek === 6);
        
        for (const dateInfo of saturdayDates) {
            // Usar horário de Brasília corretamente (Lógica EXATA do server.js)
            const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
            
            if ((this.agenda.get(dateStr)?.length || 0) < dateInfo.maxSessions) {
                logger.debug(`[SessionDistributor] Sábado para revisão encontrado: ${dateStr}`);
                return dateInfo.date;
            }
        }
        
        logger.warn(`[SessionDistributor] Nenhum sábado disponível para revisão a partir de ${DateCalculator.formatToBrazilianDateString(date)}`);
        return null;
    }
    
    /**
     * Obter datas disponíveis com cache
     * Lógica EXATA do server.js - função getAvailableDates
     * 
     * @private
     * @param {Date} startDate - Data de início
     * @param {Date} endDate - Data de fim
     * @param {boolean} weekdayOnly - Se deve incluir apenas dias úteis
     * @returns {Array} Array de informações de datas
     */
    _getAvailableDates(startDate, endDate, weekdayOnly = false) {
        // Cache de datas (Lógica EXATA do server.js)
        const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}`;
        if (this.availableDatesCache.has(cacheKey)) {
            return this.availableDatesCache.get(cacheKey);
        }
        
        const dates = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const shouldSkip = (weekdayOnly && (dayOfWeek === 0 || dayOfWeek === 6));
            
            // Verificar se há horas de estudo neste dia (Lógica EXATA do server.js)
            if (!shouldSkip && (this.config.studyHoursPerDay[dayOfWeek] || 0) > 0) {
                dates.push({
                    date: new Date(currentDate),
                    dayOfWeek,
                    maxSessions: Math.floor((this.config.studyHoursPerDay[dayOfWeek] * 60) / this.config.sessionDurationMinutes)
                });
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Armazenar no cache (Lógica EXATA do server.js)
        this.availableDatesCache.set(cacheKey, dates);
        
        logger.debug(`[SessionDistributor] ${dates.length} datas disponíveis calculadas para período ${DateCalculator.formatToBrazilianDateString(startDate)} - ${DateCalculator.formatToBrazilianDateString(endDate)}`);
        
        return dates;
    }
    
    /**
     * Adiciona sessão à agenda
     * Lógica EXATA do server.js - função addSessionToAgenda
     * 
     * @private
     * @param {Date} date - Data da sessão
     * @param {Object} session - Dados da sessão
     */
    _addSessionToAgenda(date, session) {
        // Usar horário de Brasília corretamente (Lógica EXATA do server.js)
        const dateStr = date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
        
        if (!this.agenda.has(dateStr)) {
            this.agenda.set(dateStr, []);
        }
        
        // Adicionar session_date para compatibilidade com inserção (Lógica EXATA do server.js)
        this.agenda.get(dateStr).push({ 
            ...session, 
            session_date: dateStr 
        });
        
        logger.debug(`[SessionDistributor] Sessão adicionada à agenda: ${dateStr} - ${session.sessionType} - ${session.subjectName}`);
    }
    
    /**
     * Cria resultado consolidado da distribuição
     * 
     * @private
     * @param {Array} distributedTopics - Tópicos distribuídos
     * @param {Array} completedTopics - Tópicos para revisão
     * @param {number} executionTime - Tempo de execução
     * @returns {Object} Resultado consolidado
     */
    _createDistributionResult(distributedTopics, completedTopics, executionTime) {
        const sessionsToCreate = Array.from(this.agenda.values()).flat();
        
        const result = {
            isSuccess: true,
            statistics: {
                distributedTopics: distributedTopics.length,
                sessionsCreated: sessionsToCreate.length,
                agendaDays: this.agenda.size,
                executionTime,
                completedTopicsProcessed: completedTopics.length
            },
            agenda: this.agenda,
            sessionsToCreate,
            distributedTopics,
            performance: {
                executionTime,
                cacheHits: this.availableDatesCache.size,
                averageSessionsPerDay: this.agenda.size > 0 ? (sessionsToCreate.length / this.agenda.size).toFixed(2) : 0
            }
        };
        
        // Estatísticas por tipo de sessão
        const sessionTypes = new Map();
        sessionsToCreate.forEach(session => {
            const type = session.sessionType || 'Desconhecido';
            const count = sessionTypes.get(type) || 0;
            sessionTypes.set(type, count + 1);
        });
        
        result.sessionTypeStats = Object.fromEntries(sessionTypes);
        
        // Estatísticas por disciplina
        const subjects = new Map();
        sessionsToCreate.forEach(session => {
            const subject = session.subjectName || 'Desconhecida';
            const count = subjects.get(subject) || 0;
            subjects.set(subject, count + 1);
        });
        
        result.subjectStats = Object.fromEntries(subjects);
        
        logger.info(`[SessionDistributor] Resultado da distribuição:`, {
            sessionsCreated: sessionsToCreate.length,
            agendaDays: this.agenda.size,
            sessionTypes: result.sessionTypeStats,
            executionTime: `${executionTime}ms`
        });
        
        return result;
    }
    
    /**
     * Obtém a agenda atual
     * @returns {Map} Agenda com sessões organizadas por data
     */
    getAgenda() {
        return this.agenda;
    }
    
    /**
     * Obtém estatísticas da distribuição
     * @returns {Object} Estatísticas detalhadas
     */
    getDistributionStatistics() {
        const sessionsToCreate = Array.from(this.agenda.values()).flat();
        
        const stats = {
            totalSessions: sessionsToCreate.length,
            totalDays: this.agenda.size,
            averageSessionsPerDay: this.agenda.size > 0 ? (sessionsToCreate.length / this.agenda.size).toFixed(2) : 0,
            cacheSize: this.availableDatesCache.size,
            sessionsByType: new Map(),
            sessionsBySubject: new Map(),
            sessionsByDate: new Map()
        };
        
        // Agrupar estatísticas
        sessionsToCreate.forEach(session => {
            // Por tipo
            const type = session.sessionType || 'Desconhecido';
            stats.sessionsByType.set(type, (stats.sessionsByType.get(type) || 0) + 1);
            
            // Por disciplina
            const subject = session.subjectName || 'Desconhecida';
            stats.sessionsBySubject.set(subject, (stats.sessionsBySubject.get(subject) || 0) + 1);
            
            // Por data
            const date = session.session_date;
            stats.sessionsByDate.set(date, (stats.sessionsByDate.get(date) || 0) + 1);
        });
        
        // Converter Maps para Objects para JSON
        stats.sessionsByType = Object.fromEntries(stats.sessionsByType);
        stats.sessionsBySubject = Object.fromEntries(stats.sessionsBySubject);
        stats.sessionsByDate = Object.fromEntries(stats.sessionsByDate);
        
        return stats;
    }
    
    /**
     * Limpa cache e reinicia distribuidor
     */
    reset() {
        this.availableDatesCache.clear();
        this.agenda.clear();
        
        logger.debug(`[SessionDistributor] Reset executado - cache e agenda limpos`);
    }
    
    /**
     * Valida configuração do distribuidor
     * @returns {Object} Resultado da validação
     */
    validateConfiguration() {
        const validation = {
            isValid: true,
            issues: [],
            warnings: []
        };
        
        // Validar session duration
        if (!this.config.sessionDurationMinutes || this.config.sessionDurationMinutes <= 0) {
            validation.isValid = false;
            validation.issues.push('sessionDurationMinutes deve ser maior que 0');
        }
        
        // Validar study hours
        if (!this.config.studyHoursPerDay || typeof this.config.studyHoursPerDay !== 'object') {
            validation.isValid = false;
            validation.issues.push('studyHoursPerDay deve ser um objeto válido');
        } else {
            const totalStudyHours = Object.values(this.config.studyHoursPerDay).reduce((sum, hours) => sum + (hours || 0), 0);
            if (totalStudyHours === 0) {
                validation.isValid = false;
                validation.issues.push('Nenhuma hora de estudo configurada');
            }
        }
        
        // Validar exam date
        if (!this.config.examDate) {
            validation.isValid = false;
            validation.issues.push('examDate é obrigatório');
        } else if (this.config.examDate < new Date()) {
            validation.warnings.push('Data da prova está no passado');
        }
        
        // Validar plan ID
        if (!this.config.planId) {
            validation.warnings.push('planId não fornecido - pode afetar logs');
        }
        
        return validation;
    }
}

module.exports = SessionDistributor;