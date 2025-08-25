/**
 * Statistics Service - Analytics and metrics business logic
 * FASE 4 - SERVICES LAYER
 * 
 * This service handles all business logic related to analytics and statistics:
 * - Dashboard metrics aggregation
 * - Performance calculations and analysis
 * - Progress reports and trends
 * - Study patterns analysis
 * - Comparative analytics
 */

class StatisticsService {
    constructor(repositories, db) {
        this.repos = repositories;
        this.db = db;
    }

    // ======================== DASHBOARD METRICS ========================

    /**
     * Get comprehensive dashboard metrics for a plan
     */
    async getDashboardMetrics(planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        // Gather all metrics in parallel for performance
        const [
            basicStats,
            progressStats,
            streakInfo,
            performanceMetrics,
            timeAnalytics,
            subjectBreakdown,
            recentActivity
        ] = await Promise.all([
            this.getBasicStatistics(planId),
            this.getProgressStatistics(planId),
            this.getStreakStatistics(planId),
            this.getPerformanceMetrics(planId),
            this.getTimeAnalytics(planId),
            this.getSubjectBreakdown(planId),
            this.getRecentActivity(planId, 7) // Last 7 days
        ]);

        return {
            basicStats,
            progressStats,
            streakInfo,
            performanceMetrics,
            timeAnalytics,
            subjectBreakdown,
            recentActivity,
            generatedAt: new Date()
        };
    }

    /**
     * Get basic plan statistics
     */
    async getBasicStatistics(planId) {
        const stats = await this.repos.statistics.getPlanComprehensiveStats(planId);
        
        if (!stats) {
            return {
                totalTopics: 0,
                completedTopics: 0,
                totalSessions: 0,
                completedSessions: 0,
                totalStudyHours: 0,
                daysUntilExam: 0
            };
        }

        return {
            totalTopics: stats.total_topics || 0,
            completedTopics: stats.completed_topics || 0,
            progressPercentage: stats.progress_percentage || 0,
            totalSessions: stats.total_sessions || 0,
            completedSessions: stats.completed_sessions || 0,
            overdueSessions: stats.overdue_sessions || 0,
            totalStudyHours: stats.total_study_hours || 0,
            totalQuestionsSolved: stats.total_questions_solved || 0,
            uniqueStudyDays: stats.study_days || 0,
            averageHoursPerDay: stats.avg_hours_per_day || 0,
            daysUntilExam: Math.max(0, stats.days_until_exam || 0)
        };
    }

    /**
     * Get detailed progress statistics
     */
    async getProgressStatistics(planId) {
        const [subjectProgress, weeklyProgress, monthlyProgress] = await Promise.all([
            this.repos.statistics.getSubjectProgressStats(planId),
            this.repos.statistics.getWeeklyProgressTrend(planId),
            this.repos.statistics.getMonthlyProgressTrend(planId)
        ]);

        return {
            subjectProgress: subjectProgress || [],
            weeklyTrend: weeklyProgress || [],
            monthlyTrend: monthlyProgress || [],
            topPerformingSubjects: this.identifyTopPerformingSubjects(subjectProgress),
            strugglingSubjects: this.identifyStrugglingSubjects(subjectProgress)
        };
    }

    /**
     * Get streak statistics and patterns
     */
    async getStreakStatistics(planId) {
        const streakData = await this.repos.statistics.getStudyStreakData(planId);
        const patterns = await this.analyzeStudyPatterns(planId);

        return {
            currentStreak: streakData?.current_streak || 0,
            longestStreak: streakData?.longest_streak || 0,
            streakHistory: streakData?.streak_history || [],
            studyPatterns: patterns,
            consistency: this.calculateConsistencyScore(streakData)
        };
    }

