/**
 * Plan Service - Business logic for study plans
 * 
 * This service contains all the complex business logic for plan management,
 * schedule calculations, progress tracking, and analytics.
 */

const planRepository = require('../repositories/planRepository');
const { sanitizeHtml } = require('../utils/sanitizer');
const { dbGet, dbAll } = require('../utils/database');

// CORREÇÃO: Função unificada para data brasileira
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
 * CORREÇÃO: Usar método unificado para contagem de tópicos concluídos
 */
const getProgress = async (planId, userId) => {
    const plan = await planRepository.getPlanByIdAndUser(planId, userId);
    if (!plan) {
        throw new Error('Plano não encontrado');
    }

    // CORREÇÃO: Usar contagem unificada via sessões concluídas (método confiável)
    const completedResult = await dbGet(`
        SELECT COUNT(DISTINCT topic_id) as count 
        FROM study_sessions 
        WHERE study_plan_id = ? AND session_type = 'Novo Tópico' AND status = 'Concluído' AND topic_id IS NOT NULL
    `, [planId]);
    
    const topics = await planRepository.getTopicsWithStatus(planId);
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

    // CORREÇÃO: Usar timezone brasileiro para cálculos de data
    const today = getBrazilianDateString();
    // CORREÇÃO: Calcular início da semana em timezone brasileiro
    const brazilDate = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
    const dayOfWeek = brazilDate.getDay();
    const weekStart = new Date(brazilDate);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
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
    const sessions = await dbAll('SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?', [planId]);
    const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
    const totalTopics = totalTopicsResult.total;

    if (totalTopics === 0) {
        return { message: 'Adicione tópicos ao seu plano para ver as projeções.' };
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
    const firstSessionDateResult = await dbGet('SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = \'Novo Tópico\' AND status = \'Concluído\'', [planId]);
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
        requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : 'N/A',
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
    const completedSessions = await planRepository.getCompletedSessions(planId);
    const uniqueStudyDays = calculateUniqueStudyDays(completedSessions);
    const currentStreak = calculateStudyStreak(completedSessions);
    
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
    const totalTimeResult = await dbGet(`
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
            WHERE ss.study_plan_id = ? 
                AND (ss.status = 'Concluído' OR ss.time_studied_seconds > 0)
            GROUP BY ss.id
        )
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