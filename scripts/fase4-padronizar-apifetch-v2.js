#!/usr/bin/env node

/**
 * FASE 4 - Padronização de Chamadas API (VERSÃO 2)
 * 
 * Script mais robusto para substituir TODAS as chamadas fetch() por app.apiFetch()
 * Inclui detecção de template literals e padrões mais complexos
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups/fase4-v2');
const PUBLIC_DIR = path.join(__dirname, '../public');

class ApiFetchStandardizerV2 {
    constructor() {
        this.report = {
            processed: [],
            errors: [],
            changes: [],
            startTime: new Date()
        };
    }

    // Criar diretório de backup
    createBackupDir() {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            console.log(`📁 Diretório de backup criado: ${BACKUP_DIR}`);
        }
    }

    // Buscar arquivos HTML que contêm fetch()
    findFilesWithFetch() {
        const htmlFiles = fs.readdirSync(PUBLIC_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => path.join(PUBLIC_DIR, file));

        const filesWithFetch = [];
        
        for (const filePath of htmlFiles) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (this.hasFetchCalls(content)) {
                const filename = path.basename(filePath);
                filesWithFetch.push(filename);
            }
        }

        return filesWithFetch;
    }

    // Verificar se arquivo contém chamadas fetch()
    hasFetchCalls(content) {
        // Padrões mais robustos para detectar fetch()
        const patterns = [
            /fetch\s*\(\s*['"`]/,                    // fetch('url' ou fetch("url" ou fetch(`url`
            /fetch\s*\(\s*\$\{[^}]+\}/,              // fetch(${variable})
            /await\s+fetch\s*\(/,                    // await fetch(
            /\.then\s*\(\s*fetch\s*\(/,              // .then(fetch(
            /return\s+fetch\s*\(/                    // return fetch(
        ];

        return patterns.some(pattern => pattern.test(content));
    }

    // Fazer backup de um arquivo
    backupFile(filename) {
        const sourcePath = path.join(PUBLIC_DIR, filename);
        const backupPath = path.join(BACKUP_DIR, filename);
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, backupPath);
            console.log(`💾 Backup criado: ${filename}`);
            return true;
        }
        return false;
    }

    // Analisar todas as chamadas fetch() em um arquivo
    analyzeFetchCalls(content, filename) {
        const matches = [];
        
        // Padrão mais abrangente para capturar fetch() com diferentes formatos
        const fetchPatterns = [
            // fetch('string'), fetch("string")
            /fetch\s*\(\s*(['"])([^'"]+)\1\s*,?\s*({[^}]*})?\s*\)/g,
            // fetch(`template literal`)
            /fetch\s*\(\s*`([^`]+)`\s*,?\s*({[^}]*})?\s*\)/g,
            // fetch(${variable}) ou fetch(variable)
            /fetch\s*\(\s*([^,\)]+)\s*,?\s*({[^}]*})?\s*\)/g
        ];

        for (const pattern of fetchPatterns) {
            let match;
            pattern.lastIndex = 0; // Reset regex
            
            while ((match = pattern.exec(content)) !== null) {
                const fullMatch = match[0];
                let url, options;
                
                if (pattern.source.includes('`')) {
                    // Template literal
                    url = match[1];
                    options = match[2] || '{}';
                } else if (pattern.source.includes("['\"]+")) {
                    // String literal
                    url = match[2];
                    options = match[3] || '{}';
                } else {
                    // Variable ou expressão
                    url = match[1];
                    options = match[2] || '{}';
                }

                const lineNumber = content.substring(0, match.index).split('\n').length;
                
                matches.push({
                    full: fullMatch,
                    url: url,
                    options: options,
                    index: match.index,
                    line: lineNumber,
                    type: this.determineUrlType(url)
                });
            }
        }

        // Remover duplicatas (mesmo índice)
        const uniqueMatches = matches.filter((match, index, array) => {
            return array.findIndex(m => m.index === match.index) === index;
        });

        return uniqueMatches;
    }

    // Determinar tipo de URL (string, template, variable)
    determineUrlType(url) {
        if (url.includes('${')) return 'template';
        if (url.startsWith('/')) return 'string';
        if (url.includes('API_URL') || url.includes('apiUrl')) return 'variable';
        return 'other';
    }

    // Converter fetch() para app.apiFetch()
    convertFetchToApiFetch(fetchCall, url, options, urlType) {
        console.log(`  🔄 Convertendo: ${fetchCall.substring(0, 50)}...`);
        
        let newUrl = url;
        let cleanOptions = {};

        // Parse das options se existirem
        if (options && options !== '{}') {
            try {
                const cleanOptionsStr = options
                    .replace(/\/\*.*?\*\//g, '')
                    .replace(/\/\/.*$/gm, '');
                cleanOptions = eval(`(${cleanOptionsStr})`);
            } catch (e) {
                console.warn(`⚠️  Erro ao fazer parse das options: ${options}`);
                cleanOptions = {};
            }
        }

        // Processar URL baseado no tipo
        if (urlType === 'template') {
            // Template literal com ${API_URL}/api/path -> /api/path
            newUrl = url.replace(/\$\{[^}]*\}/, '');
            if (!newUrl.startsWith('/api/')) {
                if (newUrl.startsWith('/')) {
                    newUrl = '/api' + newUrl;
                } else {
                    newUrl = '/api/' + newUrl;
                }
            }
        } else if (urlType === 'variable') {
            // Assumir que a variável já contém a base URL
            if (url.includes('API_URL') && !url.includes('/api/')) {
                newUrl = url.replace(/\$\{[^}]*\}/, '') + '/api';
            }
        } else if (urlType === 'string') {
            // String simples
            if (!newUrl.startsWith('/api/')) {
                if (newUrl.startsWith('/')) {
                    newUrl = '/api' + newUrl;
                } else {
                    newUrl = '/api/' + newUrl;
                }
            }
        }

        // Remover headers que serão adicionados automaticamente
        if (cleanOptions.headers) {
            const headersToRemove = ['Content-Type', 'Authorization'];
            headersToRemove.forEach(header => {
                if (cleanOptions.headers[header]) {
                    delete cleanOptions.headers[header];
                }
            });
            
            if (Object.keys(cleanOptions.headers).length === 0) {
                delete cleanOptions.headers;
            }
        }

        // Construir nova chamada
        let newCall = `app.apiFetch('${newUrl}'`;
        
        if (Object.keys(cleanOptions).length > 0) {
            const optionsStr = JSON.stringify(cleanOptions, null, 4)
                .replace(/\n/g, '\n                ')
                .replace(/^\s{16}/, '');
            newCall += `, ${optionsStr}`;
        }
        
        newCall += ')';

        return newCall;
    }

    // Processar um arquivo
    processFile(filename) {
        console.log(`\n🔄 Processando: ${filename}`);
        
        const filePath = path.join(PUBLIC_DIR, filename);
        if (!fs.existsSync(filePath)) {
            const error = `Arquivo não encontrado: ${filename}`;
            this.report.errors.push(error);
            console.error(`❌ ${error}`);
            return false;
        }

        // Fazer backup
        if (!this.backupFile(filename)) {
            const error = `Falha ao criar backup de: ${filename}`;
            this.report.errors.push(error);
            console.error(`❌ ${error}`);
            return false;
        }

        // Ler arquivo
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Analisar fetch() calls
        const fetchCalls = this.analyzeFetchCalls(content, filename);
        console.log(`  📊 Encontradas ${fetchCalls.length} chamadas fetch()`);

        if (fetchCalls.length === 0) {
            console.log("✅ Nenhuma alteração necessária");
            this.report.processed.push({ file: filename, changes: 0 });
            return true;
        }

        // Verificar se o arquivo inclui app.js
        const hasAppJs = content.includes('js/app.js') || content.includes('src="js/app.js"');
        if (!hasAppJs) {
            const bodyCloseIndex = content.lastIndexOf('</body>');
            if (bodyCloseIndex !== -1) {
                const scriptTag = '    <script src="js/app.js"></script>\n';
                content = content.substring(0, bodyCloseIndex) + scriptTag + content.substring(bodyCloseIndex);
                console.log("📜 Adicionado script js/app.js");
            }
        }

        // Processar cada chamada fetch() (de trás para frente para manter índices)
        let changeCount = 0;
        for (let i = fetchCalls.length - 1; i >= 0; i--) {
            const fetchCall = fetchCalls[i];
            const newCall = this.convertFetchToApiFetch(
                fetchCall.full, 
                fetchCall.url, 
                fetchCall.options,
                fetchCall.type
            );
            
            // Substituir no conteúdo
            const before = content.substring(0, fetchCall.index);
            const after = content.substring(fetchCall.index + fetchCall.full.length);
            content = before + newCall + after;

            console.log(`  ✅ Linha ${fetchCall.line}: convertido para app.apiFetch()`);
            
            this.report.changes.push({
                file: filename,
                line: fetchCall.line,
                from: fetchCall.full,
                to: newCall,
                url: fetchCall.url,
                type: fetchCall.type
            });

            changeCount++;
        }

        // Salvar arquivo modificado
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`  🎉 ${filename} atualizado com ${changeCount} mudanças`);
        this.report.processed.push({ file: filename, changes: changeCount });
        
        return true;
    }

    // Gerar relatório final
    generateReport() {
        const endTime = new Date();
        const duration = endTime - this.report.startTime;

        console.log(`\n${'='.repeat(70)}`);
        console.log("📊 RELATÓRIO FINAL - FASE 4 V2: Padronização app.apiFetch()");
        console.log(`${'='.repeat(70)}`);
        console.log(`⏱️  Tempo total: ${duration}ms`);
        console.log(`📁 Arquivos processados: ${this.report.processed.length}`);
        console.log(`🔄 Total de mudanças: ${this.report.changes.length}`);
        console.log(`❌ Erros: ${this.report.errors.length}`);

        if (this.report.processed.length > 0) {
            console.log("\n📋 ARQUIVOS PROCESSADOS:");
            this.report.processed.forEach(p => {
                const status = p.changes > 0 ? '🔄' : '✅';
                console.log(`   ${status} ${p.file}: ${p.changes} alterações`);
            });
        }

        if (this.report.changes.length > 0) {
            console.log("\n🔄 RESUMO DE MUDANÇAS POR TIPO:");
            const changesByType = {};
            this.report.changes.forEach(change => {
                if (!changesByType[change.type]) {
                    changesByType[change.type] = 0;
                }
                changesByType[change.type]++;
            });

            Object.entries(changesByType).forEach(([type, count]) => {
                console.log(`   📊 ${type}: ${count} conversões`);
            });

            console.log("\n📄 MUDANÇAS DETALHADAS:");
            const groupedChanges = {};
            this.report.changes.forEach(change => {
                if (!groupedChanges[change.file]) {
                    groupedChanges[change.file] = [];
                }
                groupedChanges[change.file].push(change);
            });

            Object.entries(groupedChanges).forEach(([file, changes]) => {
                console.log(`\n   📄 ${file}:`);
                changes.forEach(change => {
                    console.log(`      Linha ${change.line} (${change.type}): fetch() -> app.apiFetch()`);
                });
            });
        }

        if (this.report.errors.length > 0) {
            console.log("\n❌ ERROS:");
            this.report.errors.forEach(error => {
                console.log(`   • ${error}`);
            });
        }

        console.log(`\n💾 Backups salvos em: ${BACKUP_DIR}`);
        console.log(`${'='.repeat(70)}\n`);

        // Salvar relatório em arquivo
        const reportPath = path.join(__dirname, '../reports/fase4-v2-relatorio.json');
        const reportDir = path.dirname(reportPath);
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const fullReport = {
            ...this.report,
            endTime,
            duration,
            summary: {
                totalFiles: this.report.processed.length,
                totalChanges: this.report.changes.length,
                totalErrors: this.report.errors.length,
                success: this.report.errors.length === 0
            }
        };

        fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf8');
        console.log(`📄 Relatório detalhado salvo em: ${reportPath}`);
    }

    // Executar padronização completa
    async execute() {
        console.log("🚀 INICIANDO FASE 4 V2: Padronização Robusta app.apiFetch()");
        console.log(`📁 Diretório: ${PUBLIC_DIR}`);

        this.createBackupDir();

        // Encontrar automaticamente arquivos com fetch()
        const filesToUpdate = this.findFilesWithFetch();
        console.log(`📋 Arquivos encontrados com fetch(): ${filesToUpdate.length}`);
        
        if (filesToUpdate.length === 0) {
            console.log("🎉 Nenhum arquivo precisa de atualização!");
            return true;
        }

        console.log("📄 Arquivos a serem processados:");
        filesToUpdate.forEach(file => console.log(`   • ${file}`));

        // Processar cada arquivo
        for (const filename of filesToUpdate) {
            try {
                this.processFile(filename);
            } catch (error) {
                const errorMsg = `Erro ao processar ${filename}: ${error.message}`;
                this.report.errors.push(errorMsg);
                console.error(`❌ ${errorMsg}`);
            }
        }

        this.generateReport();

        if (this.report.errors.length === 0) {
            console.log("🎉 FASE 4 V2 CONCLUÍDA COM SUCESSO!");
            console.log("✨ Todas as chamadas fetch() foram padronizadas para app.apiFetch()");
            console.log(`🔍 Total de conversões: ${this.report.changes.length}`);
            return true;
        } else {
            console.log("⚠️  FASE 4 V2 CONCLUÍDA COM ERROS - Verifique o relatório");
            return false;
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const standardizer = new ApiFetchStandardizerV2();
    standardizer.execute()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(`💥 Erro fatal:`, error);
            process.exit(1);
        });
}

module.exports = ApiFetchStandardizerV2;