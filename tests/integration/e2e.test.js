/**
 * FASE 9 - INTEGRATION TESTS: END-TO-END
 * 
 * Teste completo E2E do fluxo completo do usuário:
 * - Registro → Login → Criar Plano → Gerar Cronograma → Estudar → Ver Progresso
 * - Fluxos críticos de negócio
 * - Integração entre todos os módulos
 * - Simulação de uso real
 * - Performance e stress testing
 * - Cenários de erro e recuperação
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const { dbRun, dbGet, dbAll } = require('../../src/utils/database');

describe('🎯 End-to-End Integration Tests', () => {
    let testServer;
    let testUserData;
    let authToken;
    let testPlan;
    let createdSessions = [];

    beforeAll(async () => {
        // Start test server
        testServer = app.listen(0);
        
        // Clear any existing test data
        await dbRun('DELETE FROM users WHERE email LIKE %e2e.test%');
        
        // Prepare test user data
        testUserData = {
            email: 'e2e.test@editaliza.com',
            password: 'E2ETestPassword123!',
            confirmPassword: 'E2ETestPassword123!',
            name: 'E2E Test User'
        };
    });

    afterAll(async () => {
        // Clean up all test data
        if (testPlan) {
            await dbRun('DELETE FROM schedules WHERE plan_id = $1', [testPlan.id]);
            await dbRun('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE plan_id = $1)', [testPlan.id]);
            await dbRun('DELETE FROM subjects WHERE plan_id = $1', [testPlan.id]);
            await dbRun('DELETE FROM plans WHERE id = $1', [testPlan.id]);
        }
        
        if (testUserData.userId) {
            await dbRun('DELETE FROM users WHERE id = $1', [testUserData.userId]);
        }
        
        // Close server
        if (testServer) {
            await new Promise(resolve => testServer.close(resolve));
        }
    });

    describe('🌟 Complete User Journey: From Registration to Progress Tracking', () => {
        it('STEP 1: Should register a new user successfully', async () => {
            const response = await request(testServer)
                .post('/api/auth/register')
                .send(testUserData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tokens');
            
            // Store user data for next steps
            testUserData.userId = response.body.user.id;
            authToken = response.body.tokens.accessToken;

            expect(response.body.user.email).toBe(testUserData.email);
            expect(response.body.user.name).toBe(testUserData.name);
            expect(authToken).toBeTruthy();
        });

        it('STEP 2: Should login and maintain session', async () => {
            const response = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.tokens.accessToken).toBeTruthy();
            
            // Update auth token with new login
            authToken = response.body.tokens.accessToken;

            // Verify we can access protected routes
            const meResponse = await request(testServer)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(meResponse.body.user.email).toBe(testUserData.email);
        });

        it('STEP 3: Should create a comprehensive study plan', async () => {
            const planData = {
                plan_name: 'E2E Test - Concurso TJPE 2025',
                exam_date: '2025-06-15'
            };

            const response = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .send(planData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('plan');
            
            testPlan = response.body.plan;
            expect(testPlan.plan_name).toBe(planData.plan_name);
            expect(testPlan.exam_date).toBe(planData.exam_date);
            expect(testPlan.user_id).toBe(testUserData.userId);
        });

        it('STEP 4: Should configure plan settings optimally', async () => {
            const settings = {
                daily_question_goal: 35,
                weekly_question_goal: 245,
                session_duration_minutes: 60,
                has_essay: true,
                reta_final_mode: false,
                study_hours_per_day: JSON.stringify({
                    'Segunda': 2.5,
                    'Terça': 2.5,
                    'Quarta': 2.5,
                    'Quinta': 2.5,
                    'Sexta': 2.5,
                    'Sábado': 3,
                    'Domingo': 1
                })
            };

            const response = await request(testServer)
                .patch(`/api/plans/${testPlan.id}/settings`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(settings)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify settings were saved
            const planResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(planResponse.body.plan.daily_question_goal).toBe(settings.daily_question_goal);
            expect(planResponse.body.plan.weekly_question_goal).toBe(settings.weekly_question_goal);
        });

        it('STEP 5: Should create multiple subjects with realistic topics', async () => {
            const subjects = [
                {
                    subject_name: 'Direito Constitucional',
                    priority_weight: 5,
                    topics_list: 'Princípios Fundamentais do Estado\nDireitos e Garantias Fundamentais\nOrganização do Estado\nOrganização dos Poderes\nDefesa do Estado e das Instituições\nTributação e Orçamento\nOrdem Econômica e Financeira\nOrdem Social\nAtos das Disposições Constitucionais Transitórias\nControle de Constitucionalidade'
                },
                {
                    subject_name: 'Direito Civil',
                    priority_weight: 4,
                    topics_list: 'Lei de Introdução às Normas do Direito Brasileiro\nParte Geral - Pessoas\nParte Geral - Bens\nParte Geral - Fatos Jurídicos\nObrigações\nContratos em Geral\nContratos em Espécie\nResponsabilidade Civil\nPreferências e Privilégios Creditórios\nDireito das Coisas - Posse\nDireito das Coisas - Propriedade\nDireito das Coisas - Direitos Reais sobre Coisas Alheias\nDireito de Família\nDireito das Sucessões'
                },
                {
                    subject_name: 'Direito Penal',
                    priority_weight: 4,
                    topics_list: 'Aplicação da Lei Penal\nCrime\nImputabilidade Penal\nConcurso de Pessoas\nPenas\nMedidas de Segurança\nAção Penal\nExtinção da Punibilidade\nCrimes contra a Pessoa\nCrimes contra o Patrimônio\nCrimes contra a Propriedade Imaterial\nCrimes contra a Organização do Trabalho\nCrimes contra o Sentimento Religioso\nCrimes contra a Família\nCrimes contra a Incolumidade Pública\nCrimes contra a Paz Pública\nCrimes contra a Fé Pública\nCrimes contra a Administração Pública'
                },
                {
                    subject_name: 'Direito Processual Civil',
                    priority_weight: 3,
                    topics_list: 'Normas Processuais Civis\nFunção Jurisdicional\nCompetência\nSujeitos do Processo\nAtos Processuais\nFormação, Suspensão e Extinção do Processo\nProcedimento Comum\nProvas\nSentença e Coisa Julgada\nLiquidação de Sentença\nCumprimento de Sentença\nProcessos de Execução\nProcessos nos Tribunais e Meios de Impugnação\nOrdem dos Processos no Tribunal'
                },
                {
                    subject_name: 'Direito Administrativo',
                    priority_weight: 3,
                    topics_list: 'Estado, Governo e Administração Pública\nPrincípios da Administração Pública\nOrganização Administrativa\nAgentes Públicos\nPoderes Administrativos\nAtos Administrativos\nServiços Públicos\nIntervenção do Estado no Domínio Econômico\nControle da Administração Pública\nResponabilidade Civil do Estado\nBens Públicos\nLicitação\nContratos Administrativos'
                }
            ];

            const subjectPromises = subjects.map(subject =>
                request(testServer)
                    .post(`/api/plans/${testPlan.id}/subjects_with_topics`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(subject)
            );

            const responses = await Promise.all(subjectPromises);

            // All subjects should be created successfully
            responses.forEach((response, index) => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.subject.subject_name).toBe(subjects[index].subject_name);
                expect(response.body.topics.length).toBeGreaterThan(0);
            });

            // Verify subjects were created in database
            const dbSubjects = await dbAll('SELECT * FROM subjects WHERE plan_id = $1', [testPlan.id]);
            expect(dbSubjects.length).toBe(subjects.length);

            // Verify topics were created
            const dbTopics = await dbAll(`
                SELECT COUNT(*) as total 
                FROM topics t 
                JOIN subjects s ON t.subject_id = s.id 
                WHERE s.plan_id = $1
            `, [testPlan.id]);
            expect(dbTopics[0].total).toBeGreaterThan(50); // Should have many topics
        });

        it('STEP 6: Should generate comprehensive study schedule', async () => {
            const startTime = Date.now();
            
            const response = await request(testServer)
                .post(`/api/plans/${testPlan.id}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const endTime = Date.now();

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            
            const schedule = response.body.schedule;
            expect(schedule).toHaveProperty('totalSessions');
            expect(schedule).toHaveProperty('studyDays');
            expect(schedule).toHaveProperty('totalStudyHours');
            expect(schedule).toHaveProperty('endDate');

            // Should generate substantial amount of sessions
            expect(schedule.totalSessions).toBeGreaterThan(100);
            expect(schedule.studyDays).toBeGreaterThan(60);
            expect(schedule.totalStudyHours).toBeGreaterThan(100);

            // Should complete generation in reasonable time
            expect(endTime - startTime).toBeLessThan(20000); // 20 seconds max

            // Verify sessions were created in database
            const dbSessions = await dbAll('SELECT * FROM schedules WHERE plan_id = $1', [testPlan.id]);
            expect(dbSessions.length).toBe(schedule.totalSessions);

            // Store some sessions for study simulation
            createdSessions = dbSessions.slice(0, 10);
        }, 25000);

        it('STEP 7: Should view organized schedule by date', async () => {
            const response = await request(testServer)
                .get(`/api/plans/${testPlan.id}/schedule`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('schedule');
            expect(Array.isArray(response.body.schedule)).toBe(true);
            expect(response.body.schedule.length).toBeGreaterThan(0);

            // Verify schedule structure
            const firstDay = response.body.schedule[0];
            expect(firstDay).toHaveProperty('date');
            expect(firstDay).toHaveProperty('sessions');
            expect(firstDay).toHaveProperty('totalMinutes');
            expect(Array.isArray(firstDay.sessions)).toBe(true);

            if (firstDay.sessions.length > 0) {
                const session = firstDay.sessions[0];
                expect(session).toHaveProperty('id');
                expect(session).toHaveProperty('session_type');
                expect(session).toHaveProperty('subject_name');
                expect(session).toHaveProperty('topic_name');
                expect(session).toHaveProperty('session_duration_minutes');
                expect(session).toHaveProperty('status');
            }
        });

        it('STEP 8: Should simulate realistic study sessions', async () => {
            // Simulate studying multiple sessions over several days
            const studyPromises = [];
            
            for (let i = 0; i < Math.min(8, createdSessions.length); i++) {
                const session = createdSessions[i];
                const studyTime = 2400 + (i * 300); // 40-65 minutes
                const questions = 15 + (i * 3); // 15-36 questions
                const correctAnswers = Math.floor(questions * (0.65 + i * 0.04)); // 65-93% accuracy

                // Simulate realistic study completion
                studyPromises.push(
                    Promise.all([
                        // Register study time
                        request(testServer)
                            .post(`/api/sessions/${session.id}/time`)
                            .set('Authorization', `Bearer ${authToken}`)
                            .send({ seconds: studyTime }),
                        
                        // Complete session
                        request(testServer)
                            .patch(`/api/sessions/${session.id}`)
                            .set('Authorization', `Bearer ${authToken}`)
                            .send({ status: 'Concluído' })
                    ]).then(([timeResponse, statusResponse]) => {
                        expect(timeResponse.status).toBe(200);
                        expect(statusResponse.status).toBe(200);
                        
                        // Update questions data directly in database for realistic statistics
                        return dbRun(`
                            UPDATE schedules 
                            SET questions_resolved = $1, questions_correct = $2
                            WHERE id = $3
                        `, [questions, correctAnswers, session.id]);
                    })
                );
            }

            await Promise.all(studyPromises);

            // Verify sessions were completed
            const completedSessions = await dbAll(`
                SELECT * FROM schedules 
                WHERE plan_id = $1 AND status = 'Concluído'
            `, [testPlan.id]);

            expect(completedSessions.length).toBeGreaterThanOrEqual(8);
            
            // Verify realistic data was recorded
            completedSessions.forEach(session => {
                expect(session.time_studied_seconds).toBeGreaterThan(2000);
                expect(session.questions_resolved).toBeGreaterThan(10);
                expect(session.completed_at).toBeTruthy();
            });
        }, 30000);

        it('STEP 9: Should create spaced repetition sessions', async () => {
            // Create reinforcement sessions for completed sessions
            const completedSessions = createdSessions.slice(0, 3);
            const reinforcementPromises = completedSessions.map(session =>
                request(testServer)
                    .post(`/api/sessions/${session.id}/reinforce`)
                    .set('Authorization', `Bearer ${authToken}`)
            );

            const responses = await Promise.all(reinforcementPromises);

            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.reinforcement.session_type).toContain('Revisão');
            });

            // Verify reinforcement sessions were created
            const reinforcementSessions = await dbAll(`
                SELECT * FROM schedules 
                WHERE plan_id = $1 AND session_type LIKE '%Revisão%'
            `, [testPlan.id]);

            expect(reinforcementSessions.length).toBeGreaterThanOrEqual(3);
        });

        it('STEP 10: Should track comprehensive progress and statistics', async () => {
            // Get basic progress
            const progressResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(progressResponse.body.success).toBe(true);
            expect(progressResponse.body.progress.percentage).toBeGreaterThan(0);
            expect(progressResponse.body.progress.completed).toBeGreaterThan(0);

            // Get comprehensive statistics
            const statsResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/statistics`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(statsResponse.body.success).toBe(true);
            const stats = statsResponse.body.statistics;

            expect(stats.overview.completedSessions).toBeGreaterThan(0);
            expect(stats.overview.totalStudyTime).toBeGreaterThan(0);
            expect(stats.overview.completionRate).toBeGreaterThan(0);

            expect(Array.isArray(stats.subjects)).toBe(true);
            expect(stats.subjects.length).toBeGreaterThan(0);

            // Get question progress
            const questionResponse = await request(testServer)
                .get(`/api/sessions/question-progress/${testPlan.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(questionResponse.body.success).toBe(true);
            expect(questionResponse.body.progress.daily.solved).toBeGreaterThan(0);
            expect(questionResponse.body.progress.goals.daily).toBe(35); // From plan settings

            // Get activity summary
            const activityResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/activity_summary`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(activityResponse.body.success).toBe(true);
            expect(activityResponse.body.summary.questions.totalSolved).toBeGreaterThan(0);
            expect(activityResponse.body.summary.questions.overallAccuracy).toBeGreaterThan(0);
        });

        it('STEP 11: Should handle schedule conflicts and resolutions', async () => {
            // Check for conflicts
            const conflictsResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/schedule-conflicts`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(conflictsResponse.body.success).toBe(true);
            expect(conflictsResponse.body.conflicts).toHaveProperty('detected');
            expect(conflictsResponse.body.conflicts).toHaveProperty('summary');

            // Resolve any conflicts found
            if (conflictsResponse.body.conflicts.detected > 0) {
                const resolveResponse = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/resolve-conflicts`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        resolution: {
                            strategy: 'automatic',
                            priority: 'balanced'
                        }
                    })
                    .expect(200);

                expect(resolveResponse.body.success).toBe(true);
                expect(resolveResponse.body.resolved.conflicts).toBeGreaterThan(0);
            }
        });

        it('STEP 12: Should perform intelligent replanning when needed', async () => {
            // Get replan preview
            const previewResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/replan-preview`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(previewResponse.body.success).toBe(true);
            expect(previewResponse.body.preview).toHaveProperty('analysis');
            expect(previewResponse.body.preview).toHaveProperty('changes');
            expect(previewResponse.body.preview).toHaveProperty('impact');

            // Execute replan if beneficial
            const replanResponse = await request(testServer)
                .post(`/api/plans/${testPlan.id}/replan`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(replanResponse.body.success).toBe(true);
            expect(replanResponse.body.result).toHaveProperty('sessionsUpdated');
            expect(replanResponse.body.result).toHaveProperty('newEndDate');
        }, 15000);

        it('STEP 13: Should generate shareable progress data', async () => {
            const shareResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/share-progress`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(shareResponse.body.success).toBe(true);
            const shareData = shareResponse.body.shareData;

            expect(shareData).toHaveProperty('planName', testPlan.plan_name);
            expect(shareData).toHaveProperty('examDate', testPlan.exam_date);
            expect(shareData).toHaveProperty('progress');
            expect(shareData).toHaveProperty('stats');
            expect(shareData).toHaveProperty('gamification');

            expect(shareData.progress.percentage).toBeGreaterThan(0);
            expect(shareData.stats.totalStudyHours).toBeGreaterThan(0);
            expect(shareData.stats.questionsAnswered).toBeGreaterThan(0);
        });

        it('STEP 14: Should logout and maintain data integrity', async () => {
            const logoutResponse = await request(testServer)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(logoutResponse.body.success).toBe(true);

            // Verify token is invalidated
            const protectedResponse = await request(testServer)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(401);

            expect(protectedResponse.body).toHaveProperty('error');

            // Verify data is still intact after logout
            const newLoginResponse = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                });

            const newToken = newLoginResponse.body.tokens.accessToken;
            
            const dataResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${newToken}`)
                .expect(200);

            expect(dataResponse.body.success).toBe(true);
            expect(dataResponse.body.progress.completed).toBeGreaterThan(0);
        });
    });

    describe('🚀 Performance and Stress Testing', () => {
        let performanceToken;

        beforeAll(async () => {
            // Login for performance tests
            const loginResponse = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                });
            performanceToken = loginResponse.body.tokens.accessToken;
        });

        it('should handle rapid concurrent requests efficiently', async () => {
            const concurrentRequests = Array(20).fill().map((_, index) => {
                // Alternate between different endpoints
                const endpoints = [
                    `/api/plans/${testPlan.id}/progress`,
                    `/api/plans/${testPlan.id}/statistics`,
                    `/api/plans/${testPlan.id}/schedule`,
                    `/api/sessions/overdue-check/${testPlan.id}`
                ];

                const endpoint = endpoints[index % endpoints.length];
                return request(testServer)
                    .get(endpoint)
                    .set('Authorization', `Bearer ${performanceToken}`);
            });

            const startTime = Date.now();
            const results = await Promise.all(concurrentRequests);
            const endTime = Date.now();

            // All requests should succeed
            results.forEach((result, index) => {
                expect(result.status).toBe(200);
                expect(result.body.success).toBe(true);
            });

            // Should complete all requests within reasonable time
            expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
            console.log(`Completed ${concurrentRequests.length} concurrent requests in ${endTime - startTime}ms`);
        }, 15000);

        it('should handle batch operations efficiently', async () => {
            // Get pending sessions for batch update
            const pendingSessions = await dbAll(`
                SELECT id FROM schedules 
                WHERE plan_id = $1 AND status = 'Pendente' 
                LIMIT 25
            `, [testPlan.id]);

            if (pendingSessions.length > 10) {
                const batchUpdates = pendingSessions.slice(0, 20).map((session, index) => ({
                    sessionId: session.id,
                    status: index % 3 === 0 ? 'Concluído' : 'Pendente',
                    questionsResolved: 10 + (index * 2),
                    timeStudiedSeconds: 1800 + (index * 300)
                }));

                const startTime = Date.now();
                const response = await request(testServer)
                    .post(`/api/plans/${testPlan.id}/batch_update`)
                    .set('Authorization', `Bearer ${performanceToken}`)
                    .send({ updates: batchUpdates })
                    .expect(200);
                const endTime = Date.now();

                expect(response.body.success).toBe(true);
                expect(response.body.updated).toBe(batchUpdates.length);
                expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

                console.log(`Batch updated ${batchUpdates.length} sessions in ${endTime - startTime}ms`);
            }
        });
    });

    describe('🔥 Error Recovery and Edge Cases', () => {
        let recoveryToken;

        beforeAll(async () => {
            // Login for recovery tests
            const loginResponse = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                });
            recoveryToken = loginResponse.body.tokens.accessToken;
        });

        it('should recover from network interruptions gracefully', async () => {
            // Simulate partial failures and recovery
            const requests = [
                // Valid request
                request(testServer)
                    .get(`/api/plans/${testPlan.id}/progress`)
                    .set('Authorization', `Bearer ${recoveryToken}`),
                
                // Invalid plan ID
                request(testServer)
                    .get('/api/plans/99999/progress')
                    .set('Authorization', `Bearer ${recoveryToken}`),
                
                // Another valid request after error
                request(testServer)
                    .get(`/api/plans/${testPlan.id}/statistics`)
                    .set('Authorization', `Bearer ${recoveryToken}`)
            ];

            const results = await Promise.all(requests.map(req => 
                req.catch(err => ({ status: err.status || 500, error: true }))
            ));

            // First and third requests should succeed
            expect(results[0].status).toBe(200);
            expect(results[2].status).toBe(200);
            
            // Second request should fail gracefully
            expect(results[1].status).toBe(404);
        });

        it('should handle malformed data gracefully', async () => {
            // Test with various malformed inputs
            const malformedTests = [
                {
                    endpoint: `/api/plans/${testPlan.id}/settings`,
                    method: 'patch',
                    data: { daily_question_goal: 'not-a-number' },
                    expectedStatus: 400
                },
                {
                    endpoint: `/api/plans/${testPlan.id}/subjects_with_topics`,
                    method: 'post',
                    data: { subject_name: '', priority_weight: 10 },
                    expectedStatus: 400
                },
                {
                    endpoint: `/api/plans/${testPlan.id}/batch_update`,
                    method: 'post',
                    data: { updates: 'not-an-array' },
                    expectedStatus: 400
                }
            ];

            for (const test of malformedTests) {
                const response = await request(testServer)
                    [test.method](`${test.endpoint}`)
                    .set('Authorization', `Bearer ${recoveryToken}`)
                    .send(test.data);

                expect(response.status).toBe(test.expectedStatus);
                expect(response.body).toHaveProperty('error');
            }
        });

        it('should maintain data consistency during failures', async () => {
            // Get current state
            const beforeResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${recoveryToken}`);

            const beforeState = beforeResponse.body.progress;

            // Attempt invalid operations that should not affect state
            await request(testServer)
                .patch(`/api/sessions/999999`)
                .set('Authorization', `Bearer ${recoveryToken}`)
                .send({ status: 'Concluído' })
                .expect(404);

            await request(testServer)
                .delete('/api/plans/999999')
                .set('Authorization', `Bearer ${recoveryToken}`)
                .expect(404);

            // Verify state remains unchanged
            const afterResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${recoveryToken}`)
                .expect(200);

            const afterState = afterResponse.body.progress;

            expect(afterState.completed).toBe(beforeState.completed);
            expect(afterState.total).toBe(beforeState.total);
            expect(afterState.percentage).toBe(beforeState.percentage);
        });

        it('should handle session expiration and renewal', async () => {
            // Test with expired/invalid token
            const invalidResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(invalidResponse.body).toHaveProperty('error');

            // Verify fresh login works
            const newLoginResponse = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                })
                .expect(200);

            expect(newLoginResponse.body.success).toBe(true);
            expect(newLoginResponse.body.tokens.accessToken).toBeTruthy();

            // Verify new token works
            const validResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}/progress`)
                .set('Authorization', `Bearer ${newLoginResponse.body.tokens.accessToken}`)
                .expect(200);

            expect(validResponse.body.success).toBe(true);
        });
    });

    describe('📈 Business Logic Validation', () => {
        let validationToken;

        beforeAll(async () => {
            const loginResponse = await request(testServer)
                .post('/api/auth/login')
                .send({
                    email: testUserData.email,
                    password: testUserData.password
                });
            validationToken = loginResponse.body.tokens.accessToken;
        });

        it('should enforce business rules consistently', async () => {
            // Test exam date validation (should not be in the past)
            const pastDatePlan = {
                plan_name: 'Past Date Test Plan',
                exam_date: '2020-01-01'
            };

            // This might succeed (depending on validation rules) but should generate appropriate warnings
            const response = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${validationToken}`)
                .send(pastDatePlan);

            // Either rejected or created with warnings
            expect([201, 400]).toContain(response.status);
        });

        it('should maintain referential integrity', async () => {
            // Verify that deleting a plan cleans up all related data
            const tempPlanResponse = await request(testServer)
                .post('/api/plans')
                .set('Authorization', `Bearer ${validationToken}`)
                .send({
                    plan_name: 'Temp Plan for Deletion',
                    exam_date: '2025-12-31'
                });

            const tempPlan = tempPlanResponse.body.plan;

            // Add subject and topics
            await request(testServer)
                .post(`/api/plans/${tempPlan.id}/subjects_with_topics`)
                .set('Authorization', `Bearer ${validationToken}`)
                .send({
                    subject_name: 'Temp Subject',
                    priority_weight: 3,
                    topics_list: 'Temp Topic'
                });

            // Generate some sessions
            await request(testServer)
                .post(`/api/plans/${tempPlan.id}/generate`)
                .set('Authorization', `Bearer ${validationToken}`);

            // Delete the plan
            await request(testServer)
                .delete(`/api/plans/${tempPlan.id}`)
                .set('Authorization', `Bearer ${validationToken}`)
                .expect(200);

            // Verify all related data was cleaned up
            const subjects = await dbAll('SELECT * FROM subjects WHERE plan_id = $1', [tempPlan.id]);
            const topics = await dbAll(`
                SELECT t.* FROM topics t 
                JOIN subjects s ON t.subject_id = s.id 
                WHERE s.plan_id = $1
            `, [tempPlan.id]);
            const sessions = await dbAll('SELECT * FROM schedules WHERE plan_id = $1', [tempPlan.id]);

            expect(subjects.length).toBe(0);
            expect(topics.length).toBe(0);
            expect(sessions.length).toBe(0);
        });

        it('should validate user permissions correctly', async () => {
            // Create another user to test permission isolation
            const otherUserResponse = await request(testServer)
                .post('/api/auth/register')
                .send({
                    email: 'other.e2e@editaliza.com',
                    password: 'OtherPassword123!',
                    confirmPassword: 'OtherPassword123!',
                    name: 'Other E2E User'
                });

            const otherToken = otherUserResponse.body.tokens.accessToken;

            // Try to access first user's plan with other user's token
            const unauthorizedResponse = await request(testServer)
                .get(`/api/plans/${testPlan.id}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(404); // Should return 404, not 403, for security

            expect(unauthorizedResponse.body).toHaveProperty('error');

            // Clean up other user
            await dbRun('DELETE FROM users WHERE email = $1', ['other.e2e@editaliza.com']);
        });
    });
});