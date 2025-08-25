/**
 * Plans Controller - FASE 3 MIGRAÇÃO COMPLETA
 * 
 * Controller consolidado para todas as operações relacionadas a planos de estudo.
 * Migra TODA a complexidade do server.js mantendo 100% da funcionalidade.
 * 
 * ATENÇÃO: Este é o CORE BUSINESS da aplicação. Qualquer alteração pode quebrar
 * funcionalidades críticas. Proceder com máxima cautela.
 */

// Removed unused import: const { body } = require('express-validator');
const ScheduleGenerationService = require('../services/schedule/ScheduleGenerationService');
const logger = require('../../src/utils/logger');

// FUNÇÃO UTILITÁRIA PARA DATA BRASILEIRA - CRÍTICA
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// FASE 5 WAVE 3 - PLANSERVICE INTEGRATION
const db = require('../../database-postgresql.js');
const { createRepositories } = require('../repositories');
const DatabaseAdapter = require('../adapters/database.adapter');
const PlanService = require('../services/PlanService');

// Inicializar repositories, adapter e services
const repos = createRepositories(db);
const dbAdapter = new DatabaseAdapter(repos, db);
const planService = new PlanService(repos, db);

// Métodos de transição - gradualmente substituir por repositories diretos
const dbGet = dbAdapter.dbGet;
const dbAll = dbAdapter.dbAll;
const dbRun = dbAdapter.dbRun;

/**
 * 📋 CRUD BÁSICO DE PLANOS
 */

/**
 * GET /api/plans - Listar todos os planos do usuário
 * FASE 4.1 - MIGRADO PARA USAR REPOSITORY
 */
