const { DateCalculator } = require('../utils');
const logger = require('../../../utils/logger');

/**
 * Calculadora de Repetição Espaçada
 * Implementa o algoritmo de spaced repetition do server.js (linhas 2274-2284)
 * 
 * Funcionalidades:
 * - Intervalos fixos: 7, 14, 28 dias após conclusão
 * - Preferência por sábados para revisões
 * - Validação de data limite (exam_date)
 * - Preservação de metadados das sessões originais
 */
class SpacedRepetitionCalculator {
    
    /**
     * Intervalos de revisão fixos em dias
     * Baseado na lógica do server.js linha 2274: [7, 14, 28]
     */
    static REVIEW_INTERVALS = [7, 14, 28];
    
    /**
     * Calcula todas as revisões para tópicos concluídos
     * Lógica EXATA do server.js (linhas 2032-2056)
     * 
     * @param {Array} completedTopics - Tópicos concluídos com completion_date
     * @param {Date} examDate - Data limite da prova
     * @param {Function} availabilityChecker - Função para verificar disponibilidade de slots
     * @returns {Object} Resultado com revisões calculadas
     */
    static calculateReviews(completedTopics, examDate, availabilityChecker) {
        logger.info(`[SpacedRepetition] Calculando revisões para ${completedTopics.length} tópicos concluídos`);
        
        const today = DateCalculator.getBrazilianToday();
        const reviewSessions = [];
        const skippedReviews = [];
        
        for (const topic of completedTopics) {
            const topicReviews = this.calculateTopicReviews(
                topic, 
                examDate, 
                today, 
                availabilityChecker
            );
            
            reviewSessions.push(...topicReviews.sessions);
            skippedReviews.push(...topicReviews.skipped);
        }
        
        const result = {
            totalReviews: reviewSessions.length,
            totalSkipped: skippedReviews.length,
            sessions: reviewSessions,
            skipped: skippedReviews,
            statistics: this._generateStatistics(reviewSessions, skippedReviews)
        };
        
        logger.info(`[SpacedRepetition] Revisões calculadas: ${result.totalReviews} agendadas, ${result.totalSkipped} puladas`);
        
        return result;
    }
    
    /**
     * Calcula revisões para um tópico específico
     * Implementa a lógica exata do server.js (linhas 2042-2055)
     * 
     * @param {Object} topic - Tópico com dados de conclusão
     * @param {Date} examDate - Data limite
     * @param {Date} today - Data de referência
     * @param {Function} availabilityChecker - Verificador de disponibilidade
     * @returns {Object} Sessões e revisões puladas para o tópico
     */
    static calculateTopicReviews(topic, examDate, today, availabilityChecker) {
        logger.debug(`[SpacedRepetition] Calculando revisões para tópico: ${topic.subject_name} - ${topic.description}`);
        
        const sessions = [];
        const skipped = [];
        
        // Lógica EXATA do server.js linha 2045
        const baseDate = new Date(topic.completion_date + 'T00:00:00');
        
        // Intervalos fixos: 7, 14, 28 dias (linha 2046)
        this.REVIEW_INTERVALS.forEach(days => {
            const reviewData = this._calculateSingleReview(
                topic,
                baseDate,
                days,
                examDate,
                today,
                availabilityChecker
            );
            
            if (reviewData.isValid) {
                sessions.push(reviewData.session);
                logger.debug(`[SpacedRepetition] ✅ Revisão ${days}D agendada para ${DateCalculator.formatToBrazilianDateString(reviewData.targetDate)}`);
            } else {
                skipped.push(reviewData);
                logger.debug(`[SpacedRepetition] ⏭️ Revisão ${days}D pulada: ${reviewData.reason}`);
            }
        });
        
        return { sessions, skipped };
    }
    
