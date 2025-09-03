/**
 * GAMIFICATION CONTROLLER
 * 
 * Controla todas as funcionalidades de gamificação do sistema:
 * - Cálculo de XP (Experience Points)
 * - Sistema de níveis e progressão
 * - Desbloqueio de conquistas (achievements)
 * - Sistema de streaks (sequências de estudo)
 * - Tracking de progresso gamificado
 * 
 * IMPORTANTE: Toda a lógica centralizada no gamificationService.js
 */

const { dbGet, dbAll, dbRun } = require('../config/database');
const gamificationService = require('../services/gamificationService');

// Importar funções e constantes do serviço para centralizar a lógica
const { 
    generateAchievementsFromMetrics, 
    calculateUserLevelForController, 
    calculateCurrentStreak,
    LEVELS,
    ACHIEVEMENTS 
} = gamificationService;

// Função utilitária para data brasileira
function getBrazilianDateString() {
    const now = new Date();
    const brazilOffset = -3;
    const localOffset = now.getTimezoneOffset() / 60;
    const totalOffset = brazilOffset - localOffset;
    const adjustedDate = new Date(now.getTime() + totalOffset * 60 * 60 * 1000);
    return adjustedDate.toISOString().split('T')[0];
}

/**
 * CONTROLLER PRINCIPAL: Obtém todos os dados de gamificação de um plano
 * Refatorado para usar o serviço centralizado
 */