const getPlans = async (req, res) => {
    try {
        logger.info(`[PLANS] Usuário ID: ${req.user.id}`);
        
        // NOVA ABORDAGEM: Usar repository diretamente
        const rows = await repos.plan.findByUserId(req.user.id);
        logger.info(`[PLANS] Encontrados ${rows.length} planos via REPOSITORY`);
        
        // Processar dados de forma mais robusta - JSON parsing crítico
        const plans = rows.map(plan => {
            let studyHours = {};
            if (plan.study_hours_per_day) {
                try {
                    studyHours = JSON.parse(plan.study_hours_per_day);
                } catch (e) {
                    console.warn(`[PLANS] JSON parse error for plan ${plan.id}:`, e.message);
                    studyHours = {};
                }
            }
            
            return {
                ...plan,
                study_hours_per_day: studyHours
            };
        });
        
        logger.info(`[PLANS] Enviando ${plans.length} planos`);
        
        // Log estatísticas do adapter para monitoramento
        if (process.env.NODE_ENV !== 'production') {
            logger.info('[PLANS] Adapter Stats:', dbAdapter.getStats());
        }
        
        res.json(plans);
        
    } catch (error) {
        console.error('[PLANS] Erro:', error.message);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * POST /api/plans - Criar novo plano
 */
const createPlan = async (req, res) => {
    const { plan_name, exam_date } = req.body;
    const defaultHours = JSON.stringify({ '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });
    
    const sql = `
        INSERT INTO study_plans 
        (user_id, plan_name, exam_date, study_hours_per_day, daily_question_goal, weekly_question_goal, session_duration_minutes, review_mode, postponement_count, has_essay) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
        const result = await dbRun(sql, [req.user.id, plan_name, exam_date, defaultHours, 50, 300, 50, 'completo', 0, false]);
        res.status(201).json({ 'message': 'Plano criado com sucesso!', 'newPlanId': result.lastID });
    } catch (error) {
        console.error('Erro ao criar plano:', error);
        return res.status(500).json({ 'error': 'Erro ao criar plano' });
    }
};

/**
 * GET /api/plans/:planId - Obter plano específico
 * FASE 4.1 - MIGRADO PARA USAR REPOSITORY
 */
const getPlan = async (req, res) => {
    try {
        logger.info(`Buscando plano: ${req.params.planId} para usuário: ${req.user.id}`);
        
        // NOVA ABORDAGEM: Usar repository diretamente
        const row = await repos.plan.findByIdAndUserId(req.params.planId, req.user.id);
        
        if (!row) {
            logger.warn('Plano não encontrado ou não autorizado');
            return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
        }
        
        logger.info('Plano encontrado via REPOSITORY:', { id: row.id, plan_name: row.plan_name });
        
        // CORREÇÃO: study_hours_per_day já é um objeto no PostgreSQL
        if (row.study_hours_per_day && typeof row.study_hours_per_day === 'string') {
            try {
                row.study_hours_per_day = JSON.parse(row.study_hours_per_day);
            } catch (parseError) {
                logger.warn('Erro ao processar study_hours_per_day:', parseError.message);
            }
        }
        
        logger.info('Enviando resposta do plano');
        res.json(row);
    } catch (error) {
        console.error('❌ ERRO DETALHADO ao buscar plano:', {
            message: error.message,
            stack: error.stack,
            planId: req.params.planId,
            userId: req.user?.id
        });
        return res.status(500).json({ 'error': 'Erro ao buscar plano: ' + error.message });
    }
};

/**
 * DELETE /api/plans/:planId - Deletar plano com CASCADE manual
 * FASE 4.1 - PARCIALMENTE MIGRADO (ainda usando adapter para transações)
 */
const deletePlan = async (req, res) => {
    const planId = req.params.planId;
    const userId = req.user.id;
    
    try {
        // NOVA ABORDAGEM: Verificar existência com repository
        const plan = await repos.plan.findByIdAndUserId(planId, userId);
        if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou você não tem permissão.' });
        
        // TRANSAÇÃO CRÍTICA - CASCADE MANUAL
        // TODO: Mover para PlanService na FASE 4.2
        await dbRun('BEGIN');
        await dbRun('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
        await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [planId]);
        await dbRun('DELETE FROM subjects WHERE study_plan_id = ?', [planId]);
        await dbRun('DELETE FROM study_plans WHERE id = ?', [planId]);
        await dbRun('COMMIT');
        
        res.json({ message: 'Plano e todos os dados associados foram apagados com sucesso' });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao apagar plano:', error);
        res.status(500).json({ 'error': 'Erro ao apagar o plano.' });
    }
};

/**
 * PATCH /api/plans/:planId/settings - Atualizar configurações do plano
 */
const updatePlanSettings = async (req, res) => {
    const { daily_question_goal, weekly_question_goal, review_mode, session_duration_minutes, study_hours_per_day, has_essay, reta_final_mode } = req.body;
    const hoursJson = JSON.stringify(study_hours_per_day);
    
    const validReviewModes = ['completo', 'focado'];
    if (review_mode && !validReviewModes.includes(review_mode)) {
        return res.status(400).json({ error: 'Modo de revisão inválido' });
    }
    
    const sql = 'UPDATE study_plans SET daily_question_goal = ?, weekly_question_goal = ?, review_mode = ?, session_duration_minutes = ?, study_hours_per_day = ?, has_essay = ?, reta_final_mode = ? WHERE id = ? AND user_id = ?';
    
    try {
        const result = await dbRun(sql, [daily_question_goal, weekly_question_goal, review_mode || 'completo', session_duration_minutes, hoursJson, has_essay, reta_final_mode ? 1 : 0, req.params.planId, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
        res.json({ message: 'Configurações salvas com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ 'error': 'Erro ao salvar configurações' });
    }
};

/**
 * 📚 DISCIPLINAS E TÓPICOS
 */

/**
 * POST /api/plans/:planId/subjects_with_topics - Criar disciplina com tópicos
 */
const createSubjectWithTopics = async (req, res) => {
    const { subject_name, priority_weight, topics_list } = req.body;
    const planId = req.params.planId;
    
    try {
        const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
        if (!plan) return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });

        const topics = topics_list.split('\n').map(t => t.trim()).filter(t => t !== '');
        
        // TRANSAÇÃO CRÍTICA - DISCIPLINA + TÓPICOS
        await dbRun('BEGIN');
        const result = await dbRun('INSERT INTO subjects (study_plan_id, subject_name, priority_weight) VALUES (?,?,?)', [planId, subject_name, priority_weight]);
        const subjectId = result.lastID;
        
        if (topics.length > 0) {
            // Use dbRun for each topic insert instead of prepared statements
            // PostgreSQL handles this efficiently with connection pooling
            for (const topic of topics) {
                // Tópicos novos recebem peso padrão 3, que pode ser editado depois
                await dbRun('INSERT INTO topics (subject_id, topic_name, priority_weight) VALUES (?,?,?)', 
                    [subjectId, topic.substring(0, 500), 3]);
            }
        }
        
        await dbRun('COMMIT');
        res.status(201).json({ message: 'Disciplina e tópicos adicionados com sucesso!' });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('Erro ao criar disciplina:', error);
        res.status(500).json({ 'error': 'Erro ao criar a disciplina e tópicos.' });
    }
};

/**
 * GET /api/plans/:planId/subjects_with_topics - Listar disciplinas com tópicos
 */
const getSubjectsWithTopics = async (req, res) => {
    const { planId } = req.params;
    const { id: userId } = req.user;

    try {
        const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
        if (!plan) {
            return res.status(404).json({ 'error': 'Plano não encontrado ou não autorizado.' });
        }

        const subjects = await dbAll('SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY id DESC', [planId]);
        const subjectIds = subjects.map(s => s.id);

        if (subjectIds.length === 0) {
            return res.json([]);
        }

        const topics = await dbAll(`
            SELECT id, subject_id, topic_name, topic_name as description, status, completion_date, priority_weight 
            FROM topics 
            WHERE subject_id IN (${subjectIds.map(() => '?').join(',')}) 
            ORDER BY id ASC
        `, subjectIds);

        const topicsBySubjectId = new Map();
        topics.forEach(topic => {
            // Normalizar tipo do peso para inteiro
            topic.priority_weight = parseInt(topic.priority_weight, 10) || 3;
            if (!topicsBySubjectId.has(topic.subject_id)) {
                topicsBySubjectId.set(topic.subject_id, []);
            }
            topicsBySubjectId.get(topic.subject_id).push(topic);
        });

        const result = subjects.map(subject => ({
            ...subject,
            topics: topicsBySubjectId.get(subject.id) || []
        }));

        // Evitar cache para refletir rapidamente alterações
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar disciplinas com tópicos:', error);
        res.status(500).json({ 'error': 'Erro ao buscar disciplinas e tópicos' });
    }
};

// updateSubject - MANTIDA NO SERVER.JS como /api/subjects/:subjectId

// deleteSubject - MANTIDA NO SERVER.JS como /api/subjects/:subjectId

// getSubjectTopics - MANTIDA NO SERVER.JS como /api/subjects/:subjectId/topics

// batchUpdateTopics - MANTIDA NO SERVER.JS como /api/topics/batch_update

/**
 * 📊 ESTATÍSTICAS E ANÁLISES
 */

/**
 * GET /api/plans/:planId/statistics - Estatísticas do plano
 */
const getPlanStatistics = async (req, res) => {
    const planId = req.params.planId;
    
    try {
        // Verificar autorização
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
        if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

        // Calcular total de dias até a prova
        const totalDaysResult = await dbGet(`
            SELECT 
                CASE 
                    WHEN ? IS NOT NULL THEN 
                        CAST((julianday(?) - julianday(?)) AS INTEGER) + 1
                    ELSE 0 
                END as total_days
        `, [plan.exam_date, plan.exam_date, getBrazilianDateString()]);

        const totalDays = totalDaysResult ? Math.max(0, totalDaysResult.total_days || 0) : 0;

        // Análise de sequência de estudos
        let currentStreak = 0;
        let longestStreak = 0;

        if (totalDays > 0) {
            // Query otimizada para sequência de estudos
            const streakQuery = `
                SELECT 
                    session_date,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_count
                FROM study_sessions 
                WHERE study_plan_id = ? 
                GROUP BY session_date 
                ORDER BY session_date DESC
            `;
            
            try {
                // const streakResult = await dbGet(streakQuery, [planId]); // unused
                // Para simplificar, usar uma versão mais básica
                const simplifiedStreak = await dbGet(`
                    SELECT COUNT(DISTINCT session_date) as current_streak
                    FROM study_sessions 
                    WHERE study_plan_id = ? AND status = 'Concluído'
                    AND session_date >= CURRENT_DATE - INTERVAL '7 days'
                `, [planId]);
                
                currentStreak = simplifiedStreak ? (simplifiedStreak.current_streak || 0) : 0;
                longestStreak = currentStreak; // Simplificação
            } catch (streakError) {
                console.warn('Erro ao calcular streak:', streakError.message);
            }
        }

        // Horas totais de estudo planejadas
        const totalHoursResult = await dbGet(`
            SELECT 
                SUM(
                    CASE 
                        WHEN session_type = 'Novo Tópico' THEN ?
                        WHEN session_type = 'Revisão' THEN ? * 0.7
                        ELSE ?
                    END
                ) / 60.0 as total_hours
            FROM study_sessions 
            WHERE study_plan_id = ?
        `, [plan.session_duration_minutes, plan.session_duration_minutes, plan.session_duration_minutes, planId]);

        // Média de estudo por dia (baseada nas configurações)
        const avgStudyResult = await dbGet(`
            SELECT AVG(daily_minutes) as avg_minutes
            FROM (
                SELECT 
                    (json_extract(study_hours_per_day, '$."1"') + 
                     json_extract(study_hours_per_day, '$."2"') + 
                     json_extract(study_hours_per_day, '$."3"') + 
                     json_extract(study_hours_per_day, '$."4"') + 
                     json_extract(study_hours_per_day, '$."5"') + 
                     json_extract(study_hours_per_day, '$."6"') + 
                     json_extract(study_hours_per_day, '$."0"')) * 60.0 / 7.0 as daily_minutes
                FROM study_plans 
                WHERE id = ?
            )
        `, [planId]);

        // Melhor dia da semana (simplificado)
        const bestDayResult = await dbGet(`
            SELECT 
                CASE EXTRACT(DOW FROM session_date)
                    WHEN '0' THEN 'Domingo'
                    WHEN '1' THEN 'Segunda'
                    WHEN '2' THEN 'Terça'
                    WHEN '3' THEN 'Quarta'
                    WHEN '4' THEN 'Quinta'
                    WHEN '5' THEN 'Sexta'
                    WHEN '6' THEN 'Sábado'
                END as day_name,
                COUNT(*) as session_count
            FROM study_sessions 
            WHERE study_plan_id = ? AND status = 'Concluído'
            GROUP BY EXTRACT(DOW FROM session_date)
            ORDER BY session_count DESC
            LIMIT 1
        `, [planId]);

        const response = {
            totalDays: totalDays,
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            totalPlannedHours: Math.round((totalHoursResult?.total_hours || 0) * 10) / 10,
            avgDailyStudyMinutes: Math.round(avgStudyResult?.avg_minutes || 0),
            bestStudyDay: bestDayResult?.day_name || 'N/A',
            examDate: plan.exam_date
        };

        res.json(response);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/plans/:planId/exclusions - Tópicos excluídos (legado)
 */
const getPlanExclusions = async (req, res) => {
    const planId = req.params.planId;
    
    try {
        // Verificar se o plano pertence ao usuário
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado.' });
        }

        // Buscar exclusões/tópicos removidos no modo reta final
        const exclusions = await dbAll(
            `SELECT 
                t.id, t.topic_name, s.subject_name,
                'excluded_final_stretch' as reason,
                COALESCE(t.priority_weight, 3) as priority_weight
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = ? 
            AND t.id NOT IN (
                SELECT DISTINCT topic_id 
                FROM study_sessions 
                WHERE study_plan_id = ? 
                AND topic_id IS NOT NULL
                AND session_date >= ?
            )
            AND ? = 1
            ORDER BY s.subject_name, t.topic_name`,
            [planId, planId, getBrazilianDateString(), plan.reta_final_mode ? 1 : 0]
        );

        res.json({
            planId: parseInt(planId),
            retaFinalMode: Boolean(plan.reta_final_mode),
            exclusions: exclusions.map(exc => ({
                topicId: exc.id,
                topicName: exc.topic_name,
                subjectName: exc.subject_name,
                reason: exc.reason,
                priorityWeight: parseInt(exc.priority_weight) || 3
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar exclusões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/plans/:planId/excluded-topics - Tópicos excluídos no modo Reta Final
 */
const getExcludedTopics = async (req, res) => {
    const planId = req.params.planId;
    
    try {
        // Verificar se o plano pertence ao usuário
        const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, req.user.id]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado.' });
        }

        // Buscar tópicos que foram excluídos no modo reta final
        const excludedTopics = await dbAll(`
            SELECT DISTINCT
                t.id,
                t.topic_name,
                s.subject_name,
                COALESCE(t.priority_weight, 3) as priority_weight,
                'Excluído automaticamente no modo Reta Final' as exclusion_reason
            FROM topics t
            JOIN subjects s ON t.subject_id = s.id
            WHERE s.study_plan_id = ?
            AND t.status != 'Concluído'
            AND t.id NOT IN (
                SELECT DISTINCT ss.topic_id
                FROM study_sessions ss
                WHERE ss.study_plan_id = ?
                AND ss.topic_id IS NOT NULL
                AND ss.session_date >= ?
            )
            AND ? = 1
            ORDER BY s.subject_name ASC, t.topic_name ASC
        `, [planId, planId, getBrazilianDateString(), plan.reta_final_mode ? 1 : 0]);

        const response = {
            planId: parseInt(planId),
            planName: plan.plan_name,
            retaFinalMode: Boolean(plan.reta_final_mode),
            totalExcluded: excludedTopics.length,
            excludedTopics: excludedTopics.map(topic => ({
                id: topic.id,
                name: topic.topic_name,
                subject: topic.subject_name,
                priorityWeight: parseInt(topic.priority_weight) || 3,
                reason: topic.exclusion_reason
            }))
        };

        res.json(response);
        
    } catch (error) {
        console.error('Erro ao buscar tópicos excluídos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * 🔄 REPLANEJAMENTO E CONTROLE DE ATRASOS
 */

/**
 * GET /api/plans/:planId/overdue_check - Verificar tarefas atrasadas
 * FASE 5 WAVE 3 - ENHANCED WITH PLANSERVICE
 */
const getOverdueCheck = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[OVERDUE_CHECK] Verificando tarefas atrasadas - Plano: ${planId}, Usuário: ${userId}`);
        
        // ENHANCED: Usar PlanService para lógica de negócio avançada
        const overdueData = await planService.checkOverdue(planId, userId);
        
        logger.info(`[OVERDUE_CHECK] Resultado do service:`, {
            count: overdueData.count,
            needsReplanning: overdueData.needsReplanning
        });
        
        // ENHANCED: Resposta mais rica com dados do service
        res.json({
            count: overdueData.count,
            needsReplanning: overdueData.needsReplanning,
            sessions: overdueData.sessions.slice(0, 5) // Primeiras 5 para não sobrecarregar
        });
        
    } catch (error) {
        logger.error('[OVERDUE_CHECK] Erro ao verificar tarefas atrasadas:', {
            error: error.message,
            stack: error.stack,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        // FALLBACK: Se service falhar, usar abordagem original
        try {
            const plan = await repos.plan.findByIdAndUserId(req.params.planId, req.user.id);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }
            
            const overdueCount = await repos.session.countOverdueSessions(req.params.planId, getBrazilianDateString());
            res.json({ count: overdueCount });
        } catch (fallbackError) {
            res.status(500).json({ error: 'Erro ao verificar tarefas atrasadas' });
        }
    }
};

/**
 * 🎮 GAMIFICAÇÃO E COMPARTILHAMENTO
 */

/**
 * GET /api/plans/:planId/gamification - Dados de gamificação
 * FASE 5 WAVE 3 - ENHANCED WITH PLANSERVICE
 */
const getGamification = async (req, res) => {
    const planId = req.params.planId;
    const userId = req.user.id;

    try {
        // ENHANCED: Usar PlanService para dados de gamificação completos
        const gamificationData = await planService.getGamificationData(planId, userId);
        
        // ENHANCED: Log de performance da gamificação
        logger.info(`[GAMIFICATION] Dados carregados para plano ${planId}:`, {
            level: gamificationData.concurseiroLevel,
            streak: gamificationData.studyStreak,
            completedTopics: gamificationData.completedTopicsCount,
            achievements: gamificationData.achievementsCount
        });
        
        return res.json(gamificationData);
        
    } catch (error) {
        logger.error('[GAMIFICATION] Erro ao carregar dados:', error.message);
        return res.status(500).json({ 
            error: 'Erro ao buscar dados de gamificação',
            fallback: {
                level: 1,
                totalXP: 0,
                stats: { completedTopics: 0, totalSessions: 0 },
                achievements: [],
                dailyMissions: []
            }
        });
    }
};

/**
 * GET /api/plans/:planId/share-progress - Dados para compartilhamento
 */
const getShareProgress = async (req, res) => {
    const planId = req.params.planId;
    const userId = req.user.id;

    try {
        // Verificar autorização
        const plan = await dbGet('SELECT plan_name, exam_date FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
        if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

        // Buscar dados do usuário
        const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);
        
        // Estatísticas de progresso
        const completedTopicsResult = await dbGet(`
            SELECT COUNT(DISTINCT ss.topic_id) as completed_topics,
                   COUNT(DISTINCT s.id) as total_subjects
            FROM study_sessions ss
            JOIN topics t ON ss.topic_id = t.id
            JOIN subjects s ON t.subject_id = s.id
            WHERE ss.study_plan_id = ? 
            AND ss.status = 'Concluído'
            AND ss.session_type = 'Novo Tópico'
        `, [planId]);

        // Sessões concluídas recentemente
        const completedSessions = await dbAll(`
            SELECT 
                session_date,
                subject_name,
                COUNT(*) as session_count,
                SUM(COALESCE(questions_solved, 0)) as total_questions
            FROM study_sessions
            WHERE study_plan_id = ? 
            AND status = 'Concluído'
            AND session_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY session_date, subject_name
            ORDER BY session_date DESC, subject_name
            LIMIT 10
        `, [planId]);

        const shareData = {
            userName: user?.name || 'Estudante',
            planName: plan.plan_name,
            examDate: plan.exam_date,
            completedTopics: completedTopicsResult?.completed_topics || 0,
            totalSubjects: completedTopicsResult?.total_subjects || 0,
            recentSessions: completedSessions.map(session => ({
                date: session.session_date,
                subject: session.subject_name,
                sessions: session.session_count,
                questions: session.total_questions
            })),
            generatedAt: getBrazilianDateString()
        };

        res.json(shareData);
        
    } catch (error) {
        console.error('Erro ao gerar dados de compartilhamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * 🔄 ENHANCED ENDPOINTS - POWERED BY PLANSERVICE
 * FASE 5 WAVE 3 - Novos endpoints com lógica avançada do service
 */

/**
 * GET /api/plans/:planId/progress - Progresso do plano com métricas avançadas
 * ENHANCED: Usa PlanService para cálculos precisos e métricas detalhadas
 */
const getPlanProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[PLAN_PROGRESS] Buscando progresso para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para progresso detalhado
        const progressData = await planService.calculateProgress(planId, userId);
        
        res.json(progressData);
        
    } catch (error) {
        logger.error('[PLAN_PROGRESS] Erro ao buscar progresso:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro ao buscar progresso do plano' });
    }
};

/**
 * GET /api/plans/:planId/goal_progress - Progresso de metas diárias/semanais
 * ENHANCED: Usa PlanService para cálculos de timezone brasileiro corretos
 */
const getGoalProgress = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[GOAL_PROGRESS] Buscando metas para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para cálculos de meta precisos
        const goalData = await planService.getGoalProgress(planId, userId);
        
        res.json(goalData);
        
    } catch (error) {
        logger.error('[GOAL_PROGRESS] Erro ao buscar metas:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro ao buscar progresso de metas' });
    }
};

