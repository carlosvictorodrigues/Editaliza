/**
 * Plan Service - Business logic for study plans
 * FASE 4 - SERVICES LAYER
 * 
 * This service contains all the complex business logic for plan management,
 * schedule calculations, progress tracking, and replanning algorithms.
 * Uses the new repository pattern for data access.
 */

class PlanService {
    constructor(repositories, db) {
        this.repos = repositories;
        this.db = db;
    }

    // CORREÇÃO: Função unificada para data brasileira
    getBrazilianDateString() {
        const now = new Date();
        const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
        const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
        const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ======================== PLAN MANAGEMENT ========================

    /**
     * Creates a new study plan with validation and initial setup
     */
    async createPlan(userId, planData) {
        // Validate plan data
        this.validatePlanData(planData);

        // Create plan with default values
        const planConfig = {
            user_id: userId,
            plan_name: planData.plan_name,
            exam_date: planData.exam_date,
            daily_study_hours: planData.daily_study_hours || 2,
            days_per_week: planData.days_per_week || 5,
            notification_time: planData.notification_time,
            daily_question_goal: planData.daily_question_goal || 20,
            weekly_question_goal: planData.weekly_question_goal || 100,
            has_essay: planData.has_essay || false,
            essay_frequency: planData.essay_frequency || 'weekly'
        };

        return this.repos.plan.createPlan(planConfig);
    }

    /**
     * Validates plan creation/update data
     */
    validatePlanData(data) {
        if (!data.plan_name || data.plan_name.trim().length < 3) {
            throw new Error('Nome do plano deve ter pelo menos 3 caracteres');
        }

        if (!data.exam_date) {
            throw new Error('Data da prova é obrigatória');
        }

        const examDate = new Date(data.exam_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (examDate <= today) {
            throw new Error('Data da prova deve ser futura');
        }

        if (data.daily_study_hours && (data.daily_study_hours < 0.5 || data.daily_study_hours > 12)) {
            throw new Error('Horas de estudo diário deve estar entre 0.5 e 12 horas');
        }

        if (data.days_per_week && (data.days_per_week < 1 || data.days_per_week > 7)) {
            throw new Error('Dias de estudo por semana deve estar entre 1 e 7');
        }
    }

    /**
     * Updates plan settings with validation
     */
    async updatePlanSettings(planId, userId, settings) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não pertence ao usuário');
        }

        // Validate settings
        if (settings.exam_date) {
            const examDate = new Date(settings.exam_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (examDate <= today) {
                throw new Error('Data da prova deve ser futura');
            }
        }

        return this.repos.plan.updatePlanSettings(planId, userId, settings);
    }

    /**
     * Deletes a plan and all related data
     */
    async deletePlan(planId, userId) {
        return this.repos.plan.deletePlanWithRelatedData(planId, userId);
    }

    // ======================== SCHEDULE GENERATION ========================

    /**
     * Generates optimized study schedule based on plan parameters
     */
    async generateSchedule(planId, userId, options = {}) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        const subjects = await this.repos.subject.findByPlanId(planId);
        if (!subjects || subjects.length === 0) {
            throw new Error('Adicione matérias ao plano antes de gerar o cronograma');
        }

        const topics = await this.repos.topic.findByPlanId(planId);
        if (!topics || topics.length === 0) {
            throw new Error('Adicione tópicos às matérias antes de gerar o cronograma');
        }

        // Calculate available study time
        const studyDays = this.calculateStudyDays(plan);
        const totalStudyHours = studyDays.length * plan.daily_study_hours;

        // Prioritize topics based on weight and importance
        const prioritizedTopics = this.prioritizeTopics(topics, subjects);

        // Generate schedule with algorithm
        const schedule = await this.createOptimizedSchedule(
            planId,
            prioritizedTopics,
            studyDays,
            plan,
            options
        );

        return {
            totalSessions: schedule.length,
            studyDays: studyDays.length,
            coverage: this.calculateCoverage(schedule, topics),
            schedule
        };
    }

