const { dbGet, dbAll, dbRun } = require('../../../database-postgresql');
const PlanConfigValidator = require('../../validators/PlanConfigValidator');

class ScheduleGenerationService {

    static async generate(config) {
        console.log('[SCHEDULE_GEN] Iniciando geração com lógica de Prática Dirigida ponderada...', { planId: config.planId });

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
            schedule = this.fillWithSimulados(schedule, allTopicsFromDB, studyDays, planId);

            const insertSql = 'INSERT INTO study_sessions (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
            for (const session of schedule) {
                await dbRun(insertSql, [planId, session.topicId, session.subjectName, session.topicDescription, session.date, session.sessionType, 'Pendente']);
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
        console.log('\n\n[NEW ALGORITHM] Executing new distributeTopics function!\n\n');
        const schedule = [];
        if (topics.length === 0) {
            return schedule;
        }

        // 1. Agrupar tópicos por matéria e inicializar pesos
        const subjects = {};
        topics.forEach(topic => {
            if (!subjects[topic.subject_name]) {
                subjects[topic.subject_name] = {
                    name: topic.subject_name,
                    weight: topic.subject_priority,
                    currentWeight: 0, // Inicia o peso corrente para o novo algoritmo
                    topicQueue: []
                };
            }
            subjects[topic.subject_name].topicQueue.push(topic);
        });

        console.log('[DEBUG] Matérias e seus pesos:', Object.values(subjects).map(s => ({
            name: s.name,
            weight: s.weight,
            topics: s.topicQueue.length
        })));

        const subjectList = Object.values(subjects);
        const totalWeight = subjectList.reduce((sum, s) => sum + s.weight, 0);

        // 2. Criar todos os "espaços" de sessão disponíveis
        const sessionSlots = [];
        const weekdays = studyDays.filter(day => day.dayOfWeek >= 1 && day.dayOfWeek <= 5);
        weekdays.forEach(day => {
            for (let i = 0; i < day.sessions; i++) {
                sessionSlots.push({ date: day.date.toISOString().split('T')[0] });
            }
        });
        
        console.log('[DEBUG] Total de slots disponíveis:', sessionSlots.length);

        // 3. Preencher os espaços usando o algoritmo Weighted Round-Robin (versão aprimorada)
        for (const slot of sessionSlots) {
            let bestSubject = null;

            // Loop para encontrar uma matéria com tópicos disponíveis
            while (bestSubject === null) {
                // Adiciona o peso de cada matéria ao seu peso corrente
                subjectList.forEach(s => {
                    if (s.topicQueue.length > 0) {
                        s.currentWeight += s.weight;
                    }
                });

                // Encontra a matéria com o maior peso corrente
                let maxWeight = -Infinity;
                let potentialBestSubject = null;
                subjectList.forEach(s => {
                    if (s.topicQueue.length > 0 && s.currentWeight > maxWeight) {
                        maxWeight = s.currentWeight;
                        potentialBestSubject = s;
                    }
                });
                
                bestSubject = potentialBestSubject;

                if (bestSubject === null) {
                    break; // Sai do loop principal se não houver mais tópicos em nenhuma matéria
                }

                // Deduz o peso total da matéria escolhida e agenda
                bestSubject.currentWeight -= totalWeight;
                
                const topicToSchedule = bestSubject.topicQueue.shift();
                
                slot.topicId = topicToSchedule.id;
                slot.subjectName = topicToSchedule.subject_name;
                slot.topicDescription = topicToSchedule.topic_name;
                slot.sessionType = 'Novo Tópico';
                
                schedule.push(slot);
            }

            if (bestSubject === null) {
                break; // Interrompe o loop de slots se não houver mais tópicos
            }
        }

        return schedule;
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
                topicDescription: description,
                sessionType: 'Revisão Consolidada'
            });
        }
        return schedule;
    }

    static fillWithSimulados(schedule, allTopics, studyDays, planId) {
        const scheduledDates = new Set(schedule.map(s => s.date));
        const emptySlots = studyDays.filter(day => !scheduledDates.has(day.date.toISOString().split('T')[0]) && day.dayOfWeek !== 0); // Não preencher domingos

        if (emptySlots.length === 0 || allTopics.length === 0) return schedule;

        console.log(`[SCHEDULE_GEN] Preenchendo ${emptySlots.length} dias restantes com Prática Dirigida ponderada.`);

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

        console.log('[PRÁTICA_DIRIGIDA] Disciplinas e pesos para prática:', subjects.map(s => ({
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

            const description = `Prática dirigida de ${selectedSubject.name} com foco nos seguintes tópicos:\n` +
                              topicsForPractice.map(t => `- ${t}`).join('\n') +
                              `\n\nResolva questões, faça resumos e revise conceitos-chave.`;

            schedule.push({
                date: slot.date.toISOString().split('T')[0],
                topicId: null,
                subjectName: `Prática: ${selectedSubject.name}`,
                topicDescription: description,
                sessionType: 'Prática Dirigida'
            });
        }

        // Log estatísticas finais
        const practiceCount = {};
        schedule.forEach(session => {
            if (session.sessionType === 'Prática Dirigida') {
                const subjectName = session.subjectName.replace('Prática: ', '');
                practiceCount[subjectName] = (practiceCount[subjectName] || 0) + 1;
            }
        });

        console.log('[PRÁTICA_DIRIGIDA] Distribuição final de práticas:', practiceCount);

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