async function getPlanGamification(req, res) {
    const planId = req.params.planId;
    const userId = req.user.id;

    try {
        // Verificar se o plano pertence ao usuário
        const plan = await dbGet('SELECT id FROM study_plans WHERE id = $1 AND user_id = $2', [planId, userId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
        }

        // 1. CONTAR TÓPICOS ÚNICOS CONCLUÍDOS
        const completedTopicsResult = await dbGet(`
            SELECT COUNT(DISTINCT topic_id) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 
            AND status IN ('Concluído', 'Concluída', 'Concluida') 
            AND topic_id IS NOT NULL
        `, [planId]);
        const completedTopicsCount = parseInt(completedTopicsResult?.count || 0);
        
        console.log(`[GAMIFICATION DEBUG] Plan ${planId}:`, {
            completedTopicsCount,
            queryResult: completedTopicsResult
        });

        // 2. CONTAR SESSÕES CONCLUÍDAS PARA CALCULAR NÍVEL
        const completedSessionsResult = await dbGet(`
            SELECT COUNT(*) as count
            FROM study_sessions
            WHERE study_plan_id = $1
            AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const completedSessionsCount = parseInt(completedSessionsResult?.count || 0);
        
        // 2. CALCULAR NÍVEL E PROGRESSÃO (agora baseado em SESSÕES)
        const levelData = calculateUserLevelForController(completedSessionsCount);

        // 3. CALCULAR STREAK DE ESTUDOS (usando serviço centralizado)
        const studyStreak = await calculateCurrentStreak(userId);
        
        // 4. DADOS DE PROGRESSO DO DIA
        const todayStr = getBrazilianDateString();
        const todayTasksResult = await dbGet(`
            SELECT 
                COUNT(id) as total, 
                SUM(CASE WHEN status IN ('Concluído', 'Concluída', 'Concluida') THEN 1 ELSE 0 END) as completed 
            FROM study_sessions 
            WHERE study_plan_id = $1 AND session_date = $2
        `, [planId, todayStr]);

        // 5. CALCULAR EXPERIÊNCIA TOTAL
        const allCompletedSessionsResult = await dbGet(`
            SELECT COUNT(*) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const totalCompletedSessions = parseInt(allCompletedSessionsResult?.count || 0);
        
        console.log(`[GAMIFICATION DEBUG] Total sessions:`, {
            totalCompletedSessions,
            queryResult: allCompletedSessionsResult
        });
        
        // XP CALCULATION: 10 XP por sessão + 50 XP por tópico novo
        const experiencePoints = (totalCompletedSessions * 10) + (completedTopicsCount * 50);
        
        // 6. GERAR CONQUISTAS (usando serviço centralizado)
        const achievements = generateAchievementsFromMetrics(completedTopicsCount, totalCompletedSessions, studyStreak);
        
        console.log(`[GAMIFICATION DEBUG] Achievements calculados:`, {
            count: achievements.length,
            totalSessions: totalCompletedSessions,
            streak: studyStreak
        });
        
        // 7. ESTATÍSTICAS ADICIONAIS
        const uniqueStudyDaysResult = await dbGet(`
            SELECT COUNT(DISTINCT session_date) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const totalStudyDays = uniqueStudyDaysResult.count || 0;

        const totalStudyTimeResult = await dbGet(`
            SELECT SUM(COALESCE(time_studied_seconds, 0)) as total_time
            FROM study_sessions 
            WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const totalStudyTime = totalStudyTimeResult.total_time || 0;
        
        console.log(`📊 Endpoint gamificação - Plano ${planId}: tempo total = ${totalStudyTime} segundos`);

        // RESPOSTA FINAL
        res.json({
            completedTopicsCount,
            concurseiroLevel: levelData.currentLevel,
            nextLevel: levelData.nextLevel,
            topicsToNextLevel: levelData.topicsToNextLevel || levelData.sessionsToNextLevel,  // Mantém compatibilidade
            sessionsToNextLevel: levelData.sessionsToNextLevel,
            studyStreak,
            completedTodayCount: todayTasksResult.completed || 0,
            totalTodayCount: todayTasksResult.total || 0,
            experiencePoints,
            achievements,
            totalStudyDays,
            totalStudyTime,
            totalCompletedSessions
        });
        
    } catch (error) {
        console.error('Erro ao obter gamificação:', error);
        res.status(500).json({ error: 'Erro ao carregar dados de gamificação.' });
    }
}

/**
 * Nova rota: Obter perfil completo de gamificação do usuário
 * Usa diretamente o serviço
 */
async function getGamificationProfile(req, res) {
    try {
        const userId = req.user.id;
        const profile = await gamificationService.getGamificationProfile(userId);
        res.json(profile);
    } catch (error) {
        console.error('Erro ao obter perfil de gamificação:', error);
        res.status(500).json({ error: 'Erro ao carregar perfil de gamificação' });
    }
}

/**
 * Nova rota: Obter estatísticas do usuário
 * Usa diretamente o serviço
 */
async function getUserStats(req, res) {
    try {
        const userId = req.user.id;
        const stats = await gamificationService.getUserStats(userId);
        res.json(stats);
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
}

/**
 * Nova rota: Obter conquistas do usuário
 * Usa diretamente o serviço
 */
async function getUserAchievements(req, res) {
    try {
        const userId = req.user.id;
        const achievements = await gamificationService.getUserAchievements(userId);
        res.json(achievements);
    } catch (error) {
        console.error('Erro ao obter conquistas:', error);
        res.status(500).json({ error: 'Erro ao carregar conquistas' });
    }
}

/**
 * Nova rota: Obter progresso de hoje
 * Usa diretamente o serviço
 */
async function getUserProgress(req, res) {
    try {
        const userId = req.user.id;
        const progress = await gamificationService.getUserProgress(userId);
        res.json(progress);
    } catch (error) {
        console.error('Erro ao obter progresso:', error);
        res.status(500).json({ error: 'Erro ao carregar progresso' });
    }
}

/**
 * Nova rota: Obter estatísticas gerais
 * Usa diretamente o serviço
 */
async function getGeneralStatistics(req, res) {
    try {
        const userId = req.user.id;
        const stats = await gamificationService.getGeneralStatistics(userId);
        res.json(stats);
    } catch (error) {
        console.error('Erro ao obter estatísticas gerais:', error);
        res.status(500).json({ error: 'Erro ao carregar estatísticas gerais' });
    }
}

module.exports = {
    getPlanGamification,
    getGamificationProfile,
    getUserStats,
    getUserAchievements,
    getUserProgress,
    getGeneralStatistics
};