    /**
     * Calculate available study days until exam
     */
    calculateStudyDays(plan) {
        const today = new Date();
        const examDate = new Date(plan.exam_date);
        const studyDays = [];
        
        // Map days of week (0 = Sunday, 6 = Saturday)
        const studyDaysOfWeek = this.getStudyDaysOfWeek(plan.days_per_week);
        
        let currentDate = new Date(today);
        currentDate.setDate(currentDate.getDate() + 1); // Start tomorrow
        
        while (currentDate < examDate) {
            if (studyDaysOfWeek.includes(currentDate.getDay())) {
                studyDays.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return studyDays;
    }

    /**
     * Get study days of week based on frequency
     */
    getStudyDaysOfWeek(daysPerWeek) {
        const dayMaps = {
            1: [1], // Monday only
            2: [1, 4], // Monday, Thursday
            3: [1, 3, 5], // Monday, Wednesday, Friday
            4: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
            5: [1, 2, 3, 4, 5], // Weekdays
            6: [1, 2, 3, 4, 5, 6], // All except Sunday
            7: [0, 1, 2, 3, 4, 5, 6] // All days
        };
        
        return dayMaps[daysPerWeek] || dayMaps[5];
    }

    /**
     * Prioritize topics based on subject weight and topic importance
     */
    prioritizeTopics(topics, subjects) {
        const subjectWeightMap = {};
        subjects.forEach(subject => {
            subjectWeightMap[subject.id] = subject.weight || 1;
        });

        return topics
            .map(topic => ({
                ...topic,
                calculatedPriority: (topic.difficulty || 1) * 
                                   (subjectWeightMap[topic.subject_id] || 1) * 
                                   (topic.question_count || 1)
            }))
            .sort((a, b) => b.calculatedPriority - a.calculatedPriority);
    }

    /**
     * Create optimized schedule with spaced repetition
     */
    async createOptimizedSchedule(planId, topics, studyDays, plan, options) {
        const schedule = [];
        const topicScheduleMap = {};
        let dayIndex = 0;
        
        // Phase 1: Initial learning (new topics)
        for (const topic of topics) {
            if (dayIndex >= studyDays.length * 0.7) break; // Reserve 30% for reviews
            
            const session = {
                study_plan_id: planId,
                topic_id: topic.id,
                subject_name: topic.subject_name,
                session_date: studyDays[dayIndex].toISOString().split('T')[0],
                session_type: 'Novo Tópico',
                status: 'pending',
                duration_minutes: this.calculateTopicDuration(topic, plan),
                priority: topic.calculatedPriority
            };
            
            schedule.push(session);
            topicScheduleMap[topic.id] = [dayIndex];
            
            dayIndex = (dayIndex + 1) % studyDays.length;
        }

        // Phase 2: Spaced repetition reviews
        const reviewPhases = [3, 7, 15, 30]; // Days after initial study
        
        for (const topic of topics.slice(0, schedule.length)) {
            const initialDayIndex = topicScheduleMap[topic.id][0];
            
            for (const reviewDelay of reviewPhases) {
                const reviewDayIndex = initialDayIndex + reviewDelay;
                if (reviewDayIndex < studyDays.length) {
                    const reviewSession = {
                        study_plan_id: planId,
                        topic_id: topic.id,
                        subject_name: topic.subject_name,
                        session_date: studyDays[reviewDayIndex].toISOString().split('T')[0],
                        session_type: `Revisão ${reviewDelay}d`,
                        status: 'pending',
                        duration_minutes: Math.max(15, Math.floor(this.calculateTopicDuration(topic, plan) * 0.6)),
                        priority: topic.calculatedPriority * 0.8
                    };
                    
                    schedule.push(reviewSession);
                }
            }
        }

        // Phase 3: Simulations and final reviews
        this.addSimulationSessions(schedule, planId, studyDays, plan);

        // Sort by date and priority
        schedule.sort((a, b) => {
            const dateCompare = new Date(a.session_date) - new Date(b.session_date);
            if (dateCompare === 0) {
                return b.priority - a.priority;
            }
            return dateCompare;
        });

        return schedule;
    }

    /**
     * Calculate study duration for a topic based on difficulty and content
     */
    calculateTopicDuration(topic, plan) {
        const baseMinutes = plan.daily_study_hours * 60;
        const difficultyMultiplier = {
            1: 0.7, // Easy
            2: 1.0, // Medium
            3: 1.3  // Hard
        };
        
        const questionMultiplier = Math.min(2, (topic.question_count || 10) / 10);
        const difficulty = topic.difficulty || 2;
        
        return Math.round(
            (baseMinutes / 4) * // Assume 4 topics per day
            difficultyMultiplier[difficulty] *
            questionMultiplier
        );
    }

    /**
     * Add simulation sessions to schedule
     */
    addSimulationSessions(schedule, planId, studyDays, plan) {
        const totalDays = studyDays.length;
        const simulationDays = [
            Math.floor(totalDays * 0.3),
            Math.floor(totalDays * 0.6),
            Math.floor(totalDays * 0.8),
            Math.floor(totalDays * 0.95)
        ];
        
        simulationDays.forEach((dayIndex, index) => {
            if (dayIndex < studyDays.length) {
                const simulationType = index < 2 ? 'Simulado Direcionado' : 'Simulado Completo';
                schedule.push({
                    study_plan_id: planId,
                    topic_id: null,
                    subject_name: 'Simulado',
                    session_date: studyDays[dayIndex].toISOString().split('T')[0],
                    session_type: simulationType,
                    status: 'pending',
                    duration_minutes: plan.daily_study_hours * 60,
                    priority: 100
                });
            }
        });
    }

    /**
     * Calculate schedule coverage percentage
     */
    calculateCoverage(schedule, topics) {
        const scheduledTopics = new Set(
            schedule
                .filter(s => s.topic_id && s.session_type === 'Novo Tópico')
                .map(s => s.topic_id)
        );
        
        return topics.length > 0 ? (scheduledTopics.size / topics.length) * 100 : 0;
    }

    // ======================== REPLANNING ALGORITHMS ========================

    /**
     * Replan schedule when user falls behind or conditions change
     */
    async replanSchedule(planId, userId, options = {}) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // Analyze current progress
        const currentProgress = await this.analyzeCurrentProgress(planId);
        
        // Determine replanning strategy
        const strategy = this.determineReplanStrategy(currentProgress, options);
        
        // Execute replanning
        return this.executeReplanning(planId, strategy, currentProgress);
    }

    /**
     * Analyze current progress and identify issues
     */
    async analyzeCurrentProgress(planId) {
        const sessions = await this.repos.session.findByPlanId(planId);
        const topics = await this.repos.topic.findByPlanId(planId);
        const today = this.getBrazilianDateString();
        
        const overdueSessions = sessions.filter(s => 
            s.status === 'pending' && s.session_date < today
        );
        
        const completedSessions = sessions.filter(s => s.status === 'completed');
        const completedTopics = new Set(
            completedSessions
                .filter(s => s.session_type === 'Novo Tópico' && s.topic_id)
                .map(s => s.topic_id)
        );
        
        return {
            totalSessions: sessions.length,
            completedSessions: completedSessions.length,
            overdueSessions: overdueSessions.length,
            completedTopics: completedTopics.size,
            totalTopics: topics.length,
            progressPercentage: topics.length > 0 ? 
                (completedTopics.size / topics.length) * 100 : 0,
            behindSchedule: overdueSessions.length > 0
        };
    }

    /**
     * Determine optimal replanning strategy
     */
    determineReplanStrategy(progress, options) {
        if (progress.overdueSessions > 10) {
            return 'aggressive_catch_up';
        } else if (progress.overdueSessions > 5) {
            return 'moderate_adjustment';
        } else if (options.priorityChange) {
            return 'priority_rebalance';
        } else {
            return 'minor_optimization';
        }
    }

    /**
     * Execute replanning based on strategy
     */
    async executeReplanning(planId, strategy, progress) {
        switch (strategy) {
            case 'aggressive_catch_up':
                return this.aggressiveCatchUpReplan(planId);
            case 'moderate_adjustment':
                return this.moderateAdjustmentReplan(planId);
            case 'priority_rebalance':
                return this.priorityRebalanceReplan(planId);
            default:
                return this.minorOptimizationReplan(planId);
        }
    }

    /**
     * Aggressive catch-up replanning for users far behind
     */
    async aggressiveCatchUpReplan(planId) {
        // Remove overdue sessions and reschedule with higher intensity
        const today = new Date();
        const sessions = await this.repos.session.findByPlanId(planId);
        const overdue = sessions.filter(s => 
            s.status === 'pending' && new Date(s.session_date) < today
        );
        
        // Delete overdue sessions
        for (const session of overdue) {
            await this.repos.session.delete(session.id);
        }
        
        // Reschedule with compressed timeline
        const plan = await this.repos.plan.findById(planId);
        const remainingTopics = await this.getRemainingTopics(planId);
        
        return this.createCompressedSchedule(planId, plan, remainingTopics);
    }

    /**
     * Get remaining topics that haven't been completed
     */
    async getRemainingTopics(planId) {
        const allTopics = await this.repos.topic.findByPlanId(planId);
        const completedSessions = await this.repos.session.findCompletedByPlanId(planId);
        const completedTopicIds = new Set(
            completedSessions
                .filter(s => s.session_type === 'Novo Tópico' && s.topic_id)
                .map(s => s.topic_id)
        );
        
        return allTopics.filter(topic => !completedTopicIds.has(topic.id));
    }

    // ======================== SCHEDULE PREVIEW ========================

    /**
     * Get schedule preview with simulation calculations
     */
    async getSchedulePreview(planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não pertence ao usuário');
        }

        // Get all study sessions for the plan
        const studySessions = await this.repos.session.findByPlanId(planId);
        
        // Get topic statistics - CORREÇÃO: usar sessões concluídas para cálculo preciso
        const allTopics = await this.repos.topic.findByPlanId(planId);
        const totalTopics = allTopics.length;
        
        // Contar tópicos realmente estudados através das sessões concluídas
        const completedTopicSessions = studySessions.filter(s => 
            s.session_type === 'Novo Tópico' && 
            s.status === 'completed' && 
            s.topic_id !== null
        );
        
        // Usar Set para evitar contar o mesmo tópico múltiplas vezes
        const uniqueCompletedTopics = new Set(completedTopicSessions.map(s => s.topic_id));
        const completedTopics = uniqueCompletedTopics.size;
        const pendingTopics = totalTopics - completedTopics;
        const currentProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

        // Calculate coverage (scheduled vs total) - CORREÇÃO: contar tópicos únicos agendados
        const scheduledTopicSessions = studySessions.filter(s => s.session_type === 'Novo Tópico' && s.topic_id !== null);
        const uniqueScheduledTopics = new Set(scheduledTopicSessions.map(s => s.topic_id));
        const scheduledTopics = uniqueScheduledTopics.size;
        const coveragePercentage = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
        const unscheduledTopics = totalTopics - scheduledTopics;

        // Calculate simulations - FIXED LOGIC
        const totalSimulations = studySessions.filter(s => s.session_type.includes('Simulado')).length;
        const targetedSimulations = studySessions.filter(s => s.session_type.includes('Direcionado')).length;
        const generalSimulations = studySessions.filter(s => s.session_type === 'Simulado Completo' || s.session_type.includes('geral')).length;

        // Calculate revisions
        const revisionSessions = studySessions.filter(s => s.session_type.includes('Revisão')).length;
        const studySessionsCount = studySessions.filter(s => s.session_type === 'Novo Tópico').length;

        // Determine current phase
        let currentPhase = 'Fase de Aprendizado: Estudando novos tópicos';
        if (completedTopics === totalTopics && totalTopics > 0) {
            currentPhase = 'Fase de Consolidação: Revisões e simulados';
        } else if (completedTopics > 0 && completedTopics < totalTopics) {
            currentPhase = `Fase Mista: ${Math.round((completedTopics/totalTopics)*100)}% aprendido, ${Math.round((pendingTopics/totalTopics)*100)}% restante`;
        }

        // Calculate revision cycles
        const revisionCycles = completedTopics > 0 ? Math.round(revisionSessions / completedTopics * 10) / 10 : 0;
        const revisionProgress = studySessionsCount > 0 ? Math.round((revisionSessions / (studySessionsCount * 3)) * 100) : 0;

        return {
            // Phase information
            phases: {
                current: currentPhase,
                explanation: coveragePercentage >= 85 
                    ? 'Cronograma otimizado: priorizou os tópicos mais relevantes para maximizar suas chances de aprovação'
                    : 'Cronograma em desenvolvimento: ainda organizando a melhor estratégia de estudos'
            },
            
            // Status messages
            status: {
                coverageText: `Cronograma cobre ${coveragePercentage}% do edital ${coveragePercentage >= 85 ? '(priorização dos tópicos mais importantes)' : ''}`,
                progressText: `Você já estudou ${completedTopics} tópicos (${currentProgress}% concluído)`,
                remainingText: scheduledTopics - completedTopics > 0 ? `Restam ${scheduledTopics - completedTopics} tópicos agendados para estudar (${100 - currentProgress}%)` : 'Parabéns! Você completou todos os tópicos agendados',
                unscheduledText: unscheduledTopics > 0 ? `${unscheduledTopics} tópicos não foram incluídos no cronograma (falta de tempo/priorização)` : ''
            },

            // Detailed metrics
            completedTopics,
            totalTopics,
            pendingTopics,
            currentProgress,
            remainingScheduled: 100 - currentProgress,
            totalSimulations,
            targetedSimulations,
            generalSimulations,
            
            // Revisions
            revisionCycles,
            totalRevisions: revisionSessions,
            totalStudySessions: studySessionsCount,
            
            // Additional data
            unscheduledTopics,
            coveragePercentage,
            revisionProgress
        };
    }

