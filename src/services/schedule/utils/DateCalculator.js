const logger = require('../../../utils/logger');

/**
 * Utilitário para cálculos de data com timezone brasileiro
 * Implementa TODA a lógica de manipulação de datas do server.js
 * Sempre usa 'America/Sao_Paulo' para consistência
 */
class DateCalculator {
    /**
     * Obtém data atual no fuso horário brasileiro
     */
    static getBrazilianToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Garantir que estamos trabalhando com horário brasileiro
        const brazilianDateStr = today.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
        const brazilianToday = new Date(brazilianDateStr + 'T00:00:00');
        
        logger.debug(`[DateCalculator] Data brasileira hoje: ${brazilianDateStr}`);
        
        return brazilianToday;
    }
    
    /**
     * Converte data da prova para objeto Date válido
     * Lógica EXATA do server.js (linhas 1940-1958)
     * @param {string|Date|Object} examDate - Data da prova em qualquer formato
     * @returns {Object} {isValid, examDateString, examDateObj, error}
     */
    static parseExamDate(examDate) {
        logger.debug(`[DateCalculator] Convertendo data da prova:`, {
            examDate,
            type: typeof examDate,
            isDate: examDate instanceof Date
        });
        
        try {
            // Lógica EXATA do server.js preservada
            let examDateString = examDate;
            
            // Se exam_date é um objeto Date, converter para string
            if (examDate instanceof Date) {
                examDateString = examDate.toISOString().split('T')[0];
            } else if (typeof examDate === 'object' && examDate !== null) {
                // Se for um objeto com toISOString
                examDateString = new Date(examDate).toISOString().split('T')[0];
            }
            
            logger.debug(`[DateCalculator] Data da prova após conversão: ${examDateString}`);
            
            // Validação EXATA do server.js
            if (!examDateString || isNaN(new Date(examDateString + 'T00:00:00').getTime())) {
                logger.error(`[DateCalculator] Data da prova inválida: ${examDateString}`);
                return {
                    isValid: false,
                    error: 'Data da prova inválida',
                    examDateString
                };
            }
            
            // Criar data com horário brasileiro (23:59:59 como no server.js)
            const examDateObj = new Date(examDateString + 'T23:59:59');
            
            logger.debug(`[DateCalculator] Data da prova convertida: ${examDateObj.toISOString()}`);
            
            return {
                isValid: true,
                examDateString,
                examDateObj
            };
            
        } catch (error) {
            logger.error(`[DateCalculator] Erro ao converter data da prova:`, error.message);
            return {
                isValid: false,
                error: 'Erro ao processar data da prova: ' + error.message,
                examDateString: null,
                examDateObj: null
            };
        }
    }
    
    /**
     * Calcula dias até a prova
     * @param {Date} examDate - Data da prova
     * @param {Date} fromDate - Data de referência (padrão: hoje)
     * @returns {number} Número de dias
     */
    static getDaysUntilExam(examDate, fromDate = null) {
        const referenceDate = fromDate || this.getBrazilianToday();
        const timeDiff = examDate.getTime() - referenceDate.getTime();
        const days = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        logger.debug(`[DateCalculator] Dias até a prova: ${days}`);
        
        return days;
    }
    
    /**
     * Calcula semanas até a prova
     * @param {Date} examDate - Data da prova
     * @param {Date} fromDate - Data de referência (padrão: hoje)
     * @returns {number} Número de semanas
     */
    static getWeeksUntilExam(examDate, fromDate = null) {
        const days = this.getDaysUntilExam(examDate, fromDate);
        const weeks = Math.ceil(days / 7);
        
        logger.debug(`[DateCalculator] Semanas até a prova: ${weeks}`);
        
        return weeks;
    }
    
    /**
     * Formata data para formato brasileiro (YYYY-MM-DD)
     * Lógica EXATA usada no server.js
     * @param {Date} date - Data a ser formatada
     * @returns {string} Data no formato YYYY-MM-DD
     */
    static formatToBrazilianDateString(date) {
        // Lógica EXATA do server.js (sempre presente)
        const dateStr = date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
        logger.debug(`[DateCalculator] Data formatada: ${dateStr}`);
        return dateStr;
    }
    
    /**
     * Calcula datas de revisão baseado na data de conclusão
     * Lógica EXATA do server.js (linhas 2042-2051)
     * @param {string|Date} completionDate - Data de conclusão do tópico
     * @param {Date} examDate - Data limite (prova)
     * @returns {Array} Array de datas de revisão
     */
    static calculateReviewDates(completionDate, examDate) {
        logger.debug(`[DateCalculator] Calculando datas de revisão para conclusão: ${completionDate}`);
        
        const reviewDates = [];
        const today = this.getBrazilianToday();
        
        // Lógica EXATA do server.js
        const baseDate = new Date(completionDate + 'T00:00:00');
        
        // Intervalos fixos: 7, 14, 28 dias (como no server.js)
        [7, 14, 28].forEach(days => {
            const targetReviewDate = new Date(baseDate);
            targetReviewDate.setDate(targetReviewDate.getDate() + days);
            
            // Só incluir se estiver no futuro e antes da prova
            if (targetReviewDate >= today && targetReviewDate <= examDate) {
                reviewDates.push({
                    targetDate: targetReviewDate,
                    daysAfterCompletion: days,
                    type: `Revisão ${days}D`,
                    isValid: true
                });
                
                logger.debug(`[DateCalculator] Revisão ${days}D agendada para: ${this.formatToBrazilianDateString(targetReviewDate)}`);
            } else {
                logger.debug(`[DateCalculator] Revisão ${days}D fora do prazo ou no passado`);
                reviewDates.push({
                    targetDate: targetReviewDate,
                    daysAfterCompletion: days,
                    type: `Revisão ${days}D`,
                    isValid: false,
                    reason: targetReviewDate < today ? 'Data no passado' : 'Após data da prova'
                });
            }
        });
        
        return reviewDates;
    }
    
    /**
     * Avança data por N dias úteis ou corridos
     * @param {Date} startDate - Data inicial
     * @param {number} days - Número de dias para avançar
     * @param {boolean} weekdaysOnly - Se deve contar apenas dias úteis
     * @returns {Date} Nova data
     */
    static addDays(startDate, days, weekdaysOnly = false) {
        const newDate = new Date(startDate);
        let addedDays = 0;
        
        while (addedDays < days) {
            newDate.setDate(newDate.getDate() + 1);
            const dayOfWeek = newDate.getDay();
            
            if (!weekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
                addedDays++;
            }
        }
        
        logger.debug(`[DateCalculator] Avançado ${days} dias${weekdaysOnly ? ' úteis' : ''} de ${this.formatToBrazilianDateString(startDate)} para ${this.formatToBrazilianDateString(newDate)}`);
        
        return newDate;
    }
    
    /**
     * Encontra próximo dia específico da semana
     * @param {Date} fromDate - Data de início da busca
     * @param {number} targetDayOfWeek - Dia da semana (0=domingo, 6=sábado)
     * @param {Date} limitDate - Data limite para busca
     * @returns {Date|null} Próxima data do dia especificado ou null
     */
    static findNextDayOfWeek(fromDate, targetDayOfWeek, limitDate) {
        const searchDate = new Date(fromDate);
        const maxIterations = 14; // Máximo de 2 semanas de busca
        let iterations = 0;
        
        while (searchDate <= limitDate && iterations < maxIterations) {
            if (searchDate.getDay() === targetDayOfWeek) {
                logger.debug(`[DateCalculator] Próximo ${this._getDayName(targetDayOfWeek)} encontrado: ${this.formatToBrazilianDateString(searchDate)}`);
                return new Date(searchDate);
            }
            
            searchDate.setDate(searchDate.getDate() + 1);
            iterations++;
        }
        
        logger.debug(`[DateCalculator] Nenhum ${this._getDayName(targetDayOfWeek)} encontrado até ${this.formatToBrazilianDateString(limitDate)}`);
        return null;
    }
    
    /**
     * Valida se uma data está dentro de um período válido
     * @param {Date} date - Data a ser validada
     * @param {Date} minDate - Data mínima
     * @param {Date} maxDate - Data máxima
     * @returns {Object} Resultado da validação
     */
    static validateDateRange(date, minDate, maxDate) {
        const validation = {
            isValid: true,
            issues: []
        };
        
        if (date < minDate) {
            validation.isValid = false;
            validation.issues.push(`Data ${this.formatToBrazilianDateString(date)} é anterior ao mínimo permitido (${this.formatToBrazilianDateString(minDate)})`);
        }
        
        if (date > maxDate) {
            validation.isValid = false;
            validation.issues.push(`Data ${this.formatToBrazilianDateString(date)} é posterior ao máximo permitido (${this.formatToBrazilianDateString(maxDate)})`);
        }
        
        return validation;
    }
    
    /**
     * Calcula estatísticas de um período
     * @param {Date} startDate - Data de início
     * @param {Date} endDate - Data de fim
     * @returns {Object} Estatísticas do período
     */
    static calculatePeriodStatistics(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        let weekdays = 0;
        let weekends = 0;
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                weekends++;
            } else {
                weekdays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const statistics = {
            totalDays,
            weekdays,
            weekends,
            totalWeeks: Math.ceil(totalDays / 7),
            weekdayPercentage: ((weekdays / totalDays) * 100).toFixed(1),
            weekendPercentage: ((weekends / totalDays) * 100).toFixed(1)
        };
        
        logger.debug(`[DateCalculator] Estatísticas do período:`, statistics);
        
        return statistics;
    }
    
    /**
     * Verifica se uma data é dia útil
     * @param {Date} date - Data a verificar
     * @returns {boolean} true se for dia útil
     */
    static isWeekday(date) {
        const dayOfWeek = date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
    }
    
    /**
     * Verifica se uma data é final de semana
     * @param {Date} date - Data a verificar
     * @returns {boolean} true se for final de semana
     */
    static isWeekend(date) {
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    }
    
    /**
     * Verifica se uma data é sábado
     * @param {Date} date - Data a verificar
     * @returns {boolean} true se for sábado
     */
    static isSaturday(date) {
        return date.getDay() === 6;
    }
    
    /**
     * Verifica se uma data é domingo
     * @param {Date} date - Data a verificar
     * @returns {boolean} true se for domingo
     */
    static isSunday(date) {
        return date.getDay() === 0;
    }
    
    /**
     * Converte data para início do dia (00:00:00)
     * @param {Date} date - Data original
     * @returns {Date} Data com horário zerado
     */
    static toStartOfDay(date) {
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        return newDate;
    }
    
    /**
     * Converte data para fim do dia (23:59:59)
     * @param {Date} date - Data original
     * @returns {Date} Data com horário de fim do dia
     */
    static toEndOfDay(date) {
        const newDate = new Date(date);
        newDate.setHours(23, 59, 59, 999);
        return newDate;
    }
    
    /**
     * Compara duas datas ignorando horário
     * @param {Date} date1 - Primeira data
     * @param {Date} date2 - Segunda data
     * @returns {number} -1, 0 ou 1 dependendo da comparação
     */
    static compareDatesOnly(date1, date2) {
        const d1 = this.toStartOfDay(date1);
        const d2 = this.toStartOfDay(date2);
        
        if (d1 < d2) return -1;
        if (d1 > d2) return 1;
        return 0;
    }
    
    /**
     * Gera array de datas entre duas datas
     * @param {Date} startDate - Data inicial
     * @param {Date} endDate - Data final
     * @param {boolean} weekdaysOnly - Se deve incluir apenas dias úteis
     * @returns {Array} Array de datas
     */
    static generateDateRange(startDate, endDate, weekdaysOnly = false) {
        const dates = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const shouldInclude = !weekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6);
            
            if (shouldInclude) {
                dates.push(new Date(currentDate));
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        logger.debug(`[DateCalculator] Geradas ${dates.length} datas${weekdaysOnly ? ' úteis' : ''} entre ${this.formatToBrazilianDateString(startDate)} e ${this.formatToBrazilianDateString(endDate)}`);
        
        return dates;
    }
    
    /**
     * Obtém nome do dia da semana
     * @param {number} dayOfWeek - Índice do dia (0-6)
     * @returns {string} Nome do dia
     */
    static _getDayName(dayOfWeek) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return dayNames[dayOfWeek] || 'Desconhecido';
    }
    
    /**
     * Obtém informações detalhadas de uma data
     * @param {Date} date - Data para analisar
     * @returns {Object} Informações da data
     */
    static getDateInfo(date) {
        const dayOfWeek = date.getDay();
        
        return {
            date: new Date(date),
            dateString: this.formatToBrazilianDateString(date),
            dayOfWeek,
            dayName: this._getDayName(dayOfWeek),
            isWeekday: this.isWeekday(date),
            isWeekend: this.isWeekend(date),
            isSaturday: this.isSaturday(date),
            isSunday: this.isSunday(date),
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    }
}

module.exports = DateCalculator;