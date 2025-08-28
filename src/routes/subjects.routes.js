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
const { authenticateToken } = require('../middleware/auth.middleware');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');
const { verifyCsrf } = require('../middleware/csrf.middleware');

/**
 * POST /api/subjects
 * CRÍTICO: Criar disciplina + múltiplos tópicos em UMA transação
 * 
 * Validações críticas:
 * - subject_name (1-200 chars)
 * - priority_weight (1-5)
 * - topics_list string (max 10000 chars)
 */
router.post('/subjects',
    authenticateToken(),
    verifyCsrf({ skipInDevelopment: true }),
    validators.text('subject_name', 1, 200),
    validators.integer('priority_weight', 1, 5).optional(),
    body('topics_list')
        .optional()
        .isString()
        .isLength({ max: 10000 })
        .withMessage('Lista de tópicos muito longa'),
    body('plan_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Plan ID deve ser um número inteiro positivo'),
    handleValidationErrors,
    subjectsController.createSubject
);

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
router.post('/plans/:planId/subjects_with_topics', 
    authenticateToken(),
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
router.patch('/subjects/:subjectId', 
    authenticateToken(),
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
router.delete('/subjects/:subjectId', 
    authenticateToken(),
    validators.numericId('subjectId'),
    handleValidationErrors,
    subjectsController.deleteSubject
);

/**
 * GET /api/subjects
 * Listagem básica de disciplinas sem autenticação (para compatibilidade)
 */
router.get('/subjects',
    subjectsController.getSubjectsBasic
);

/**
 * GET /api/plans/:planId/subjects
 * Listagem de disciplinas de um plano específico
 * 
 * Validações:
 * - planId numérico
 * - Autenticação obrigatória
 */
router.get('/plans/:planId/subjects', 
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    subjectsController.getSubjectsByPlan
);

/**
 * POST /api/plans/:planId/subjects
 * Criar uma nova disciplina para um plano específico
 * 
 * Validações:
 * - planId numérico
 * - name: nome da disciplina (1-200 chars)
 * - weight: peso da disciplina (1-10)
 */
router.post('/plans/:planId/subjects',
    authenticateToken(),
    validators.numericId('planId'),
    body('name')
        .isString()
        .isLength({ min: 1, max: 200 })
        .withMessage('Nome da disciplina deve ter entre 1 e 200 caracteres'),
    body('weight')
        .isInt({ min: 1, max: 10 })
        .withMessage('Peso deve ser entre 1 e 10'),
    handleValidationErrors,
    subjectsController.createSubjectForPlan
);

/**
 * GET /api/plans/:planId/subjects_with_topics
 * CRÍTICO: Listagem otimizada com JOIN complexo
 * 
 * Validações críticas:
 * - planId numérico
 * - Cache headers automáticos no controller
 */
router.get('/plans/:planId/subjects_with_topics', 
    authenticateToken(),
    validators.numericId('planId'),
    handleValidationErrors,
    subjectsController.getSubjectsWithTopics
);

module.exports = router;