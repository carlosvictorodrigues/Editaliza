/**
 * MELHORIAS CRÍTICAS NO SERVIDOR - GERAÇÃO DE CRONOGRAMA
 * 
 * Este arquivo contém as correções para os bugs identificados no relatório:
 * 1. Validação pré-geração de cronograma
 * 2. Modo Reta Final com priorização
 * 3. Distribuição equilibrada de pesos
 * 4. Relatórios detalhados para o usuário
 */

// ============================================
// 1. ADIÇÃO DO CAMPO RETA_FINAL NO BANCO
// ============================================
/*
   Execute este SQL para adicionar o campo:
   
   ALTER TABLE study_plans ADD COLUMN reta_final_mode INTEGER DEFAULT 0;
   
   Ou adicione na próxima migração
*/

// ============================================
// 2. VALIDAÇÃO PRÉ-GERAÇÃO (SUBSTITUIR NO SERVER.JS)
// ============================================

// Encontre a função de geração de cronograma (por volta da linha 1200) e substitua o início por:

const generateScheduleWithValidation = async (planId, planData) => {
    console.log(`[CRONOGRAMA] Iniciando geração para o plano ${planId}`);
    
    // **NOVA FUNCIONALIDADE: Modo Reta Final**
    const isRetaFinal = planData.reta_final_mode === true || planData.reta_final_mode === 1;
    if (isRetaFinal) {
        console.log(`🚨 [MODO RETA FINAL ATIVADO] - Priorizando disciplinas de maior peso`);
    }
    
    let agenda = {};
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const examDate = new Date(planData.exam_date + 'T23:59:59');
    
    // **VALIDAÇÃO DE VIABILIDADE PREDITIVA**
    const totalDaysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    const studyDaysPerWeek = planData.study_days ? planData.study_days.split(',').length : 5;
    const totalStudyDaysAvailable = Math.floor((totalDaysUntilExam / 7) * studyDaysPerWeek) + 
        (totalDaysUntilExam % 7 > 0 ? Math.min(totalDaysUntilExam % 7, studyDaysPerWeek) : 0);
    
    console.log(`[CRONOGRAMA] Período: ${today.toISOString().split('T')[0]} até ${examDate.toISOString().split('T')[0]} (${totalDaysUntilExam} dias, ${totalStudyDaysAvailable} dias de estudo)`);
    console.log(`[CRONOGRAMA] Configuração de estudo: ${planData.study_hours} horas/dia, dias: ${planData.study_days}`);
    
    // Buscar todos os tópicos
    const allTopics = await db.prepare(`
        SELECT st.id, st.description, st.subject_id, su.name as subject_name, su.priority, st.status
        FROM subject_topics st
        JOIN subjects su ON st.subject_id = su.id
        WHERE su.plan_id = ?
        ORDER BY su.priority DESC, st.id ASC
    `).all(planId);
    
    if (allTopics.length === 0) {
        throw new Error('Nenhum tópico encontrado para este plano. Adicione disciplinas e tópicos primeiro.');
    }
    
    const completedTopics = allTopics.filter(topic => topic.status === 'Concluído');
    const pendingTopics = allTopics.filter(topic => topic.status !== 'Concluído');
    
    // **VALIDAÇÃO DE VIABILIDADE**
    const totalPendingTopics = pendingTopics.length;
    const averageTopicsPerDay = totalPendingTopics / totalStudyDaysAvailable;
    const isViable = totalStudyDaysAvailable >= totalPendingTopics;
    
    console.log(`[VALIDAÇÃO] ${totalPendingTopics} tópicos pendentes, ${totalStudyDaysAvailable} dias disponíveis, média: ${averageTopicsPerDay.toFixed(1)} tópicos/dia`);
    
    if (!isViable && !isRetaFinal) {
        const suggestions = [];
        if (averageTopicsPerDay > 3) {
            suggestions.push(`Aumente suas horas diárias de ${planData.study_hours}h para pelo menos ${Math.ceil(averageTopicsPerDay * planData.study_hours / 3)}h`);
        }
        if (studyDaysPerWeek < 6) {
            suggestions.push(`Estude ${7 - studyDaysPerWeek} dia(s) a mais por semana`);
        }
        if (totalDaysUntilExam > 30) {
            suggestions.push(`Considere adiantar a data da prova em ${Math.ceil((totalPendingTopics - totalStudyDaysAvailable) / studyDaysPerWeek)} semanas`);
        } else {
            suggestions.push('Ative o Modo Reta Final para priorizar disciplinas mais importantes');
        }
        
        throw new Error(`❌ CRONOGRAMA INVIÁVEL: ${totalPendingTopics} tópicos para ${totalStudyDaysAvailable} dias de estudo.\\n\\n📋 SUGESTÕES:\\n${suggestions.map(s => `• ${s}`).join('\\n')}\\n\\nOu ative o Modo Reta Final para focar nas disciplinas prioritárias.`);
    }
    
    // **MODO RETA FINAL: Filtrar tópicos por prioridade**
    let topicsToSchedule = pendingTopics;
    let excludedTopics = [];
    let prioritizedSubjects = [];
    
    if (isRetaFinal && !isViable) {
        // Agrupar por prioridade
        const topicsByPriority = {};
        pendingTopics.forEach(topic => {
            if (!topicsByPriority[topic.priority]) {
                topicsByPriority[topic.priority] = [];
            }
            topicsByPriority[topic.priority].push(topic);
        });
        
        // Ordenar prioridades (maior primeiro)
        const priorities = Object.keys(topicsByPriority).map(Number).sort((a, b) => b - a);
        
        topicsToSchedule = [];
        let slotsUsed = 0;
        
        // Adicionar tópicos por prioridade até esgotar slots
        for (const priority of priorities) {
            const priorityTopics = topicsByPriority[priority];
            const subjectName = priorityTopics[0].subject_name;
            
            if (slotsUsed + priorityTopics.length <= totalStudyDaysAvailable) {
                // Toda a disciplina cabe
                topicsToSchedule.push(...priorityTopics);
                slotsUsed += priorityTopics.length;
                prioritizedSubjects.push({ name: subjectName, weight: priority, topics: priorityTopics.length });
            } else {
                // Disciplina só parcialmente cabe
                const availableSlots = totalStudyDaysAvailable - slotsUsed;
                if (availableSlots > 0) {
                    topicsToSchedule.push(...priorityTopics.slice(0, availableSlots));
                    excludedTopics.push(...priorityTopics.slice(availableSlots));
                    prioritizedSubjects.push({ name: subjectName, weight: priority, topics: availableSlots });
                    slotsUsed = totalStudyDaysAvailable;
                } else {
                    excludedTopics.push(...priorityTopics);
                }
                break;
            }
        }
        
        console.log(`🚨 [RETA FINAL] ${topicsToSchedule.length} tópicos priorizados, ${excludedTopics.length} excluídos`);
    }
    
    // Continuar com a lógica original usando topicsToSchedule...
    // [resto da função de geração]
    
    return {
        agenda,
        metadata: {
            isRetaFinal,
            excludedTopics,
            prioritizedSubjects,
            totalDays: totalStudyDaysAvailable,
            topicsScheduled: topicsToSchedule.length
        }
    };
};

