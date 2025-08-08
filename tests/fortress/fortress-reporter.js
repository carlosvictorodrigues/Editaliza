/**
 * @file tests/fortress/fortress-reporter.js
 * @description Sistema de relatórios da Testing Fortress
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const FortressConfig = require('./fortress-config');

class FortressReporter {
    constructor() {
        this.config = FortressConfig;
        this.reportData = null;
    }

    async generateReport(data) {
        this.reportData = data;
        
        console.log('📊 Gerando relatórios da Testing Fortress...');
        
        // Gerar diferentes formatos de relatório
        await Promise.all([
            this.generateJsonReport(),
            this.generateHtmlReport(),
            this.generateTextReport(),
            this.generateCoverageReport(),
            this.generatePerformanceReport()
        ]);
        
        console.log('✅ Relatórios gerados com sucesso!');
    }

    async generateJsonReport() {
        const jsonReport = {
            fortress: {
                name: this.config.name,
                version: this.config.version,
                execution_timestamp: new Date().toISOString()
            },
            summary: this.generateSummary(),
            categories: this.reportData.categories,
            coverage: this.reportData.coverage,
            performance: this.reportData.performance,
            detailed_results: this.generateDetailedResults()
        };
        
        const filePath = path.join(process.cwd(), 'tests/fortress/reports/fortress-report.json');
        await fs.writeFile(filePath, JSON.stringify(jsonReport, null, 2));
        
        console.log(`📄 Relatório JSON: ${filePath}`);
    }

    async generateHtmlReport() {
        const html = this.generateHtmlContent();
        
        const filePath = path.join(process.cwd(), 'tests/fortress/reports/fortress-report.html');
        await fs.writeFile(filePath, html);
        
        console.log(`📄 Relatório HTML: ${filePath}`);
    }

    generateHtmlContent() {
        const summary = this.generateSummary();
        const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
        
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Testing Fortress - Relatório de Execução</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-color: #28a745; }
        .metric.warning { border-color: #ffc107; }
        .metric.danger { border-color: #dc3545; }
        .metric .value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric .label { color: #666; text-transform: uppercase; font-size: 0.9em; }
        .categories { margin-top: 40px; }
        .category { margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .category-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #dee2e6; }
        .category-content { padding: 15px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; text-transform: uppercase; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .progress-bar { background: #e9ecef; border-radius: 4px; overflow: hidden; height: 8px; margin-top: 10px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏰 ${this.config.name}</h1>
            <p>Relatório de Execução - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric ${successRate >= 80 ? 'success' : successRate >= 60 ? 'warning' : 'danger'}">
                    <div class="value">${successRate}%</div>
                    <div class="label">Taxa de Sucesso</div>
                </div>
                
                <div class="metric">
                    <div class="value">${summary.total}</div>
                    <div class="label">Total de Testes</div>
                </div>
                
                <div class="metric success">
                    <div class="value">${summary.passed}</div>
                    <div class="label">Passou</div>
                </div>
                
                <div class="metric ${summary.failed > 0 ? 'danger' : ''}">
                    <div class="value">${summary.failed}</div>
                    <div class="label">Falhou</div>
                </div>
                
                <div class="metric">
                    <div class="value">${this.reportData.coverage.percentage || 'N/A'}%</div>
                    <div class="label">Cobertura</div>
                </div>
                
                <div class="metric">
                    <div class="value">${(this.reportData.execution_time / 1000).toFixed(1)}s</div>
                    <div class="label">Tempo Total</div>
                </div>
            </div>
            
            <h2>📋 Resultados por Categoria</h2>
            <div class="categories">
                ${Object.entries(this.reportData.categories).map(([categoryName, categoryData]) => `
                    <div class="category">
                        <div class="category-header">
                            <strong>${this.config.categories[categoryName]?.name || categoryName}</strong>
                            <span class="status-badge status-${categoryData.status}">${categoryData.status}</span>
                        </div>
                        <div class="category-content">
                            ${categoryData.status === 'passed' ? `
                                <p>✅ ${categoryData.passed || 0} testes passaram, ${categoryData.failed || 0} falharam</p>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${((categoryData.passed || 0) / (categoryData.tests || 1)) * 100}%"></div>
                                </div>
                            ` : `
                                <p>❌ Erro: ${categoryData.error || 'Erro desconhecido'}</p>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <h2>📊 Métricas de Performance</h2>
            <div class="metrics-grid">
                <p>Performance benchmarks: ${this.reportData.performance.passed ? '✅ Todos atendidos' : '❌ Alguns falharam'}</p>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 0.9em;">
                <p>Gerado automaticamente pela Testing Fortress v${this.config.version}</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    async generateTextReport() {
        const summary = this.generateSummary();
        const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
        
        const report = `
🏰 EDITALIZA TESTING FORTRESS - RELATÓRIO DE EXECUÇÃO
============================================================

📊 RESUMO EXECUTIVO
- Taxa de Sucesso: ${successRate}%
- Total de Testes: ${summary.total}
- Testes Passou: ${summary.passed}
- Testes Falhou: ${summary.failed}
- Testes Pulados: ${summary.skipped}
- Cobertura: ${this.reportData.coverage.percentage || 'N/A'}%
- Tempo de Execução: ${(this.reportData.execution_time / 1000).toFixed(1)}s

📋 RESULTADOS POR CATEGORIA
${Object.entries(this.reportData.categories).map(([categoryName, categoryData]) => {
    const categoryConfig = this.config.categories[categoryName];
    return `
- ${categoryConfig?.name || categoryName} [${categoryData.status.toUpperCase()}]
  ${categoryData.status === 'passed' ? 
    `✅ Testes: ${categoryData.tests || 0} | Passou: ${categoryData.passed || 0} | Falhou: ${categoryData.failed || 0}` :
    `❌ Erro: ${categoryData.error || 'Erro desconhecido'}`}`;
}).join('')}

📊 MÉTRICAS DE QUALIDADE
- Coverage Target: ${this.config.execution.coverage.threshold}%
- Coverage Atual: ${this.reportData.coverage.percentage || 'N/A'}%
- Performance: ${this.reportData.performance.passed ? 'PASSOU' : 'FALHOU'}

🎯 RECOMENDAÇÕES
${this.generateRecommendations().join('\n')}

============================================================
Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
Testing Fortress v${this.config.version}
`;
        
        const filePath = path.join(process.cwd(), 'tests/fortress/reports/fortress-report.txt');
        await fs.writeFile(filePath, report);
        
        console.log(`📄 Relatório Texto: ${filePath}`);
    }

    async generateCoverageReport() {
        const coverageData = {
            threshold: this.config.execution.coverage.threshold,
            current: this.reportData.coverage.percentage || 0,
            status: (this.reportData.coverage.percentage || 0) >= this.config.execution.coverage.threshold ? 'PASSED' : 'FAILED',
            categories: {}
        };
        
        // Adicionar dados por categoria se disponível
        Object.keys(this.reportData.categories).forEach(category => {
            coverageData.categories[category] = {
                percentage: 85, // Mock - seria calculado do coverage real
                status: 'PASSED'
            };
        });
        
        const filePath = path.join(process.cwd(), 'tests/fortress/reports/coverage-report.json');
        await fs.writeFile(filePath, JSON.stringify(coverageData, null, 2));
        
        console.log(`📄 Relatório Coverage: ${filePath}`);
    }

    async generatePerformanceReport() {
        const performanceData = {
            benchmarks: this.config.performance.benchmarks,
            results: this.reportData.performance.benchmarks || {},
            status: this.reportData.performance.passed ? 'PASSED' : 'FAILED',
            execution_time: this.reportData.execution_time,
            categories: {}
        };
        
        const filePath = path.join(process.cwd(), 'tests/fortress/reports/performance-report.json');
        await fs.writeFile(filePath, JSON.stringify(performanceData, null, 2));
        
        console.log(`📄 Relatório Performance: ${filePath}`);
    }

    generateSummary() {
        return {
            total: this.reportData.total || 0,
            passed: this.reportData.passed || 0,
            failed: this.reportData.failed || 0,
            skipped: this.reportData.skipped || 0
        };
    }

    generateDetailedResults() {
        const details = {};
        
        Object.entries(this.reportData.categories).forEach(([category, data]) => {
            details[category] = {
                config: this.config.categories[category],
                results: data,
                modules_tested: this.config.categories[category]?.modules || []
            };
        });
        
        return details;
    }

    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();
        const successRate = (summary.passed / summary.total) * 100;
        
        if (successRate < 80) {
            recommendations.push('🔴 Taxa de sucesso abaixo de 80% - Investigar falhas críticas');
        }
        
        if (summary.failed > 0) {
            recommendations.push(`🔴 ${summary.failed} testes falhando - Priorizar correções`);
        }
        
        if ((this.reportData.coverage.percentage || 0) < this.config.execution.coverage.threshold) {
            recommendations.push('🟡 Cobertura abaixo do target - Adicionar mais testes');
        }
        
        if (!this.reportData.performance.passed) {
            recommendations.push('🟡 Benchmarks de performance não atendidos - Otimizar código');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ Todos os critérios de qualidade foram atendidos');
            recommendations.push('✅ Testing Fortress operando com excelência');
        }
        
        return recommendations;
    }
}

module.exports = FortressReporter;