    /**
     * Get performance metrics and analysis
     */
    async getPerformanceMetrics(planId) {
        const [
            accuracyStats,
            speedMetrics,
            difficultyAnalysis,
            improvementTrends
        ] = await Promise.all([
            this.repos.statistics.getAccuracyStatistics(planId),
            this.repos.statistics.getSpeedMetrics(planId),
            this.repos.statistics.getDifficultyAnalysis(planId),
            this.repos.statistics.getImprovementTrends(planId)
        ]);

        return {
            accuracy: accuracyStats,
            speed: speedMetrics,
            difficulty: difficultyAnalysis,
            improvement: improvementTrends,
            performanceScore: this.calculateOverallPerformanceScore({
                accuracy: accuracyStats,
                speed: speedMetrics,
                difficulty: difficultyAnalysis
            })
        };
    }

    /**
     * Get time analytics and productivity insights
     */
    async getTimeAnalytics(planId) {
        const [
            dailyTimeDistribution,
            hourlyProductivity,
            sessionLengthAnalysis,
            timeEfficiency
        ] = await Promise.all([
            this.repos.statistics.getDailyTimeDistribution(planId),
            this.repos.statistics.getHourlyProductivityData(planId),
            this.repos.statistics.getSessionLengthAnalysis(planId),
            this.calculateTimeEfficiency(planId)
        ]);

        return {
            dailyDistribution: dailyTimeDistribution || [],
            hourlyProductivity: hourlyProductivity || [],
            sessionLengthStats: sessionLengthAnalysis || {},
            efficiency: timeEfficiency,
            recommendations: this.generateTimeRecommendations(dailyTimeDistribution, hourlyProductivity)
        };
    }

    /**
     * Get subject breakdown and analysis
     */
    async getSubjectBreakdown(planId) {
        const breakdown = await this.repos.statistics.getSubjectBreakdownStats(planId);
        
        return {
            subjects: breakdown || [],
            coverage: this.calculateSubjectCoverage(breakdown),
            balance: this.analyzeSubjectBalance(breakdown),
            recommendations: this.generateSubjectRecommendations(breakdown)
        };
    }

    /**
     * Get recent activity summary
     */
    async getRecentActivity(planId, days = 7) {
        const activities = await this.repos.statistics.getRecentActivityData(planId, days);
        
        return {
            sessions: activities?.sessions || [],
            summary: this.summarizeRecentActivity(activities),
            trends: this.identifyRecentTrends(activities)
        };
    }

    // ======================== PERFORMANCE CALCULATIONS ========================

    /**
     * Calculate overall performance score
     */
    calculateOverallPerformanceScore(metrics) {
        let score = 0;
        let factors = 0;

        // Accuracy factor (40% weight)
        if (metrics.accuracy && metrics.accuracy.overall_accuracy !== undefined) {
            score += (metrics.accuracy.overall_accuracy / 100) * 0.4;
            factors += 0.4;
        }

        // Speed factor (30% weight)
        if (metrics.speed && metrics.speed.average_time_per_question) {
            const speedScore = Math.max(0, Math.min(1, 
                (120 - metrics.speed.average_time_per_question) / 120
            ));
            score += speedScore * 0.3;
            factors += 0.3;
        }

        // Difficulty progression (30% weight)
        if (metrics.difficulty && metrics.difficulty.hard_topic_success_rate !== undefined) {
            score += (metrics.difficulty.hard_topic_success_rate / 100) * 0.3;
            factors += 0.3;
        }

        return factors > 0 ? Math.round((score / factors) * 100) : 0;
    }