// ============================================
// 3. DISTRIBUIÇÃO EQUILIBRADA DE PESOS
// ============================================

// Substitua a seção de distribuição de pesos (por volta da linha 1300) por:

const createBalancedWeightedDistribution = (pendingTopics) => {
    // Agrupar por disciplina e peso
    const subjectGroups = {};
    pendingTopics.forEach(topic => {
        const key = `${topic.subject_name}_${topic.priority}`;
        if (!subjectGroups[key]) {
            subjectGroups[key] = {
                subject: topic.subject_name,
                priority: topic.priority,
                topics: []
            };
        }
        subjectGroups[key].topics.push(topic);
    });
    
    // Converter grupos em array ordenado por prioridade
    const sortedGroups = Object.values(subjectGroups)
        .sort((a, b) => b.priority - a.priority);
    
    // Distribuição round-robin ponderada
    const distributedTopics = [];
    const maxRounds = Math.max(...sortedGroups.map(g => g.topics.length));
    
    for (let round = 0; round < maxRounds; round++) {
        // Para cada grupo, adicionar tópicos baseado no peso
        sortedGroups.forEach(group => {
            const weight = group.priority;
            const topicsThisRound = Math.min(weight, group.topics.length - (round * weight));
            
            for (let i = 0; i < topicsThisRound; i++) {
                const topicIndex = (round * weight) + i;
                if (topicIndex < group.topics.length) {
                    distributedTopics.push(group.topics[topicIndex]);
                }
            }
        });
    }
    
    // Embaralhar apenas dentro de grupos de mesma prioridade para manter equilíbrio
    const finalDistribution = [];
    let currentPriority = null;
    let currentGroup = [];
    
    distributedTopics.forEach(topic => {
        if (topic.priority !== currentPriority) {
            if (currentGroup.length > 0) {
                // Embaralhar grupo anterior e adicionar à distribuição final
                shuffleArray(currentGroup);
                finalDistribution.push(...currentGroup);
            }
            currentPriority = topic.priority;
            currentGroup = [topic];
        } else {
            currentGroup.push(topic);
        }
    });
    
    // Adicionar último grupo
    if (currentGroup.length > 0) {
        shuffleArray(currentGroup);
        finalDistribution.push(...currentGroup);
    }
    
    return finalDistribution;
};

