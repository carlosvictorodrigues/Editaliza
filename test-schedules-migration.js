/**
 * 🧪 TESTE DE MIGRAÇÃO - GERAÇÃO DE CRONOGRAMAS
 * 
 * ⚠️⚠️⚠️ TESTE ULTRA-CRÍTICO ⚠️⚠️⚠️
 * 
 * Este é o teste mais crítico do sistema. O algoritmo de geração de cronogramas
 * tem 700+ linhas de código complexo e é o coração do negócio da Editaliza.
 * 
 * Funcionalidades testadas:
 * - Algoritmo round-robin ponderado
 * - Modo "Reta Final" 
 * - Cálculos de data brasileiro (timezone)
 * - Transações complexas
 * - Cache de datas disponíveis
 * - Distribuição inteligente de tópicos
 * 
 * ⚠️ ATENÇÃO: Execute apenas em ambiente de desenvolvimento/teste!
 * 
 * Uso:
 * node test-schedules-migration.js --env=development
 * node test-schedules-migration.js --env=test --deep-test
 */

const axios = require('axios');
const assert = require('assert');
const { performance } = require('perf_hooks');

// Configuração baseada no ambiente
const CONFIG = {
    development: {
        baseURL: 'http://localhost:3000',
        timeout: 60000, // 60s para algoritmos complexos
        dbReset: true
    },
    test: {
        baseURL: 'http://localhost:3000',
        timeout: 30000, // 30s para testes rápidos
        dbReset: true
    },
    staging: {
        baseURL: 'https://staging.editaliza.com.br',
        timeout: 90000, // 90s para ambiente mais lento
        dbReset: false
    }
};

