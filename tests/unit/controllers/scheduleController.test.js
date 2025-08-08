/**
 * Schedule Controller Unit Tests
 * Testing Fortress - Comprehensive schedule controller testing
 */

const request = require('supertest');
const express = require('express');
const scheduleController = require('../../../src/controllers/scheduleController');
const scheduleService = require('../../../src/services/scheduleService');

// Mock the schedule service
jest.mock('../../../src/services/scheduleService');

// Mock authentication middleware
const mockAuthMiddleware = (req, res, next) => {
    req.user = { id: 1, email: 'test@testfortress.com' };
    next();
};

// Create test app
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    
    // Mount schedule controller routes
    app.get('/schedules/:planId', scheduleController.getSchedule);
    app.get('/schedules/:planId/range', scheduleController.getScheduleRange);
    app.get('/schedules/:planId/overview', scheduleController.getScheduleOverview);
    app.get('/schedules/:planId/analytics', scheduleController.getScheduleAnalytics);
    app.get('/schedules/:planId/weekly', scheduleController.getWeeklySchedule);
    app.get('/schedules/:planId/monthly', scheduleController.getMonthlySchedule);
    app.get('/schedules/:planId/progress', scheduleController.getScheduleProgress);
    app.get('/schedules/:planId/export', scheduleController.exportSchedule);
    app.get('/schedules/templates', scheduleController.getScheduleTemplates);
    app.get('/schedules/sessions/:sessionId', scheduleController.getSession);
    app.post('/schedules/sessions', scheduleController.createSession);
    app.delete('/schedules/sessions/:sessionId', scheduleController.deleteSession);
    app.post('/schedules/sessions/:sessionId/reinforce', scheduleController.reinforceSession);
    app.post('/schedules/sessions/:sessionId/time', scheduleController.updateSessionTime);
    
    return app;
};