    /**
     * Get basic plan progress
     * CORREÇÃO: Usar método unificado para contagem de tópicos concluídos
     */
    async getProgress(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // CORREÇÃO: Usar contagem unificada via sessões concluídas (método confiável)
        const completedResult = await this.db.get(
            'SELECT COUNT(DISTINCT topic_id) as count FROM study_sessions WHERE study_plan_id = $1 AND session_type = $2 AND status = $3 AND topic_id IS NOT NULL',
            [planId, 'Novo Tópico', 'completed']
        );
        
        const topics = await this.repos.topic.findByPlanId(planId);
        const completed = completedResult.count || 0;
        const total = topics.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        // CORREÇÃO: Log para debug dos cálculos
        console.log(`📊 [PROGRESSO] Plano ${planId}: ${completed}/${total} tópicos (${percentage}%)`);

        return {
            completed,
            total,
            percentage,
            remaining: total - completed
        };
    }

    /**
     * Get detailed progress by subject
     */
    async getDetailedProgress(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        const subjectDetails = await this.repos.statistics.getSubjectProgressDetails(planId);
        const totalProgress = await this.repos.statistics.getTotalProgress(planId);

        return {
            totalProgress,
            subjectDetails
        };
    }

    /**
     * Get goal progress (daily/weekly)
     */
    async getGoalProgress(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // CORREÇÃO: Usar timezone brasileiro para cálculos de data
        const today = this.getBrazilianDateString();
        // CORREÇÃO: Calcular início da semana em timezone brasileiro
        const brazilDate = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
        const dayOfWeek = brazilDate.getDay();
        const weekStart = new Date(brazilDate);
        weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const dailyProgress = await this.repos.statistics.getDailyProgress(planId, today);
        const weeklyProgress = await this.repos.statistics.getWeeklyProgress(planId, weekStartStr);

        return {
            dailyGoal: plan.daily_question_goal || 0,
            dailyProgress: dailyProgress || 0,
            weeklyGoal: plan.weekly_question_goal || 0,
            weeklyProgress: weeklyProgress || 0
        };
    }

