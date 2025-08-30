/**
 * GAMIFICATION SERVICE - VERSÃO ENRIQUECIDA COM CORREÇÃO DE TRANSAÇÕES
 * 
 * Centraliza toda a lógica de gamificação do sistema, implementando as regras detalhadas
 * de níveis, XP, conquistas e elementos visuais, conforme especificado.
 * 
 * CORREÇÃO APLICADA: Usando pool.connect() para transações com client dedicado
 */

const { pool } = require('../../database-postgres-direct');

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
 * CORRIGIDO: Usa client dedicado para toda a transação
 */
const processSessionCompletion = async (userId, sessionId) => {
    const startTime = Date.now();
    let client;
    
    try {
        // CORREÇÃO: Usar client dedicado para toda a transação
        client = await pool.connect();
        
        // Configurar timeouts para evitar travamentos
        await client.query("SET LOCAL lock_timeout = '3s'");
        await client.query("SET LOCAL statement_timeout = '8s'");
        
        // Iniciar transação
        await client.query('BEGIN');
        
        // Buscar sessão COM LOCK para garantir consistência
        const sessionResult = await client.query(
            `SELECT ss.* FROM study_sessions ss 
             JOIN study_plans sp ON ss.study_plan_id = sp.id 
             WHERE ss.id = $1 AND sp.user_id = $2
             FOR UPDATE OF ss`,
            [sessionId, userId]
        );
        
        const session = sessionResult.rows[0];
        if (!session) {
            await client.query('ROLLBACK');
            console.log(`[GAMIFICATION] Sessão ${sessionId} não encontrada para usuário ${userId}`);
            return;
        }

        // Buscar ou criar stats do usuário (UPSERT atômico)
        const statsResult = await client.query(
            `INSERT INTO user_gamification_stats (user_id, xp, level, current_streak, longest_streak)
             VALUES ($1, 0, 1, 0, 0)
             ON CONFLICT (user_id) 
             DO UPDATE SET updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId]
        );
        
        let stats = statsResult.rows[0];

        // 1. Cálculo de XP (mantendo toda a lógica original)
        let xpGained = XP_REWARDS.SESSION_COMPLETED;
        
        if (session.session_type === 'Novo Tópico' && session.topic_id) {
            const prevCompResult = await client.query(
                'SELECT COUNT(*) as count FROM study_sessions WHERE topic_id = $1 AND status = $2 AND id != $3',
                [session.topic_id, 'Concluído', sessionId]
            );
            
            if (prevCompResult.rows[0].count === '0') {
                xpGained += XP_REWARDS.UNIQUE_TOPIC_COMPLETED;
            }
            xpGained += XP_REWARDS.NEW_TOPIC_BONUS;
        }
        
        if (session.session_type && session.session_type.includes('Simulado')) {
            xpGained += XP_REWARDS.SIMULADO_BONUS;
        }

        // 2. Buscar todas as contagens em uma única query (otimização mantida)
        const countsResult = await client.query(
            `SELECT 
                (SELECT COUNT(DISTINCT topic_id) 
                 FROM study_sessions ss 
                 JOIN study_plans sp ON ss.study_plan_id = sp.id 
                 WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida') AND ss.topic_id IS NOT NULL) as completed_topics,
                (SELECT COUNT(*) 
                 FROM study_sessions ss 
                 JOIN study_plans sp ON ss.study_plan_id = sp.id 
                 WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida')) as completed_sessions`,
            [userId]
        );
        
        const counts = countsResult.rows[0];
        const completedTopics = parseInt(counts.completed_topics, 10) || 0;
        const completedSessionsCount = parseInt(counts.completed_sessions, 10) || 0;

        // 3. Calcular Streak (usando o client da transação)
        const newStreak = await calculateCurrentStreakWithClient(client, userId);
        const longestStreak = Math.max(stats.longest_streak || 0, newStreak);
        
        // Calcular nível
        const newLevelData = calculateLevel(completedTopics);

        // 4. Salvar Estatísticas (UPDATE atômico)
        await client.query(
            `UPDATE user_gamification_stats 
             SET xp = xp + $1, 
                 level = $2, 
                 current_streak = $3, 
                 longest_streak = $4, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $5`,
            [xpGained, newLevelData.level, newStreak, longestStreak, userId]
        );

        // 5. Verificar e Conceder Conquistas (usando client da transação)
        await checkAndGrantAchievementsWithClient(client, userId, { 
            completedTopics: completedTopics,
            streak: newStreak,
            completedSessions: completedSessionsCount
        });

        // Commit da transação
        await client.query('COMMIT');
        
        const processingTime = Date.now() - startTime;
        console.log(`[GAMIFICATION] Sessão ${sessionId} processada em ${processingTime}ms. XP +${xpGained}. Streak: ${newStreak} dias.`);

    } catch (error) {
        // Rollback em caso de erro
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('[GAMIFICATION] Erro ao fazer rollback:', rollbackError);
            }
        }
        
        const processingTime = Date.now() - startTime;
        console.error(`[GAMIFICATION] Erro ao processar sessão ${sessionId} após ${processingTime}ms:`, error.message);
        
        // Log específico para timeout
        if (error.code === '57014') {
            console.error('[GAMIFICATION] Timeout detectado - possível deadlock');
        }
        
    } finally {
        // SEMPRE liberar o client
        if (client) {
            client.release();
        }
    }
};

