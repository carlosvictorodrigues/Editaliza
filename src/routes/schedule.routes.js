/**
 * Schedule Routes - Rotas modulares para geração de cronogramas
 * 
 * ATENÇÃO: Esta é uma migração crítica da rota /api/plans/:planId/generate
 * Mantém 100% da compatibilidade com a implementação original do server.js
 * 
 * FUNCIONALIDADES:
 * - Geração de cronogramas com algoritmos complexos
 * - Validação robusta de entrada
 * - Tratamento de erros detalhado
 * - Auditoria completa
 * - Transações atômicas
 * - Modo reta final
 * - Spaced repetition
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Middleware
const authMiddleware = require('../middleware/auth.middleware');
const { validators, handleValidationErrors, jsonField, integer, numericId } = require('../middleware/validation.middleware');

// Controllers
const plansController = require('../controllers/plans.controller');

// Logger
const logger = require('../../src/utils/logger');

/**
 * POST /api/plans/:planId/generate - Gerar cronograma de estudos
 * 
 * Esta é a rota mais crítica do sistema! Responsável por:
 * 1. Validar todas as entradas rigorosamente
 * 2. Aplicar algoritmos complexos de distribuição
 * 3. Calcular spaced repetition automaticamente
 * 4. Processar modo reta final quando necessário
 * 5. Garantir atomicidade com transações
 * 6. Fornecer auditoria completa
 * 
 * VALIDAÇÕES PRESERVADAS DA IMPLEMENTAÇÃO ORIGINAL:
 * - planId deve ser numérico válido
 * - daily_question_goal: 0-500
 * - weekly_question_goal: 0-3500  
 * - session_duration_minutes: 10-240
 * - has_essay deve ser booleano
 * - reta_final_mode deve ser booleano
 * - study_hours_per_day deve ser JSON válido
 */
router.post('/plans/:planId/generate',
    // 1. Autenticação obrigatória
    authMiddleware.authenticateToken(),
    
    // 2. Validação do ID do plano
    numericId('planId'),
    
    // 3. Validação das metas de questões
    integer('daily_question_goal', 0, 500),
    integer('weekly_question_goal', 0, 3500),
    
    // 4. Validação da duração das sessões
    integer('session_duration_minutes', 10, 240),
    
    // 5. Validação dos campos booleanos
    body('has_essay')
        .isBoolean()
        .withMessage('has_essay deve ser booleano'),
    
    body('reta_final_mode')
        .isBoolean()
        .withMessage('reta_final_mode deve ser booleano'),
    
    // 6. Validação complexa do JSON de horas de estudo
    jsonField('study_hours_per_day'),
    
    // 7. Middleware para processar erros de validação
    handleValidationErrors,
    
    // 8. Controller que integra com o ScheduleGenerationService
    plansController.generateSchedule
);

/**
 * Middleware de logging para auditoria
 */
router.use('/plans/:planId/generate', (req, res, next) => {
    const startTime = Date.now();
    
    // Log da requisição
    logger.info('Requisição de geração de cronograma', {
        planId: req.params.planId,
        userId: req.user?.id,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    
    // Log da resposta
    const originalSend = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        logger.info('Resposta de geração de cronograma', {
            planId: req.params.planId,
            userId: req.user?.id,
            statusCode: res.statusCode,
            duration,
            success: data?.success,
            sessionsCreated: data?.performance?.sessionsCreated,
            excludedTopics: data?.retaFinal?.totalExcluded
        });
        
        return originalSend.call(this, data);
    };
    
    next();
});

/**
 * Middleware de tratamento de erros específico para cronogramas
 */
router.use('/plans/:planId/generate', (error, req, res, next) => {
    logger.error('Erro na geração de cronograma', {
        planId: req.params.planId,
        userId: req.user?.id,
        error: error.message,
        stack: error.stack,
        url: req.originalUrl
    });
    
    // Erros específicos com códigos apropriados
    if (error.message.includes('Plano não encontrado')) {
        return res.status(404).json({
            error: 'Plano não encontrado ou sem permissão',
            code: 'PLAN_NOT_FOUND'
        });
    }
    
    if (error.message.includes('data da prova')) {
        return res.status(400).json({
            error: 'Defina a data da prova nas configurações do plano antes de gerar o cronograma.',
            code: 'MISSING_EXAM_DATE'
        });
    }
    
    if (error.message.includes('CRONOGRAMA INVIÁVEL')) {
        return res.status(400).json({
            error: error.message,
            code: 'SCHEDULE_NOT_VIABLE'
        });
    }
    
    if (error.message.includes('horas de estudo')) {
        return res.status(400).json({
            error: 'O cronograma não pode ser gerado porque não há horas de estudo definidas.',
            code: 'NO_STUDY_HOURS'
        });
    }
    
    // Erro genérico
    res.status(500).json({
        error: 'Erro interno na geração do cronograma. Tente novamente.',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

/**
 * Rota de healthcheck para cronogramas
 */
router.get('/schedule/health', (req, res) => {
    res.json({
        service: 'Schedule Generation Service',
        status: 'healthy',
        version: '9.5',
        timestamp: new Date().toISOString(),
        features: [
            'Topic Prioritization',
            'Session Distribution',
            'Spaced Repetition',
            'Reta Final Processing',
            'Atomic Transactions',
            'Complete Validation',
            'Audit Logging'
        ]
    });
});

/**
 * Documentação da API
 */
router.get('/schedule/docs', (req, res) => {
    res.json({
        title: 'Schedule Generation API',
        version: '9.5',
        description: 'API para geração de cronogramas de estudos com algoritmos avançados',
        endpoints: {
            'POST /api/plans/:planId/generate': {
                description: 'Gera cronograma completo de estudos',
                parameters: {
                    planId: 'ID numérico do plano (path param)',
                    daily_question_goal: 'Meta diária de questões (0-500)',
                    weekly_question_goal: 'Meta semanal de questões (0-3500)',
                    session_duration_minutes: 'Duração das sessões em minutos (10-240)',
                    has_essay: 'Boolean - plano inclui redações',
                    reta_final_mode: 'Boolean - ativar modo reta final',
                    study_hours_per_day: 'JSON object - horas por dia da semana'
                },
                responses: {
                    200: 'Cronograma gerado com sucesso',
                    400: 'Dados de entrada inválidos',
                    404: 'Plano não encontrado',
                    500: 'Erro interno do servidor'
                }
            },
            'GET /api/schedule/health': {
                description: 'Verifica status do serviço'
            },
            'GET /api/schedule/docs': {
                description: 'Documentação da API'
            }
        },
        algorithms: {
            'TopicPriorizer': 'Round-robin ponderado por prioridade de disciplina e tópico',
            'SessionDistributor': 'Distribuição otimizada considerando disponibilidade',
            'SpacedRepetitionCalculator': 'Revisões em 7, 14 e 28 dias',
            'RetaFinalProcessor': 'Exclusão inteligente de tópicos por prioridade'
        }
    });
});

module.exports = router;