    /**
     * Get reality check analysis with real calculations
     */
    async getRealityCheck(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // Get all sessions and topics for analysis
        const sessions = await this.repos.session.findByPlanId(planId);
        const topics = await this.repos.topic.findByPlanId(planId);
        const totalTopics = topics.length;

        if (totalTopics === 0) {
            return { message: 'Adicione tópicos ao seu plano para ver as projeções.' };
        }

        const today = new Date(); 
        today.setHours(0, 0, 0, 0);
        
        // Tratar exam_date que pode vir como Date ou string
        let examDate;
        if (plan.exam_date instanceof Date) {
            examDate = new Date(plan.exam_date);
        } else if (typeof plan.exam_date === 'string') {
            // Se já tem timezone, use direto, senão adicione horário
            if (plan.exam_date.includes('T')) {
                examDate = new Date(plan.exam_date);
            } else {
                examDate = new Date(plan.exam_date + 'T23:59:59');
            }
        } else {
            examDate = new Date(plan.exam_date);
        }
        
        // Validar se a data é válida
        if (isNaN(examDate.getTime())) {
            console.error('Data da prova inválida:', plan.exam_date);
            examDate = new Date(); // Fallback para hoje
            examDate.setMonth(examDate.getMonth() + 3); // Adiciona 3 meses como padrão
        }
        
        // Calculate completed topics - CORREÇÃO: filtrar topic_id não nulos
        const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
        const completedTopics = new Set(
            newTopicSessions
                .filter(s => s.status === 'completed' && s.topic_id !== null)
                .map(r => r.topic_id)
        );
        const topicsCompletedCount = completedTopics.size;
        const topicsRemaining = totalTopics - topicsCompletedCount;

        // Check if in maintenance mode (all future sessions done)
        const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'pending');
        const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

        // Calculate study pace
        const completedNewTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico' && s.status === 'completed');
        const firstSessionDate = completedNewTopicSessions.length > 0 ? 
            new Date(Math.min(...completedNewTopicSessions.map(s => new Date(s.session_date)))) : today;

        // Calcular dias com validação
        let daysSinceStart = 1;
        if (firstSessionDate && !isNaN(firstSessionDate.getTime())) {
            daysSinceStart = Math.max(1, Math.ceil((today - firstSessionDate) / (1000 * 60 * 60 * 24)));
        }
        
        let daysRemainingForExam = 1;
        if (examDate && !isNaN(examDate.getTime())) {
            const diffTime = examDate - today;
            daysRemainingForExam = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }
        
        // Calcular ritmos com validação
        const currentPace = daysSinceStart > 0 ? (topicsCompletedCount / daysSinceStart) : 0;
        const requiredPace = daysRemainingForExam > 0 ? (topicsRemaining / daysRemainingForExam) : 0;

        let status, primaryMessage, secondaryMessage, motivationalMessage;

