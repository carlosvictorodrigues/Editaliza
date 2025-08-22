// advanced-performance-test.js - Teste Avançado de Performance
const http = require('http');
const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

class AdvancedPerformanceTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.results = {
            timestamp: new Date().toISOString(),
            memory_analysis: {},
            database_performance: {},
            api_performance: {},
            stress_testing: {},
            security_headers: {},
            bottlenecks: [],
            recommendations: []
        };
        
        // Setup performance observer
        this.setupPerformanceObserver();
    }

    setupPerformanceObserver() {
        const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'measure') {
                    console.log(`🔍 ${entry.name}: ${Math.round(entry.duration)}ms`);
                }
            }
        });
        obs.observe({ entryTypes: ['measure'] });
    }

    // ===== ANÁLISE APROFUNDADA DE MEMORY LEAKS =====
    async analyzeMemoryLeaks() {
        console.log('🧠 Análise Aprofundada de Memory Leaks...');
        
        // Coletar baseline de memória
        const baseline = process.memoryUsage();
        const iterations = 100;
        const memorySnapshots = [];
        
        console.log(`📊 Executando ${iterations} requisições para detectar vazamentos...`);
        
        for (let i = 0; i < iterations; i++) {
            // Fazer requisições variadas
            const endpoints = ['/health', '/login.html', '/register.html'];
            const endpoint = endpoints[i % endpoints.length];
            
            try {
                await this.makeRequest(endpoint);
                
                // Capturar snapshot de memória a cada 10 iterações
                if (i % 10 === 0) {
                    const snapshot = process.memoryUsage();
                    memorySnapshots.push({
                        iteration: i,
                        heapUsed: snapshot.heapUsed,
                        heapTotal: snapshot.heapTotal,
                        external: snapshot.external,
                        rss: snapshot.rss
                    });
                }
                
                // Forçar garbage collection se disponível
                if (global.gc) {
                    global.gc();
                }
                
            } catch (error) {
                console.log(`⚠️ Erro na iteração ${i}: ${error.message}`);
            }
        }
        
        // Análise dos snapshots
        this.results.memory_analysis = {
            baseline: {
                heapUsed: Math.round(baseline.heapUsed / 1024 / 1024),
                heapTotal: Math.round(baseline.heapTotal / 1024 / 1024),
                rss: Math.round(baseline.rss / 1024 / 1024)
            },
            snapshots: memorySnapshots.map(s => ({
                ...s,
                heapUsed: Math.round(s.heapUsed / 1024 / 1024),
                heapTotal: Math.round(s.heapTotal / 1024 / 1024),
                rss: Math.round(s.rss / 1024 / 1024)
            })),
            analysis: this.analyzeMemoryTrend(memorySnapshots, baseline)
        };
    }

    analyzeMemoryTrend(snapshots, baseline) {
        if (snapshots.length < 2) return { trend: 'INSUFFICIENT_DATA' };
        
        const first = snapshots[0];
        const last = snapshots[snapshots.length - 1];
        
        const heapGrowth = last.heapUsed - first.heapUsed;
        const rssGrowth = last.rss - first.rss;
        
        // Calcular tendência linear
        const heapTrend = this.calculateLinearTrend(snapshots.map(s => s.heapUsed));
        const rssTrend = this.calculateLinearTrend(snapshots.map(s => s.rss));
        
        return {
            heap_growth_mb: Math.round(heapGrowth / 1024 / 1024),
            rss_growth_mb: Math.round(rssGrowth / 1024 / 1024),
            heap_trend_per_iteration: Math.round(heapTrend),
            rss_trend_per_iteration: Math.round(rssTrend),
            leak_suspected: heapGrowth > 10 * 1024 * 1024 || heapTrend > 100000, // > 10MB ou >100KB por iteração
            severity: heapGrowth > 50 * 1024 * 1024 ? 'CRITICAL' : heapGrowth > 10 * 1024 * 1024 ? 'HIGH' : 'LOW'
        };
    }

    calculateLinearTrend(values) {
        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }

    // ===== ANÁLISE DE PERFORMANCE DE BANCO DE DADOS =====
    async analyzeDatabasePerformance() {
        console.log('🗄️ Análise de Performance do Banco de Dados...');
        
        performance.mark('db-analysis-start');
        
        try {
            // Verificar se existe database SQLite
            const dbFiles = ['database.sqlite', 'sessions.db', 'study_planner.db'];
            const existingDbs = [];
            
            for (const dbFile of dbFiles) {
                const dbPath = path.join(__dirname, dbFile);
                if (fs.existsSync(dbPath)) {
                    const stats = fs.statSync(dbPath);
                    existingDbs.push({
                        file: dbFile,
                        size_mb: Math.round(stats.size / 1024 / 1024 * 100) / 100,
                        modified: stats.mtime
                    });
                }
            }
            
            // Verificar conexões PostgreSQL
            const pgConnections = await this.checkPostgreSQLConnections();
            
            // Simular queries comuns e medir performance
            const queryPerformance = await this.simulateCommonQueries();
            
            this.results.database_performance = {
                sqlite_databases: existingDbs,
                postgresql_status: pgConnections,
                query_performance: queryPerformance,
                recommendations: this.generateDatabaseRecommendations(existingDbs, pgConnections)
            };
            
        } catch (error) {
            this.results.database_performance.error = error.message;
        }
        
        performance.mark('db-analysis-end');
        performance.measure('Database Analysis', 'db-analysis-start', 'db-analysis-end');
    }

    async checkPostgreSQLConnections() {
        try {
            // Tentar conectar no PostgreSQL
            const { Client } = require('pg');
            const client = new Client({
                host: 'localhost',
                port: 5432,
                database: 'editaliza_db',
                user: 'editaliza_user',
                password: 'Editaliza@2025#Secure'
            });
            
            const startTime = performance.now();
            await client.connect();
            const connectTime = performance.now() - startTime;
            
            // Testar query simples
            const queryStart = performance.now();
            const result = await client.query('SELECT NOW()');
            const queryTime = performance.now() - queryStart;
            
            await client.end();
            
            return {
                status: 'CONNECTED',
                connection_time_ms: Math.round(connectTime),
                query_time_ms: Math.round(queryTime),
                version: result.rows[0].now
            };
            
        } catch (error) {
            return {
                status: 'DISCONNECTED',
                error: error.message
            };
        }
    }

    async simulateCommonQueries() {
        // Simular diferentes tipos de queries e suas performances esperadas
        return [
            {
                type: 'SELECT_USER',
                query: 'SELECT * FROM users WHERE id = ?',
                estimated_time_ms: 5,
                frequency: 'VERY_HIGH',
                optimization_potential: 'LOW'
            },
            {
                type: 'SELECT_CRONOGRAMA',
                query: 'SELECT * FROM cronograma WHERE user_id = ? ORDER BY date',
                estimated_time_ms: 25,
                frequency: 'HIGH',
                optimization_potential: 'MEDIUM'
            },
            {
                type: 'JOIN_SESSIONS_SUBJECTS',
                query: 'SELECT s.*, sub.name FROM sessions s JOIN subjects sub ON s.subject_id = sub.id WHERE s.user_id = ?',
                estimated_time_ms: 50,
                frequency: 'MEDIUM',
                optimization_potential: 'HIGH'
            },
            {
                type: 'COMPLEX_STATISTICS',
                query: 'SELECT COUNT(*), AVG(duration), DATE(created_at) FROM sessions WHERE user_id = ? GROUP BY DATE(created_at)',
                estimated_time_ms: 100,
                frequency: 'LOW',
                optimization_potential: 'HIGH'
            }
        ];
    }

    generateDatabaseRecommendations(sqliteDbs, pgStatus) {
        const recommendations = [];
        
        if (sqliteDbs.length > 0 && pgStatus.status === 'DISCONNECTED') {
            recommendations.push({
                priority: 'HIGH',
                issue: 'Sistema usando SQLite em desenvolvimento',
                solution: 'Configurar PostgreSQL para melhor performance e recursos',
                impact: 'Melhor concorrência, integridade de dados e performance'
            });
        }
        
        if (pgStatus.status === 'CONNECTED' && pgStatus.query_time_ms > 50) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: 'Queries PostgreSQL lentas',
                solution: 'Adicionar índices, otimizar queries, verificar configuração',
                impact: 'Redução significativa no tempo de resposta'
            });
        }
        
        const largeSqliteDb = sqliteDbs.find(db => db.size_mb > 100);
        if (largeSqliteDb) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: `Database SQLite muito grande: ${largeSqliteDb.file} (${largeSqliteDb.size_mb}MB)`,
                solution: 'Implementar arquivamento de dados antigos ou migrar para PostgreSQL',
                impact: 'Melhora performance de queries e reduz uso de disco'
            });
        }
        
        return recommendations;
    }

    // ===== ANÁLISE DETALHADA DE APIs =====
    async analyzeAPIPerformance() {
        console.log('🚀 Análise Detalhada de Performance de APIs...');
        
        const endpoints = [
            { path: '/health', method: 'GET', auth: false },
            { path: '/login.html', method: 'GET', auth: false },
            { path: '/register.html', method: 'GET', auth: false },
            { path: '/cronograma.html', method: 'GET', auth: false },
            { path: '/api/auth/login', method: 'POST', auth: false },
            { path: '/api/cronograma/generate', method: 'POST', auth: true },
            { path: '/api/sessions', method: 'GET', auth: true },
            { path: '/api/profile', method: 'GET', auth: true }
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            console.log(`🔍 Testando ${endpoint.method} ${endpoint.path}...`);
            
            try {
                const measurements = [];
                const iterations = 5;
                
                for (let i = 0; i < iterations; i++) {
                    const result = await this.measureEndpointPerformance(endpoint);
                    measurements.push(result);
                    
                    // Pequena pausa entre requisições
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                results[endpoint.path] = {
                    method: endpoint.method,
                    auth_required: endpoint.auth,
                    measurements,
                    statistics: this.calculateStatistics(measurements)
                };
                
            } catch (error) {
                results[endpoint.path] = {
                    error: error.message,
                    status: 'FAILED'
                };
            }
        }
        
        this.results.api_performance = {
            endpoints: results,
            summary: this.generateAPIPerformanceSummary(results)
        };
    }

    async measureEndpointPerformance(endpoint) {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            let dnsTime, connectTime, ttfbTime, completeTime;
            
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: endpoint.path,
                method: endpoint.method,
                headers: {
                    'User-Agent': 'Editaliza-Performance-Tester',
                    'Accept': 'text/html,application/json,*/*',
                    'Connection': 'keep-alive'
                }
            };
            
            const req = http.request(options, (res) => {
                ttfbTime = performance.now();
                
                let data = '';
                let firstChunk = true;
                
                res.on('data', (chunk) => {
                    if (firstChunk) {
                        firstChunk = false;
                    }
                    data += chunk;
                });
                
                res.on('end', () => {
                    completeTime = performance.now();
                    
                    resolve({
                        response_time: Math.round(completeTime - startTime),
                        ttfb: Math.round(ttfbTime - startTime),
                        download_time: Math.round(completeTime - ttfbTime),
                        status_code: res.statusCode,
                        content_length: data.length,
                        headers_count: Object.keys(res.headers).length,
                        timestamp: new Date().toISOString()
                    });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
            
            // Para POST requests, adicionar body se necessário
            if (endpoint.method === 'POST') {
                req.write('{}'); // Body vazio por enquanto
            }
            
            req.end();
        });
    }

    calculateStatistics(measurements) {
        if (measurements.length === 0) return null;
        
        const responseTimes = measurements.map(m => m.response_time);
        const ttfbs = measurements.map(m => m.ttfb);
        
        return {
            response_time: {
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                avg: Math.round(responseTimes.reduce((a, b) => a + b) / responseTimes.length),
                p95: this.calculatePercentile(responseTimes, 95)
            },
            ttfb: {
                min: Math.min(...ttfbs),
                max: Math.max(...ttfbs),
                avg: Math.round(ttfbs.reduce((a, b) => a + b) / ttfbs.length),
                p95: this.calculatePercentile(ttfbs, 95)
            },
            success_rate: Math.round((measurements.filter(m => m.status_code < 400).length / measurements.length) * 100)
        };
    }

    calculatePercentile(values, percentile) {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    generateAPIPerformanceSummary(results) {
        const successful = Object.values(results).filter(r => !r.error && r.statistics);
        
        if (successful.length === 0) {
            return { status: 'NO_SUCCESSFUL_TESTS' };
        }
        
        const avgResponseTimes = successful.map(r => r.statistics.response_time.avg);
        const overallAvg = Math.round(avgResponseTimes.reduce((a, b) => a + b) / avgResponseTimes.length);
        
        const slowEndpoints = successful.filter(r => r.statistics.response_time.avg > 500);
        const fastEndpoints = successful.filter(r => r.statistics.response_time.avg < 100);
        
        return {
            total_endpoints_tested: Object.keys(results).length,
            successful_tests: successful.length,
            overall_avg_response_time: overallAvg,
            fast_endpoints: fastEndpoints.length,
            slow_endpoints: slowEndpoints.length,
            performance_grade: this.calculatePerformanceGrade(overallAvg)
        };
    }

    calculatePerformanceGrade(avgResponseTime) {
        if (avgResponseTime < 100) return 'A+';
        if (avgResponseTime < 200) return 'A';
        if (avgResponseTime < 500) return 'B';
        if (avgResponseTime < 1000) return 'C';
        return 'D';
    }

    // ===== STRESS TESTING AVANÇADO =====
    async performAdvancedStressTesting() {
        console.log('💪 Stress Testing Avançado...');
        
        const scenarios = [
            { name: 'Light Load', concurrent: 5, duration: 10 },
            { name: 'Medium Load', concurrent: 15, duration: 15 },
            { name: 'Heavy Load', concurrent: 30, duration: 20 },
            { name: 'Spike Test', concurrent: 50, duration: 5 }
        ];
        
        const results = {};
        
        for (const scenario of scenarios) {
            console.log(`🔥 Executando ${scenario.name}: ${scenario.concurrent} usuários por ${scenario.duration}s...`);
            
            try {
                const result = await this.runLoadTest(scenario);
                results[scenario.name] = result;
                
                // Pausa entre cenários para estabilização
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                results[scenario.name] = {
                    error: error.message,
                    status: 'FAILED'
                };
            }
        }
        
        this.results.stress_testing = {
            scenarios: results,
            summary: this.generateStressTestSummary(results)
        };
    }

    async runLoadTest(scenario) {
        const { concurrent, duration } = scenario;
        const endTime = Date.now() + (duration * 1000);
        const workers = [];
        const results = [];
        
        // Iniciar workers
        for (let i = 0; i < concurrent; i++) {
            workers.push(this.createWorker(endTime, results, i));
        }
        
        // Aguardar todos os workers
        await Promise.all(workers);
        
        return this.analyzeLoadTestResults(results, scenario);
    }

    async createWorker(endTime, results, workerId) {
        const endpoints = ['/health', '/login.html', '/register.html'];
        let requestCount = 0;
        
        while (Date.now() < endTime) {
            try {
                const endpoint = endpoints[requestCount % endpoints.length];
                const start = performance.now();
                
                await this.makeRequest(endpoint);
                
                const duration = performance.now() - start;
                results.push({
                    workerId,
                    requestCount: requestCount++,
                    endpoint,
                    duration,
                    timestamp: Date.now(),
                    success: true
                });
                
            } catch (error) {
                results.push({
                    workerId,
                    requestCount: requestCount++,
                    error: error.message,
                    timestamp: Date.now(),
                    success: false
                });
            }
            
            // Pequena pausa para simular usuário real
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        }
    }

    analyzeLoadTestResults(results, scenario) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length === 0) {
            return {
                scenario: scenario.name,
                total_requests: results.length,
                success_rate: 0,
                status: 'FAILED'
            };
        }
        
        const durations = successful.map(r => r.duration);
        const throughput = results.length / scenario.duration;
        
        return {
            scenario: scenario.name,
            total_requests: results.length,
            successful_requests: successful.length,
            failed_requests: failed.length,
            success_rate: Math.round((successful.length / results.length) * 100),
            avg_response_time: Math.round(durations.reduce((a, b) => a + b) / durations.length),
            min_response_time: Math.round(Math.min(...durations)),
            max_response_time: Math.round(Math.max(...durations)),
            p95_response_time: Math.round(this.calculatePercentile(durations, 95)),
            throughput_rps: Math.round(throughput),
            status: successful.length / results.length > 0.95 ? 'PASSED' : 'DEGRADED'
        };
    }

    generateStressTestSummary(results) {
        const scenarios = Object.values(results).filter(r => !r.error);
        
        if (scenarios.length === 0) {
            return { status: 'ALL_FAILED' };
        }
        
        const passed = scenarios.filter(s => s.status === 'PASSED').length;
        const degraded = scenarios.filter(s => s.status === 'DEGRADED').length;
        const failed = scenarios.filter(s => s.status === 'FAILED').length;
        
        const maxConcurrent = Math.max(...scenarios.map(s => {
            const scenarioNames = {
                'Light Load': 5,
                'Medium Load': 15,
                'Heavy Load': 30,
                'Spike Test': 50
            };
            return s.status === 'PASSED' ? scenarioNames[s.scenario] || 0 : 0;
        }));
        
        return {
            scenarios_passed: passed,
            scenarios_degraded: degraded,
            scenarios_failed: failed,
            max_concurrent_supported: maxConcurrent,
            overall_status: failed === 0 ? (degraded === 0 ? 'EXCELLENT' : 'GOOD') : 'NEEDS_IMPROVEMENT'
        };
    }

    // ===== HELPER METHODS =====
    async makeRequest(endpoint) {
        return new Promise((resolve, reject) => {
            const req = http.get(`${this.baseUrl}${endpoint}`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, data }));
            });
            
            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    // ===== MÉTODO PRINCIPAL =====
    async runAdvancedPerformanceTest() {
        console.log('🚀 Iniciando Teste Avançado de Performance - Editaliza');
        console.log('=' .repeat(70));
        
        try {
            // 1. Análise de Memory Leaks
            await this.analyzeMemoryLeaks();
            
            // 2. Performance do Banco de Dados
            await this.analyzeDatabasePerformance();
            
            // 3. Performance detalhada de APIs
            await this.analyzeAPIPerformance();
            
            // 4. Stress Testing Avançado
            await this.performAdvancedStressTesting();
            
            // 5. Gerar Relatório Final
            const reportPath = path.join(__dirname, `advanced-performance-report-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
            
            console.log('\n' + '=' .repeat(70));
            console.log('✅ Teste Avançado de Performance Finalizado!');
            console.log(`📄 Relatório salvo em: ${reportPath}`);
            console.log('=' .repeat(70));
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Erro durante o teste:', error);
            throw error;
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const tester = new AdvancedPerformanceTester();
    tester.runAdvancedPerformanceTest()
        .then(results => {
            console.log('\n📊 RESUMO DO TESTE AVANÇADO:');
            
            if (results.memory_analysis.analysis) {
                console.log(`Memory Leak: ${results.memory_analysis.analysis.leak_suspected ? '⚠️ SUSPEITO' : '✅ NÃO DETECTADO'}`);
                console.log(`Crescimento de Heap: ${results.memory_analysis.analysis.heap_growth_mb}MB`);
            }
            
            if (results.database_performance.postgresql_status) {
                console.log(`PostgreSQL: ${results.database_performance.postgresql_status.status}`);
            }
            
            if (results.api_performance.summary) {
                console.log(`Performance APIs: Nota ${results.api_performance.summary.performance_grade}`);
                console.log(`Tempo Médio: ${results.api_performance.summary.overall_avg_response_time}ms`);
            }
            
            if (results.stress_testing.summary) {
                console.log(`Stress Test: ${results.stress_testing.summary.overall_status}`);
                console.log(`Máx Usuários Simultâneos: ${results.stress_testing.summary.max_concurrent_supported}`);
            }
        })
        .catch(console.error);
}

module.exports = AdvancedPerformanceTester;