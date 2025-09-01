/**
 * Session Service - Business logic for study sessions
 * FASE 4 - SERVICES LAYER
 * 
 * This service handles all business logic related to study sessions:
 * - Session scheduling and management
 * - Completion tracking and validation
 * - Reinforcement and postponement logic
 * - Statistics calculation
 * - Streak management and analytics
 */

class SessionService {
    constructor(repositories, db) {
        this.repos = repositories;
        this.db = db;
    }

    // ======================== SESSION MANAGEMENT ========================

    /**
     * Create a new study session with validation
     */
    async createSession(planId, userId, sessionData) {
        // Validate plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Validate session data
        this.validateSessionData(sessionData);

        // Check for scheduling conflicts
        await this.checkSchedulingConflicts(planId, sessionData.session_date);

        // Create session with defaults
        const session = {
            study_plan_id: planId,
            topic_id: sessionData.topic_id || null,
            subject_name: sessionData.subject_name,
            session_date: sessionData.session_date,
            session_type: sessionData.session_type,
            status: 'pending',
            duration_minutes: sessionData.duration_minutes || 60,
            priority: sessionData.priority || 0
        };

        return this.repos.session.createSession(session);
    }

    /**
     * Validate session data
     */
    validateSessionData(data) {
        if (!data.session_date) {
            throw new Error('Data da sessão é obrigatória');
        }

        if (!data.session_type) {
            throw new Error('Tipo da sessão é obrigatório');
        }

        const validTypes = [
            'Novo Tópico', 'Revisão 3d', 'Revisão 7d', 'Revisão 15d', 'Revisão 30d',
            'Simulado Direcionado', 'Simulado Completo', 'Redação'
        ];

        if (!validTypes.includes(data.session_type)) {
            throw new Error('Tipo de sessão inválido');
        }

        if (data.duration_minutes && (data.duration_minutes < 5 || data.duration_minutes > 480)) {
            throw new Error('Duração deve estar entre 5 minutos e 8 horas');
        }

        // Validate session date is not in the past
        const sessionDate = new Date(data.session_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (sessionDate < today) {
            throw new Error('Não é possível agendar sessões para datas passadas');
        }
    }

    /**
     * Check for scheduling conflicts
     */
    async checkSchedulingConflicts(planId, sessionDate) {
        const existingSessions = await this.repos.session.findByPlanIdAndDate(planId, sessionDate);
        
        if (existingSessions && existingSessions.length >= 6) { // Max 6 sessions per day
            throw new Error('Limite de sessões por dia atingido (máximo 6)');
        }
    }

    /**
     * Update session with validation
     */
    async updateSession(sessionId, planId, userId, updates) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Get current session
        const session = await this.repos.session.findByIdAndPlanId(sessionId, planId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }

        // Validate updates
        if (updates.session_date) {
            const sessionDate = new Date(updates.session_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (sessionDate < today) {
                throw new Error('Não é possível reagendar para datas passadas');
            }
        }

        return this.repos.session.updateSession(sessionId, planId, updates);
    }

    /**
     * Delete a session with validation
     */
    async deleteSession(sessionId, planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Check if session can be deleted
        const session = await this.repos.session.findByIdAndPlanId(sessionId, planId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }

        if (session.status === 'completed') {
            throw new Error('Não é possível excluir sessões já concluídas');
        }

        return this.repos.session.delete(sessionId, planId);
    }

    // ======================== SESSION COMPLETION ========================

    /**
     * Complete a study session with comprehensive tracking
     */
    async completeSession(sessionId, planId, userId, completionData) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Get session details
        const session = await this.repos.session.findByIdAndPlanId(sessionId, planId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }

        if (session.status === 'completed') {
            throw new Error('Sessão já foi concluída');
        }

        // Validate completion data
        this.validateCompletionData(completionData);

        // Mark session as completed
        const updateData = {
            status: 'completed',
            time_studied_seconds: completionData.timeStudied,
            questions_solved: completionData.questionsSolved || 0,
            notes: completionData.notes || '',
            difficulty_rating: completionData.difficultyRating,
            confidence_rating: completionData.confidenceRating,
            completed_at: new Date()
        };

        await this.repos.session.markAsCompleted(sessionId, planId, updateData);

        // Schedule reinforcement sessions if this is a new topic
        if (session.session_type === 'Novo Tópico' && session.topic_id) {
            await this.scheduleReinforcementSessions(planId, session, completionData);
        }

        // Update topic status if applicable
        if (session.topic_id) {
            await this.updateTopicProgress(session.topic_id, completionData);
        }

        // Log study time
        await this.logStudyTime(sessionId, completionData.timeStudied);

        return {
            sessionCompleted: true,
            reinforcementScheduled: session.session_type === 'Novo Tópico',
            nextSession: await this.getNextScheduledSession(planId)
        };
    }