/**
 * Obtém o perfil completo de gamificação do usuário.
 * CORRIGIDO: Sem transação desnecessária para leitura simples
 */
const getGamificationProfile = async (userId) => {
    let client;
    const queryTimings = {};
    
    try {
        console.log('[GAMI SERVICE] getGamificationProfile: Iniciando para userId', userId);
        const startConnection = Date.now();
        
        // Usar client dedicado mas SEM transação
        client = await pool.connect();
        queryTimings.connection = Date.now() - startConnection;
        console.log(`[GAMI SERVICE] getGamificationProfile: Cliente do pool conectado em ${queryTimings.connection}ms`);
        
        // Configurar timeouts por segurança
        const startTimeouts = Date.now();
        await client.query("SET LOCAL statement_timeout = 5000"); // 5s max
        await client.query("SET LOCAL lock_timeout = 1000"); // 1s para locks
        queryTimings.timeouts = Date.now() - startTimeouts;
        console.log(`[GAMI SERVICE] getGamificationProfile: Timeouts configurados em ${queryTimings.timeouts}ms`);
        
        // Buscar stats SEM transação, SEM locks
        console.log('[GAMI SERVICE] getGamificationProfile: Executando query user_gamification_stats...');
        const startStats = Date.now();
        const statsResult = await client.query(
            'SELECT * FROM user_gamification_stats WHERE user_id = $1',
            [userId]
        );
        queryTimings.stats = Date.now() - startStats;
        console.log(`[GAMI SERVICE] getGamificationProfile: Query user_gamification_stats concluída em ${queryTimings.stats}ms`);
        
        if (statsResult.rows.length === 0) {
            console.log('[GAMI SERVICE] getGamificationProfile: user_gamification_stats não encontrado, retornando padrão.');
            console.log('[GAMI SERVICE] Timings:', queryTimings);
            return { 
                xp: 0, 
                level: 1, 
                current_streak: 0, 
                longest_streak: 0, 
                level_info: LEVELS[0], 
                achievements: [] 
            };
        }
        
        const stats = statsResult.rows[0];
        
        // Contar tópicos completados - query otimizada
        console.log('[GAMI SERVICE] getGamificationProfile: Executando query completed topics...');
        const startTopics = Date.now();
        const topicsResult = await client.query(
            `SELECT COUNT(DISTINCT ss.topic_id) as count
             FROM study_sessions ss
             JOIN study_plans sp ON ss.study_plan_id = sp.id
             WHERE sp.user_id = $1 
               AND ss.status IN ('Concluído', 'Concluída', 'Concluida') 
               AND ss.topic_id IS NOT NULL`,
            [userId]
        );
        queryTimings.topics = Date.now() - startTopics;
        console.log(`[GAMI SERVICE] getGamificationProfile: Query completed topics concluída em ${queryTimings.topics}ms`);
        
        const completedTopics = parseInt(topicsResult.rows[0].count, 10) || 0;
        const levelInfo = calculateLevel(completedTopics);
        
        // Buscar conquistas - sem lock, sem transação
        console.log('[GAMI SERVICE] getGamificationProfile: Executando query achievements...');
        const startAchievements = Date.now();
        const achievementsResult = await client.query(
            'SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC LIMIT 100',
            [userId]
        );
        queryTimings.achievements = Date.now() - startAchievements;
        console.log(`[GAMI SERVICE] getGamificationProfile: Query achievements concluída em ${queryTimings.achievements}ms`);
        
        queryTimings.total = Object.values(queryTimings).reduce((a, b) => a + b, 0);
        console.log('[GAMI SERVICE] getGamificationProfile: Retornando perfil de gamificação.');
        console.log('[GAMI SERVICE] Timings completos:', queryTimings);
        
        return { 
            ...stats, 
            level_info: levelInfo, 
            achievements: achievementsResult.rows 
        };
        
    } catch (error) {
        console.error('[GAMI SERVICE] Erro ao buscar perfil:', error.message);
        console.error('[GAMI SERVICE] Stack:', error.stack);
        console.error('[GAMI SERVICE] Código do erro:', error.code);
        console.error('[GAMI SERVICE] Timings até o erro:', queryTimings);
        
        // Retornar dados mínimos em caso de erro
        return { 
            xp: 0, 
            level: 1, 
            current_streak: 0, 
            longest_streak: 0, 
            level_info: LEVELS[0], 
            achievements: [],
            error: true,
            errorMessage: error.message,
            errorCode: error.code
        };
        
    } finally {
        if (client) {
            const startRelease = Date.now();
            client.release();
            console.log(`[GAMI SERVICE] getGamificationProfile: Cliente do pool liberado em ${Date.now() - startRelease}ms`);
        }
    }
};

