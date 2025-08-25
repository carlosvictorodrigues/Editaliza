/**
 * Índice dos validadores de cronograma
 * Facilita importação e uso dos validadores
 */

const PlanConfigValidator = require('./PlanConfigValidator');
const TopicIntegrityValidator = require('./TopicIntegrityValidator');
const TimeSlotValidator = require('./TimeSlotValidator');

module.exports = {
    PlanConfigValidator,
    TopicIntegrityValidator,
    TimeSlotValidator,
    
    // Método de conveniência para executar todas as validações principais
    async validateAll(plan, config, dbAll, dbGet) {
        const results = {
            planConfig: null,
            topics: null,
            completedTopics: null,
            timeSlots: null,
            isValid: false,
            errors: [],
            warnings: []
        };
        
        try {
            // 1. Validar configuração do plano
            results.planConfig = PlanConfigValidator.validatePlanConfiguration(plan, config);
            
            if (results.planConfig.isValid) {
                // 2. Validar tópicos do plano
                results.topics = await TopicIntegrityValidator.validatePlanTopics(plan.id, dbAll);
                
                // 3. Validar tópicos concluídos
                results.completedTopics = await TopicIntegrityValidator.validateCompletedTopics(plan.id, dbAll);
                
                // 4. Calcular slots disponíveis
                if (results.topics.isValid) {
                    const examDateResult = PlanConfigValidator._validateExamDate(plan.exam_date);
                    if (examDateResult.isValid) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const totalSlots = TimeSlotValidator.calculateTotalAvailableSlots(
                            today,
                            examDateResult.examDateObj,
                            config.study_hours_per_day,
                            parseInt(config.session_duration_minutes, 10) || 50,
                            true
                        );
                        
                        const pendingTopics = results.topics.topics.filter(t => t.status !== 'Concluído');
                        results.timeSlots = TimeSlotValidator.validateTimeAvailability(
                            pendingTopics,
                            totalSlots,
                            plan.reta_final_mode
                        );
                    }
                }
            }
            
            // Consolidar resultados
            results.errors = [
                ...results.planConfig.errors,
                ...(results.topics?.isValid === false ? [results.topics.error] : []),
                ...(results.completedTopics?.isValid === false ? [results.completedTopics.error] : []),
                ...(results.timeSlots?.issues || [])
            ].filter(Boolean);
            
            results.warnings = [
                ...results.planConfig.warnings,
                ...(results.timeSlots?.recommendations || [])
            ];
            
            results.isValid = results.errors.length === 0;
            
            return results;
            
        } catch (error) {
            results.errors.push(`Erro durante validação: ${error.message}`);
            results.isValid = false;
            return results;
        }
    }
};