    /**
     * Validate completion data
     */
    validateCompletionData(data) {
        if (!data.timeStudied || data.timeStudied < 60) { // Minimum 1 minute
            throw new Error('Tempo de estudo deve ser pelo menos 1 minuto');
        }

        if (data.timeStudied > 8 * 60 * 60) { // Maximum 8 hours
            throw new Error('Tempo de estudo não pode exceder 8 horas');
        }

        if (data.questionsSolved && data.questionsSolved < 0) {
            throw new Error('Número de questões não pode ser negativo');
        }

        if (data.difficultyRating && (data.difficultyRating < 1 || data.difficultyRating > 5)) {
            throw new Error('Avaliação de dificuldade deve ser entre 1 e 5');
        }

        if (data.confidenceRating && (data.confidenceRating < 1 || data.confidenceRating > 5)) {
            throw new Error('Avaliação de confiança deve ser entre 1 e 5');
        }
    }

    /**
     * Schedule reinforcement sessions based on spaced repetition
     */
    async scheduleReinforcementSessions(planId, originalSession, completionData) {
        const intervals = this.calculateReinforcementIntervals(completionData);
        const plan = await this.repos.plan.findById(planId);
        
        for (const interval of intervals) {
            const reviewDate = new Date(originalSession.session_date);
            reviewDate.setDate(reviewDate.getDate() + interval.days);

            // Don't schedule beyond exam date
            if (plan.exam_date && reviewDate > new Date(plan.exam_date)) {
                break;
            }

            const reviewSession = {
                study_plan_id: planId,
                topic_id: originalSession.topic_id,
                subject_name: originalSession.subject_name,
                session_date: reviewDate.toISOString().split('T')[0],
                session_type: `Revisão ${interval.days}d`,
                status: 'pending',
                duration_minutes: Math.max(15, Math.floor(originalSession.duration_minutes * interval.durationFactor)),
                priority: originalSession.priority * 0.8
            };

            await this.repos.session.createSession(reviewSession);
        }
    }

    /**
     * Calculate reinforcement intervals based on performance
     */
    calculateReinforcementIntervals(completionData) {
        const baseIntervals = [
            { days: 1, durationFactor: 0.5 },
            { days: 3, durationFactor: 0.4 },
            { days: 7, durationFactor: 0.4 },
            { days: 15, durationFactor: 0.3 },
            { days: 30, durationFactor: 0.3 }
        ];

        // Adjust intervals based on performance
        const performanceScore = this.calculatePerformanceScore(completionData);
        
        if (performanceScore < 0.6) {
            // Poor performance - more frequent reviews
            return [
                { days: 1, durationFactor: 0.7 },
                { days: 2, durationFactor: 0.6 },
                { days: 5, durationFactor: 0.5 },
                { days: 10, durationFactor: 0.4 },
                { days: 20, durationFactor: 0.4 }
            ];
        } else if (performanceScore > 0.85) {
            // Excellent performance - less frequent reviews
            return [
                { days: 3, durationFactor: 0.3 },
                { days: 7, durationFactor: 0.3 },
                { days: 21, durationFactor: 0.2 },
                { days: 45, durationFactor: 0.2 }
            ];
        }

        return baseIntervals;
    }

    /**
     * Calculate performance score from completion data
     */
    calculatePerformanceScore(data) {
        let score = 0.5; // Base score

        // Factor in confidence rating (0.4 weight)
        if (data.confidenceRating) {
            score += (data.confidenceRating - 3) * 0.1;
        }

        // Factor in difficulty vs time ratio (0.3 weight)
        if (data.difficultyRating && data.timeStudied) {
            const expectedTime = data.difficultyRating * 20 * 60; // 20 min per difficulty point
            const timeRatio = Math.min(2, expectedTime / data.timeStudied);
            score += (timeRatio - 1) * 0.15;
        }

        // Factor in questions accuracy if available (0.3 weight)
        if (data.questionsCorrect && data.questionsSolved) {
            const accuracy = data.questionsCorrect / data.questionsSolved;
            score += (accuracy - 0.7) * 0.3;
        }

        return Math.max(0, Math.min(1, score));
    }

    // ======================== SESSION POSTPONEMENT ========================

