/**
 * TOPICS ROUTES - FASE 4 MIGRATION  
 * Rotas para gerenciar tópicos com operações BATCH críticas
 * 
 * ROTAS SUPER CRÍTICAS:
 * - PATCH batch_update: Validações complexas para operação em lote
 * - PATCH batch_update_details: Validações para detalhes em lote  
 * - Validações robustas para arrays e campos opcionais
 * - Operações transacionais críticas
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Controllers e Middleware
const topicsController = require('../controllers/topics.controller');
const { authenticateToken, handleValidationErrors } = require('../../middleware');
const { validators } = require('../../middleware');

/**
 * GET /api/subjects/:subjectId/topics
 * CRÍTICO: Listar tópicos com validação de ownership
 * 
 * Validações críticas:
 * - subjectId numérico
 * - Cache headers automáticos no controller
 */
router.get('/api/subjects/:subjectId/topics', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    topicsController.getTopicsBySubject
);

/**
 * PATCH /api/topics/batch_update
 * SUPER CRÍTICO: Atualização EM LOTE 🔥🔥🔥
 * 
 * Validações EXTREMAMENTE críticas:
 * - topics deve ser array
 * - Cada tópico deve ter id numérico
 * - Status deve ser 'Pendente' ou 'Concluído'
 * - completion_date opcional mas deve ser ISO8601 se presente
 * - description opcional mas string se presente
 * 
 * ATENÇÃO: CORE DO SISTEMA - VALIDAÇÕES CRÍTICAS ⚠️⚠️⚠️
 */
router.patch('/api/topics/batch_update', 
    authenticateToken,
    body('topics')
        .isArray()
        .withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id')
        .isInt()
        .withMessage('ID do tópico inválido'),
    body('topics.*.status')
        .isIn(['Pendente', 'Concluído'])
        .withMessage('Status inválido'),
    body('topics.*.completion_date')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Data de conclusão inválida'),
    body('topics.*.description')
        .optional({ checkFalsy: true })
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Descrição do tópico inválida'),
    handleValidationErrors,
    topicsController.batchUpdateTopics
);

/**
 * PATCH /api/topics/batch_update_details
 * SUPER CRÍTICO: Atualização de detalhes EM LOTE 🔥🔥🔥  
 * 
 * Validações EXTREMAMENTE críticas:
 * - topics deve ser array
 * - Cada tópico deve ter id numérico
 * - description opcional mas string (1-500 chars) se presente
 * - priority_weight opcional mas int (1-5) se presente
 * 
 * ATENÇÃO: CORE DO SISTEMA - VALIDAÇÕES CRÍTICAS ⚠️⚠️⚠️
 */
router.patch('/api/topics/batch_update_details',
    authenticateToken,
    body('topics')
        .isArray()
        .withMessage('O corpo deve conter um array de tópicos'),
    body('topics.*.id')
        .isInt()
        .withMessage('ID do tópico inválido'),
    body('topics.*.description')
        .optional({ checkFalsy: true })
        .isString()
        .isLength({ min: 1, max: 500 })
        .withMessage('Descrição do tópico inválida'),
    body('topics.*.priority_weight')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Peso do tópico deve estar entre 1 e 5'),
    handleValidationErrors,
    topicsController.batchUpdateTopicsDetails
);

/**
 * PATCH /api/topics/:topicId
 * CRÍTICO: Atualizar tópico individual
 * 
 * Validações críticas:
 * - topicId numérico
 * - description string (1-500 chars)
 * - priority_weight opcional mas int (1-5) se presente
 */
router.patch('/api/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    validators.text('description', 1, 500),
    body('priority_weight')
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage('Peso deve ser um número entre 1 e 5'),
    handleValidationErrors,
    topicsController.updateTopic
);

/**
 * DELETE /api/topics/:topicId
 * CRÍTICO: Exclusão CASCADE com transação
 * 
 * Validações críticas:
 * - topicId numérico
 * - CASCADE delete automático no controller
 */
router.delete('/api/topics/:topicId', 
    authenticateToken,
    validators.numericId('topicId'),
    handleValidationErrors,
    topicsController.deleteTopic
);

module.exports = router;