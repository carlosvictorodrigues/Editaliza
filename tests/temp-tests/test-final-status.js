/**
 * TESTE COMPLETO DO SISTEMA EDITALIZA
 * Testa todos os fluxos críticos para identificar problemas na modularização
 */

const axios = require('axios');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:3000';

// Configuração do usuário de teste
const testUser = {
    email: 'teste.sistema@editaliza.com',
    password: '123456789',
    name: 'Teste Sistema'
};

const testPlan = {
    plan_name: 'Teste Funcionalidades',
    exam_date: '2025-12-31'
};

const testSubject = {
    subject_name: 'Matemática',
    priority_weight: 3,
    topics_list: ['Álgebra', 'Geometria', 'Trigonometria']
};

class SystemTester {
    constructor() {
        this.token = null;
        this.planId = null;
        this.results = {};
    }

    async log(step, result, details = null) {
        const status = result ? '✅ PASSOU' : '❌ FALHOU';
        console.log(`${status} - ${step}`);
        
        if (details) {
            console.log(`   Detalhes: ${JSON.stringify(details, null, 2)}`);
        }
        
        this.results[step] = { passed: result, details };
    }

    async testRegistration() {
        try {
            console.log('\n=== TESTE 1: REGISTRO DE USUÁRIO ===');
            
            const response = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
            
            if (response.data.success && response.data.token) {
                this.token = response.data.token;
                await this.log('Registro de usuário', true, {
                    userId: response.data.user?.id,
                    token: response.data.token ? 'GERADO' : 'NÃO GERADO'
                });
                return true;
            } else {
                await this.log('Registro de usuário', false, response.data);
                return false;
            }
            
        } catch (error) {
            await this.log('Registro de usuário', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async testLogin() {
        try {
            console.log('\n=== TESTE 2: LOGIN DE USUÁRIO ===');
            
            const response = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testUser.email,
                password: testUser.password
            });
            
            if (response.data.success && response.data.token) {
                this.token = response.data.token;
                await this.log('Login de usuário', true, {
                    userId: response.data.user?.id,
                    token: response.data.token ? 'VÁLIDO' : 'INVÁLIDO'
                });
                return true;
            } else {
                await this.log('Login de usuário', false, response.data);
                return false;
            }
            
        } catch (error) {
            await this.log('Login de usuário', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async testCreatePlan() {
        try {
            console.log('\n=== TESTE 3: CRIAÇÃO DE PLANO ===');
            
            const response = await axios.post(`${BASE_URL}/api/plans`, testPlan, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            
            console.log('\n🔍 DEBUG - Resposta completa do plano:', JSON.stringify(response.data, null, 2));
            
            // Tentar extrair o planId de várias formas possíveis
            const planId = response.data.newPlanId || response.data.planId || response.data.id;
            
            if (planId) {
                this.planId = planId;
                await this.log('Criação de plano', true, {
                    planId: this.planId,
                    message: response.data.message
                });
                return true;
            } else {
                await this.log('Criação de plano', false, {
                    responseData: response.data,
                    expectedField: 'newPlanId',
                    message: 'ID do plano não encontrado na resposta'
                });
                return false;
            }
            
        } catch (error) {
            await this.log('Criação de plano', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message,
                fullError: error.response?.data
            });
            return false;
        }
    }

    async testCreateSubject() {
        try {
            console.log('\n=== TESTE 4: CRIAÇÃO DE DISCIPLINA ===');
            
            const response = await axios.post(
                `${BASE_URL}/api/plans/${this.planId}/subjects_with_topics`, 
                testSubject,
                { headers: { Authorization: `Bearer ${this.token}` } }
            );
            
            if (response.data.success !== false) {
                await this.log('Criação de disciplina', true, {
                    message: response.data.message || 'Disciplina criada'
                });
                return true;
            } else {
                await this.log('Criação de disciplina', false, response.data);
                return false;
            }
            
        } catch (error) {
            await this.log('Criação de disciplina', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async testGenerateSchedule() {
        try {
            console.log('\n=== TESTE 5: GERAÇÃO DE CRONOGRAMA ===');
            
            const scheduleConfig = {
                daily_question_goal: 50,
                weekly_question_goal: 300,
                session_duration_minutes: 50,
                study_hours_per_day: {
                    '0': 0, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4
                },
                has_essay: false,
                reta_final_mode: false
            };
            
            const response = await axios.post(
                `${BASE_URL}/api/plans/${this.planId}/generate`, 
                scheduleConfig,
                { headers: { Authorization: `Bearer ${this.token}` } }
            );
            
            if (response.data.success && response.data.performance) {
                await this.log('Geração de cronograma', true, {
                    sessionsCreated: response.data.performance.sessionsCreated,
                    executionTime: response.data.performance.executionTime
                });
                return true;
            } else {
                await this.log('Geração de cronograma', false, response.data);
                return false;
            }
            
        } catch (error) {
            await this.log('Geração de cronograma', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async testGetSchedule() {
        try {
            console.log('\n=== TESTE 6: CONSULTA DE CRONOGRAMA ===');
            
            const response = await axios.get(
                `${BASE_URL}/api/plans/${this.planId}/schedule`,
                { headers: { Authorization: `Bearer ${this.token}` } }
            );
            
            if (response.data && Object.keys(response.data).length > 0) {
                await this.log('Consulta de cronograma', true, {
                    datesCount: Object.keys(response.data).length
                });
                return true;
            } else {
                await this.log('Consulta de cronograma', false, 'Cronograma vazio');
                return false;
            }
            
        } catch (error) {
            await this.log('Consulta de cronograma', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async testHealthCheck() {
        try {
            console.log('\n=== TESTE 7: HEALTH CHECK ===');
            
            const response = await axios.get(`${BASE_URL}/health`);
            
            if (response.data.status === 'healthy') {
                await this.log('Health check', true, response.data);
                return true;
            } else {
                await this.log('Health check', false, response.data);
                return false;
            }
            
        } catch (error) {
            await this.log('Health check', false, {
                status: error.response?.status,
                message: error.response?.data?.error || error.message
            });
            return false;
        }
    }

    async runAllTests() {
        console.log('🧪 INICIANDO TESTES COMPLETOS DO SISTEMA EDITALIZA');
        console.log('=' .repeat(60));
        
        const startTime = Date.now();
        
        // Executar testes em sequência
        const testResults = [
            await this.testHealthCheck(),
            await this.testRegistration() || await this.testLogin(), // Tentar registro, senão login
            await this.testCreatePlan(),
            await this.testCreateSubject(),
            await this.testGenerateSchedule(),
            await this.testGetSchedule()
        ];
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        // Resumo dos resultados
        console.log('\n' + '=' .repeat(60));
        console.log('📊 RESUMO DOS TESTES');
        console.log('=' .repeat(60));
        
        const passed = testResults.filter(r => r).length;
        const total = testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log(`✅ Testes passou: ${passed}/${total} (${percentage}%)`);
        console.log(`⏱️  Tempo de execução: ${executionTime}ms`);
        console.log(`🎯 Status do sistema: ${percentage >= 80 ? 'FUNCIONAL' : 'COM PROBLEMAS'}`);
        
        if (percentage < 80) {
            console.log('\n❌ PROBLEMAS IDENTIFICADOS:');
            Object.entries(this.results).forEach(([test, result]) => {
                if (!result.passed) {
                    console.log(`   - ${test}: ${JSON.stringify(result.details)}`);
                }
            });
        }
        
        console.log('\n' + '=' .repeat(60));
        
        return {
            passed,
            total,
            percentage,
            executionTime,
            details: this.results
        };
    }
}

// Executar testes
async function main() {
    const tester = new SystemTester();
    
    try {
        const results = await tester.runAllTests();
        
        // Salvar resultados em arquivo
        const fs = require('fs');
        const resultsFile = `teste-completo-resultados-${Date.now()}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`📄 Resultados salvos em: ${resultsFile}`);
        
        // Exit com código baseado no sucesso
        process.exit(results.percentage >= 80 ? 0 : 1);
        
    } catch (error) {
        console.error('💥 ERRO CRÍTICO:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { SystemTester };