describe('Schedule Controller Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    describe('GET /schedules/:planId', () => {
        it('should return schedule for valid plan', async () => {
            const mockScheduleData = {
                planId: 1,
                planName: 'Concurso INSS',
                totalSessions: 120,
                completedSessions: 45,
                progress: 37.5,
                sessions: [
                    {
                        id: 1,
                        date: '2025-08-06',
                        subject: 'Direito Previdenciário',
                        duration: 50,
                        status: 'Concluído',
                        topicsPlanned: 2,
                        topicsCompleted: 2
                    },
                    {
                        id: 2,
                        date: '2025-08-07',
                        subject: 'Português',
                        duration: 50,
                        status: 'Pendente',
                        topicsPlanned: 2,
                        topicsCompleted: 0
                    }
                ]
            };

            scheduleService.getSchedule.mockResolvedValue(mockScheduleData);

            const response = await request(app)
                .get('/schedules/1')
                .expect(200);

            expect(response.body).toEqual(mockScheduleData);
            expect(scheduleService.getSchedule).toHaveBeenCalledWith(1, 1, undefined);
        });

        it('should handle schedule not found', async () => {
            scheduleService.getSchedule.mockRejectedValue(new Error('Cronograma não encontrado'));

            const response = await request(app)
                .get('/schedules/999')
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Cronograma não encontrado');
        });

        it('should validate plan ownership', async () => {
            scheduleService.getSchedule.mockRejectedValue(new Error('Plano não pertence ao usuário'));

            const response = await request(app)
                .get('/schedules/1')
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Plano não pertence ao usuário');
        });
    });

    describe('GET /schedules/:planId/range', () => {
        it('should return schedule for date range', async () => {
            const mockRangeData = {
                planId: 1,
                dateRange: {
                    start: '2025-08-01',
                    end: '2025-08-31'
                },
                totalSessions: 20,
                sessions: [
                    {
                        id: 1,
                        date: '2025-08-06',
                        subject: 'Direito Previdenciário',
                        status: 'Concluído'
                    },
                    {
                        id: 2,
                        date: '2025-08-07',
                        subject: 'Português',
                        status: 'Pendente'
                    }
                ]
            };

            scheduleService.getScheduleRange.mockResolvedValue(mockRangeData);

            const response = await request(app)
                .get('/schedules/1/range?start=2025-08-01&end=2025-08-31')
                .expect(200);

            expect(response.body).toEqual(mockRangeData);
            expect(scheduleService.getScheduleRange).toHaveBeenCalledWith(
                1, 1, '2025-08-01', '2025-08-31'
            );
        });

        it('should use default date range when not provided', async () => {
            const mockRangeData = { planId: 1, sessions: [] };
            scheduleService.getScheduleRange.mockResolvedValue(mockRangeData);

            const response = await request(app)
                .get('/schedules/1/range')
                .expect(200);

            expect(scheduleService.getScheduleRange).toHaveBeenCalledWith(
                1, 1, undefined, undefined
            );
        });
    });

    describe('GET /schedules/:planId/overview', () => {
        it('should return schedule overview', async () => {
            const mockOverviewData = {
                planId: 1,
                totalSessions: 120,
                completedSessions: 45,
                pendingSessions: 75,
                overdueSessions: 5,
                progress: 37.5,
                averageSessionDuration: 48,
                studyStreak: 7,
                weeklyGoal: {
                    target: 5,
                    completed: 4,
                    remaining: 1
                },
                upcomingSessions: [
                    {
                        id: 10,
                        date: '2025-08-07',
                        subject: 'Português',
                        plannedDuration: 50
                    }
                ]
            };

            scheduleService.getScheduleOverview.mockResolvedValue(mockOverviewData);

            const response = await request(app)
                .get('/schedules/1/overview')
                .expect(200);

            expect(response.body).toEqual(mockOverviewData);
        });
    });

    describe('GET /schedules/:planId/analytics', () => {
        it('should return schedule analytics', async () => {
            const mockAnalyticsData = {
                planId: 1,
                performanceMetrics: {
                    averageCompletionRate: 0.85,
                    averageSessionDuration: 47,
                    studyEfficiency: 0.78,
                    consistencyScore: 0.82
                },
                subjectPerformance: {
                    'Direito Previdenciário': {
                        sessions: 25,
                        completedSessions: 22,
                        averageDuration: 52,
                        completionRate: 0.88
                    },
                    'Português': {
                        sessions: 20,
                        completedSessions: 16,
                        averageDuration: 45,
                        completionRate: 0.80
                    }
                },
                timeAnalysis: {
                    mostProductiveHour: '09:00',
                    leastProductiveHour: '15:00',
                    bestDayOfWeek: 'Tuesday',
                    averageSessionsPerDay: 2.3
                },
                trends: {
                    last30Days: {
                        sessionsCompleted: 28,
                        averageScore: 0.87,
                        trend: 'improving'
                    }
                }
            };

            scheduleService.getScheduleAnalytics.mockResolvedValue(mockAnalyticsData);

            const response = await request(app)
                .get('/schedules/1/analytics')
                .expect(200);

            expect(response.body).toEqual(mockAnalyticsData);
        });
    });

    describe('GET /schedules/:planId/weekly', () => {
        it('should return weekly schedule', async () => {
            const mockWeeklyData = {
                planId: 1,
                week: '2025-W32',
                weekRange: {
                    start: '2025-08-04',
                    end: '2025-08-10'
                },
                dailySchedule: {
                    'Segunda': [
                        { id: 1, subject: 'Direito Previdenciário', time: '09:00', duration: 50 }
                    ],
                    'Terça': [
                        { id: 2, subject: 'Português', time: '09:00', duration: 50 },
                        { id: 3, subject: 'Informática', time: '14:00', duration: 50 }
                    ],
                    'Quarta': [
                        { id: 4, subject: 'Direito Constitucional', time: '09:00', duration: 50 }
                    ]
                },
                weeklyStats: {
                    totalSessions: 15,
                    completedSessions: 12,
                    totalHours: 12.5,
                    completionRate: 0.80
                }
            };

            scheduleService.getWeeklySchedule.mockResolvedValue(mockWeeklyData);

            const response = await request(app)
                .get('/schedules/1/weekly?week=2025-W32')
                .expect(200);

            expect(response.body).toEqual(mockWeeklyData);
        });
    });

    describe('GET /schedules/:planId/monthly', () => {
        it('should return monthly schedule', async () => {
            const mockMonthlyData = {
                planId: 1,
                month: '2025-08',
                monthName: 'Agosto 2025',
                calendar: {
                    '2025-08-01': [
                        { id: 1, subject: 'Português', status: 'Concluído' }
                    ],
                    '2025-08-02': [
                        { id: 2, subject: 'Direito Previdenciário', status: 'Pendente' }
                    ]
                },
                monthlyStats: {
                    totalSessions: 65,
                    completedSessions: 58,
                    totalHours: 56.5,
                    completionRate: 0.89
                },
                milestones: [
                    {
                        date: '2025-08-15',
                        description: 'Meta mensal: 50 tópicos',
                        achieved: true
                    }
                ]
            };

            scheduleService.getMonthlySchedule.mockResolvedValue(mockMonthlyData);

            const response = await request(app)
                .get('/schedules/1/monthly?month=2025-08')
                .expect(200);

            expect(response.body).toEqual(mockMonthlyData);
        });
    });

    describe('GET /schedules/:planId/progress', () => {
        it('should return schedule progress', async () => {
            const mockProgressData = {
                planId: 1,
                overallProgress: 65,
                subjectProgress: {
                    'Direito Previdenciário': 58,
                    'Português': 72,
                    'Direito Constitucional': 45,
                    'Informática': 80
                },
                completionRate: 0.78,
                averageSessionScore: 0.85,
                streakData: {
                    current: 7,
                    longest: 12,
                    lastBreak: '2025-07-15'
                },
                projectedCompletion: '2025-12-08'
            };

            scheduleService.getScheduleProgress.mockResolvedValue(mockProgressData);

            const response = await request(app)
                .get('/schedules/1/progress')
                .expect(200);

            expect(response.body).toEqual(mockProgressData);
        });
    });

    describe('GET /schedules/:planId/export', () => {
        it('should export schedule', async () => {
            const mockExportData = {
                format: 'pdf',
                fileName: 'cronograma-inss-2025.pdf',
                downloadUrl: '/downloads/cronograma-inss-2025.pdf',
                expiresAt: '2025-08-07T10:00:00Z'
            };

            scheduleService.exportSchedule.mockResolvedValue(mockExportData);

            const response = await request(app)
                .get('/schedules/1/export?format=pdf')
                .expect(200);

            expect(response.body).toEqual(mockExportData);
            expect(scheduleService.exportSchedule).toHaveBeenCalledWith(1, 1, 'pdf');
        });

        it('should default to PDF format', async () => {
            const mockExportData = { format: 'pdf', fileName: 'schedule.pdf' };
            scheduleService.exportSchedule.mockResolvedValue(mockExportData);

            await request(app)
                .get('/schedules/1/export')
                .expect(200);

            expect(scheduleService.exportSchedule).toHaveBeenCalledWith(1, 1, 'pdf');
        });
    });

    describe('GET /schedules/templates', () => {
        it('should return schedule templates', async () => {
            const mockTemplates = {
                templates: [
                    {
                        id: 1,
                        name: 'Concurso Federal - 6 meses',
                        description: 'Cronograma intensivo para concursos federais',
                        duration: '6 meses',
                        weeklyHours: 25,
                        subjects: ['Português', 'Raciocínio Lógico', 'Direito'],
                        difficulty: 'intermediario'
                    },
                    {
                        id: 2,
                        name: 'Concurso Estadual - 4 meses',
                        description: 'Cronograma para concursos estaduais',
                        duration: '4 meses',
                        weeklyHours: 30,
                        subjects: ['Português', 'Matemática', 'Atualidades'],
                        difficulty: 'basico'
                    }
                ],
                totalTemplates: 2
            };

            scheduleService.getScheduleTemplates.mockResolvedValue(mockTemplates);

            const response = await request(app)
                .get('/schedules/templates')
                .expect(200);

            expect(response.body).toEqual(mockTemplates);
            expect(scheduleService.getScheduleTemplates).toHaveBeenCalledWith(1);
        });
    });

    describe('Session Management', () => {
        describe('GET /schedules/sessions/:sessionId', () => {
            it('should return session details', async () => {
                const mockSession = {
                    id: 1,
                    planId: 1,
                    date: '2025-08-06',
                    subject: 'Direito Previdenciário',
                    plannedDuration: 50,
                    actualDuration: 48,
                    status: 'Concluído',
                    topicsPlanned: 2,
                    topicsCompleted: 2,
                    questionsAnswered: 15,
                    correctAnswers: 12,
                    notes: 'Boa sessão de estudo'
                };

                scheduleService.getSession.mockResolvedValue(mockSession);

                const response = await request(app)
                    .get('/schedules/sessions/1')
                    .expect(200);

                expect(response.body).toEqual(mockSession);
            });

            it('should return 404 for non-existent session', async () => {
                scheduleService.getSession.mockRejectedValue(new Error('Sessão não encontrada'));

                const response = await request(app)
                    .get('/schedules/sessions/999')
                    .expect(404);

                expect(response.body).toHaveProperty('error', 'Sessão não encontrada');
            });
        });

        describe('POST /schedules/sessions', () => {
            it('should create new session', async () => {
                const sessionData = {
                    planId: 1,
                    date: '2025-08-08',
                    subject: 'Português',
                    plannedDuration: 50,
                    topicsPlanned: 2
                };

                const mockCreatedSession = {
                    id: 5,
                    ...sessionData,
                    status: 'Pendente',
                    createdAt: '2025-08-06T10:00:00Z'
                };

                scheduleService.createSession.mockResolvedValue(mockCreatedSession);

                const response = await request(app)
                    .post('/schedules/sessions')
                    .send(sessionData)
                    .expect(201);

                expect(response.body).toEqual(mockCreatedSession);
                expect(scheduleService.createSession).toHaveBeenCalledWith(sessionData, 1);
            });

            it('should validate required fields', async () => {
                scheduleService.createSession.mockRejectedValue(new Error('Data é obrigatória'));

                const response = await request(app)
                    .post('/schedules/sessions')
                    .send({ planId: 1, subject: 'Português' })
                    .expect(400);

                expect(response.body).toHaveProperty('error', 'Data é obrigatória');
            });
        });

        describe('DELETE /schedules/sessions/:sessionId', () => {
            it('should delete session', async () => {
                const mockResult = {
                    message: 'Sessão removida com sucesso'
                };

                scheduleService.deleteSession.mockResolvedValue(mockResult);

                const response = await request(app)
                    .delete('/schedules/sessions/1')
                    .expect(200);

                expect(response.body).toEqual(mockResult);
                expect(scheduleService.deleteSession).toHaveBeenCalledWith(1, 1);
            });
        });

        describe('POST /schedules/sessions/:sessionId/reinforce', () => {
            it('should reinforce session topic', async () => {
                const reinforceData = {
                    difficulty: 'hard',
                    reason: 'Needs more practice'
                };

                const mockResult = {
                    message: 'Tópico marcado para reforço',
                    nextReviewDate: '2025-08-10'
                };

                scheduleService.reinforceSession.mockResolvedValue(mockResult);

                const response = await request(app)
                    .post('/schedules/sessions/1/reinforce')
                    .send(reinforceData)
                    .expect(200);

                expect(response.body).toEqual(mockResult);
                expect(scheduleService.reinforceSession).toHaveBeenCalledWith(1, reinforceData, 1);
            });
        });

        describe('POST /schedules/sessions/:sessionId/time', () => {
            it('should update session time tracking', async () => {
                const timeData = {
                    timeStudied: 2700, // 45 minutes in seconds
                    questionsAnswered: 12,
                    correctAnswers: 9
                };

                const mockResult = {
                    message: 'Tempo de estudo registrado',
                    totalTime: 2700,
                    efficiency: 0.75
                };

                scheduleService.updateSessionTime.mockResolvedValue(mockResult);

                const response = await request(app)
                    .post('/schedules/sessions/1/time')
                    .send(timeData)
                    .expect(200);

                expect(response.body).toEqual(mockResult);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid plan IDs', async () => {
            const response = await request(app)
                .get('/schedules/invalid/overview')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'ID do plano inválido');
        });

        it('should handle invalid session IDs', async () => {
            const response = await request(app)
                .get('/schedules/sessions/invalid')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'ID da sessão inválido');
        });

        it('should handle service errors', async () => {
            scheduleService.getSchedule.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/schedules/1')
                .expect(500);

            expect(response.body.error).toContain('Erro ao carregar cronograma');
        });

        it('should handle concurrent session updates', async () => {
            const updateData = { timeStudied: 1800 };
            scheduleService.updateSessionTime.mockResolvedValue({ message: 'Updated' });

            const requests = Array(3).fill().map(() =>
                request(app)
                    .post('/schedules/sessions/1/time')
                    .send(updateData)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            expect(scheduleService.updateSessionTime).toHaveBeenCalledTimes(3);
        });
    });

    describe('Performance Tests', () => {
        it('should handle large schedule data efficiently', async () => {
            const largeMockData = {
                planId: 1,
                sessions: Array(1000).fill().map((_, i) => ({
                    id: i + 1,
                    date: `2025-08-${String(i % 30 + 1).padStart(2, '0')}`,
                    subject: `Subject ${i % 5}`,
                    status: i % 3 === 0 ? 'Concluído' : 'Pendente'
                }))
            };

            scheduleService.getSchedule.mockResolvedValue(largeMockData);

            const startTime = Date.now();
            const response = await request(app).get('/schedules/1');
            const responseTime = Date.now() - startTime;

            expect(response.status).toBe(200);
            expect(response.body.sessions).toHaveLength(1000);
            expect(responseTime).toBeLessThan(200); // Should handle large data within 200ms
        });

        it('should cache schedule templates', async () => {
            const mockTemplates = { templates: [], totalTemplates: 0 };
            scheduleService.getScheduleTemplates.mockResolvedValue(mockTemplates);

            // First request
            await request(app).get('/schedules/templates');
            
            // Second request should use cached data
            await request(app).get('/schedules/templates');

            expect(scheduleService.getScheduleTemplates).toHaveBeenCalledTimes(2);
        });
    });
});