    /**
     * Calcula uma única revisão específica
     * Implementa a lógica do server.js (linhas 2046-2055)
     * 
     * @param {Object} topic - Dados do tópico
     * @param {Date} baseDate - Data base de conclusão
     * @param {number} days - Dias após conclusão
     * @param {Date} examDate - Data limite
     * @param {Date} today - Data atual
     * @param {Function} availabilityChecker - Verificador de slots
     * @returns {Object} Dados da revisão calculada
     */
    static _calculateSingleReview(topic, baseDate, days, examDate, today, availabilityChecker) {
        // Lógica EXATA do server.js (linha 2046-2047)
        const targetReviewDate = new Date(baseDate);
        targetReviewDate.setDate(targetReviewDate.getDate() + days);
        
        const sessionType = `Revisão ${days}D`;
        
        // Validação EXATA do server.js (linha 2048)
        if (targetReviewDate < today) {
            return {
                isValid: false,
                topic,
                targetDate: targetReviewDate,
                sessionType,
                reason: 'Data de revisão está no passado',
                daysAfterCompletion: days
            };
        }
        
        if (targetReviewDate > examDate) {
            return {
                isValid: false,
                topic,
                targetDate: targetReviewDate,
                sessionType,
                reason: 'Data de revisão é após a data da prova',
                daysAfterCompletion: days
            };
        }
        
        // Buscar sábado para revisão (lógica do server.js linha 2050)
        const reviewDay = this._findSaturdayForReview(targetReviewDate, examDate, availabilityChecker);
        
        if (!reviewDay) {
            return {
                isValid: false,
                topic,
                targetDate: targetReviewDate,
                sessionType,
                reason: 'Nenhum sábado disponível encontrado para revisão',
                daysAfterCompletion: days
            };
        }
        
        // Criar sessão de revisão (lógica do server.js linha 2051-2054)
        const session = {
            topicId: topic.id,
            subjectName: topic.subject_name,
            topicDescription: topic.description,
            sessionType: sessionType,
            targetDate: reviewDay,
            dateString: DateCalculator.formatToBrazilianDateString(reviewDay),
            originalCompletionDate: topic.completion_date,
            daysAfterCompletion: days,
            reviewMetadata: {
                baseTopicId: topic.id,
                originalSubject: topic.subject_name,
                completedOn: topic.completion_date,
                reviewInterval: days,
                isSpacedRepetition: true
            }
        };
        
        return {
            isValid: true,
            topic,
            targetDate: reviewDay,
            sessionType,
            session,
            daysAfterCompletion: days
        };
    }
    
    /**
     * Encontra próximo sábado disponível para revisão
     * Implementa getNextSaturdayForReview do server.js
     * 
     * @param {Date} targetDate - Data alvo para revisão
     * @param {Date} examDate - Data limite
     * @param {Function} availabilityChecker - Função de verificação de disponibilidade
     * @returns {Date|null} Próximo sábado disponível ou null
     */
    static _findSaturdayForReview(targetDate, examDate, availabilityChecker) {
        logger.debug(`[SpacedRepetition] Buscando sábado para revisão a partir de ${DateCalculator.formatToBrazilianDateString(targetDate)}`);
        
        // Buscar sábados a partir da data alvo
        let searchDate = new Date(targetDate);
        const maxIterations = 14; // Máximo 2 semanas de busca
        let iterations = 0;
        
        while (searchDate <= examDate && iterations < maxIterations) {
            // Verificar se é sábado (dayOfWeek === 6)
            if (DateCalculator.isSaturday(searchDate)) {
                // Verificar disponibilidade usando o checker fornecido
                if (availabilityChecker && availabilityChecker(searchDate)) {
                    logger.debug(`[SpacedRepetition] ✅ Sábado disponível encontrado: ${DateCalculator.formatToBrazilianDateString(searchDate)}`);
                    return new Date(searchDate);
                }
                logger.debug(`[SpacedRepetition] ⏭️ Sábado ocupado: ${DateCalculator.formatToBrazilianDateString(searchDate)}`);
            }
            
            searchDate.setDate(searchDate.getDate() + 1);
            iterations++;
        }
        
        logger.debug(`[SpacedRepetition] ❌ Nenhum sábado disponível encontrado`);
        return null;
    }
    
    /**
     * Cria um availability checker baseado em agenda existente
     * Replica a lógica do server.js para verificação de slots
     * 
     * @param {Map} agenda - Agenda atual de sessões
     * @param {Function} getMaxSessionsForDate - Função que retorna máximo de sessões para uma data
     * @returns {Function} Função verificadora de disponibilidade
     */
    static createAvailabilityChecker(agenda, getMaxSessionsForDate) {
        return (date) => {
            const dateStr = DateCalculator.formatToBrazilianDateString(date);
            const currentSessions = agenda.get(dateStr)?.length || 0;
            const maxSessions = getMaxSessionsForDate(date);
            
            const isAvailable = currentSessions < maxSessions;
            
            logger.debug(`[SpacedRepetition] Verificando disponibilidade ${dateStr}: ${currentSessions}/${maxSessions} - ${isAvailable ? 'Disponível' : 'Ocupado'}`);
            
            return isAvailable;
        };
    }
    
