/**
 * 🧪 TESTE DE MIGRAÇÃO - ESTATÍSTICAS E MÉTRICAS
 * 
 * ⚠️ TESTE CRÍTICO - QUERIES COMPLEXAS ⚠️
 * 
 * Este script testa a migração do módulo de estatísticas, que contém
 * some das queries SQL mais complexas do sistema, incluindo:
 * 
 * - CTEs recursivas para cálculo de streak
 * - Queries PostgreSQL avançadas
 * - Cálculos de média temporal
 * - Fallback para queries simplificadas
 * - Timezone brasileiro integrado
 * - Agregações complexas
 * 
 * ⚠️ ATENÇÃO: Execute apenas em ambiente de desenvolvimento/teste!
 * 
 * Uso:
 * node test-statistics-migration.js --env=development
 * node test-statistics-migration.js --env=test --performance
 */

const axios = require('axios');
const assert = require('assert');
const { performance } = require('perf_hooks');

// Configuração baseada no ambiente
const CONFIG = {
    development: {
        baseURL: 'http://localhost:3000',
        timeout: 30000, // 30s para queries complexas
        dbReset: true
    },
    test: {
        baseURL: 'http://localhost:3000',
        timeout: 15000, // 15s para testes mais rápidos
        dbReset: true
    },
    staging: {
        baseURL: 'https://staging.editaliza.com.br',
        timeout: 45000, // 45s para ambiente mais lento
        dbReset: false
    }
};

