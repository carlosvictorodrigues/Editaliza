// frontend-performance-analysis.js - Análise Específica de Performance Frontend
const fs = require('fs');
const path = require('path');

class FrontendPerformanceAnalyzer {
    constructor() {
        this.baseDir = __dirname;
        this.results = {
            timestamp: new Date().toISOString(),
            code_quality: {},
            performance_issues: [],
            recommendations: [],
            metrics: {}
        };
    }

    // ===== ANÁLISE DE QUALIDADE DO CÓDIGO =====
    analyzeCodeQuality() {
        console.log('🔍 Analisando Qualidade do Código JavaScript...');
        
        const jsDir = path.join(this.baseDir, 'js');
        const files = this.getAllJSFiles(jsDir);
        
        let totalSize = 0;
        let totalLines = 0;
        const issues = [];
        
        files.forEach(file => {
            const content = fs.readFileSync(file.path, 'utf8');
            const lines = content.split('\n');
            const size = Buffer.byteLength(content, 'utf8');
            
            totalSize += size;
            totalLines += lines.length;
            
            // Análise específica do arquivo
            const fileAnalysis = this.analyzeJSFile(file.path, content, lines);
            if (fileAnalysis.issues.length > 0) {
                issues.push({
                    file: file.name,
                    path: file.path,
                    size: Math.round(size / 1024),
                    lines: lines.length,
                    issues: fileAnalysis.issues
                });
            }
        });
        
        this.results.code_quality = {
            total_files: files.length,
            total_size_kb: Math.round(totalSize / 1024),
            total_lines: totalLines,
            avg_file_size_kb: Math.round((totalSize / files.length) / 1024),
            files_with_issues: issues.length,
            issues
        };
    }