    /**
     * Gera estatísticas das revisões calculadas
     * 
     * @param {Array} reviewSessions - Sessões de revisão agendadas
     * @param {Array} skippedReviews - Revisões puladas
     * @returns {Object} Estatísticas detalhadas
     */
    static _generateStatistics(reviewSessions, skippedReviews) {
        const stats = {
            totalCalculated: reviewSessions.length + skippedReviews.length,
            totalScheduled: reviewSessions.length,
            totalSkipped: skippedReviews.length,
            successRate: 0,
            byInterval: {},
            skipReasons: {},
            subjectDistribution: {}
        };
        
        // Calcular taxa de sucesso
        if (stats.totalCalculated > 0) {
            stats.successRate = ((stats.totalScheduled / stats.totalCalculated) * 100).toFixed(1);
        }
        
        // Estatísticas por intervalo
        this.REVIEW_INTERVALS.forEach(interval => {
            const scheduled = reviewSessions.filter(s => s.daysAfterCompletion === interval).length;
            const skipped = skippedReviews.filter(s => s.daysAfterCompletion === interval).length;
            
            stats.byInterval[`${interval}D`] = {
                scheduled,
                skipped,
                total: scheduled + skipped,
                successRate: scheduled + skipped > 0 ? ((scheduled / (scheduled + skipped)) * 100).toFixed(1) : 0
            };
        });
        
        // Razões de pulos
        skippedReviews.forEach(skip => {
            const reason = skip.reason || 'Desconhecida';
            stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + 1;
        });
        
        // Distribuição por disciplina
        reviewSessions.forEach(session => {
            const subject = session.subjectName || 'Desconhecida';
            stats.subjectDistribution[subject] = (stats.subjectDistribution[subject] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * Valida dados de entrada para cálculo de revisões
     * 
     * @param {Array} completedTopics - Tópicos concluídos
     * @param {Date} examDate - Data da prova
     * @returns {Object} Resultado da validação
     */
    static validateInput(completedTopics, examDate) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Validar tópicos concluídos
        if (!Array.isArray(completedTopics)) {
            validation.isValid = false;
            validation.errors.push('completedTopics deve ser um array');
        } else if (completedTopics.length === 0) {
            validation.warnings.push('Nenhum tópico concluído fornecido');
        } else {
            // Validar estrutura dos tópicos
            completedTopics.forEach((topic, index) => {
                if (!topic.id) {
                    validation.errors.push(`Tópico ${index} não possui ID`);
                }
                if (!topic.completion_date) {
                    validation.errors.push(`Tópico ${index} não possui data de conclusão`);
                }
                if (!topic.subject_name) {
                    validation.warnings.push(`Tópico ${index} não possui nome da disciplina`);
                }
                if (!topic.description) {
                    validation.warnings.push(`Tópico ${index} não possui descrição`);
                }
            });
        }
        
        // Validar data da prova
        if (!examDate || !(examDate instanceof Date) || isNaN(examDate.getTime())) {
            validation.isValid = false;
            validation.errors.push('Data da prova inválida');
        } else {
            const today = DateCalculator.getBrazilianToday();
            if (examDate <= today) {
                validation.isValid = false;
                validation.errors.push('Data da prova deve ser no futuro');
            }
        }
        
        if (validation.errors.length > 0) {
            validation.isValid = false;
        }
        
        return validation;
    }
    
    /**
     * Cria sessão de revisão padronizada
     * 
     * @param {Object} topic - Dados do tópico original
     * @param {Date} reviewDate - Data da revisão
     * @param {number} intervalDays - Intervalo em dias
     * @returns {Object} Sessão de revisão formatada
     */
    static createReviewSession(topic, reviewDate, intervalDays) {
        return {
            topicId: topic.id,
            subjectName: topic.subject_name,
            topicDescription: `[REVISÃO] ${topic.description}`,
            sessionType: `Revisão ${intervalDays}D`,
            session_date: DateCalculator.formatToBrazilianDateString(reviewDate),
            originalCompletionDate: topic.completion_date,
            daysAfterCompletion: intervalDays,
            isSpacedRepetition: true,
            priority: this._calculateReviewPriority(intervalDays),
            metadata: {
                originalTopicId: topic.id,
                reviewInterval: intervalDays,
                calculatedAt: new Date().toISOString(),
                reviewType: 'spaced_repetition'
            }
        };
    }
    
    /**
     * Calcula prioridade da revisão baseada no intervalo
     * Revisões mais próximas têm prioridade maior
     * 
     * @param {number} intervalDays - Intervalo em dias
     * @returns {number} Valor de prioridade (maior = mais importante)
     */
    static _calculateReviewPriority(intervalDays) {
        const priorityMap = {
            7: 3,   // Alta prioridade - primeira revisão
            14: 2,  // Média prioridade - segunda revisão
            28: 1   // Baixa prioridade - terceira revisão
        };
        
        return priorityMap[intervalDays] || 1;
    }
    
    /**
     * Obtém próximas datas de revisão para um tópico
     * Útil para previsão e planejamento
     * 
     * @param {string} completionDate - Data de conclusão (YYYY-MM-DD)
     * @param {Date} examDate - Data limite
     * @returns {Array} Array de datas de revisão futuras
     */
    static getUpcomingReviewDates(completionDate, examDate) {
        const baseDate = new Date(completionDate + 'T00:00:00');
        const today = DateCalculator.getBrazilianToday();
        const upcomingDates = [];
        
        this.REVIEW_INTERVALS.forEach(days => {
            const reviewDate = new Date(baseDate);
            reviewDate.setDate(reviewDate.getDate() + days);
            
            if (reviewDate >= today && reviewDate <= examDate) {
                upcomingDates.push({
                    date: reviewDate,
                    dateString: DateCalculator.formatToBrazilianDateString(reviewDate),
                    interval: days,
                    type: `Revisão ${days}D`,
                    daysFromNow: DateCalculator.getDaysUntilExam(reviewDate, today)
                });
            }
        });
        
        return upcomingDates.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
}

module.exports = SpacedRepetitionCalculator;