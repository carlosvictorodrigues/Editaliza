/**
 * @file tests/fortress/fortress-utils.js
 * @description Utilitários avançados para a Testing Fortress
 * @version 1.0.0
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { performance } = require('perf_hooks');
const FortressConfig = require('./fortress-config');

class FortressUtils {
    constructor() {
        this.testData = new Map();
        this.timers = new Map();
        this.cleanup = [];
    }

    // ============================================================================
    // GESTÃO DE DADOS DE TESTE
    // ============================================================================

    /**
     * Cria dados de teste únicos e rastreáveis
     */
    createTestData(category, data = {}) {
        const id = `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const testData = {
            id,
            category,
            createdAt: new Date().toISOString(),
            ...data
        };
        
        this.testData.set(id, testData);
        return testData;
    }

    /**
     * Cria usuário de teste com dados realísticos
     */
    async createTestUser(customData = {}) {
        const timestamp = Date.now();
        const userData = {
            email: `test_${timestamp}@editaliza.fortress.test`,
            password: 'FortressTest123!',
            firstName: 'Test',
            lastName: 'User',
            ...customData
        };

        const testData = this.createTestData('user', userData);
        this.addCleanup(() => this.cleanupUser(testData.id));
        
        return testData;
    }

    /**
     * Cria sessão de estudo de teste
     */
    createTestSession(userId, planId = 1) {
        const sessionData = {
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            planId,
            disciplineId: 1,
            duration: 50,
            startedAt: new Date().toISOString(),
            status: 'active'
        };

        const testData = this.createTestData('session', sessionData);
        this.addCleanup(() => this.cleanupSession(testData.sessionId));
        
        return testData;
    }

    /**
     * Cria plano de estudos de teste
     */
    createTestPlan(userId) {
        const planData = {
            name: `Plano Fortress Test ${Date.now()}`,
            userId,
            disciplines: [
                { name: 'Português', weight: 3 },
                { name: 'Matemática', weight: 4 },
                { name: 'Direito', weight: 5 }
            ],
            totalHours: 100,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        };

        return this.createTestData('plan', planData);
    }

    // ============================================================================
    // GESTÃO DE AUTENTICAÇÃO
    // ============================================================================

    /**
     * Registra usuário e retorna dados completos
     */
    async registerUser(app, userData) {
        const response = await request(app)
            .post('/register')
            .send(userData)
            .expect(201);

        return {
            response,
            userData,
            id: response.body.user?.id
        };
    }

    /**
     * Faz login e retorna token JWT
     */
    async loginUser(app, userData) {
        const response = await request(app)
            .post('/login')
            .send(userData)
            .expect(200);

        return {
            response,
            token: response.body.token,
            user: response.body.user
        };
    }

    /**
     * Cria usuário completo (registro + login)
     */
    async createAuthenticatedUser(app, customData = {}) {
        const userData = await this.createTestUser(customData);
        const registrationResult = await this.registerUser(app, userData);
        const loginResult = await this.loginUser(app, userData);

        return {
            userData,
            registration: registrationResult,
            login: loginResult,
            token: loginResult.token
        };
    }

    /**
     * Cria requisição autenticada
     */
    authenticatedRequest(app, method, endpoint, token) {
        return request(app)[method](endpoint)
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json');
    }

    // ============================================================================
    // GESTÃO DE TIMERS E PERFORMANCE
    // ============================================================================

    /**
     * Inicia cronômetro para medir performance
     */
    startTimer(label) {
        this.timers.set(label, performance.now());
    }

    /**
     * Para cronômetro e retorna tempo decorrido
     */
    endTimer(label) {
        const startTime = this.timers.get(label);
        if (!startTime) return 0;
        
        const elapsed = performance.now() - startTime;
        this.timers.delete(label);
        return elapsed;
    }

    /**
     * Mede tempo de execução de função
     */
    async measureTime(fn, label = 'operation') {
        this.startTimer(label);
        const result = await fn();
        const elapsed = this.endTimer(label);
        
        return { result, elapsed };
    }

    // ============================================================================
    // UTILITÁRIOS DE VALIDAÇÃO
    // ============================================================================

    /**
     * Valida estrutura de resposta de sucesso
     */
    expectSuccessResponse(response, expectedStatus = 200, requiredFields = []) {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('message');
        
        requiredFields.forEach(field => {
            expect(response.body).toHaveProperty(field);
        });

        // Não deve vazar informações sensíveis
        this.expectNoSensitiveData(response.body);
    }

    /**
     * Valida estrutura de resposta de erro
     */
    expectErrorResponse(response, expectedStatus, errorPattern = null) {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('error');
        
        if (errorPattern) {
            expect(response.body.error).toMatch(errorPattern);
        }

        // Não deve vazar informações sensíveis
        this.expectNoSensitiveData(response.body);
    }

    /**
     * Verifica se não há dados sensíveis na resposta
     */
    expectNoSensitiveData(data) {
        const sensitivePatterns = [
            /password_hash/i,
            /jwt_secret/i,
            /session_secret/i,
            /salt/i,
            /bcrypt/i,
            /sqlite/i,
            /database/i
        ];

        const dataString = JSON.stringify(data);
        sensitivePatterns.forEach(pattern => {
            expect(dataString).not.toMatch(pattern);
        });
    }

    /**
     * Valida token JWT
     */
    validateJWTStructure(token) {
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
        expect(token.split('.').length).toBe(3);

        const decoded = jwt.decode(token);
        expect(decoded).toHaveProperty('id');
        expect(decoded).toHaveProperty('email');
        expect(decoded).toHaveProperty('exp');
        expect(decoded).toHaveProperty('iss', 'editaliza');

        // Token não deve estar expirado
        const now = Math.floor(Date.now() / 1000);
        expect(decoded.exp).toBeGreaterThan(now);

        return decoded;
    }

    // ============================================================================
    // UTILITÁRIOS DE MOCK E SIMULAÇÃO
    // ============================================================================

    /**
     * Simula delay de rede
     */
    async simulateNetworkDelay(min = 100, max = 500) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Simula erro de rede
     */
    simulateNetworkError() {
        const errors = [
            new Error('ECONNREFUSED'),
            new Error('ETIMEDOUT'),
            new Error('ENOTFOUND')
        ];
        return errors[Math.floor(Math.random() * errors.length)];
    }

    /**
     * Gera dados maliciosos para testes de segurança
     */
    getMaliciousPayloads() {
        return {
            xss: [
                '<script>alert("xss")</script>',
                'javascript:alert("xss")',
                '"><script>alert("xss")</script>',
                '<img src="x" onerror="alert(1)">'
            ],
            sqlInjection: [
                '\' OR \'1\'=\'1',
                '\'; DROP TABLE users; --',
                '\' UNION SELECT * FROM users --',
                'admin\'--'
            ],
            oversized: {
                string: 'a'.repeat(10000),
                array: new Array(10000).fill('test'),
                object: Object.fromEntries(Array.from({length: 1000}, (_, i) => [`key${i}`, `value${i}`]))
            },
            unicode: [
                '🚀💻🔐🛡️',
                'тест',
                '测试',
                '🔥👨‍💻📝'
            ]
        };
    }

    // ============================================================================
    // UTILITÁRIOS DE LIMPEZA
    // ============================================================================

    /**
     * Adiciona função de limpeza
     */
    addCleanup(cleanupFn) {
        this.cleanup.push(cleanupFn);
    }

    /**
     * Executa todas as funções de limpeza
     */
    async runCleanup() {
        for (const cleanupFn of this.cleanup.reverse()) {
            try {
                await cleanupFn();
            } catch (error) {
                console.warn('Erro na limpeza:', error.message);
            }
        }
        this.cleanup = [];
        this.testData.clear();
        this.timers.clear();
    }

    /**
     * Limpa usuário específico
     */
    async cleanupUser(userId) {
        // Implementar limpeza específica do usuário
        console.log(`Limpando usuário: ${userId}`);
    }

    /**
     * Limpa sessão específica
     */
    async cleanupSession(sessionId) {
        // Implementar limpeza específica da sessão
        console.log(`Limpando sessão: ${sessionId}`);
    }

    // ============================================================================
    // RELATÓRIOS E MÉTRICAS
    // ============================================================================

    /**
     * Gera relatório de execução de teste
     */
    generateTestReport(testName, results) {
        return {
            testName,
            timestamp: new Date().toISOString(),
            results,
            performance: {
                duration: results.duration || 0,
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
    }

    /**
     * Log estruturado para debugging
     */
    log(level, message, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            testContext: this.getCurrentTestContext()
        };
        
        console[level] ? console[level](JSON.stringify(logEntry, null, 2)) : console.log(JSON.stringify(logEntry, null, 2));
    }

    /**
     * Obtém contexto do teste atual
     */
    getCurrentTestContext() {
        return {
            testData: this.testData.size,
            activeTimers: this.timers.size,
            cleanupTasks: this.cleanup.length
        };
    }
}

module.exports = FortressUtils;