    /**
     * Calculate consistency score from streak data
     */
    calculateConsistencyScore(streakData) {
        if (!streakData) return 0;

        const currentStreak = streakData.current_streak || 0;
        const longestStreak = streakData.longest_streak || 0;
        const streakHistory = streakData.streak_history || [];

        // Base score from current streak
        let score = Math.min(100, currentStreak * 10);

        // Bonus for maintaining long streaks
        if (longestStreak >= 14) score += 10;
        if (longestStreak >= 30) score += 10;

        // Penalty for frequent streak breaks
        const breakCount = streakHistory.filter(s => s.streak_length < 3).length;
        if (breakCount > 5) score -= 20;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate time efficiency metrics
     */
    async calculateTimeEfficiency(planId) {
        const sessions = await this.repos.session.findCompletedByPlanId(planId);
        
        if (!sessions || sessions.length === 0) {
            return { efficiency: 0, averageSessionTime: 0, focusScore: 0 };
        }

        const totalTime = sessions.reduce((acc, session) => 
            acc + (session.time_studied_seconds || 0), 0
        );
        const totalPlannedTime = sessions.reduce((acc, session) => 
            acc + (session.duration_minutes * 60), 0
        );

        const averageSessionTime = totalTime / sessions.length;
        const efficiency = totalPlannedTime > 0 ? (totalTime / totalPlannedTime) * 100 : 0;
        
        // Focus score based on session completion rate
        const completionRate = sessions.filter(s => 
            s.time_studied_seconds >= (s.duration_minutes * 60 * 0.8)
        ).length / sessions.length;

        return {
            efficiency: Math.round(efficiency),
            averageSessionTime: Math.round(averageSessionTime),
            focusScore: Math.round(completionRate * 100)
        };
    }

    // ======================== ANALYSIS HELPERS ========================

    /**
     * Identify top performing subjects
     */
    identifyTopPerformingSubjects(subjectProgress) {
        if (!subjectProgress || subjectProgress.length === 0) return [];

        return subjectProgress
            .filter(subject => subject.completed_topics > 0)
            .sort((a, b) => {
                const scoreA = (a.accuracy || 0) + (a.progress_percentage || 0);
                const scoreB = (b.accuracy || 0) + (b.progress_percentage || 0);
                return scoreB - scoreA;
            })
            .slice(0, 3)
            .map(subject => ({
                name: subject.subject_name,
                score: Math.round((subject.accuracy || 0) + (subject.progress_percentage || 0)),
                progress: subject.progress_percentage || 0
            }));
    }

    /**
     * Identify struggling subjects that need attention
     */
    identifyStrugglingSubjects(subjectProgress) {
        if (!subjectProgress || subjectProgress.length === 0) return [];

        return subjectProgress
            .filter(subject => subject.completed_topics > 2) // Only subjects with enough data
            .sort((a, b) => {
                const scoreA = (a.accuracy || 0) + (a.progress_percentage || 0);
                const scoreB = (b.accuracy || 0) + (b.progress_percentage || 0);
                return scoreA - scoreB;
            })
            .slice(0, 3)
            .map(subject => ({
                name: subject.subject_name,
                issues: this.identifySubjectIssues(subject),
                recommendations: this.generateSubjectHelp(subject)
            }));
    }

    /**
     * Analyze study patterns from session data
     */
    async analyzeStudyPatterns(planId) {
        const sessions = await this.repos.session.findCompletedByPlanId(planId);
        
        if (!sessions || sessions.length === 0) {
            return { preferredTime: null, preferredDays: [], consistency: 0 };
        }

        // Analyze preferred study times
        const hourCounts = {};
        const dayCounts = {};

        sessions.forEach(session => {
            const sessionDate = new Date(session.completed_at || session.session_date);
            const hour = sessionDate.getHours();
            const day = sessionDate.getDay();

            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        });

        const preferredTime = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];

        const preferredDays = Object.entries(dayCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([day]) => parseInt(day));

        return {
            preferredTime: preferredTime ? `${preferredTime}:00` : null,
            preferredDays: preferredDays.map(day => this.getDayName(day)),
            consistency: this.calculateStudyTimeConsistency(sessions)
        };
    }

    /**
     * Calculate subject coverage percentage
     */
    calculateSubjectCoverage(subjects) {
        if (!subjects || subjects.length === 0) return 0;

        const totalTopics = subjects.reduce((acc, sub) => acc + (sub.total_topics || 0), 0);
        const scheduledTopics = subjects.reduce((acc, sub) => acc + (sub.scheduled_topics || 0), 0);

        return totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
    }