class StatisticsMigrationTester {
    constructor(env = 'development') {
        this.env = env;
        this.config = CONFIG[env];
        this.api = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true
        });
        
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: [],
            performanceWarnings: []
        };
        
        this.testUser = null;
        this.authToken = null;
        this.testPlan = null;
        this.testSessions = [];
    }

    // 🎯 Utilitários de teste
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            'INFO': '\x1b[34m',
            'SUCCESS': '\x1b[32m',
            'WARNING': '\x1b[33m',
            'ERROR': '\x1b[31m',
            'CRITICAL': '\x1b[35m',
            'PERFORMANCE': '\x1b[36m', // Ciano para performance
            'RESET': '\x1b[0m'
        };
        
        console.log(`${colors[level]}[${timestamp}] ${level}: ${message}${colors.RESET}`);
    }

    async assert(condition, message, details = null, isCritical = false) {
        this.testResults.total++;
        
        try {
            assert(condition, message);
            this.testResults.passed++;
            await this.log(`✅ PASSOU: ${message}`, 'SUCCESS');
        } catch (error) {
            this.testResults.failed++;
            const errorInfo = {
                message,
                error: error.message,
                details,
                critical: isCritical
            };
            
            this.testResults.errors.push(errorInfo);
            
            const logLevel = isCritical ? 'CRITICAL' : 'ERROR';
            await this.log(`❌ FALHOU: ${message} - ${error.message}`, logLevel);
            
            if (details) {
                await this.log(`   Detalhes: ${JSON.stringify(details, null, 2)}`, 'ERROR');
            }
        }
    }

    async measureTime(operation, name, performanceThreshold = null) {
        const start = performance.now();
        const result = await operation();
        const end = performance.now();
        const duration = Math.round(end - start);
        
        await this.log(`⏱️ ${name}: ${duration}ms`, 'PERFORMANCE');
        
        if (performanceThreshold && duration > performanceThreshold) {
            const warning = `⚠️ PERFORMANCE: ${name} demorou ${duration}ms (limite: ${performanceThreshold}ms)`;
            await this.log(warning, 'WARNING');
            this.testResults.performanceWarnings.push({
                operation: name,
                duration,
                threshold: performanceThreshold
            });
        }
        
        return { result, duration };
    }

    // 🔐 Configuração de ambiente de teste
    async setupAuth() {
        await this.log('Configurando autenticação para testes de estatísticas...', 'INFO');
        
        const registerData = {
            name: `Teste Statistics ${Date.now()}`,
            email: `test-stats-${Date.now()}@test.com`,
            password: 'TestPassword123!',
            confirmPassword: 'TestPassword123!'
        };

        const registerResponse = await this.api.post('/api/register', registerData);
        
        await this.assert(
            [200, 201].includes(registerResponse.status),
            'Registro de usuário deve ser bem-sucedido',
            { status: registerResponse.status },
            true // Crítico
        );

        const loginResponse = await this.api.post('/api/login', {
            email: registerData.email,
            password: registerData.password
        });

        await this.assert(
            loginResponse.status === 200 && loginResponse.data.token,
            'Login deve retornar token válido',
            { status: loginResponse.status },
            true // Crítico
        );

        this.authToken = loginResponse.data.token;
        this.testUser = loginResponse.data.user;
        this.api.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
        
        await this.log(`Usuário de teste criado: ${this.testUser.id}`, 'SUCCESS');
    }

    async setupTestPlanWithData() {
        await this.log('Criando plano com dados históricos para estatísticas...', 'INFO');
        
        // Criar plano de teste
        const planData = {
            name: 'Plano Estatísticas Teste',
            description: 'Plano para teste de estatísticas com dados históricos',
            examDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 dias
            studyHoursPerDay: 4,
            studyDaysPerWeek: 5,
            isWeekendStudy: true,
            weekendHours: 6
        };

        const createResponse = await this.api.post('/api/plans', planData);
        
        await this.assert(
            createResponse.status === 201,
            'Criação do plano de teste deve ser bem-sucedida',
            { status: createResponse.status },
            true
        );

        this.testPlan = createResponse.data;
        
        // Criar disciplinas
        const subjectsData = {
            subjects: [
                { name: 'Matemática', weight: 4, color: '#FF5733' },
                { name: 'Português', weight: 3, color: '#33FF57' },
                { name: 'Direito', weight: 3, color: '#3357FF' }
            ]
        };

        const subjectsResponse = await this.api.post(`/api/plans/${this.testPlan.id}/subjects_with_topics`, subjectsData);
        
        if (subjectsResponse.status === 201) {
            // Criar tópicos para cada disciplina
            for (const subject of subjectsResponse.data.subjects) {
                for (let i = 1; i <= 10; i++) {
                    await this.api.post(`/api/subjects/${subject.id}/topics`, {
                        name: `${subject.name} - Tópico ${i}`,
                        difficulty: Math.floor(Math.random() * 5) + 1,
                        estimatedHours: Math.floor(Math.random() * 3) + 1
                    });
                }
            }
        }

        // Gerar cronograma
        await this.api.post(`/api/plans/${this.testPlan.id}/generate`);
        
        // Buscar sessões geradas
        const scheduleResponse = await this.api.get(`/api/plans/${this.testPlan.id}/schedule`);
        
        if (scheduleResponse.status === 200 && scheduleResponse.data) {
            this.testSessions = scheduleResponse.data;
            await this.log(`📅 Cronograma gerado com ${this.testSessions.length} sessões`, 'SUCCESS');
            
            // Simular histórico de estudo
            await this.simulateStudyHistory();
        }
        
        return this.testPlan;
    }

    async simulateStudyHistory() {
        await this.log('Simulando histórico de estudo para estatísticas...', 'INFO');
        
        // Simular diferentes tipos de sessão
        const sessionTypes = [
            { status: 'completed', duration: 60, performance: 5, questionsCorrect: 8, questionsTotal: 10 },
            { status: 'completed', duration: 45, performance: 4, questionsCorrect: 7, questionsTotal: 10 },
            { status: 'completed', duration: 90, performance: 3, questionsCorrect: 5, questionsTotal: 10 },
            { status: 'completed', duration: 30, performance: 4, questionsCorrect: 6, questionsTotal: 10 },
            { status: 'completed', duration: 75, performance: 5, questionsCorrect: 9, questionsTotal: 10 },
            { status: 'postponed' },
            { status: 'completed', duration: 50, performance: 2, questionsCorrect: 3, questionsTotal: 10 },
            { status: 'completed', duration: 120, performance: 4, questionsCorrect: 7, questionsTotal: 10 }
        ];

        let updatedSessions = 0;
        
        for (let i = 0; i < Math.min(this.testSessions.length, sessionTypes.length); i++) {
            const session = this.testSessions[i];
            const updateData = sessionTypes[i];
            
            try {
                const updateResponse = await this.api.patch(`/api/sessions/${session.id}`, updateData);
                
                if (updateResponse.status === 200) {
                    updatedSessions++;
                    
                    // Simular registro de tempo se a sessão foi completada
                    if (updateData.status === 'completed' && updateData.duration) {
                        await this.api.post(`/api/sessions/${session.id}/time`, {
                            duration: updateData.duration,
                            performance: updateData.performance,
                            questionsCorrect: updateData.questionsCorrect || 0,
                            questionsTotal: updateData.questionsTotal || 0
                        });
                    }
                }
            } catch (error) {
                await this.log(`Erro ao atualizar sessão ${session.id}: ${error.message}`, 'WARNING');
            }
        }
        
        await this.log(`📊 Histórico simulado: ${updatedSessions} sessões atualizadas`, 'SUCCESS');
    }

    // 🧪 Testes de estatísticas básicas
    async testBasicStatistics() {
        await this.log('🧪 Testando estatísticas básicas...', 'INFO');

        if (!this.testPlan) {
            await this.log('❌ Plano de teste não disponível', 'ERROR');
            return;
        }

        // Testar rota de progresso básico
        const { result: progressResponse, duration: progressDuration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/progress`),
            'GET /api/plans/:planId/progress',
            2000 // 2s limite
        );

        await this.assert(
            progressResponse.status === 200,
            'Estatísticas de progresso devem ser acessíveis',
            { status: progressResponse.status },
            true // Crítico
        );

        if (progressResponse.data) {
            const progress = progressResponse.data;
            
            // Verificar estrutura dos dados
            await this.assert(
                typeof progress.completed === 'number' && progress.completed >= 0,
                'Progresso deve conter campo "completed" numérico',
                { completed: progress.completed },
                false
            );

            await this.assert(
                typeof progress.total === 'number' && progress.total > 0,
                'Progresso deve conter campo "total" numérico positivo',
                { total: progress.total },
                false
            );

            await this.log(`📊 Progresso: ${progress.completed}/${progress.total}`, 'INFO');
        }

        // Testar progresso de metas
        const { result: goalResponse, duration: goalDuration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/goal_progress`),
            'GET /api/plans/:planId/goal_progress',
            2000 // 2s limite
        );

        await this.assert(
            goalResponse.status === 200,
            'Progresso de metas deve ser acessível',
            { status: goalResponse.status },
            false // Não crítico
        );
    }

    async testComplexStatistics() {
        await this.log('🧪 Testando estatísticas complexas (CTEs)...', 'INFO');

        if (!this.testPlan) {
            await this.log('❌ Plano de teste não disponível', 'ERROR');
            return;
        }

        // Testar a rota mais complexa - estatísticas completas
        const { result: statsResponse, duration: statsDuration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/statistics`),
            'GET /api/plans/:planId/statistics (CTE recursiva)',
            5000 // 5s limite para query complexa
        );

        await this.assert(
            statsResponse.status === 200,
            'Estatísticas complexas devem ser acessíveis',
            { status: statsResponse.status, duration: statsDuration },
            true // Crítico - é a query mais complexa
        );

        if (statsResponse.data) {
            const stats = statsResponse.data;
            
            // Verificar estrutura de dados críticos
            await this.assert(
                stats.hasOwnProperty('streak'),
                'Estatísticas devem conter cálculo de streak',
                { hasStreak: stats.hasOwnProperty('streak') },
                true // Crítico - streak usa CTE recursiva
            );

            await this.assert(
                typeof stats.averagePerformance === 'number' || stats.averagePerformance === null,
                'Performance média deve ser numérica ou null',
                { averagePerformance: stats.averagePerformance },
                false
            );

            await this.assert(
                typeof stats.totalStudyTime === 'number' && stats.totalStudyTime >= 0,
                'Tempo total de estudo deve ser numérico não-negativo',
                { totalStudyTime: stats.totalStudyTime },
                false
            );

            await this.log(`📊 Streak atual: ${stats.streak || 0} dias`, 'INFO');
            await this.log(`📊 Performance média: ${stats.averagePerformance || 'N/A'}`, 'INFO');
            await this.log(`📊 Tempo total: ${stats.totalStudyTime || 0} minutos`, 'INFO');
        }

        // Performance check crítico
        await this.assert(
            statsDuration < 5000,
            'Query de estatísticas complexas deve completar em menos de 5s',
            { duration: statsDuration },
            true // Crítico para UX
        );
    }

    async testDetailedProgress() {
        await this.log('🧪 Testando progresso detalhado...', 'INFO');

        if (!this.testPlan) return;

        const { result: detailedResponse, duration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/detailed_progress`),
            'GET /api/plans/:planId/detailed_progress',
            3000 // 3s limite
        );

        await this.assert(
            detailedResponse.status === 200,
            'Progresso detalhado deve ser acessível',
            { status: detailedResponse.status },
            false // Importante mas não crítico
        );

        if (detailedResponse.data && Array.isArray(detailedResponse.data)) {
            const detailedData = detailedResponse.data;
            
            await this.assert(
                detailedData.length > 0,
                'Progresso detalhado deve conter dados por disciplina',
                { dataLength: detailedData.length },
                false
            );

            // Verificar estrutura de cada item
            for (const item of detailedData) {
                await this.assert(
                    item.hasOwnProperty('subject_name') && 
                    typeof item.completed === 'number' && 
                    typeof item.total === 'number',
                    'Item de progresso detalhado deve ter estrutura válida',
                    { item },
                    false
                );
            }

            await this.log(`📊 Progresso por disciplina: ${detailedData.length} itens`, 'INFO');
        }
    }

    async testQuestionRadar() {
        await this.log('🧪 Testando radar de questões...', 'INFO');

        if (!this.testPlan) return;

        const { result: radarResponse, duration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/question_radar`),
            'GET /api/plans/:planId/question_radar',
            2000 // 2s limite
        );

        await this.assert(
            radarResponse.status === 200,
            'Radar de questões deve ser acessível',
            { status: radarResponse.status },
            false
        );

        if (radarResponse.data) {
            const radarData = radarResponse.data;
            
            // Verificar se é um array válido para chart radar
            await this.assert(
                Array.isArray(radarData),
                'Dados do radar devem ser um array',
                { isArray: Array.isArray(radarData) },
                false
            );

            if (radarData.length > 0) {
                const firstItem = radarData[0];
                await this.assert(
                    firstItem.hasOwnProperty('subject') && 
                    typeof firstItem.percentage === 'number',
                    'Itens do radar devem ter estrutura válida',
                    { firstItem },
                    false
                );
            }

            await this.log(`📊 Radar: ${radarData.length} disciplinas`, 'INFO');
        }
    }

    async testActivitySummary() {
        await this.log('🧪 Testando resumo de atividades...', 'INFO');

        if (!this.testPlan) return;

        const { result: activityResponse, duration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/activity_summary`),
            'GET /api/plans/:planId/activity_summary',
            2000
        );

        await this.assert(
            activityResponse.status === 200,
            'Resumo de atividades deve ser acessível',
            { status: activityResponse.status },
            false
        );

        if (activityResponse.data) {
            const activity = activityResponse.data;
            
            await this.assert(
                typeof activity.sessionsCompleted === 'number' && activity.sessionsCompleted >= 0,
                'Sessões completadas deve ser numérico não-negativo',
                { sessionsCompleted: activity.sessionsCompleted },
                false
            );

            await this.log(`📊 Atividade: ${activity.sessionsCompleted || 0} sessões completadas`, 'INFO');
        }
    }

    async testRealityCheck() {
        await this.log('🧪 Testando reality check...', 'INFO');

        if (!this.testPlan) return;

        const { result: realityResponse, duration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/realitycheck`),
            'GET /api/plans/:planId/realitycheck',
            2000
        );

        await this.assert(
            realityResponse.status === 200,
            'Reality check deve ser acessível',
            { status: realityResponse.status },
            false
        );

        if (realityResponse.data) {
            const reality = realityResponse.data;
            
            // Reality check deve ter métricas de viabilidade
            await this.assert(
                typeof reality.isRealistic === 'boolean',
                'Reality check deve indicar se plano é realístico',
                { isRealistic: reality.isRealistic },
                false
            );

            await this.log(`📊 Plano realístico: ${reality.isRealistic ? 'Sim' : 'Não'}`, 'INFO');
        }
    }

    async testShareProgress() {
        await this.log('🧪 Testando progresso compartilhável...', 'INFO');

        if (!this.testPlan) return;

        const { result: shareResponse, duration } = await this.measureTime(
            () => this.api.get(`/api/plans/${this.testPlan.id}/share-progress`),
            'GET /api/plans/:planId/share-progress',
            2000
        );

        await this.assert(
            shareResponse.status === 200,
            'Progresso compartilhável deve ser acessível',
            { status: shareResponse.status },
            false
        );

        if (shareResponse.data) {
            const shareData = shareResponse.data;
            
            // Dados compartilháveis devem ter informações resumidas
            await this.assert(
                shareData.hasOwnProperty('progress') && shareData.hasOwnProperty('streak'),
                'Dados compartilháveis devem ter progresso e streak',
                { hasProgress: shareData.hasOwnProperty('progress'), hasStreak: shareData.hasOwnProperty('streak') },
                false
            );

            await this.log(`📊 Share: ${shareData.progress || 0}% progresso, ${shareData.streak || 0} dias streak`, 'INFO');
        }
    }

    async testPerformanceWithLargeDataset() {
        await this.log('🧪 Testando performance com dataset grande...', 'WARNING');

        if (!this.testPlan) return;

        // Simular mais dados históricos
        const additionalSessions = this.testSessions.slice(0, Math.min(20, this.testSessions.length));
        
        for (const session of additionalSessions) {
            try {
                await this.api.patch(`/api/sessions/${session.id}`, {
                    status: 'completed',
                    duration: Math.floor(Math.random() * 90) + 30, // 30-120 min
                    performance: Math.floor(Math.random() * 5) + 1, // 1-5
                    questionsCorrect: Math.floor(Math.random() * 8) + 2, // 2-10
                    questionsTotal: 10
                });
            } catch (error) {
                // Ignorar erros de atualização duplicada
            }
        }

        // Testar performance das queries mais pesadas
        const heavyQueries = [
            { url: `/api/plans/${this.testPlan.id}/statistics`, name: 'Estatísticas completas', maxTime: 8000 },
            { url: `/api/plans/${this.testPlan.id}/detailed_progress`, name: 'Progresso detalhado', maxTime: 5000 },
            { url: `/api/plans/${this.testPlan.id}/activity_summary`, name: 'Resumo atividades', maxTime: 3000 }
        ];

        for (const query of heavyQueries) {
            const { result, duration } = await this.measureTime(
                () => this.api.get(query.url),
                `Performance - ${query.name}`,
                query.maxTime
            );

            await this.assert(
                result.status === 200,
                `Query pesada deve funcionar: ${query.name}`,
                { status: result.status, duration },
                false
            );

            await this.assert(
                duration < query.maxTime,
                `Query pesada deve ser rápida: ${query.name} (< ${query.maxTime}ms)`,
                { duration, maxTime: query.maxTime },
                false // Performance não é crítica para funcionalidade, mas importante para UX
            );
        }
    }

    async testErrorHandling() {
        await this.log('🧪 Testando tratamento de erros...', 'INFO');

        // Teste com plano inexistente
        const fakeId = 99999;
        const fakeResponse = await this.api.get(`/api/plans/${fakeId}/statistics`);
        
        await this.assert(
            fakeResponse.status === 404,
            'Estatísticas de plano inexistente devem retornar 404',
            { status: fakeResponse.status },
            false
        );

        // Teste sem autenticação
        const noAuthApi = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true
        });

        const noAuthResponse = await noAuthApi.get(`/api/plans/${this.testPlan?.id || 1}/statistics`);
        
        await this.assert(
            noAuthResponse.status === 401,
            'Estatísticas sem autenticação devem retornar 401',
            { status: noAuthResponse.status },
            false
        );
    }

    // 🎯 Executar todos os testes
    async runAllTests() {
        await this.log('🚀 Iniciando testes de migração de estatísticas...', 'INFO');
        await this.log(`📊 Ambiente: ${this.env} | Base URL: ${this.config.baseURL}`, 'INFO');

        try {
            // Configuração
            await this.setupAuth();
            await this.setupTestPlanWithData();

            // Testes de estatísticas
            await this.testBasicStatistics();
            await this.testComplexStatistics();
            await this.testDetailedProgress();
            await this.testQuestionRadar();
            await this.testActivitySummary();
            await this.testRealityCheck();
            await this.testShareProgress();
            await this.testPerformanceWithLargeDataset();
            await this.testErrorHandling();

            // Relatório final
            await this.generateReport();

        } catch (error) {
            await this.log(`💥 Erro crítico durante execução: ${error.message}`, 'CRITICAL');
            console.error(error.stack);
            process.exit(1);
        }
    }

    async generateReport() {
        await this.log('📊 Gerando relatório final de estatísticas...', 'INFO');
        
        const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
        const criticalFailures = this.testResults.errors.filter(e => e.critical);
        
        const reportData = {
            environment: this.env,
            timestamp: new Date().toISOString(),
            results: this.testResults,
            successRate: `${successRate}%`,
            criticalFailures: criticalFailures.length,
            performanceWarnings: this.testResults.performanceWarnings.length,
            recommendation: this.getRecommendation(successRate, criticalFailures.length)
        };

        console.log('\n' + '='.repeat(80));
        console.log('📊 RELATÓRIO FINAL - TESTE DE ESTATÍSTICAS');
        console.log('='.repeat(80));
        console.log(`🌍 Ambiente: ${this.env}`);
        console.log(`🔗 Base URL: ${this.config.baseURL}`);
        console.log(`📅 Executado em: ${reportData.timestamp}`);
        console.log('='.repeat(80));
        console.log(`📈 Total de testes: ${this.testResults.total}`);
        console.log(`✅ Testes passaram: ${this.testResults.passed}`);
        console.log(`❌ Testes falharam: ${this.testResults.failed}`);
        console.log(`💥 Falhas críticas: ${criticalFailures.length}`);
        console.log(`⚠️ Avisos de performance: ${this.testResults.performanceWarnings.length}`);
        console.log(`🎯 Taxa de sucesso: ${successRate}%`);
        console.log('='.repeat(80));

        if (criticalFailures.length > 0) {
            console.log('💥 FALHAS CRÍTICAS:');
            criticalFailures.forEach((error, index) => {
                console.log(`\n${index + 1}. 🚨 ${error.message}`);
                console.log(`   💀 Erro: ${error.error}`);
            });
            console.log('='.repeat(80));
        }

        if (this.testResults.performanceWarnings.length > 0) {
            console.log('⚠️ AVISOS DE PERFORMANCE:');
            this.testResults.performanceWarnings.forEach((warning, index) => {
                console.log(`\n${index + 1}. ${warning.operation}: ${warning.duration}ms (limite: ${warning.threshold}ms)`);
            });
            console.log('='.repeat(80));
        }

        const recommendation = this.getRecommendation(successRate, criticalFailures.length);
        console.log(`\n${recommendation}`);
        console.log('='.repeat(80) + '\n');

        // Salvar relatório
        const reportFile = `test-report-statistics-${this.env}-${Date.now()}.json`;
        require('fs').writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        await this.log(`📄 Relatório salvo em: ${reportFile}`, 'INFO');

        return criticalFailures.length === 0 && successRate >= 90;
    }

    getRecommendation(successRate, criticalFailures) {
        if (criticalFailures > 0) {
            return '🚨 ROLLBACK IMEDIATO - Falhas críticas nas queries de estatísticas!';
        } else if (successRate >= 95) {
            return '🎉 MIGRAÇÃO APROVADA - Estatísticas funcionando perfeitamente!';
        } else if (successRate >= 85) {
            return '⚠️ MIGRAÇÃO COM RESSALVAS - Revisar performance e falhas menores.';
        } else {
            return '❌ REJEITAR MIGRAÇÃO - Taxa de sucesso insuficiente.';
        }
    }
}

// 🎬 Execução principal
async function main() {
    const args = process.argv.slice(2);
    const envArg = args.find(arg => arg.startsWith('--env='));
    const env = envArg ? envArg.split('=')[1] : 'development';
    
    if (!CONFIG[env]) {
        console.error(`❌ Ambiente inválido: ${env}. Use: development, test, ou staging`);
        process.exit(1);
    }

    // Proteção de segurança
    if (env === 'production') {
        console.error('❌ ERRO: Não execute testes de estatísticas em produção!');
        console.error('🚨 Queries complexas podem impactar performance do banco!');
        process.exit(1);
    }

    console.log('📊 TESTE DE ESTATÍSTICAS - QUERIES COMPLEXAS');
    console.log('🎯 Validando CTEs recursivas e agregações');
    console.log('⚠️ Monitorando performance de queries...\n');

    const tester = new StatisticsMigrationTester(env);
    const success = await tester.runAllTests();
    
    process.exit(success ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erro fatal no teste de estatísticas:', error);
        process.exit(1);
    });
}

module.exports = { StatisticsMigrationTester };