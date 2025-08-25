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
    getPlanGamification
} = require('../controllers/gamification.controller');

// Importar middlewares de segurança (mantidos do servidor original)
const {
    authenticateToken,
    validators,
    handleValidationErrors
} = require('../../middleware');

/**
 * GET /api/plans/:planId/gamification
 * 
 * Rota principal de gamificação - obtém todos os dados gamificados de um plano
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
router.get('/plans/:planId/gamification', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    getPlanGamification
);

module.exports = router;