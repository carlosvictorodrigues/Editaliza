/**
 * Plan Service - Business logic for study plans
 * 
 * This service contains all the complex business logic for plan management,
 * schedule calculations, progress tracking, and analytics.
 */

const planRepository = require('../repositories/planRepository');
const { sanitizeHtml } = require('../utils/sanitizer');
const { dbGet, dbAll } = require('../utils/database');

/**
 * Get schedule preview with simulation calculations
 */
const getSchedulePreview = async (planId, userId) => {
    // Verify plan ownership
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado ou não pertence ao usuário');
    }

    // Get all study sessions for the plan
    const studySessions = await planRepository.getStudySessions(planId);
    
    // Get topic statistics - CORREÇÃO: usar sessões concluídas para cálculo preciso
    const allTopics = await planRepository.getTopicsWithStatus(planId);
    const totalTopics = allTopics.length;
    
    // Contar tópicos realmente estudados através das sessões concluídas
    const completedTopicSessions = studySessions.filter(s => 
        s.session_type === 'Novo Tópico' && 
        s.status === 'Concluído' && 
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
};

/**
 * Get basic plan progress
 */
const getProgress = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    const topics = await planRepository.getTopicsWithStatus(planId);
    const completed = topics.filter(t => t.status === 'Concluído').length;
    const total = topics.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
        completed,
        total,
        percentage,
        remaining: total - completed
    };
};

/**
 * Get detailed progress by subject
 */
const getDetailedProgress = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    const subjectDetails = await planRepository.getSubjectProgressDetails(planId);
    const totalProgress = await planRepository.getTotalProgress(planId);

    return {
        totalProgress,
        subjectDetails
    };
};

/**
 * Get goal progress (daily/weekly)
 */
const getGoalProgress = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    // Calculate daily/weekly goals and progress
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const dailyProgress = await planRepository.getDailyProgress(planId, today);
    const weeklyProgress = await planRepository.getWeeklyProgress(planId, weekStartStr);

    return {
        dailyGoal: plan.daily_question_goal || 0,
        dailyProgress: dailyProgress || 0,
        weeklyGoal: plan.weekly_question_goal || 0,
        weeklyProgress: weeklyProgress || 0
    };
};

/**
 * Get reality check analysis with real calculations
 */
const getRealityCheck = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    // Get all sessions and topics for analysis
    const sessions = await dbAll("SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?", [planId]);
    const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
    const totalTopics = totalTopicsResult.total;

    if (totalTopics === 0) {
        return { message: "Adicione tópicos ao seu plano para ver as projeções." };
    }

    const today = new Date(); 
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(plan.exam_date + 'T23:59:59');
    
    // Calculate completed topics - CORREÇÃO: filtrar topic_id não nulos
    const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
    const completedTopics = new Set(
        newTopicSessions
            .filter(s => s.status === 'Concluído' && s.topic_id !== null)
            .map(r => r.topic_id)
    );
    const topicsCompletedCount = completedTopics.size;
    const topicsRemaining = totalTopics - topicsCompletedCount;

    // Check if in maintenance mode (all future sessions done)
    const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'Pendente');
    const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

    // Calculate study pace
    const firstSessionDateResult = await dbGet("SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído'", [planId]);
    const firstSessionDate = firstSessionDateResult.first_date ? new Date(firstSessionDateResult.first_date + 'T00:00:00') : today;

    const daysSinceStart = Math.max(1, Math.ceil((today - firstSessionDate) / (1000 * 60 * 60 * 24)));
    const daysRemainingForExam = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
    
    const currentPace = topicsCompletedCount / daysSinceStart;
    const requiredPace = topicsRemaining / daysRemainingForExam;

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
        requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : "N/A",
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
        currentPace: currentPace.toFixed(1),
        averageDailyProgress: currentPace
    };
};

/**
 * Get gamification data with complete level system
 */