    /**
     * Analyze subject balance in study plan
     */
    analyzeSubjectBalance(subjects) {
        if (!subjects || subjects.length === 0) {
            return { isBalanced: false, imbalanceScore: 0 };
        }

        const timeDistribution = subjects.map(sub => sub.total_study_time || 0);
        const mean = timeDistribution.reduce((a, b) => a + b, 0) / timeDistribution.length;
        
        // Calculate standard deviation
        const variance = timeDistribution.reduce((acc, time) => 
            acc + Math.pow(time - mean, 2), 0
        ) / timeDistribution.length;
        
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

        return {
            isBalanced: coefficientOfVariation < 0.5,
            imbalanceScore: Math.round(coefficientOfVariation * 100),
            recommendation: coefficientOfVariation > 0.7 ? 
                'Considere rebalancear o tempo entre as matérias' : 
                'Distribuição equilibrada entre as matérias'
        };
    }

    // ======================== RECOMMENDATION ENGINES ========================

    /**
     * Generate time management recommendations
     */
    generateTimeRecommendations(dailyDistribution, hourlyProductivity) {
        const recommendations = [];

        if (hourlyProductivity && hourlyProductivity.length > 0) {
            const peakHour = hourlyProductivity.reduce((max, current) => 
                current.productivity > max.productivity ? current : max
            );

            if (peakHour.hour < 12) {
                recommendations.push('Seu pico de produtividade é pela manhã. Considere agendar tópicos mais difíceis neste período.');
            } else if (peakHour.hour < 18) {
                recommendations.push('Você é mais produtivo à tarde. Mantenha suas sessões principais neste horário.');
            } else {
                recommendations.push('Sua produtividade é maior à noite. Certifique-se de ter um ambiente adequado para estudos noturnos.');
            }
        }

        if (dailyDistribution && dailyDistribution.length > 0) {
            const averageDaily = dailyDistribution.reduce((acc, day) => 
                acc + day.total_time, 0
            ) / dailyDistribution.length;

            if (averageDaily < 7200) { // Less than 2 hours
                recommendations.push('Tente aumentar gradualmente seu tempo de estudo diário para melhores resultados.');
            } else if (averageDaily > 28800) { // More than 8 hours
                recommendations.push('Cuidado com o excesso. Sessões muito longas podem reduzir a eficiência. Considere pausas regulares.');
            }
        }

        return recommendations;
    }

    /**
     * Generate subject-specific recommendations
     */
    generateSubjectRecommendations(subjects) {
        if (!subjects || subjects.length === 0) return [];

        const recommendations = [];
        
        // Find subjects with low progress
        const lowProgressSubjects = subjects.filter(sub => 
            (sub.progress_percentage || 0) < 30 && (sub.total_topics || 0) > 0
        );

        if (lowProgressSubjects.length > 0) {
            recommendations.push({
                type: 'progress',
                message: `Foque mais nas matérias: ${lowProgressSubjects.map(s => s.subject_name).join(', ')}`,
                subjects: lowProgressSubjects.map(s => s.subject_name)
            });
        }

        // Find subjects with low accuracy
        const lowAccuracySubjects = subjects.filter(sub => 
            (sub.accuracy || 0) < 60 && (sub.questions_solved || 0) > 10
        );

        if (lowAccuracySubjects.length > 0) {
            recommendations.push({
                type: 'accuracy',
                message: `Revise conceitos básicos em: ${lowAccuracySubjects.map(s => s.subject_name).join(', ')}`,
                subjects: lowAccuracySubjects.map(s => s.subject_name)
            });
        }

        return recommendations;
    }

    /**
     * Generate subject-specific help based on performance issues
     */
    generateSubjectHelp(subject) {
        const help = [];

        if ((subject.accuracy || 0) < 50) {
            help.push('Revise os conceitos fundamentais antes de resolver questões');
        }

        if ((subject.average_time_per_question || 0) > 180) { // 3 minutes
            help.push('Pratique resolução rápida de questões para melhorar o tempo');
        }

        if ((subject.progress_percentage || 0) < 20) {
            help.push('Dedique mais tempo de estudo a esta matéria');
        }

        if ((subject.confidence_rating || 0) < 3) {
            help.push('Faça mais exercícios práticos para ganhar confiança');
        }

        return help.length > 0 ? help : ['Continue praticando regularmente'];
    }

