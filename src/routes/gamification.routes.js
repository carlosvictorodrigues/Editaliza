/**
 * GAMIFICATION ROUTES
 * 
 * Rotas para o sistema de gamificação do Editaliza:
 * - Dados de gamificação por plano de estudos
 * - XP, níveis, achievements, streaks
 * - Progresso gamificado
 * 
 * PRESERVADO: Todas as validações e middlewares mantidos como no servidor original
 */

const express = require('express');
const router = express.Router();

// Importar controller de gamificação
const {
    getPlanGamification,
    getUserStats,
    getUserProgress,
    getUserAchievements,
    getGeneralStatistics,
    getGamificationProfile
} = require('../controllers/gamification.controller');

// Importar middlewares de segurança (mantidos do servidor original)
const { authenticateToken } = require('../middleware/auth.middleware');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');

/**
 * GET /api/plans/:planId/gamification
 * 
 * ROTA COMENTADA - CONFLITO COM plans.routes.js
 * Esta rota foi movida para plans.routes.js para evitar conflitos de roteamento.
 * A gamificação por plano deve ser acessada via /api/plans/:planId/gamification
 * 
 * PRESERVADO: Middlewares e validações exatamente como no servidor original:
 * - authenticateToken: Verificar autenticação JWT
 * - validators.numericId('planId'): Validar ID numérico do plano
 * - handleValidationErrors: Processar erros de validação
 * 
 * Retorna:
 * - completedTopicsCount: Número de tópicos únicos completados
 * - concurseiroLevel: Nível atual do usuário (título humorístico)
 * - nextLevel: Próximo nível (se existir)
 * - topicsToNextLevel: Tópicos necessários para próximo nível
 * - studyStreak: Sequência atual de dias estudando
 * - completedTodayCount: Tarefas concluídas hoje
 * - totalTodayCount: Total de tarefas de hoje
 * - experiencePoints: XP total (fórmula: sessões * 10 + tópicos * 50)
 * - achievements: Array de conquistas desbloqueadas
 * - totalStudyDays: Total de dias únicos com estudo
 * - totalCompletedSessions: Total de sessões concluídas
 * - totalStudyTime: Tempo total estudado (em segundos)
 */
/*
router.get('/plans/:planId/gamification', 
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    getPlanGamification
);
*/

/**
 * GET /api/stats/user
 * 
 * Rota para estatísticas do usuário:
 * - XP total
 * - Nível atual
 * - Streak de dias
 * - Total de sessões completadas
 * - Horas estudadas
 * - Total de dias de estudo
 * - Tempo médio por sessão
 */
router.get('/stats/user',
    authenticateToken(),
    getUserStats
);

/**
 * GET /api/progress
 * 
 * Rota para progresso do plano:
 * - Porcentagem de conclusão
 * - Sessões completadas vs total
 * - Tópicos dominados
 * - Próximas sessões
 * - Planos ativos
 */
router.get('/progress',
    authenticateToken(),
    getUserProgress
);

/**
 * GET /api/achievements
 * 
 * Rota para conquistas do usuário:
 * - Lista de conquistas desbloqueadas
 * - Progresso para próximas conquistas
 * - Badges ganhos
 * - Total de conquistas
 */
router.get('/achievements',
    authenticateToken(),
    getUserAchievements
);

/**
 * GET /api/statistics
 * 
 * Rota para estatísticas gerais:
 * - Métricas de desempenho
 * - Gráficos de progresso
 * - Comparação com metas
 * - Estatistias semanais e mensais
 */
router.get('/statistics',
    authenticateToken(),
    getGeneralStatistics
);

/**
 * GET /api/gamification/profile
 * 
 * Rota para obter o perfil completo de gamificação do usuário.
 */
router.get('/gamification/profile',
    authenticateToken(),
    getGamificationProfile
);

/**
 * GET /api/gamification/plan/:planId
 * 
 * Rota alternativa para gamificação por plano
 * Criada para compatibilidade com testes
 */
router.get('/gamification/plan/:planId',
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    getPlanGamification
);

/**
 * GET /api/gamification/leaderboard
 * 
 * Rota para leaderboard/ranking
 * Retorna lista vazia por enquanto (placeholder)
 */
router.get('/gamification/leaderboard',
    authenticateToken(),
    (req, res) => {
        res.json({
            items: [],
            userPosition: null,
            totalUsers: 0
        });
    }
);

module.exports = router;