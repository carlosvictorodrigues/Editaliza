const logger = require('../../../utils/logger');

/**
 * Validador de configurações do plano de estudos
 * Preserva TODA a lógica de validação original do server.js
 */
class PlanConfigValidator {
    /**
     * Valida as configurações do plano antes da geração do cronograma
     * @param {Object} plan - Plano de estudos
     * @param {Object} config - Configurações do cronograma
     * @returns {Object} Resultado da validação {isValid, errors, warnings}
     */
    static validatePlanConfiguration(plan, config) {
        const startTime = Date.now();
        logger.info(`[PlanConfigValidator] Iniciando validação para plano ${plan?.id}`);
        
        const errors = [];
        const warnings = [];
        
        try {
            // 1. Validação básica do plano
            if (!plan) {
                errors.push('Plano não encontrado.');
                return { isValid: false, errors, warnings };
            }
            
            logger.debug(`[PlanConfigValidator] Validando plano ID ${plan.id}`);
            
            // 2. Validação da data da prova (lógica original preservada)
            const examDateValidation = this._validateExamDate(plan.exam_date);
            if (!examDateValidation.isValid) {
                errors.push(...examDateValidation.errors);
            }
            
            // 3. Validação das configurações de estudo
            const studyConfigValidation = this._validateStudyConfiguration(config);
            if (!studyConfigValidation.isValid) {
                errors.push(...studyConfigValidation.errors);
            }
            warnings.push(...studyConfigValidation.warnings);
            
            // 4. Validação de horas de estudo (lógica original preservada)
            const hoursValidation = this._validateStudyHours(config.study_hours_per_day);
            if (!hoursValidation.isValid) {
                errors.push(...hoursValidation.errors);
            }
            warnings.push(...hoursValidation.warnings);
            
            // 5. Validação de tempo disponível vs demanda
            if (errors.length === 0) {
                const timeValidation = this._validateTimeConstraints(plan, config);
                warnings.push(...timeValidation.warnings);
            }
            
            const isValid = errors.length === 0;
            const executionTime = Date.now() - startTime;
            
            logger.info(`[PlanConfigValidator] Validação concluída em ${executionTime}ms - Válido: ${isValid}`);
            if (errors.length > 0) {
                logger.warn(`[PlanConfigValidator] Erros encontrados:`, errors);
            }
            if (warnings.length > 0) {
                logger.info(`[PlanConfigValidator] Avisos:`, warnings);
            }
            
            return {
                isValid,
                errors,
                warnings,
                performance: { validationTime: executionTime }
            };
            
        } catch (error) {
            logger.error(`[PlanConfigValidator] Erro durante validação:`, {
                planId: plan?.id,
                error: error.message,
                stack: error.stack
            });
            
            return {
                isValid: false,
                errors: ['Erro interno durante validação das configurações'],
                warnings,
                performance: { validationTime: Date.now() - startTime }
            };
        }
    }
    
    /**
     * Valida a data da prova (lógica EXATA do server.js)
     */
    static _validateExamDate(examDate) {
        logger.debug(`[PlanConfigValidator] Validando data da prova:`, examDate);
        
        const errors = [];
        
        // Lógica EXATA do server.js preservada
        let examDateString = examDate;
        
        // Se exam_date é um objeto Date, converter para string
        if (examDate instanceof Date) {
            examDateString = examDate.toISOString().split('T')[0];
        } else if (typeof examDate === 'object' && examDate !== null) {
            // Se for um objeto com toISOString
            examDateString = new Date(examDate).toISOString().split('T')[0];
        }
        
        logger.debug(`[PlanConfigValidator] Data da prova após conversão:`, examDateString);
        
        if (!examDateString || isNaN(new Date(examDateString + 'T00:00:00').getTime())) {
            logger.error(`[PlanConfigValidator] Data da prova inválida:`, examDateString);
            errors.push('Defina a data da prova nas configurações do plano antes de gerar o cronograma.');
            return { isValid: false, errors };
        }
        
        const examDateObj = new Date(examDateString + 'T23:59:59');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (examDateObj <= today) {
            errors.push('A data da prova deve ser posterior à data atual.');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            examDateString,
            examDateObj
        };
    }
    