const getGamification = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    // Get completed topics count
    const completedTopicsResult = await dbGet(`
        SELECT COUNT(DISTINCT topic_id) as count 
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
    `, [planId]);
    const completedTopicsCount = completedTopicsResult.count || 0;

    // Define sophisticated 8-tier ranking system (League of Legends inspired)
    const levels = [
        { 
            threshold: 0, 
            title: 'Bronze 🥉', 
            subtitle: 'Iniciante',
            description: 'Todo grande concurseiro começou aqui. Primeiro passo dado!',
            color: '#CD7F32',
            bgColor: '#FFF8DC',
            icon: '🥉',
            motivationalText: 'Sua jornada rumo à aprovação começou!'
        },
        { 
            threshold: 11, 
            title: 'Silver 🥈', 
            subtitle: 'Novato',
            description: 'Você está ganhando momentum! Continue assim.',
            color: '#C0C0C0',
            bgColor: '#F8F8FF',
            icon: '🥈',
            motivationalText: 'O conhecimento está se acumulando!'
        },
        { 
            threshold: 31, 
            title: 'Gold 🥇', 
            subtitle: 'Competente',
            description: 'Nível sólido de conhecimento. Você está no caminho certo!',
            color: '#FFD700',
            bgColor: '#FFFACD',
            icon: '🥇',
            motivationalText: 'Você já tem uma base dourada de conhecimento!'
        },
        { 
            threshold: 61, 
            title: 'Platinum 💎', 
            subtitle: 'Avançado',
            description: 'Conhecimento refinado e consistente. Parabéns!',
            color: '#E5E4E2',
            bgColor: '#F0F8FF',
            icon: '💎',
            motivationalText: 'Seu conhecimento brilha como platina!'
        },
        { 
            threshold: 101, 
            title: 'Diamond 💍', 
            subtitle: 'Especialista',
            description: 'Elite do conhecimento. Poucos chegam até aqui!',
            color: '#B9F2FF',
            bgColor: '#E0FFFF',
            icon: '💍',
            motivationalText: 'Você é precioso como um diamante!'
        },
        { 
            threshold: 201, 
            title: 'Master 👑', 
            subtitle: 'Mestre',
            description: 'Maestria absoluta. Você domina o conhecimento!',
            color: '#9932CC',
            bgColor: '#E6E6FA',
            icon: '👑',
            motivationalText: 'Você reina sobre o conhecimento!'
        },
        { 
            threshold: 501, 
            title: 'Grandmaster ⚡', 
            subtitle: 'Lendário',
            description: 'Lenda viva! Seu conhecimento é impressionante.',
            color: '#FF4500',
            bgColor: '#FFE4E1',
            icon: '⚡',
            motivationalText: 'Você transcendeu os limites do conhecimento!'
        },
        { 
            threshold: 1000, 
            title: 'Challenger 🏆', 
            subtitle: 'Apex',
            description: 'O ápice absoluto! Você é um verdadeiro fenômeno.',
            color: '#FF0000',
            bgColor: '#FFCCCB',
            icon: '🏆',
            motivationalText: 'Você desafia os próprios limites! Lendário!'
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
    const completedSessions = await planRepository.getCompletedSessions(planId);
    const uniqueStudyDays = calculateUniqueStudyDays(completedSessions);
    const currentStreak = calculateStudyStreak(completedSessions);
    
    // Calculate achievements based on real data with proper structure
    const achievements = [];
    const now = new Date();
    
    // Helper function to create achievement objects
    const createAchievement = (title, description, earnedDate = now) => ({
        title,
        description,
        achieved_date: earnedDate.toISOString(),
        earned_at: earnedDate.toISOString() // Extra compatibility
    });
    
    // Topic-based achievements
    if (completedTopicsCount >= 1) {
        achievements.push(createAchievement(
            "Primeiro Estudo", 
            "Parabéns! Você concluiu seu primeiro tópico de estudo.",
            completedSessions.length > 0 ? new Date(completedSessions[0].completed_at || completedSessions[0].created_at) : now
        ));
    }
    if (completedTopicsCount >= 5) {
        achievements.push(createAchievement(
            "Estudioso Iniciante", 
            "Você já domina 5 tópicos! Continue nessa pegada."
        ));
    }
    if (completedTopicsCount >= 10) {
        achievements.push(createAchievement(
            "10 Tópicos Concluídos", 
            "Excelente progresso! 10 tópicos já estão no seu cinturão."
        ));
    }
    if (completedTopicsCount >= 25) {
        achievements.push(createAchievement(
            "Quarteto de Conhecimento", 
            "25 tópicos! Você está construindo uma base sólida."
        ));
    }
    if (completedTopicsCount >= 50) {
        achievements.push(createAchievement(
            "50 Tópicos Concluídos", 
            "Meio centenário de conhecimento! Você é imparável."
        ));
    }
    if (completedTopicsCount >= 100) {
        achievements.push(createAchievement(
            "Centurião do Conhecimento", 
            "100 tópicos! Você alcançou um marco histórico."
        ));
    }
    
    // Streak-based achievements
    if (currentStreak >= 3) {
        achievements.push(createAchievement(
            "Sequência de 3 dias", 
            "Três dias consecutivos de estudo! A consistência está se formando."
        ));
    }
    if (currentStreak >= 7) {
        achievements.push(createAchievement(
            "Sequência de 7 dias", 
            "Uma semana inteira de dedicação! Você está no caminho certo."
        ));
    }
    if (currentStreak >= 14) {
        achievements.push(createAchievement(
            "Duas Semanas Seguidas", 
            "14 dias consecutivos! Sua disciplina é admirável."
        ));
    }
    if (currentStreak >= 30) {
        achievements.push(createAchievement(
            "Mês de Dedicação", 
            "30 dias seguidos! Você transformou estudo em hábito."
        ));
    }
    
    // Session-based achievements
    if (completedSessions.length >= 20) {
        achievements.push(createAchievement(
            "20 Sessões Completadas", 
            "Vinte sessões de estudo! Sua persistência está dando frutos."
        ));
    }
    if (completedSessions.length >= 50) {
        achievements.push(createAchievement(
            "Veterano de Estudos", 
            "50 sessões! Você é oficialmente um veterano dos estudos."
        ));
    }
    if (completedSessions.length >= 100) {
        achievements.push(createAchievement(
            "Centurião das Sessões", 
            "100 sessões completadas! Você é uma máquina de estudar."
        ));
    }
    
    const experiencePoints = completedTopicsCount * 10 + uniqueStudyDays * 5; // XP system
    
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
const calculateUniqueStudyDays = (sessions) => {
    if (!sessions || sessions.length === 0) return 0;
    
    const uniqueDates = new Set();
    sessions.forEach(session => {
        if (session.status === 'Concluído' && session.session_date) {
            // Extract only date (YYYY-MM-DD) from session_date
            const date = session.session_date.split('T')[0];
            uniqueDates.add(date);
        }
    });
    
    return uniqueDates.size;
};

/**
 * Calculate current study streak
 */
const calculateStudyStreak = (sessions) => {
    if (!sessions || sessions.length === 0) return 0;
    
    // Get completed sessions sorted by date (most recent first)
    const completedSessions = sessions
        .filter(s => s.status === 'Concluído' && s.session_date)
        .sort((a, b) => new Date(b.session_date) - new Date(a.session_date));
        
    if (completedSessions.length === 0) return 0;
    
    // Get unique dates
    const uniqueDates = [...new Set(completedSessions.map(s => s.session_date.split('T')[0]))];
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
};



/**
 * Get completed sessions
 */
const getCompletedSessions = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    return await planRepository.getCompletedSessions(planId);
};

/**
 * Get user stats
 */
const getUserStats = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    // Get comprehensive user statistics
    const topics = await planRepository.getTopicsWithStatus(planId);
    const completedTopics = topics.filter(t => t.status === 'Concluído').length;
    const totalTopics = topics.length;
    
    return {
        totalXP: completedTopics * 100,
        completedTopics,
        totalTopics,
        achievements: [], // Placeholder for achievements system
        progressPercentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
    };
};

/**
 * Get question radar (weak points)
 */
const getQuestionRadar = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    return await planRepository.getWeakTopics(planId);
};

/**
 * Get overdue check
 */
const getOverdueCheck = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    return await planRepository.getOverdueTasks(planId);
};

/**
 * Get activity summary for a specific date
 */
const getActivitySummary = async (planId, userId, date) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    return await planRepository.getActivitySummaryByDate(planId, date || new Date().toISOString().split('T')[0]);
};

/**
 * Get plan subjects
 */
const getSubjects = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    return await planRepository.getSubjects(planId);
};

module.exports = {
    getSchedulePreview,
    getProgress,
    getDetailedProgress,
    getGoalProgress,
    getRealityCheck,
    getGamification,
    getCompletedSessions,
    getUserStats,
    getQuestionRadar,
    getOverdueCheck,
    getActivitySummary,
    getSubjects
};