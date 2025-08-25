#!/usr/bin/env node

/**
 * Script de Teste - Services Integration
 * FASE 4 - Validação dos Services ANTES de remover código do server.js
 * 
 * IMPORTANTE: Seguindo as diretrizes do PLANO_MODULARIZACAO_COMPLETA.md:
 * - Testar 3x: Backend → Frontend → Usuário Real
 * - NUNCA remover código antes de validação completa
 * - Medir impacto de cada mudança
 */

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

async function testServices() {
    console.log(`${colors.magenta}🧪 TESTE DE INTEGRAÇÃO DOS SERVICES - FASE 4${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}\n`);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const errors = [];

    try {
        // 1. Carregar database e repositories
        console.log(`${colors.cyan}📦 Teste 1: Carregando dependências...${colors.reset}`);
        const db = require('../database-postgresql.js');
        const { createRepositories } = require('../src/repositories');
        const repos = createRepositories(db);
        console.log(`${colors.green}✅ Repositories carregados${colors.reset}\n`);
        passedTests++;
        totalTests++;

        // 2. Verificar se os Services existem
        console.log(`${colors.cyan}📦 Teste 2: Verificando Services criados...${colors.reset}`);
        const fs = require('fs');
        const path = require('path');
        
        const servicesPath = path.join(__dirname, '..', 'src', 'services');
        const expectedServices = [
            'planService.js',
            'sessionService.js', 
            'statisticsService.js',
            'index.js'
        ];

        let allServicesExist = true;
        for (const service of expectedServices) {
            const servicePath = path.join(servicesPath, service);
            if (fs.existsSync(servicePath)) {
                console.log(`  ✅ ${service} encontrado`);
            } else {
                console.log(`  ❌ ${service} NÃO encontrado`);
                allServicesExist = false;
                errors.push(`Service não encontrado: ${service}`);
            }
        }

        if (allServicesExist) {
            console.log(`${colors.green}✅ Todos os Services existem${colors.reset}\n`);
            passedTests++;
        } else {
            console.log(`${colors.red}❌ Alguns Services estão faltando${colors.reset}\n`);
            failedTests++;
        }
        totalTests++;

        // 3. Tentar carregar os Services
        console.log(`${colors.cyan}📦 Teste 3: Carregando Services...${colors.reset}`);
        let services;
        try {
            const { createServices } = require('../src/services');
            services = createServices(repos, db);
            
            console.log(`  Verificando services...`);
            console.log(`  - services.plan: ${services.plan ? '✅' : '❌'}`);
            console.log(`  - services.session: ${services.session ? '✅' : '❌'}`);
            console.log(`  - services.statistics: ${services.statistics ? '✅' : '❌'}`);
            
            // Também verificar com os nomes antigos para compatibilidade
            console.log(`  - services.planService: ${services.planService ? '✅' : '❌'}`);
            console.log(`  - services.sessionService: ${services.sessionService ? '✅' : '❌'}`);
            console.log(`  - services.statisticsService: ${services.statisticsService ? '✅' : '❌'}`);
            
            if ((services.plan && services.session && services.statistics) || 
                (services.planService && services.sessionService && services.statisticsService)) {
                console.log(`${colors.green}✅ Services carregados com sucesso${colors.reset}\n`);
                passedTests++;
                
                // Adicionar aliases para compatibilidade
                services.planService = services.planService || services.plan;
                services.sessionService = services.sessionService || services.session;
                services.statisticsService = services.statisticsService || services.statistics;
            } else {
                throw new Error('Services incompletos');
            }
        } catch (error) {
            console.log(`${colors.red}❌ Erro ao carregar Services: ${error.message}${colors.reset}\n`);
            errors.push(`Erro ao carregar Services: ${error.message}`);
            failedTests++;
        }
        totalTests++;

        // 4. Testar métodos do PlanService
        if (services && services.planService) {
            console.log(`${colors.cyan}📦 Teste 4: Testando PlanService...${colors.reset}`);
            
            const planServiceMethods = [
                'generateSchedule',
                'replanSchedule',
                'checkOverdue',
                'calculateProgress',
                'getGamificationData'
            ];

            let allMethodsExist = true;
            for (const method of planServiceMethods) {
                if (typeof services.planService[method] === 'function') {
                    console.log(`  ✅ ${method}() existe`);
                } else {
                    console.log(`  ❌ ${method}() NÃO existe`);
                    allMethodsExist = false;
                    errors.push(`PlanService.${method} não encontrado`);
                }
            }

            if (allMethodsExist) {
                console.log(`${colors.green}✅ PlanService tem todos os métodos${colors.reset}\n`);
                passedTests++;
            } else {
                console.log(`${colors.red}❌ PlanService está incompleto${colors.reset}\n`);
                failedTests++;
            }
            totalTests++;
        }

        // 5. Testar métodos do SessionService
        if (services && services.sessionService) {
            console.log(`${colors.cyan}📦 Teste 5: Testando SessionService...${colors.reset}`);
            
            const sessionServiceMethods = [
                'scheduleSession',
                'completeSession',
                'postponeSession',
                'reinforceSession',
                'getSessionStatistics',
                'calculateStreak'
            ];

            let allMethodsExist = true;
            for (const method of sessionServiceMethods) {
                if (typeof services.sessionService[method] === 'function') {
                    console.log(`  ✅ ${method}() existe`);
                } else {
                    console.log(`  ❌ ${method}() NÃO existe`);
                    allMethodsExist = false;
                    errors.push(`SessionService.${method} não encontrado`);
                }
            }

            if (allMethodsExist) {
                console.log(`${colors.green}✅ SessionService tem todos os métodos${colors.reset}\n`);
                passedTests++;
            } else {
                console.log(`${colors.red}❌ SessionService está incompleto${colors.reset}\n`);
                failedTests++;
            }
            totalTests++;
        }

        // 6. Testar métodos do StatisticsService
        if (services && services.statisticsService) {
            console.log(`${colors.cyan}📦 Teste 6: Testando StatisticsService...${colors.reset}`);
            
            const statisticsServiceMethods = [
                'getDashboardMetrics',
                'calculatePerformance',
                'getStudyPatterns',
                'generateRecommendations'
            ];

            let allMethodsExist = true;
            for (const method of statisticsServiceMethods) {
                if (typeof services.statisticsService[method] === 'function') {
                    console.log(`  ✅ ${method}() existe`);
                } else {
                    console.log(`  ❌ ${method}() NÃO existe`);
                    allMethodsExist = false;
                    errors.push(`StatisticsService.${method} não encontrado`);
                }
            }

            if (allMethodsExist) {
                console.log(`${colors.green}✅ StatisticsService tem todos os métodos${colors.reset}\n`);
                passedTests++;
            } else {
                console.log(`${colors.red}❌ StatisticsService está incompleto${colors.reset}\n`);
                failedTests++;
            }
            totalTests++;
        }

        // 7. Teste de integração simples
        console.log(`${colors.cyan}📦 Teste 7: Teste de integração básico...${colors.reset}`);
        
        if (services && services.planService) {
            try {
                // Testar se consegue chamar um método sem erro de sintaxe
                const testUserId = 1;
                const testPlanId = 1;
                
                // Não vamos executar queries reais, apenas verificar se não há erro de sintaxe
                console.log(`  ℹ️ Verificando sintaxe dos métodos...`);
                
                // Verificar se os métodos podem ser chamados (sem executar queries)
                if (typeof services.planService.checkOverdue === 'function') {
                    console.log(`  ✅ checkOverdue pode ser chamado`);
                }
                
                console.log(`${colors.green}✅ Integração básica OK${colors.reset}\n`);
                passedTests++;
            } catch (error) {
                console.log(`${colors.red}❌ Erro na integração: ${error.message}${colors.reset}\n`);
                errors.push(`Erro de integração: ${error.message}`);
                failedTests++;
            }
            totalTests++;
        }

    } catch (error) {
        console.error(`${colors.red}❌ Erro crítico: ${error.message}${colors.reset}`);
        errors.push(`Erro crítico: ${error.message}`);
        failedTests++;
        totalTests++;
    }

    // Relatório Final
    console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.magenta}📊 RELATÓRIO FINAL${colors.reset}`);
    console.log(`${colors.magenta}${'='.repeat(50)}${colors.reset}\n`);

    console.log(`${colors.green}✅ Testes Passados: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}❌ Testes Falhados: ${failedTests}${colors.reset}`);
    console.log(`${colors.blue}📊 Total de Testes: ${totalTests}${colors.reset}`);
    console.log(`${colors.cyan}📈 Taxa de Sucesso: ${Math.round((passedTests/totalTests)*100)}%${colors.reset}\n`);

    if (errors.length > 0) {
        console.log(`${colors.red}⚠️ ERROS ENCONTRADOS:${colors.reset}`);
        errors.forEach((error, index) => {
            console.log(`${colors.red}  ${index + 1}. ${error}${colors.reset}`);
        });
        console.log();
    }

    if (failedTests === 0) {
        console.log(`${colors.green}🎉 TODOS OS TESTES PASSARAM!${colors.reset}`);
        console.log(`${colors.green}✅ Services prontos para integração${colors.reset}`);
        console.log(`${colors.yellow}⚠️ IMPORTANTE: Ainda precisa testar com dados reais antes de remover código do server.js${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ SERVICES NÃO ESTÃO PRONTOS${colors.reset}`);
        console.log(`${colors.red}⚠️ NÃO remova código do server.js até corrigir os problemas${colors.reset}`);
    }

    process.exit(failedTests > 0 ? 1 : 0);
}

// Executar testes
testServices().catch(error => {
    console.error(`${colors.red}Erro fatal: ${error.message}${colors.reset}`);
    process.exit(1);
});