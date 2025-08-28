/**
 * 🧪 TESTE DE MIGRAÇÃO - PLANOS DE ESTUDO
 * 
 * Este script testa especificamente a migração do módulo de planos,
 * incluindo operações críticas como cascading deletes e transações.
 * 
 * ⚠️ CRÍTICO: Execute apenas em ambiente de desenvolvimento/teste!
 * 
 * Uso:
 * node test-plans-migration.js --env=development
 * node test-plans-migration.js --env=test --verbose
 */

const axios = require('axios');
const assert = require('assert');
const { performance } = require('perf_hooks');

// Configuração baseada no ambiente
const CONFIG = {
    development: {
        baseURL: 'http://localhost:3000',
        timeout: 10000,
        dbReset: true
    },
    test: {
        baseURL: 'http://localhost:3000',
        timeout: 5000,
        dbReset: true
    },
    staging: {
        baseURL: 'https://staging.editaliza.com.br',
        timeout: 15000,
        dbReset: false
    }
};

class PlansMigrationTester {
    constructor(env = 'development') {
        this.env = env;
        this.config = CONFIG[env];
        this.api = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true // Não lançar erro em status HTTP != 2xx
        });
        
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
        
        this.testUser = null;
        this.authToken = null;
        this.testPlan = null;
    }

    // 🎯 Utilitários de teste
    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            'INFO': '\x1b[34m',    // Azul
            'SUCCESS': '\x1b[32m', // Verde  
            'WARNING': '\x1b[33m', // Amarelo
            'ERROR': '\x1b[31m',   // Vermelho
            'RESET': '\x1b[0m'
        };
        
        console.log(`${colors[level]}[${timestamp}] ${level}: ${message}${colors.RESET}`);
    }

    async assert(condition, message, details = null) {
        this.testResults.total++;
        
        try {
            assert(condition, message);
            this.testResults.passed++;
            await this.log(`✅ PASSOU: ${message}`, 'SUCCESS');
        } catch (error) {
            this.testResults.failed++;
            this.testResults.errors.push({
                message,
                error: error.message,
                details
            });
            await this.log(`❌ FALHOU: ${message} - ${error.message}`, 'ERROR');
            if (details) {
                await this.log(`   Detalhes: ${JSON.stringify(details, null, 2)}`, 'ERROR');
            }
        }
    }

    async measureTime(operation, name) {
        const start = performance.now();
        const result = await operation();
        const end = performance.now();
        const duration = Math.round(end - start);
        
        await this.log(`⏱️ ${name}: ${duration}ms`, 'INFO');
        return { result, duration };
    }

    // 🔐 Configuração de autenticação
    async setupAuth() {
        await this.log('Configurando autenticação de teste...', 'INFO');
        
        // Criar usuário de teste
        const registerData = {
            name: `Teste Migration ${Date.now()}`,
            email: `test-migration-${Date.now()}@test.com`,
            password: 'TestPassword123!',
            confirmPassword: 'TestPassword123!'
        };

        const registerResponse = await this.api.post('/api/register', registerData);
        
        await this.assert(
            [200, 201].includes(registerResponse.status),
            'Registro de usuário de teste deve ser bem-sucedido',
            { status: registerResponse.status, data: registerResponse.data }
        );

        // Fazer login
        const loginResponse = await this.api.post('/api/login', {
            email: registerData.email,
            password: registerData.password
        });

        await this.assert(
            loginResponse.status === 200 && loginResponse.data.token,
            'Login deve retornar token válido',
            { status: loginResponse.status }
        );

        this.authToken = loginResponse.data.token;
        this.testUser = loginResponse.data.user;
        
        // Configurar token para próximas requisições
        this.api.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
        
        await this.log(`Usuário de teste criado: ${this.testUser.id}`, 'SUCCESS');
    }

    // 📚 Testes específicos de planos
    async testPlansCrud() {
        await this.log('🧪 Iniciando testes de CRUD de planos...', 'INFO');

        // 1. Teste GET /api/plans (lista vazia)
        const { result: getEmptyResponse } = await this.measureTime(
            () => this.api.get('/api/plans'),
            'GET /api/plans (vazia)'
        );

        await this.assert(
            getEmptyResponse.status === 200 && Array.isArray(getEmptyResponse.data),
            'GET /api/plans deve retornar array vazio para usuário novo',
            { status: getEmptyResponse.status, data: getEmptyResponse.data }
        );

        // 2. Teste POST /api/plans (criar plano)
        const planData = {
            name: 'Plano de Teste Migration',
            description: 'Plano criado para testar migração',
            examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 dias
            studyHoursPerDay: 4,
            studyDaysPerWeek: 5,
            isWeekendStudy: true,
            weekendHours: 6
        };

        const { result: createResponse } = await this.measureTime(
            () => this.api.post('/api/plans', planData),
            'POST /api/plans (criar)'
        );

        await this.assert(
            createResponse.status === 201 && createResponse.data.id,
            'POST /api/plans deve criar plano com ID válido',
            { status: createResponse.status, data: createResponse.data }
        );

        this.testPlan = createResponse.data;
        const planId = this.testPlan.id;

        // 3. Teste GET /api/plans/:planId (buscar específico)
        const { result: getSpecificResponse } = await this.measureTime(
            () => this.api.get(`/api/plans/${planId}`),
            'GET /api/plans/:planId'
        );

        await this.assert(
            getSpecificResponse.status === 200 && getSpecificResponse.data.id === planId,
            'GET /api/plans/:planId deve retornar plano específico',
            { status: getSpecificResponse.status, planId }
        );

        // 4. Teste GET /api/plans (lista com 1 item)
        const { result: getWithItemsResponse } = await this.measureTime(
            () => this.api.get('/api/plans'),
            'GET /api/plans (com itens)'
        );

        await this.assert(
            getWithItemsResponse.status === 200 && 
            getWithItemsResponse.data.length === 1 &&
            getWithItemsResponse.data[0].id === planId,
            'GET /api/plans deve retornar lista com 1 plano',
            { status: getWithItemsResponse.status, count: getWithItemsResponse.data.length }
        );

        // 5. Teste PATCH /api/plans/:planId/settings (atualizar)
        const updateData = {
            studyHoursPerDay: 6,
            studyDaysPerWeek: 6,
            isWeekendStudy: false
        };

        const { result: updateResponse } = await this.measureTime(
            () => this.api.patch(`/api/plans/${planId}/settings`, updateData),
            'PATCH /api/plans/:planId/settings'
        );

        await this.assert(
            updateResponse.status === 200 && 
            updateResponse.data.studyHoursPerDay === 6,
            'PATCH /api/plans/:planId/settings deve atualizar configurações',
            { status: updateResponse.status, data: updateResponse.data }
        );
    }

    async testPlansSecurity() {
        await this.log('🛡️ Testando segurança de planos...', 'INFO');

        // 1. Teste acesso sem token
        const noTokenApi = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true
        });

        const { result: noTokenResponse } = await this.measureTime(
            () => noTokenApi.get('/api/plans'),
            'GET /api/plans (sem token)'
        );

        await this.assert(
            noTokenResponse.status === 401,
            'Acesso sem token deve retornar 401',
            { status: noTokenResponse.status }
        );

        // 2. Teste acesso a plano inexistente
        const fakeId = 99999;
        const { result: notFoundResponse } = await this.measureTime(
            () => this.api.get(`/api/plans/${fakeId}`),
            'GET /api/plans/:planId (inexistente)'
        );

        await this.assert(
            notFoundResponse.status === 404,
            'Acesso a plano inexistente deve retornar 404',
            { status: notFoundResponse.status }
        );

        // 3. Teste dados inválidos na criação
        const invalidData = {
            name: '', // Nome vazio
            examDate: 'invalid-date', // Data inválida
            studyHoursPerDay: -1 // Valor negativo
        };

        const { result: invalidResponse } = await this.measureTime(
            () => this.api.post('/api/plans', invalidData),
            'POST /api/plans (dados inválidos)'
        );

        await this.assert(
            invalidResponse.status === 400,
            'Dados inválidos na criação devem retornar 400',
            { status: invalidResponse.status }
        );
    }

    async testPlansCascadingDelete() {
        await this.log('🗑️ Testando cascading delete crítico...', 'WARNING');
        
        if (!this.testPlan || !this.testPlan.id) {
            await this.log('❌ Pulando teste de delete - plano não disponível', 'ERROR');
            return;
        }

        const planId = this.testPlan.id;

        // Primeiro, vamos adicionar alguns dados relacionados para testar o cascading
        // (Em um teste real, adicionaríamos disciplinas, tópicos, sessões)
        
        // Simular adição de disciplinas
        const subjectData = {
            name: 'Matemática Teste',
            weight: 3,
            color: '#FF5733'
        };

        const subjectResponse = await this.api.post(`/api/plans/${planId}/subjects_with_topics`, {
            subjects: [subjectData]
        });

        if (subjectResponse.status === 201) {
            await this.log('✅ Disciplina de teste adicionada ao plano', 'SUCCESS');
        }

        // Agora testar o delete cascading
        const { result: deleteResponse, duration } = await this.measureTime(
            () => this.api.delete(`/api/plans/${planId}`),
            'DELETE /api/plans/:planId (cascading)'
        );

        await this.assert(
            deleteResponse.status === 200 || deleteResponse.status === 204,
            'DELETE cascading deve ser bem-sucedido',
            { status: deleteResponse.status, duration }
        );

        // Performance check: cascading delete deve ser rápido
        await this.assert(
            duration < 5000, // 5 segundos
            'DELETE cascading deve completar em menos de 5 segundos',
            { duration }
        );

        // Verificar que o plano foi realmente removido
        const { result: verifyDeleteResponse } = await this.measureTime(
            () => this.api.get(`/api/plans/${planId}`),
            'Verificar plano deletado'
        );

        await this.assert(
            verifyDeleteResponse.status === 404,
            'Plano deletado não deve mais existir',
            { status: verifyDeleteResponse.status }
        );

        // Verificar que a lista está vazia novamente
        const { result: emptyListResponse } = await this.measureTime(
            () => this.api.get('/api/plans'),
            'Verificar lista vazia após delete'
        );

        await this.assert(
            emptyListResponse.status === 200 && 
            emptyListResponse.data.length === 0,
            'Lista de planos deve estar vazia após delete',
            { status: emptyListResponse.status, count: emptyListResponse.data.length }
        );

        this.testPlan = null; // Plano foi deletado
    }

    async testPlansPerformance() {
        await this.log('⚡ Testando performance de planos...', 'INFO');

        // 1. Criar múltiplos planos para testar performance
        const plansToCreate = 5;
        const createdPlans = [];

        for (let i = 0; i < plansToCreate; i++) {
            const planData = {
                name: `Plano Performance ${i + 1}`,
                description: `Plano para teste de performance ${i + 1}`,
                examDate: new Date(Date.now() + (30 + i * 10) * 24 * 60 * 60 * 1000).toISOString(),
                studyHoursPerDay: 3 + i,
                studyDaysPerWeek: 5,
                isWeekendStudy: i % 2 === 0
            };

            const { result: createResponse, duration } = await this.measureTime(
                () => this.api.post('/api/plans', planData),
                `Criar plano ${i + 1}`
            );

            await this.assert(
                createResponse.status === 201,
                `Criação do plano ${i + 1} deve ser bem-sucedida`,
                { status: createResponse.status }
            );

            await this.assert(
                duration < 2000, // 2 segundos
                `Criação do plano ${i + 1} deve ser rápida (< 2s)`,
                { duration }
            );

            if (createResponse.status === 201) {
                createdPlans.push(createResponse.data);
            }
        }

        // 2. Testar performance da listagem
        const { result: listResponse, duration: listDuration } = await this.measureTime(
            () => this.api.get('/api/plans'),
            'GET /api/plans (múltiplos planos)'
        );

        await this.assert(
            listResponse.status === 200 && 
            listResponse.data.length === plansToCreate,
            'Listagem deve retornar todos os planos criados',
            { status: listResponse.status, count: listResponse.data.length, expected: plansToCreate }
        );

        await this.assert(
            listDuration < 1000, // 1 segundo
            'Listagem de planos deve ser rápida (< 1s)',
            { duration: listDuration }
        );

        // 3. Limpar planos criados
        for (const plan of createdPlans) {
            await this.api.delete(`/api/plans/${plan.id}`);
        }

        await this.log(`✅ ${createdPlans.length} planos de teste removidos`, 'SUCCESS');
    }

    async testPlansEdgeCases() {
        await this.log('🔍 Testando edge cases de planos...', 'INFO');

        // 1. Teste com data de exame no passado
        const pastExamData = {
            name: 'Plano Data Passada',
            description: 'Teste com data no passado',
            examDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias atrás
            studyHoursPerDay: 4,
            studyDaysPerWeek: 5
        };

        const { result: pastExamResponse } = await this.measureTime(
            () => this.api.post('/api/plans', pastExamData),
            'POST com data no passado'
        );

        await this.assert(
            pastExamResponse.status === 400,
            'Data de exame no passado deve ser rejeitada',
            { status: pastExamResponse.status }
        );

        // 2. Teste com valores extremos
        const extremeData = {
            name: 'Plano Extremo',
            description: 'Teste com valores extremos',
            examDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 ano
            studyHoursPerDay: 24, // 24 horas por dia (impossível)
            studyDaysPerWeek: 8 // 8 dias por semana (impossível)
        };

        const { result: extremeResponse } = await this.measureTime(
            () => this.api.post('/api/plans', extremeData),
            'POST com valores extremos'
        );

        await this.assert(
            extremeResponse.status === 400,
            'Valores extremos devem ser rejeitados',
            { status: extremeResponse.status }
        );

        // 3. Teste com string muito longa
        const longStringData = {
            name: 'A'.repeat(1000), // String muito longa
            description: 'B'.repeat(5000), // Descrição muito longa
            examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            studyHoursPerDay: 4,
            studyDaysPerWeek: 5
        };

        const { result: longStringResponse } = await this.measureTime(
            () => this.api.post('/api/plans', longStringData),
            'POST com strings muito longas'
        );

        await this.assert(
            longStringResponse.status === 400,
            'Strings muito longas devem ser rejeitadas',
            { status: longStringResponse.status }
        );
    }

    // 🎯 Executar todos os testes
    async runAllTests() {
        await this.log('🚀 Iniciando testes de migração de planos...', 'INFO');
        await this.log(`Ambiente: ${this.env} | Base URL: ${this.config.baseURL}`, 'INFO');

        try {
            // Configuração
            await this.setupAuth();

            // Testes principais
            await this.testPlansCrud();
            await this.testPlansSecurity();
            await this.testPlansCascadingDelete();
            await this.testPlansPerformance();
            await this.testPlansEdgeCases();

            // Relatório final
            await this.generateReport();

        } catch (error) {
            await this.log(`❌ Erro crítico durante execução: ${error.message}`, 'ERROR');
            process.exit(1);
        }
    }

    async generateReport() {
        await this.log('📊 Gerando relatório final...', 'INFO');
        
        const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
        const reportData = {
            environment: this.env,
            timestamp: new Date().toISOString(),
            results: this.testResults,
            successRate: `${successRate}%`
        };

        console.log('\n' + '='.repeat(80));
        console.log('📊 RELATÓRIO FINAL - TESTE DE MIGRAÇÃO DE PLANOS');
        console.log('='.repeat(80));
        console.log(`🌍 Ambiente: ${this.env}`);
        console.log(`🔗 Base URL: ${this.config.baseURL}`);
        console.log(`📅 Executado em: ${reportData.timestamp}`);
        console.log('='.repeat(80));
        console.log(`📈 Total de testes: ${this.testResults.total}`);
        console.log(`✅ Testes passaram: ${this.testResults.passed}`);
        console.log(`❌ Testes falharam: ${this.testResults.failed}`);
        console.log(`🎯 Taxa de sucesso: ${successRate}%`);
        console.log('='.repeat(80));

        if (this.testResults.failed > 0) {
            console.log('❌ FALHAS DETECTADAS:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`\n${index + 1}. ${error.message}`);
                console.log(`   Erro: ${error.error}`);
                if (error.details) {
                    console.log(`   Detalhes: ${JSON.stringify(error.details, null, 2)}`);
                }
            });
            console.log('='.repeat(80));
        }

        // Determinar se a migração pode prosseguir
        const canProceed = successRate >= 95 && this.testResults.failed === 0;
        
        if (canProceed) {
            await this.log('🎉 MIGRAÇÃO APROVADA - Todos os testes críticos passaram!', 'SUCCESS');
            console.log('\n✅ RECOMENDAÇÃO: PROSSEGUIR COM A MIGRAÇÃO');
        } else {
            await this.log('🚨 MIGRAÇÃO REJEITADA - Falhas críticas detectadas!', 'ERROR');
            console.log('\n❌ RECOMENDAÇÃO: CORRIGIR PROBLEMAS ANTES DE PROSSEGUIR');
        }

        console.log('='.repeat(80) + '\n');

        // Salvar relatório em arquivo
        const reportFile = `test-report-plans-${this.env}-${Date.now()}.json`;
        require('fs').writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        await this.log(`📄 Relatório salvo em: ${reportFile}`, 'INFO');

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

    // Verificação de segurança
    if (env === 'production') {
        console.error('❌ ERRO: Não execute testes destrutivos em produção!');
        process.exit(1);
    }

    const tester = new PlansMigrationTester(env);
    const success = await tester.runAllTests();
    
    process.exit(success ? 0 : 1);
}

// Executar se chamado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erro fatal:', error);
        process.exit(1);
    });
}

module.exports = { PlansMigrationTester };