class SchedulesMigrationTester {
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
            criticalFailures: []
        };
        
        this.testUser = null;
        this.authToken = null;
        this.testPlan = null;
        this.testSubjects = [];
    }

    // 🎯 Utilitários de teste
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            'INFO': '\x1b[34m',
            'SUCCESS': '\x1b[32m',
            'WARNING': '\x1b[33m',
            'ERROR': '\x1b[31m',
            'CRITICAL': '\x1b[35m', // Magenta para crítico
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
            
            if (isCritical) {
                this.testResults.criticalFailures.push(errorInfo);
                await this.log(`💥 FALHA CRÍTICA: ${message} - ${error.message}`, 'CRITICAL');
            } else {
                await this.log(`❌ FALHOU: ${message} - ${error.message}`, 'ERROR');
            }
            
            if (details) {
                await this.log(`   Detalhes: ${JSON.stringify(details, null, 2)}`, 'ERROR');
            }
        }
    }

    async measureTime(operation, name, maxTime = null) {
        const start = performance.now();
        const result = await operation();
        const end = performance.now();
        const duration = Math.round(end - start);
        
        await this.log(`⏱️ ${name}: ${duration}ms`, 'INFO');
        
        if (maxTime && duration > maxTime) {
            await this.log(`⚠️ PERFORMANCE: ${name} demorou ${duration}ms (limite: ${maxTime}ms)`, 'WARNING');
        }
        
        return { result, duration };
    }

    // 🔐 Configuração de ambiente de teste
    async setupAuth() {
        await this.log('Configurando autenticação para testes de cronograma...', 'INFO');
        
        const registerData = {
            name: `Teste Schedule ${Date.now()}`,
            email: `test-schedule-${Date.now()}@test.com`,
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

    async setupTestPlan(daysToExam = 90, mode = 'normal') {
        await this.log(`Criando plano de teste (${mode}, ${daysToExam} dias)...`, 'INFO');
        
        const planData = {
            name: `Plano Cronograma Teste - ${mode}`,
            description: `Plano para teste de geração de cronograma - modo ${mode}`,
            examDate: new Date(Date.now() + daysToExam * 24 * 60 * 60 * 1000).toISOString(),
            studyHoursPerDay: 4,
            studyDaysPerWeek: 5,
            isWeekendStudy: true,
            weekendHours: 6,
            finalSprintDays: mode === 'sprint' ? 30 : null
        };

        const createResponse = await this.api.post('/api/plans', planData);
        
        await this.assert(
            createResponse.status === 201,
            'Criação do plano de teste deve ser bem-sucedida',
            { status: createResponse.status },
            true // Crítico
        );

        this.testPlan = createResponse.data;
        return this.testPlan;
    }

    async setupTestSubjects(planId, complexity = 'medium') {
        await this.log(`Configurando disciplinas de teste (${complexity})...`, 'INFO');
        
        const subjectConfigs = {
            simple: [
                { name: 'Matemática', weight: 3, topicCount: 10 },
                { name: 'Português', weight: 2, topicCount: 8 }
            ],
            medium: [
                { name: 'Matemática', weight: 4, topicCount: 25 },
                { name: 'Português', weight: 3, topicCount: 20 },
                { name: 'Direito Constitucional', weight: 3, topicCount: 30 },
                { name: 'Direito Administrativo', weight: 2, topicCount: 15 },
                { name: 'Informática', weight: 2, topicCount: 12 }
            ],
            complex: [
                { name: 'Matemática', weight: 5, topicCount: 50 },
                { name: 'Português', weight: 4, topicCount: 40 },
                { name: 'Direito Constitucional', weight: 4, topicCount: 60 },
                { name: 'Direito Administrativo', weight: 3, topicCount: 45 },
                { name: 'Direito Penal', weight: 3, topicCount: 35 },
                { name: 'Direito Civil', weight: 3, topicCount: 40 },
                { name: 'Informática', weight: 2, topicCount: 25 },
                { name: 'Atualidades', weight: 2, topicCount: 30 }
            ]
        };

        const subjects = subjectConfigs[complexity];
        this.testSubjects = [];

        for (const subjectConfig of subjects) {
            // Criar disciplina
            const subjectData = {
                subjects: [{
                    name: subjectConfig.name,
                    weight: subjectConfig.weight,
                    color: `#${Math.floor(Math.random()*16777215).toString(16)}`
                }]
            };

            const subjectResponse = await this.api.post(`/api/plans/${planId}/subjects_with_topics`, subjectData);
            
            if (subjectResponse.status === 201) {
                const createdSubject = subjectResponse.data.subjects[0];
                
                // Criar tópicos para a disciplina
                const topics = [];
                for (let i = 1; i <= subjectConfig.topicCount; i++) {
                    topics.push({
                        name: `${subjectConfig.name} - Tópico ${i}`,
                        difficulty: Math.floor(Math.random() * 5) + 1, // 1-5
                        estimatedHours: Math.floor(Math.random() * 3) + 1 // 1-3 horas
                    });
                }

                // Adicionar tópicos via API
                for (const topic of topics) {
                    await this.api.post(`/api/subjects/${createdSubject.id}/topics`, topic);
                }

                this.testSubjects.push({
                    ...createdSubject,
                    topicCount: subjectConfig.topicCount
                });
                
                await this.log(`✅ Disciplina criada: ${subjectConfig.name} (${subjectConfig.topicCount} tópicos)`, 'SUCCESS');
            }
        }

        await this.log(`📚 Total: ${this.testSubjects.length} disciplinas com ${this.testSubjects.reduce((sum, s) => sum + s.topicCount, 0)} tópicos`, 'SUCCESS');
    }

    // 🧪 Testes do algoritmo de geração
    async testBasicScheduleGeneration() {
        await this.log('🧪 Testando geração básica de cronograma...', 'INFO');

        const plan = await this.setupTestPlan(90, 'normal');
        await this.setupTestSubjects(plan.id, 'simple');

        // Testar geração básica
        const { result: generateResponse, duration } = await this.measureTime(
            () => this.api.post(`/api/plans/${plan.id}/generate`),
            'Geração básica de cronograma',
            30000 // 30s limite
        );

        await this.assert(
            generateResponse.status === 200 || generateResponse.status === 201,
            'Geração básica deve ser bem-sucedida',
            { status: generateResponse.status, duration },
            true // Crítico
        );

        // Verificar se sessões foram criadas
        const scheduleResponse = await this.api.get(`/api/plans/${plan.id}/schedule`);
        
        await this.assert(
            scheduleResponse.status === 200 && 
            Array.isArray(scheduleResponse.data) && 
            scheduleResponse.data.length > 0,
            'Cronograma deve conter sessões após geração',
            { 
                status: scheduleResponse.status, 
                sessionCount: scheduleResponse.data ? scheduleResponse.data.length : 0 
            },
            true // Crítico
        );

        await this.log(`📅 Cronograma gerado com ${scheduleResponse.data.length} sessões`, 'SUCCESS');
    }

    async testComplexScheduleGeneration() {
        await this.log('🧪 Testando geração complexa de cronograma...', 'INFO');

        const plan = await this.setupTestPlan(180, 'normal'); // 6 meses
        await this.setupTestSubjects(plan.id, 'complex');

        // Testar geração complexa
        const { result: generateResponse, duration } = await this.measureTime(
            () => this.api.post(`/api/plans/${plan.id}/generate`),
            'Geração complexa de cronograma',
            60000 // 60s limite para algoritmo complexo
        );

        await this.assert(
            generateResponse.status === 200 || generateResponse.status === 201,
            'Geração complexa deve ser bem-sucedida',
            { status: generateResponse.status, duration },
            true // Crítico
        );

        await this.assert(
            duration < 60000,
            'Geração complexa deve completar em menos de 60s',
            { duration },
            true // Crítico - performance
        );

        // Verificar cronograma gerado
        const scheduleResponse = await this.api.get(`/api/plans/${plan.id}/schedule`);
        
        await this.assert(
            scheduleResponse.status === 200 && 
            Array.isArray(scheduleResponse.data) && 
            scheduleResponse.data.length > 0,
            'Cronograma complexo deve conter sessões',
            { sessionCount: scheduleResponse.data ? scheduleResponse.data.length : 0 },
            true // Crítico
        );

        // Verificar distribuição por disciplina
        if (scheduleResponse.data && scheduleResponse.data.length > 0) {
            const sessionsBySubject = {};
            scheduleResponse.data.forEach(session => {
                const subjectName = session.topic?.subject?.name;
                if (subjectName) {
                    sessionsBySubject[subjectName] = (sessionsBySubject[subjectName] || 0) + 1;
                }
            });

            const subjectCounts = Object.values(sessionsBySubject);
            const minSessions = Math.min(...subjectCounts);
            const maxSessions = Math.max(...subjectCounts);
            const distribution = maxSessions / minSessions;

            await this.assert(
                distribution <= 3, // Máximo 3x diferença entre disciplinas
                'Distribuição de sessões deve ser relativamente equilibrada',
                { sessionsBySubject, distribution },
                false // Não crítico, mas importante
            );

            await this.log(`📊 Distribuição por disciplina: ${JSON.stringify(sessionsBySubject)}`, 'INFO');
        }
    }

    async testSprintModeGeneration() {
        await this.log('🧪 Testando modo "Reta Final"...', 'INFO');

        const plan = await this.setupTestPlan(30, 'sprint'); // 30 dias - reta final
        await this.setupTestSubjects(plan.id, 'medium');

        // Testar geração em modo reta final
        const { result: generateResponse, duration } = await this.measureTime(
            () => this.api.post(`/api/plans/${plan.id}/generate`),
            'Geração modo reta final',
            45000 // 45s limite
        );

        await this.assert(
            generateResponse.status === 200 || generateResponse.status === 201,
            'Geração modo reta final deve ser bem-sucedida',
            { status: generateResponse.status, duration },
            true // Crítico
        );

        // Verificar se o modo reta final funcionou (menos tópicos incluídos)
        const scheduleResponse = await this.api.get(`/api/plans/${plan.id}/schedule`);
        
        if (scheduleResponse.data) {
            const totalTopics = this.testSubjects.reduce((sum, s) => sum + s.topicCount, 0);
            const scheduledSessions = scheduleResponse.data.length;
            
            await this.log(`📊 Reta Final: ${scheduledSessions} sessões de ${totalTopics} tópicos possíveis`, 'INFO');
            
            // Em modo reta final, deve haver exclusão inteligente de tópicos
            await this.assert(
                scheduledSessions < totalTopics,
                'Modo reta final deve excluir alguns tópicos automaticamente',
                { totalTopics, scheduledSessions },
                false // Importante mas não crítico
            );
        }
    }

    async testScheduleRegeneration() {
        await this.log('🧪 Testando regeneração de cronograma...', 'INFO');

        const plan = await this.setupTestPlan(120, 'normal');
        await this.setupTestSubjects(plan.id, 'medium');

        // Primeira geração
        const firstGeneration = await this.api.post(`/api/plans/${plan.id}/generate`);
        await this.assert(
            firstGeneration.status === 200 || firstGeneration.status === 201,
            'Primeira geração deve ser bem-sucedida',
            { status: firstGeneration.status },
            true
        );

        const firstSchedule = await this.api.get(`/api/plans/${plan.id}/schedule`);
        const firstCount = firstSchedule.data ? firstSchedule.data.length : 0;

        // Simular algum progresso
        if (firstSchedule.data && firstSchedule.data.length > 0) {
            const firstSession = firstSchedule.data[0];
            await this.api.patch(`/api/sessions/${firstSession.id}`, {
                status: 'completed',
                duration: 60,
                performance: 4
            });
        }

        // Segunda geração (regeneração)
        const { result: secondGeneration, duration } = await this.measureTime(
            () => this.api.post(`/api/plans/${plan.id}/generate`),
            'Regeneração de cronograma',
            45000
        );

        await this.assert(
            secondGeneration.status === 200 || secondGeneration.status === 201,
            'Regeneração deve ser bem-sucedida',
            { status: secondGeneration.status, duration },
            true // Crítico
        );

        const secondSchedule = await this.api.get(`/api/plans/${plan.id}/schedule`);
        const secondCount = secondSchedule.data ? secondSchedule.data.length : 0;

        await this.log(`📊 Regeneração: ${firstCount} → ${secondCount} sessões`, 'INFO');

        // Verificar que o progresso foi preservado
        if (secondSchedule.data) {
            const completedSessions = secondSchedule.data.filter(s => s.status === 'completed');
            await this.assert(
                completedSessions.length >= 1,
                'Progresso deve ser preservado na regeneração',
                { completedSessions: completedSessions.length },
                true // Crítico
            );
        }
    }

    async testTimezoneHandling() {
        await this.log('🧪 Testando cálculos de timezone brasileiro...', 'INFO');

        const plan = await this.setupTestPlan(60, 'normal');
        await this.setupTestSubjects(plan.id, 'simple');

        // Testar geração com diferentes datas de início
        const testDates = [
            new Date('2024-01-15'), // Horário de verão
            new Date('2024-06-15'), // Horário padrão
            new Date('2024-10-15'), // Transição para horário de verão
            new Date('2024-03-15')  // Transição para horário padrão
        ];

        for (const startDate of testDates) {
            // Atualizar data do exame
            const examDate = new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000);
            
            await this.api.patch(`/api/plans/${plan.id}/settings`, {
                examDate: examDate.toISOString()
            });

            const { result: generateResponse } = await this.measureTime(
                () => this.api.post(`/api/plans/${plan.id}/generate`),
                `Geração com data ${startDate.toISOString().split('T')[0]}`
            );

            await this.assert(
                generateResponse.status === 200 || generateResponse.status === 201,
                `Geração deve funcionar com data ${startDate.toISOString().split('T')[0]}`,
                { status: generateResponse.status },
                false // Não crítico individualmente
            );

            // Verificar se as datas das sessões estão corretas
            const scheduleResponse = await this.api.get(`/api/plans/${plan.id}/schedule`);
            
            if (scheduleResponse.data && scheduleResponse.data.length > 0) {
                const firstSession = scheduleResponse.data[0];
                const sessionDate = new Date(firstSession.date);
                
                await this.assert(
                    sessionDate >= startDate,
                    'Data da primeira sessão deve ser posterior à data de início',
                    { sessionDate: sessionDate.toISOString(), startDate: startDate.toISOString() },
                    false
                );
            }
        }
    }

    async testEdgeCasesAndErrorHandling() {
        await this.log('🧪 Testando edge cases e tratamento de erros...', 'INFO');

        // 1. Plano sem tópicos
        const emptyPlan = await this.setupTestPlan(90, 'normal');
        
        const emptyGeneration = await this.api.post(`/api/plans/${emptyPlan.id}/generate`);
        await this.assert(
            emptyGeneration.status === 400,
            'Geração sem tópicos deve retornar erro apropriado',
            { status: emptyGeneration.status },
            false
        );

        // 2. Data de exame no passado
        const pastPlan = await this.setupTestPlan(-30, 'normal'); // 30 dias atrás
        await this.setupTestSubjects(pastPlan.id, 'simple');

        const pastGeneration = await this.api.post(`/api/plans/${pastPlan.id}/generate`);
        await this.assert(
            pastGeneration.status === 400,
            'Geração com data no passado deve retornar erro',
            { status: pastGeneration.status },
            false
        );

        // 3. Plano inexistente
        const fakeId = 99999;
        const fakeGeneration = await this.api.post(`/api/plans/${fakeId}/generate`);
        await this.assert(
            fakeGeneration.status === 404,
            'Geração para plano inexistente deve retornar 404',
            { status: fakeGeneration.status },
            false
        );

        // 4. Sem autenticação
        const noAuthApi = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true
        });

        const noAuthGeneration = await noAuthApi.post(`/api/plans/${emptyPlan.id}/generate`);
        await this.assert(
            noAuthGeneration.status === 401,
            'Geração sem autenticação deve retornar 401',
            { status: noAuthGeneration.status },
            false
        );
    }

    async testPerformanceStress() {
        await this.log('🧪 Testando performance e stress...', 'WARNING');

        // Criar plano com muitos tópicos
        const largePlan = await this.setupTestPlan(365, 'normal'); // 1 ano
        
        // Simular disciplina com muitos tópicos
        const largeSubjectData = {
            subjects: [{
                name: 'Disciplina Grande',
                weight: 5,
                color: '#FF0000'
            }]
        };

        const subjectResponse = await this.api.post(`/api/plans/${largePlan.id}/subjects_with_topics`, largeSubjectData);
        
        if (subjectResponse.status === 201) {
            const subject = subjectResponse.data.subjects[0];
            
            // Criar 100 tópicos
            for (let i = 1; i <= 100; i++) {
                await this.api.post(`/api/subjects/${subject.id}/topics`, {
                    name: `Tópico Grande ${i}`,
                    difficulty: Math.floor(Math.random() * 5) + 1,
                    estimatedHours: 2
                });
            }
        }

        // Testar geração com volume alto
        const { result: stressResponse, duration } = await this.measureTime(
            () => this.api.post(`/api/plans/${largePlan.id}/generate`),
            'Geração com stress (100 tópicos)',
            120000 // 2 minutos limite
        );

        await this.assert(
            stressResponse.status === 200 || stressResponse.status === 201,
            'Geração stress deve ser bem-sucedida',
            { status: stressResponse.status, duration },
            true // Crítico para performance
        );

        await this.assert(
            duration < 120000,
            'Geração stress deve completar em menos de 2 minutos',
            { duration },
            true // Crítico para performance
        );

        // Verificar resultado do stress
        const stressSchedule = await this.api.get(`/api/plans/${largePlan.id}/schedule`);
        
        if (stressSchedule.data) {
            await this.log(`📊 Stress test: ${stressSchedule.data.length} sessões geradas`, 'SUCCESS');
            
            await this.assert(
                stressSchedule.data.length > 0,
                'Teste de stress deve gerar sessões',
                { sessionCount: stressSchedule.data.length },
                true
            );
        }
    }

    // 🎯 Executar todos os testes
    async runAllTests() {
        await this.log('🚀 Iniciando testes CRÍTICOS de geração de cronogramas...', 'INFO');
        await this.log(`⚠️  Ambiente: ${this.env} | Base URL: ${this.config.baseURL}`, 'WARNING');

        try {
            // Configuração
            await this.setupAuth();

            // Testes críticos do algoritmo
            await this.testBasicScheduleGeneration();
            await this.testComplexScheduleGeneration();
            await this.testSprintModeGeneration();
            await this.testScheduleRegeneration();
            await this.testTimezoneHandling();
            await this.testEdgeCasesAndErrorHandling();
            await this.testPerformanceStress();

            // Relatório final
            await this.generateReport();

        } catch (error) {
            await this.log(`💥 Erro crítico durante execução: ${error.message}`, 'CRITICAL');
            console.error(error.stack);
            process.exit(1);
        }
    }

    async generateReport() {
        await this.log('📊 Gerando relatório final de cronogramas...', 'INFO');
        
        const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
        const hasCriticalFailures = this.testResults.criticalFailures.length > 0;
        
        const reportData = {
            environment: this.env,
            timestamp: new Date().toISOString(),
            results: this.testResults,
            successRate: `${successRate}%`,
            criticalFailures: this.testResults.criticalFailures.length,
            recommendation: hasCriticalFailures ? 'ROLLBACK' : (successRate >= 95 ? 'PROCEED' : 'REVIEW')
        };

        console.log('\n' + '='.repeat(80));
        console.log('🎯 RELATÓRIO FINAL - TESTE DE GERAÇÃO DE CRONOGRAMAS');
        console.log('='.repeat(80));
        console.log(`🌍 Ambiente: ${this.env}`);
        console.log(`🔗 Base URL: ${this.config.baseURL}`);
        console.log(`📅 Executado em: ${reportData.timestamp}`);
        console.log('='.repeat(80));
        console.log(`📈 Total de testes: ${this.testResults.total}`);
        console.log(`✅ Testes passaram: ${this.testResults.passed}`);
        console.log(`❌ Testes falharam: ${this.testResults.failed}`);
        console.log(`💥 Falhas críticas: ${this.testResults.criticalFailures.length}`);
        console.log(`🎯 Taxa de sucesso: ${successRate}%`);
        console.log('='.repeat(80));

        if (this.testResults.criticalFailures.length > 0) {
            console.log('💥 FALHAS CRÍTICAS DETECTADAS:');
            this.testResults.criticalFailures.forEach((error, index) => {
                console.log(`\n${index + 1}. 🚨 ${error.message}`);
                console.log(`   💀 Erro: ${error.error}`);
                if (error.details) {
                    console.log(`   📊 Detalhes: ${JSON.stringify(error.details, null, 2)}`);
                }
            });
            console.log('='.repeat(80));
        }

        if (this.testResults.failed > 0 && this.testResults.criticalFailures.length === 0) {
            console.log('❌ FALHAS NÃO-CRÍTICAS:');
            const nonCriticalFailures = this.testResults.errors.filter(e => !e.critical);
            nonCriticalFailures.forEach((error, index) => {
                console.log(`\n${index + 1}. ${error.message}`);
                console.log(`   Erro: ${error.error}`);
            });
            console.log('='.repeat(80));
        }

        // Decisão final baseada em criticalidade
        let canProceed = false;
        let recommendation = '';

        if (hasCriticalFailures) {
            recommendation = '🚨 ROLLBACK IMEDIATO - Falhas críticas detectadas no algoritmo core!';
            await this.log('MIGRAÇÃO REJEITADA - Falhas críticas no algoritmo de cronogramas!', 'CRITICAL');
        } else if (successRate >= 98) {
            canProceed = true;
            recommendation = '🎉 MIGRAÇÃO APROVADA - Algoritmo de cronogramas funcionando perfeitamente!';
            await this.log('MIGRAÇÃO APROVADA - Algoritmo validado com sucesso!', 'SUCCESS');
        } else if (successRate >= 90) {
            recommendation = '⚠️ REVISAR - Algumas falhas não-críticas detectadas. Considere correções.';
            await this.log('MIGRAÇÃO COM RESSALVAS - Revisar falhas não-críticas', 'WARNING');
        } else {
            recommendation = '❌ REJEITAR - Taxa de sucesso muito baixa. Corrigir problemas antes de prosseguir.';
            await this.log('MIGRAÇÃO REJEITADA - Taxa de sucesso insuficiente!', 'ERROR');
        }

        console.log(`\n${recommendation}`);
        console.log('='.repeat(80) + '\n');

        // Salvar relatório crítico
        const reportFile = `test-report-schedules-${this.env}-${Date.now()}.json`;
        require('fs').writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        await this.log(`📄 Relatório crítico salvo em: ${reportFile}`, 'INFO');

        return canProceed;
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

    // PROTEÇÃO CRÍTICA
    if (env === 'production') {
        console.error('💥 ERRO FATAL: NUNCA execute testes de cronograma em produção!');
        console.error('🚨 O algoritmo de cronograma é crítico demais para testes destrutivos em produção!');
        process.exit(1);
    }

    console.log('⚠️⚠️⚠️ TESTE ULTRA-CRÍTICO ⚠️⚠️⚠️');
    console.log('🎯 Testando o coração do sistema Editaliza');
    console.log('📊 Algoritmo de 700+ linhas será validado');
    console.log('⏱️ Pode demorar vários minutos...\n');

    const tester = new SchedulesMigrationTester(env);
    const success = await tester.runAllTests();
    
    process.exit(success ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erro fatal no teste de cronogramas:', error);
        process.exit(1);
    });
}

module.exports = { SchedulesMigrationTester };