    /**
     * Postpone a session with intelligent rescheduling
     */
    async postponeSession(sessionId, planId, userId, reason, targetDate = null) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Get session details
        const session = await this.repos.session.findByIdAndPlanId(sessionId, planId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }

        if (session.status === 'completed') {
            throw new Error('Não é possível adiar sessões já concluídas');
        }

        // Calculate new date
        const newDate = await this.calculatePostponementDate(planId, session, targetDate);

        // Update session
        const updates = {
            session_date: newDate,
            postponement_count: (session.postponement_count || 0) + 1,
            postponement_reason: reason,
            priority: session.priority + 10 // Increase priority for postponed sessions
        };

        await this.repos.session.updateSession(sessionId, planId, updates);

        // Update plan postponement count
        await this.updatePlanPostponementCount(planId);

        // Analyze postponement pattern and suggest adjustments
        const postponementAnalysis = await this.analyzePostponementPattern(planId, userId);

        return {
            newDate,
            postponementCount: updates.postponement_count,
            analysis: postponementAnalysis
        };
    }

    /**
     * Calculate optimal postponement date
     */
    async calculatePostponementDate(planId, session, targetDate) {
        const plan = await this.repos.plan.findById(planId);
        let newDate;

        if (targetDate) {
            newDate = new Date(targetDate);
        } else {
            // Auto-calculate next available date
            newDate = new Date(session.session_date);
            newDate.setDate(newDate.getDate() + 1);
        }

        // Ensure not beyond exam date
        if (plan.exam_date && newDate > new Date(plan.exam_date)) {
            throw new Error('Não é possível reagendar além da data da prova');
        }

        // Find next available slot
        const studyDaysOfWeek = this.getStudyDaysOfWeek(plan.days_per_week);
        
        while (!studyDaysOfWeek.includes(newDate.getDay())) {
            newDate.setDate(newDate.getDate() + 1);
        }

        return newDate.toISOString().split('T')[0];
    }

    /**
     * Get study days of week based on plan configuration
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

    // ======================== SESSION ANALYTICS ========================

    /**
     * Get comprehensive session statistics
     */
    async getSessionStatistics(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        return this.repos.statistics.getSessionStatistics(planId);
    }

    /**
     * Calculate and return study streak information
     */
    async getStudyStreak(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        const sessions = await this.repos.session.findCompletedByPlanId(planId);
        return this.calculateStudyStreakFromSessions(sessions);
    }

    /**
     * Calculate study streak from session data
     */
    calculateStudyStreakFromSessions(sessions) {
        if (!sessions || sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

        // Get unique study dates, sorted descending
        const studyDates = [...new Set(
            sessions.map(s => s.session_date.split('T')[0])
        )].sort((a, b) => new Date(b) - new Date(a));

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate current streak
        for (let i = 0; i < studyDates.length; i++) {
            const studyDate = new Date(studyDates[i]);
            studyDate.setHours(0, 0, 0, 0);

            const daysDiff = Math.floor((today - studyDate) / (1000 * 60 * 60 * 24));

            if (i === 0) {
                // First date: must be today or yesterday
                if (daysDiff <= 1) {
                    currentStreak = 1;
                    tempStreak = 1;
                } else {
                    break;
                }
            } else {
                // Subsequent dates: must be consecutive
                const prevDate = new Date(studyDates[i - 1]);
                const daysDiffFromPrev = Math.floor((prevDate - studyDate) / (1000 * 60 * 60 * 24));

                if (daysDiffFromPrev === 1) {
                    currentStreak++;
                    tempStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak
        tempStreak = 0;
        for (let i = 0; i < studyDates.length - 1; i++) {
            const currentDate = new Date(studyDates[i]);
            const nextDate = new Date(studyDates[i + 1]);
            const daysDiff = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));

            if (daysDiff === 1) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak + 1);
            } else {
                tempStreak = 0;
            }
        }

        longestStreak = Math.max(longestStreak, currentStreak);

        return { currentStreak, longestStreak };
    }

    // ======================== HELPER METHODS ========================

    /**
     * Get next scheduled session for a plan
     */
    async getNextScheduledSession(planId) {
        const today = new Date().toISOString().split('T')[0];
        return this.repos.session.findNextByPlanId(planId, today);
    }

    /**
     * Update topic progress based on session completion
     */
    async updateTopicProgress(topicId, completionData) {
        const progressUpdate = {
            last_studied: new Date(),
            study_count: 'study_count + 1',
            total_time_seconds: `total_time_seconds + ${completionData.timeStudied}`,
            questions_solved: `questions_solved + ${completionData.questionsSolved || 0}`
        };

        // Update confidence level based on performance
        if (completionData.confidenceRating) {
            progressUpdate.confidence_level = completionData.confidenceRating;
        }

        return this.repos.topic.updateProgress(topicId, progressUpdate);
    }

    /**
     * Log study time for detailed analytics
     */
    async logStudyTime(sessionId, seconds) {
        const logEntry = {
            session_id: sessionId,
            duration_seconds: seconds,
            logged_at: new Date()
        };

        return this.repos.session.logStudyTime(logEntry);
    }

    /**
     * Update plan postponement count
     */
    async updatePlanPostponementCount(planId) {
        return this.repos.plan.incrementPostponementCount(planId);
    }

    /**
     * Analyze postponement patterns
     */
    async analyzePostponementPattern(planId, userId) {
        const postponements = await this.repos.session.getPostponementHistory(planId);
        const totalSessions = await this.repos.session.countByPlanId(planId);

        const postponementRate = totalSessions > 0 ? 
            (postponements.length / totalSessions) * 100 : 0;

        let recommendation = '';
        if (postponementRate > 30) {
            recommendation = 'Alto índice de adiamentos. Considere reduzir a carga diária ou ajustar os dias de estudo.';
        } else if (postponementRate > 15) {
            recommendation = 'Índice moderado de adiamentos. Tente manter a consistência no cronograma.';
        } else {
            recommendation = 'Boa consistência! Continue seguindo o cronograma.';
        }

        return {
            postponementRate: Math.round(postponementRate),
            totalPostponements: postponements.length,
            recommendation
        };
    }

    // ======================== MISSING METHODS FROM REQUIREMENTS ========================

    /**
     * Schedule a new study session with intelligent placement
     */
    async scheduleSession(planId, userId, sessionData) {
        // Validate plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Find optimal date if not specified
        if (!sessionData.session_date) {
            sessionData.session_date = await this.findOptimalSessionDate(planId, plan, sessionData.session_type);
        }

        // Create the session
        return await this.createSession(planId, userId, sessionData);
    }

    /**
     * Find optimal date for session scheduling
     */
    async findOptimalSessionDate(planId, plan, sessionType) {
        const today = new Date();
        const examDate = new Date(plan.exam_date);
        const studyDaysOfWeek = this.getStudyDaysOfWeek(plan.days_per_week);
        
        let candidateDate = new Date(today);
        candidateDate.setDate(candidateDate.getDate() + 1); // Start tomorrow
        
        while (candidateDate < examDate) {
            if (studyDaysOfWeek.includes(candidateDate.getDay())) {
                // Check if this date has capacity (max 6 sessions per day)
                const existingSessions = await this.repos.session.findByPlanIdAndDate(
                    planId, 
                    candidateDate.toISOString().split('T')[0]
                );
                
                if (!existingSessions || existingSessions.length < 6) {
                    return candidateDate.toISOString().split('T')[0];
                }
            }
            candidateDate.setDate(candidateDate.getDate() + 1);
        }
        
        // If no optimal date found, return tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    /**
     * Schedule reinforcement session based on spaced repetition
     */
    async reinforceSession(sessionId, planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Get original session
        const session = await this.repos.session.findByIdAndPlanId(sessionId, planId);
        if (!session) {
            throw new Error('Sessão não encontrada');
        }

        if (session.status !== 'completed') {
            throw new Error('Sessão deve estar concluída para ser reforçada');
        }

        // Create reinforcement session
        const reinforcementDate = new Date();
        reinforcementDate.setDate(reinforcementDate.getDate() + 1); // Tomorrow
        
        const reinforcementSession = {
            study_plan_id: planId,
            topic_id: session.topic_id,
            subject_name: session.subject_name,
            session_date: reinforcementDate.toISOString().split('T')[0],
            session_type: 'Reforço',
            status: 'pending',
            duration_minutes: Math.max(15, Math.floor(session.duration_minutes * 0.5)),
            priority: session.priority + 20 // Higher priority for reinforcement
        };

        return await this.repos.session.createSession(reinforcementSession);
    }

    /**
     * Calculate study streak with detailed analysis
     */
    async calculateStreak(planId, userId) {
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        const sessions = await this.repos.session.findCompletedByPlanId(planId);
        const streakData = this.calculateStudyStreakFromSessions(sessions);
        
        // Add additional streak analysis
        const today = new Date().toISOString().split('T')[0];
        const todaysSessions = sessions.filter(s => 
            s.session_date.split('T')[0] === today
        );
        
        const streakRisk = this.assessStreakRisk(sessions, streakData.currentStreak);
        
        return {
            ...streakData,
            todayStudied: todaysSessions.length > 0,
            streakRisk,
            recommendation: this.getStreakRecommendation(streakData, streakRisk)
        };
    }

    /**
     * Assess risk of streak breaking
     */
    assessStreakRisk(sessions, currentStreak) {
        if (currentStreak === 0) return 'no_streak';
        if (currentStreak < 3) return 'low';
        
        // Check recent patterns
        const recentSessions = sessions.slice(-7); // Last 7 sessions
        const averageGap = this.calculateAverageSessionGap(recentSessions);
        
        if (averageGap > 1.5) return 'high';
        if (averageGap > 1.2) return 'medium';
        return 'low';
    }

    /**
     * Calculate average gap between sessions
     */
    calculateAverageSessionGap(sessions) {
        if (sessions.length < 2) return 0;
        
        const dates = sessions.map(s => new Date(s.session_date)).sort((a, b) => a - b);
        let totalGap = 0;
        
        for (let i = 1; i < dates.length; i++) {
            const gap = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24); // Days
            totalGap += gap;
        }
        
        return totalGap / (dates.length - 1);
    }

    /**
     * Get streak recommendation based on analysis
     */
    getStreakRecommendation(streakData, risk) {
        if (streakData.currentStreak === 0) {
            return 'Comece uma nova sequência estudando hoje!';
        }
        
        if (risk === 'high') {
            return 'Atenção: risco alto de perder a sequência. Estude hoje!';
        }
        
        if (streakData.currentStreak >= 7) {
            return 'Parabéns! Mantenha o ritmo para atingir novos recordes.';
        }
        
        return 'Continue assim! Cada dia de estudo fortalece seu hábito.';
    }

    /**
     * Get revision statistics for dashboard
     */
    async getRevisionStatistics(planId) {
        try {
            const sessions = await this.repos.session.findByPlanId(planId);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Filtrar sessões de revisão por tipo
            const revision7 = sessions.filter(s => s.session_type === 'Revisão 7d');
            const revision14 = sessions.filter(s => s.session_type === 'Revisão 14d');
            const revision28 = sessions.filter(s => s.session_type === 'Revisão 28d');
            
            // Calcular estatísticas para cada ciclo
            const calculate = (revisionSessions) => {
                const total = revisionSessions.length;
                const completed = revisionSessions.filter(s => s.status === 'completed').length;
                const overdue = revisionSessions.filter(s => {
                    const sessionDate = new Date(s.session_date);
                    sessionDate.setHours(0, 0, 0, 0);
                    return sessionDate < today && s.status === 'pending';
                }).length;
                
                return { total, completed, overdue };
            };
            
            return {
                revision7: calculate(revision7),
                revision14: calculate(revision14),
                revision28: calculate(revision28)
            };
        } catch (error) {
            console.error('Erro ao calcular estatísticas de revisão:', error);
            return {
                revision7: { total: 0, completed: 0, overdue: 0 },
                revision14: { total: 0, completed: 0, overdue: 0 },
                revision28: { total: 0, completed: 0, overdue: 0 }
            };
        }
    }

    /**
     * Get study pace for last N days
     */
    async getStudyPace(planId) {
        try {
            const sessions = await this.repos.session.findByPlanId(planId);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            
            // Filtrar apenas sessões de novo tópico concluídas
            const studySessions = sessions.filter(s => 
                s.session_type === 'Novo Tópico' && 
                s.status === 'completed'
            );
            
            // Calcular para diferentes janelas de tempo
            const calculate = (daysBack) => {
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() - daysBack);
                startDate.setHours(0, 0, 0, 0);
                
                const sessionsInWindow = studySessions.filter(s => {
                    const sessionDate = new Date(s.session_date);
                    return sessionDate >= startDate && sessionDate <= today;
                });
                
                // Contar tópicos únicos concluídos
                const uniqueTopics = new Set(
                    sessionsInWindow
                        .filter(s => s.topic_id !== null)
                        .map(s => s.topic_id)
                ).size;
                
                return daysBack > 0 ? uniqueTopics / daysBack : 0;
            };
            
            return {
                last7Days: calculate(7),
                last14Days: calculate(14),
                last30Days: calculate(30)
            };
        } catch (error) {
            console.error('Erro ao calcular ritmo de estudo:', error);
            return {
                last7Days: 0,
                last14Days: 0,
                last30Days: 0
            };
        }
    }
}

module.exports = SessionService;