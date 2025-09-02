const { dbGet, dbAll, dbRun } = require('../../../database-postgresql');
const PlanConfigValidator = require('../../validators/PlanConfigValidator');

class ScheduleGenerationService {

    static async generate(config) {
        console.log('[SCHEDULE_GEN] Iniciando geração com lógica de Simulado Direcionado ponderado...', { planId: config.planId });

        const validation = PlanConfigValidator.validate(config);
        if (!validation.isValid) {
            throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
        }
        const sanitizedConfig = PlanConfigValidator.sanitize(config);
        const { planId, userId } = sanitizedConfig;

        await dbRun('BEGIN');
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) throw new Error('Plano não encontrado ou não autorizado.');

            await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\'', [planId]);

            const allTopicsFromDB = await dbAll(`
                SELECT t.id, t.topic_name, s.id as subject_id, s.subject_name, 
                       COALESCE(s.priority_weight, 3) as subject_priority, 
                       COALESCE(t.priority_weight, 3) as topic_priority
                FROM topics t
                JOIN subjects s ON t.subject_id = s.id
                WHERE s.study_plan_id = ?
            `, [planId]);

            const pendingTopics = allTopicsFromDB.filter(t => t.status !== 'Concluído');

            if (pendingTopics.length === 0) {
                // Se não há tópicos pendentes, vai direto para a fase de manutenção (simulados)
                console.log('[SCHEDULE_GEN] Nenhum tópico pendente. Pulando para a fase de simulados.');
            }

            const topicsWithPriority = pendingTopics.map(topic => ({
                ...topic,
                final_weight: (topic.subject_priority * 10) + topic.topic_priority
            }));

            const sortedTopics = topicsWithPriority.sort((a, b) => b.final_weight - a.final_weight);
            const studyDays = this.calculateStudyDays(plan, sanitizedConfig);
            if (studyDays.length === 0) throw new Error('Não há dias de estudo disponíveis até a data da prova.');

            // 1. Agendar novos tópicos (apenas em dias de semana)
            let schedule = this.distributeTopics(sortedTopics, studyDays);
            
            // 2. Agendar revisões (apenas aos sábados)
            schedule = this.scheduleReviews(schedule, studyDays, planId);

            // 3. Preencher dias restantes com simulados
            schedule = this.fillWithDirectedSimulados(schedule, allTopicsFromDB, studyDays, planId);

            const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            for (const session of schedule) {
                // Adicionar metadados completos
                const meta = {
                    topic_id: session.topicId,
                    topic_name: session.topicName || session.topicDescription,
                    subject_id: session.subjectId,
                    subject_name: session.subjectName,
                    iteration: session.iteration || 1,
                    weight: session.weight || 0,
                    plannedMinutes: 60,
                    reviewLabel: session.reviewLabel || null
                };
                
                await dbRun(insertSql, [
                    planId, 
                    session.topicId, 
                    session.subjectName, 
                    session.topicDescription, 
                    session.date, 
                    session.sessionType, 
                    'Pendente',
                    JSON.stringify(meta)
                ]);
            }

            await dbRun('COMMIT');

            return {
                success: true,
                message: `Cronograma gerado com ${schedule.length} sessões.`, 
                statistics: { totalSessions: schedule.length }
            };

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('[SCHEDULE_GEN] Erro ao gerar cronograma:', error);
            throw error;
        }
    }

    static calculateStudyDays(plan, config) {
        console.log('[DEBUG] calculateStudyDays - Input plan:', plan);
        console.log('[DEBUG] calculateStudyDays - Input config:', config);
        
        const studyDays = [];
        const today = new Date();
        const examDate = new Date(plan.exam_date);
        let currentDate = new Date(today);
        
        console.log('[DEBUG] calculateStudyDays - Dates:', {
            todayMillis: today.getTime(),
            examDateMillis: examDate.getTime(),
            examDateString: plan.exam_date,
            study_hours_per_day: config.study_hours_per_day,
            study_hours_type: typeof config.study_hours_per_day
        });
        
        if (!config.study_hours_per_day) {
            console.error('[ERROR] config.study_hours_per_day is null or undefined!');
            return studyDays;
        }

        while (currentDate <= examDate) {
            const dayOfWeek = currentDate.getDay();
            // Convert dayOfWeek to string to match JSON keys ("0", "1", etc)
            const hours = config.study_hours_per_day[String(dayOfWeek)] || 0;
            if (hours > 0) {
                const sessions = Math.floor((hours * 60) / config.session_duration_minutes);
                if (sessions > 0) {
                    studyDays.push({ date: new Date(currentDate), sessions, dayOfWeek });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log('[DEBUG] Total study days found:', studyDays.length);
        if (studyDays.length > 0) {
            console.log('[DEBUG] First study day:', studyDays[0]);
            console.log('[DEBUG] Last study day:', studyDays[studyDays.length - 1]);
        }
        return studyDays;
    }

    static distributeTopics(topics, studyDays) {
        console.log('\n\n[PROPORTIONAL RECURRENCE] Iniciando sistema de recorrência proporcional\n\n');
        const schedule = [];
        
        if (topics.length === 0) {
            console.log('[PROPORTIONAL RECURRENCE] Nenhum tópico para distribuir');
            return schedule;
        }

        // 1. CÁLCULO DE RECORRÊNCIA PROPORCIONAL
        console.log('[STEP 1] Calculando recorrência proporcional...');
        
        // Calcular peso combinado e normalizar
        const normalizedTopics = this.calculateProportionalRecurrence(topics, studyDays);
        
        // 2. ALGORITMO WRR MELHORADO - Expandir tópicos pela recorrência
        console.log('[STEP 2] Expandindo tópicos com WRR melhorado...');
        const expandedQueue = this.createExpandedQueue(normalizedTopics);
        
        // 3. CRIAR SLOTS DISPONÍVEIS
        const sessionSlots = this.createSessionSlots(studyDays);
        console.log(`[STEP 3] Total de slots disponíveis: ${sessionSlots.length}`);
        
        // 4. DISTRIBUIR COM VALIDAÇÃO DE ESPAÇAMENTO
        console.log('[STEP 4] Distribuindo com validação de espaçamento...');
        const daysToExam = studyDays.length; // Aproximação de dias até a prova
        const distributedSchedule = this.distributeWithSpacingValidation(expandedQueue, sessionSlots, daysToExam);
        
        // 5. LOGS FINAIS
        this.logFinalDistribution(distributedSchedule);
        
        return distributedSchedule;
    }
    
    /**
     * Calcula a recorrência proporcional baseada no peso combinado
     */
    static calculateProportionalRecurrence(topics, studyDays) {
        console.log('[RECURRENCE CALC] Calculando pesos combinados e recorrência...');
        
        // Filtrar apenas dias úteis (segunda a sexta)
        const workdays = studyDays.filter(day => day.dayOfWeek >= 1 && day.dayOfWeek <= 5);
        
        // Calcular total de SLOTS (não dias)
        const totalSlots = workdays.reduce((sum, day) => sum + (day.sessions || 3), 0);
        console.log(`[RECURRENCE CALC] Total de slots de estudo disponíveis: ${totalSlots}`);
        console.log(`[RECURRENCE CALC] Total de dias úteis: ${workdays.length}`);
        
        // Funções auxiliares para cálculo preciso
        const norm = (v) => [0, 0.2, 0.4, 0.6, 0.8, 1.0][Math.max(0, Math.min(5, Math.floor(v)))];
        const scale = (w) => 0.5 + 1.5 * w; // Mapeia [0,1] -> [0.5, 2.0]
        const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
        
        // Base de recorrência: slots divididos pelos tópicos
        const base = Math.ceil(totalSlots / topics.length);
        const cap = Math.ceil(workdays.length / 7); // Máximo 1x por semana
        
        console.log(`[RECURRENCE CALC] Base de recorrência: ${base}, Cap semanal: ${cap}`);
        
        const topicsWithRecurrence = topics.map(topic => {
            // Peso combinado usando normalização precisa
            const subjectWeight = norm(topic.subject_priority || 3);
            const topicWeight = norm(topic.topic_priority || 3);
            const combinedWeight = (subjectWeight * 0.7) + (topicWeight * 0.3);
            
            // Calcular aparições alvo
            const targetAppearances = clamp(
                Math.round(base * scale(combinedWeight)),
                1,  // Mínimo 1 aparição
                cap // Cap semanal
            );
            
            return {
                ...topic,
                combinedWeight,
                normalizedWeight: combinedWeight,
                targetAppearances,
                lastAppearanceIndex: -1 // Para controle de espaçamento
            };
        });
        
        // Log detalhado dos cálculos
        console.log('[RECURRENCE CALC] Pesos e recorrências calculadas:');
        topicsWithRecurrence.forEach(topic => {
            console.log(`  - ${topic.subject_name} > ${topic.topic_name}:`);
            console.log(`    Combined Weight: ${topic.combinedWeight.toFixed(2)}`);
            console.log(`    Normalized Weight: ${topic.normalizedWeight.toFixed(2)}`);
            console.log(`    Target Appearances: ${topic.targetAppearances}`);
        });
        
        return topicsWithRecurrence;
    }
    
    /**
     * Cria fila expandida com múltiplas instâncias de cada tópico
     */
    static createExpandedQueue(normalizedTopics) {
        console.log('[WRR EXPANSION] Expandindo fila com múltiplas instâncias...');
        
        const expandedQueue = [];
        
        normalizedTopics.forEach(topic => {
            for (let i = 0; i < topic.targetAppearances; i++) {
                expandedQueue.push({
                    ...topic,
                    iteration: i + 1,
                    queueWeight: topic.normalizedWeight,
                    currentWeight: 0
                });
            }
        });
        
        console.log(`[WRR EXPANSION] Fila expandida criada: ${expandedQueue.length} instâncias`);
        
        // Log da distribuição por tópico
        const distributionByTopic = {};
        expandedQueue.forEach(item => {
            const key = `${item.subject_name} > ${item.topic_name}`;
            distributionByTopic[key] = (distributionByTopic[key] || 0) + 1;
        });
        
        console.log('[WRR EXPANSION] Distribuição de instâncias por tópico:');
        Object.entries(distributionByTopic).forEach(([topic, count]) => {
            console.log(`  - ${topic}: ${count} instâncias`);
        });
        
        return expandedQueue;
    }
    
    /**
     * Cria slots de sessão disponíveis
     */
    static createSessionSlots(studyDays) {
        const sessionSlots = [];
        const weekdays = studyDays.filter(day => day.dayOfWeek >= 1 && day.dayOfWeek <= 5);
        
        weekdays.forEach((day, dayIndex) => {
            for (let sessionIndex = 0; sessionIndex < day.sessions; sessionIndex++) {
                sessionSlots.push({ 
                    date: day.date.toISOString().split('T')[0],
                    dayIndex, // Para cálculo de espaçamento
                    sessionIndex,
                    globalIndex: sessionSlots.length
                });
            }
        });
        
        return sessionSlots;
    }
    
    /**
     * Distribui tópicos com validação de espaçamento e cap por disciplina
     */
    static distributeWithSpacingValidation(expandedQueue, sessionSlots, daysToExam = 30) {
        console.log('[SPACING VALIDATION] Iniciando distribuição com validação...');
        
        const schedule = [];
        const topicLastAppearance = {}; // Rastrear última aparição por tópico original
        const subjectSessionCount = {}; // Contar sessões por disciplina
        const maxSharePerSubject = 0.45; // Máximo 45% por disciplina
        
        // Calcular peso total para WRR
        const totalWeight = expandedQueue.reduce((sum, item) => sum + item.queueWeight, 0);
        
        // Copiar fila para manipulação
        const availableItems = [...expandedQueue];
        
        for (let slotIndex = 0; slotIndex < sessionSlots.length && availableItems.length > 0; slotIndex++) {
            const currentSlot = sessionSlots[slotIndex];
            let selectedItem = null;
            let selectedIndex = -1;
            
            // Algoritmo WRR com validação de espaçamento
            let attempts = 0;
            const maxAttempts = availableItems.length * 2; // Evitar loop infinito
            
            while (selectedItem === null && attempts < maxAttempts) {
                attempts++;
                
                // Atualizar pesos correntes
                availableItems.forEach(item => {
                    item.currentWeight += item.queueWeight;
                });
                
                // Encontrar item com maior peso corrente
                let maxWeight = -Infinity;
                let candidateItem = null;
                let candidateIndex = -1;
                
                availableItems.forEach((item, index) => {
                    if (item.currentWeight > maxWeight) {
                        // Verificar cap por disciplina (45%)
                        const subjectCount = subjectSessionCount[item.subject_name] || 0;
                        const totalScheduled = schedule.length;
                        const subjectShare = totalScheduled > 0 ? subjectCount / totalScheduled : 0;
                        const underCap = subjectShare < maxSharePerSubject || totalScheduled < 5; // Permitir nos primeiros slots
                        
                        if (underCap) {
                            maxWeight = item.currentWeight;
                            candidateItem = item;
                            candidateIndex = index;
                        }
                    }
                });
                
                if (!candidateItem) break;
                
                // Validar espaçamento mínimo
                const topicKey = `${candidateItem.subject_name}_${candidateItem.topic_name}`;
                const lastAppearance = topicLastAppearance[topicKey];
                
                // Determinar espaçamento mínimo baseado no contexto
                const minimumSpacing = (daysToExam < 14 && candidateItem.weightCombined >= 0.9) ? 1 : 2;
                
                if (lastAppearance === undefined || (slotIndex - lastAppearance) >= minimumSpacing) {
                    // Espaçamento válido
                    selectedItem = candidateItem;
                    selectedIndex = candidateIndex;
                    
                    // Atualizar última aparição
                    topicLastAppearance[topicKey] = slotIndex;
                    
                    // Deduzir peso total
                    selectedItem.currentWeight -= totalWeight;
                } else {
                    // Espaçamento inválido - penalizar temporariamente
                    candidateItem.currentWeight -= totalWeight;
                }
            }
            
            if (selectedItem) {
                // Agendar o item selecionado
                schedule.push({
                    date: currentSlot.date,
                    topicId: selectedItem.id,
                    topicName: selectedItem.topic_name,
                    subjectId: selectedItem.subject_id,
                    subjectName: selectedItem.subject_name,
                    topicDescription: `${selectedItem.topic_name} (${selectedItem.iteration}ª vez)`,
                    sessionType: selectedItem.iteration === 1 ? 'Novo Tópico' : 'Reforço',
                    iteration: selectedItem.iteration,
                    weight: selectedItem.normalizedWeight || selectedItem.weightCombined || 0
                });
                
                // Atualizar contador por disciplina
                subjectSessionCount[selectedItem.subject_name] = (subjectSessionCount[selectedItem.subject_name] || 0) + 1;
                
                // Remover item da fila
                availableItems.splice(selectedIndex, 1);
            } else {
                // Não conseguiu encontrar item válido - degradar tópicos leves
                console.log(`[SPACING VALIDATION] Slot ${slotIndex}: Degradando tópicos leves por falta de espaçamento`);
                
                // Encontrar tópico com menor peso que não viola espaçamento
                let fallbackItem = null;
                let fallbackIndex = -1;
                let minWeight = Infinity;
                
                availableItems.forEach((item, index) => {
                    if (item.queueWeight < minWeight) {
                        const topicKey = `${item.subject_name}_${item.topic_name}`;
                        const lastAppearance = topicLastAppearance[topicKey];
                        
                        if (lastAppearance === undefined || (slotIndex - lastAppearance) >= minimumSpacing) {
                            minWeight = item.queueWeight;
                            fallbackItem = item;
                            fallbackIndex = index;
                        }
                    }
                });
                
                if (fallbackItem) {
                    schedule.push({
                        date: currentSlot.date,
                        topicId: fallbackItem.id,
                        topicName: fallbackItem.topic_name,
                        subjectId: fallbackItem.subject_id,
                        subjectName: fallbackItem.subject_name,
                        topicDescription: `${fallbackItem.topic_name} (${fallbackItem.iteration}ª vez - degradado)`,
                        sessionType: fallbackItem.iteration === 1 ? 'Novo Tópico' : 'Reforço',
                        iteration: fallbackItem.iteration,
                        weight: fallbackItem.normalizedWeight || fallbackItem.weightCombined || 0
                    });
                    
                    const topicKey = `${fallbackItem.subject_name}_${fallbackItem.topic_name}`;
                    topicLastAppearance[topicKey] = slotIndex;
                    
                    // Atualizar contador por disciplina
                    subjectSessionCount[fallbackItem.subject_name] = (subjectSessionCount[fallbackItem.subject_name] || 0) + 1;
                    
                    availableItems.splice(fallbackIndex, 1);
                } else {
                    // Não há mais itens válidos
                    break;
                }
            }
        }
        
        console.log(`[SPACING VALIDATION] Distribuição concluída: ${schedule.length} sessões agendadas`);
        return schedule;
    }
    
    /**
     * Log da distribuição final
     */
    static logFinalDistribution(schedule) {
        console.log('\n[FINAL DISTRIBUTION] Relatório da distribuição proporcional:');
        
        // Estatísticas por tópico
        const topicStats = {};
        const subjectStats = {};
        
        schedule.forEach(session => {
            const topicKey = `${session.subjectName} > ${session.topicDescription.split(' (')[0]}`;
            const subjectKey = session.subjectName;
            
            if (!topicStats[topicKey]) {
                topicStats[topicKey] = { 
                    count: 0, 
                    iterations: [], 
                    weight: session.weight || 0
                };
            }
            if (!subjectStats[subjectKey]) {
                subjectStats[subjectKey] = 0;
            }
            
            topicStats[topicKey].count++;
            topicStats[topicKey].iterations.push(session.iteration || 1);
            subjectStats[subjectKey]++;
        });
        
        console.log('\n📊 Estatísticas por matéria:');
        Object.entries(subjectStats)
            .sort(([,a], [,b]) => b - a)
            .forEach(([subject, count]) => {
                console.log(`  ${subject}: ${count} sessões`);
            });
        
        console.log('\n📋 Estatísticas por tópico (Top 10):');
        Object.entries(topicStats)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 10)
            .forEach(([topic, stats]) => {
                console.log(`  ${topic}:`);
                console.log(`    - Aparições: ${stats.count}`);
                console.log(`    - Iterações: [${stats.iterations.join(', ')}]`);
                console.log(`    - Peso: ${stats.weight.toFixed(3)}`);
            });
        
        console.log('\n✅ Sistema de recorrência proporcional concluído!\n');
    }

    static scheduleReviews(schedule, studyDays) {
        const reviewsToSchedule = {};
        const reviewDays = [7, 14, 28];
        schedule.forEach(session => {
            if (session.sessionType === 'Novo Tópico') {
                const baseDate = new Date(session.date + 'T00:00:00');
                reviewDays.forEach(days => {
                    const idealReviewDate = new Date(baseDate);
                    idealReviewDate.setDate(idealReviewDate.getDate() + days);
                    const nextSaturday = this.findNextSaturday(idealReviewDate, studyDays);
                    if (nextSaturday) {
                        const dateStr = nextSaturday.toISOString().split('T')[0];
                        if (!reviewsToSchedule[dateStr]) reviewsToSchedule[dateStr] = [];
                        reviewsToSchedule[dateStr].push({ ...session, reviewType: `R${days}` });
                    }
                });
            }
        });

        for (const dateStr in reviewsToSchedule) {
            const topicsForDay = reviewsToSchedule[dateStr];
            const description = 'Revisão consolidada dos seguintes tópicos:\n' +
                              Object.entries(topicsForDay.reduce((acc, topic) => {
                                  if (!acc[topic.subjectName]) acc[topic.subjectName] = [];
                                  acc[topic.subjectName].push(`- ${topic.topicDescription} (${topic.reviewType})`);
                                  return acc;
                              }, {})).map(([subject, topics]) => `\n**${subject}:**\n${topics.join('\n')}`).join('');
            schedule.push({
                date: dateStr,
                topicId: null,
                subjectName: 'Revisão Semanal',
                reviewLabel: topicsForDay[0]?.reviewType || 'R7',
                topicDescription: description,
                sessionType: 'Revisão Consolidada'
            });
        }
        return schedule;
    }

    static fillWithDirectedSimulados(schedule, allTopics, studyDays, planId) {
        const scheduledDates = new Set(schedule.map(s => s.date));
        const emptySlots = studyDays.filter(day => !scheduledDates.has(day.date.toISOString().split('T')[0]) && day.dayOfWeek !== 0); // Não preencher domingos

        if (emptySlots.length === 0 || allTopics.length === 0) return schedule;

        console.log(`[SCHEDULE_GEN] Preenchendo ${emptySlots.length} dias restantes com Simulado Direcionado ponderado.`);

        // Agrupar todos os tópicos por disciplina e capturar os pesos
        const subjectData = {};
        allTopics.forEach(topic => {
            if (!subjectData[topic.subject_name]) {
                subjectData[topic.subject_name] = {
                    name: topic.subject_name,
                    weight: topic.subject_priority || 3, // Peso padrão 3 se não definido
                    currentWeight: 0, // Para o algoritmo WRR
                    topics: []
                };
            }
            subjectData[topic.subject_name].topics.push(topic.topic_name);
        });

        const subjects = Object.values(subjectData);
        
        // Se não houver disciplinas, retornar o cronograma sem modificações
        if (subjects.length === 0) return schedule;
        
        const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0);

        console.log('[SIMULADO_DIRECIONADO] Disciplinas e pesos para simulados:', subjects.map(s => ({
            name: s.name,
            weight: s.weight,
            topics: s.topics.length
        })));

        // Usar Weighted Round-Robin para distribuir as práticas proporcionalmente aos pesos
        for (const slot of emptySlots) {
            // Adiciona o peso de cada matéria ao seu peso corrente
            subjects.forEach(s => {
                s.currentWeight += s.weight;
            });

            // Encontra a matéria com o maior peso corrente
            let maxWeight = -Infinity;
            let selectedSubject = null;
            subjects.forEach(s => {
                if (s.currentWeight > maxWeight) {
                    maxWeight = s.currentWeight;
                    selectedSubject = s;
                }
            });

            if (!selectedSubject) break;

            // Deduz o peso total da matéria escolhida
            selectedSubject.currentWeight -= totalWeight;

            // Seleciona até 5 tópicos aleatórios da disciplina escolhida para a prática
            const topicsForPractice = [...selectedSubject.topics]
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.min(5, selectedSubject.topics.length));

            const description = `Simulado direcionado de ${selectedSubject.name} com foco nos seguintes tópicos:\n` +
                              topicsForPractice.map(t => `- ${t}`).join('\n') +
                              `\n\nResolva questões específicas destes tópicos para consolidar o conhecimento.`;

            schedule.push({
                date: slot.date.toISOString().split('T')[0],
                topicId: null,
                subjectName: `Simulado: ${selectedSubject.name}`,
                topicDescription: description,
                sessionType: 'Simulado Direcionado',
                meta: {
                    focus: topicsForPractice,
                    nQuestoes: 25,
                    tempoSugerido: '30-40 min'
                }
            });
        }

        // Log estatísticas finais
        const practiceCount = {};
        schedule.forEach(session => {
            if (session.sessionType === 'Simulado Direcionado' || session.sessionType === 'Prática Dirigida') {
                const subjectName = session.subjectName.replace('Simulado: ', '').replace('Prática: ', '');
                practiceCount[subjectName] = (practiceCount[subjectName] || 0) + 1;
            }
        });

        console.log('[SIMULADO_DIRECIONADO] Distribuição final de simulados direcionados:', practiceCount);

        return schedule;
    }

    static findNextSaturday(startDate, studyDays) {
        let currentDate = new Date(startDate);
        for (let i = 0; i < 365; i++) {
            if (currentDate.getDay() === 6) { // 6 = Sábado
                const dateStr = currentDate.toISOString().split('T')[0];
                if (studyDays.some(d => d.date.toISOString().split('T')[0] === dateStr)) {
                    return currentDate;
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return null;
    }
}

module.exports = ScheduleGenerationService;