// ====================================================================
// FUNÇÕES AUXILIARES
// ====================================================================

/**
 * Calcula streak usando o client da transação
 */
async function calculateCurrentStreakWithClient(client, userId) {
    const result = await client.query(
        `SELECT DISTINCT session_date::date as session_date
         FROM study_sessions ss
         JOIN study_plans sp ON ss.study_plan_id = sp.id
         WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida')
         ORDER BY session_date DESC
         LIMIT 30`,
        [userId]
    );
    
    if (result.rows.length === 0) return 0;

    let streak = 0;
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    today.setHours(0, 0, 0, 0);

    const lastStudyDate = new Date(result.rows[0].session_date);
    lastStudyDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - lastStudyDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
        streak = 1;
        for (let i = 0; i < result.rows.length - 1; i++) {
            const currentDate = new Date(result.rows[i].session_date);
            const nextDate = new Date(result.rows[i + 1].session_date);
            const daysBetween = Math.floor((currentDate - nextDate) / (1000 * 60 * 60 * 24));
            
            if (daysBetween === 1) {
                streak++;
            } else {
                break;
            }
        }
    }
    return streak;
}

/**
 * Função auxiliar para countUniqueCompletedTopics (mantida para compatibilidade)
 */
async function countUniqueCompletedTopics(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT COUNT(DISTINCT ss.topic_id) as count
             FROM study_sessions ss
             JOIN study_plans sp ON ss.study_plan_id = sp.id
             WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida') AND ss.topic_id IS NOT NULL`,
            [userId]
        );
        return parseInt(result.rows[0]?.count, 10) || 0;
    } finally {
        client.release();
    }
}

/**
 * Função auxiliar para calculateCurrentStreak (mantida para compatibilidade)
 */
