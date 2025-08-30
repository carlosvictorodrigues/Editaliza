/**
 * GAMIFICATION CONTROLLER
 * 
 * Controla todas as funcionalidades de gamificação do sistema:
 * - Cálculo de XP (Experience Points)
 * - Sistema de níveis e progressão
 * - Desbloqueio de conquistas (achievements)
 * - Sistema de streaks (sequências de estudo)
 * - Tracking de progresso gamificado
 * - Novos endpoints para gamificação completa
 * 
 * CRÍTICO: Todas as fórmulas de cálculo devem ser mantidas EXATAMENTE como estão
 * para preservar a consistência dos dados existentes.
 */

const { dbGet, dbAll, dbRun } = require('../config/database');
const gamificationService = require('../services/gamificationService');

// Função utilitária para data brasileira (preservada do server.js original)
function getBrazilianDateString() {
    const now = new Date();
    // Criar objeto Date diretamente no timezone brasileiro
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

/**
 * SISTEMA DE NÍVEIS - PRESERVADO EXATAMENTE COMO ORIGINAL
 * Cada threshold representa o número de tópicos completados necessários
 */
const GAMIFICATION_LEVELS = [
    { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' },
    { threshold: 11, title: 'Pagador(a) de Inscrição 💸' },
    { threshold: 31, title: 'Acima da Nota de Corte (nos simulados) 😉' },
    { threshold: 51, title: 'Mestre dos Grupos de WhatsApp de Concurso 📲' },
    { threshold: 101, title: 'Gabaritador(a) da prova de Português da FGV 🎯' },
    { threshold: 201, title: 'Terror do Cespe/Cebraspe 👹' },
    { threshold: 351, title: 'Veterano(a) de 7 Bancas Diferentes 😎' },
    { threshold: 501, title: '✨ Lenda Viva: Assinante Vitalício do Diário Oficial ✨' }
];

/**
 * Calcula o nível atual do usuário baseado no número de tópicos completados
 * CRÍTICO: Lógica preservada exatamente como no servidor original
 */
function calculateUserLevel(completedTopicsCount) {
    let currentLevel = GAMIFICATION_LEVELS[0];
    let nextLevel = null;
    
    // Percorre os níveis de trás para frente para encontrar o nível atual
    for (let i = GAMIFICATION_LEVELS.length - 1; i >= 0; i--) {
        if (completedTopicsCount >= GAMIFICATION_LEVELS[i].threshold) {
            currentLevel = GAMIFICATION_LEVELS[i];
            if (i < GAMIFICATION_LEVELS.length - 1) {
                nextLevel = GAMIFICATION_LEVELS[i + 1];
            }
            break;
        }
    }
    
    const topicsToNextLevel = nextLevel ? nextLevel.threshold - completedTopicsCount : 0;
    
    return {
        currentLevel: currentLevel.title,
        nextLevel: nextLevel ? nextLevel.title : null,
        topicsToNextLevel
    };
}

/**
 * Calcula o streak de estudos (dias consecutivos)
 * PRESERVADO: Lógica complexa de cálculo de streak mantida exatamente
 */
async function calculateStudyStreak(planId) {
    const completedSessions = await dbAll(`
        SELECT DISTINCT session_date FROM study_sessions 
        WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida') ORDER BY session_date DESC
    `, [planId]);
    
    let studyStreak = 0;
    if (completedSessions.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const lastStudyDate = new Date(completedSessions[0].session_date + 'T00:00:00');
        
        // Verifica se estudou hoje ou ontem para começar a contar o streak
        if (lastStudyDate.getTime() === today.getTime() || lastStudyDate.getTime() === yesterday.getTime()) {
            studyStreak = 1;
            let currentDate = new Date(lastStudyDate);
            
            // Conta dias consecutivos anteriores
            for (let i = 1; i < completedSessions.length; i++) {
                const previousDay = new Date(currentDate);
                previousDay.setDate(currentDate.getDate() - 1);
                const nextStudyDate = new Date(completedSessions[i].session_date + 'T00:00:00');
                
                if (nextStudyDate.getTime() === previousDay.getTime()) {
                    studyStreak++;
                    currentDate = nextStudyDate;
                } else {
                    break; // Quebra na sequência
                }
            }
        }
    }
    
    return studyStreak;
}

/**
 * Gera conquistas baseadas em critérios específicos
 * PRESERVADO: Sistema de achievements com humor mantido integralmente
 */
function generateAchievements(completedTopicsCount, totalCompletedSessions, studyStreak) {
    const achievements = [];
    const now = new Date().toISOString();
    
    // === CONQUISTAS POR TÓPICOS CONCLUÍDOS ===
    // Sistema com muito humor para aliviar a pressão dos estudos!
    
    if (completedTopicsCount >= 1) {
        achievements.push({
            title: '🎯 Primeira Lapada no Edital',
            description: 'O primeiro soco na cara da procrastinação!',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 5) {
        achievements.push({
            title: '📚 Maratonista do PDF',
            description: 'Sua vista já começou a reclamar.',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 10) {
        achievements.push({
            title: '✨ Destruidor de Questões',
            description: 'Já discute gabarito com confiança.',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 25) {
        achievements.push({
            title: '👑 Dono do Material',
            description: 'Sabe até a cor da caneta que o professor usou no slide.',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 50) {
        achievements.push({
            title: '🌟 Meio Monstro',
            description: 'Você está virando uma lenda local no grupo de estudos.',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 100) {
        achievements.push({
            title: '🏛️ Centurião do Conhecimento',
            description: 'Bancas já estão te bloqueando no Instagram.',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 200) {
        achievements.push({
            title: '💪 Chuck Norris dos Editais',
            description: 'Os editais temem você!',
            achieved_date: now
        });
    }
    
    if (completedTopicsCount >= 501) {
        achievements.push({
            title: '🏛️ Vai Escolher Onde Vai Tomar Posse',
            description: 'Não é se vai passar, é onde.',
            achieved_date: now
        });
    }
    
    // === CONQUISTAS POR STREAK (SEQUÊNCIA DE ESTUDOS) ===
    
    if (studyStreak >= 3) {
        achievements.push({
            title: 'Resistente ao Netflix 📺',
            description: '3 dias seguidos! Resistiu à série nova!',
            achieved_date: now
        });
    }
    
    if (studyStreak >= 7) {
        achievements.push({
            title: 'Imune ao Sofá 🛋️',
            description: '7 dias! O sofá esqueceu sua forma!',
            achieved_date: now
        });
    }
    
    if (studyStreak >= 14) {
        achievements.push({
            title: 'Inimigo do Descanso 😤',
            description: '14 dias! Descanso? Não conheço!',
            achieved_date: now
        });
    }
    
    if (studyStreak >= 30) {
        achievements.push({
            title: 'Máquina de Aprovar 🤖',
            description: '30 dias! Você é um cyborg concurseiro!',
            achieved_date: now
        });
    }
    
    // === CONQUISTAS POR NÚMERO DE SESSÕES ===
    
    if (totalCompletedSessions >= 20) {
        achievements.push({
            title: 'Viciado(a) em Questões 💊',
            description: '20 sessões! Questões são sua droga legal!',
            achieved_date: now
        });
    }
    
    if (totalCompletedSessions >= 50) {
        achievements.push({
            title: '🪑 Lombar Suprema',
            description: 'Já fez mais fisioterapia que simulados.',
            achieved_date: now
        });
    }
    
    if (totalCompletedSessions >= 100) {
        achievements.push({
            title: '🛏️ Travesseiro Vade Mecum',
            description: 'Seu travesseiro já está com formato de Vade Mecum.',
            achieved_date: now
        });
    }
    
    if (totalCompletedSessions >= 150) {
        achievements.push({
            title: '📖 Estuda em Fila de Banco',
            description: 'Estuda até em fila de banco.',
            achieved_date: now
        });
    }
    
    if (totalCompletedSessions >= 200) {
        achievements.push({
            title: '🏖️ O que é Férias?',
            description: 'Férias? Nunca ouvi falar.',
            achieved_date: now
        });
    }
    
    if (totalCompletedSessions >= 300) {
        achievements.push({
            title: '🎉 Destruidor(a) de Finais de Semana',
            description: 'Churrasco? Praia? Só depois da posse!',
            achieved_date: now
        });
    }
    
    return achievements;
}

/**
 * CONTROLLER PRINCIPAL: Obtém todos os dados de gamificação de um plano
 * PRESERVADO: Toda a lógica de cálculo mantida exatamente como original
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
        // CRÍTICO: Query preservada exatamente como original
        const completedTopicsResult = await dbGet(`
            SELECT COUNT(DISTINCT topic_id) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 
            AND status IN ('Concluído', 'Concluída', 'Concluida') 
            AND topic_id IS NOT NULL
        `, [planId]);
        const completedTopicsCount = parseInt(completedTopicsResult?.count || 0);
        
        // Debug log preservado
        console.log(`[GAMIFICATION DEBUG] Plan ${planId}:`, {
            completedTopicsCount,
            queryResult: completedTopicsResult
        });

        // 2. CALCULAR NÍVEL E PROGRESSÃO
        const levelData = calculateUserLevel(completedTopicsCount);

        // 3. CALCULAR STREAK DE ESTUDOS
        const studyStreak = await calculateStudyStreak(planId);
        
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
        // FÓRMULA PRESERVADA: 10 XP por sessão + 50 XP por tópico novo
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
        
        // XP CALCULATION: FÓRMULA CRÍTICA PRESERVADA
        const experiencePoints = (totalCompletedSessions * 10) + (completedTopicsCount * 50);
        
        // 6. GERAR CONQUISTAS
        const achievements = generateAchievements(completedTopicsCount, totalCompletedSessions, studyStreak);
        
        console.log(`[GAMIFICATION DEBUG] Achievements calculados:`, {
            count: achievements.length,
            totalSessions: totalCompletedSessions,
            streak: studyStreak
        });
        
        // 7. ESTATÍSTICAS ADICIONAIS
        // Calcular total de dias únicos com atividades
        const uniqueStudyDaysResult = await dbGet(`
            SELECT COUNT(DISTINCT session_date) as count 
            FROM study_sessions 
            WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const totalStudyDays = uniqueStudyDaysResult.count || 0;

        // Calcular tempo total de estudo
        const totalStudyTimeResult = await dbGet(`
            SELECT SUM(COALESCE(time_studied_seconds, 0)) as total_time
            FROM study_sessions 
            WHERE study_plan_id = $1 AND status IN ('Concluído', 'Concluída', 'Concluida')
        `, [planId]);
        const totalStudyTime = totalStudyTimeResult.total_time || 0;
        
        console.log(`📊 Endpoint gamificação - Plano ${planId}: tempo total = ${totalStudyTime} segundos`);

        // RESPOSTA FINAL - Estrutura preservada do original
        res.json({
            completedTopicsCount,
            concurseiroLevel: levelData.currentLevel,
            nextLevel: levelData.nextLevel,
            topicsToNextLevel: levelData.topicsToNextLevel,
            studyStreak,
            completedTodayCount: todayTasksResult.completed || 0,
            totalTodayCount: todayTasksResult.total || 0,
            experiencePoints,
            achievements,
            totalStudyDays,
            totalCompletedSessions,
            totalStudyTime
        });

    } catch (error) {
        console.error('Erro na rota de gamificação:', error);
        return res.status(500).json({ error: 'Erro ao buscar dados de gamificação.' });
    }
}

/**
 * NOVOS ENDPOINTS DE GAMIFICAÇÃO COMPLETA
 */

/**
 * GET /api/stats/user - Estatísticas do usuário
 * Retorna XP total, nível atual, streak, sessões completadas, horas estudadas
 */
async function getUserStats(req, res) {
    const userId = req.user.id;
    
    try {
        const stats = await gamificationService.getUserStats(userId);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas do usuário:', error);
        res.status(500).json({
            error: 'Erro ao buscar estatísticas do usuário',
            code: 'USER_STATS_ERROR'
        });
    }
}

/**
 * GET /api/progress - Progresso do plano
 * Retorna porcentagem de conclusão, sessões completadas vs total, tópicos dominados
 */
async function getUserProgress(req, res) {
    const userId = req.user.id;
    
    try {
        const progress = await gamificationService.getUserProgress(userId);
        
        res.json({
            success: true,
            data: progress
        });
        
    } catch (error) {
        console.error('Erro ao buscar progresso do usuário:', error);
        res.status(500).json({
            error: 'Erro ao buscar progresso do usuário',
            code: 'USER_PROGRESS_ERROR'
        });
    }
}

/**
 * GET /api/achievements - Conquistas do usuário
 * Retorna lista de conquistas desbloqueadas, progresso para próximas conquistas, badges
 */
async function getUserAchievements(req, res) {
    const userId = req.user.id;
    
    try {
        const achievements = await gamificationService.getUserAchievements(userId);
        
        res.json({
            success: true,
            data: achievements
        });
        
    } catch (error) {
        console.error('Erro ao buscar conquistas do usuário:', error);
        res.status(500).json({
            error: 'Erro ao buscar conquistas do usuário',
            code: 'USER_ACHIEVEMENTS_ERROR'
        });
    }
}

/**
 * GET /api/statistics - Estatísticas gerais
 * Retorna métricas de desempenho, gráficos de progresso, comparação com metas
 */
async function getGeneralStatistics(req, res) {
    const userId = req.user.id;
    
    try {
        const statistics = await gamificationService.getGeneralStatistics(userId);
        
        res.json({
            success: true,
            data: statistics
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas gerais:', error);
        res.status(500).json({
            error: 'Erro ao buscar estatísticas gerais',
            code: 'GENERAL_STATISTICS_ERROR'
        });
    }
}

/**
 * GET /api/gamification/profile - Perfil completo de gamificação do usuário
 */
async function getGamificationProfile(req, res) {
    const userId = req.user.id;
    const t0 = process.hrtime.bigint();
    
    console.log(`[GAMI CONTROLLER] Iniciando getGamificationProfile para userId: ${userId}`);
    
    res.on('finish', () => {
        const ms = Number((process.hrtime.bigint() - t0) / 1_000_000n);
        console.log(`[GAMI] finish ${res.statusCode} in ${ms}ms`);
    });
    res.on('close',  () => console.warn('[GAMI] close (cliente abortou?)'));

    try {
        console.log('[GAMI CONTROLLER] Chamando gamificationService.getGamificationProfile...');
        
        // Adicionar timeout para evitar travamento
        const profileDataPromise = gamificationService.getGamificationProfile(userId);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout ao buscar gamificação')), 5000)
        );
        
        const profileData = await Promise.race([profileDataPromise, timeoutPromise]);
        
        console.log('[GAMI CONTROLLER] Dados recebidos do service, enviando resposta...');
        console.log('[GAMI CONTROLLER] profileData keys:', Object.keys(profileData));
        console.log('[GAMI CONTROLLER] res.headersSent antes de enviar:', res.headersSent);
        
        if (!res.headersSent) {
            res.status(200).json(profileData);
            res.end(); // Forçar envio da resposta
            console.log('[GAMI CONTROLLER] res.json() e res.end() chamados com sucesso');
        } else {
            console.warn('[GAMI CONTROLLER] Headers já enviados, não pode enviar resposta');
        }
        
    } catch (error) {
        console.error('[GAMI CONTROLLER] ERRO capturado:', error.message);
        console.error('[GAMI CONTROLLER] Stack:', error.stack);
        
        // Retornar dados padrão em caso de erro
        const defaultData = { 
            xp: 0, 
            level: 1, 
            current_streak: 0, 
            longest_streak: 0, 
            level_info: { threshold: 0, title: 'Aspirante a Servidor(a) 🌱' }, 
            achievements: [] 
        };
        
        console.log('[GAMI CONTROLLER] Enviando dados padrão após erro...');
        console.log('[GAMI CONTROLLER] res.headersSent antes de enviar erro:', res.headersSent);
        
        if (!res.headersSent) {
            res.status(200).json(defaultData);
            res.end(); // Forçar envio da resposta
            console.log('[GAMI CONTROLLER] res.json() e res.end() com dados padrão chamados');
        } else {
            console.warn('[GAMI CONTROLLER] Headers já enviados, não pode enviar resposta de erro');
        }
    }
}

module.exports = {
    // Endpoint original preservado
    getPlanGamification,
    
    // Novos endpoints de gamificação completa
    getUserStats,
    getUserProgress,
    getUserAchievements,
    getGeneralStatistics,
    getGamificationProfile, // Adicionado novo endpoint
    
    // Funções auxiliares para reutilização
    calculateUserLevel,
    calculateStudyStreak,
    generateAchievements,
    getBrazilianDateString,
    GAMIFICATION_LEVELS
};