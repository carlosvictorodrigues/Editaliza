const logger = require('../../../utils/logger');

/**
 * Validador de slots de tempo disponíveis
 * Implementa TODA a lógica complexa de distribuição de tempo do server.js
 */
class TimeSlotValidator {
    /**
     * Calcula e valida slots de tempo disponíveis
     * Lógica EXATA do server.js (linhas 1962-1986)
     * @param {Date} startDate - Data de início
     * @param {Date} endDate - Data de fim (data da prova)
     * @param {Object} study_hours_per_day - Horas de estudo por dia da semana
     * @param {number} sessionDuration - Duração da sessão em minutos
     * @param {boolean} weekdayOnly - Se deve considerar apenas dias úteis
     * @returns {Array} Array de objetos com datas disponíveis
     */
    static getAvailableDates(startDate, endDate, study_hours_per_day, sessionDuration, weekdayOnly = false) {
        const cacheKey = `${startDate.getTime()}-${endDate.getTime()}-${weekdayOnly}-${JSON.stringify(study_hours_per_day)}-${sessionDuration}`;
        
        // Cache para evitar recálculos (lógica do server.js)
        if (!this._availableDatesCache) {
            this._availableDatesCache = new Map();
        }
        
        if (this._availableDatesCache.has(cacheKey)) {
            logger.debug(`[TimeSlotValidator] Cache hit para cálculo de datas`);
            return this._availableDatesCache.get(cacheKey);
        }
        
        const startTime = Date.now();
        logger.debug(`[TimeSlotValidator] Calculando datas disponíveis de ${startDate.toLocaleDateString()} até ${endDate.toLocaleDateString()}`);
        
        // Lógica EXATA do server.js preservada
        const dates = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const shouldSkip = (weekdayOnly && (dayOfWeek === 0 || dayOfWeek === 6));
            
            if (!shouldSkip && (study_hours_per_day[dayOfWeek] || 0) > 0) {
                const maxSessions = Math.floor((study_hours_per_day[dayOfWeek] * 60) / sessionDuration);
                
                dates.push({
                    date: new Date(currentDate),
                    dayOfWeek,
                    maxSessions,
                    hoursAvailable: study_hours_per_day[dayOfWeek],
                    sessionDuration,
                    weekdayName: this._getDayName(dayOfWeek),
                    isWeekend: dayOfWeek === 0 || dayOfWeek === 6
                });
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        this._availableDatesCache.set(cacheKey, dates);
        
        const executionTime = Date.now() - startTime;
        logger.debug(`[TimeSlotValidator] ${dates.length} datas disponíveis calculadas em ${executionTime}ms`);
        
        return dates;
    }
    
    /**
     * Encontra próximo slot disponível
     * Lógica EXATA do server.js (linhas 2010-2019)
     * @param {Date} startDate - Data para começar a busca
     * @param {Date} examDate - Data da prova
     * @param {Object} study_hours_per_day - Horas por dia
     * @param {number} sessionDuration - Duração em minutos
     * @param {Map} agenda - Agenda atual de sessões
     * @param {boolean} isWeekdayOnly - Se deve buscar apenas dias úteis
     * @returns {Date|null} Próxima data disponível ou null
     */
    static findNextAvailableSlot(startDate, examDate, study_hours_per_day, sessionDuration, agenda, isWeekdayOnly = false) {
        const availableDates = this.getAvailableDates(startDate, examDate, study_hours_per_day, sessionDuration, isWeekdayOnly);
        
        for (const dateInfo of availableDates) {
            // Usar horário de Brasília corretamente (lógica EXATA do server.js)
            const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
            const currentSessions = agenda.get(dateStr)?.length || 0;
            
            if (currentSessions < dateInfo.maxSessions) {
                logger.debug(`[TimeSlotValidator] Slot encontrado: ${dateStr} (${currentSessions}/${dateInfo.maxSessions})`);
                return dateInfo.date;
            }
        }
        
        logger.debug(`[TimeSlotValidator] Nenhum slot disponível encontrado a partir de ${startDate.toLocaleDateString()}`);
        return null;
    }
    
    /**
     * Encontra próximo sábado para revisão
     * Lógica EXATA do server.js (linhas 2021-2029)
     */
    static getNextSaturdayForReview(date, examDate, study_hours_per_day, sessionDuration, agenda) {
        const saturdayDates = this.getAvailableDates(date, examDate, study_hours_per_day, sessionDuration)
            .filter(d => d.dayOfWeek === 6);
            
        for (const dateInfo of saturdayDates) {
            // Usar horário de Brasília corretamente
            const dateStr = dateInfo.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
            if ((agenda.get(dateStr)?.length || 0) < dateInfo.maxSessions) {
                logger.debug(`[TimeSlotValidator] Sábado para revisão encontrado: ${dateStr}`);
                return dateInfo.date;
            }
        }
        
        return null;
    }
    
    /**
     * Calcula total de slots disponíveis
     * Baseado na lógica do server.js (linha 2055)
     */
    static calculateTotalAvailableSlots(startDate, examDate, study_hours_per_day, sessionDuration, weekdayOnly = false) {
        const availableDates = this.getAvailableDates(startDate, examDate, study_hours_per_day, sessionDuration, weekdayOnly);
        const totalSlots = availableDates.reduce((sum, d) => sum + (parseInt(d.maxSessions, 10) || 0), 0);
        
        logger.info(`[TimeSlotValidator] Total de slots disponíveis: ${totalSlots}`);
        
        return {
            totalSlots,
            availableDays: availableDates.length,
            averageSlotsPerDay: availableDates.length > 0 ? (totalSlots / availableDates.length).toFixed(1) : 0,
            breakdown: {
                weekdays: availableDates.filter(d => !d.isWeekend).reduce((sum, d) => sum + d.maxSessions, 0),
                weekends: availableDates.filter(d => d.isWeekend).reduce((sum, d) => sum + d.maxSessions, 0)
            }
        };
    }
    
    /**
     * Valida se há tempo suficiente para todos os tópicos
     */
    static validateTimeAvailability(pendingTopics, availableSlots, isRetaFinalMode) {
        const validation = {
            isViable: true,
            issues: [],
            recommendations: [],
            statistics: {
                pendingTopics: pendingTopics.length,
                availableSlots: availableSlots.totalSlots,
                utilizationRate: 0,
                deficit: 0,
                surplus: 0
            }
        };
        
        const topicsCount = pendingTopics.length;
        const slotsCount = availableSlots.totalSlots;
        
        validation.statistics.utilizationRate = slotsCount > 0 ? ((topicsCount / slotsCount) * 100).toFixed(1) : 0;
        
        if (topicsCount > slotsCount) {
            validation.isViable = !isRetaFinalMode; // Só é inviável se não estiver no modo reta final
            validation.statistics.deficit = topicsCount - slotsCount;
            
            if (!isRetaFinalMode) {
                validation.issues.push(
                    `❌ CRONOGRAMA INVIÁVEL: ${topicsCount} tópicos para apenas ${slotsCount} sessões. ` +
                    `Ative o Modo Reta Final para priorizar as disciplinas mais importantes.`
                );
                validation.recommendations.push('Ativar Modo Reta Final');
                validation.recommendations.push('Aumentar horas de estudo disponíveis');
                validation.recommendations.push('Reduzir duração das sessões');
            } else {
                validation.issues.push(
                    `⚠️ ${validation.statistics.deficit} tópicos serão excluídos automaticamente no Modo Reta Final`
                );
                validation.recommendations.push('Revisar prioridades das disciplinas');
            }
        } else {
            validation.statistics.surplus = slotsCount - topicsCount;
            
            if (validation.statistics.surplus > topicsCount * 0.5) {
                validation.recommendations.push('Considere adicionar mais sessões de revisão ou simulados');
                validation.recommendations.push('Poderia aumentar a duração das sessões para aprofundar o estudo');
            }
        }
        
        // Análises adicionais
        if (availableSlots.breakdown.weekends === 0 && !isRetaFinalMode) {
            validation.recommendations.push('Considere estudar nos finais de semana para ter mais flexibilidade');
        }
        
        if (availableSlots.averageSlotsPerDay < 2 && topicsCount > 50) {
            validation.recommendations.push('Com muitos tópicos e poucas sessões diárias, considere aumentar o tempo de estudo');
        }
        
        logger.info(`[TimeSlotValidator] Validação de disponibilidade:`, validation.statistics);
        
        return validation;
    }
    
    /**
     * Valida distribuição de sessões na agenda
     */
    static validateScheduleDistribution(agenda, availableDates) {
        const distribution = {
            totalSessions: 0,
            daysUsed: 0,
            daysAvailable: availableDates.length,
            utilizationByDay: new Map(),
            overloadedDays: [],
            underutilizedDays: [],
            weekdayVsWeekend: { weekdays: 0, weekends: 0 }
        };
        
        // Analisar utilização por dia
        agenda.forEach((sessions, dateStr) => {
            distribution.totalSessions += sessions.length;
            distribution.daysUsed++;
            
            // Encontrar informações do dia
            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayOfWeek = dateObj.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (isWeekend) {
                distribution.weekdayVsWeekend.weekends += sessions.length;
            } else {
                distribution.weekdayVsWeekend.weekdays += sessions.length;
            }
            
            // Encontrar capacidade máxima do dia
            const dateInfo = availableDates.find(d => 
                d.date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'}) === dateStr
            );
            
            if (dateInfo) {
                const utilization = (sessions.length / dateInfo.maxSessions) * 100;
                distribution.utilizationByDay.set(dateStr, {
                    sessions: sessions.length,
                    capacity: dateInfo.maxSessions,
                    utilization: utilization.toFixed(1),
                    isWeekend
                });
                
                if (sessions.length === dateInfo.maxSessions) {
                    // Não é sobrecarga, é utilização máxima
                } else if (utilization < 50) {
                    distribution.underutilizedDays.push({
                        date: dateStr,
                        sessions: sessions.length,
                        capacity: dateInfo.maxSessions,
                        utilization
                    });
                }
            }
        });
        
        // Estatísticas gerais
        distribution.utilizationRate = distribution.daysAvailable > 0 ? 
            ((distribution.daysUsed / distribution.daysAvailable) * 100).toFixed(1) : 0;
            
        distribution.averageSessionsPerDay = distribution.daysUsed > 0 ? 
            (distribution.totalSessions / distribution.daysUsed).toFixed(1) : 0;
        
        logger.debug(`[TimeSlotValidator] Distribuição da agenda:`, {
            totalSessions: distribution.totalSessions,
            daysUsed: distribution.daysUsed,
            utilizationRate: distribution.utilizationRate + '%'
        });
        
        return distribution;
    }
    
    /**
     * Limpa cache de datas (util para testes ou mudanças de configuração)
     */
    static clearCache() {
        if (this._availableDatesCache) {
            this._availableDatesCache.clear();
            logger.debug(`[TimeSlotValidator] Cache de datas limpo`);
        }
    }
    
    /**
     * Obtém nome do dia da semana
     */
    static _getDayName(dayOfWeek) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return dayNames[dayOfWeek] || 'Desconhecido';
    }
    