async function calculateCurrentStreak(userId) {
    const client = await pool.connect();
    try {
        return await calculateCurrentStreakWithClient(client, userId);
    } finally {
        client.release();
    }
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

/**
 * Verifica e concede conquistas usando o client da transação
 */
async function checkAndGrantAchievementsWithClient(client, userId, currentStats) {
    // Buscar conquistas já desbloqueadas
    const unlockedResult = await client.query(
        'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
        [userId]
    );
    
    const unlockedIds = new Set(unlockedResult.rows.map(a => a.achievement_id));

    const checkCategory = async (category, value) => {
        for (const ach of ACHIEVEMENTS[category]) {
            if (value >= ach.threshold && !unlockedIds.has(ach.id)) {
                // Usar ON CONFLICT para evitar erros de inserção duplicada
                await client.query(
                    `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) 
                     VALUES ($1, $2, CURRENT_TIMESTAMP) 
                     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
                    [userId, ach.id]
                );
                console.log(`[GAMIFICATION] Conquista: ${ach.title} para user ${userId}`);
            }
        }
    };

    // Usar as contagens já calculadas
    await checkCategory('TOPICS', currentStats.completedTopics);
    await checkCategory('STREAK', currentStats.streak);
    await checkCategory('SESSIONS', currentStats.completedSessions);
}

/**
 * Função auxiliar para checkAndGrantAchievements (mantida para compatibilidade)
 */
async function checkAndGrantAchievements(userId, currentStats) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await checkAndGrantAchievementsWithClient(client, userId, currentStats);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get user statistics for gamification display
 */
const getUserStats = async (userId) => {
    let client;
    try {
        client = await pool.connect();
        
        // Get gamification stats
        const statsResult = await client.query(
            'SELECT * FROM user_gamification_stats WHERE user_id = $1',
            [userId]
        );
        
        if (statsResult.rows.length === 0) {
            return {
                xp: 0,
                level: 1,
                current_streak: 0,
                longest_streak: 0,
                total_study_time: 0,
                completed_sessions: 0,
                completed_topics: 0
            };
        }
        
        const stats = statsResult.rows[0];
        
        // Get additional counters
        const countsResult = await client.query(
            `SELECT 
                (SELECT COUNT(DISTINCT topic_id) 
                 FROM study_sessions ss 
                 JOIN study_plans sp ON ss.study_plan_id = sp.id 
                 WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida') AND ss.topic_id IS NOT NULL) as completed_topics,
                (SELECT COUNT(*) 
                 FROM study_sessions ss 
                 JOIN study_plans sp ON ss.study_plan_id = sp.id 
                 WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida')) as completed_sessions,
                (SELECT SUM(COALESCE(time_studied_seconds, 0)) 
                 FROM study_sessions ss 
                 JOIN study_plans sp ON ss.study_plan_id = sp.id 
                 WHERE sp.user_id = $1 AND ss.status IN ('Concluído', 'Concluída', 'Concluida')) as total_study_time`,
            [userId]
        );
        
        const counts = countsResult.rows[0];
        const levelInfo = calculateLevel(parseInt(counts.completed_topics, 10) || 0);
        
        return {
            ...stats,
            level_info: levelInfo,
            completed_topics: parseInt(counts.completed_topics, 10) || 0,
            completed_sessions: parseInt(counts.completed_sessions, 10) || 0,
            total_study_time: parseInt(counts.total_study_time, 10) || 0
        };
        
    } finally {
        if (client) client.release();
    }
};

/**
 * Get user progress data
 */
const getUserProgress = async (userId) => {
    let client;
    try {
        client = await pool.connect();
        
        // Get active plans for the user
        const plansResult = await client.query(
            'SELECT id, plan_name FROM study_plans WHERE user_id = $1',
            [userId]
        );
        
        if (plansResult.rows.length === 0) {
            return {
                plans: [],
                overall_completion: 0,
                total_sessions: 0,
                completed_sessions: 0
            };
        }
        
        const plans = [];
        let totalSessions = 0;
        let completedSessions = 0;
        
        for (const plan of plansResult.rows) {
            const sessionCountResult = await client.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('Concluído', 'Concluída', 'Concluida') THEN 1 ELSE 0 END) as completed
                 FROM study_sessions 
                 WHERE study_plan_id = $1`,
                [plan.id]
            );
            
            const counts = sessionCountResult.rows[0];
            const planTotal = parseInt(counts.total, 10) || 0;
            const planCompleted = parseInt(counts.completed, 10) || 0;
            
            totalSessions += planTotal;
            completedSessions += planCompleted;
            
            plans.push({
                id: plan.id,
                name: plan.plan_name,
                total_sessions: planTotal,
                completed_sessions: planCompleted,
                completion_percentage: planTotal > 0 ? Math.round((planCompleted / planTotal) * 100) : 0
            });
        }
        
        return {
            plans,
            overall_completion: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
            total_sessions: totalSessions,
            completed_sessions: completedSessions
        };
        
    } finally {
        if (client) client.release();
    }
};

/**
 * Get user achievements
 */
const getUserAchievements = async (userId) => {
    let client;
    try {
        client = await pool.connect();
        
        const achievementsResult = await client.query(
            'SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC',
            [userId]
        );
        
        return {
            achievements: achievementsResult.rows,
            total_count: achievementsResult.rows.length
        };
        
    } finally {
        if (client) client.release();
    }
};

/**
 * Get general statistics
 */
const getGeneralStatistics = async (userId) => {
    let client;
    try {
        client = await pool.connect();
        
        // Get various statistics
        const statsResult = await client.query(
            `SELECT 
                COUNT(DISTINCT sp.id) as total_plans,
                COUNT(DISTINCT DATE(ss.session_date)) as unique_study_days,
                AVG(CASE WHEN ss.status IN ('Concluído', 'Concluída', 'Concluida') THEN ss.time_studied_seconds ELSE NULL END) as avg_session_time
             FROM study_plans sp
             LEFT JOIN study_sessions ss ON sp.id = ss.study_plan_id
             WHERE sp.user_id = $1`,
            [userId]
        );
        
        const result = statsResult.rows[0];
        
        return {
            total_plans: parseInt(result.total_plans, 10) || 0,
            unique_study_days: parseInt(result.unique_study_days, 10) || 0,
            avg_session_time: parseInt(result.avg_session_time, 10) || 0
        };
        
    } finally {
        if (client) client.release();
    }
};

module.exports = {
    processSessionCompletion,
    getGamificationProfile,
    getUserStats,
    getUserProgress,
    getUserAchievements,
    getGeneralStatistics,
    // Exportar também as definições para uso em outros lugares
    LEVELS,
    ACHIEVEMENTS,
    XP_REWARDS
};