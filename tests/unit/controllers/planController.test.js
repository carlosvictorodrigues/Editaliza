/**
 * Plan Controller Unit Tests
 * Testing Fortress - Comprehensive controller testing
 */

const request = require('supertest');
const express = require('express');
const planController = require('../../../src/controllers/planController');
const planService = require('../../../src/services/planService');

// Mock the plan service
jest.mock('../../../src/services/planService');

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
    
    // Mount plan controller routes
    app.get('/plans/:planId/schedule_preview', planController.getSchedulePreview);
    app.get('/plans/:planId/progress', planController.getPlanProgress);
    app.get('/plans/:planId/detailed_progress', planController.getDetailedProgress);
    app.get('/plans/:planId/goal_progress', planController.getGoalProgress);
    app.get('/plans/:planId/realitycheck', planController.getRealityCheck);
    app.get('/plans/:planId/gamification', planController.getGamification);
    app.get('/plans/:planId/question_radar', planController.getQuestionRadar);
    app.get('/plans/:planId/overdue_check', planController.getOverdueCheck);
    app.get('/plans/:planId/activity_summary', planController.getActivitySummary);
    app.get('/plans/:planId/subjects', planController.getPlanSubjects);
    
    return app;
};

describe('Plan Controller Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    describe('GET /plans/:planId/schedule_preview', () => {
        it('should return schedule preview for valid plan', async () => {
            const mockPreviewData = {
                planId: 1,
                planName: 'Concurso INSS',
                examDate: '2025-12-15',
                daysUntilExam: 132,
                totalTopics: 150,
                studyDaysAvailable: 120,
                averageTopicsPerDay: 1.25,
                weeklySchedule: {
                    'Segunda': ['Direito Previdenciário', 'Português'],
                    'Terça': ['Direito Constitucional', 'Informática'],
                    'Quarta': ['Direito Previdenciário', 'Português'],
                    'Quinta': ['Direito Constitucional', 'Raciocínio Lógico'],
                    'Sexta': ['Direito Previdenciário', 'Informática'],
                    'Sábado': ['Revisão Geral'],
                    'Domingo': ['Descanso']
                },
                estimatedProgress: {
                    month1: 25,
                    month2: 55,
                    month3: 80,
                    month4: 100
                }
            };

            planService.getSchedulePreview.mockResolvedValue(mockPreviewData);

            const response = await request(app)
                .get('/plans/1/schedule_preview')
                .expect(200);

            expect(response.body).toEqual(mockPreviewData);
            expect(planService.getSchedulePreview).toHaveBeenCalledWith(1, 1);
        });

        it('should return 404 for non-existent plan', async () => {
            planService.getSchedulePreview.mockRejectedValue(new Error('Plano não encontrado'));

            const response = await request(app)
                .get('/plans/999/schedule_preview')
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Plano não encontrado');
        });

        it('should return 400 for invalid plan ID', async () => {
            const response = await request(app)
                .get('/plans/invalid/schedule_preview')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'ID do plano inválido');
        });
    });

    describe('GET /plans/:planId/progress', () => {
        it('should return plan progress data', async () => {
            const mockProgressData = {
                planId: 1,
                overallProgress: 65,
                topicsCompleted: 98,
                totalTopics: 150,
                hoursStudied: 127,
                targetHours: 200,
                streak: 5,
                averageDaily: 2.3,
                weeklyGoal: 15,
                monthlyGoal: 60
            };

            planService.getPlanProgress.mockResolvedValue(mockProgressData);

            const response = await request(app)
                .get('/plans/1/progress')
                .expect(200);

            expect(response.body).toEqual(mockProgressData);
            expect(planService.getPlanProgress).toHaveBeenCalledWith(1, 1);
        });

        it('should handle service errors gracefully', async () => {
            planService.getPlanProgress.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/plans/1/progress')
                .expect(500);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Erro ao carregar progresso');
        });
    });

    describe('GET /plans/:planId/detailed_progress', () => {
        it('should return detailed progress breakdown', async () => {
            const mockDetailedProgress = {
                planId: 1,
                subjectProgress: {
                    'Direito Previdenciário': {
                        completed: 23,
                        total: 45,
                        percentage: 51,
                        hoursStudied: 34
                    },
                    'Direito Constitucional': {
                        completed: 18,
                        total: 32,
                        percentage: 56,
                        hoursStudied: 28
                    },
                    'Português': {
                        completed: 15,
                        total: 25,
                        percentage: 60,
                        hoursStudied: 22
                    },
                    'Informática': {
                        completed: 12,
                        total: 20,
                        percentage: 60,
                        hoursStudied: 18
                    }
                },
                weeklyBreakdown: [
                    { week: '2025-W01', completed: 8, planned: 10, efficiency: 80 },
                    { week: '2025-W02', completed: 12, planned: 10, efficiency: 120 },
                    { week: '2025-W03', completed: 9, planned: 10, efficiency: 90 }
                ],
                performanceMetrics: {
                    averageSessionDuration: 45,
                    completionRate: 0.85,
                    consistencyScore: 0.78
                }
            };

            planService.getDetailedProgress.mockResolvedValue(mockDetailedProgress);

            const response = await request(app)
                .get('/plans/1/detailed_progress')
                .expect(200);

            expect(response.body).toEqual(mockDetailedProgress);
        });
    });

    describe('GET /plans/:planId/goal_progress', () => {
        it('should return goal progress tracking', async () => {
            const mockGoalProgress = {
                planId: 1,
                dailyGoal: {
                    target: 3,
                    completed: 2,
                    percentage: 67,
                    streak: 5
                },
                weeklyGoal: {
                    target: 21,
                    completed: 18,
                    percentage: 86,
                    remaining: 3
                },
                monthlyGoal: {
                    target: 90,
                    completed: 65,
                    percentage: 72,
                    onTrack: true
                },
                examGoal: {
                    targetDate: '2025-12-15',
                    daysRemaining: 132,
                    projectedCompletion: '2025-12-10',
                    status: 'on-track'
                }
            };

            planService.getGoalProgress.mockResolvedValue(mockGoalProgress);

            const response = await request(app)
                .get('/plans/1/goal_progress')
                .expect(200);

            expect(response.body).toEqual(mockGoalProgress);
        });
    });

    describe('GET /plans/:planId/realitycheck', () => {
        it('should return reality check analysis', async () => {
            const mockRealityCheck = {
                planId: 1,
                status: 'on-track',
                requiredPace: '2-3 tópicos por dia',
                currentPace: '2.1 tópicos por dia',
                projectedCompletion: '2025-12-10',
                confidence: 0.85,
                recommendations: [
                    'Mantenha o ritmo atual',
                    'Foque em Direito Previdenciário nos próximos 15 dias',
                    'Considere aumentar revisões aos domingos'
                ],
                risks: [
                    'Prazo apertado para revisão final',
                    'Feriados em dezembro podem afetar cronograma'
                ],
                alternatives: [
                    'Plano B: Focar apenas em tópicos de alta probabilidade',
                    'Plano C: Estender estudo por mais 2 semanas se possível'
                ]
            };

            planService.getRealityCheck.mockResolvedValue(mockRealityCheck);

            const response = await request(app)
                .get('/plans/1/realitycheck')
                .expect(200);

            expect(response.body).toEqual(mockRealityCheck);
        });
    });

    describe('GET /plans/:planId/gamification', () => {
        it('should return gamification data', async () => {
            const mockGamificationData = {
                planId: 1,
                level: 7,
                xp: 1250,
                xpToNextLevel: 250,
                totalXp: 1500,
                badges: [
                    { id: 'streak_5', name: 'Consistência', description: '5 dias consecutivos' },
                    { id: 'speed_demon', name: 'Velocista', description: 'Completou sessão em tempo recorde' },
                    { id: 'perfectionist', name: 'Perfeccionista', description: '100% de acerto em questões' }
                ],
                achievements: {
                    totalTopicsCompleted: 98,
                    longestStreak: 12,
                    totalHoursStudied: 127,
                    perfectSessions: 15
                },
                leaderboard: {
                    position: 3,
                    totalUsers: 47,
                    percentile: 93
                },
                dailyChallenge: {
                    description: 'Complete 3 tópicos hoje',
                    progress: 2,
                    target: 3,
                    reward: '50 XP'
                }
            };

            planService.getGamification.mockResolvedValue(mockGamificationData);

            const response = await request(app)
                .get('/plans/1/gamification')
                .expect(200);

            expect(response.body).toEqual(mockGamificationData);
        });
    });

    describe('GET /plans/:planId/question_radar', () => {
        it('should return question performance radar', async () => {
            const mockQuestionRadar = {
                planId: 1,
                radarData: {
                    'Direito Previdenciário': 78,
                    'Direito Constitucional': 65,
                    'Português': 85,
                    'Informática': 72,
                    'Raciocínio Lógico': 58
                },
                totalQuestions: 1247,
                correctAnswers: 896,
                overallAccuracy: 72,
                improvement: {
                    lastWeek: 68,
                    trend: 'up',
                    change: +4
                },
                recommendations: [
                    'Foque em Raciocínio Lógico (58% de acerto)',
                    'Mantenha bom desempenho em Português',
                    'Pratique mais questões de Direito Constitucional'
                ]
            };

            planService.getQuestionRadar.mockResolvedValue(mockQuestionRadar);

            const response = await request(app)
                .get('/plans/1/question_radar')
                .expect(200);

            expect(response.body).toEqual(mockQuestionRadar);
        });
    });

    describe('GET /plans/:planId/overdue_check', () => {
        it('should return overdue sessions analysis', async () => {
            const mockOverdueCheck = {
                planId: 1,
                overdueCount: 3,
                totalSessions: 45,
                overduePercentage: 7,
                overdueSessions: [
                    {
                        id: 12,
                        subject: 'Direito Previdenciário',
                        plannedDate: '2025-08-04',
                        daysOverdue: 2,
                        priority: 'high'
                    },
                    {
                        id: 15,
                        subject: 'Informática',
                        plannedDate: '2025-08-03',
                        daysOverdue: 3,
                        priority: 'medium'
                    }
                ],
                impactAnalysis: {
                    scheduleDelay: 2,
                    examRisk: 'low',
                    recommendedActions: [
                        'Priorize sessões de Direito Previdenciário',
                        'Considere redistribuir tópicos de Informática'
                    ]
                }
            };

            planService.getOverdueCheck.mockResolvedValue(mockOverdueCheck);

            const response = await request(app)
                .get('/plans/1/overdue_check')
                .expect(200);

            expect(response.body).toEqual(mockOverdueCheck);
        });
    });

    describe('GET /plans/:planId/activity_summary', () => {
        it('should return activity summary', async () => {
            const mockActivitySummary = {
                planId: 1,
                recentActivity: [
                    {
                        date: '2025-08-06',
                        sessionsCompleted: 3,
                        hoursStudied: 2.5,
                        topics: ['Benefícios', 'Custeio', 'Português']
                    },
                    {
                        date: '2025-08-05',
                        sessionsCompleted: 2,
                        hoursStudied: 1.8,
                        topics: ['Constitucional', 'Informática']
                    }
                ],
                studyPatterns: {
                    preferredTime: 'morning',
                    averageSessionLength: 45,
                    mostProductiveDay: 'Tuesday',
                    consistencyScore: 0.82
                },
                milestones: [
                    {
                        date: '2025-07-15',
                        description: 'Primeiro mês de estudo completo',
                        type: 'time_milestone'
                    },
                    {
                        date: '2025-07-28',
                        description: '50 tópicos concluídos',
                        type: 'progress_milestone'
                    }
                ]
            };

            planService.getActivitySummary.mockResolvedValue(mockActivitySummary);

            const response = await request(app)
                .get('/plans/1/activity_summary')
                .expect(200);

            expect(response.body).toEqual(mockActivitySummary);
        });
    });

    describe('GET /plans/:planId/subjects', () => {
        it('should return plan subjects', async () => {
            const mockSubjects = {
                planId: 1,
                subjects: [
                    {
                        id: 1,
                        name: 'Direito Previdenciário',
                        topicsTotal: 45,
                        topicsCompleted: 23,
                        progress: 51,
                        hoursStudied: 34,
                        priority: 'high',
                        difficulty: 'hard'
                    },
                    {
                        id: 2,
                        name: 'Direito Constitucional',
                        topicsTotal: 32,
                        topicsCompleted: 18,
                        progress: 56,
                        hoursStudied: 28,
                        priority: 'high',
                        difficulty: 'medium'
                    },
                    {
                        id: 3,
                        name: 'Português',
                        topicsTotal: 25,
                        topicsCompleted: 15,
                        progress: 60,
                        hoursStudied: 22,
                        priority: 'medium',
                        difficulty: 'easy'
                    },
                    {
                        id: 4,
                        name: 'Informática',
                        topicsTotal: 20,
                        topicsCompleted: 12,
                        progress: 60,
                        hoursStudied: 18,
                        priority: 'medium',
                        difficulty: 'medium'
                    }
                ],
                totalSubjects: 4,
                averageProgress: 57
            };

            planService.getPlanSubjects.mockResolvedValue(mockSubjects);

            const response = await request(app)
                .get('/plans/1/subjects')
                .expect(200);

            expect(response.body).toEqual(mockSubjects);
        });
    });

    describe('Error Handling', () => {
        it('should handle authentication errors', async () => {
            const app = express();
            app.use(express.json());
            // No auth middleware
            app.get('/plans/:planId/progress', planController.getPlanProgress);

            const response = await request(app)
                .get('/plans/1/progress')
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle service unavailable errors', async () => {
            planService.getPlanProgress.mockRejectedValue(new Error('Service temporarily unavailable'));

            const response = await request(app)
                .get('/plans/1/progress')
                .expect(500);

            expect(response.body.error).toContain('Erro ao carregar progresso');
        });

        it('should validate plan ownership', async () => {
            planService.getPlanProgress.mockRejectedValue(new Error('Plano não pertence ao usuário'));

            const response = await request(app)
                .get('/plans/1/progress')
                .expect(403);

            expect(response.body).toHaveProperty('error', 'Plano não pertence ao usuário');
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent requests', async () => {
            const mockData = { planId: 1, progress: 50 };
            planService.getPlanProgress.mockResolvedValue(mockData);

            const requests = Array(10).fill().map(() => 
                request(app).get('/plans/1/progress')
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toEqual(mockData);
            });

            expect(planService.getPlanProgress).toHaveBeenCalledTimes(10);
        });

        it('should have reasonable response times', async () => {
            const mockData = { planId: 1, progress: 50 };
            planService.getPlanProgress.mockResolvedValue(mockData);

            const startTime = Date.now();
            const response = await request(app).get('/plans/1/progress');
            const responseTime = Date.now() - startTime;

            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(100); // Should respond within 100ms
        });
    });
});