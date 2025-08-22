/**
 * @file tests/unit/metrics/metrics-system.test.js
 * @description Testes unitários para o Sistema de Métricas
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const FortressConfig = require('../../fortress/fortress-config');

// Mock do sistema de métricas baseado no app.js
const MetricsSystem = {
    _cache: new Map(),
    _gamificationCache: {},
    _gamificationDebounce: {},
    
    // Função de progresso diário
    getDailyProgress: async function(planId, date) {
        const cacheKey = `daily_progress_${planId}_${date}`;
        
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }
        
        const totalSessions = Math.floor(Math.random() * 5) + 5; // 5-9 sessions
        const completedSessions = Math.floor(Math.random() * totalSessions) + 1; // 1 to total
        
        const progress = {
            date: date,
            planId: planId,
            totalSessions: totalSessions,
            completedSessions: completedSessions,
            totalStudyTime: Math.floor(Math.random() * 300) + 60, // minutos
            completedTopics: Math.floor(Math.random() * 3) + 1,
            percentage: 0
        };
        
        progress.percentage = Math.min(100, Math.round((progress.completedSessions / progress.totalSessions) * 100));
        
        this._cache.set(cacheKey, progress);
        return progress;
    },
    
    // Função de progresso semanal
    getWeeklyProgress: async function(planId, weekStart) {
        const cacheKey = `weekly_progress_${planId}_${weekStart}`;
        
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }
        
        const progress = {
            weekStart: weekStart,
            planId: planId,
            days: [],
            totalWeeklyHours: 0,
            weeklyGoalHours: 20,
            studyDaysCount: 0,
            averageSessionDuration: 0
        };
        
        // Simular dados de 7 dias
        for (let i = 0; i < 7; i++) {
            const dayProgress = await this.getDailyProgress(planId, `${weekStart}_day_${i}`);
            progress.days.push(dayProgress);
            progress.totalWeeklyHours += dayProgress.totalStudyTime / 60;
            if (dayProgress.completedSessions > 0) {
                progress.studyDaysCount++;
            }
        }
        
        progress.weeklyPercentage = Math.round((progress.totalWeeklyHours / progress.weeklyGoalHours) * 100);
        progress.averageSessionDuration = progress.totalWeeklyHours > 0 ? 
            Math.round((progress.totalWeeklyHours * 60) / progress.days.reduce((sum, day) => sum + day.completedSessions, 0)) : 0;
        
        this._cache.set(cacheKey, progress);
        return progress;
    },
    
    // Sistema de gamificação
    getGamificationData: async function(planId, forceRefresh = false) {
        if (forceRefresh || !this._gamificationCache[planId]) {
            console.log('📊 Carregando dados de gamificação...', forceRefresh ? '(forçado)' : '');
            
            const gamificationData = {
                planId: planId,
                experiencePoints: Math.floor(Math.random() * 1000) + 100,
                studyStreak: Math.floor(Math.random() * 30) + 1,
                totalStudyDays: Math.floor(Math.random() * 100) + 10,
                concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
                nextLevel: 'Pagador(a) de Inscrição 💸',
                completedTopicsCount: Math.floor(Math.random() * 50) + 5,
                totalCompletedSessions: Math.floor(Math.random() * 200) + 20,
                topicsToNextLevel: 11 - (Math.floor(Math.random() * 10) + 1),
                achievements: [
                    { id: 'first_session', name: 'Primeira Sessão', earned: true },
                    { id: 'streak_7', name: 'Sequência de 7 dias', earned: false },
                    { id: 'topics_10', name: '10 Tópicos Concluídos', earned: true }
                ],
                lastUpdated: new Date().toISOString()
            };
            
            this._gamificationCache[planId] = gamificationData;
        }
        
        return this._gamificationCache[planId];
    },
    
    // Invalidar cache
    invalidatePlanCache: function(planId, type = 'all') {
        if (type === 'all' || type === 'progress') {
            const keysToDelete = [];
            for (const key of this._cache.keys()) {
                if (key.includes(`_${planId}_`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this._cache.delete(key));
        }
        
        if (type === 'all' || type === 'gamification') {
            delete this._gamificationCache[planId];
        }
        
        console.log(`🔄 Cache invalidado para plano ${planId} (tipo: ${type})`);
    },
    
    // Trigger para atualização de métricas
    triggerMetricsUpdate: function(planId, eventType) {
        console.log(`📊 Trigger métricas - Plano: ${planId}, Evento: ${eventType}`);
        
        // Invalidar caches relacionados
        this.invalidatePlanCache(planId, 'progress');
        
        // Se for uma sessão completada, invalidar gamificação também
        if (eventType === 'session_completed_with_time') {
            this.invalidatePlanCache(planId, 'gamification');
        }
    },
    
    // Validação de dados
    validateMetricsData: function(data, type) {
        const validations = {
            daily_progress: ['date', 'planId', 'totalSessions', 'completedSessions', 'percentage'],
            weekly_progress: ['weekStart', 'planId', 'days', 'totalWeeklyHours', 'weeklyPercentage'],
            gamification: ['planId', 'experiencePoints', 'studyStreak', 'concurseiroLevel', 'achievements']
        };
        
        const requiredFields = validations[type];
        if (!requiredFields) {
            return { valid: false, error: 'Tipo de dados não reconhecido' };
        }
        
        for (const field of requiredFields) {
            if (!(field in data)) {
                return { valid: false, error: `Campo obrigatório ausente: ${field}` };
            }
        }
        
        // Validações específicas
        if (type === 'daily_progress') {
            if (data.percentage < 0 || data.percentage > 100) {
                return { valid: false, error: 'Percentual inválido' };
            }
            if (data.completedSessions > data.totalSessions) {
                return { valid: false, error: 'Sessões completadas não podem exceder total' };
            }
        }
        
        if (type === 'gamification') {
            if (data.experiencePoints < 0) {
                return { valid: false, error: 'Pontos de experiência não podem ser negativos' };
            }
            if (!Array.isArray(data.achievements)) {
                return { valid: false, error: 'Achievements deve ser um array' };
            }
        }
        
        return { valid: true };
    },
    
    // Calcular métricas derivadas
    calculateDerivedMetrics: function(baseMetrics) {
        return {
            studyEfficiency: this.calculateStudyEfficiency(baseMetrics),
            progressVelocity: this.calculateProgressVelocity(baseMetrics),
            consistencyScore: this.calculateConsistencyScore(baseMetrics),
            performanceRating: this.calculatePerformanceRating(baseMetrics)
        };
    },
    
    calculateStudyEfficiency: function(metrics) {
        if (!metrics.totalStudyTime || metrics.totalStudyTime === 0) return 0;
        return Math.round((metrics.completedTopics / (metrics.totalStudyTime / 60)) * 100) / 100;
    },
    
    calculateProgressVelocity: function(metrics) {
        if (!metrics.completedTopicsCount || !metrics.totalStudyDays) return 0;
        const daysStudying = metrics.totalStudyDays || 1;
        return Math.round((metrics.completedTopicsCount / daysStudying) * 100) / 100;
    },
    
    calculateConsistencyScore: function(metrics) {
        const expectedStreak = Math.min(metrics.totalStudyDays, 30);
        return Math.round((metrics.studyStreak / expectedStreak) * 100);
    },
    
    calculatePerformanceRating: function(metrics) {
        const weights = {
            efficiency: 0.3,
            velocity: 0.25,
            consistency: 0.25,
            completion: 0.2
        };
        
        const efficiency = Math.min(metrics.studyEfficiency || 0, 5) * 20; // Normalizar para 0-100
        const velocity = Math.min(metrics.progressVelocity || 0, 2) * 50; // Normalizar para 0-100
        const consistency = metrics.consistencyScore || 0;
        const completion = Math.min((metrics.completedTopicsCount / 50) * 100, 100); // Assumir 50 tópicos como máximo
        
        return Math.round(
            efficiency * weights.efficiency +
            velocity * weights.velocity +
            consistency * weights.consistency +
            completion * weights.completion
        );
    },
    
    // Limpar cache
    clearCache: function() {
        this._cache.clear();
        this._gamificationCache = {};
        this._gamificationDebounce = {};
    }
};

describe('Sistema de Métricas - Testes Unitários', () => {
    beforeEach(() => {
        MetricsSystem.clearCache();
        jest.clearAllMocks();
    });

    describe('Cálculo de Progresso Diário', () => {
        test('deve calcular progresso diário corretamente', async () => {
            const planId = 1;
            const date = '2025-01-15';
            
            const progress = await MetricsSystem.getDailyProgress(planId, date);
            
            expect(progress).toHaveProperty('date', date);
            expect(progress).toHaveProperty('planId', planId);
            expect(progress).toHaveProperty('totalSessions');
            expect(progress).toHaveProperty('completedSessions');
            expect(progress).toHaveProperty('totalStudyTime');
            expect(progress).toHaveProperty('completedTopics');
            expect(progress).toHaveProperty('percentage');
            
            // Validar tipos
            expect(typeof progress.totalSessions).toBe('number');
            expect(typeof progress.completedSessions).toBe('number');
            expect(typeof progress.totalStudyTime).toBe('number');
            expect(typeof progress.percentage).toBe('number');
            
            // Validar limites
            expect(progress.percentage).toBeGreaterThanOrEqual(0);
            expect(progress.percentage).toBeLessThanOrEqual(100);
            expect(progress.completedSessions).toBeLessThanOrEqual(progress.totalSessions);
        });

        test('deve usar cache para dados já calculados', async () => {
            const planId = 1;
            const date = '2025-01-15';
            
            const progress1 = await MetricsSystem.getDailyProgress(planId, date);
            const progress2 = await MetricsSystem.getDailyProgress(planId, date);
            
            expect(progress1).toEqual(progress2);
        });

        test('deve calcular percentual corretamente', async () => {
            const planId = 1;
            const date = '2025-01-15';
            
            const progress = await MetricsSystem.getDailyProgress(planId, date);
            const expectedPercentage = Math.round((progress.completedSessions / progress.totalSessions) * 100);
            
            expect(progress.percentage).toBe(expectedPercentage);
        });
    });

    describe('Cálculo de Progresso Semanal', () => {
        test('deve calcular progresso semanal corretamente', async () => {
            const planId = 1;
            const weekStart = '2025-01-13';
            
            const progress = await MetricsSystem.getWeeklyProgress(planId, weekStart);
            
            expect(progress).toHaveProperty('weekStart', weekStart);
            expect(progress).toHaveProperty('planId', planId);
            expect(progress).toHaveProperty('days');
            expect(progress).toHaveProperty('totalWeeklyHours');
            expect(progress).toHaveProperty('weeklyGoalHours');
            expect(progress).toHaveProperty('studyDaysCount');
            expect(progress).toHaveProperty('weeklyPercentage');
            expect(progress).toHaveProperty('averageSessionDuration');
            
            // Validar array de dias
            expect(Array.isArray(progress.days)).toBe(true);
            expect(progress.days).toHaveLength(7);
            
            // Validar tipos
            expect(typeof progress.totalWeeklyHours).toBe('number');
            expect(typeof progress.studyDaysCount).toBe('number');
            expect(typeof progress.weeklyPercentage).toBe('number');
            expect(typeof progress.averageSessionDuration).toBe('number');
        });

        test('deve calcular percentual semanal corretamente', async () => {
            const planId = 1;
            const weekStart = '2025-01-13';
            
            const progress = await MetricsSystem.getWeeklyProgress(planId, weekStart);
            const expectedPercentage = Math.round((progress.totalWeeklyHours / progress.weeklyGoalHours) * 100);
            
            expect(progress.weeklyPercentage).toBe(expectedPercentage);
        });

        test('deve contar dias de estudo corretamente', async () => {
            const planId = 1;
            const weekStart = '2025-01-13';
            
            const progress = await MetricsSystem.getWeeklyProgress(planId, weekStart);
            const daysWithSessions = progress.days.filter(day => day.completedSessions > 0).length;
            
            expect(progress.studyDaysCount).toBe(daysWithSessions);
        });
    });

    describe('Sistema de Gamificação', () => {
        test('deve carregar dados de gamificação corretamente', async () => {
            const planId = 1;
            
            const gamification = await MetricsSystem.getGamificationData(planId);
            
            expect(gamification).toHaveProperty('planId', planId);
            expect(gamification).toHaveProperty('experiencePoints');
            expect(gamification).toHaveProperty('studyStreak');
            expect(gamification).toHaveProperty('totalStudyDays');
            expect(gamification).toHaveProperty('concurseiroLevel');
            expect(gamification).toHaveProperty('nextLevel');
            expect(gamification).toHaveProperty('completedTopicsCount');
            expect(gamification).toHaveProperty('totalCompletedSessions');
            expect(gamification).toHaveProperty('topicsToNextLevel');
            expect(gamification).toHaveProperty('achievements');
            expect(gamification).toHaveProperty('lastUpdated');
            
            // Validar tipos
            expect(typeof gamification.experiencePoints).toBe('number');
            expect(typeof gamification.studyStreak).toBe('number');
            expect(typeof gamification.totalStudyDays).toBe('number');
            expect(typeof gamification.concurseiroLevel).toBe('string');
            expect(Array.isArray(gamification.achievements)).toBe(true);
            
            // Validar valores positivos
            expect(gamification.experiencePoints).toBeGreaterThanOrEqual(0);
            expect(gamification.studyStreak).toBeGreaterThanOrEqual(0);
            expect(gamification.totalStudyDays).toBeGreaterThanOrEqual(0);
        });

        test('deve usar cache para dados de gamificação', async () => {
            const planId = 1;
            
            const gamification1 = await MetricsSystem.getGamificationData(planId);
            const gamification2 = await MetricsSystem.getGamificationData(planId);
            
            expect(gamification1).toEqual(gamification2);
        });

        test('deve forçar atualização quando solicitado', async () => {
            const planId = 1;
            
            // Primeira chamada (cacheia)
            await MetricsSystem.getGamificationData(planId);
            
            // Segunda chamada com forceRefresh
            const gamification = await MetricsSystem.getGamificationData(planId, true);
            
            expect(gamification).toBeDefined();
            expect(gamification.planId).toBe(planId);
        });

        test('deve ter estrutura correta de achievements', async () => {
            const planId = 1;
            
            const gamification = await MetricsSystem.getGamificationData(planId);
            
            expect(Array.isArray(gamification.achievements)).toBe(true);
            
            gamification.achievements.forEach(achievement => {
                expect(achievement).toHaveProperty('id');
                expect(achievement).toHaveProperty('name');
                expect(achievement).toHaveProperty('earned');
                expect(typeof achievement.earned).toBe('boolean');
            });
        });
    });

    describe('Sincronização de Cache', () => {
        test('deve invalidar cache de progresso', () => {
            const planId = 1;
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            
            MetricsSystem.invalidatePlanCache(planId, 'progress');
            
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cache invalidado para plano 1 (tipo: progress)')
            );
            
            consoleLogSpy.mockRestore();
        });

        test('deve invalidar cache de gamificação', () => {
            const planId = 1;
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Primeiro carregar dados
            MetricsSystem._gamificationCache[planId] = { test: 'data' };
            
            MetricsSystem.invalidatePlanCache(planId, 'gamification');
            
            expect(MetricsSystem._gamificationCache[planId]).toBeUndefined();
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cache invalidado para plano 1 (tipo: gamification)')
            );
            
            consoleLogSpy.mockRestore();
        });

        test('deve invalidar todo o cache quando tipo é "all"', () => {
            const planId = 1;
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Adicionar dados aos caches
            MetricsSystem._cache.set(`daily_progress_${planId}_test`, { test: 'data' });
            MetricsSystem._gamificationCache[planId] = { test: 'data' };
            
            MetricsSystem.invalidatePlanCache(planId, 'all');
            
            expect(MetricsSystem._gamificationCache[planId]).toBeUndefined();
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Cache invalidado para plano 1 (tipo: all)')
            );
            
            consoleLogSpy.mockRestore();
        });

        test('deve disparar trigger de atualização de métricas', () => {
            const planId = 1;
            const eventType = 'session_completed_with_time';
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            
            MetricsSystem.triggerMetricsUpdate(planId, eventType);
            
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining(`Trigger métricas - Plano: ${planId}, Evento: ${eventType}`)
            );
            
            consoleLogSpy.mockRestore();
        });
    });

    describe('Validação de Dados', () => {
        test('deve validar dados de progresso diário', () => {
            const validData = {
                date: '2025-01-15',
                planId: 1,
                totalSessions: 5,
                completedSessions: 3,
                percentage: 60,
                totalStudyTime: 120,
                completedTopics: 2
            };
            
            const result = MetricsSystem.validateMetricsData(validData, 'daily_progress');
            expect(result.valid).toBe(true);
        });

        test('deve rejeitar dados inválidos de progresso diário', () => {
            const invalidData = {
                date: '2025-01-15',
                planId: 1,
                totalSessions: 5,
                completedSessions: 7, // Mais que o total - inválido
                percentage: 150, // Percentual inválido
                totalStudyTime: 120,
                completedTopics: 2
            };
            
            const result = MetricsSystem.validateMetricsData(invalidData, 'daily_progress');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('deve validar dados de gamificação', () => {
            const validData = {
                planId: 1,
                experiencePoints: 500,
                studyStreak: 15,
                concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
                achievements: [
                    { id: 'first_session', name: 'Primeira Sessão', earned: true }
                ]
            };
            
            const result = MetricsSystem.validateMetricsData(validData, 'gamification');
            expect(result.valid).toBe(true);
        });

        test('deve rejeitar dados inválidos de gamificação', () => {
            const invalidData = {
                planId: 1,
                experiencePoints: -100, // Pontos negativos - inválido
                studyStreak: 15,
                concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
                achievements: 'not-an-array' // Deve ser array - inválido
            };
            
            const result = MetricsSystem.validateMetricsData(invalidData, 'gamification');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('deve rejeitar tipo de dados não reconhecido', () => {
            const data = { test: 'data' };
            
            const result = MetricsSystem.validateMetricsData(data, 'unknown_type');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Tipo de dados não reconhecido');
        });
    });

    describe('Métricas Derivadas', () => {
        test('deve calcular eficiência de estudo', () => {
            const metrics = {
                completedTopics: 10,
                totalStudyTime: 300 // 5 horas
            };
            
            const efficiency = MetricsSystem.calculateStudyEfficiency(metrics);
            expect(efficiency).toBe(2); // 10 tópicos / 5 horas = 2 tópicos por hora
        });

        test('deve calcular velocidade de progresso', () => {
            const metrics = {
                completedTopicsCount: 30,
                totalStudyDays: 15
            };
            
            const velocity = MetricsSystem.calculateProgressVelocity(metrics);
            expect(velocity).toBe(2); // 30 tópicos / 15 dias = 2 tópicos por dia
        });

        test('deve calcular pontuação de consistência', () => {
            const metrics = {
                studyStreak: 10,
                totalStudyDays: 20
            };
            
            const consistency = MetricsSystem.calculateConsistencyScore(metrics);
            expect(consistency).toBe(50); // 10/20 = 50%
        });

        test('deve calcular rating de performance geral', () => {
            const metrics = {
                studyEfficiency: 2,
                progressVelocity: 1.5,
                consistencyScore: 75,
                completedTopicsCount: 25
            };
            
            const rating = MetricsSystem.calculatePerformanceRating(metrics);
            expect(rating).toBeGreaterThan(0);
            expect(rating).toBeLessThanOrEqual(100);
        });

        test('deve gerar métricas derivadas completas', () => {
            const baseMetrics = {
                completedTopics: 15,
                totalStudyTime: 450,
                completedTopicsCount: 30,
                totalStudyDays: 20,
                studyStreak: 12
            };
            
            const derived = MetricsSystem.calculateDerivedMetrics(baseMetrics);
            
            expect(derived).toHaveProperty('studyEfficiency');
            expect(derived).toHaveProperty('progressVelocity');
            expect(derived).toHaveProperty('consistencyScore');
            expect(derived).toHaveProperty('performanceRating');
            
            expect(typeof derived.studyEfficiency).toBe('number');
            expect(typeof derived.progressVelocity).toBe('number');
            expect(typeof derived.consistencyScore).toBe('number');
            expect(typeof derived.performanceRating).toBe('number');
        });
    });

    describe('Tratamento de Erros', () => {
        test('deve lidar com dados ausentes graciosamente', () => {
            const efficiency = MetricsSystem.calculateStudyEfficiency({});
            expect(efficiency).toBe(0);
            
            const velocity = MetricsSystem.calculateProgressVelocity({});
            expect(velocity).toBe(0);
        });

        test('deve lidar com divisão por zero', () => {
            const metrics = {
                completedTopics: 10,
                totalStudyTime: 0
            };
            
            const efficiency = MetricsSystem.calculateStudyEfficiency(metrics);
            expect(efficiency).toBe(0);
        });

        test('deve validar campos obrigatórios', () => {
            const incompleteData = {
                date: '2025-01-15'
                // Faltando campos obrigatórios
            };
            
            const result = MetricsSystem.validateMetricsData(incompleteData, 'daily_progress');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Campo obrigatório ausente');
        });
    });

    describe('Performance e Cache', () => {
        test('deve manter performance adequada com múltiplas chamadas', async () => {
            const planId = 1;
            const startTime = Date.now();
            
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(MetricsSystem.getDailyProgress(planId, `2025-01-${15 + i}`));
            }
            
            await Promise.all(promises);
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            // Deve executar em menos de 1 segundo
            expect(executionTime).toBeLessThan(1000);
        });

        test('deve limpar cache completamente', () => {
            MetricsSystem._cache.set('test_key', 'test_value');
            MetricsSystem._gamificationCache[1] = { test: 'data' };
            
            MetricsSystem.clearCache();
            
            expect(MetricsSystem._cache.size).toBe(0);
            expect(Object.keys(MetricsSystem._gamificationCache)).toHaveLength(0);
        });
    });
});

describe('Integração com Sistema Existente', () => {
    test('deve seguir padrões do FortressConfig', () => {
        const metricsCategory = FortressConfig.categories.metrics;
        
        expect(metricsCategory).toBeDefined();
        expect(metricsCategory.name).toBe('Testes de Métricas');
        expect(metricsCategory.priority).toBe('medium');
        expect(metricsCategory.modules).toContain('progress');
        expect(metricsCategory.modules).toContain('cache');
        expect(metricsCategory.modules).toContain('gamification');
    });

    test('deve manter compatibilidade com sistema de fixtures', () => {
        const fixtures = FortressConfig.fixtures;
        
        expect(fixtures.users.valid).toBeDefined();
        expect(fixtures.sessions.valid).toBeDefined();
        expect(fixtures.plans.sample).toBeDefined();
        
        // Verificar se as fixtures são compatíveis com as métricas
        const samplePlan = fixtures.plans.sample[0];
        expect(samplePlan.id).toBeDefined();
        expect(typeof samplePlan.id).toBe('number');
    });
});