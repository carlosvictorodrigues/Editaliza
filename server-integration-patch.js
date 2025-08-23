/**
 * PATCH DE INTEGRAÇÃO PARA O SERVER.JS
 * 
 * Este código deve substituir as seções problemáticas identificadas
 * no server.js para corrigir os bugs críticos
 */

// IMPORTAÇÕES NECESSÁRIAS (adicionar no topo do server.js)
const { validateScheduleFeasibility } = require('./schedule-validation-solution');
const { createBalancedWeightedDistribution, analyzeDistribution } = require('./weighted-distribution-solution');

// =============================================================================
// SUBSTITUIR A VALIDAÇÃO ATUAL (LINHA 1177-1181) POR ESTA VERSÃO MELHORADA
// =============================================================================

// Validação básica existente
const totalWeeklyHours = Object.values(study_hours_per_day).reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
if (totalWeeklyHours === 0) {
    await dbRun('ROLLBACK');
    return res.status(400).json({ error: "O cronograma não pode ser gerado porque não há horas de estudo definidas." });
}

// NOVA VALIDAÇÃO DE VIABILIDADE - ADICIONAR APÓS A VALIDAÇÃO BÁSICA
const feasibilityCheck = validateScheduleFeasibility(plan, allTopics, study_hours_per_day, sessionDuration);

if (!feasibilityCheck.isfeasible) {
    await dbRun('ROLLBACK');
    
    const errorResponse = {
        error: "Cronograma não pode ser gerado: tempo insuficiente",
        details: {
            slotsDisponiveis: feasibilityCheck.totalAvailableSlots,
            slotsNecessarios: feasibilityCheck.slotsNeeded,
            deficit: feasibilityCheck.deficit,
            utilizacao: `${feasibilityCheck.utilizationRate}%`
        },
        sugestoes: feasibilityCheck.suggestions,
        message: `Seu cronograma precisaria de ${feasibilityCheck.slotsNeeded} sessões, mas há apenas ${feasibilityCheck.totalAvailableSlots} slots disponíveis até o exame (déficit: ${feasibilityCheck.deficit} sessões).`
    };
    
    console.log(`[CRONOGRAMA] Geração rejeitada - déficit de ${feasibilityCheck.deficit} slots`);
    return res.status(400).json(errorResponse);
}

// Log da validação bem-sucedida
console.log(`[CRONOGRAMA] Viabilidade confirmada: ${feasibilityCheck.totalAvailableSlots} slots disponíveis para ${feasibilityCheck.slotsNeeded} necessários (${feasibilityCheck.utilizationRate}% de utilização)`);

// =============================================================================
// SUBSTITUIR A DISTRIBUIÇÃO DE PESOS (LINHAS 1296-1301) POR ESTA VERSÃO
// =============================================================================

const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');

// SUBSTITUIR ISTO:
// const weightedTopics = pendingTopics.flatMap(t => Array(t.priority).fill(t));
// for (let i = weightedTopics.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [weightedTopics[i], weightedTopics[j]] = [weightedTopics[j], weightedTopics[i]];
// }
// const uniquePendingTopicsInOrder = [...new Map(weightedTopics.map(item => [item.id, item])).values()];

// PELA NOVA DISTRIBUIÇÃO EQUILIBRADA:
const uniquePendingTopicsInOrder = createBalancedWeightedDistribution(pendingTopics);

// Análise da distribuição para logs (opcional, remove em produção)
const distributionAnalysis = analyzeDistribution(uniquePendingTopicsInOrder);
console.log(`[CRONOGRAMA] Análise da distribuição:`, {
    totalTopicos: distributionAnalysis.totalTopics,
    materias: Object.keys(distributionAnalysis.subjectDistribution).length,
    maxConsecutivos: distributionAnalysis.maxConsecutiveSubject,
    distribuicaoPorMateria: distributionAnalysis.subjectDistribution
});

// =============================================================================
// MELHORAR O TRATAMENTO DE ERRO QUANDO NÃO HÁ SLOTS (LINHA 1307-1308)
// =============================================================================

let topicsProcessed = 0;
let topicsSkipped = 0;
const skippedTopics = [];

