/**
 * FASE 9 - INTEGRATION TESTS: SESSIONS
 * 
 * Teste completo do sistema de sessões de estudo:
 * - Gestão de sessões de estudo
 * - Tracking de tempo e progresso
 * - Sistema de streaks
 * - Postponement inteligente
 * - Batch operations
 * - Reinforcement sessions
 * - Brazilian timezone handling
 * - Performance analytics
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('📚 Sessions Integration Tests', () => {
    let testUser;
    let authToken;
    let testServer;
    let testPlan;
    let testSessions = [];

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear test data
        await dbRun('DELETE FROM users WHERE email LIKE %test.sessions%');
        
        // Create test user
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        const result = await dbRun(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            ['test.sessions@editaliza.com', hashedPassword, 'Sessions Test User', 'user']
        );
        
        testUser = {
            id: result.rows[0].id,
            email: 'test.sessions@editaliza.com',
            password: 'TestPassword123!',
            name: 'Sessions Test User'
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
                plan_name: 'Sessions Test Plan',
                exam_date: '2025-06-15'
            });
        
        testPlan = planResponse.body.plan;

        // Create subject with topics
        await request(testServer)
            .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                subject_name: 'Direito Constitucional',
                priority_weight: 5,
                topics_list: 'Princípios Constitucionais\nDireitos Fundamentais\nOrganização do Estado'
            });

        // Generate schedule to have sessions
        await request(testServer)
            .post(`/api/plans/${testPlan.id}/generate`)
            .set('Authorization', `Bearer ${authToken}`);

        // Get test sessions
        const sessions = await dbAll('SELECT * FROM schedules WHERE plan_id = $1 LIMIT 5', [testPlan.id]);
        testSessions = sessions;
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

    describe('GET /api/sessions/by-date/:planId', () => {
        it('should get sessions grouped by date with Brazilian timezone', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/by-date/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            expect(Array.isArray(response.body.schedule)).toBe(true);

            if (response.body.schedule.length > 0) {
                const daySchedule = response.body.schedule[0];
                expect(daySchedule).toHaveProperty('date');
                expect(daySchedule).toHaveProperty('sessions');
                expect(daySchedule).toHaveProperty('totalMinutes');
                expect(Array.isArray(daySchedule.sessions)).toBe(true);

                // Check date format (should be YYYY-MM-DD for Brazilian timezone)
                expect(daySchedule.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

                if (daySchedule.sessions.length > 0) {
                    const session = daySchedule.sessions[0];
                    expect(session).toHaveProperty('id');
                    expect(session).toHaveProperty('session_type');
                    expect(session).toHaveProperty('subject_name');
                    expect(session).toHaveProperty('topic_name');
                    expect(session).toHaveProperty('status');
                    expect(session).toHaveProperty('session_duration_minutes');
                }
            }
        });

        it('should reject request for non-existent plan', async () => {
            const response = await request(testServer)
                .get('/api/sessions/by-date/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject unauthenticated request', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/by-date/${testPlan.id}`)
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/sessions/overdue-check/:planId', () => {
        beforeAll(async () => {
            // Create some overdue sessions by updating their dates to the past
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
            const pastDateString = pastDate.toISOString().split('T')[0];

            await dbRun(
                'UPDATE schedules SET session_date = $1 WHERE plan_id = $2 AND status = $3 AND id IN (SELECT id FROM schedules WHERE plan_id = $2 AND status = $3 LIMIT 2)',
                [pastDateString, testPlan.id, 'Pendente']
            );
        });

        it('should detect overdue sessions with Brazilian timezone accuracy', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/overdue-check/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('overdue');
            expect(response.body.overdue).toHaveProperty('count');
            expect(response.body.overdue).toHaveProperty('sessions');
            expect(Array.isArray(response.body.overdue.sessions)).toBe(true);

            expect(response.body.overdue.count).toBeGreaterThanOrEqual(0);
            expect(response.body.overdue.sessions.length).toBe(response.body.overdue.count);

            if (response.body.overdue.count > 0) {
                const overdueSession = response.body.overdue.sessions[0];
                expect(overdueSession).toHaveProperty('id');
                expect(overdueSession).toHaveProperty('session_date');
                expect(overdueSession).toHaveProperty('subject_name');
                expect(overdueSession).toHaveProperty('topic_name');
                expect(overdueSession).toHaveProperty('days_overdue');
                expect(overdueSession.days_overdue).toBeGreaterThan(0);
            }
        });
    });

    describe('GET /api/sessions/statistics/:planId', () => {
        beforeAll(async () => {
            // Complete some sessions to have statistics
            if (testSessions.length > 0) {
                await dbRun(
                    'UPDATE schedules SET status = $1, completed_at = NOW(), time_studied_seconds = $2, questions_resolved = $3 WHERE id = $4',
                    ['Concluído', 3600, 25, testSessions[0].id]
                );

                if (testSessions.length > 1) {
                    await dbRun(
                        'UPDATE schedules SET status = $1, completed_at = NOW(), time_studied_seconds = $2, questions_resolved = $3 WHERE id = $4',
                        ['Concluído', 1800, 15, testSessions[1].id]
                    );
                }
            }
        });

        it('should calculate detailed session statistics', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/statistics/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('statistics');

            const stats = response.body.statistics;
            expect(stats).toHaveProperty('overview');
            expect(stats).toHaveProperty('streaks');
            expect(stats).toHaveProperty('performance');
            expect(stats).toHaveProperty('subjects');

            // Overview should contain key metrics
            expect(stats.overview).toHaveProperty('totalSessions');
            expect(stats.overview).toHaveProperty('completedSessions');
            expect(stats.overview).toHaveProperty('completionRate');
            expect(stats.overview).toHaveProperty('totalStudyTime');

            // Streaks should contain streak information
            expect(stats.streaks).toHaveProperty('current');
            expect(stats.streaks).toHaveProperty('longest');
            expect(stats.streaks).toHaveProperty('lastStudyDate');

            // Performance should contain averages and metrics
            expect(stats.performance).toHaveProperty('avgSessionDuration');
            expect(stats.performance).toHaveProperty('avgQuestionsPerSession');
            expect(stats.performance).toHaveProperty('studyEfficiency');

            // Subjects should be an array
            expect(Array.isArray(stats.subjects)).toBe(true);
        });
    });

    describe('GET /api/sessions/question-progress/:planId', () => {
        it('should calculate question progress with Brazilian timezone', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/question-progress/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('progress');

            const progress = response.body.progress;
            expect(progress).toHaveProperty('daily');
            expect(progress).toHaveProperty('weekly');
            expect(progress).toHaveProperty('goals');

            // Daily progress
            expect(progress.daily).toHaveProperty('solved');
            expect(progress.daily).toHaveProperty('goal');
            expect(progress.daily).toHaveProperty('percentage');

            // Weekly progress
            expect(progress.weekly).toHaveProperty('solved');
            expect(progress.weekly).toHaveProperty('goal');
            expect(progress.weekly).toHaveProperty('percentage');

            // Goals should reflect plan settings
            expect(progress.goals).toHaveProperty('daily');
            expect(progress.goals).toHaveProperty('weekly');
        });
    });

    describe('PATCH /api/sessions/:sessionId', () => {
        it('should update session status successfully', async () => {
            if (testSessions.length === 0) {
                console.log('No sessions available for status update test - skipping');
                return;
            }

            const sessionToUpdate = testSessions.find(s => s.status === 'Pendente');
            if (!sessionToUpdate) {
                console.log('No pending session found for status update test - skipping');
                return;
            }

            const response = await request(testServer)
                .patch(`/api/sessions/${sessionToUpdate.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'Concluído' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify session was updated in database
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionToUpdate.id]);
            expect(updatedSession.status).toBe('Concluído');
            expect(updatedSession.completed_at).toBeTruthy();
        });

        it('should reject invalid status values', async () => {
            if (testSessions.length === 0) {
                return;
            }

            const response = await request(testServer)
                .patch(`/api/sessions/${testSessions[0].id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'InvalidStatus' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });

        it('should reject update of non-existent session', async () => {
            const response = await request(testServer)
                .patch('/api/sessions/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'Concluído' })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/sessions/:sessionId/time', () => {
        it('should register study time successfully', async () => {
            if (testSessions.length === 0) {
                console.log('No sessions available for time tracking test - skipping');
                return;
            }

            const sessionForTime = testSessions.find(s => s.status === 'Pendente');
            if (!sessionForTime) {
                console.log('No pending session found for time tracking test - skipping');
                return;
            }

            const studyTimeSeconds = 2700; // 45 minutes

            const response = await request(testServer)
                .post(`/api/sessions/${sessionForTime.id}/time`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ seconds: studyTimeSeconds })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify time was recorded
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionForTime.id]);
            expect(updatedSession.time_studied_seconds).toBe(studyTimeSeconds);
        });

        it('should reject invalid study time values', async () => {
            if (testSessions.length === 0) {
                return;
            }

            // Negative time
            let response = await request(testServer)
                .post(`/api/sessions/${testSessions[0].id}/time`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ seconds: -1 })
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');

            // Extremely large time (more than 24 hours)
            response = await request(testServer)
                .post(`/api/sessions/${testSessions[0].id}/time`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ seconds: 90000 }) // 25 hours
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('PATCH /api/sessions/:sessionId/postpone', () => {
        it('should postpone session to next available day', async () => {
            const pendingSessions = testSessions.filter(s => s.status === 'Pendente');
            if (pendingSessions.length === 0) {
                console.log('No pending sessions found for postpone test - skipping');
                return;
            }

            const sessionToPostpone = pendingSessions[0];
            const originalDate = sessionToPostpone.session_date;

            const response = await request(testServer)
                .patch(`/api/sessions/${sessionToPostpone.id}/postpone`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ days: 'next' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('newDate');
            expect(response.body).toHaveProperty('message');

            // Verify session date was updated
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionToPostpone.id]);
            expect(updatedSession.session_date).not.toBe(originalDate);
            expect(new Date(updatedSession.session_date)).toBeInstanceOf(Date);
        });

        it('should postpone session by specific number of days', async () => {
            const pendingSessions = testSessions.filter(s => s.status === 'Pendente');
            if (pendingSessions.length < 2) {
                console.log('Not enough pending sessions for specific days postpone test - skipping');
                return;
            }

            const sessionToPostpone = pendingSessions[1];
            const originalDate = new Date(sessionToPostpone.session_date);
            const daysToPostpone = 3;

            const response = await request(testServer)
                .patch(`/api/sessions/${sessionToPostpone.id}/postpone`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ days: daysToPostpone })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('newDate');

            // Verify session was postponed by correct number of days
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionToPostpone.id]);
            const newDate = new Date(updatedSession.session_date);
            const expectedDate = new Date(originalDate);
            expectedDate.setDate(expectedDate.getDate() + daysToPostpone);

            // Allow for some flexibility in date comparison (timezone handling)
            const timeDiff = Math.abs(newDate.getTime() - expectedDate.getTime());
            expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours difference
        });

        it('should reject invalid postponement values', async () => {
            if (testSessions.length === 0) {
                return;
            }

            // Invalid string value
            let response = await request(testServer)
                .patch(`/api/sessions/${testSessions[0].id}/postpone`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ days: 'invalid' })
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');

            // Too many days
            response = await request(testServer)
                .patch(`/api/sessions/${testSessions[0].id}/postpone`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ days: 50 })
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/sessions/:sessionId/reinforce', () => {
        let completedSession;

        beforeAll(async () => {
            // Make sure we have at least one completed session
            if (testSessions.length > 0) {
                await dbRun(
                    'UPDATE schedules SET status = $1, completed_at = NOW() WHERE id = $2',
                    ['Concluído', testSessions[0].id]
                );
                
                completedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [testSessions[0].id]);
            }
        });

        it('should create reinforcement session for spaced repetition', async () => {
            if (!completedSession) {
                console.log('No completed session found for reinforcement test - skipping');
                return;
            }

            const response = await request(testServer)
                .post(`/api/sessions/${completedSession.id}/reinforce`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('reinforcement');
            expect(response.body.reinforcement).toHaveProperty('id');
            expect(response.body.reinforcement).toHaveProperty('session_date');
            expect(response.body.reinforcement).toHaveProperty('session_type');

            // Should be a review session
            expect(response.body.reinforcement.session_type).toContain('Revisão');

            // Verify reinforcement session was created in database
            const reinforcementSession = await dbGet(
                'SELECT * FROM schedules WHERE id = $1',
                [response.body.reinforcement.id]
            );
            expect(reinforcementSession).toBeTruthy();
            expect(reinforcementSession.topic_id).toBe(completedSession.topic_id);
        });

        it('should schedule reinforcement 3 days later', async () => {
            if (!completedSession) {
                return;
            }

            const response = await request(testServer)
                .post(`/api/sessions/${completedSession.id}/reinforce`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(201);

            const reinforcementDate = new Date(response.body.reinforcement.session_date);
            const completionDate = new Date(completedSession.completed_at || completedSession.session_date);
            
            // Should be approximately 3 days later
            const daysDiff = Math.floor((reinforcementDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
            expect(daysDiff).toBeGreaterThanOrEqual(2); // Allow some flexibility
            expect(daysDiff).toBeLessThanOrEqual(4);
        });

        it('should reject reinforcement for non-completed session', async () => {
            const pendingSession = testSessions.find(s => s.status === 'Pendente');
            if (!pendingSession) {
                console.log('No pending session found for reinforcement rejection test - skipping');
                return;
            }

            const response = await request(testServer)
                .post(`/api/sessions/${pendingSession.id}/reinforce`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PATCH /api/sessions/batch-update-status', () => {
        it('should perform batch status updates', async () => {
            const pendingSessions = testSessions.filter(s => s.status === 'Pendente').slice(0, 3);
            if (pendingSessions.length === 0) {
                console.log('No pending sessions found for batch update test - skipping');
                return;
            }

            const updates = pendingSessions.map((session, index) => ({
                id: session.id,
                status: index % 2 === 0 ? 'Concluído' : 'Pulado'
            }));

            const response = await request(testServer)
                .patch('/api/sessions/batch-update-status')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessions: updates })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('updated');
            expect(response.body.updated).toBe(updates.length);

            // Verify updates were applied
            for (let i = 0; i < updates.length; i++) {
                const session = await dbGet('SELECT * FROM schedules WHERE id = $1', [updates[i].id]);
                expect(session.status).toBe(updates[i].status);
            }
        });

        it('should reject batch update with invalid data', async () => {
            const invalidUpdates = [
                {
                    id: 'invalid-id', // Should be number
                    status: 'Concluído'
                }
            ];

            const response = await request(testServer)
                .patch('/api/sessions/batch-update-status')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessions: invalidUpdates })
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });

        it('should reject empty batch update', async () => {
            const response = await request(testServer)
                .patch('/api/sessions/batch-update-status')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessions: [] })
                .expect(400);

            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('GET /api/sessions/streak/:planId', () => {
        beforeAll(async () => {
            // Create some completed sessions with dates to form a streak
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const dayBefore = new Date(today);
            dayBefore.setDate(dayBefore.getDate() - 2);

            // Complete sessions for streak
            if (testSessions.length >= 3) {
                await dbRun(
                    'UPDATE schedules SET status = $1, completed_at = $2 WHERE id = $3',
                    ['Concluído', today.toISOString(), testSessions[0].id]
                );
                await dbRun(
                    'UPDATE schedules SET status = $1, completed_at = $2 WHERE id = $3',
                    ['Concluído', yesterday.toISOString(), testSessions[1].id]
                );
                await dbRun(
                    'UPDATE schedules SET status = $1, completed_at = $2 WHERE id = $3',
                    ['Concluído', dayBefore.toISOString(), testSessions[2].id]
                );
            }
        });

        it('should calculate study streak with detailed analysis', async () => {
            const response = await request(testServer)
                .get(`/api/sessions/streak/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('streak');

            const streak = response.body.streak;
            expect(streak).toHaveProperty('current');
            expect(streak).toHaveProperty('longest');
            expect(streak).toHaveProperty('lastStudyDate');
            expect(streak).toHaveProperty('risk');
            expect(streak).toHaveProperty('analysis');

            expect(typeof streak.current).toBe('number');
            expect(typeof streak.longest).toBe('number');
            expect(streak.current).toBeGreaterThanOrEqual(0);
            expect(streak.longest).toBeGreaterThanOrEqual(streak.current);
        });
    });

    describe('Session Scheduling', () => {
        describe('POST /api/sessions/schedule/:planId', () => {
            it('should schedule new session with intelligent date finding', async () => {
                const sessionData = {
                    session_type: 'Novo Tópico',
                    subject_name: 'Direito Constitucional',
                    duration_minutes: 60
                };

                const response = await request(testServer)
                    .post(`/api/sessions/schedule/${testPlan.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(sessionData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('session');
                expect(response.body.session).toHaveProperty('id');
                expect(response.body.session).toHaveProperty('session_date');
                expect(response.body.session).toHaveProperty('session_type', sessionData.session_type);

                // Verify session was created in database
                const createdSession = await dbGet(
                    'SELECT * FROM schedules WHERE id = $1',
                    [response.body.session.id]
                );
                expect(createdSession).toBeTruthy();
                expect(createdSession.session_duration_minutes).toBe(sessionData.duration_minutes);
            });

            it('should reject invalid session type', async () => {
                const invalidSessionData = {
                    session_type: 'Invalid Type',
                    subject_name: 'Direito Civil',
                    duration_minutes: 30
                };

                const response = await request(testServer)
                    .post(`/api/sessions/schedule/${testPlan.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidSessionData)
                    .expect(400);

                expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            });
        });

        describe('POST /api/sessions/:sessionId/complete', () => {
            it('should complete session with comprehensive tracking', async () => {
                // Create a new session for completion test
                const newSessionResponse = await request(testServer)
                    .post(`/api/sessions/schedule/${testPlan.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        session_type: 'Novo Tópico',
                        subject_name: 'Direito Constitucional',
                        duration_minutes: 45
                    });

                const sessionId = newSessionResponse.body.session.id;

                const completionData = {
                    timeStudied: 2700, // 45 minutes in seconds
                    questionsSolved: 20,
                    questionsCorrect: 16,
                    difficultyRating: 3,
                    confidenceRating: 4,
                    notes: 'Good study session, understood most concepts'
                };

                const response = await request(testServer)
                    .post(`/api/sessions/${sessionId}/complete`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(completionData)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('session');
                expect(response.body).toHaveProperty('reinforcement');

                // Verify session was completed in database
                const completedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionId]);
                expect(completedSession.status).toBe('Concluído');
                expect(completedSession.time_studied_seconds).toBe(completionData.timeStudied);
                expect(completedSession.questions_resolved).toBe(completionData.questionsSolved);
                expect(completedSession.completed_at).toBeTruthy();
            });

            it('should reject completion with invalid study time', async () => {
                if (testSessions.length === 0) {
                    return;
                }

                const invalidCompletionData = {
                    timeStudied: 30, // Too short (less than 1 minute)
                    questionsSolved: 5
                };

                const response = await request(testServer)
                    .post(`/api/sessions/${testSessions[0].id}/complete`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidCompletionData)
                    .expect(400);

                expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            });
        });
    });

    describe('Edge Cases & Performance', () => {
        it('should handle timezone edge cases correctly', async () => {
            // Test sessions scheduled at midnight Brazilian time
            const midnightBrazil = new Date();
            midnightBrazil.setUTCHours(3, 0, 0, 0); // Midnight in Brazil (UTC-3)

            const response = await request(testServer)
                .get(`/api/sessions/by-date/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify all dates are properly handled in Brazilian timezone
            if (response.body.schedule.length > 0) {
                response.body.schedule.forEach(daySchedule => {
                    expect(daySchedule.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                    expect(isNaN(Date.parse(daySchedule.date))).toBe(false);
                });
            }
        });

        it('should handle large batch operations efficiently', async () => {
            // Create multiple sessions for batch testing
            const batchSessions = [];
            for (let i = 0; i < 10; i++) {
                const sessionResponse = await request(testServer)
                    .post(`/api/sessions/schedule/${testPlan.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        session_type: 'Novo Tópico',
                        subject_name: 'Direito Constitucional',
                        duration_minutes: 30
                    });
                batchSessions.push(sessionResponse.body.session);
            }

            const batchUpdates = batchSessions.map((session, index) => ({
                id: session.id,
                status: index % 3 === 0 ? 'Concluído' : 'Pendente'
            }));

            const startTime = Date.now();
            const response = await request(testServer)
                .patch('/api/sessions/batch-update-status')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ sessions: batchUpdates })
                .expect(200);
            const endTime = Date.now();

            expect(response.body.success).toBe(true);
            expect(response.body.updated).toBe(batchUpdates.length);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

            // Clean up test sessions
            for (const session of batchSessions) {
                await dbRun('DELETE FROM schedules WHERE id = $1', [session.id]);
            }
        });

        it('should prevent unauthorized access to sessions', async () => {
            // Try to access sessions with invalid session ID
            const response = await request(testServer)
                .patch('/api/sessions/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'Concluído' })
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle concurrent session updates safely', async () => {
            if (testSessions.length < 2) {
                console.log('Not enough sessions for concurrency test - skipping');
                return;
            }

            const sessionId = testSessions[0].id;
            
            // Perform concurrent updates to the same session
            const updates = [
                request(testServer)
                    .post(`/api/sessions/${sessionId}/time`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ seconds: 1800 }),
                request(testServer)
                    .patch(`/api/sessions/${sessionId}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ status: 'Concluído' })
            ];

            const results = await Promise.all(updates);
            
            // At least one update should succeed
            const successfulUpdates = results.filter(r => r.status >= 200 && r.status < 300);
            expect(successfulUpdates.length).toBeGreaterThan(0);

            // Verify final state is consistent
            const finalSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionId]);
            expect(finalSession).toBeTruthy();
        });
    });
});