    getAllJSFiles(dir) {
        let files = [];
        
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                files = files.concat(this.getAllJSFiles(itemPath));
            } else if (item.endsWith('.js') && !item.includes('desktop.ini')) {
                files.push({
                    name: item,
                    path: itemPath,
                    relativePath: path.relative(this.baseDir, itemPath)
                });
            }
        });
        
        return files;
    }

    analyzeJSFile(filePath, content, lines) {
        const issues = [];
        const fileName = path.basename(filePath);
        
        // 1. Console.log statements (performance issue)
        const consoleRegex = /console\.(log|warn|error|debug|info)/g;
        const consoleMatches = content.match(consoleRegex);
        if (consoleMatches && consoleMatches.length > 5) {
            issues.push({
                type: 'EXCESSIVE_CONSOLE_LOGS',
                severity: 'MEDIUM',
                count: consoleMatches.length,
                description: 'Muitos console.log podem impactar performance'
            });
        }
        
        // 2. Large functions (readability and performance)
        const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{/g;
        let functionCount = 0;
        const maxFunctionSize = 0;
        
        const functions = content.match(functionRegex);
        if (functions) {
            functionCount = functions.length;
            
            // Estimar tamanho das funções (aproximação)
            const avgFunctionSize = Math.round(lines.length / functionCount);
            if (avgFunctionSize > 50) {
                issues.push({
                    type: 'LARGE_FUNCTIONS',
                    severity: 'MEDIUM',
                    avgSize: avgFunctionSize,
                    description: 'Funções muito grandes podem impactar maintainability'
                });
            }
        }
        
        // 3. jQuery usage (performance concern)
        if (content.includes('$') && content.includes('jquery')) {
            issues.push({
                type: 'JQUERY_USAGE',
                severity: 'LOW',
                description: 'jQuery pode ser substituído por vanilla JS para melhor performance'
            });
        }
        
        // 4. Inline event handlers (bad practice)
        const inlineEventRegex = /on\w+\s*=\s*["'][^"']*["']/g;
        const inlineEvents = content.match(inlineEventRegex);
        if (inlineEvents && inlineEvents.length > 0) {
            issues.push({
                type: 'INLINE_EVENT_HANDLERS',
                severity: 'MEDIUM',
                count: inlineEvents.length,
                description: 'Event handlers inline podem causar memory leaks'
            });
        }
        
        // 5. Global variables (memory and collision issues)
        const globalVarRegex = /^(?!.*\/\/.*).*\bvar\s+\w+/gm;
        const globalVars = content.match(globalVarRegex);
        if (globalVars && globalVars.length > 5) {
            issues.push({
                type: 'EXCESSIVE_GLOBAL_VARS',
                severity: 'MEDIUM',
                count: globalVars.length,
                description: 'Muitas variáveis globais podem causar conflitos'
            });
        }
        
        // 6. Missing error handling
        const tryRegex = /try\s*\{/g;
        const catchRegex = /catch\s*\(/g;
        const asyncRegex = /async\s+function|await\s+/g;
        
        const tryCount = (content.match(tryRegex) || []).length;
        const catchCount = (content.match(catchRegex) || []).length;
        const asyncCount = (content.match(asyncRegex) || []).length;
        
        if (asyncCount > 0 && catchCount === 0) {
            issues.push({
                type: 'MISSING_ERROR_HANDLING',
                severity: 'HIGH',
                description: 'Async functions sem error handling podem causar crashes'
            });
        }
        
        // 7. Memory leak patterns
        if (content.includes('setInterval') && !content.includes('clearInterval')) {
            issues.push({
                type: 'POTENTIAL_MEMORY_LEAK',
                severity: 'HIGH',
                description: 'setInterval sem clearInterval pode causar memory leak'
            });
        }
        
        // 8. Performance anti-patterns
        if (content.includes('document.getElementById') && 
            (content.match(/document\.getElementById/g) || []).length > 10) {
            issues.push({
                type: 'EXCESSIVE_DOM_QUERIES',
                severity: 'MEDIUM',
                description: 'Muitas consultas DOM podem impactar performance'
            });
        }
        
        return { issues };
    }

    // ===== ANÁLISE DE PERFORMANCE ESPECÍFICA =====
    analyzePerformanceIssues() {
        console.log('⚡ Analisando Problemas de Performance...');
        
        const issues = [];
        
        // 1. Verificar arquivos duplicados
        const duplicates = this.findDuplicateFiles();
        if (duplicates.length > 0) {
            issues.push({
                type: 'DUPLICATE_FILES',
                severity: 'MEDIUM',
                files: duplicates,
                impact: 'Bundle size desnecessariamente grande'
            });
        }
        
        // 2. Verificar arquivos muito grandes
        const largeFiles = this.findLargeFiles();
        if (largeFiles.length > 0) {
            issues.push({
                type: 'LARGE_FILES',
                severity: 'MEDIUM',
                files: largeFiles,
                impact: 'Tempo de carregamento elevado'
            });
        }
        
        // 3. Verificar dependências externas
        const externalDeps = this.findExternalDependencies();
        if (externalDeps.length > 0) {
            issues.push({
                type: 'EXTERNAL_DEPENDENCIES',
                severity: 'LOW',
                dependencies: externalDeps,
                impact: 'Dependência de recursos externos'
            });
        }
        
        this.results.performance_issues = issues;
    }

    findDuplicateFiles() {
        const jsDir = path.join(this.baseDir, 'js');
        const files = this.getAllJSFiles(jsDir);
        const duplicates = [];
        
        // Procurar por padrões de nomes que indicam duplicação
        const suspiciousPatterns = [
            / - Copia/,
            /-backup/,
            /-old/,
            /-legacy/,
            /\.backup\./,
            /\.old\./
        ];
        
        files.forEach(file => {
            if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
                const stats = fs.statSync(file.path);
                duplicates.push({
                    name: file.name,
                    path: file.relativePath,
                    size_kb: Math.round(stats.size / 1024)
                });
            }
        });
        
        return duplicates;
    }

    findLargeFiles() {
        const jsDir = path.join(this.baseDir, 'js');
        const files = this.getAllJSFiles(jsDir);
        const largeFiles = [];
        
        files.forEach(file => {
            const stats = fs.statSync(file.path);
            const sizeKB = Math.round(stats.size / 1024);
            
            if (sizeKB > 100) { // Arquivos maiores que 100KB
                largeFiles.push({
                    name: file.name,
                    path: file.relativePath,
                    size_kb: sizeKB
                });
            }
        });
        
        return largeFiles.sort((a, b) => b.size_kb - a.size_kb);
    }

    findExternalDependencies() {
        const htmlFiles = ['cronograma.html', 'login.html', 'register.html', 'dashboard.html'];
        const dependencies = [];
        
        htmlFiles.forEach(htmlFile => {
            const htmlPath = path.join(this.baseDir, htmlFile);
            if (fs.existsSync(htmlPath)) {
                const content = fs.readFileSync(htmlPath, 'utf8');
                
                // Procurar por CDNs e recursos externos
                const externalRegex = /(?:src|href)=["']https?:\/\/[^"']+["']/g;
                const matches = content.match(externalRegex);
                
                if (matches) {
                    matches.forEach(match => {
                        const url = match.match(/https?:\/\/[^"']+/)[0];
                        if (!dependencies.some(dep => dep.url === url)) {
                            dependencies.push({
                                file: htmlFile,
                                url: url,
                                type: url.includes('.js') ? 'JavaScript' :
                                      url.includes('.css') ? 'CSS' :
                                      url.includes('font') ? 'Font' : 'Other'
                            });
                        }
                    });
                }
            }
        });
        
        return dependencies;
    }

    // ===== GERAÇÃO DE RECOMENDAÇÕES =====
    generateRecommendations() {
        console.log('💡 Gerando Recomendações de Otimização...');
        
        const recommendations = [];
        
        // Baseado na análise de qualidade de código
        if (this.results.code_quality.files_with_issues > 0) {
            recommendations.push({
                category: 'CODE_QUALITY',
                priority: 'MEDIUM',
                title: 'Melhorar Qualidade do Código',
                description: `${this.results.code_quality.files_with_issues} arquivos com problemas de código`,
                actions: [
                    'Reduzir uso de console.log em produção',
                    'Quebrar funções grandes em menores',
                    'Implementar error handling em async functions',
                    'Evitar variáveis globais desnecessárias'
                ],
                impact: 'Melhora maintainability e reduz bugs'
            });
        }
        
        // Baseado em problemas de performance
        this.results.performance_issues.forEach(issue => {
            switch (issue.type) {
                case 'DUPLICATE_FILES':
                    recommendations.push({
                        category: 'BUNDLE_OPTIMIZATION',
                        priority: 'HIGH',
                        title: 'Remover Arquivos Duplicados',
                        description: `${issue.files.length} arquivos duplicados encontrados`,
                        actions: issue.files.map(f => `Remover ${f.name} (${f.size_kb}KB)`),
                        impact: `Redução de ${issue.files.reduce((sum, f) => sum + f.size_kb, 0)}KB no bundle`
                    });
                    break;
                    
                case 'LARGE_FILES':
                    recommendations.push({
                        category: 'CODE_SPLITTING',
                        priority: 'MEDIUM',
                        title: 'Implementar Code Splitting',
                        description: `${issue.files.length} arquivos grandes encontrados`,
                        actions: [
                            'Quebrar arquivos grandes em módulos menores',
                            'Implementar lazy loading para funcionalidades não críticas',
                            'Considerar bundling inteligente'
                        ],
                        impact: 'Redução no tempo de carregamento inicial'
                    });
                    break;
                    
                case 'EXTERNAL_DEPENDENCIES':
                    recommendations.push({
                        category: 'DEPENDENCY_OPTIMIZATION',
                        priority: 'LOW',
                        title: 'Otimizar Dependências Externas',
                        description: `${issue.dependencies.length} dependências externas`,
                        actions: [
                            'Considerar self-hosting de recursos críticos',
                            'Implementar fallbacks para CDNs',
                            'Usar resource hints (preload, prefetch)'
                        ],
                        impact: 'Melhora confiabilidade e performance'
                    });
                    break;
            }
        });
        
        // Recomendações gerais de performance
        if (this.results.code_quality.total_size_kb > 500) {
            recommendations.push({
                category: 'BUNDLE_SIZE',
                priority: 'MEDIUM',
                title: 'Reduzir Tamanho do Bundle',
                description: `Bundle atual: ${this.results.code_quality.total_size_kb}KB`,
                actions: [
                    'Implementar tree shaking',
                    'Minificar e compactar código',
                    'Remover código não utilizado',
                    'Usar compression (gzip/brotli)'
                ],
                impact: 'Melhora significativa no tempo de carregamento'
            });
        }
        
        this.results.recommendations = recommendations.sort((a, b) => {
            const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    // ===== CALCULAR MÉTRICAS FINAIS =====
    calculateMetrics() {
        console.log('📊 Calculando Métricas Finais...');
        
        const totalIssues = this.results.code_quality.files_with_issues + 
                           this.results.performance_issues.length;
        
        const severity = this.results.code_quality.issues
            .concat(this.results.performance_issues)
            .reduce((acc, item) => {
                if (item.issues) {
                    item.issues.forEach(issue => {
                        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
                    });
                } else if (item.severity) {
                    acc[item.severity] = (acc[item.severity] || 0) + 1;
                }
                return acc;
            }, {});
        
        this.results.metrics = {
            total_files_analyzed: this.results.code_quality.total_files,
            total_bundle_size_kb: this.results.code_quality.total_size_kb,
            total_issues: totalIssues,
            critical_issues: severity.HIGH || 0,
            medium_issues: severity.MEDIUM || 0,
            low_issues: severity.LOW || 0,
            performance_score: this.calculatePerformanceScore(severity),
            recommendations_count: this.results.recommendations.length
        };
    }

    calculatePerformanceScore(severity) {
        let score = 100;
        
        score -= (severity.HIGH || 0) * 15;
        score -= (severity.MEDIUM || 0) * 8;
        score -= (severity.LOW || 0) * 3;
        
        return Math.max(0, score);
    }

    // ===== MÉTODO PRINCIPAL =====
    async runCompleteAnalysis() {
        console.log('🚀 Iniciando Análise Completa do Frontend...');
        console.log('=' .repeat(50));
        
        try {
            // 1. Analisar qualidade do código
            this.analyzeCodeQuality();
            
            // 2. Analisar problemas de performance
            this.analyzePerformanceIssues();
            
            // 3. Gerar recomendações
            this.generateRecommendations();
            
            // 4. Calcular métricas
            this.calculateMetrics();
            
            // 5. Salvar relatório
            const reportPath = path.join(this.baseDir, `frontend-analysis-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
            
            console.log('\n' + '=' .repeat(50));
            console.log('✅ Análise Frontend Finalizada!');
            console.log(`📄 Relatório salvo em: ${reportPath}`);
            console.log('=' .repeat(50));
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Erro durante análise:', error);
            throw error;
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const analyzer = new FrontendPerformanceAnalyzer();
    analyzer.runCompleteAnalysis()
        .then(results => {
            console.log('\n📊 RESUMO DA ANÁLISE FRONTEND:');
            console.log(`Arquivos Analisados: ${results.metrics.total_files_analyzed}`);
            console.log(`Bundle Size: ${results.metrics.total_bundle_size_kb}KB`);
            console.log(`Performance Score: ${results.metrics.performance_score}/100`);
            console.log(`Problemas Críticos: ${results.metrics.critical_issues}`);
            console.log(`Problemas Médios: ${results.metrics.medium_issues}`);
            console.log(`Recomendações: ${results.metrics.recommendations_count}`);
            
            if (results.recommendations.length > 0) {
                console.log('\n🎯 TOP RECOMENDAÇÕES:');
                results.recommendations.slice(0, 3).forEach((rec, i) => {
                    console.log(`${i + 1}. [${rec.priority}] ${rec.title}`);
                });
            }
        })
        .catch(console.error);
}

module.exports = FrontendPerformanceAnalyzer;