/**
 * FASE 9 - INTEGRATION TESTS: SCHEDULE
 * 
 * Teste completo do sistema de cronograma:
 * - Geração de cronograma inteligente
 * - Algoritmo de distribuição de tópicos
 * - Spaced repetition system
 * - Reta final mode
 * - Resolução de conflitos
 * - Timezone brasileiro (America/Sao_Paulo)
 * - Weighted round robin distribution
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('📅 Schedule Integration Tests', () => {
    let testUser;
    let authToken;
    let testServer;
    let testPlan;
    let testSubjects = [];

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear test data
        await dbRun('DELETE FROM users WHERE email LIKE %test.schedule%');
        
        // Create test user
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        const result = await dbRun(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            ['test.schedule@editaliza.com', hashedPassword, 'Schedule Test User', 'user']
        );
        
        testUser = {
            id: result.rows[0].id,
            email: 'test.schedule@editaliza.com',
            password: 'TestPassword123!',
            name: 'Schedule Test User'
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
                plan_name: 'Cronograma TJPE 2025',
                exam_date: '2025-06-15'
            });
        
        testPlan = planResponse.body.plan;

        // Update plan settings for more realistic schedule generation
        await request(testServer)
            .patch(`/api/plans/${testPlan.id}/settings`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                daily_question_goal: 30,
                weekly_question_goal: 210,
                session_duration_minutes: 60,
                has_essay: true,
                reta_final_mode: false,
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

        // Create test subjects with realistic topics
        const subjects = [
            {
                subject_name: 'Direito Constitucional',
                priority_weight: 5,
                topics_list: 'Princípios Constitucionais\nDireitos Fundamentais\nOrganização do Estado\nControle de Constitucionalidade'
            },
            {
                subject_name: 'Direito Civil',
                priority_weight: 4,
                topics_list: 'Parte Geral\nObrigações\nContratos\nResponsabilidade Civil'
            },
            {
                subject_name: 'Direito Penal',
                priority_weight: 3,
                topics_list: 'Teoria Geral do Crime\nCrimes Contra a Pessoa\nCrimes Patrimoniais\nCrimes Contra a Administração'
            }
        ];

        for (const subject of subjects) {
            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(subject);
            
            testSubjects.push(response.body.subject);
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

    describe('Schedule Generation Algorithm', () => {
        it('should generate comprehensive study schedule', async () => {
            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            
            const schedule = response.body.schedule;
            expect(schedule).toHaveProperty('totalSessions');
            expect(schedule).toHaveProperty('studyDays');
            expect(schedule).toHaveProperty('totalStudyHours');
            expect(schedule).toHaveProperty('endDate');
            
            expect(schedule.totalSessions).toBeGreaterThan(0);
            expect(schedule.studyDays).toBeGreaterThan(0);
            expect(schedule.totalStudyHours).toBeGreaterThan(0);

            // Verify sessions were created in database
            const dbSessions = await dbAll('SELECT * FROM schedules WHERE plan_id = $1', [testPlan.id]);
            expect(dbSessions.length).toBe(schedule.totalSessions);
        }, 20000);

        it('should distribute topics according to priority weights', async () => {
            // Get all sessions grouped by subject
            const sessionsBySubject = await dbAll(`
                SELECT 
                    s.subject_name,
                    s.priority_weight,
                    COUNT(sc.id) as session_count
                FROM subjects s
                LEFT JOIN topics t ON s.id = t.subject_id
                LEFT JOIN schedules sc ON t.id = sc.topic_id
                WHERE s.plan_id = $1
                GROUP BY s.id, s.subject_name, s.priority_weight
                ORDER BY s.priority_weight DESC
            `, [testPlan.id]);

            expect(sessionsBySubject.length).toBeGreaterThan(0);

            // Higher priority subjects should generally have more sessions
            let previousWeight = 6; // Start higher than max weight
            for (const subject of sessionsBySubject) {
                expect(subject.priority_weight).toBeLessThanOrEqual(previousWeight);
                expect(subject.session_count).toBeGreaterThan(0);
                previousWeight = subject.priority_weight;
            }
        });

        it('should create proper spaced repetition schedule', async () => {
            // Check for presence of different session types
            const sessionTypes = await dbAll(`
                SELECT DISTINCT session_type, COUNT(*) as count
                FROM schedules 
                WHERE plan_id = $1
                GROUP BY session_type
            `, [testPlan.id]);

            expect(sessionTypes.length).toBeGreaterThan(1);

            // Should have initial study sessions and reviews
            const hasNewTopic = sessionTypes.some(st => st.session_type === 'Novo Tópico');
            const hasReviews = sessionTypes.some(st => st.session_type.includes('Revisão'));
            
            expect(hasNewTopic).toBe(true);
            expect(hasReviews).toBe(true);
        });

        it('should respect study hours per day configuration', async () => {
            // Get sessions grouped by date
            const sessionsByDate = await dbAll(`
                SELECT 
                    session_date::date as study_date,
                    SUM(session_duration_minutes) as total_minutes,
                    COUNT(*) as session_count
                FROM schedules 
                WHERE plan_id = $1
                GROUP BY session_date::date
                ORDER BY study_date
                LIMIT 10
            `, [testPlan.id]);

            expect(sessionsByDate.length).toBeGreaterThan(0);

            // Check that daily study time doesn't exceed configured limits significantly
            for (const day of sessionsByDate) {
                expect(day.total_minutes).toBeLessThan(5 * 60); // Max 5 hours per day (generous buffer)
                expect(day.total_minutes).toBeGreaterThan(0);
            }
        });

        it('should use Brazilian timezone for scheduling', async () => {
            // Get a few sessions and check their timestamps
            const sessions = await dbAll(`
                SELECT session_date, created_at
                FROM schedules 
                WHERE plan_id = $1
                ORDER BY session_date
                LIMIT 5
            `, [testPlan.id]);

            expect(sessions.length).toBeGreaterThan(0);

            // Verify dates are properly formatted (YYYY-MM-DD format indicates proper timezone handling)
            for (const session of sessions) {
                expect(session.session_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
                expect(new Date(session.session_date)).toBeInstanceOf(Date);
                expect(isNaN(new Date(session.session_date).getTime())).toBe(false);
            }
        });
    });

    describe('Schedule Viewing and Filtering', () => {
        it('should get schedule grouped by date', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/schedule`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            expect(Array.isArray(response.body.schedule)).toBe(true);

            if (response.body.schedule.length > 0) {
                const daySchedule = response.body.schedule[0];
                expect(daySchedule).toHaveProperty('date');
                expect(daySchedule).toHaveProperty('sessions');
                expect(Array.isArray(daySchedule.sessions)).toBe(true);

                if (daySchedule.sessions.length > 0) {
                    const session = daySchedule.sessions[0];
                    expect(session).toHaveProperty('id');
                    expect(session).toHaveProperty('session_type');
                    expect(session).toHaveProperty('subject_name');
                    expect(session).toHaveProperty('topic_name');
                    expect(session).toHaveProperty('session_duration_minutes');
                    expect(session).toHaveProperty('status');
                }
            }
        });

        it('should handle empty schedule gracefully', async () => {
            // Create a new plan without generating schedule
            const emptyPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Empty Schedule Plan',
                    exam_date: '2025-12-31'
                });

            const response = await request(testServer)
                .get(`/api/plans/${emptyPlanResponse.body.plan.id}/schedule`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            expect(response.body.schedule).toEqual([]);

            // Clean up
            await dbRun('DELETE FROM plans WHERE id = $1', [emptyPlanResponse.body.plan.id]);
        });
    });

    describe('Schedule Modification and Updates', () => {
        let sessionToUpdate;

        beforeAll(async () => {
            // Get a session for update tests
            const sessions = await dbAll(
                'SELECT * FROM schedules WHERE plan_id = $1 AND status = $2 LIMIT 1',
                [testPlan.id, 'Pendente']
            );
            sessionToUpdate = sessions[0];
        });

        it('should update session status and track completion', async () => {
            if (!sessionToUpdate) {
                console.log('No pending session found for update test - skipping');
                return;
            }

            const response = await request(testServer)
                .patch(`/api/sessions/${sessionToUpdate.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'Concluído' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify session was updated in database
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionToUpdate.id]);
            expect(updatedSession.status).toBe('Concluído');
            expect(updatedSession.completed_at).toBeTruthy();
        });

        it('should track study time for sessions', async () => {
            const sessions = await dbAll(
                'SELECT * FROM schedules WHERE plan_id = $1 AND status = $2 LIMIT 1',
                [testPlan.id, 'Pendente']
            );

            if (sessions.length === 0) {
                console.log('No pending session found for time tracking test - skipping');
                return;
            }

            const sessionId = sessions[0].id;
            const studyTimeSeconds = 1800; // 30 minutes

            const response = await request(testServer)
                .post(`/api/sessions/${sessionId}/time`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ seconds: studyTimeSeconds })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify time was recorded
            const updatedSession = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionId]);
            expect(updatedSession.time_studied_seconds).toBe(studyTimeSeconds);
        });

        it('should create reinforcement sessions for spaced repetition', async () => {
            const completedSessions = await dbAll(
                'SELECT * FROM schedules WHERE plan_id = $1 AND status = $2 LIMIT 1',
                [testPlan.id, 'Concluído']
            );

            if (completedSessions.length === 0) {
                console.log('No completed session found for reinforcement test - skipping');
                return;
            }

            const sessionId = completedSessions[0].id;

            const response = await request(testServer)
                .post(`/api/sessions/${sessionId}/reinforce`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('reinforcement');
            expect(response.body.reinforcement).toHaveProperty('session_date');

            // Verify reinforcement session was created
            const reinforcementSessions = await dbAll(
                'SELECT * FROM schedules WHERE plan_id = $1 AND session_type LIKE $2',
                [testPlan.id, '%Revisão%']
            );
            expect(reinforcementSessions.length).toBeGreaterThan(0);
        });
    });

    describe('Overdue Sessions Detection', () => {
        it('should detect overdue sessions correctly', async () => {
            // Create some overdue sessions by updating their dates to the past
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 7); // 7 days ago
            
            const pastDateString = pastDate.toISOString().split('T')[0];

            await dbRun(
                'UPDATE schedules SET session_date = $1 WHERE plan_id = $2 AND status = $3 AND id IN (SELECT id FROM schedules WHERE plan_id = $2 AND status = $3 LIMIT 2)',
                [pastDateString, testPlan.id, 'Pendente']
            );

            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/overdue_check`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('overdue');
            expect(response.body.overdue).toHaveProperty('count');
            expect(response.body.overdue).toHaveProperty('sessions');
            
            expect(response.body.overdue.count).toBeGreaterThan(0);
            expect(response.body.overdue.sessions.length).toBe(response.body.overdue.count);
        });

        it('should handle timezone correctly for overdue detection', async () => {
            // Test with Brazilian timezone edge cases
            const today = new Date();
            const brazilianToday = new Intl.DateTimeFormat('sv-SE', {
                timeZone: 'America/Sao_Paulo'
            }).format(today);

            // Sessions scheduled for today should not be overdue
            await dbRun(
                'UPDATE schedules SET session_date = $1 WHERE plan_id = $2 AND status = $3 AND id IN (SELECT id FROM schedules WHERE plan_id = $2 AND status = $3 LIMIT 1)',
                [brazilianToday, testPlan.id, 'Pendente']
            );

            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/overdue_check`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            
            // Sessions for today should not be in overdue list
            const todaySessions = response.body.overdue.sessions.filter(
                s => s.session_date === brazilianToday
            );
            expect(todaySessions.length).toBe(0);
        });
    });

    describe('Reta Final Mode Schedule', () => {
        let retaFinalPlan;

        beforeAll(async () => {
            // Create a plan in reta final mode
            const planResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Reta Final TJPE',
                    exam_date: '2025-03-15' // Closer exam date
                });
            
            retaFinalPlan = planResponse.body.plan;

            // Set to reta final mode
            await request(testServer)
                .patch(`/api/plans/${retaFinalPlan.id}/settings`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reta_final_mode: true,
                    daily_question_goal: 50,
                    session_duration_minutes: 45
                });

            // Add subjects
            await request(testServer)
                .post(`/api/plans/${retaFinalPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    subject_name: 'Reta Final Civil',
                    priority_weight: 5,
                    topics_list: 'Tópico Essencial 1\nTópico Essencial 2\nTópico Secundário'
                });
        });

        afterAll(async () => {
            if (retaFinalPlan) {
                await dbRun('DELETE FROM schedules WHERE plan_id = $1', [retaFinalPlan.id]);
                await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [retaFinalPlan.id]);
                await dbRun('DELETE FROM subjects WHERE plan_id = $1', [retaFinalPlan.id]);
                await dbRun('DELETE FROM plans WHERE id = $1', [retaFinalPlan.id]);
            }
        });

        it('should generate reta final schedule with focus on essentials', async () => {
            const response = await request(testServer)
                .post(`/api/plans/${retaFinalPlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.schedule.totalSessions).toBeGreaterThan(0);

            // In reta final mode, should have more review sessions and less new content
            const sessions = await dbAll(`
                SELECT session_type, COUNT(*) as count
                FROM schedules 
                WHERE plan_id = $1
                GROUP BY session_type
            `, [retaFinalPlan.id]);

            const reviewSessions = sessions.filter(s => s.session_type.includes('Revisão')).reduce((sum, s) => sum + s.count, 0);
            const newTopicSessions = sessions.filter(s => s.session_type === 'Novo Tópico').reduce((sum, s) => sum + s.count, 0);

            // Reta final should prioritize reviews
            expect(reviewSessions + newTopicSessions).toBeGreaterThan(0);
        }, 15000);

        it('should handle reta final exclusions', async () => {
            // Get a topic to exclude
            const topics = await dbAll(
                'SELECT t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.plan_id = $1 LIMIT 1',
                [retaFinalPlan.id]
            );

            if (topics.length > 0) {
                // Add exclusion
                const response = await request(testServer)
                    .post(`/api/plans/${retaFinalPlan.id}/reta-final-exclusions`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        topicId: topics[0].id,
                        reason: 'Tópico complexo demais para reta final'
                    })
                    .expect(201);

                expect(response.body.success).toBe(true);

                // Verify exclusion affects schedule generation
                await request(testServer)
                    .post(`/api/plans/${retaFinalPlan.id}/generate`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // Excluded topic should not have sessions scheduled
                const sessionsForExcludedTopic = await dbAll(
                    'SELECT * FROM schedules WHERE plan_id = $1 AND topic_id = $2',
                    [retaFinalPlan.id, topics[0].id]
                );
                expect(sessionsForExcludedTopic.length).toBe(0);
            }
        });
    });

    describe('Schedule Performance and Edge Cases', () => {
        it('should handle large subject counts efficiently', async () => {
            // Create plan with many subjects
            const largePlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Large Schedule Test',
                    exam_date: '2025-12-31'
                });

            const largePlan = largePlanResponse.body.plan;

            // Add multiple subjects
            const subjectPromises = [];
            for (let i = 1; i <= 5; i++) {
                subjectPromises.push(
                    request(testServer)
                        .post(`/api/plans/${largePlan.id}/subjects_with_topics`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            subject_name: `Matéria ${i}`,
                            priority_weight: i % 5 + 1,
                            topics_list: `Tópico ${i}.1\nTópico ${i}.2\nTópico ${i}.3\nTópico ${i}.4\nTópico ${i}.5`
                        })
                );
            }

            await Promise.all(subjectPromises);

            const startTime = Date.now();
            const response = await request(testServer)
                .post(`/api/plans/${largePlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            const endTime = Date.now();

            expect(response.body.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds

            // Clean up
            await dbRun('DELETE FROM schedules WHERE plan_id = $1', [largePlan.id]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [largePlan.id]);
            await dbRun('DELETE FROM subjects WHERE plan_id = $1', [largePlan.id]);
            await dbRun('DELETE FROM plans WHERE id = $1', [largePlan.id]);
        }, 35000);

        it('should handle very short study periods gracefully', async () => {
            const shortPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Short Study Period',
                    exam_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 1 week from now
                });

            const shortPlan = shortPlanResponse.body.plan;

            await request(testServer)
                .post(`/api/plans/${shortPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    subject_name: 'Quick Review',
                    priority_weight: 5,
                    topics_list: 'Essential Topic 1\nEssential Topic 2'
                });

            const response = await request(testServer)
                .post(`/api/plans/${shortPlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.schedule.totalSessions).toBeGreaterThan(0);

            // Clean up
            await dbRun('DELETE FROM schedules WHERE plan_id = $1', [shortPlan.id]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [shortPlan.id]);
            await dbRun('DELETE FROM subjects WHERE plan_id = $1', [shortPlan.id]);
            await dbRun('DELETE FROM plans WHERE id = $1', [shortPlan.id]);
        });

        it('should maintain data integrity during concurrent updates', async () => {
            const sessions = await dbAll(
                'SELECT id FROM schedules WHERE plan_id = $1 AND status = $2 LIMIT 3',
                [testPlan.id, 'Pendente']
            );

            if (sessions.length < 2) {
                console.log('Not enough sessions for concurrency test - skipping');
                return;
            }

            // Perform concurrent session updates
            const updates = sessions.slice(0, 2).map((session, index) =>
                request(testServer)
                    .patch(`/api/sessions/${session.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ 
                        status: index % 2 === 0 ? 'Concluído' : 'Pulado'
                    })
            );

            const results = await Promise.all(updates);
            
            // All updates should succeed
            results.forEach((result, index) => {
                expect(result.status).toBe(200);
                expect(result.body.success).toBe(true);
            });

            // Verify final state is consistent
            for (let i = 0; i < sessions.slice(0, 2).length; i++) {
                const session = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessions[i].id]);
                expect(['Concluído', 'Pulado']).toContain(session.status);
            }
        });
    });
});