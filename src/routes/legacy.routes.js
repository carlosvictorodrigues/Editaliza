// src/routes/legacy.routes.js - FASE 8 - Rotas Legacy Ativas (Temporário)
// TODO: Migrar estas rotas para módulos apropriados nas próximas fases

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { validators, handleValidationErrors } = require('../middleware/validation.middleware');
const { query } = require('express-validator');

// Utilitários globais (temporário até migração completa)
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    const db = require('../../database-postgresql.js');
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    const db = require('../../database-postgresql.js');
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

// Função utilitária para data brasileira (temporário)
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// ROTAS DE TESTE E DEBUG
// ==========================================
router.get('/test-db', authenticateToken, async (req, res) => {
    try {
        console.log("[DEBUG TEST] Testando conexão do banco...");
        
        const test1 = await dbAll('SELECT 1 as test');
        console.log(`[DEBUG TEST] Teste 1 (SELECT 1):`, test1);
        
        const test2 = await dbAll('SELECT COUNT(*) as count FROM study_plans WHERE user_id = ?', [req.user.id]);
        console.log(`[DEBUG TEST] Teste 2 (COUNT):`, test2);
        
        res.json({ test1, test2, userId: req.user.id });
    } catch (error) {
        console.error('[DEBUG TEST] Erro:', error);
        return res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ROTAS DE DADOS DE REVISÃO - MIGRADO PARA STATISTICS CONTROLLER
// ==========================================
// Esta rota foi movida para statistics.routes.js com implementação completa
// Mantendo aqui apenas para backward compatibility temporária
router.get('/plans/:planId/review_data', 
    authenticateToken,
    validators.numericId('planId'),
    (req, res) => {
        // Redirect to the new statistics route
        return res.status(410).json({
            error: 'Esta rota foi migrada. Use GET /api/plans/:planId/review_data via statistics.routes.js',
            newEndpoint: '/api/plans/' + req.params.planId + '/review_data',
            code: 'ROUTE_MIGRATED_TO_STATISTICS'
        });
    }
);

// ==========================================
// PROGRESSO DETALHADO - MIGRADO PARA STATISTICS CONTROLLER
// ==========================================
// Esta rota foi movida para statistics.routes.js com implementação completa
// Mantendo aqui apenas para backward compatibility temporária
router.get('/plans/:planId/detailed_progress',
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    (req, res) => {
        // Redirect to the new statistics route
        return res.status(410).json({
            error: 'Esta rota foi migrada. Use GET /api/plans/:planId/detailed_progress via statistics.routes.js',
            newEndpoint: '/api/plans/' + req.params.planId + '/detailed_progress',
            code: 'ROUTE_MIGRATED_TO_STATISTICS'
        });
    }
);

// ==========================================
// BACKWARD COMPATIBILITY ROUTES
// ==========================================

// POST /api/profile/upload-photo - Compatibility route for old frontend
router.post('/profile/upload-photo', 
    authenticateToken, 
    (req, res) => {
        // Redirect to new route
        res.status(410).json({
            error: 'Esta rota foi migrada. Use POST /api/profile/photo',
            newEndpoint: '/api/profile/photo',
            code: 'ROUTE_MIGRATED'
        });
    }
);

// POST /api/logout - Compatibility route (should be in auth routes)
router.post('/logout', 
    authenticateToken, 
    (req, res) => {
        // Redirect to auth routes
        res.status(410).json({
            error: 'Esta rota foi migrada. Use POST /api/auth/logout',
            newEndpoint: '/api/auth/logout',
            code: 'ROUTE_MIGRATED'
        });
    }
);

// ==========================================
// REALITY CHECK
// ==========================================
router.get('/plans/:planId/realitycheck', 
    authenticateToken,
    validators.numericId('planId'),
    handleValidationErrors,
    async (req, res) => {
        const planId = req.params.planId;
        try {
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
            if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado' });
            
            const sessions = await dbAll('SELECT status, topic_id, session_date, session_type FROM study_sessions WHERE study_plan_id = ?', [planId]);
            const totalTopicsResult = await dbGet('SELECT COUNT(t.id) as total FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.study_plan_id = ?', [planId]);
            const totalTopics = totalTopicsResult.total;

            if (totalTopics === 0) {
                return res.json({ message: 'Adicione tópicos ao seu plano para ver as projeções.' });
            }

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const examDate = new Date(plan.exam_date + 'T23:59:59');
            
            const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico');
            const completedTopics = new Set(newTopicSessions.filter(s => s.status === 'Concluído').map(r => r.topic_id));
            const topicsCompletedCount = completedTopics.size;
            const topicsRemaining = totalTopics - topicsCompletedCount;

            const futureNewTopics = newTopicSessions.filter(s => new Date(s.session_date) >= today && s.status === 'Pendente');
            const isMaintenanceMode = totalTopics > 0 && futureNewTopics.length === 0;

            const firstSessionDateResult = await dbGet('SELECT MIN(session_date) as first_date FROM study_sessions WHERE study_plan_id = ? AND session_type = \'Novo Tópico\' AND status = \'Concluído\'', [planId]);
            const firstSessionDate = firstSessionDateResult.first_date ? new Date(firstSessionDateResult.first_date + 'T00:00:00') : today;

            const daysSinceStart = Math.max(1, Math.ceil((today - firstSessionDate) / (1000 * 60 * 60 * 24)));
            const daysRemainingForExam = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
            
            const currentPace = topicsCompletedCount / daysSinceStart;
            const requiredPace = topicsRemaining / daysRemainingForExam;

            let status, primaryMessage, secondaryMessage, motivationalMessage;

            if (isMaintenanceMode) {
                status = 'completed';
                primaryMessage = `Parabéns! Você concluiu <strong>100%</strong> do edital.`;
                secondaryMessage = `Seu cronograma entrou no Modo de Manutenção Avançada, com foco em revisões e simulados.`;
                motivationalMessage = `Agora é a hora de aprimorar. Mantenha a consistência até a aprovação!`;
            } else {
                let projectedCompletionPercentage = 0;
                if (totalTopics > 0) {
                    if (currentPace > 0) {
                        const projectedTopicsToComplete = currentPace * daysRemainingForExam;
                        const totalProjectedCompleted = topicsCompletedCount + projectedTopicsToComplete;
                        projectedCompletionPercentage = Math.min(100, (totalProjectedCompleted / totalTopics) * 100);
                    } else if (topicsCompletedCount > 0) {
                        projectedCompletionPercentage = (topicsCompletedCount / totalTopics) * 100;
                    }
                }

                if (currentPace >= requiredPace) {
                    status = 'on-track';
                    primaryMessage = `Mantendo o ritmo, sua projeção é de concluir <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital.`;
                    secondaryMessage = `Excelente trabalho! Seu ritmo atual é suficiente para cobrir todo o conteúdo necessário a tempo.`;
                    motivationalMessage = `A consistência está trazendo resultados. Continue assim!`;
                } else {
                    status = 'off-track';
                    primaryMessage = `Nesse ritmo, você completará apenas <strong>${projectedCompletionPercentage.toFixed(0)}%</strong> do edital até a prova.`;
                    secondaryMessage = `Para concluir 100%, seu ritmo precisa aumentar para <strong>${requiredPace.toFixed(1)} tópicos/dia</strong>.`;
                    motivationalMessage = `Não desanime! Pequenos ajustes na rotina podem fazer uma grande diferença.`;
                }
            }

            res.json({
                requiredPace: isFinite(requiredPace) ? `${requiredPace.toFixed(1)} tópicos/dia` : 'N/A',
                postponementCount: plan.postponement_count,
                status,
                primaryMessage,
                secondaryMessage,
                motivationalMessage,
                isMaintenanceMode
            });

        } catch (error) {
            console.error('Erro no reality check:', error);
            res.status(500).json({ 'error': 'Erro ao calcular diagnóstico' });
        }
    }
);

module.exports = router;
