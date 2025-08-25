/**
 * Índice dos utilitários de cronograma
 * Facilita importação e uso dos utilitários
 */

const DateCalculator = require('./DateCalculator');
const SessionBatcher = require('./SessionBatcher');

module.exports = {
    DateCalculator,
    SessionBatcher,
    
    // Métodos de conveniência
    
    /**
     * Cria agenda vazia para organização de sessões
     */
    createAgenda() {
        return new Map();
    },
    
    /**
     * Adiciona sessão à agenda usando utilitários
     */
    addSessionToAgenda(agenda, date, session) {
        const dateStr = DateCalculator.formatToBrazilianDateString(date);
        
        if (!agenda.has(dateStr)) {
            agenda.set(dateStr, []);
        }
        
        const sessionWithDate = { ...session, session_date: dateStr };
        agenda.get(dateStr).push(sessionWithDate);
        
        return sessionWithDate;
    },
    
    /**
     * Converte agenda para array de sessões
     */
    agendaToSessions(agenda) {
        return Array.from(agenda.values()).flat();
    },
    
    /**
     * Obtém estatísticas da agenda
     */
    getAgendaStatistics(agenda) {
        const sessions = this.agendaToSessions(agenda);
        const sessionTypes = new Map();
        const subjects = new Map();
        
        sessions.forEach(session => {
            // Contar tipos de sessão
            const type = session.sessionType || 'Desconhecido';
            sessionTypes.set(type, (sessionTypes.get(type) || 0) + 1);
            
            // Contar disciplinas
            const subject = session.subjectName || 'Desconhecida';
            subjects.set(subject, (subjects.get(subject) || 0) + 1);
        });
        
        return {
            totalSessions: sessions.length,
            totalDays: agenda.size,
            averageSessionsPerDay: agenda.size > 0 ? (sessions.length / agenda.size).toFixed(1) : 0,
            sessionTypes: Object.fromEntries(sessionTypes),
            subjects: Object.fromEntries(subjects),
            dateRange: {
                start: agenda.size > 0 ? Math.min(...Array.from(agenda.keys()).map(d => new Date(d).getTime())) : null,
                end: agenda.size > 0 ? Math.max(...Array.from(agenda.keys()).map(d => new Date(d).getTime())) : null
            }
        };
    },
    
    /**
     * Valida integridade da agenda
     */
    validateAgenda(agenda) {
        const issues = [];
        const sessions = this.agendaToSessions(agenda);
        
        // Verificar sessões duplicadas
        const sessionKeys = new Set();
        sessions.forEach((session, index) => {
            const key = `${session.session_date}-${session.topicId}-${session.sessionType}`;
            if (sessionKeys.has(key)) {
                issues.push(`Sessão duplicada detectada no índice ${index}`);
            }
            sessionKeys.add(key);
        });
        
        // Verificar consistência de datas
        agenda.forEach((sessions, dateStr) => {
            sessions.forEach(session => {
                if (session.session_date !== dateStr) {
                    issues.push(`Inconsistência de data: sessão tem data ${session.session_date} mas está agendada para ${dateStr}`);
                }
            });
        });
        
        return {
            isValid: issues.length === 0,
            issues,
            sessionCount: sessions.length,
            dayCount: agenda.size
        };
    }
};