    /**
     * Valida configurações de estudo
     */
    static _validateStudyConfiguration(config) {
        logger.debug(`[PlanConfigValidator] Validando configurações de estudo`);
        
        const errors = [];
        const warnings = [];
        
        // Validação de metas de questões
        const dailyGoal = parseInt(config.daily_question_goal, 10) || 0;
        const weeklyGoal = parseInt(config.weekly_question_goal, 10) || 0;
        
        if (dailyGoal < 0 || dailyGoal > 500) {
            errors.push('Meta diária de questões deve estar entre 0 e 500.');
        }
        
        if (weeklyGoal < 0 || weeklyGoal > 3500) {
            errors.push('Meta semanal de questões deve estar entre 0 e 3500.');
        }
        
        // Validação de duração de sessão
        const sessionDuration = parseInt(config.session_duration_minutes, 10) || 0;
        if (sessionDuration < 10 || sessionDuration > 240) {
            errors.push('Duração da sessão deve estar entre 10 e 240 minutos.');
        }
        
        // Validação de consistência entre metas
        if (dailyGoal > 0 && weeklyGoal > 0) {
            const calculatedWeekly = dailyGoal * 7;
            if (Math.abs(calculatedWeekly - weeklyGoal) > weeklyGoal * 0.3) {
                warnings.push('Meta semanal não é consistente com a meta diária. Considere ajustar.');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Valida horas de estudo por dia (lógica EXATA do server.js)
     */
    static _validateStudyHours(study_hours_per_day) {
        logger.debug(`[PlanConfigValidator] Validando horas de estudo`);
        
        const errors = [];
        const warnings = [];
        
        if (!study_hours_per_day || typeof study_hours_per_day !== 'object') {
            errors.push('Horas de estudo por dia não definidas corretamente.');
            return { isValid: false, errors, warnings };
        }
        
        // Lógica EXATA do server.js preservada
        const totalWeeklyHours = Object.values(study_hours_per_day)
            .reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
            
        if (totalWeeklyHours === 0) {
            errors.push('O cronograma não pode ser gerado porque não há horas de estudo definidas.');
            return { isValid: false, errors, warnings };
        }
        
        // Validações adicionais
        const dailyHours = Object.entries(study_hours_per_day);
        let daysWithStudy = 0;
        let maxDailyHours = 0;
        
        for (const [day, hours] of dailyHours) {
            const dayHours = parseInt(hours, 10) || 0;
            if (dayHours > 0) {
                daysWithStudy++;
                maxDailyHours = Math.max(maxDailyHours, dayHours);
            }
            
            if (dayHours > 12) {
                warnings.push(`${dayHours}h em um dia pode ser excessivo. Considere distribuir melhor.`);
            }
        }
        
        if (daysWithStudy < 3) {
            warnings.push('Poucos dias de estudo por semana. Considere aumentar para melhor distribuição.');
        }
        
        if (totalWeeklyHours > 70) {
            warnings.push('Mais de 70h semanais pode levar ao esgotamento. Considere reduzir.');
        }
        
        logger.debug(`[PlanConfigValidator] Total semanal: ${totalWeeklyHours}h, Dias ativos: ${daysWithStudy}`);
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            totalWeeklyHours,
            daysWithStudy,
            maxDailyHours
        };
    }
    
    /**
     * Valida restrições de tempo vs demanda de conteúdo
     */
    static _validateTimeConstraints(plan, config) {
        logger.debug(`[PlanConfigValidator] Validando restrições de tempo`);
        
        const warnings = [];
        
        try {
            const examDateValidation = this._validateExamDate(plan.exam_date);
            if (!examDateValidation.isValid) {
                return { warnings };
            }
            
            const hoursValidation = this._validateStudyHours(config.study_hours_per_day);
            if (!hoursValidation.isValid) {
                return { warnings };
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const examDate = examDateValidation.examDateObj;
            const timeDiff = examDate.getTime() - today.getTime();
            const daysUntilExam = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            const { totalWeeklyHours, daysWithStudy } = hoursValidation;
            const weeksUntilExam = Math.ceil(daysUntilExam / 7);
            const totalAvailableHours = (totalWeeklyHours * weeksUntilExam);
            
            logger.debug(`[PlanConfigValidator] Tempo até prova: ${daysUntilExam} dias (${weeksUntilExam} semanas)`);
            logger.debug(`[PlanConfigValidator] Total de horas disponíveis: ${totalAvailableHours}h`);
            
            // Avisos baseados no tempo disponível
            if (daysUntilExam < 30) {
                warnings.push('⚠️ Menos de 30 dias até a prova. Considere ativar o Modo Reta Final.');
            }
            
            if (daysUntilExam < 7) {
                warnings.push('🚨 Menos de 1 semana até a prova. Foque em revisão e simulados.');
            }
            
            if (totalAvailableHours < 50) {
                warnings.push('⏰ Poucas horas disponíveis para estudo. Considere aumentar a carga horária.');
            }
            
            if (daysWithStudy < 4 && daysUntilExam > 60) {
                warnings.push('📅 Com mais de 2 meses até a prova, considere estudar mais dias por semana.');
            }
            
            return { warnings };
            
        } catch (error) {
            logger.error(`[PlanConfigValidator] Erro ao validar restrições de tempo:`, error.message);
            warnings.push('Não foi possível validar completamente as restrições de tempo.');
            return { warnings };
        }
    }
    
    /**
     * Valida se o plano está em modo reta final e tem configurações adequadas
     */
    static validateRetaFinalMode(plan, topicCount, availableSlots) {
        logger.debug(`[PlanConfigValidator] Validando modo reta final`);
        
        const analysis = {
            isRetaFinalRecommended: false,
            isRetaFinalRequired: false,
            reasons: [],
            recommendations: []
        };
        
        if (topicCount > availableSlots) {
            analysis.isRetaFinalRequired = true;
            analysis.reasons.push(`${topicCount} tópicos para apenas ${availableSlots} sessões disponíveis`);
            
            if (!plan.reta_final_mode) {
                analysis.recommendations.push('Ativar o Modo Reta Final é obrigatório para prosseguir');
            }
        }
        
        const examDateValidation = this._validateExamDate(plan.exam_date);
        if (examDateValidation.isValid) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const timeDiff = examDateValidation.examDateObj.getTime() - today.getTime();
            const daysUntilExam = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysUntilExam < 45) {
                analysis.isRetaFinalRecommended = true;
                analysis.reasons.push(`Menos de 45 dias até a prova (${daysUntilExam} dias)`);
                
                if (!plan.reta_final_mode) {
                    analysis.recommendations.push('Considere ativar o Modo Reta Final para focar no essencial');
                }
            }
        }
        
        logger.debug(`[PlanConfigValidator] Análise modo reta final:`, analysis);
        
        return analysis;
    }
}

module.exports = PlanConfigValidator;