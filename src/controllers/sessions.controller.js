const db = require('../../database-postgresql.js');
const { validationResult } = require('express-validator');

// === PHASE 5 WAVE 2 - SERVICE INTEGRATION ===
// Import SessionService for enhanced functionality
let sessionService = null;

try {
    const { SessionService } = require('../services/index.js');
    // Note: Service will be initialized when repositories are available
    console.log('✅ SessionService import ready for Wave 2 integration');
} catch (error) {
    console.log('⚠️ SessionService not available - using legacy mode');
}

/**
 * Initialize SessionService when repositories become available
 */
function initializeSessionService(repositories, database) {
    try {
        if (!sessionService && repositories && database) {
            const { SessionService } = require('../services/index.js');
            sessionService = new SessionService(repositories, database);
            console.log('🔧 SessionService initialized for enhanced functionality');
        }
        return sessionService;
    } catch (error) {
        console.log('⚠️ Could not initialize SessionService, continuing with legacy mode');
        return null;
    }
}

/**
 * Enhanced service wrapper - provides service enhancements while maintaining compatibility
 */
function withServiceEnhancement(legacyFunction) {
    return async (req, res) => {
        try {
            // Try service enhancement first (if available)
            const service = initializeSessionService(global.repositories, db);
            if (service && req.params.planId) {
                // Service available - could add enhancements here
                // For now, maintain compatibility by using legacy
            }
            
            // Always execute legacy function for reliability
            return await legacyFunction(req, res);
        } catch (error) {
            console.error('Service enhancement error:', error);
            // Fallback to legacy function on any service error
            return await legacyFunction(req, res);
        }
    };
}

// BRAZILIAN TIMEZONE UTILITY - CRITICAL FOR DATE HANDLING
function getBrazilianDateString() {
    const now = new Date();
    // Criar objeto Date diretamente no timezone brasileiro
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// DATABASE HELPER FUNCTIONS
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Database run error:', err.message);
                reject(err);
            } else {
                resolve({ changes: this.changes, lastID: this.lastID });
            }
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error('Database get error:', err.message);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Database all error:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

class SessionsController {
    
