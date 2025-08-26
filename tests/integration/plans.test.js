/**
 * FASE 9 - INTEGRATION TESTS: PLANS
 * 
 * Teste completo do sistema de planos de estudo:
 * - CRUD de planos
 * - Geração de cronograma
 * - Replanejamento inteligente
 * - Disciplinas e tópicos
 * - Batch updates
 * - Conflitos e resoluções
 * - Modo reta final
 * - Exclusões e configurações
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('📋 Plans Integration Tests', () => {
    let testUser;
    let authToken;
    let testServer;
    let testPlan;
    let testSubject;

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear test data
        await dbRun('DELETE FROM users WHERE email LIKE %test.plans%');
        
        // Create test user
        const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
        const result = await dbRun(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            ['test.plans@editaliza.com', hashedPassword, 'Plans Test User', 'user']
        );
        
        testUser = {
            id: result.rows[0].id,
            email: 'test.plans@editaliza.com',
            password: 'TestPassword123!',
            name: 'Plans Test User'
        };

        // Login to get auth token
        const loginResponse = await request(testServer)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });
        
        authToken = loginResponse.body.tokens.accessToken;
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

    describe('GET /api/plans', () => {
        it('should list user plans when authenticated', async () => {
            const response = await request(testServer)
                .get('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plans');
            expect(Array.isArray(response.body.plans)).toBe(true);
        });

        it('should reject request without authentication', async () => {
            const response = await request(testServer)
                .get('/api/plans')
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/plans', () => {
        it('should create a new plan successfully', async () => {
            const newPlan = {
                plan_name: 'Teste TJPE 2025',
                exam_date: '2025-06-15'
            };

            const response = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newPlan)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plan');
            expect(response.body.plan).toHaveProperty('id');
            expect(response.body.plan).toHaveProperty('plan_name', newPlan.plan_name);
            expect(response.body.plan).toHaveProperty('exam_date', newPlan.exam_date);
            expect(response.body.plan).toHaveProperty('user_id', testUser.id);

            // Store for other tests
            testPlan = response.body.plan;

            // Verify plan was created in database
            const dbPlan = await dbGet('SELECT * FROM plans WHERE id = $1', [testPlan.id]);
            expect(dbPlan).toBeTruthy();
            expect(dbPlan.plan_name).toBe(newPlan.plan_name);
        });

        it('should reject plan creation with invalid data', async () => {
            const invalidPlan = {
                plan_name: '', // Empty name
                exam_date: 'invalid-date'
            };

            const response = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidPlan)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });

        it('should reject plan creation without authentication', async () => {
            const newPlan = {
                plan_name: 'Unauthorized Plan',
                exam_date: '2025-06-15'
            };

            const response = await request(testServer)
                .post('/api/plans')
                .send(newPlan)
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/plans/:planId', () => {
        it('should get specific plan details', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plan');
            expect(response.body.plan).toHaveProperty('id', testPlan.id);
            expect(response.body.plan).toHaveProperty('plan_name', testPlan.plan_name);
        });

        it('should reject access to non-existent plan', async () => {
            const response = await request(testServer)
                .get('/api/plans/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });

        it('should reject access without authentication', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}`)
                .expect(401);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('PATCH /api/plans/:planId/settings', () => {
        it('should update plan settings successfully', async () => {
            const settings = {
                daily_question_goal: 50,
                weekly_question_goal: 350,
                session_duration_minutes: 90,
                has_essay: true,
                reta_final_mode: false,
                study_hours_per_day: JSON.stringify({
                    'Segunda': 3,
                    'Terça': 3,
                    'Quarta': 3,
                    'Quinta': 3,
                    'Sexta': 3,
                    'Sábado': 4,
                    'Domingo': 2
                })
            };

            const response = await request(testServer)
                .patch(`/api/plans/${testPlan.id}/settings`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(settings)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify settings were updated
            const dbPlan = await dbGet('SELECT * FROM plans WHERE id = $1', [testPlan.id]);
            expect(dbPlan.daily_question_goal).toBe(settings.daily_question_goal);
            expect(dbPlan.weekly_question_goal).toBe(settings.weekly_question_goal);
            expect(dbPlan.session_duration_minutes).toBe(settings.session_duration_minutes);
            expect(dbPlan.has_essay).toBe(settings.has_essay);
        });

        it('should reject invalid settings values', async () => {
            const invalidSettings = {
                daily_question_goal: -1, // Negative value
                session_duration_minutes: 1000 // Too high
            };

            const response = await request(testServer)
                .patch(`/api/plans/${testPlan.id}/settings`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidSettings)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/plans/:planId/subjects_with_topics', () => {
        it('should create subject with topics successfully', async () => {
            const subjectData = {
                subject_name: 'Direito Constitucional',
                priority_weight: 5,
                topics_list: 'Direitos Fundamentais\nOrganização do Estado\nControle de Constitucionalidade'
            };

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(subjectData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('subject');
            expect(response.body.subject).toHaveProperty('id');
            expect(response.body.subject).toHaveProperty('subject_name', subjectData.subject_name);
            expect(response.body).toHaveProperty('topics');
            expect(Array.isArray(response.body.topics)).toBe(true);
            expect(response.body.topics.length).toBe(3); // 3 topics from the list

            // Store for other tests
            testSubject = response.body.subject;

            // Verify subject was created in database
            const dbSubject = await dbGet('SELECT * FROM subjects WHERE id = $1', [testSubject.id]);
            expect(dbSubject).toBeTruthy();
            expect(dbSubject.subject_name).toBe(subjectData.subject_name);

            // Verify topics were created
            const dbTopics = await dbAll('SELECT * FROM topics WHERE subject_id = $1', [testSubject.id]);
            expect(dbTopics.length).toBe(3);
        });

        it('should reject subject creation with invalid data', async () => {
            const invalidSubject = {
                subject_name: '', // Empty name
                priority_weight: 6, // Out of range (1-5)
                topics_list: ''
            };

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidSubject)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('GET /api/plans/:planId/subjects_with_topics', () => {
        it('should list subjects with their topics', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('subjects');
            expect(Array.isArray(response.body.subjects)).toBe(true);
            
            if (response.body.subjects.length > 0) {
                const subject = response.body.subjects[0];
                expect(subject).toHaveProperty('id');
                expect(subject).toHaveProperty('subject_name');
                expect(subject).toHaveProperty('topics');
                expect(Array.isArray(subject.topics)).toBe(true);
            }
        });
    });

    describe('POST /api/plans/:planId/generate', () => {
        it('should generate study schedule successfully', async () => {
            // Make sure we have subjects and topics first
            if (!testSubject) {
                const subjectData = {
                    subject_name: 'Direito Civil',
                    priority_weight: 4,
                    topics_list: 'Pessoas\nBens\nObrigações\nContratos'
                };

                const subjectResponse = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(subjectData);

                testSubject = subjectResponse.body.subject;
            }

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('schedule');
            expect(response.body.schedule).toHaveProperty('totalSessions');
            expect(response.body.schedule).toHaveProperty('studyDays');
            expect(response.body.schedule).toHaveProperty('totalStudyHours');

            // Verify schedule was created in database
            const schedules = await dbAll('SELECT * FROM schedules WHERE plan_id = $1', [testPlan.id]);
            expect(schedules.length).toBeGreaterThan(0);
        }, 15000);

        it('should reject generation for plan without subjects', async () => {
            // Create a new plan without subjects
            const emptyPlan = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Empty Plan',
                    exam_date: '2025-12-31'
                });

            const response = await request(testServer)
                .post(`/api/plans/${emptyPlan.body.plan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error');

            // Clean up empty plan
            await dbRun('DELETE FROM plans WHERE id = $1', [emptyPlan.body.plan.id]);
        });
    });

    describe('GET /api/plans/:planId/schedule', () => {
        it('should get study schedule grouped by date', async () => {
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
            }
        });
    });

    describe('GET /api/plans/:planId/overdue_check', () => {
        it('should check for overdue sessions', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/overdue_check`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('overdue');
            expect(response.body.overdue).toHaveProperty('count');
            expect(response.body.overdue).toHaveProperty('sessions');
            expect(Array.isArray(response.body.overdue.sessions)).toBe(true);
        });
    });

    describe('GET /api/plans/:planId/replan-preview', () => {
        it('should generate replan preview with analysis', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/replan-preview`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('preview');
            expect(response.body.preview).toHaveProperty('analysis');
            expect(response.body.preview).toHaveProperty('changes');
            expect(response.body.preview).toHaveProperty('impact');
        });
    });

    describe('POST /api/plans/:planId/replan', () => {
        it('should execute intelligent replan', async () => {
            // First create some overdue sessions to trigger replan logic
            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/replan`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('result');
            expect(response.body.result).toHaveProperty('sessionsUpdated');
            expect(response.body.result).toHaveProperty('newEndDate');
        }, 15000);
    });

    describe('POST /api/plans/:planId/batch_update', () => {
        let sessionIds = [];

        beforeAll(async () => {
            // Get some session IDs for batch update
            const schedules = await dbAll(
                'SELECT id FROM schedules WHERE plan_id = $1 LIMIT 3',
                [testPlan.id]
            );
            sessionIds = schedules.map(s => s.id);
        });

        it('should perform batch update of sessions', async () => {
            if (sessionIds.length === 0) {
                console.log('No sessions found for batch update test - skipping');
                return;
            }

            const updates = sessionIds.map((id, index) => ({
                sessionId: id,
                status: index % 2 === 0 ? 'Concluído' : 'Pendente',
                questionsResolved: (index + 1) * 10,
                timeStudiedSeconds: (index + 1) * 1800 // 30, 60, 90 minutes
            }));

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/batch_update`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ updates })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('updated');
            expect(response.body.updated).toBe(updates.length);

            // Verify updates were applied
            for (let i = 0; i < sessionIds.length; i++) {
                const session = await dbGet('SELECT * FROM schedules WHERE id = $1', [sessionIds[i]]);
                expect(session.status).toBe(updates[i].status);
                expect(session.questions_resolved).toBe(updates[i].questionsResolved);
            }
        });

        it('should reject batch update with invalid data', async () => {
            const invalidUpdates = [
                {
                    sessionId: 'invalid', // Should be number
                    status: 'InvalidStatus'
                }
            ];

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/batch_update`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ updates: invalidUpdates })
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });
    });

    describe('Schedule Conflicts', () => {
        describe('GET /api/plans/:planId/schedule-conflicts', () => {
            it('should detect schedule conflicts', async () => {
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/schedule-conflicts`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('conflicts');
                expect(response.body.conflicts).toHaveProperty('detected');
                expect(response.body.conflicts).toHaveProperty('summary');
                expect(response.body.conflicts).toHaveProperty('details');
                expect(Array.isArray(response.body.conflicts.details)).toBe(true);
            });
        });

        describe('POST /api/plans/:planId/resolve-conflicts', () => {
            it('should resolve conflicts automatically', async () => {
                const response = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/resolve-conflicts`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        resolution: {
                            strategy: 'automatic',
                            priority: 'balanced'
                        }
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('resolved');
                expect(response.body.resolved).toHaveProperty('conflicts');
                expect(response.body.resolved).toHaveProperty('actions');
            });

            it('should reject invalid resolution strategy', async () => {
                const response = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/resolve-conflicts`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        resolution: {
                            strategy: 'invalid_strategy'
                        }
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            });
        });
    });

    describe('Reta Final Mode', () => {
        describe('GET /api/plans/:planId/reta-final-exclusions', () => {
            it('should get reta final exclusions', async () => {
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/reta-final-exclusions`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('exclusions');
                expect(Array.isArray(response.body.exclusions)).toBe(true);
            });
        });

        describe('POST /api/plans/:planId/reta-final-exclusions', () => {
            it('should add reta final exclusion', async () => {
                // Get a topic ID first
                const topics = await dbAll(
                    'SELECT t.id FROM topics t JOIN subjects s ON t.subject_id = s.id WHERE s.plan_id = $1 LIMIT 1',
                    [testPlan.id]
                );

                if (topics.length === 0) {
                    console.log('No topics found for exclusion test - skipping');
                    return;
                }

                const response = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/reta-final-exclusions`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        topicId: topics[0].id,
                        reason: 'Tópico muito extenso para reta final'
                    })
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('exclusion');
                expect(response.body.exclusion).toHaveProperty('id');
                expect(response.body.exclusion).toHaveProperty('topic_id', topics[0].id);
            });

            it('should reject exclusion with invalid topic ID', async () => {
                const response = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/reta-final-exclusions`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        topicId: 'invalid',
                        reason: 'Test reason'
                    })
                    .expect(400);

                expect(response.body).toHaveProperty('error');
                expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
            });
        });
    });

    describe('Plan Statistics and Analytics', () => {
        describe('GET /api/plans/:planId/statistics', () => {
            it('should get comprehensive plan statistics', async () => {
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/statistics`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('statistics');
                expect(response.body.statistics).toHaveProperty('overview');
                expect(response.body.statistics).toHaveProperty('progress');
                expect(response.body.statistics).toHaveProperty('subjects');
            });
        });

        describe('GET /api/plans/:planId/progress', () => {
            it('should get plan progress data', async () => {
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/progress`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('progress');
                expect(response.body.progress).toHaveProperty('percentage');
                expect(response.body.progress).toHaveProperty('completed');
                expect(response.body.progress).toHaveProperty('total');
            });
        });

        describe('GET /api/plans/:planId/gamification', () => {
            it('should get gamification data', async () => {
                const response = await request(testServer)
                    .get(`/api/plans/${testPlan.id}/gamification`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('gamification');
                expect(response.body.gamification).toHaveProperty('level');
                expect(response.body.gamification).toHaveProperty('badges');
                expect(response.body.gamification).toHaveProperty('streak');
            });
        });
    });

    describe('DELETE /api/plans/:planId', () => {
        it('should delete plan with cascade', async () => {
            // Create a temporary plan for deletion test
            const tempPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    plan_name: 'Temporary Plan for Deletion',
                    exam_date: '2025-12-31'
                });

            const tempPlanId = tempPlanResponse.body.plan.id;

            const response = await request(testServer)
                .delete(`/api/plans/${tempPlanId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');

            // Verify plan was deleted
            const deletedPlan = await dbGet('SELECT * FROM plans WHERE id = $1', [tempPlanId]);
            expect(deletedPlan).toBeNull();
        });

        it('should reject deletion of non-existent plan', async () => {
            const response = await request(testServer)
                .delete('/api/plans/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Edge Cases & Security', () => {
        it('should prevent access to other users plans', async () => {
            // Create another user
            const hashedPassword = await bcrypt.hash('OtherPassword123!', 12);
            const otherUserResult = await dbRun(
                'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
                ['other.plans@editaliza.com', hashedPassword, 'Other User']
            );
            
            const otherUserId = otherUserResult.rows[0].id;

            // Create plan for other user
            const otherPlanResult = await dbRun(
                'INSERT INTO plans (user_id, plan_name, exam_date) VALUES ($1, $2, $3) RETURNING id',
                [otherUserId, 'Other User Plan', '2025-12-31']
            );
            
            const otherPlanId = otherPlanResult.rows[0].id;

            // Try to access other user's plan
            const response = await request(testServer)
                .get(`/api/plans/${otherPlanId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404); // Should return 404, not 403, for security

            expect(response.body).toHaveProperty('error');

            // Clean up
            await dbRun('DELETE FROM plans WHERE id = $1', [otherPlanId]);
            await dbRun('DELETE FROM users WHERE id = $1', [otherUserId]);
        });

        it('should handle malformed plan IDs safely', async () => {
            const response = await request(testServer)
                .get('/api/plans/invalid-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        });

        it('should handle extremely large topic lists', async () => {
            const largeTopic = 'a'.repeat(1000);
            const largeTopicsList = Array(50).fill(largeTopic).join('\n'); // 50 topics of 1000 chars each

            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    subject_name: 'Large Subject',
                    priority_weight: 3,
                    topics_list: largeTopicsList
                });

            // Should either succeed with truncation or fail with validation error
            expect([200, 201, 400]).toContain(response.status);
        });
    });
});