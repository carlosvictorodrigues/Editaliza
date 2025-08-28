/**
 * GAMIFICATION SERVICE - VERSÃO REFATORADA
 * 
 * Corrige os problemas de:
 * - Transações mal gerenciadas causando deadlocks
 * - FOR UPDATE em queries de leitura
 * - Timeouts de 15 segundos
 * 
 * Usa o padrão withTransaction para garantir atomicidade
 */

const { withTransaction, withReadOnlyTransaction, queryOne, queryMany } = require('../utils/database-transaction');

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
// FUNÇÕES PRINCIPAIS DO SERVIÇO - REFATORADAS
// ====================================================================

/**
 * Processa a conclusão de uma sessão usando transação adequada
 * CORRIGIDO: Usa withTransaction com client dedicado
 */
const processSessionCompletion = async (userId, sessionId) => {
    const startTime = Date.now();
    
    try {
        const result = await withTransaction(async (client) => {
            // 1. Verificar sessão (com lock para garantir consistência)
            const sessionResult = await client.query(
                `SELECT ss.* 
                 FROM study_sessions ss
                 JOIN study_plans sp ON ss.study_plan_id = sp.id
                 WHERE ss.id = $1 AND sp.user_id = $2
                 FOR UPDATE OF ss`,
                [sessionId, userId]
            );
            
            const session = sessionResult.rows[0];
            if (!session) {
                console.log(`[GAMIFICATION] Sessão ${sessionId} não encontrada para usuário ${userId}`);
                return null;
            }
            
            // 2. Buscar ou criar stats do usuário (UPSERT atômico)
            const statsResult = await client.query(
                `INSERT INTO user_gamification_stats (user_id, xp, level, current_streak, longest_streak)
                 VALUES ($1, 0, 1, 0, 0)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                 RETURNING *`,
                [userId]
            );
            
            let stats = statsResult.rows[0];
            
            // 3. Calcular XP ganho
            let xpGained = XP_REWARDS.SESSION_COMPLETED;
            
            if (session.session_type === 'Novo Tópico' && session.topic_id) {
                const prevCompletionsResult = await client.query(
                    `SELECT COUNT(*) as count 
                     FROM study_sessions 
                     WHERE topic_id = $1 AND status = 'Concluído' AND id != $2`,
                    [session.topic_id, sessionId]
                );
                
                if (prevCompletionsResult.rows[0].count === '0') {
                    xpGained += XP_REWARDS.UNIQUE_TOPIC_COMPLETED;
                }
                xpGained += XP_REWARDS.NEW_TOPIC_BONUS;
            }
            
            if (session.session_type && session.session_type.includes('Simulado')) {
                xpGained += XP_REWARDS.SIMULADO_BONUS;
            }
            
            // 4. Calcular estatísticas atualizadas
            const countsResult = await client.query(
                `SELECT 
                    (SELECT COUNT(DISTINCT topic_id) 
                     FROM study_sessions ss 
                     JOIN study_plans sp ON ss.study_plan_id = sp.id 
                     WHERE sp.user_id = $1 AND ss.status = 'Concluído' AND ss.topic_id IS NOT NULL) as completed_topics,
                    (SELECT COUNT(*) 
                     FROM study_sessions ss 
                     JOIN study_plans sp ON ss.study_plan_id = sp.id 
                     WHERE sp.user_id = $1 AND ss.status = 'Concluído') as completed_sessions`,
                [userId]
            );
            
            const counts = countsResult.rows[0];
            const completedTopics = parseInt(counts.completed_topics, 10) || 0;
            const completedSessions = parseInt(counts.completed_sessions, 10) || 0;
            
            // 5. Calcular novo streak
            const newStreak = await calculateCurrentStreakInTransaction(client, userId);
            const longestStreak = Math.max(stats.longest_streak || 0, newStreak);
            
            // 6. Calcular novo nível
            const newLevelData = calculateLevel(completedTopics);
            
            // 7. Atualizar stats do usuário (UPDATE atômico)
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
            
            // 8. Verificar e conceder conquistas
            await checkAndGrantAchievementsInTransaction(client, userId, {
                completedTopics,
                streak: newStreak,
                completedSessions
            });
            
            const processingTime = Date.now() - startTime;
            console.log(`[GAMIFICATION] Sessão ${sessionId} processada em ${processingTime}ms. XP +${xpGained}. Streak: ${newStreak} dias.`);
            
            return {
                xpGained,
                newLevel: newLevelData.level,
                newStreak,
                processingTime
            };
        });
        
        return result;
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[GAMIFICATION] Erro ao processar sessão ${sessionId} após ${processingTime}ms:`, error.message);
        
        // Se for timeout, logar especificamente
        if (error.code === '57014') {
            console.error('[GAMIFICATION] Timeout detectado - possível deadlock');
        }
        
        throw error;
    }
};

/**
 * Obtém o perfil de gamificação SEM LOCKS (somente leitura)
 * CORRIGIDO: Usa withReadOnlyTransaction sem FOR UPDATE
 */
const getGamificationProfile = async (userId) => {
    try {
        // Usar transação READ ONLY para evitar locks
        return await withReadOnlyTransaction(async (client) => {
            // 1. Buscar stats do usuário SEM LOCK
            const statsResult = await client.query(
                'SELECT * FROM user_gamification_stats WHERE user_id = $1',
                [userId]
            );
            
            if (statsResult.rows.length === 0) {
                // Retornar perfil padrão se não existir
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
            
            // 2. Contar tópicos completados
            const topicsResult = await client.query(
                `SELECT COUNT(DISTINCT ss.topic_id) as count
                 FROM study_sessions ss
                 JOIN study_plans sp ON ss.study_plan_id = sp.id
                 WHERE sp.user_id = $1 AND ss.status = 'Concluído' AND ss.topic_id IS NOT NULL`,
                [userId]
            );
            
            const completedTopics = parseInt(topicsResult.rows[0].count, 10) || 0;
            const levelInfo = calculateLevel(completedTopics);
            
            // 3. Buscar conquistas
            const achievementsResult = await client.query(
                'SELECT * FROM user_achievements WHERE user_id = $1 ORDER BY unlocked_at DESC',
                [userId]
            );
            
            return {
                ...stats,
                level_info: levelInfo,
                achievements: achievementsResult.rows
            };
        });
        
    } catch (error) {
        console.error('[GAMIFICATION] Erro ao buscar perfil:', error.message);
        
        // Retornar dados mínimos em caso de erro
        return {
            xp: 0,
            level: 1,
            current_streak: 0,
            longest_streak: 0,
            level_info: LEVELS[0],
            achievements: [],
            error: true
        };
    }
};

// ====================================================================
// FUNÇÕES AUXILIARES REFATORADAS
// ====================================================================

/**
 * Calcula streak dentro da transação (usa o client fornecido)
 */
async function calculateCurrentStreakInTransaction(client, userId) {
    const result = await client.query(
        `SELECT DISTINCT DATE(session_date) as session_date
         FROM study_sessions ss
         JOIN study_plans sp ON ss.study_plan_id = sp.id
         WHERE sp.user_id = $1 AND ss.status = 'Concluído'
         ORDER BY session_date DESC
         LIMIT 30`,
        [userId]
    );
    
    if (result.rows.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
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
 * Calcula o nível baseado em tópicos completados
 */
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
 * Verifica e concede conquistas dentro da transação
 */
async function checkAndGrantAchievementsInTransaction(client, userId, currentStats) {
    // Buscar conquistas já desbloqueadas
    const unlockedResult = await client.query(
        'SELECT achievement_id FROM user_achievements WHERE user_id = $1',
        [userId]
    );
    
    const unlockedIds = new Set(unlockedResult.rows.map(row => row.achievement_id));
    
    const checkCategory = async (category, value) => {
        for (const ach of ACHIEVEMENTS[category]) {
            if (value >= ach.threshold && !unlockedIds.has(ach.id)) {
                await client.query(
                    `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) 
                     VALUES ($1, $2, CURRENT_TIMESTAMP) 
                     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
                    [userId, ach.id]
                );
                
                console.log(`[GAMIFICATION] Conquista desbloqueada: ${ach.title} para usuário ${userId}`);
            }
        }
    };
    
    await checkCategory('TOPICS', currentStats.completedTopics);
    await checkCategory('STREAK', currentStats.streak);
    await checkCategory('SESSIONS', currentStats.completedSessions);
}

module.exports = {
    processSessionCompletion,
    getGamificationProfile,
    // Exportar também as definições para uso em outros lugares
    LEVELS,
    ACHIEVEMENTS,
    XP_REWARDS
};