    /**
     * Get sessions grouped by date (schedule view)
     * GET /api/sessions/by-date/:planId
     */
    static async getSessionsByDate(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;

        try {
            // Verify plan ownership
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }

            // Get all sessions ordered by date
            const rows = await dbAll(
                'SELECT * FROM study_sessions WHERE study_plan_id = ? ORDER BY session_date ASC, id ASC', 
                [planId]
            );

            // Group sessions by date - CRITICAL for frontend display
            const groupedByDate = rows.reduce((acc, session) => {
                const date = session.session_date;
                if (!acc[date]) acc[date] = [];
                acc[date].push(session);
                return acc;
            }, {});

            res.json(groupedByDate);

        } catch (error) {
            console.error('Erro ao buscar cronograma:', error);
            res.status(500).json({ error: 'Erro ao buscar cronograma' });
        }
    }

    /**
     * Check overdue sessions count
     * GET /api/sessions/overdue-check/:planId
     */
    static async getOverdueCheck(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;

        try {
            // Verify plan ownership
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }

            // Use Brazilian timezone for accurate overdue calculation
            const todayStr = getBrazilianDateString();
            const result = await dbGet(
                'SELECT COUNT(id) as count FROM study_sessions WHERE study_plan_id = ? AND status = \'Pendente\' AND session_date < ?', 
                [planId, todayStr]
            );

            res.json(result);

        } catch (error) {
            console.error('Erro ao verificar tarefas atrasadas:', error);
            res.status(500).json({ error: 'Erro ao verificar tarefas atrasadas' });
        }
    }

    /**
     * Update individual session status
     * PATCH /api/sessions/:sessionId
     */
    static async updateSessionStatus(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        try {
            // Verify session exists and user has access
            const session = await dbGet(`
                SELECT ss.* FROM study_sessions ss
                JOIN study_plans sp ON ss.study_plan_id = sp.id
                WHERE ss.id = ? AND sp.user_id = ?
            `, [sessionId, userId]);

            if (!session) {
                return res.status(404).json({ error: 'Sessão não encontrada ou não autorizada.' });
            }

            // Update session status
            await dbRun('UPDATE study_sessions SET status = ? WHERE id = ?', [status, sessionId]);

            res.json({ 
                message: 'Sessão atualizada com sucesso!', 
                status,
                sessionId: parseInt(sessionId)
            });

        } catch (error) {
            console.error('Erro ao atualizar sessão:', error);
            res.status(500).json({ error: 'Erro ao atualizar a sessão.' });
        }
    }

    /**
     * Batch update session status - CRITICAL for performance
     * PATCH /api/sessions/batch-update-status
     */
    static async batchUpdateStatus(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessions } = req.body;
        const userId = req.user.id;

        try {
            await dbRun('BEGIN');
            
            // Security: Update only sessions that belong to user's plans
            const updateSql = `
                UPDATE study_sessions 
                SET status = ? 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM study_plans
                    WHERE study_plans.id = study_sessions.study_plan_id
                    AND study_plans.user_id = ?
                )
            `;

            let updatedCount = 0;
            for (const session of sessions) {
                const sessionId = parseInt(session.id, 10);
                if (isNaN(sessionId)) continue;

                const result = await dbRun(updateSql, [session.status, sessionId, userId]);
                if (result.changes === 0) {
                    console.warn(`Sessão ${sessionId} não encontrada ou não autorizada para o usuário ${userId}.`);
                } else {
                    updatedCount++;
                }
            }
            
            await dbRun('COMMIT');
            
            res.json({ 
                message: 'Missão Cumprida! Seu cérebro agradece. 💪',
                updatedCount
            });

        } catch (error) {
            await dbRun('ROLLBACK');
            console.error('ERRO no batch_update_status:', error);
            res.status(500).json({ error: 'Ocorreu um erro no servidor ao atualizar as sessões.' });
        }
    }

    /**
     * Register study time for a session - CRITICAL for analytics
     * POST /api/sessions/:sessionId/time
     */
    static async registerStudyTime(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { seconds } = req.body;
        const userId = req.user.id;

        try {
            // Verify session exists and user has access
            const session = await dbGet(`
                SELECT ss.* FROM study_sessions ss 
                JOIN study_plans sp ON ss.study_plan_id = sp.id 
                WHERE ss.id = ? AND sp.user_id = ?
            `, [sessionId, userId]);

            if (!session) {
                return res.status(404).json({ error: 'Sessão não encontrada ou não autorizada.' });
            }

            // Add time to existing time_studied_seconds
            await dbRun(`
                UPDATE study_sessions 
                SET time_studied_seconds = COALESCE(time_studied_seconds, 0) + ?
                WHERE id = ?
            `, [seconds, sessionId]);

            const newTotalTime = (session.time_studied_seconds || 0) + seconds;

            res.json({ 
                message: 'Tempo registrado com sucesso!', 
                totalTime: newTotalTime,
                addedSeconds: seconds
            });

        } catch (error) {
            console.error('Erro ao salvar tempo de estudo:', error);
            res.status(500).json({ error: 'Erro ao registrar tempo de estudo.' });
        }
    }

    /**
     * Create reinforcement session - CRITICAL for spaced repetition
     * POST /api/sessions/:sessionId/reinforce
     * ENHANCED with SessionService integration (Wave 2)
     */
    static async createReinforcementSession(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const userId = req.user.id;

        try {
            // === PHASE 5 WAVE 2 - SERVICE ENHANCEMENT ===
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    // Get session to find planId for service call
                    const sessionCheck = await dbGet(
                        'SELECT ss.study_plan_id FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?', 
                        [sessionId, userId]
                    );
                    
                    if (sessionCheck) {
                        const result = await service.reinforceSession(sessionId, sessionCheck.study_plan_id, userId);
                        if (result) {
                            console.log('🔄 Using enhanced SessionService reinforcement');
                            return res.status(201).json({
                                message: 'Sessão de reforço criada com sucesso!',
                                reinforcementId: result.id,
                                scheduledDate: result.session_date,
                                source: 'service'
                            });
                        }
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service reinforcement failed, using legacy:', serviceError.message);
                }
            }
            
            // === LEGACY MODE - MAINTAIN FULL COMPATIBILITY ===
            // Get original session with authorization check
            const session = await dbGet(
                'SELECT ss.* FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?', 
                [sessionId, userId]
            );

            if (!session || !session.topic_id) {
                return res.status(404).json({ 
                    error: 'Sessão original não encontrada ou não é um tópico estudável.' 
                });
            }
            
            // Schedule reinforcement for 3 days from now (spaced repetition principle)
            const reinforceDate = new Date();
            reinforceDate.setDate(reinforceDate.getDate() + 3);
            const reinforceDateStr = reinforceDate.toISOString().split('T')[0];
            
            // Create reinforcement session
            const sql = `INSERT INTO study_sessions 
                (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            await dbRun(sql, [
                session.study_plan_id, 
                session.topic_id, 
                session.subject_name, 
                session.topic_description, 
                reinforceDateStr, 
                'Reforço Extra', 
                'Pendente'
            ]);
            
            res.status(201).json({ 
                message: `Sessão de reforço agendada para ${reinforceDate.toLocaleDateString('pt-BR')}!`,
                reinforceDate: reinforceDateStr,
                source: 'legacy'
            });

        } catch (error) {
            console.error('Erro ao agendar reforço:', error);
            res.status(500).json({ error: 'Erro ao agendar a sessão de reforço.' });
        }
    }

    /**
     * Postpone session with intelligent date finding - COMPLEX ALGORITHM
     * PATCH /api/sessions/:sessionId/postpone
     * ENHANCED with SessionService integration (Wave 2)
     */
    static async postponeSession(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const { days } = req.body;
        const userId = req.user.id;

        try {
            // === PHASE 5 WAVE 2 - SERVICE ENHANCEMENT ===
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    // Get session to find planId
                    const sessionCheck = await dbGet('SELECT study_plan_id FROM study_sessions WHERE id = ?', [sessionId]);
                    if (sessionCheck) {
                        // Calculate target date from days parameter
                        let targetDate = null;
                        if (days !== 'next') {
                            const currentDate = new Date();
                            currentDate.setDate(currentDate.getDate() + parseInt(days, 10));
                            targetDate = currentDate.toISOString().split('T')[0];
                        }
                        
                        const result = await service.postponeSession(sessionId, sessionCheck.study_plan_id, userId, 'user_request', targetDate);
                        if (result) {
                            console.log('🗓️ Using enhanced SessionService postponement');
                            return res.json({
                                message: `Tarefa adiada para ${new Date(result.newDate).toLocaleDateString('pt-BR')}!`,
                                newDate: result.newDate,
                                postponementCount: result.postponementCount,
                                analysis: result.analysis,
                                source: 'service'
                            });
                        }
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service postponement failed, using legacy:', serviceError.message);
                }
            }
            
            // === LEGACY MODE - MAINTAIN FULL COMPATIBILITY ===
            // Get session with validation
            const session = await dbGet('SELECT * FROM study_sessions WHERE id = ?', [sessionId]);
            if (!session) {
                return res.status(404).json({ error: 'Sessão não encontrada.' });
            }

            // Verify user authorization
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [session.study_plan_id, userId]);
            if (!plan) {
                return res.status(403).json({ error: 'Não autorizado.' });
            }

            // Get study hours configuration and exam date
            const studyHoursPerDay = JSON.parse(plan.study_hours_per_day);
            const examDate = new Date(plan.exam_date + 'T23:59:59');

            // CRITICAL: Find next available study day algorithm
            const findNextStudyDay = (date) => {
                const nextDay = new Date(date);
                while (nextDay <= examDate) {
                    // Skip Sundays (day 0) and days with no study hours
                    if (nextDay.getDay() !== 0 && (studyHoursPerDay[nextDay.getDay()] || 0) > 0) {
                        return nextDay;
                    }
                    nextDay.setDate(nextDay.getDate() + 1);
                }
                return null;
            };

            // Calculate target date
            const targetDate = new Date(session.session_date + 'T00:00:00');
            if (days === 'next') {
                targetDate.setDate(targetDate.getDate() + 1);
            } else {
                targetDate.setDate(targetDate.getDate() + parseInt(days, 10));
            }

            // Find the next available study day
            const newDate = findNextStudyDay(targetDate);

            if (!newDate) {
                return res.status(400).json({ 
                    error: 'Não há dias de estudo disponíveis para adiar a tarefa.' 
                });
            }

            // Update session date
            const newDateStr = newDate.toISOString().split('T')[0];
            await dbRun('UPDATE study_sessions SET session_date = ? WHERE id = ?', [newDateStr, sessionId]);

            res.json({ 
                message: `Tarefa adiada para ${newDate.toLocaleDateString('pt-BR')}!`,
                newDate: newDateStr,
                originalDate: session.session_date,
                source: 'legacy'
            });

        } catch (error) {
            console.error('Erro ao adiar tarefa:', error);
            res.status(500).json({ error: 'Erro interno ao adiar a tarefa.' });
        }
    }

    /**
     * Get session statistics for analytics - COMPLEX CALCULATIONS
     * GET /api/sessions/statistics/:planId
     * ENHANCED with SessionService integration (Wave 2)
     */
    static async getSessionStatistics(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;

        try {
            // === PHASE 5 WAVE 2 - SERVICE ENHANCEMENT ===
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    const enhancedStats = await service.getSessionStatistics(planId, userId);
                    if (enhancedStats) {
                        console.log('📊 Using enhanced SessionService statistics');
                        // Add service-specific enhancements
                        enhancedStats.source = 'service';
                        enhancedStats.timestamp = new Date().toISOString();
                        return res.json(enhancedStats);
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service enhancement failed, using legacy:', serviceError.message);
                }
            }
            
            // === LEGACY MODE - MAINTAIN FULL COMPATIBILITY ===
            // Verify plan ownership
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado ou não autorizado.' });
            }

            // 1. Total study days
            const totalDaysResult = await dbGet(`
                SELECT COUNT(DISTINCT DATE(session_date)) as total_days
                FROM study_sessions
                WHERE study_plan_id = ?
                AND (time_studied_seconds > 0 OR status = 'Concluído')
            `, [planId]);

            // 2. Current streak calculation - COMPLEX LOGIC
            let currentStreak = 0;
            try {
                const streakQuery = `
                    WITH RECURSIVE study_dates AS (
                        SELECT DISTINCT DATE(session_date) as study_date
                        FROM study_sessions
                        WHERE study_plan_id = ?
                        AND (time_studied_seconds > 0 OR status = 'Concluído')
                        ORDER BY study_date DESC
                    ),
                    recent_dates AS (
                        SELECT study_date,
                               LAG(study_date, 1) OVER (ORDER BY study_date DESC) as prev_date
                        FROM study_dates
                        LIMIT 30
                    )
                    SELECT COUNT(*) as streak
                    FROM recent_dates
                    WHERE CURRENT_DATE - INTERVAL '1 days' <= study_date
                    AND (prev_date IS NULL OR DATE(prev_date, '+1 day') = study_date)
                `;
                
                const streakResult = await dbGet(streakQuery, [planId]);
                currentStreak = streakResult?.streak || 0;
            } catch (error) {
                console.log('Usando cálculo simplificado de streak');
                const simplifiedStreak = await dbGet(`
                    SELECT COUNT(DISTINCT DATE(session_date)) as streak
                    FROM study_sessions
                    WHERE study_plan_id = ?
                    AND (time_studied_seconds > 0 OR status = 'Concluído')
                    AND session_date >= CURRENT_DATE - INTERVAL '7 days'
                `, [planId]);
                currentStreak = Math.min(simplifiedStreak?.streak || 0, 7);
            }

            // 3. Study hours and performance metrics
            const performanceResult = await dbGet(`
                SELECT 
                    COALESCE(SUM(time_studied_seconds) / 3600.0, 0) as total_hours,
                    COUNT(CASE WHEN time_studied_seconds > 0 OR status = 'Concluído' THEN 1 END) as completed_sessions,
                    COUNT(*) as total_sessions,
                    AVG(daily_seconds) / 3600.0 as avg_hours_per_day
                FROM (
                    SELECT 
                        DATE(session_date) as study_date,
                        SUM(time_studied_seconds) as daily_seconds
                    FROM study_sessions
                    WHERE study_plan_id = ?
                    AND time_studied_seconds > 0
                    GROUP BY DATE(session_date)
                ) as daily_stats
            `, [planId]);
            
            // 4. Best day of week for studying
            const bestDayResult = await dbGet(`
                SELECT 
                    EXTRACT(DOW FROM session_date) as day_of_week,
                    COUNT(*) as sessions_count
                FROM study_sessions
                WHERE study_plan_id = ?
                AND (time_studied_seconds > 0 OR status = 'Concluído')
                GROUP BY EXTRACT(DOW FROM session_date)
                ORDER BY sessions_count DESC
                LIMIT 1
            `, [planId]);

            // Map day of week to Portuguese
            const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const bestDay = bestDayResult ? dayNames[bestDayResult.day_of_week] : 'Não determinado';

            const statistics = {
                totalStudyDays: totalDaysResult?.total_days || 0,
                currentStreak,
                totalHours: parseFloat(performanceResult?.total_hours || 0),
                completedSessions: performanceResult?.completed_sessions || 0,
                totalSessions: performanceResult?.total_sessions || 0,
                avgHoursPerDay: parseFloat(performanceResult?.avg_hours_per_day || 0),
                bestDayForStudy: bestDay,
                completionRate: performanceResult?.total_sessions > 0 
                    ? ((performanceResult.completed_sessions / performanceResult.total_sessions) * 100) 
                    : 0,
                source: 'legacy', // Indicate data source
                timestamp: new Date().toISOString()
            };

            res.json(statistics);

        } catch (error) {
            console.error('Erro ao calcular estatísticas de sessões:', error);
            res.status(500).json({ error: 'Erro ao calcular estatísticas' });
        }
    }

    /**
     * Get daily and weekly question progress
     * GET /api/sessions/question-progress/:planId
     */
    static async getQuestionProgress(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;

        try {
            // Verify plan ownership
            const plan = await dbGet('SELECT daily_question_goal, weekly_question_goal FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }

            // Calculate current dates in Brazilian timezone
            const today = getBrazilianDateString();
            const brazilDate = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
            const dayOfWeek = brazilDate.getDay();
            
            // Calculate first day of week (Monday)
            const firstDayOfWeek = new Date();
            firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            const firstDayOfWeekStr = firstDayOfWeek.toISOString().split('T')[0];

            // Get daily progress
            const dailyResult = await dbGet(
                'SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date = ?', 
                [planId, today]
            );

            // Get weekly progress  
            const weeklyResult = await dbGet(
                'SELECT SUM(questions_solved) as total FROM study_sessions WHERE study_plan_id = ? AND session_date >= ? AND session_date <= ?', 
                [planId, firstDayOfWeekStr, today]
            );

            const progress = {
                dailyGoal: plan.daily_question_goal,
                dailyProgress: dailyResult?.total || 0,
                dailyPercentage: plan.daily_question_goal > 0 
                    ? Math.round(((dailyResult?.total || 0) / plan.daily_question_goal) * 100) 
                    : 0,
                weeklyGoal: plan.weekly_question_goal,
                weeklyProgress: weeklyResult?.total || 0,
                weeklyPercentage: plan.weekly_question_goal > 0 
                    ? Math.round(((weeklyResult?.total || 0) / plan.weekly_question_goal) * 100) 
                    : 0
            };

            res.json(progress);

        } catch (error) {
            console.error('Erro ao buscar progresso de questões:', error);
            res.status(500).json({ error: 'Erro ao buscar progresso de questões' });
        }
    }

    // === PHASE 5 WAVE 2 - NEW SERVICE-ENHANCED ENDPOINTS ===

    /**
     * Get study streak information with detailed analysis
     * GET /api/sessions/streak/:planId
     * NEW - Service-powered endpoint
     */
    static async getStudyStreak(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;

        try {
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    const streakData = await service.calculateStreak(planId, userId);
                    if (streakData) {
                        console.log('🔥 Using enhanced SessionService streak calculation');
                        return res.json({
                            ...streakData,
                            source: 'service',
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service streak failed:', serviceError.message);
                }
            }

            // Fallback to basic streak calculation
            const plan = await dbGet('SELECT id FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }

            const sessions = await dbAll(
                'SELECT session_date FROM study_sessions WHERE study_plan_id = ? AND status = \'Concluído\' ORDER BY session_date DESC',
                [planId]
            );

            // Basic streak calculation
            const uniqueDates = [...new Set(sessions.map(s => s.session_date))].sort((a, b) => new Date(b) - new Date(a));
            let currentStreak = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let i = 0; i < uniqueDates.length; i++) {
                const studyDate = new Date(uniqueDates[i]);
                studyDate.setHours(0, 0, 0, 0);
                const daysDiff = Math.floor((today - studyDate) / (1000 * 60 * 60 * 24));

                if (i === 0 && daysDiff <= 1) {
                    currentStreak = 1;
                } else if (i > 0) {
                    const prevDate = new Date(uniqueDates[i - 1]);
                    const daysBetween = Math.floor((prevDate - studyDate) / (1000 * 60 * 60 * 24));
                    if (daysBetween === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            res.json({
                currentStreak,
                longestStreak: Math.max(currentStreak, uniqueDates.length > 7 ? 7 : uniqueDates.length),
                todayStudied: uniqueDates.length > 0 && uniqueDates[0] === today.toISOString().split('T')[0],
                source: 'fallback',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro ao calcular streak:', error);
            res.status(500).json({ error: 'Erro ao calcular streak de estudos' });
        }
    }

    /**
     * Schedule a new session with intelligent date finding
     * POST /api/sessions/schedule/:planId
     * NEW - Service-powered endpoint
     */
    static async scheduleSession(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { planId } = req.params;
        const userId = req.user.id;
        const sessionData = req.body;

        try {
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    const result = await service.scheduleSession(planId, userId, sessionData);
                    if (result) {
                        console.log('📅 Using enhanced SessionService scheduling');
                        return res.status(201).json({
                            message: 'Sessão agendada com sucesso!',
                            session: result,
                            source: 'service'
                        });
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service scheduling failed:', serviceError.message);
                }
            }

            // Fallback to basic session creation
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ? AND user_id = ?', [planId, userId]);
            if (!plan) {
                return res.status(404).json({ error: 'Plano não encontrado' });
            }

            // Basic validation
            if (!sessionData.session_type || !sessionData.subject_name) {
                return res.status(400).json({ error: 'Tipo de sessão e matéria são obrigatórios' });
            }

            // Set default date to tomorrow if not provided
            if (!sessionData.session_date) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                sessionData.session_date = tomorrow.toISOString().split('T')[0];
            }

            const sql = `INSERT INTO study_sessions 
                (study_plan_id, topic_id, subject_name, topic_description, session_date, session_type, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            const result = await dbRun(sql, [
                planId,
                sessionData.topic_id || null,
                sessionData.subject_name,
                sessionData.topic_description || sessionData.subject_name,
                sessionData.session_date,
                sessionData.session_type,
                'Pendente'
            ]);

            res.status(201).json({
                message: 'Sessão criada com sucesso!',
                sessionId: result.lastID,
                source: 'fallback'
            });

        } catch (error) {
            console.error('Erro ao agendar sessão:', error);
            res.status(500).json({ error: 'Erro ao agendar a sessão' });
        }
    }

    /**
     * Complete a session with comprehensive tracking
     * POST /api/sessions/:sessionId/complete
     * NEW - Service-powered endpoint
     */
    static async completeSession(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { sessionId } = req.params;
        const userId = req.user.id;
        const completionData = req.body;

        try {
            const service = initializeSessionService(global.repositories, db);
            if (service) {
                try {
                    // Get session to find planId
                    const sessionCheck = await dbGet(
                        'SELECT ss.study_plan_id FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?',
                        [sessionId, userId]
                    );
                    
                    if (sessionCheck) {
                        const result = await service.completeSession(sessionId, sessionCheck.study_plan_id, userId, completionData);
                        if (result) {
                            console.log('✅ Using enhanced SessionService completion');
                            return res.json({
                                message: 'Sessão concluída com sucesso!',
                                ...result,
                                source: 'service'
                            });
                        }
                    }
                } catch (serviceError) {
                    console.log('⚠️ Service completion failed:', serviceError.message);
                }
            }

            // Fallback to basic completion
            const session = await dbGet(
                'SELECT ss.* FROM study_sessions ss JOIN study_plans sp ON ss.study_plan_id = sp.id WHERE ss.id = ? AND sp.user_id = ?',
                [sessionId, userId]
            );

            if (!session) {
                return res.status(404).json({ error: 'Sessão não encontrada' });
            }

            if (session.status === 'Concluído') {
                return res.status(400).json({ error: 'Sessão já foi concluída' });
            }

            // Basic completion
            await dbRun(
                'UPDATE study_sessions SET status = ?, time_studied_seconds = ?, questions_solved = ? WHERE id = ?',
                ['Concluído', completionData.timeStudied || 0, completionData.questionsSolved || 0, sessionId]
            );

            res.json({
                message: 'Sessão concluída com sucesso!',
                sessionCompleted: true,
                source: 'fallback'
            });

        } catch (error) {
            console.error('Erro ao concluir sessão:', error);
            res.status(500).json({ error: 'Erro ao concluir a sessão' });
        }
    }
}

module.exports = SessionsController;