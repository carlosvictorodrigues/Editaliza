/**
 * GAMIFICATION SERVICE - VERSÃO ENRIQUECIDA
 * 
 * Centraliza toda a lógica de gamificação do sistema, implementando as regras detalhadas
 * de níveis, XP, conquistas e elementos visuais, conforme especificado.
 */

const { dbGet, dbAll, dbRun, query } = require('../../database-postgres-direct');

// ====================================================================
// DEFINIÇÕES DO SISTEMA DE GAMIFICAÇÃO
// ====================================================================

const XP_REWARDS = {
    SESSION_COMPLETED: 10,
    UNIQUE_TOPIC_COMPLETED: 50,
    NEW_TOPIC_BONUS: 40,
    SIMULADO_BONUS: 20
};

const LEVELS = [
    { threshold: 0, title: 'Aspirante a Servidor(a) 🌱', humorous_title: 'Pagador de Inscrição 💸', color: '#8B8B8B', phrase: 'A jornada dos mil editais começa com o primeiro boleto!' },
    { threshold: 11, title: 'Sobrevivente do Primeiro PDF 📄', humorous_title: 'Pagador(a) de Inscrição 💸', color: '#A0A0A0', phrase: '700 páginas? É só o aquecimento!' },
    { threshold: 31, title: 'Caçador de Questões 🎯', humorous_title: 'Acima da Nota de Corte (nos simulados) 😉', color: '#4A90E2', phrase: 'Questões anuladas são suas melhores amigas agora!' },
    { threshold: 51, title: 'Estrategista de Chute 🎲', humorous_title: 'Mestre dos Grupos de WhatsApp 📲', color: '#6B46C1', phrase: 'Entre A e C, sempre vai na B... ou não!' },
    { threshold: 101, title: 'Fiscal de Gabarito 🔍', humorous_title: 'Gabaritador(a) da FGV 🎯', color: '#10B981', phrase: 'Súmula vinculante é seu segundo nome!' },
    { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹', humorous_title: 'Sensei dos Simulados 🥋', color: '#F59E0B', phrase: 'Simulado no domingo de manhã? Rotina!' },
    { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎', humorous_title: 'Quase Servidor(a) 🎓', color: '#DC2626', phrase: 'A posse está logo ali... ou no próximo concurso!' },
    { threshold: 501, title: 'Lenda Viva dos Concursos 👑', humorous_title: 'Assinante Vitalício do Diário Oficial ✨', color: '#FFD700', phrase: 'Editais tremem quando você abre o navegador!' }
];

const ACHIEVEMENTS = {
    TOPICS: [
        { id: 'topics_1', threshold: 1, title: '🎯 Primeira Lapada no Edital', description: 'O primeiro soco na cara da procrastinação!' },
        { id: 'topics_5', threshold: 5, title: '📚 Maratonista do PDF', description: 'Sua vista já começou a reclamar.' },
        { id: 'topics_10', threshold: 10, title: '✨ Destruidor de Questões', description: 'Já discute gabarito com confiança.' },
        { id: 'topics_25', threshold: 25, title: '👑 Dono do Material', description: 'Sabe até a cor da caneta que o professor usou no slide.' },
        { id: 'topics_50', threshold: 50, title: '🌟 Meio Monstro', description: 'Você está virando uma lenda local no grupo de estudos.' },
        { id: 'topics_100', threshold: 100, title: '🏛️ Centurião do Conhecimento', description: 'Bancas já estão te bloqueando no Instagram.' },
        { id: 'topics_200', threshold: 200, title: '💪 Chuck Norris dos Editais', description: 'Os editais temem você!' },
        { id: 'topics_500', threshold: 500, title: '🧠 Cérebro Jurídico Supremo', description: 'Conquista épica para os mais dedicados.' }
    ],
    STREAK: [
        { id: 'streak_3', threshold: 3, title: '📺 Resistente ao Netflix', description: '3 dias seguidos! Resistiu à série nova!' },
        { id: 'streak_7', threshold: 7, title: '🛋️ Imune ao Sofá', description: '7 dias! O sofá esqueceu sua forma!' },
        { id: 'streak_14', threshold: 14, title: '😤 Inimigo do Descanso', description: '14 dias! Descanso? Não conheço!' },
        { id: 'streak_30', threshold: 30, title: '🤖 Máquina de Aprovar', description: '1 mês sem parar! Você é uma máquina!' }
    ],
    SESSIONS: [
        { id: 'sessions_20', threshold: 20, title: '💊 Viciado(a) em Questões', description: 'Questões são sua droga legal!' },
        { id: 'sessions_50', threshold: 50, title: '🪑 Lombar Suprema', description: 'Já fez mais fisioterapia que simulados.' },
        { id: 'sessions_100', threshold: 100, title: '👑 Rei/Rainha do Resumo', description: '100 sessões! Domina a arte do estudo.' }
    ]
};

// ====================================================================
// FUNÇÕES PRINCIPAIS DO SERVIÇO
// ====================================================================

/**
 * Processa a conclusão de uma sessão, o coração do sistema de gamificação.
 */
const processSessionCompletion = async (userId, sessionId) => {
    try {
        // Iniciar transação corretamente
        await query('BEGIN');
        
        const session = await dbGet('SELECT ss.* FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = $1 AND sp.user_id = $2', [sessionId, userId]);
        if (!session) {
            await query('ROLLBACK');
            return;
        }

        let stats = await dbGet('SELECT * FROM user_gamification_stats WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!stats) {
            await dbRun('INSERT INTO user_gamification_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
            stats = await dbGet('SELECT * FROM user_gamification_stats WHERE user_id = $1', [userId]);
        }

        // 1. Cálculo de XP
        let xpGained = XP_REWARDS.SESSION_COMPLETED;
        if (session.session_type === 'Novo Tópico' && session.topic_id) {
            const previousCompletions = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE topic_id = $1 AND status = \'Concluído\' AND id != $2', [session.topic_id, sessionId]);
            if (previousCompletions.count === 0) {
                xpGained += XP_REWARDS.UNIQUE_TOPIC_COMPLETED;
            }
            xpGained += XP_REWARDS.NEW_TOPIC_BONUS;
        }
        if (session.session_type.includes('Simulado')) {
            xpGained += XP_REWARDS.SIMULADO_BONUS;
        }

        // 2. Otimização: Buscar todas as contagens em uma única query
        const countsQuery = `
            SELECT 
                (SELECT COUNT(DISTINCT topic_id) FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE sp.user_id = $1 AND ss.status = 'Concluído' AND ss.topic_id IS NOT NULL) as completed_topics,
                (SELECT COUNT(*) FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE sp.user_id = $1 AND ss.status = 'Concluído') as completed_sessions;
        `;
        const counts = await dbGet(countsQuery, [userId]);
        const completedTopics = parseInt(counts.completed_topics, 10) || 0;
        const completedSessionsCount = parseInt(counts.completed_sessions, 10) || 0;

        // 3. Atualizar Streak e Nível
        const newStreak = await calculateCurrentStreak(userId);
        const longestStreak = Math.max(stats.longest_streak, newStreak);
        const newLevelData = calculateLevel(completedTopics);

        // 4. Salvar Estatísticas
        await dbRun(
            `UPDATE user_gamification_stats 
            SET xp = xp + $1, level = $2, current_streak = $3, longest_streak = $4, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5`,
            [xpGained, newLevelData.level, newStreak, longestStreak, userId]
        );

        // 5. Verificar e Conceder Conquistas (com contagens já buscadas)
        await checkAndGrantAchievements(userId, { 
            completedTopics: completedTopics,
            streak: newStreak,
            completedSessions: completedSessionsCount
        });

        await query('COMMIT'); // Finaliza a transação com sucesso
        console.log(`[GAMIFICATION] Sessão ${sessionId} processada para usuário ${userId}. XP +${xpGained}. Streak: ${newStreak} dias.`);

    } catch (error) {
        await query('ROLLBACK'); // Desfaz a transação em caso de erro
        console.error(`[GAMIFICATION] Erro ao processar sessão ${sessionId} (transação revertida):`, error);
    }
};


/**
 * Obtém o perfil completo de gamificação do usuário.
 */
const getGamificationProfile = async (userId) => {
    const stats = await dbGet('SELECT * FROM user_gamification_stats WHERE user_id = $1', [userId]);
    if (!stats) {
        return { xp: 0, level: 1, current_streak: 0, longest_streak: 0, level_info: LEVELS[0], achievements: [] };
    }

    const completedTopics = await countUniqueCompletedTopics(userId);
    const levelInfo = calculateLevel(completedTopics);
    const achievements = await dbAll('SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC', [userId]);

    return { ...stats, level_info: levelInfo, achievements };
};

// ====================================================================
// FUNÇÕES AUXILIARES
// ====================================================================

async function countUniqueCompletedTopics(userId) {
    const result = await dbGet(
        `SELECT COUNT(DISTINCT ss.topic_id) as count
        FROM study_sessions ss
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE sp.user_id = $1 AND ss.status = 'Concluído' AND ss.topic_id IS NOT NULL`,
        [userId]
    );
    return result?.count || 0;
}

async function calculateCurrentStreak(userId) {
    const completedSessions = await dbAll(
        `SELECT DISTINCT ss.session_date 
        FROM study_sessions ss
        JOIN study_plans sp ON ss.study_plan_id = sp.id
        WHERE sp.user_id = $1 AND ss.status = 'Concluído'
        ORDER BY ss.session_date DESC`,
        [userId]
    );
    
    if (completedSessions.length === 0) return 0;

    let streak = 0;
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    today.setHours(0, 0, 0, 0);

    const lastStudyDate = new Date(completedSessions[0].session_date);
    lastStudyDate.setHours(0,0,0,0);

    const diffDays = (today - lastStudyDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
        streak = 1;
        for (let i = 0; i < completedSessions.length - 1; i++) {
            const currentDate = new Date(completedSessions[i].session_date);
            const nextDate = new Date(completedSessions[i+1].session_date);
            if ((currentDate - nextDate) / (1000 * 60 * 60 * 24) === 1) {
                streak++;
            } else {
                break;
            }
        }
    }
    return streak;
}

function calculateLevel(completedTopicsCount) {
    let currentLevel = LEVELS[0];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (completedTopicsCount >= LEVELS[i].threshold) {
            currentLevel = { ...LEVELS[i], level: i + 1 };
            break;
        }
    }
    return currentLevel;
}

async function checkAndGrantAchievements(userId, currentStats) {
    const unlockedAchievements = await dbAll('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]);
    const unlockedIds = new Set(unlockedAchievements.map(a => a.achievement_id));

    const checkCategory = async (category, value) => {
        for (const ach of ACHIEVEMENTS[category]) {
            if (value >= ach.threshold && !unlockedIds.has(ach.id)) {
                // Usar ON CONFLICT para evitar erros de inserção duplicada em cenários de alta concorrência
                await dbRun(
                    'INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id, achievement_id) DO NOTHING',
                    [userId, ach.id]
                );
                console.log(`[GAMIFICATION] Conquista: ${ach.title} para user ${userId}`);
            }
        }
    };

    // Usar as contagens já calculadas e passadas via currentStats
    await checkCategory('TOPICS', currentStats.completedTopics);
    await checkCategory('STREAK', currentStats.streak);
    await checkCategory('SESSIONS', currentStats.completedSessions);
}


module.exports = {
    processSessionCompletion,
    getGamificationProfile
};