    /**
     * Formata data para horário brasileiro (lógica do server.js)
     */
    static formatDateBrazilian(date) {
        return date.toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
    }
    
    /**
     * Adiciona sessão à agenda com validação
     * Lógica baseada no server.js (linhas 1988-1996)
     */
    static addSessionToAgenda(agenda, date, session) {
        // Usar horário de Brasília corretamente
        const dateStr = this.formatDateBrazilian(date);
        
        if (!agenda.has(dateStr)) {
            agenda.set(dateStr, []);
        }
        
        const sessionWithDate = { ...session, session_date: dateStr };
        agenda.get(dateStr).push(sessionWithDate);
        
        logger.debug(`[TimeSlotValidator] Sessão adicionada em ${dateStr}: ${session.sessionType}`);
        
        return sessionWithDate;
    }
    
    /**
     * Valida se uma data está no fuso horário correto
     */
    static validateBrazilianTimezone(date) {
        if (!(date instanceof Date)) {
            return { isValid: false, error: 'Não é um objeto Date válido' };
        }
        
        if (isNaN(date.getTime())) {
            return { isValid: false, error: 'Data inválida' };
        }
        
        // Verificar se a data faz sentido (não muito no passado ou futuro)
        const now = new Date();
        const yearsDiff = Math.abs(date.getFullYear() - now.getFullYear());
        
        if (yearsDiff > 10) {
            return { isValid: false, error: 'Data muito distante do presente' };
        }
        
        return { isValid: true };
    }
}

module.exports = TimeSlotValidator;