for (const topic of uniquePendingTopicsInOrder) {
    const studyDay = findNextAvailableSlot(currentDateForNewTopics, true);
    
    if (!studyDay) {
        // MELHORIA: Em vez de break silencioso, registrar tópicos perdidos
        topicsSkipped++;
        skippedTopics.push({
            id: topic.id,
            subject: topic.subject_name,
            description: topic.description,
            priority: topic.priority,
            reason: 'Sem slots disponíveis para novos tópicos'
        });
        
        console.log(`[CRONOGRAMA] ⚠ Tópico ${topic.id} (${topic.subject_name}) pulado - sem slots disponíveis`);
        continue; // Tentar o próximo em vez de parar completamente
    }
    
    addSessionToAgenda(studyDay, { 
        topicId: topic.id, 
        subjectName: topic.subject_name, 
        topicDescription: topic.description, 
        sessionType: 'Novo Tópico' 
    });
    
    topicsProcessed++;
    lastNewTopicDate = new Date(studyDay);
    currentDateForNewTopics = new Date(studyDay);
    
    // Agendar revisões
    [7, 14, 28].forEach(days => {
        const targetReviewDate = new Date(studyDay);
        targetReviewDate.setDate(targetReviewDate.getDate() + days);
        if (targetReviewDate <= examDate) {
            const reviewDay = getNextSaturdayForReview(targetReviewDate);
            if (reviewDay) {
                addSessionToAgenda(reviewDay, { 
                    topicId: topic.id, 
                    subjectName: topic.subject_name, 
                    topicDescription: topic.description, 
                    sessionType: `Revisão ${days}D` 
                });
            }
        }
    });
}

// =============================================================================
// MELHORAR A RESPOSTA FINAL PARA INCLUIR INFORMAÇÕES DE DIAGNÓSTICO
// =============================================================================

// SUBSTITUIR A RESPOSTA FINAL (LINHA 1480-1487) POR ESTA VERSÃO:
const responseMessage = skippedTopics.length === 0 
    ? `Seu mapa para a aprovação foi traçado com sucesso! 🗺️`
    : `Cronograma gerado com ${topicsSkipped} tópico(s) não agendado(s) por falta de tempo. ⚠️`;

res.json({
    message: responseMessage,
    success: topicsSkipped === 0,
    performance: {
        executionTime: `${endTime - startTime}ms`,
        sessionsCreated: sessionsToCreate.length,
        topicsProcessed: allTopics.length,
        topicsScheduled: topicsProcessed,
        topicsSkipped: topicsSkipped
    },
    scheduling: {
        viability: {
            totalSlots: feasibilityCheck.totalAvailableSlots,
            slotsUsed: sessionsToCreate.length,
            utilizationRate: `${((sessionsToCreate.length / feasibilityCheck.totalAvailableSlots) * 100).toFixed(1)}%`
        },
        distribution: {
            subjects: Object.keys(distributionAnalysis.subjectDistribution).length,
            maxConsecutiveTopics: distributionAnalysis.maxConsecutiveSubject,
            balanceScore: distributionAnalysis.maxConsecutiveSubject <= 3 ? 'Good' : 'Needs Improvement'
        }
    },
    // Incluir tópicos perdidos se houver
    ...(skippedTopics.length > 0 && {
        warnings: {
            skippedTopics: skippedTopics.slice(0, 5), // Primeiros 5 para não sobrecarregar
            totalSkipped: skippedTopics.length,
            suggestion: "Considere estender a data do exame ou aumentar as horas de estudo diárias."
        }
    })
});

// =============================================================================
// FUNÇÃO DE TESTE PARA VALIDAR AS MELHORIAS
// =============================================================================

/**
 * Função de teste que pode ser chamada para validar as melhorias
 * Adicionar como rota temporária: app.get('/test-schedule-improvements', ...)
 */
const testScheduleImprovements = async (planId) => {
    const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [planId]);
    const allTopics = await dbAll(`
        SELECT t.id, t.description, t.status, t.completion_date,
               s.subject_name, s.priority_weight as priority
        FROM subjects s
        INNER JOIN topics t ON s.id = t.subject_id
        WHERE s.study_plan_id = ?
        ORDER BY s.priority_weight DESC, t.id ASC
    `, [planId]);
    
    const studyHours = JSON.parse(plan.study_hours_per_day);
    const sessionDuration = plan.session_duration_minutes || 50;
    
    // Teste da validação de viabilidade
    const feasibility = validateScheduleFeasibility(plan, allTopics, studyHours, sessionDuration);
    
    // Teste da distribuição equilibrada
    const pendingTopics = allTopics.filter(t => t.status !== 'Concluído');
    const distribution = createBalancedWeightedDistribution(pendingTopics);
    const analysis = analyzeDistribution(distribution);
    
    return {
        feasibility,
        distribution: {
            totalTopics: distribution.length,
            analysis
        }
    };
};

module.exports = {
    testScheduleImprovements
};