// Função auxiliar para embaralhar array
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// ============================================
// 4. ENDPOINT PARA PREVIEW DE REPLANEJAMENTO
// ============================================

// Adicionar nova rota no server.js:

app.get('/plans/:planId/replan_preview', authenticateToken, async (req, res) => {
    try {
        const planId = req.params.planId;
        
        // Buscar tarefas atrasadas
        const overdueCount = await db.prepare(`
            SELECT COUNT(*) as count 
            FROM study_sessions 
            WHERE study_plan_id = ? AND session_date < date('now') AND status != 'Concluído'
        `).get(planId);
        
        // Calcular slots disponíveis nos próximos 30 dias
        const plan = await db.prepare('SELECT * FROM study_plans WHERE id = ?').get(planId);
        const studyDays = plan.study_days.split(',');
        const availableSlots = Math.floor(30 / 7) * studyDays.length;
        
        // Simular mudanças
        const changes = [
            {
                description: `${overdueCount.count} tarefas serão reagendadas`,
                date: 'Próximos dias disponíveis'
            },
            {
                description: 'Cronograma será otimizado para manter ritmo',
                date: 'Rebalanceamento automático'
            },
            {
                description: 'Metas e datas de prova preservadas',
                date: 'Sem alterações nos objetivos'
            }
        ];
        
        res.json({
            available_slots: availableSlots,
            success_rate: Math.min(95, (availableSlots / overdueCount.count) * 100),
            changes: changes
        });
        
    } catch (error) {
        console.error('Erro no preview de replanejamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ============================================
// 5. INSTRUÇÕES DE INSTALAÇÃO
// ============================================

/*
   PARA IMPLEMENTAR ESSAS MELHORIAS:
   
   1. Execute o SQL para adicionar o campo reta_final_mode:
      ALTER TABLE study_plans ADD COLUMN reta_final_mode INTEGER DEFAULT 0;
   
   2. Substitua a função de geração de cronograma no server.js pela versão melhorada acima
   
   3. Adicione o endpoint de preview de replanejamento
   
   4. Teste com diferentes cenários:
      - Tempo suficiente (deve funcionar normalmente)
      - Tempo insuficiente sem reta final (deve mostrar erro com sugestões)
      - Tempo insuficiente com reta final (deve priorizar por peso)
   
   5. Verifique se o frontend recebe os dados corretos do metadata
*/

module.exports = {
    generateScheduleWithValidation,
    createBalancedWeightedDistribution
};