    // ======================== UTILITY FUNCTIONS ========================

    /**
     * Get day name from day number
     */
    getDayName(dayNumber) {
        const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return days[dayNumber] || 'Desconhecido';
    }

    /**
     * Calculate study time consistency
     */
    calculateStudyTimeConsistency(sessions) {
        if (!sessions || sessions.length < 3) return 0;

        const studyTimes = sessions.map(s => s.time_studied_seconds || 0);
        const mean = studyTimes.reduce((a, b) => a + b, 0) / studyTimes.length;
        
        const variance = studyTimes.reduce((acc, time) => 
            acc + Math.pow(time - mean, 2), 0
        ) / studyTimes.length;
        
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

        return Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));
    }

    /**
     * Identify specific issues with a subject
     */
    identifySubjectIssues(subject) {
        const issues = [];

        if ((subject.accuracy || 0) < 50) {
            issues.push('Baixa taxa de acerto');
        }

        if ((subject.average_time_per_question || 0) > 180) {
            issues.push('Tempo excessivo por questão');
        }

        if ((subject.progress_percentage || 0) < 20) {
            issues.push('Progresso muito lento');
        }

        return issues.length > 0 ? issues : ['Necessita mais prática'];
    }

    /**
     * Summarize recent activity
     */
    summarizeRecentActivity(activities) {
        if (!activities || !activities.sessions) {
            return { totalSessions: 0, totalTime: 0, averageDaily: 0 };
        }

        const sessions = activities.sessions;
        const totalTime = sessions.reduce((acc, s) => acc + (s.time_studied_seconds || 0), 0);
        const uniqueDays = new Set(sessions.map(s => s.session_date.split('T')[0])).size;

        return {
            totalSessions: sessions.length,
            totalTime: Math.round(totalTime / 3600), // Convert to hours
            averageDaily: uniqueDays > 0 ? Math.round(totalTime / (uniqueDays * 3600)) : 0,
            uniqueStudyDays: uniqueDays
        };
    }

    /**
     * Identify recent trends in study data
     */
    identifyRecentTrends(activities) {
        if (!activities || !activities.sessions || activities.sessions.length < 3) {
            return { trend: 'insufficient_data', message: 'Dados insuficientes para análise' };
        }

        const sessions = activities.sessions;
        const firstHalf = sessions.slice(0, Math.floor(sessions.length / 2));
        const secondHalf = sessions.slice(Math.floor(sessions.length / 2));

        const firstHalfTime = firstHalf.reduce((acc, s) => acc + (s.time_studied_seconds || 0), 0);
        const secondHalfTime = secondHalf.reduce((acc, s) => acc + (s.time_studied_seconds || 0), 0);

        const avgFirstHalf = firstHalf.length > 0 ? firstHalfTime / firstHalf.length : 0;
        const avgSecondHalf = secondHalf.length > 0 ? secondHalfTime / secondHalf.length : 0;

        const percentageChange = avgFirstHalf > 0 ? 
            ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100 : 0;

        if (percentageChange > 10) {
            return { 
                trend: 'improving', 
                message: `Tendência positiva: +${Math.round(percentageChange)}% no tempo de estudo` 
            };
        } else if (percentageChange < -10) {
            return { 
                trend: 'declining', 
                message: `Atenção: ${Math.round(Math.abs(percentageChange))}% de redução no tempo de estudo` 
            };
        } else {
            return { 
                trend: 'stable', 
                message: 'Padrão de estudo estável nos últimos dias' 
            };
        }
    }

    // ======================== MISSING METHODS FROM REQUIREMENTS ========================

    /**
     * Calculate comprehensive performance metrics
     */
    async calculatePerformance(planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        const performanceMetrics = await this.getPerformanceMetrics(planId);
        const basicStats = await this.getBasicStatistics(planId);
        const progressStats = await this.getProgressStatistics(planId);
        const timeAnalytics = await this.getTimeAnalytics(planId);
        
        // Calculate composite performance score
        const compositeScore = this.calculateCompositePerformanceScore({
            basic: basicStats,
            performance: performanceMetrics,
            progress: progressStats,
            time: timeAnalytics
        });
        
        return {
            overallScore: compositeScore,
            metrics: performanceMetrics,
            statistics: basicStats,
            progress: progressStats,
            timeAnalysis: timeAnalytics,
            recommendations: this.generatePerformanceRecommendations(compositeScore, performanceMetrics),
            calculatedAt: new Date()
        };
    }

    /**
     * Calculate composite performance score from multiple metrics
     */
    calculateCompositePerformanceScore(data) {
        let totalScore = 0;
        let totalWeight = 0;
        
        // Progress component (30% weight)
        if (data.basic.progressPercentage !== undefined) {
            totalScore += data.basic.progressPercentage * 0.3;
            totalWeight += 0.3;
        }
        
        // Consistency component (25% weight)
        if (data.progress.streakInfo && data.progress.streakInfo.consistency !== undefined) {
            totalScore += data.progress.streakInfo.consistency * 0.25;
            totalWeight += 0.25;
        }
        
        // Performance component (25% weight)
        if (data.performance.performanceScore !== undefined) {
            totalScore += data.performance.performanceScore * 0.25;
            totalWeight += 0.25;
        }
        
        // Time efficiency component (20% weight)
        if (data.time.efficiency && data.time.efficiency.efficiency !== undefined) {
            totalScore += data.time.efficiency.efficiency * 0.2;
            totalWeight += 0.2;
        }
        
        return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    }

    /**
     * Analyze study patterns with detailed insights
     */
    async getStudyPatterns(planId, userId) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        const sessions = await this.repos.session.findCompletedByPlanId(planId);
        
        if (!sessions || sessions.length === 0) {
            return {
                patterns: null,
                insights: ['Dados insuficientes para análise de padrões'],
                recommendations: ['Complete mais sessões de estudo para obter insights personalizados']
            };
        }

        // Analyze temporal patterns
        const temporalPatterns = this.analyzeTemporalPatterns(sessions);
        
        // Analyze productivity patterns
        const productivityPatterns = this.analyzeProductivityPatterns(sessions);
        
        // Analyze subject patterns
        const subjectPatterns = await this.analyzeSubjectStudyPatterns(planId, sessions);
        
        // Generate insights
        const insights = this.generatePatternInsights(temporalPatterns, productivityPatterns, subjectPatterns);
        
        // Generate recommendations
        const recommendations = this.generatePatternRecommendations(temporalPatterns, productivityPatterns, subjectPatterns);
        
        return {
            patterns: {
                temporal: temporalPatterns,
                productivity: productivityPatterns,
                subjects: subjectPatterns
            },
            insights,
            recommendations,
            analyzedSessions: sessions.length,
            analysisDate: new Date()
        };
    }

    /**
     * Analyze temporal study patterns
     */
    analyzeTemporalPatterns(sessions) {
        const hourCounts = {};
        const dayCounts = {};
        const monthCounts = {};
        
        sessions.forEach(session => {
            const date = new Date(session.completed_at || session.session_date);
            const hour = date.getHours();
            const dayOfWeek = date.getDay();
            const month = date.getMonth();
            
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
            monthCounts[month] = (monthCounts[month] || 0) + 1;
        });
        
        return {
            preferredHours: this.getTopEntries(hourCounts, 3),
            preferredDays: this.getTopEntries(dayCounts, 3),
            monthlyDistribution: monthCounts,
            peakStudyHour: this.getTopEntries(hourCounts, 1)[0]?.key,
            peakStudyDay: this.getTopEntries(dayCounts, 1)[0]?.key
        };
    }

    /**
     * Analyze productivity patterns
     */
    analyzeProductivityPatterns(sessions) {
        const sessionLengths = sessions.map(s => s.time_studied_seconds || 0);
        const averageLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
        
        const productiveHours = {};
        sessions.forEach(session => {
            const hour = new Date(session.completed_at || session.session_date).getHours();
            const productivity = (session.time_studied_seconds || 0) / (session.duration_minutes * 60);
            
            if (!productiveHours[hour]) {
                productiveHours[hour] = [];
            }
            productiveHours[hour].push(productivity);
        });
        
        // Calculate average productivity by hour
        const hourlyProductivity = {};
        Object.keys(productiveHours).forEach(hour => {
            const avg = productiveHours[hour].reduce((a, b) => a + b, 0) / productiveHours[hour].length;
            hourlyProductivity[hour] = avg;
        });
        
        return {
            averageSessionLength: Math.round(averageLength),
            mostProductiveHour: this.getTopEntries(hourlyProductivity, 1)[0]?.key,
            leastProductiveHour: this.getBottomEntries(hourlyProductivity, 1)[0]?.key,
            hourlyProductivity: hourlyProductivity
        };
    }

    /**
     * Analyze subject study patterns
     */
    async analyzeSubjectStudyPatterns(planId, sessions) {
        const subjectSessions = {};
        
        sessions.forEach(session => {
            const subject = session.subject_name;
            if (!subjectSessions[subject]) {
                subjectSessions[subject] = [];
            }
            subjectSessions[subject].push(session);
        });
        
        const subjectStats = {};
        Object.keys(subjectSessions).forEach(subject => {
            const subjectSessionList = subjectSessions[subject];
            const totalTime = subjectSessionList.reduce((acc, s) => acc + (s.time_studied_seconds || 0), 0);
            const avgTime = totalTime / subjectSessionList.length;
            
            subjectStats[subject] = {
                sessionCount: subjectSessionList.length,
                totalTime,
                averageTime: Math.round(avgTime),
                percentage: (subjectSessionList.length / sessions.length) * 100
            };
        });
        
        return subjectStats;
    }

    /**
     * Generate study recommendations based on performance analysis
     */
    async generateRecommendations(planId, userId, options = {}) {
        // Verify plan ownership
        const plan = await this.repos.plan.findByIdAndUser(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        const performance = await this.calculatePerformance(planId, userId);
        const patterns = await this.getStudyPatterns(planId, userId);
        const dashboardMetrics = await this.getDashboardMetrics(planId, userId);
        
        const recommendations = {
            priority: [],
            performance: [],
            time: [],
            subjects: [],
            general: []
        };
        
        // Priority recommendations based on critical issues
        if (dashboardMetrics.basicStats.overdueSessions > 5) {
            recommendations.priority.push({
                type: 'urgent',
                title: 'Sessões em Atraso',
                message: `Você tem ${dashboardMetrics.basicStats.overdueSessions} sessões atrasadas. Considere replanejamento.`,
                action: 'replanning'
            });
        }
        
        // Performance recommendations
        if (performance.overallScore < 60) {
            recommendations.performance.push({
                type: 'improvement',
                title: 'Performance Baixa',
                message: 'Seu desempenho geral está abaixo do ideal. Foque em consistência e qualidade.',
                action: 'focus_improvement'
            });
        }
        
        // Time management recommendations
        if (patterns.patterns && patterns.patterns.productivity) {
            const mostProductive = patterns.patterns.productivity.mostProductiveHour;
            if (mostProductive) {
                recommendations.time.push({
                    type: 'optimization',
                    title: 'Horrio Ótimo',
                    message: `Você é mais produtivo às ${mostProductive}h. Agende sessões importantes neste horário.`,
                    action: 'schedule_optimization'
                });
            }
        }
        
        // Subject recommendations
        const subjectRecommendations = this.generateSubjectRecommendations(
            dashboardMetrics.subjectBreakdown.subjects
        );
        recommendations.subjects = subjectRecommendations;
        
        // General recommendations
        if (dashboardMetrics.streakInfo.currentStreak === 0) {
            recommendations.general.push({
                type: 'habit',
                title: 'Retome o Hábito',
                message: 'Comece uma nova sequência de estudos hoje mesmo!',
                action: 'start_streak'
            });
        }
        
        return {
            recommendations,
            analysisScore: this.calculateRecommendationPriority(recommendations),
            lastUpdated: new Date(),
            basedOn: {
                performanceScore: performance.overallScore,
                sessionsAnalyzed: patterns.analyzedSessions || 0,
                dataPoints: Object.keys(dashboardMetrics).length
            }
        };
    }

    // ======================== HELPER METHODS FOR NEW FUNCTIONALITY ========================

    /**
     * Get top entries from object sorted by value
     */
    getTopEntries(obj, count) {
        return Object.entries(obj)
            .sort(([,a], [,b]) => b - a)
            .slice(0, count)
            .map(([key, value]) => ({ key: parseInt(key), value }));
    }

    /**
     * Get bottom entries from object sorted by value
     */
    getBottomEntries(obj, count) {
        return Object.entries(obj)
            .sort(([,a], [,b]) => a - b)
            .slice(0, count)
            .map(([key, value]) => ({ key: parseInt(key), value }));
    }

    /**
     * Generate pattern insights
     */
    generatePatternInsights(temporal, productivity, subjects) {
        const insights = [];
        
        if (temporal.peakStudyHour !== undefined) {
            const hourName = temporal.peakStudyHour < 12 ? 'manhã' : 
                           temporal.peakStudyHour < 18 ? 'tarde' : 'noite';
            insights.push(`Você estuda principalmente de ${hourName} (às ${temporal.peakStudyHour}h)`);
        }
        
        if (productivity.averageSessionLength) {
            const minutes = Math.round(productivity.averageSessionLength / 60);
            insights.push(`Suas sessões duram em média ${minutes} minutos`);
        }
        
        const subjectCount = Object.keys(subjects).length;
        if (subjectCount > 0) {
            insights.push(`Você estuda ${subjectCount} matérias diferentes`);
        }
        
        return insights;
    }

    /**
     * Generate pattern-based recommendations
     */
    generatePatternRecommendations(temporal, productivity, subjects) {
        const recommendations = [];
        
        if (productivity.mostProductiveHour && productivity.leastProductiveHour) {
            recommendations.push(
                `Agende tópicos difíceis para as ${productivity.mostProductiveHour}h e evite estudar às ${productivity.leastProductiveHour}h`
            );
        }
        
        if (productivity.averageSessionLength < 1800) { // Less than 30 minutes
            recommendations.push('Tente aumentar gradualmente a duração das sessões para melhor retenção');
        }
        
        if (productivity.averageSessionLength > 7200) { // More than 2 hours
            recommendations.push('Considere fazer pausas durante sessões longas para manter o foco');
        }
        
        return recommendations;
    }

    /**
     * Generate performance recommendations
     */
    generatePerformanceRecommendations(score, metrics) {
        const recommendations = [];
        
        if (score < 50) {
            recommendations.push('Foque na consistência: estude um pouco todos os dias');
            recommendations.push('Revise conceitos fundamentais antes de resolver questões');
        } else if (score < 75) {
            recommendations.push('Bom progresso! Mantenha a regularidade e aumente gradualmente');
            recommendations.push('Inclua mais revisões para consolidar o aprendizado');
        } else {
            recommendations.push('Excelente desempenho! Continue assim');
            recommendations.push('Considere aumentar a dificuldade dos estudos');
        }
        
        return recommendations;
    }

    /**
     * Calculate recommendation priority score
     */
    calculateRecommendationPriority(recommendations) {
        let score = 100;
        
        if (recommendations.priority.length > 0) score -= 30;
        if (recommendations.performance.length > 2) score -= 20;
        if (recommendations.time.length > 2) score -= 15;
        if (recommendations.subjects.length > 3) score -= 10;
        
        return Math.max(0, score);
    }
}

module.exports = StatisticsService;