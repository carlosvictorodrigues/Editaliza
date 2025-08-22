/**
 * SOLUÇÃO 1: Validação de Viabilidade do Cronograma
 * 
 * Esta função deve ser executada ANTES da geração do cronograma
 * para garantir que há tempo suficiente para todos os tópicos
 */

const validateScheduleFeasibility = (plan, allTopics, study_hours_per_day, sessionDuration) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(plan.exam_date + 'T23:59:59');
    
    // 1. Calcular total de slots disponíveis
    const totalAvailableSlots = calculateTotalAvailableSlots(today, examDate, study_hours_per_day, sessionDuration);
    
    // 2. Calcular slots necessários
    const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
    const slotsNeeded = calculateRequiredSlots(pendingTopics, plan);
    
    // 3. Validar viabilidade
    const feasibilityResult = {
        isfeasible: totalAvailableSlots >= slotsNeeded,
        totalAvailableSlots,
        slotsNeeded,
        deficit: Math.max(0, slotsNeeded - totalAvailableSlots),
        utilizationRate: (slotsNeeded / totalAvailableSlots * 100).toFixed(1)
    };
    
    // 4. Gerar sugestões se inviável
    if (!feasibilityResult.isfeasible) {
        feasibilityResult.suggestions = generateFeasibilitySuggestions(
            feasibilityResult.deficit, 
            study_hours_per_day, 
            sessionDuration, 
            examDate
        );
    }
    
    return feasibilityResult;
};

const calculateTotalAvailableSlots = (startDate, endDate, studyHours, sessionDuration) => {
    let totalSlots = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const hoursThisDay = studyHours[dayOfWeek] || 0;
        
        if (hoursThisDay > 0) {
            const slotsThisDay = Math.floor((hoursThisDay * 60) / sessionDuration);
            totalSlots += slotsThisDay;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return totalSlots;
};

const calculateRequiredSlots = (pendingTopics, plan) => {
    let totalSlots = 0;
    
    // Slots para novos tópicos
    totalSlots += pendingTopics.length;
    
    // Slots para revisões (3 revisões por tópico: 7D, 14D, 28D)
    totalSlots += pendingTopics.length * 3;
    
    // Slots para redação (se habilitada)
    if (plan.has_essay) {
        const today = new Date();
        const examDate = new Date(plan.exam_date + 'T23:59:59');
        const sundaysCount = countSundays(today, examDate);
        totalSlots += sundaysCount;
    }
    
    return totalSlots;
};

const countSundays = (startDate, endDate) => {
    let count = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        if (currentDate.getDay() === 0) count++;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
};

const generateFeasibilitySuggestions = (deficit, studyHours, sessionDuration, examDate) => {
    const suggestions = [];
    
    // Sugestão 1: Aumentar horas diárias
    const currentTotalHours = Object.values(studyHours).reduce((sum, h) => sum + (h || 0), 0);
    const additionalHoursNeeded = Math.ceil((deficit * sessionDuration) / 60 / 7); // distribuir ao longo da semana
    
    suggestions.push({
        type: 'increase_hours',
        description: `Aumentar o tempo de estudo semanal de ${currentTotalHours}h para ${currentTotalHours + additionalHoursNeeded}h`,
        impact: `Liberaria aproximadamente ${Math.floor(additionalHoursNeeded * 60 / sessionDuration)} slots adicionais por semana`
    });
    
    // Sugestão 2: Estender data do exame
    const today = new Date();
    const daysToAdd = Math.ceil(deficit / (currentTotalHours * 60 / sessionDuration / 7));
    const newExamDate = new Date(examDate);
    newExamDate.setDate(newExamDate.getDate() + daysToAdd);
    
    suggestions.push({
        type: 'extend_date',
        description: `Estender a data do exame em ${daysToAdd} dias (nova data: ${newExamDate.toLocaleDateString('pt-BR')})`,
        impact: `Liberaria aproximadamente ${deficit} slots adicionais`
    });
    
    // Sugestão 3: Reduzir duração das sessões
    if (sessionDuration > 30) {
        const newDuration = Math.max(30, sessionDuration - 10);
        const additionalSlots = Math.floor((sessionDuration - newDuration) / newDuration * currentTotalHours * 60 / 7);
        
        suggestions.push({
            type: 'reduce_session_duration',
            description: `Reduzir duração das sessões de ${sessionDuration} para ${newDuration} minutos`,
            impact: `Liberaria aproximadamente ${additionalSlots} slots adicionais por semana`
        });
    }
    
    return suggestions;
};

module.exports = {
    validateScheduleFeasibility,
    calculateTotalAvailableSlots,
    calculateRequiredSlots
};