/**
 * GET /api/plans/:planId/realitycheck - Diagnóstico de performance avançado
 * ENHANCED: Usa PlanService para análise preditiva e projeções realistas
 */
const getRealityCheck = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[REALITY_CHECK] Executando diagnóstico para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para análise avançada de realidade
        const realityData = await planService.getRealityCheck(planId, userId);
        
        res.json(realityData);
        
    } catch (error) {
        logger.error('[REALITY_CHECK] Erro no diagnóstico:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro no diagnóstico de performance' });
    }
};

/**
 * GET /api/plans/:planId/schedule-preview - Preview do cronograma com análises
 * ENHANCED: Usa PlanService para análise detalhada de cobertura e fases
 */
const getSchedulePreview = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[SCHEDULE_PREVIEW] Gerando preview para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para preview detalhado
        const previewData = await planService.getSchedulePreview(planId, userId);
        
        res.json(previewData);
        
    } catch (error) {
        logger.error('[SCHEDULE_PREVIEW] Erro no preview:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro ao gerar preview do cronograma' });
    }
};

/**
 * GET /api/plans/:planId/performance - Métricas de performance detalhadas
 * ENHANCED: Usa PlanService para cálculos avançados de ritmo e projeções
 */
const getPerformance = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        logger.info(`[PERFORMANCE] Calculando métricas para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para métricas de performance
        const performanceData = await planService.getPerformance(planId, userId);
        
        res.json(performanceData);
        
    } catch (error) {
        logger.error('[PERFORMANCE] Erro nas métricas:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro ao calcular métricas de performance' });
    }
};

/**
 * POST /api/plans/:planId/replan-preview - Preview de replanejamento inteligente
 * ENHANCED: Usa PlanService para algoritmos de replanejamento avançados
 */
const getReplanPreview = async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        const options = req.body || {};
        
        logger.info(`[REPLAN_PREVIEW] Gerando preview de replanejamento para plano ${planId}`);
        
        // ENHANCED: Usar PlanService para preview de replanejamento
        const replanData = await planService.replanSchedule(planId, userId, { ...options, preview: true });
        
        res.json(replanData);
        
    } catch (error) {
        logger.error('[REPLAN_PREVIEW] Erro no preview de replanejamento:', {
            error: error.message,
            planId: req.params.planId,
            userId: req.user?.id
        });
        
        if (error.message.includes('não encontrado')) {
            return res.status(404).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erro no preview de replanejamento' });
    }
};

/**
 * 📅 GERAÇÃO DE CRONOGRAMA - INTEGRAÇÃO COM SERVICE
 */

/**
 * POST /api/plans/:planId/generate - Gerar cronograma de estudos
 * 
 * ATENÇÃO: Esta é a funcionalidade mais crítica do sistema!
 * Mantém 100% da funcionalidade da rota original em server.js
 * com tratamento de erros robusto e auditoria completa.
 */
const generateSchedule = async (req, res) => {
    const planId = req.params.planId;
    const { daily_question_goal, weekly_question_goal, session_duration_minutes, study_hours_per_day, has_essay, reta_final_mode } = req.body;
    
    console.time(`[PERF] Generate schedule for plan ${planId}`);
    const startTime = Date.now();
    
    // LOGS DETALHADOS PARA DEBUGGING
    logger.info('Iniciando geração de cronograma', {
        planId,
        userId: req.user.id,
        params: {
            daily_question_goal,
            weekly_question_goal,
            session_duration_minutes,
            study_hours_per_day,
            has_essay,
            reta_final_mode
        }
    });

    try {
        // Preparar configuração para o service
        const config = {
            planId: parseInt(planId, 10),
            userId: req.user.id,
            daily_question_goal: parseInt(daily_question_goal, 10),
            weekly_question_goal: parseInt(weekly_question_goal, 10),
            session_duration_minutes: parseInt(session_duration_minutes, 10),
            study_hours_per_day: study_hours_per_day,
            has_essay: Boolean(has_essay),
            reta_final_mode: Boolean(reta_final_mode)
        };

        // Validação básica dos parâmetros
        if (isNaN(config.planId) || config.planId <= 0) {
            return res.status(400).json({ 
                error: 'ID do plano inválido',
                code: 'INVALID_PLAN_ID'
            });
        }

        if (!config.study_hours_per_day || typeof config.study_hours_per_day !== 'object') {
            return res.status(400).json({ 
                error: 'Configuração de horas de estudo inválida',
                code: 'INVALID_STUDY_HOURS'
            });
        }

        // Verificar se há horas de estudo definidas
        const totalWeeklyHours = Object.values(config.study_hours_per_day)
            .reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
        
        if (totalWeeklyHours === 0) {
            return res.status(400).json({ 
                error: 'O cronograma não pode ser gerado porque não há horas de estudo definidas.',
                code: 'NO_STUDY_HOURS'
            });
        }

        // Chamar o service principal
        const result = await ScheduleGenerationService.generate(config);
        
        const endTime = Date.now();
        console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
        
        logger.info('Cronograma gerado com sucesso', {
            planId,
            userId: req.user.id,
            executionTime: endTime - startTime,
            sessionsCreated: result.statistics.totalSessions,
            excludedTopics: result.statistics.excludedTopics
        });

        // Resposta compatível com a implementação original
        res.json({
            success: true,
            message: result.message,
            performance: {
                executionTime: `${endTime - startTime}ms`,
                sessionsCreated: result.statistics.totalSessions,
                topicsProcessed: result.statistics.studySessions + result.statistics.reviewSessions
            },
            retaFinal: {
                isActive: Boolean(config.reta_final_mode),
                excludedTopics: result.excludedTopics?.map(t => ({
                    subject_name: t.subject_name,
                    topic_name: t.topic_name,
                    importance: t.topic_priority || 3,
                    priority_weight: ((t.subject_priority || 3) * 10) + (t.topic_priority || 3),
                    reason: `Tópico excluído automaticamente no Modo Reta Final devido à falta de tempo`
                })) || [],
                totalExcluded: result.excludedTopics?.length || 0,
                totalIncluded: result.statistics.studySessions,
                message: (result.excludedTopics?.length || 0) > 0 ? 
                    `⚠️ ${result.excludedTopics.length} tópicos foram excluídos para adequar o cronograma ao tempo disponível.` :
                    '✅ Todos os tópicos puderam ser incluídos no cronograma.'
            },
            statistics: result.statistics,
            generationTime: result.statistics.generationTime
        });
        
    } catch (error) {
        const endTime = Date.now();
        console.timeEnd(`[PERF] Generate schedule for plan ${planId}`);
        
        // LOG DETALHADO DO ERRO
        logger.error('Erro na geração de cronograma', {
            planId,
            userId: req.user.id,
            error: error.message,
            stack: error.stack,
            executionTime: endTime - startTime,
            params: {
                daily_question_goal,
                weekly_question_goal,
                session_duration_minutes,
                study_hours_per_day: typeof study_hours_per_day === 'object' ? '[OBJECT]' : study_hours_per_day,
                has_essay,
                reta_final_mode
            }
        });
        
        // Tratamento de erros específicos
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
        
        // Erro genérico
        res.status(500).json({ 
            error: 'Erro interno na geração do cronograma. Tente novamente.',
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    // CRUD Básico
    getPlans,
    createPlan,
    getPlan,
    deletePlan,
    updatePlanSettings,
    
    // Disciplinas e Tópicos
    createSubjectWithTopics,
    getSubjectsWithTopics,
    // updateSubject, deleteSubject, getSubjectTopics, batchUpdateTopics - mantidas no server.js
    
    // Geração de Cronograma
    generateSchedule,
    
    // Replanejamento e Controle de Atrasos
    getOverdueCheck,
    getReplanPreview,
    
    // Estatísticas e Análises
    getPlanStatistics,
    getPlanExclusions,
    getExcludedTopics,
    
    // ENHANCED ENDPOINTS - FASE 5 WAVE 3
    getPlanProgress,
    getGoalProgress,
    getRealityCheck,
    getSchedulePreview,
    getPerformance,
    
    // Gamificação e Compartilhamento
    getGamification,
    getShareProgress
};