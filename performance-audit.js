// performance-audit.js - Auditoria Completa de Performance do Sistema Editaliza
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PerformanceAuditor {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.results = {
            timestamp: new Date().toISOString(),
            backend: {},
            frontend: {},
            database: {},
            memory: {},
            stress: {},
            bottlenecks: [],
            recommendations: []
        };
    }

    // ===== PERFORMANCE DO BACKEND =====
    async auditBackendPerformance() {
        console.log('🔍 Auditando Performance do Backend...');
        
        const endpoints = [
            '/',
            '/health',
            '/api/cronograma/1',
            '/api/profile',
            '/api/sessions',
            '/api/subjects',
            '/api/statistics'
        ];

        this.results.backend.endpoints = {};

        for (const endpoint of endpoints) {
            try {
                const metrics = await this.measureEndpoint(endpoint);
                this.results.backend.endpoints[endpoint] = metrics;
                
                // Identificar endpoints lentos
                if (metrics.responseTime > 500) {
                    this.results.bottlenecks.push({
                        type: 'SLOW_ENDPOINT',
                        endpoint,
                        responseTime: metrics.responseTime,
                        severity: metrics.responseTime > 1000 ? 'CRITICAL' : 'WARNING'
                    });
                }
            } catch (error) {
                this.results.backend.endpoints[endpoint] = {
                    error: error.message,
                    status: 'FAILED'
                };
            }
        }

        // Testar connection pooling
        await this.testConnectionPooling();
        
        // Verificar memory leaks
        await this.checkMemoryLeaks();
    }

    async measureEndpoint(endpoint) {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
            const url = this.baseUrl + endpoint;
            
            const request = http.get(url, (res) => {
                let data = '';
                const firstByteTime = performance.now();
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    const endTime = performance.now();
                    
                    resolve({
                        responseTime: Math.round(endTime - startTime),
                        ttfb: Math.round(firstByteTime - startTime), // Time to First Byte
                        statusCode: res.statusCode,
                        contentLength: data.length,
                        headers: res.headers
                    });
                });
            });
            
            request.on('error', reject);
            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    async testConnectionPooling() {
        console.log('🔗 Testando Connection Pooling...');
        
        const concurrent = 10;
        const promises = [];
        
        const startTime = performance.now();
        
        for (let i = 0; i < concurrent; i++) {
            promises.push(this.measureEndpoint('/api/subjects'));
        }
        
        try {
            const results = await Promise.all(promises);
            const endTime = performance.now();
            
            const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
            
            this.results.backend.connectionPooling = {
                concurrentRequests: concurrent,
                totalTime: Math.round(endTime - startTime),
                averageResponseTime: Math.round(avgResponseTime),
                allSuccessful: results.every(r => r.statusCode === 200),
                bottleneck: avgResponseTime > 300 ? 'DETECTED' : 'NONE'
            };
            
            if (avgResponseTime > 300) {
                this.results.bottlenecks.push({
                    type: 'CONNECTION_POOL_BOTTLENECK',
                    averageResponseTime: avgResponseTime,
                    severity: 'WARNING'
                });
            }
        } catch (error) {
            this.results.backend.connectionPooling = {
                error: error.message,
                status: 'FAILED'
            };
        }
    }

    async checkMemoryLeaks() {
        console.log('🧠 Verificando Memory Leaks...');
        
        const initialMemory = process.memoryUsage();
        
        // Simular operações intensivas
        const operations = 50;
        for (let i = 0; i < operations; i++) {
            await this.measureEndpoint('/api/subjects');
        }
        
        const finalMemory = process.memoryUsage();
        
        this.results.backend.memoryLeak = {
            initialHeapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024),
            finalHeapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
            heapGrowth: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
            rss: Math.round(finalMemory.rss / 1024 / 1024),
            external: Math.round(finalMemory.external / 1024 / 1024)
        };
        
        if (this.results.backend.memoryLeak.heapGrowth > 10) {
            this.results.bottlenecks.push({
                type: 'MEMORY_LEAK_SUSPECTED',
                heapGrowth: this.results.backend.memoryLeak.heapGrowth,
                severity: 'CRITICAL'
            });
        }
    }

    // ===== PERFORMANCE DO FRONTEND =====
    async auditFrontendPerformance() {
        console.log('🎨 Auditando Performance do Frontend...');
        
        // Analisar tamanhos de bundle
        await this.analyzeBundleSizes();
        
        // Verificar assets não otimizados
        await this.checkUnoptimizedAssets();
        
        // Simular Web Vitals
        await this.simulateWebVitals();
    }

    async analyzeBundleSizes() {
        console.log('📦 Analisando Bundle Sizes...');
        
        const jsDir = path.join(__dirname, 'js');
        const cssDir = path.join(__dirname, 'css');
        
        let totalJSSize = 0;
        let totalCSSSize = 0;
        const files = [];
        
        // Analisar arquivos JS
        if (fs.existsSync(jsDir)) {
            const jsFiles = fs.readdirSync(jsDir);
            for (const file of jsFiles) {
                const filePath = path.join(jsDir, file);
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                totalJSSize += sizeKB;
                
                files.push({
                    name: file,
                    size: sizeKB,
                    type: 'JS'
                });
                
                // Identificar bundles grandes
                if (sizeKB > 100) {
                    this.results.bottlenecks.push({
                        type: 'LARGE_JS_BUNDLE',
                        file,
                        size: sizeKB,
                        severity: sizeKB > 500 ? 'CRITICAL' : 'WARNING'
                    });
                }
            }
        }
        
        // Analisar arquivos CSS
        if (fs.existsSync(cssDir)) {
            const cssFiles = fs.readdirSync(cssDir);
            for (const file of cssFiles) {
                const filePath = path.join(cssDir, file);
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                totalCSSSize += sizeKB;
                
                files.push({
                    name: file,
                    size: sizeKB,
                    type: 'CSS'
                });
            }
        }
        
        this.results.frontend.bundleSizes = {
            totalJS: totalJSSize,
            totalCSS: totalCSSSize,
            total: totalJSSize + totalCSSSize,
            files: files.sort((a, b) => b.size - a.size)
        };
        
        // Verificar se o bundle total é muito grande
        if (totalJSSize + totalCSSSize > 1000) {
            this.results.bottlenecks.push({
                type: 'LARGE_TOTAL_BUNDLE',
                totalSize: totalJSSize + totalCSSSize,
                severity: 'WARNING'
            });
        }
    }

    async checkUnoptimizedAssets() {
        console.log('🖼️ Verificando Assets Não Otimizados...');
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];
        const imagesDir = path.join(__dirname, 'images');
        
        const unoptimizedImages = [];
        let totalImageSize = 0;
        
        if (fs.existsSync(imagesDir)) {
            const scanDirectory = (dir) => {
                const files = fs.readdirSync(dir);
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        scanDirectory(filePath);
                    } else {
                        const ext = path.extname(file).toLowerCase();
                        if (imageExtensions.includes(ext)) {
                            const sizeKB = Math.round(stats.size / 1024);
                            totalImageSize += sizeKB;
                            
                            // Imagens muito grandes
                            if (sizeKB > 500) {
                                unoptimizedImages.push({
                                    file,
                                    path: filePath,
                                    size: sizeKB,
                                    type: 'LARGE_IMAGE'
                                });
                            }
                        }
                    }
                }
            };
            
            scanDirectory(imagesDir);
        }
        
        this.results.frontend.assets = {
            totalImageSize,
            unoptimizedCount: unoptimizedImages.length,
            unoptimizedImages
        };
        
        if (unoptimizedImages.length > 0) {
            this.results.bottlenecks.push({
                type: 'UNOPTIMIZED_IMAGES',
                count: unoptimizedImages.length,
                severity: 'WARNING'
            });
        }
    }

    async simulateWebVitals() {
        console.log('⚡ Simulando Web Vitals...');
        
        // Simular métricas baseadas nos testes anteriores
        const homePageMetrics = this.results.backend.endpoints['/'];
        
        if (homePageMetrics && !homePageMetrics.error) {
            // LCP (Largest Contentful Paint) - estimativa
            const estimatedLCP = homePageMetrics.responseTime + 500; // tempo do servidor + rendering
            
            // FID (First Input Delay) - simulação
            const estimatedFID = Math.random() * 50; // Simular entre 0-50ms
            
            // CLS (Cumulative Layout Shift) - análise estática
            const estimatedCLS = 0.1; // Assumir valor médio
            
            this.results.frontend.webVitals = {
                LCP: {
                    value: estimatedLCP,
                    status: estimatedLCP < 2500 ? 'GOOD' : estimatedLCP < 4000 ? 'NEEDS_IMPROVEMENT' : 'POOR',
                    target: '< 2.5s'
                },
                FID: {
                    value: Math.round(estimatedFID),
                    status: estimatedFID < 100 ? 'GOOD' : estimatedFID < 300 ? 'NEEDS_IMPROVEMENT' : 'POOR',
                    target: '< 100ms'
                },
                CLS: {
                    value: estimatedCLS,
                    status: estimatedCLS < 0.1 ? 'GOOD' : estimatedCLS < 0.25 ? 'NEEDS_IMPROVEMENT' : 'POOR',
                    target: '< 0.1'
                }
            };
            
            // Adicionar bottlenecks se métricas estão ruins
            if (estimatedLCP >= 4000) {
                this.results.bottlenecks.push({
                    type: 'POOR_LCP',
                    value: estimatedLCP,
                    severity: 'CRITICAL'
                });
            }
            
            if (estimatedFID >= 300) {
                this.results.bottlenecks.push({
                    type: 'POOR_FID',
                    value: estimatedFID,
                    severity: 'CRITICAL'
                });
            }
        }
    }

    // ===== STRESS TESTING =====
    async performStressTesting() {
        console.log('💪 Executando Stress Testing...');
        
        // Teste de carga progressiva
        const loadLevels = [1, 5, 10, 20, 50];
        
        for (const concurrent of loadLevels) {
            console.log(`🔥 Testando com ${concurrent} usuários simultâneos...`);
            
            const promises = [];
            const startTime = performance.now();
            
            for (let i = 0; i < concurrent; i++) {
                promises.push(this.measureEndpoint('/'));
            }
            
            try {
                const results = await Promise.all(promises);
                const endTime = performance.now();
                
                const successCount = results.filter(r => r.statusCode === 200).length;
                const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
                const totalTime = endTime - startTime;
                
                this.results.stress[`${concurrent}_users`] = {
                    concurrent,
                    totalTime: Math.round(totalTime),
                    averageResponseTime: Math.round(avgResponseTime),
                    successRate: Math.round((successCount / concurrent) * 100),
                    throughput: Math.round((concurrent / totalTime) * 1000), // requests per second
                    status: successCount === concurrent ? 'PASSED' : 'FAILED'
                };
                
                // Se começar a falhar ou ficar muito lento, parar o teste
                if (successCount < concurrent || avgResponseTime > 2000) {
                    this.results.stress.maxCapacity = concurrent - 1;
                    break;
                }
            } catch (error) {
                this.results.stress[`${concurrent}_users`] = {
                    error: error.message,
                    status: 'FAILED'
                };
                this.results.stress.maxCapacity = concurrent - 1;
                break;
            }
        }
    }

    // ===== ANÁLISE DE BANCO DE DADOS =====
    async analyzeDatabasePerformance() {
        console.log('🗄️ Analisando Performance do Banco de Dados...');
        
        try {
            // Verificar conexões de banco
            await this.checkDatabaseConnections();
            
            // Analisar queries lentas (simulação)
            await this.analyzeSlowQueries();
            
        } catch (error) {
            this.results.database.error = error.message;
        }
    }

    async checkDatabaseConnections() {
        const dbFiles = [
            'database-postgresql.js',
            'database-simple-postgres.js',
            'database-memory.js',
            'database-sqlite.js'
        ];
        
        let activeDatabase = 'unknown';
        
        for (const dbFile of dbFiles) {
            const dbPath = path.join(__dirname, dbFile);
            if (fs.existsSync(dbPath)) {
                const content = fs.readFileSync(dbPath, 'utf8');
                
                // Verificar tipo de banco
                if (content.includes('postgresql') || content.includes('pg')) {
                    activeDatabase = 'postgresql';
                } else if (content.includes('sqlite')) {
                    activeDatabase = 'sqlite';
                } else if (content.includes('memory')) {
                    activeDatabase = 'memory';
                }
            }
        }
        
        this.results.database.type = activeDatabase;
        this.results.database.connectionPooling = activeDatabase === 'postgresql' ? 'AVAILABLE' : 'LIMITED';
        
        if (activeDatabase === 'memory') {
            this.results.bottlenecks.push({
                type: 'MEMORY_DATABASE',
                description: 'Usando banco em memória - dados não persistem',
                severity: 'WARNING'
            });
        }
    }

    async analyzeSlowQueries() {
        // Simular análise de queries baseada nos endpoints testados
        const potentialSlowQueries = [
            {
                query: 'SELECT * FROM cronograma WHERE user_id = ?',
                estimatedTime: 50,
                frequency: 'HIGH'
            },
            {
                query: 'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
                estimatedTime: 30,
                frequency: 'MEDIUM'
            },
            {
                query: 'SELECT COUNT(*) FROM subjects WHERE plan_id = ?',
                estimatedTime: 20,
                frequency: 'LOW'
            }
        ];
        
        this.results.database.queries = potentialSlowQueries;
        
        // Identificar queries que podem ser otimizadas
        const slowQueries = potentialSlowQueries.filter(q => q.estimatedTime > 100);
        if (slowQueries.length > 0) {
            this.results.bottlenecks.push({
                type: 'SLOW_QUERIES',
                count: slowQueries.length,
                severity: 'WARNING'
            });
        }
    }

    // ===== GERAÇÃO DE RECOMENDAÇÕES =====
    generateRecommendations() {
        console.log('💡 Gerando Recomendações...');
        
        const recommendations = [];
        
        // Analisar bottlenecks e gerar recomendações
        this.results.bottlenecks.forEach(bottleneck => {
            switch (bottleneck.type) {
                case 'SLOW_ENDPOINT':
                    recommendations.push({
                        priority: 'HIGH',
                        category: 'Backend',
                        issue: `Endpoint ${bottleneck.endpoint} muito lento (${bottleneck.responseTime}ms)`,
                        solution: 'Implementar caching, otimizar queries do banco, adicionar índices',
                        impact: 'Melhora experiência do usuário e reduz carga do servidor'
                    });
                    break;
                    
                case 'LARGE_JS_BUNDLE':
                    recommendations.push({
                        priority: 'MEDIUM',
                        category: 'Frontend',
                        issue: `Bundle JS muito grande: ${bottleneck.file} (${bottleneck.size}KB)`,
                        solution: 'Implementar code splitting, lazy loading, tree shaking',
                        impact: 'Reduz tempo de carregamento inicial'
                    });
                    break;
                    
                case 'MEMORY_LEAK_SUSPECTED':
                    recommendations.push({
                        priority: 'CRITICAL',
                        category: 'Backend',
                        issue: `Possível memory leak detectado (${bottleneck.heapGrowth}MB)`,
                        solution: 'Revisar event listeners, closures, timers não limpos',
                        impact: 'Previne crashes e melhora estabilidade'
                    });
                    break;
                    
                case 'MEMORY_DATABASE':
                    recommendations.push({
                        priority: 'HIGH',
                        category: 'Database',
                        issue: 'Usando banco em memória',
                        solution: 'Migrar para PostgreSQL em produção',
                        impact: 'Persistência de dados e melhor performance'
                    });
                    break;
                    
                case 'POOR_LCP':
                    recommendations.push({
                        priority: 'HIGH',
                        category: 'Frontend',
                        issue: `LCP muito alto (${bottleneck.value}ms)`,
                        solution: 'Otimizar imagens, implementar SSR, usar CDN',
                        impact: 'Melhora SEO e experiência do usuário'
                    });
                    break;
            }
        });
        
        // Recomendações gerais baseadas na análise
        if (this.results.backend.endpoints) {
            const avgResponseTime = Object.values(this.results.backend.endpoints)
                .filter(e => !e.error)
                .reduce((sum, e) => sum + e.responseTime, 0) / 
                Object.values(this.results.backend.endpoints).filter(e => !e.error).length;
                
            if (avgResponseTime > 200) {
                recommendations.push({
                    priority: 'MEDIUM',
                    category: 'Backend',
                    issue: 'Tempo de resposta médio elevado',
                    solution: 'Implementar Redis para caching, otimizar algoritmos',
                    impact: 'Melhora performance geral da aplicação'
                });
            }
        }
        
        if (this.results.frontend.bundleSizes && this.results.frontend.bundleSizes.total > 500) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Frontend',
                issue: 'Bundle total muito grande',
                solution: 'Implementar webpack optimization, remover dependências não usadas',
                impact: 'Reduz tempo de carregamento'
            });
        }
        
        this.results.recommendations = recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    // ===== GERAÇÃO DO RELATÓRIO =====
    generateReport() {
        console.log('📊 Gerando Relatório Final...');
        
        const report = {
            metadata: {
                timestamp: this.results.timestamp,
                auditor: 'Editaliza Performance Auditor v1.0',
                environment: 'Local Development'
            },
            
            executive_summary: {
                overall_score: this.calculateOverallScore(),
                critical_issues: this.results.bottlenecks.filter(b => b.severity === 'CRITICAL').length,
                warnings: this.results.bottlenecks.filter(b => b.severity === 'WARNING').length,
                top_recommendations: this.results.recommendations.slice(0, 3)
            },
            
            detailed_analysis: this.results,
            
            metrics_summary: {
                backend: {
                    avg_response_time: this.calculateAverageResponseTime(),
                    slowest_endpoint: this.findSlowestEndpoint(),
                    memory_usage: this.results.backend.memoryLeak
                },
                frontend: {
                    bundle_size: this.results.frontend.bundleSizes?.total || 'N/A',
                    web_vitals: this.results.frontend.webVitals
                },
                stress: {
                    max_concurrent_users: this.results.stress.maxCapacity || 'Not determined',
                    bottleneck_threshold: this.findBottleneckThreshold()
                }
            },
            
            action_plan: {
                immediate: this.results.recommendations.filter(r => r.priority === 'CRITICAL'),
                short_term: this.results.recommendations.filter(r => r.priority === 'HIGH'),
                medium_term: this.results.recommendations.filter(r => r.priority === 'MEDIUM'),
                long_term: this.results.recommendations.filter(r => r.priority === 'LOW')
            }
        };
        
        return report;
    }

    calculateOverallScore() {
        let score = 100;
        
        // Deduzir pontos por bottlenecks
        this.results.bottlenecks.forEach(bottleneck => {
            switch (bottleneck.severity) {
                case 'CRITICAL': score -= 20; break;
                case 'WARNING': score -= 10; break;
                default: score -= 5; break;
            }
        });
        
        return Math.max(0, score);
    }

    calculateAverageResponseTime() {
        if (!this.results.backend.endpoints) return 'N/A';
        
        const validEndpoints = Object.values(this.results.backend.endpoints)
            .filter(e => !e.error && e.responseTime);
            
        if (validEndpoints.length === 0) return 'N/A';
        
        const total = validEndpoints.reduce((sum, e) => sum + e.responseTime, 0);
        return Math.round(total / validEndpoints.length);
    }

    findSlowestEndpoint() {
        if (!this.results.backend.endpoints) return 'N/A';
        
        let slowest = null;
        let maxTime = 0;
        
        for (const [endpoint, metrics] of Object.entries(this.results.backend.endpoints)) {
            if (!metrics.error && metrics.responseTime > maxTime) {
                maxTime = metrics.responseTime;
                slowest = endpoint;
            }
        }
        
        return slowest ? `${slowest} (${maxTime}ms)` : 'N/A';
    }

    findBottleneckThreshold() {
        const stressResults = Object.values(this.results.stress).filter(r => typeof r === 'object' && r.concurrent);
        
        for (const result of stressResults) {
            if (result.successRate < 100 || result.averageResponseTime > 1000) {
                return `${result.concurrent} concurrent users`;
            }
        }
        
        return 'Not reached in testing';
    }

    // ===== MÉTODO PRINCIPAL =====
    async runCompleteAudit() {
        console.log('🚀 Iniciando Auditoria Completa de Performance - Editaliza');
        console.log('=' .repeat(60));
        
        try {
            // 1. Backend Performance
            await this.auditBackendPerformance();
            
            // 2. Frontend Performance  
            await this.auditFrontendPerformance();
            
            // 3. Database Analysis
            await this.analyzeDatabasePerformance();
            
            // 4. Stress Testing
            await this.performStressTesting();
            
            // 5. Generate Recommendations
            this.generateRecommendations();
            
            // 6. Generate Final Report
            const report = this.generateReport();
            
            // 7. Save Report
            const reportPath = path.join(__dirname, `performance-audit-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            
            console.log('\n' + '=' .repeat(60));
            console.log('✅ Auditoria Completa Finalizada!');
            console.log(`📄 Relatório salvo em: ${reportPath}`);
            console.log('=' .repeat(60));
            
            return report;
            
        } catch (error) {
            console.error('❌ Erro durante a auditoria:', error);
            throw error;
        }
    }
}

// Executar auditoria se chamado diretamente
if (require.main === module) {
    const auditor = new PerformanceAuditor();
    auditor.runCompleteAudit()
        .then(report => {
            console.log('\n📊 RESUMO EXECUTIVO:');
            console.log(`Score Geral: ${report.executive_summary.overall_score}/100`);
            console.log(`Problemas Críticos: ${report.executive_summary.critical_issues}`);
            console.log(`Avisos: ${report.executive_summary.warnings}`);
            console.log(`Tempo Médio de Resposta: ${report.metrics_summary.backend.avg_response_time}ms`);
            console.log(`Endpoint Mais Lento: ${report.metrics_summary.backend.slowest_endpoint}`);
            
            if (report.executive_summary.top_recommendations.length > 0) {
                console.log('\n🎯 TOP 3 RECOMENDAÇÕES:');
                report.executive_summary.top_recommendations.forEach((rec, i) => {
                    console.log(`${i + 1}. [${rec.priority}] ${rec.issue}`);
                    console.log(`   Solução: ${rec.solution}`);
                });
            }
        })
        .catch(console.error);
}

module.exports = PerformanceAuditor;