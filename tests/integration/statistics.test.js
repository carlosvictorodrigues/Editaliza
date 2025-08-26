/**
 * FASE 9 - INTEGRATION TESTS: STATISTICS
 * 
 * Teste completo do sistema de estatísticas:
 * - Estatísticas gerais de planos
 * - Progress tracking detalhado
 * - Métricas de performance
 * - Análises de atividade
 * - Dados de compartilhamento
 * - Review data complexos
 * - CTEs e queries recursivas
 * - Timezone brasileiro para cálculos
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('📊 Statistics Integration Tests', () => {
    let testUser;
    let authToken;
    let testServer;
    let testPlan;
    let testSubject;

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear test data
        await dbRun('DELETE FROM users WHERE email LIKE %test.statistics%');
        
        // Create test user
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        const result = await dbRun(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            ['test.statistics@editaliza.com', hashedPassword, 'Statistics Test User', 'user']
        );
        
        testUser = {
            id: result.rows[0].id,
            email: 'test.statistics@editaliza.com',
            password: 'TestPassword123!',
            name: 'Statistics Test User'
        };

        // Login to get auth token
        const loginResponse = await request(testServer)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });
        
        authToken = loginResponse.body.tokens.accessToken;

        // Create test plan
        const planResponse = await request(testServer)
            .post('/api/plans')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                plan_name: 'Statistics Test Plan',
                exam_date: '2025-06-15'
            });
        
        testPlan = planResponse.body.plan;

        // Update plan settings with realistic goals
        await request(testServer)
            .patch(`/api/plans/${testPlan.id}/settings`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                daily_question_goal: 40,
                weekly_question_goal: 280,
                session_duration_minutes: 60,
                has_essay: true,
                study_hours_per_day: JSON.stringify({
                    'Segunda': 2,
                    'Terça': 2,
                    'Quarta': 2,
                    'Quinta': 2,
                    'Sexta': 2,
                    'Sábado': 3,
                    'Domingo': 1
                })
            });

        // Create subjects with topics
        const subjectResponse = await request(testServer)
            .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                subject_name: 'Direito Constitucional',
                priority_weight: 5,
                topics_list: 'Princípios Constitucionais\nDireitos Fundamentais\nOrganização do Estado\nControle de Constitucionalidade'
            });

        testSubject = subjectResponse.body.subject;

        // Add more subjects for comprehensive statistics
        await request(testServer)
            .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                subject_name: 'Direito Civil',
                priority_weight: 4,
                topics_list: 'Parte Geral\nObrigações\nContratos'
            });

        // Generate schedule to have data for statistics
        await request(testServer)
            .post(`/api/plans/${testPlan.id}/generate`)
            .set('Authorization', `Bearer ${authToken}`);

        // Complete some sessions to create realistic statistics
        const sessions = await dbAll('SELECT * FROM schedules WHERE plan_id = $1 ORDER BY session_date LIMIT 10', [testPlan.id]);
        
        // Complete sessions with realistic data
        for (let i = 0; i < Math.min(5, sessions.length); i++) {
            const session = sessions[i];
            const studyTime = 1800 + (i * 600); // 30-60 minutes
            const questions = 20 + (i * 5); // 20-40 questions
            const correctAnswers = Math.floor(questions * (0.7 + i * 0.05)); // 70-90% accuracy

            await dbRun(`
                UPDATE schedules 
                SET status = 'Concluído',
                    completed_at = NOW() - INTERVAL '${i} days',
                    time_studied_seconds = $1,
                    questions_resolved = $2,
                    questions_correct = $3
                WHERE id = $4
            `, [studyTime, questions, correctAnswers, session.id]);
        }

        // Mark some sessions as pending overdue for overdue statistics
        if (sessions.length > 5) {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 2);
            const pastDateString = pastDate.toISOString().split('T')[0];

            await dbRun(
                'UPDATE schedules SET session_date = $1 WHERE plan_id = $2 AND status = $3 AND id IN (SELECT id FROM schedules WHERE plan_id = $2 AND status = $3 LIMIT 2)',
                [pastDateString, testPlan.id, 'Pendente']
            );
        }
    });

    afterAll(async () => {
        // Clean up test data
        if (testPlan) {
            await dbRun('DELETE FROM schedules WHERE plan_id = $1', [testPlan.id]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [testPlan.id]);
            await dbRun('DELETE FROM subjects WHERE plan_id = $1', [testPlan.id]);
            await dbRun('DELETE FROM plans WHERE id = $1', [testPlan.id]);
        }
        
        if (testUser) {
            await dbRun('DELETE FROM users WHERE id = $1', [testUser.id]);
        }
        
        // Close server
        if (testServer) {
            await new Promise(resolve => testServer.close(resolve));
        }
    });

    describe('GET /api/plans/:planId/statistics', () => {
        it('should get comprehensive plan statistics with CTEs and recursive queries', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/statistics`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('statistics');

            const stats = response.body.statistics;
            
            // Overview statistics
            expect(stats).toHaveProperty('overview');
            expect(stats.overview).toHaveProperty('totalSessions');
            expect(stats.overview).toHaveProperty('completedSessions');
            expect(stats.overview).toHaveProperty('pendingSessions');
            expect(stats.overview).toHaveProperty('overdueSessions');
            expect(stats.overview).toHaveProperty('completionRate');
            expect(stats.overview).toHaveProperty('totalStudyTime');

            // Subject-specific statistics
            expect(stats).toHaveProperty('subjects');
            expect(Array.isArray(stats.subjects)).toBe(true);
            
            if (stats.subjects.length > 0) {
                const subject = stats.subjects[0];
                expect(subject).toHaveProperty('subject_name');
                expect(subject).toHaveProperty('total_sessions');
                expect(subject).toHaveProperty('completed_sessions');
                expect(subject).toHaveProperty('completion_rate');
                expect(subject).toHaveProperty('avg_time_per_session');
                expect(subject).toHaveProperty('topics');
            }

            // Study streaks (from recursive CTE)
            expect(stats).toHaveProperty('streaks');
            expect(stats.streaks).toHaveProperty('current');
            expect(stats.streaks).toHaveProperty('longest');
            expect(stats.streaks).toHaveProperty('lastStudyDate');

            // Performance metrics
            expect(stats).toHaveProperty('performance');
            expect(stats.performance).toHaveProperty('avgSessionDuration');
            expect(stats.performance).toHaveProperty('avgQuestionsPerSession');
            expect(stats.performance).toHaveProperty('avgAccuracy');
            expect(stats.performance).toHaveProperty('studyEfficiency');

            // Verify numeric values are reasonable
            expect(stats.overview.totalSessions).toBeGreaterThan(0);
            expect(stats.overview.completionRate).toBeGreaterThanOrEqual(0);
            expect(stats.overview.completionRate).toBeLessThanOrEqual(100);
        });

        it('should handle plans without completed sessions', async () => {
            // Create a new plan without completed sessions
            const emptyPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Empty Statistics Plan',
                    exam_date: '2025-12-31'
                });

            const emptyPlan = emptyPlanResponse.body.plan;

            const response = await request(testServer)
                .get(`/api/plans/${emptyPlan.id}/statistics`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.statistics.overview.totalSessions).toBe(0);
            expect(response.body.statistics.overview.completedSessions).toBe(0);
            expect(response.body.statistics.overview.completionRate).toBe(0);

            // Clean up
            await dbRun('DELETE FROM plans WHERE id = $1', [emptyPlan.id]);
        });
    });

    describe('GET /api/plans/:planId/detailed_progress', () => {
        it('should get detailed progress with complex JOINs and aggregations', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/detailed_progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('progress');

            const progress = response.body.progress;

            // Overall progress
            expect(progress).toHaveProperty('overall');
            expect(progress.overall).toHaveProperty('totalTopics');
            expect(progress.overall).toHaveProperty('completedTopics');
            expect(progress.overall).toHaveProperty('inProgressTopics');
            expect(progress.overall).toHaveProperty('notStartedTopics');
            expect(progress.overall).toHaveProperty('completionPercentage');

            // Subject breakdown
            expect(progress).toHaveProperty('bySubject');
            expect(Array.isArray(progress.bySubject)).toBe(true);

            if (progress.bySubject.length > 0) {
                const subjectProgress = progress.bySubject[0];
                expect(subjectProgress).toHaveProperty('subject_name');
                expect(subjectProgress).toHaveProperty('total_topics');
                expect(subjectProgress).toHaveProperty('completed_topics');
                expect(subjectProgress).toHaveProperty('progress_percentage');
                expect(subjectProgress).toHaveProperty('avg_sessions_per_topic');
            }

            // Time breakdown
            expect(progress).toHaveProperty('timeBreakdown');
            expect(progress.timeBreakdown).toHaveProperty('totalStudyTime');
            expect(progress.timeBreakdown).toHaveProperty('avgTimePerTopic');
            expect(progress.timeBreakdown).toHaveProperty('avgTimePerSession');

            // Session type breakdown
            expect(progress).toHaveProperty('sessionTypes');
            expect(Array.isArray(progress.sessionTypes)).toBe(true);
        });
    });

    describe('GET /api/plans/:planId/progress', () => {
        it('should get basic plan progress for dashboard', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('progress');

            const progress = response.body.progress;
            expect(progress).toHaveProperty('percentage');
            expect(progress).toHaveProperty('completed');
            expect(progress).toHaveProperty('total');
            expect(progress).toHaveProperty('overdue');
            expect(progress).toHaveProperty('todaysPlan');

            expect(typeof progress.percentage).toBe('number');
            expect(progress.percentage).toBeGreaterThanOrEqual(0);
            expect(progress.percentage).toBeLessThanOrEqual(100);
            expect(progress.completed).toBeLessThanOrEqual(progress.total);
        });
    });

    describe('GET /api/plans/:planId/activity_summary', () => {
        it('should get activity summary with time breakdowns and session stats', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/activity_summary`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('summary');

            const summary = response.body.summary;

            // Recent activity
            expect(summary).toHaveProperty('recent');
            expect(summary.recent).toHaveProperty('last7Days');
            expect(summary.recent).toHaveProperty('last30Days');

            // Study patterns
            expect(summary).toHaveProperty('patterns');
            expect(summary.patterns).toHaveProperty('mostActiveDay');
            expect(summary.patterns).toHaveProperty('mostActiveHour');
            expect(summary.patterns).toHaveProperty('avgSessionsPerDay');

            // Performance trends
            expect(summary).toHaveProperty('trends');
            expect(summary.trends).toHaveProperty('accuracyTrend');
            expect(summary.trends).toHaveProperty('speedTrend');
            expect(summary.trends).toHaveProperty('consistencyScore');

            // Questions statistics
            expect(summary).toHaveProperty('questions');
            expect(summary.questions).toHaveProperty('totalSolved');
            expect(summary.questions).toHaveProperty('totalCorrect');
            expect(summary.questions).toHaveProperty('overallAccuracy');
            expect(summary.questions).toHaveProperty('dailyAverage');
        });
    });

    describe('GET /api/plans/:planId/goal_progress', () => {
        it('should calculate question goal progress with Brazilian timezone', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/goal_progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('progress');

            const progress = response.body.progress;

            // Daily progress
            expect(progress).toHaveProperty('daily');
            expect(progress.daily).toHaveProperty('solved');
            expect(progress.daily).toHaveProperty('goal');
            expect(progress.daily).toHaveProperty('percentage');
            expect(progress.daily).toHaveProperty('remaining');

            // Weekly progress
            expect(progress).toHaveProperty('weekly');
            expect(progress.weekly).toHaveProperty('solved');
            expect(progress.weekly).toHaveProperty('goal');
            expect(progress.weekly).toHaveProperty('percentage');

            // Goals should match plan settings
            expect(progress.daily.goal).toBe(40); // From plan settings
            expect(progress.weekly.goal).toBe(280);

            // Brazilian timezone verification (should be based on São Paulo time)
            expect(progress).toHaveProperty('timezone');
            expect(progress.timezone).toBe('America/Sao_Paulo');
        });
    });

    describe('GET /api/plans/:planId/question_radar', () => {
        it('should identify weak points with complex JOIN and HAVING clauses', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/question_radar`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('radar');

            const radar = response.body.radar;

            // Subject performance radar
            expect(radar).toHaveProperty('subjects');
            expect(Array.isArray(radar.subjects)).toBe(true);

            if (radar.subjects.length > 0) {
                const subjectRadar = radar.subjects[0];
                expect(subjectRadar).toHaveProperty('subject_name');
                expect(subjectRadar).toHaveProperty('accuracy');
                expect(subjectRadar).toHaveProperty('speed');
                expect(subjectRadar).toHaveProperty('consistency');
                expect(subjectRadar).toHaveProperty('difficulty');
            }

            // Weak points identification
            expect(radar).toHaveProperty('weakPoints');
            expect(Array.isArray(radar.weakPoints)).toBe(true);

            // Improvement suggestions
            expect(radar).toHaveProperty('suggestions');
            expect(Array.isArray(radar.suggestions)).toBe(true);

            // Overall radar scores
            expect(radar).toHaveProperty('overall');
            expect(radar.overall).toHaveProperty('accuracy');
            expect(radar.overall).toHaveProperty('speed');
            expect(radar.overall).toHaveProperty('consistency');
        });
    });

    describe('GET /api/plans/:planId/share-progress', () => {
        it('should get shareable progress data with gamification', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/share-progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('shareData');

            const shareData = response.body.shareData;

            // Basic info for sharing
            expect(shareData).toHaveProperty('planName');
            expect(shareData).toHaveProperty('examDate');
            expect(shareData).toHaveProperty('daysUntilExam');

            // Progress summary
            expect(shareData).toHaveProperty('progress');
            expect(shareData.progress).toHaveProperty('percentage');
            expect(shareData.progress).toHaveProperty('sessionsCompleted');
            expect(shareData.progress).toHaveProperty('totalSessions');

            // Study stats
            expect(shareData).toHaveProperty('stats');
            expect(shareData.stats).toHaveProperty('totalStudyHours');
            expect(shareData.stats).toHaveProperty('questionsAnswered');
            expect(shareData.stats).toHaveProperty('currentStreak');

            // Gamification elements
            expect(shareData).toHaveProperty('gamification');
            expect(shareData.gamification).toHaveProperty('level');
            expect(shareData.gamification).toHaveProperty('badges');
            expect(shareData.gamification).toHaveProperty('rank');

            // Achievement highlights
            expect(shareData).toHaveProperty('achievements');
            expect(Array.isArray(shareData.achievements)).toBe(true);
        });
    });

    describe('GET /api/plans/:planId/review_data', () => {
        it('should get comprehensive review data for weekly review', async () => {
            const reviewDate = new Date().toISOString().split('T')[0];
            
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/review_data`)
                .query({
                    date: reviewDate,
                    type: 'semanal'
                })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('review');

            const review = response.body.review;

            // Review period info
            expect(review).toHaveProperty('period');
            expect(review.period).toHaveProperty('start');
            expect(review.period).toHaveProperty('end');
            expect(review.period).toHaveProperty('type');

            // Performance summary
            expect(review).toHaveProperty('performance');
            expect(review.performance).toHaveProperty('sessionsCompleted');
            expect(review.performance).toHaveProperty('studyTime');
            expect(review.performance).toHaveProperty('questionsAnswered');
            expect(review.performance).toHaveProperty('accuracy');

            // Goals comparison
            expect(review).toHaveProperty('goals');
            expect(review.goals).toHaveProperty('questionsGoal');
            expect(review.goals).toHaveProperty('questionsActual');
            expect(review.goals).toHaveProperty('goalsAchievement');

            // Subject breakdown
            expect(review).toHaveProperty('subjects');
            expect(Array.isArray(review.subjects)).toBe(true);

            // Insights and recommendations
            expect(review).toHaveProperty('insights');
            expect(Array.isArray(review.insights)).toBe(true);
        });

        it('should get monthly review data with extended analysis', async () => {
            const reviewDate = new Date().toISOString().split('T')[0];
            
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/review_data`)
                .query({
                    date: reviewDate,
                    type: 'mensal'
                })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('review');

            const review = response.body.review;
            expect(review.period.type).toBe('mensal');

            // Monthly reviews should have more comprehensive data
            expect(review).toHaveProperty('trends');
            expect(review.trends).toHaveProperty('weeklyProgress');
            expect(review.trends).toHaveProperty('subjectTrends');
            expect(review.trends).toHaveProperty('consistencyScore');
        });

        it('should reject invalid review parameters', async () => {
            // Invalid date format
            let response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/review_data`)
                .query({
                    date: 'invalid-date',
                    type: 'semanal'
                })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');

            // Invalid review type
            response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/review_data`)
                .query({
                    date: '2025-01-15',
                    type: 'invalid'
                })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('GET /api/statistics/metrics', () => {
        it('should get system-wide metrics for authenticated admin users', async () => {
            // This test assumes the test user has appropriate permissions
            // In a real scenario, you might need to create an admin user
            const response = await request(testServer)
                .get('/api/statistics/metrics')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('metrics');

            const metrics = response.body.metrics;

            // System metrics
            expect(metrics).toHaveProperty('system');
            expect(metrics.system).toHaveProperty('uptime');
            expect(metrics.system).toHaveProperty('memoryUsage');
            expect(metrics.system).toHaveProperty('timestamp');

            // User metrics
            expect(metrics).toHaveProperty('users');
            expect(metrics.users).toHaveProperty('total');
            expect(metrics.users).toHaveProperty('active');
            expect(metrics.users).toHaveProperty('newThisMonth');

            // Plan metrics
            expect(metrics).toHaveProperty('plans');
            expect(metrics.plans).toHaveProperty('total');
            expect(metrics.plans).toHaveProperty('active');
            expect(metrics.plans).toHaveProperty('avgSessionsPerPlan');

            // Session metrics
            expect(metrics).toHaveProperty('sessions');
            expect(metrics.sessions).toHaveProperty('total');
            expect(metrics.sessions).toHaveProperty('completedToday');
            expect(metrics.sessions).toHaveProperty('avgCompletionRate');
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle statistics for plans with large amounts of data efficiently', async () => {
            // Create additional sessions to simulate large dataset
            const topics = await dbAll(
                'SELECT t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.plan_id = $1',
                [testPlan.id]
            );

            if (topics.length > 0) {
                // Create many sessions
                for (let i = 0; i < 50; i++) {
                    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
                    const sessionDate = new Date();
                    sessionDate.setDate(sessionDate.getDate() - Math.floor(Math.random() * 30));

                    await dbRun(`
                        INSERT INTO schedules (
                            plan_id, topic_id, session_type, session_date, 
                            session_duration_minutes, status, completed_at,
                            time_studied_seconds, questions_resolved, questions_correct
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        testPlan.id, randomTopic.id, 'Novo Tópico', sessionDate.toISOString().split('T')[0],
                        60, 'Concluído', sessionDate.toISOString(),
                        3600, 25, Math.floor(25 * 0.8)
                    ]);
                }

                const startTime = Date.now();
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/statistics`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);
                const endTime = Date.now();

                expect(response.body.success).toBe(true);
                expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

                // Clean up additional sessions
                await dbRun('DELETE FROM schedules WHERE plan_id = $1 AND time_studied_seconds = 3600', [testPlan.id]);
            }
        });

        it('should handle edge cases in date calculations', async () => {
            // Test with sessions from different timezones and edge times
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/goal_progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            
            // Should handle Brazilian timezone correctly even when server is in different timezone
            expect(response.body.progress.timezone).toBe('America/Sao_Paulo');
            
            // Progress percentages should be valid
            expect(response.body.progress.daily.percentage).toBeGreaterThanOrEqual(0);
            expect(response.body.progress.weekly.percentage).toBeGreaterThanOrEqual(0);
        });

        it('should handle concurrent statistics requests safely', async () => {
            // Make multiple concurrent requests
            const requests = [
                request(testServer).get(`/api/plans/${testPlan.id}/statistics`).set('Authorization', `Bearer ${authToken}`),
                request(testServer).get(`/api/plans/${testPlan.id}/progress`).set('Authorization', `Bearer ${authToken}`),
                request(testServer).get(`/api/plans/${testPlan.id}/goal_progress`).set('Authorization', `Bearer ${authToken}`),
                request(testServer).get(`/api/plans/${testPlan.id}/activity_summary`).set('Authorization', `Bearer ${authToken}`)
            ];

            const results = await Promise.all(requests);
            
            // All requests should succeed
            results.forEach(result => {
                expect(result.status).toBe(200);
                expect(result.body.success).toBe(true);
            });
        });

        it('should return consistent data across different statistics endpoints', async () => {
            // Get data from multiple endpoints
            const [statisticsRes, progressRes, goalProgressRes] = await Promise.all([
                request(testServer).get(`/api/plans/${testPlan.id}/statistics`).set('Authorization', `Bearer ${authToken}`),
                request(testServer).get(`/api/plans/${testPlan.id}/progress`).set('Authorization', `Bearer ${authToken}`),
                request(testServer).get(`/api/plans/${testPlan.id}/goal_progress`).set('Authorization', `Bearer ${authToken}`)
            ]);

            // Total sessions should be consistent
            const statsTotal = statisticsRes.body.statistics.overview.totalSessions;
            const progressTotal = progressRes.body.progress.total;
            
            expect(statsTotal).toBe(progressTotal);

            // Completed sessions should be consistent
            const statsCompleted = statisticsRes.body.statistics.overview.completedSessions;
            const progressCompleted = progressRes.body.progress.completed;
            
            expect(statsCompleted).toBe(progressCompleted);
        });

        it('should handle division by zero and null values gracefully', async () => {
            // Create a plan with no completed sessions
            const emptyPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Empty Plan for Division Test',
                    exam_date: '2025-12-31'
                });

            const emptyPlan = emptyPlanResponse.body.plan;

            // Add a subject but no sessions
            await request(testServer)
                .post(`/api/plans/${emptyPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    subject_name: 'Test Subject',
                    priority_weight: 3,
                    topics_list: 'Test Topic'
                });

            const response = await request(testServer)
                .get(`/api/plans/${emptyPlan.id}/statistics`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            
            // Should handle division by zero gracefully
            const stats = response.body.statistics;
            expect(stats.overview.completionRate).toBe(0);
            expect(stats.performance.avgSessionDuration).toBe(0);
            expect(stats.performance.avgQuestionsPerSession).toBe(0);

            // Clean up
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [emptyPlan.id]);
            await dbRun('DELETE FROM subjects WHERE plan_id = $1', [emptyPlan.id]);
            await dbRun('DELETE FROM plans WHERE id = $1', [emptyPlan.id]);
        });
    });
});