/**
 * SUBJECTS ROUTES - FASE 4 MIGRATION
 * Rotas para gerenciar disciplinas com validações robustas
 * 
 * ROTAS CRÍTICAS:
 * - POST subjects_with_topics: Criação em lote com transação
 * - PATCH subject update: Validação aninhada
 * - DELETE subject: CASCADE delete transacional
 * - GET subjects_with_topics: JOIN otimizado
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Controllers e Middleware
const subjectsController = require('../controllers/subjects.controller');
const { authenticateToken, handleValidationErrors } = require('../../middleware');
const { validators } = require('../../middleware');

/**
 * POST /api/plans/:planId/subjects_with_topics
 * CRÍTICO: Criar disciplina + múltiplos tópicos em UMA transação
 * 
 * Validações críticas:
 * - planId numérico
 * - subject_name (1-200 chars)
 * - priority_weight (1-5)
 * - topics_list string (max 10000 chars)
 */
router.post('/api/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    body('topics_list')
        .isString()
        .isLength({ max: 10000 })
        .withMessage('Lista de tópicos muito longa'),
    handleValidationErrors,
    subjectsController.createSubjectWithTopics
);

/**
 * PATCH /api/subjects/:subjectId
 * CRÍTICO: Atualizar disciplina com validação aninhada
 * 
 * Validações críticas:
 * - subjectId numérico
 * - subject_name (1-200 chars)
 * - priority_weight (1-5)
 */
router.patch('/api/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5),
    handleValidationErrors,
    subjectsController.updateSubject
);

/**
 * DELETE /api/subjects/:subjectId
 * CRÍTICO: Exclusão CASCADE com transação atômica
 * 
 * Validações críticas:
 * - subjectId numérico
 * - Ownership validation automática no controller
 */
router.delete('/api/subjects/:subjectId', 
    authenticateToken,
    validators.numericId('subjectId'),
    handleValidationErrors,
    subjectsController.deleteSubject
);

/**
 * GET /api/plans/:planId/subjects_with_topics
 * CRÍTICO: Listagem otimizada com JOIN complexo
 * 
 * Validações críticas:
 * - planId numérico
 * - Cache headers automáticos no controller
 */
router.get('/api/plans/:planId/subjects_with_topics', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    subjectsController.getSubjectsWithTopics
);

module.exports = router;