    if (isMaintenanceMode) {
        status = 'completed';
        primaryMessage = `Parabéns! Você concluiu <strong>100%</strong> do edital.`;
        secondaryMessage = `Seu cronograma entrou no Modo de Manutenção Avançada, com foco em revisões e simulados.`;
        motivationalMessage = `Agora é a hora de aprimorar. Mantenha a consistência até a aprovação!`;
    } else {
        let projectedCompletionPercentage = 0;
        if (totalTopics > 0) {
            if (currentPace > 0) {
                const projectedTopicsToComplete = currentPace * daysRemainingForExam;
                const totalProjectedCompleted = topicsCompletedCount + projectedTopicsToComplete;
                projectedCompletionPercentage = Math.min(100, (totalProjectedCompleted / totalTopics) * 100);
            } else if (topicsCompletedCount > 0) {
                projectedCompletionPercentage = (topicsCompletedCount / totalTopics) * 100;
            }
        }

        if (currentPace >= requiredPace) {
            status = 'on-track';
            primaryMessage = `Mantendo o ritmo, sua projeção é de concluir <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital.`;
            secondaryMessage = `Excelente trabalho! Seu ritmo atual é suficiente para cobrir todo o conteúdo necessário a tempo.`;
            motivationalMessage = `A consistência está trazendo resultados. Continue assim!`;
        } else {
            status = 'off-track';
            primaryMessage = `Nesse ritmo, você completará apenas <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital até a prova.`;
            secondaryMessage = `Para concluir 100%, seu ritmo precisa aumentar para <strong>${requiredPace.toFixed(1)} tópicos/dia</strong>.`;
            motivationalMessage = `Não desanime! Pequenos ajustes na rotina podem fazer uma grande diferença.`;
        }
    }

