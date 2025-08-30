#!/usr/bin/env node

/**
 * FASE 4 - Validação Final
 * 
 * Script para validar que todas as chamadas fetch() foram substituídas
 * por app.apiFetch() e gerar relatório de status
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public');

class ApiFetchValidator {
    constructor() {
        this.report = {
            startTime: new Date(),
            totalFiles: 0,
            filesWithFetch: [],
            filesWithAppApiFetch: [],
            mainPages: {
                status: {},
                files: ['home.html', 'cronograma.html', 'profile.html', 'login.html', 'register.html', 'dashboard.html']
            },
            testFiles: {
                converted: [],
                remaining: []
            },
            summary: {}
        };
    }

    // Analisar um arquivo
    analyzeFile(filename) {
        const filePath = path.join(PUBLIC_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return null;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        
        // Contar chamadas fetch() (excluindo a implementação em app.js)
        const fetchMatches = content.match(/(?<!app\.)fetch\s*\(/g);
        const fetchCount = fetchMatches ? fetchMatches.length : 0;
        
        // Contar chamadas app.apiFetch()
        const appFetchMatches = content.match(/app\.apiFetch\s*\(/g);
        const appFetchCount = appFetchMatches ? appFetchMatches.length : 0;
        
        // Verificar se inclui app.js
        const hasAppJs = content.includes('js/app.js') || content.includes('src="js/app.js"');
        
        return {
            filename,
            fetchCount,
            appFetchCount,
            hasAppJs,
            size: content.length,
            isMainPage: this.report.mainPages.files.includes(filename),
            isTestFile: filename.includes('test')
        };
    }

    // Analisar todos os arquivos HTML
    analyzeAllFiles() {
        console.log('📊 Analisando todos os arquivos HTML...\n');

        const htmlFiles = fs.readdirSync(PUBLIC_DIR)
            .filter(file => file.endsWith('.html'));

        this.report.totalFiles = htmlFiles.length;

        for (const filename of htmlFiles) {
            const analysis = this.analyzeFile(filename);
            if (!analysis) continue;

            // Categorizar arquivos
            if (analysis.fetchCount > 0) {
                this.report.filesWithFetch.push({
                    filename: analysis.filename,
                    count: analysis.fetchCount
                });
            }

            if (analysis.appFetchCount > 0) {
                this.report.filesWithAppApiFetch.push({
                    filename: analysis.filename,
                    count: analysis.appFetchCount,
                    hasAppJs: analysis.hasAppJs
                });
            }

            // Status das páginas principais
            if (analysis.isMainPage) {
                this.report.mainPages.status[filename] = {
                    fetchCount: analysis.fetchCount,
                    appFetchCount: analysis.appFetchCount,
                    hasAppJs: analysis.hasAppJs,
                    status: this.getPageStatus(analysis)
                };
            }

            // Categorizar arquivos de teste
            if (analysis.isTestFile) {
                if (analysis.fetchCount === 0 && analysis.appFetchCount > 0) {
                    this.report.testFiles.converted.push(filename);
                } else if (analysis.fetchCount > 0) {
                    this.report.testFiles.remaining.push({
                        filename,
                        fetchCount: analysis.fetchCount,
                        appFetchCount: analysis.appFetchCount
                    });
                }
            }

            // Log do arquivo analisado
            const status = this.getFileStatusIcon(analysis);
            console.log(`${status} ${filename.padEnd(35)} | fetch(): ${analysis.fetchCount.toString().padStart(2)} | app.apiFetch(): ${analysis.appFetchCount.toString().padStart(2)} | app.js: ${analysis.hasAppJs ? '✅' : '❌'}`);
        }
    }

    // Determinar status da página
    getPageStatus(analysis) {
        if (analysis.fetchCount > 0) return 'NEEDS_CONVERSION';
        if (analysis.appFetchCount > 0 && analysis.hasAppJs) return 'CONVERTED';
        if (analysis.appFetchCount > 0 && !analysis.hasAppJs) return 'MISSING_APP_JS';
        return 'NO_API_CALLS';
    }

    // Ícone de status do arquivo
    getFileStatusIcon(analysis) {
        if (analysis.fetchCount > 0) return '🔴'; // Tem fetch() direto
        if (analysis.appFetchCount > 0 && analysis.hasAppJs) return '🟢'; // Convertido corretamente
        if (analysis.appFetchCount > 0 && !analysis.hasAppJs) return '🟡'; // Falta app.js
        return '⚪'; // Sem chamadas API
    }

    // Gerar relatório final
    generateReport() {
        const endTime = new Date();
        const duration = endTime - this.report.startTime;

        console.log(`\n${'='.repeat(80)}`);
        console.log("📊 RELATÓRIO FINAL - VALIDAÇÃO FASE 4: Padronização app.apiFetch()");
        console.log(`${'='.repeat(80)}`);
        console.log(`⏱️  Tempo de análise: ${duration}ms`);
        console.log(`📁 Total de arquivos HTML: ${this.report.totalFiles}`);
        console.log(`🔴 Arquivos com fetch() direto: ${this.report.filesWithFetch.length}`);
        console.log(`🟢 Arquivos usando app.apiFetch(): ${this.report.filesWithAppApiFetch.length}`);

        // Status das páginas principais
        console.log("\n📋 STATUS DAS PÁGINAS PRINCIPAIS:");
        const mainPageStatuses = Object.entries(this.report.mainPages.status);
        if (mainPageStatuses.length === 0) {
            console.log('   ❌ Nenhuma página principal encontrada!');
        } else {
            mainPageStatuses.forEach(([filename, status]) => {
                const icon = status.status === 'CONVERTED' ? '🟢' : 
                           status.status === 'NEEDS_CONVERSION' ? '🔴' : 
                           status.status === 'MISSING_APP_JS' ? '🟡' : '⚪';
                console.log(`   ${icon} ${filename}: ${status.status}`);
                if (status.fetchCount > 0) {
                    console.log(`      ⚠️  Ainda tem ${status.fetchCount} chamadas fetch() diretas!`);
                }
                if (status.appFetchCount > 0 && !status.hasAppJs) {
                    console.log("⚠️  Usando app.apiFetch() mas falta incluir js/app.js!");
                }
            });
        }

        // Arquivos de teste
        console.log("\n🧪 STATUS DOS ARQUIVOS DE TESTE:");
        console.log(`   🟢 Convertidos: ${this.report.testFiles.converted.length}`);
        console.log(`   🔴 Ainda precisam de conversão: ${this.report.testFiles.remaining.length}`);

        if (this.report.testFiles.remaining.length > 0) {
            console.log("\n   📄 Arquivos que ainda precisam de conversão:");
            this.report.testFiles.remaining.forEach(file => {
                console.log(`      🔴 ${file.filename}: ${file.fetchCount} fetch() diretas`);
            });
        }

        // Arquivos com problemas
        if (this.report.filesWithFetch.length > 0) {
            console.log("\n⚠️  ARQUIVOS COM FETCH() DIRETO:");
            this.report.filesWithFetch.forEach(file => {
                console.log(`   🔴 ${file.filename}: ${file.count} ocorrências`);
            });
        }

        // Calcular sucesso geral
        const mainPagesConverted = mainPageStatuses.filter(([_, status]) => 
            status.status === 'CONVERTED' || status.status === 'NO_API_CALLS').length;
        const mainPagesTotal = mainPageStatuses.length;
        const conversionRate = mainPagesTotal > 0 ? Math.round((mainPagesConverted / mainPagesTotal) * 100) : 100;

        this.report.summary = {
            conversionRate,
            mainPagesConverted,
            mainPagesTotal,
            totalFetchCalls: this.report.filesWithFetch.reduce((sum, f) => sum + f.count, 0),
            totalAppFetchCalls: this.report.filesWithAppApiFetch.reduce((sum, f) => sum + f.count, 0),
            success: this.report.filesWithFetch.length === 0 || 
                    this.report.filesWithFetch.every(f => f.filename.includes('js/app.js') || f.filename.includes('sw.js'))
        };

        console.log("\n📊 RESUMO GERAL:");
        console.log(`   🎯 Taxa de conversão páginas principais: ${conversionRate}%`);
        console.log(`   📞 Total de chamadas fetch() restantes: ${this.report.summary.totalFetchCalls}`);
        console.log(`   ✨ Total de chamadas app.apiFetch(): ${this.report.summary.totalAppFetchCalls}`);
        
        if (this.report.summary.success) {
            console.log("\n🎉 FASE 4 VALIDAÇÃO: SUCESSO TOTAL!");
            console.log("✨ Todas as chamadas foram padronizadas para app.apiFetch()");
        } else {
            console.log("\n⚠️  FASE 4 VALIDAÇÃO: PENDÊNCIAS ENCONTRADAS");
            console.log("🔧 Alguns arquivos ainda precisam de conversão manual");
        }

        console.log(`${'='.repeat(80)}\n`);

        // Salvar relatório
        const reportPath = path.join(__dirname, '../reports/fase4-validacao-final.json');
        const reportDir = path.dirname(reportPath);
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const fullReport = {
            ...this.report,
            endTime,
            duration
        };

        fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf8');
        console.log(`📄 Relatório detalhado salvo em: ${reportPath}`);

        return this.report.summary.success;
    }

    // Executar validação completa
    execute() {
        console.log('🔍 INICIANDO VALIDAÇÃO FINAL - FASE 4: Padronização app.apiFetch()\n');
        
        this.analyzeAllFiles();
        return this.generateReport();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const validator = new ApiFetchValidator();
    const success = validator.execute();
    process.exit(success ? 0 : 1);
}

module.exports = ApiFetchValidator;