    return {
        requiredPace: isFinite(requiredPace) && requiredPace > 0 ? requiredPace.toFixed(1) : '0',
        requiredPaceFormatted: isFinite(requiredPace) && requiredPace > 0 ? `${requiredPace.toFixed(1)} tópicos/dia` : 'N/A',
        postponementCount: plan.postponement_count || 0,
        status,
        primaryMessage,
        secondaryMessage,
        motivationalMessage,
        isMaintenanceMode,
        // Additional data for the frontend
        completedTopics: topicsCompletedCount,
        totalTopics,
        daysRemaining: daysRemainingForExam,
        daysRemainingForExam: daysRemainingForExam, // Adicionar campo explícito
        currentPace: isFinite(currentPace) ? currentPace.toFixed(1) : '0',
        averageDailyProgress: isFinite(currentPace) ? currentPace : 0
    };
};

    /**
     * Get gamification data with complete level system
     */
    async getGamification(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // Get completed topics count
        const completedTopicsResult = await this.db.get(
            'SELECT COUNT(DISTINCT topic_id) as count FROM study_sessions WHERE study_plan_id = $1 AND session_type = $2 AND status = $3 AND topic_id IS NOT NULL',
            [planId, 'Novo Tópico', 'completed']
        );
        const completedTopicsCount = completedTopicsResult.count || 0;

        // Sistema de ranks com humor concurseiro
        const levels = [
        { 
            threshold: 0, 
            title: 'Pagador de Inscrição 💸', 
            subtitle: 'Nível 1',
            description: 'Primeira vez que paga pra sofrer? Bem-vindo ao clube!',
            color: '#8B8B8B', // Cinza apagado
            bgColor: '#F5F5F5', // Bege
            icon: '💸',
            motivationalText: 'A jornada dos mil editais começa com o primeiro boleto!'
        },
        { 
            threshold: 11, 
            title: 'Sobrevivente do Primeiro PDF 📄', 
            subtitle: 'Nível 2',
            description: 'Abriu o edital e não desmaiou! Você é corajoso(a)!',
            color: '#A0A0A0', // Cinza mais vivo
            bgColor: '#FAFAFA',
            icon: '📄',
            motivationalText: '700 páginas? É só o aquecimento!'
        },
        { 
            threshold: 31, 
            title: 'Caçador de Questões 🎯', 
            subtitle: 'Nível 3',
            description: 'Já sabe diferenciar CESPE de FCC no escuro!',
            color: '#4A90E2', // Azul médio
            bgColor: '#E8F4FD',
            icon: '🎯',
            motivationalText: 'Questões anuladas são suas melhores amigas agora!'
        },
        { 
            threshold: 61, 
            title: 'Estrategista de Chute 🎲', 
            subtitle: 'Nível 4',
            description: 'Desenvolveu técnicas avançadas de eliminação!',
            color: '#6B46C1', // Roxo vibrante
            bgColor: '#F3E8FF',
            icon: '🎲',
            motivationalText: 'Entre A e C, sempre vai na B... ou não!'
        },
        { 
            threshold: 101, 
            title: 'Fiscal de Gabarito 🔍', 
            subtitle: 'Nível 5',
            description: 'Já decorou jurisprudência suficiente pra abrir um escritório!',
            color: '#10B981', // Verde vibrante
            bgColor: '#D1FAE5',
            icon: '🔍',
            motivationalText: 'Súmula vinculante é seu segundo nome!'
        },
        { 
            threshold: 201, 
            title: 'Sensei dos Simulados 🥋', 
            subtitle: 'Nível 6',
            description: 'Faz prova de olhos fechados e ainda gabarita metade!',
            color: '#F59E0B', // Laranja vibrante
            bgColor: '#FEF3C7',
            icon: '🥋',
            motivationalText: 'Simulado no domingo de manhã? Rotina!'
        },
        { 
            threshold: 501, 
            title: 'Quase Servidor(a) 🎓', 
            subtitle: 'Nível 7',
            description: 'Tá quase lá! Já pode sentir o cheiro da estabilidade!',
            color: '#DC2626', // Vermelho vibrante
            bgColor: '#FEE2E2',
            icon: '🎓',
            motivationalText: 'A posse está logo ali... ou no próximo concurso!'
        },
        { 
            threshold: 1000, 
            title: 'Lenda Viva dos Concursos 👑', 
            subtitle: 'Nível 8',
            description: 'Você é a pessoa que todos pedem dicas no grupo do WhatsApp!',
            color: '#FFD700', // Ouro brilhante
            bgColor: '#FFF9C4',
            icon: '👑',
            motivationalText: 'Editais tremem quando você abre o navegador!'
        }
        ];

        // Calculate current and next level
        let currentLevel = levels[0];
        let nextLevel = null;
        for (let i = levels.length - 1; i >= 0; i--) {
            if (completedTopicsCount >= levels[i].threshold) {
                currentLevel = levels[i];
                if (i < levels.length - 1) {
                    nextLevel = levels[i + 1];
                }
                break;
            }
        }
        
        const topicsToNextLevel = nextLevel ? nextLevel.threshold - completedTopicsCount : 0;

        // Get real gamification stats
        const completedSessions = await this.repos.session.findCompletedByPlanId(planId);
        const uniqueStudyDays = this.calculateUniqueStudyDays(completedSessions);
        const currentStreak = this.calculateStudyStreak(completedSessions);
    
    // Calculate achievements based on real data with proper structure
    const achievements = [];
    const now = new Date();
    
    // Helper function to create achievement objects with safe date handling
    const createAchievement = (title, description, earnedDate = now) => {
        // Ensure we have a valid date
        let safeDate = now;
        if (earnedDate) {
            if (earnedDate instanceof Date && !isNaN(earnedDate.getTime())) {
                safeDate = earnedDate;
            } else if (typeof earnedDate === 'string') {
                const parsed = new Date(earnedDate);
                if (!isNaN(parsed.getTime())) {
                    safeDate = parsed;
                }
            }
        }
        
        return {
            title,
            description,
            achieved_date: safeDate.toISOString(),
            earned_at: safeDate.toISOString() // Extra compatibility
        };
    };
    
    // Conquistas com humor concurseiro
    if (completedTopicsCount >= 1) {
        // Safely get the date from the first completed session
        let achievementDate = now;
        if (completedSessions.length > 0) {
            const firstSession = completedSessions[0];
            const sessionDate = firstSession.session_date;
            if (sessionDate) {
                const parsedDate = new Date(sessionDate);
                if (!isNaN(parsedDate.getTime())) {
                    achievementDate = parsedDate;
                }
            }
        }
        
        achievements.push(createAchievement(
            'Primeira Lapada no Edital 📖', 
            'Abriu o PDF e não chorou (muito)! Guerreiro(a)!',
            achievementDate
        ));
    }
    if (completedTopicsCount >= 5) {
        achievements.push(createAchievement(
            'Maratonista do PDF 🏃', 
            '5 tópicos estudados e ainda tem café na xícara!'
        ));
    }
    if (completedTopicsCount >= 10) {
        achievements.push(createAchievement(
            'Concurseiro(a) Raiz 🌳', 
            '10 tópicos! Já tá decorando lei enquanto dorme!'
        ));
    }
    if (completedTopicsCount >= 25) {
        achievements.push(createAchievement(
            'Doutor(a) Google de Legislação 🔎', 
            '25 tópicos! Seus amigos já te procuram pra tirar dúvidas!'
        ));
    }
    if (completedTopicsCount >= 50) {
        achievements.push(createAchievement(
            'Guru dos Grifos 🖍️', 
            '50 tópicos! Seu marca-texto já pediu aposentadoria!'
        ));
    }
    if (completedTopicsCount >= 100) {
        achievements.push(createAchievement(
            'Mestre Jedi dos Concursos ⚔️', 
            '100 tópicos! A Força (de vontade) é forte em você!'
        ));
    }
    if (completedTopicsCount >= 200) {
        achievements.push(createAchievement(
            'Chuck Norris dos Editais 💪', 
            '200 tópicos! Os editais têm medo de você agora!'
        ));
    }
    
    // Conquistas de sequência com humor
    if (currentStreak >= 3) {
        achievements.push(createAchievement(
            'Resistente ao Netflix 📺', 
            '3 dias seguidos! Resistiu à tentação da série nova!'
        ));
    }
    if (currentStreak >= 7) {
        achievements.push(createAchievement(
            'Imune ao Sofá 🛋️', 
            '7 dias! O sofá já esqueceu sua forma!'
        ));
    }
    if (currentStreak >= 14) {
        achievements.push(createAchievement(
            'Inimigo do Descanso 😤', 
            '14 dias! Seus amigos acham que você sumiu!'
        ));
    }
    if (currentStreak >= 30) {
        achievements.push(createAchievement(
            'Máquina de Aprovar 🤖', 
            '30 dias seguidos! Você é movido a café e determinação!'
        ));
    }
    if (currentStreak >= 60) {
        achievements.push(createAchievement(
            'Cyborg Concurseiro 🦾', 
            '60 dias! Você transcendeu a necessidade de vida social!'
        ));
    }
    
    // Conquistas de sessões com humor
    if (completedSessions.length >= 20) {
        achievements.push(createAchievement(
            'Viciado(a) em Questões 💊', 
            '20 sessões! Questões são sua nova droga (a legal)!'
        ));
    }
    if (completedSessions.length >= 50) {
        achievements.push(createAchievement(
            'Bibliotecário(a) Honorário(a) 📚', 
            '50 sessões! A biblioteca já reserva sua cadeira!'
        ));
    }
    if (completedSessions.length >= 100) {
        achievements.push(createAchievement(
            'Rei/Rainha do Resumo 👑', 
            '100 sessões! Você resume até bula de remédio!'
        ));
    }
    if (completedSessions.length >= 200) {
        achievements.push(createAchievement(
            'PhD em Perseverança 🎓', 
            '200 sessões! Universidades querem estudar seu cérebro!'
        ));
    }
    
    // Conquistas especiais baseadas em padrões
    const studyHours = completedSessions.filter(s => {
        const hour = new Date(s.session_date).getHours();
        return hour >= 5 && hour <= 7;
    }).length;
    
    if (studyHours >= 10) {
        achievements.push(createAchievement(
            'Madrugador(a) Insano(a) 🌅', 
            '10+ sessões antes das 7h! O galo aprendeu com você!'
        ));
    }
    
    const weekendSessions = completedSessions.filter(s => {
        const day = new Date(s.session_date).getDay();
        return day === 0 || day === 6;
    }).length;
    
    if (weekendSessions >= 20) {
        achievements.push(createAchievement(
            'Destruidor(a) de Finais de Semana 🎉', 
            '20+ sessões no fim de semana! Churrasco? Não conheço!'
        ));
    }
    
    const experiencePoints = completedTopicsCount * 10 + uniqueStudyDays * 5; // XP system
    
    // CORREÇÃO: Calcular tempo total sem duplicação
    // Para cada sessão, usar APENAS o maior valor entre:
    // 1. time_studied_seconds da sessão
    // 2. O último/maior time log da sessão
    const totalTimeResult = await this.db.get(`
        SELECT COALESCE(SUM(session_time), 0) as total_time
        FROM (
            SELECT 
                ss.id,
                CASE 
                    WHEN MAX(stl.duration_seconds) > ss.time_studied_seconds 
                    THEN MAX(stl.duration_seconds)
                    ELSE COALESCE(ss.time_studied_seconds, 0)
                END as session_time
            FROM study_sessions ss
            LEFT JOIN study_time_logs stl ON stl.session_id = ss.id
            WHERE ss.study_plan_id = $1 
                AND (ss.status = 'completed' OR ss.time_studied_seconds > 0)
            GROUP BY ss.id, ss.time_studied_seconds
        ) AS session_times
    `, [planId]);
    
    const totalStudyTime = totalTimeResult?.total_time || 0;
    console.log(`📊 Tempo total de estudo para plano ${planId}: ${totalStudyTime} segundos`);
    
    // Implementar logging inteligente - só logar se dados mudaram significativamente
    const gamificationKey = `${planId}_gamification`;
    const currentData = { completedTopicsCount, currentLevel: currentLevel.title, nextLevel: nextLevel ? nextLevel.title : null, topicsToNextLevel };
    
    // Cache para controlar logs repetitivos (simples armazenamento em memória)
    if (!global.gamificationLogCache) {
        global.gamificationLogCache = new Map();
    }
    
    const previousData = global.gamificationLogCache.get(gamificationKey);
    const hasSignificantChange = !previousData || 
        previousData.completedTopicsCount !== completedTopicsCount ||
        previousData.currentLevel !== currentLevel.title ||
        previousData.nextLevel !== (nextLevel ? nextLevel.title : null);
    
    if (hasSignificantChange) {
        console.log('🎮 Gamification Update:', {
            completedTopicsCount: `${previousData?.completedTopicsCount || 0} → ${completedTopicsCount}`,
            currentLevel: currentLevel.title,
            ...(nextLevel && { nextLevel: nextLevel.title, topicsToNextLevel })
        });
        global.gamificationLogCache.set(gamificationKey, currentData);
    }
    
    return {
        // Dados principais de gamificação
        studyStreak: currentStreak,
        totalStudyDays: uniqueStudyDays,
        totalStudyTime: totalStudyTime, // TEMPO TOTAL AGREGADO DE AMBAS AS TABELAS
        experiencePoints: experiencePoints,
        concurseiroLevel: currentLevel.title,
        nextLevel: nextLevel ? nextLevel.title : null,
        topicsToNextLevel: topicsToNextLevel,
        achievements: achievements,
        completedTopicsCount: completedTopicsCount,
        totalCompletedSessions: completedSessions.length,
        
        // Enhanced ranking system data
        currentRank: currentLevel,
        nextRank: nextLevel,
        rankProgress: nextLevel ? 
            Math.min(100, ((completedTopicsCount - currentLevel.threshold) / (nextLevel.threshold - currentLevel.threshold)) * 100) : 100,
        
        // Compatibilidade com versões anteriores
        currentStreak: currentStreak,
        totalXP: experiencePoints,
        level: Math.ceil(uniqueStudyDays / 7) || 1,
        levelName: currentLevel.title,
        achievementsCount: achievements.length
    };
};

    /**
     * Calculate unique study days from sessions
     */
    calculateUniqueStudyDays(sessions) {
        if (!sessions || sessions.length === 0) return 0;
        
        const uniqueDates = new Set();
        sessions.forEach(session => {
            if (session.status === 'completed' && session.session_date) {
                // Extract only date (YYYY-MM-DD) from session_date
                // Skip sessions without date
                if (!session.session_date) {
                    return;
                }
                
                let dateStr;
                if (session.session_date instanceof Date) {
                    dateStr = session.session_date.toISOString().split('T')[0];
                } else if (typeof session.session_date === 'string') {
                    dateStr = session.session_date.split('T')[0];
                } else {
                    // Fallback for unexpected types
                    try {
                        dateStr = String(session.session_date).split('T')[0];
                    } catch (e) {
                        console.error('Error parsing session_date:', session.session_date, e);
                        return;
                    }
                }
                uniqueDates.add(dateStr);
            }
        });
        
        return uniqueDates.size;
    }

    /**
     * Calculate current study streak
     */
    calculateStudyStreak(sessions) {
        if (!sessions || sessions.length === 0) return 0;
        
        // Get completed sessions sorted by date (most recent first)
        const completedSessions = sessions
            .filter(s => s.status === 'completed' && s.session_date)
            .sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
            
        if (completedSessions.length === 0) return 0;
        
        // Get unique dates
        const uniqueDates = [...new Set(completedSessions
            .filter(s => s.session_date) // Filter out sessions without date
            .map(s => {
                // Handle Date objects and strings
                if (s.session_date instanceof Date) {
                    return s.session_date.toISOString().split('T')[0];
                } else if (typeof s.session_date === 'string') {
                    return s.session_date.split('T')[0];
                } else {
                    try {
                        return String(s.session_date).split('T')[0];
                    } catch (e) {
                        console.error('Error parsing session_date in gamification:', s.session_date, e);
                        return null;
                    }
                }
            })
            .filter(date => date !== null))];
        uniqueDates.sort((a, b) => new Date(b) - new Date(a)); // Most recent first
        
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < uniqueDates.length; i++) {
            const studyDate = new Date(uniqueDates[i]);
            studyDate.setHours(0, 0, 0, 0);
            
            const daysDiff = Math.floor((today - studyDate) / (1000 * 60 * 60 * 24));
            
            if (i === 0) {
                // First date: must be today or yesterday
                if (daysDiff <= 1) {
                    streak = 1;
                } else {
                    break; // Streak is broken
                }
            } else {
                // Subsequent dates: must be consecutive
                const prevDate = new Date(uniqueDates[i - 1]);
                const daysDiffFromPrev = Math.floor((prevDate - studyDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiffFromPrev === 1) {
                    streak++;
                } else {
                    break; // Streak is broken
                }
            }
        }
        
        return streak;
    }



    /**
     * Get completed sessions
     */
    async getCompletedSessions(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.repos.session.findCompletedByPlanId(planId);
    }

    /**
     * Get user stats
     */
    async getUserStats(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // Get comprehensive user statistics
        const topics = await this.repos.topic.findByPlanId(planId);
        const completedTopics = topics.filter(t => t.status === 'completed').length;
        const totalTopics = topics.length;
        
        return {
            totalXP: completedTopics * 100,
            completedTopics,
            totalTopics,
            achievements: [], // Placeholder for achievements system
            progressPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
        };
    }

    /**
     * Get question radar (weak points)
     */
    async getQuestionRadar(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.repos.statistics.getWeakTopics(planId);
    }

    /**
     * Get overdue check
     */
    async getOverdueCheck(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.repos.session.getOverdueSessions(planId);
    }

    /**
     * Get activity summary for a specific date
     */
    async getActivitySummary(planId, userId, date) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.repos.statistics.getActivitySummaryByDate(planId, date || new Date().toISOString().split('T')[0]);
    }

    /**
     * Get plan subjects
     */
    async getSubjects(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.repos.subject.findByPlanId(planId);
    }

    /**
     * Get performance metrics
     */
    async getPerformance(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        // Calcular dias restantes para a prova
        const today = new Date();
        let examDate;
        if (plan.exam_date instanceof Date) {
            examDate = plan.exam_date;
        } else {
            examDate = new Date(plan.exam_date + 'T00:00:00');
        }
        
        const daysRemaining = Math.max(0, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
        
        // Buscar progresso
        const progressData = await this.getProgress(planId, userId);
        const topicsRemaining = progressData.remaining;
        
        // Calcular ritmo necessário
        const requiredPace = daysRemaining > 0 ? (topicsRemaining / daysRemaining).toFixed(1) : 'N/A';
        
        // Buscar estatísticas de estudo
        const studyStats = await this.db.get(`
            SELECT 
                COUNT(DISTINCT DATE(session_date)) as study_days,
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
                AVG(CASE WHEN status = 'completed' THEN time_studied_seconds END) as avg_study_time
            FROM study_sessions
            WHERE study_plan_id = $1
        `, [planId]);
        
        // Calcular velocidade média (tópicos por dia)
        const avgPace = studyStats.study_days > 0 ? 
            (progressData.completed / studyStats.study_days).toFixed(1) : 0;
        
        return {
            daysRemaining,
            topicsRemaining,
            requiredPace,
            currentPace: avgPace,
            totalStudyDays: studyStats.study_days || 0,
            completedSessions: studyStats.completed_sessions || 0,
            averageStudyTime: Math.round(studyStats.avg_study_time || 0),
            onTrack: parseFloat(avgPace) >= parseFloat(requiredPace)
        };
    }

    // ======================== MISSING METHODS FROM REQUIREMENTS ========================

    /**
     * Check for overdue sessions
     */
    async checkOverdue(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        const today = this.getBrazilianDateString();
        const overdueSessions = await this.repos.session.getOverdueSessions(planId, today);
        
        return {
            count: overdueSessions.length,
            sessions: overdueSessions,
            needsReplanning: overdueSessions.length > 5
        };
    }

    /**
     * Calculate study plan progress with detailed metrics
     */
    async calculateProgress(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        const basicProgress = await this.getProgress(planId, userId);
        const detailedProgress = await this.getDetailedProgress(planId, userId);
        const goalProgress = await this.getGoalProgress(planId, userId);
        const realityCheck = await this.getRealityCheck(planId, userId);
        
        return {
            ...basicProgress,
            detailed: detailedProgress,
            goals: goalProgress,
            projections: realityCheck,
            lastUpdated: new Date()
        };
    }

    /**
     * Get gamification data with complete level system and achievements
     */
    async getGamificationData(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        return await this.getGamification(planId, userId);
    }
};

module.exports = PlanService;