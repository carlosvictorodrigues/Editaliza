#!/usr/bin/env node

/**
 * FASE 4 - Padronização de Chamadas API
 * 
 * Script para substituir todas as chamadas fetch() diretas por app.apiFetch()
 * em arquivos HTML do diretório public/
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups/fase4');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Arquivos que contêm fetch() direto - identificados na análise
const FILES_TO_UPDATE = [
    'test_api_routes.html',
    'test_complete_flow.html',
    'test_statistics_routes.html',
    'test_oauth.html',
    'test_oauth_user.html',
    'test_create_plan_v2.html',
    'test_create_plan.html'
];

class ApiFetchStandardizer {
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

    // Analisar fetch() em um arquivo e retornar informações
    analyzeFetchCalls(content, filename) {
        const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,?\s*({[^}]*})?\s*\)/g;
        const matches = [];
        let match;

        while ((match = fetchRegex.exec(content)) !== null) {
            matches.push({
                full: match[0],
                url: match[1],
                options: match[2] || '{}',
                index: match.index,
                line: content.substring(0, match.index).split('\n').length
            });
        }

        return matches;
    }

    // Converter fetch() para app.apiFetch()
    convertFetchToApiFetch(fetchCall, baseUrl) {
        // Extrair componentes da chamada fetch
        const fetchRegex = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*,?\s*({.*?})?\s*\)/s;
        const match = fetchCall.match(fetchRegex);
        
        if (!match) {
            console.warn(`⚠️  Não foi possível analisar: ${fetchCall}`);
            return fetchCall;
        }

        const [, quote, url, optionsStr] = match;
        let options = {};
        
        // Parse das options se existirem
        if (optionsStr) {
            try {
                // Remover comentários e formatar para eval seguro
                const cleanOptions = optionsStr
                    .replace(/\/\*.*?\*\//g, '')
                    .replace(/\/\/.*$/gm, '');
                options = eval(`(${cleanOptions})`);
            } catch (e) {
                console.warn(`⚠️  Erro ao fazer parse das options: ${optionsStr}`);
                options = {};
            }
        }

        // Ajustar URL para o padrão /api/
        let newUrl = url;
        if (url.startsWith('/api/')) {
            // Já está no padrão correto
        } else if (url.startsWith('/')) {
            // Adicionar /api/ no início
            newUrl = '/api' + url;
        } else {
            // URL relativa, manter como está
        }

        // Remover headers que serão adicionados automaticamente pelo app.apiFetch()
        const cleanOptions = { ...options };
        if (cleanOptions.headers) {
            // Manter headers customizados, mas remover os padrão
            delete cleanOptions.headers['Content-Type'];
            delete cleanOptions.headers['Authorization'];
            
            // Se não há headers customizados, remover o objeto headers
            if (Object.keys(cleanOptions.headers).length === 0) {
                delete cleanOptions.headers;
            }
        }

        // Construir nova chamada app.apiFetch()
        let newCall = `app.apiFetch('${newUrl}'`;
        
        if (Object.keys(cleanOptions).length > 0) {
            newCall += ', ' + JSON.stringify(cleanOptions, null, 4);
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
        console.log(`📊 Encontradas ${fetchCalls.length} chamadas fetch()`);

        if (fetchCalls.length === 0) {
            console.log(`✅ Nenhuma alteração necessária em ${filename}`);
            this.report.processed.push({ file: filename, changes: 0 });
            return true;
        }

        // Verificar se o arquivo inclui app.js
        const hasAppJs = content.includes('js/app.js');
        if (!hasAppJs) {
            // Adicionar script do app.js antes do closing </body>
            const bodyCloseIndex = content.lastIndexOf('</body>');
            if (bodyCloseIndex !== -1) {
                const scriptTag = '    <script src="js/app.js"></script>\n';
                content = content.substring(0, bodyCloseIndex) + scriptTag + content.substring(bodyCloseIndex);
                console.log("📜 Adicionado script js/app.js");
            }
        }

        // Processar cada chamada fetch() (de trás para frente para manter índices)
        for (let i = fetchCalls.length - 1; i >= 0; i--) {
            const fetchCall = fetchCalls[i];
            const newCall = this.convertFetchToApiFetch(fetchCall.full, fetchCall.url);
            
            // Substituir no conteúdo
            const before = content.substring(0, fetchCall.index);
            const after = content.substring(fetchCall.index + fetchCall.full.length);
            content = before + newCall + after;

            console.log(`🔄 Linha ${fetchCall.line}: ${fetchCall.url} -> app.apiFetch()`);
            
            this.report.changes.push({
                file: filename,
                line: fetchCall.line,
                from: fetchCall.full,
                to: newCall,
                url: fetchCall.url
            });
        }

        // Salvar arquivo modificado
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`✅ ${filename} atualizado com ${fetchCalls.length} mudanças`);
        this.report.processed.push({ file: filename, changes: fetchCalls.length });
        
        return true;
    }

    // Gerar relatório final
    generateReport() {
        const endTime = new Date();
        const duration = endTime - this.report.startTime;

        console.log(`\n${'='.repeat(60)}`);
        console.log("📊 RELATÓRIO FINAL - FASE 4: Padronização app.apiFetch()");
        console.log(`${'='.repeat(60)}`);
        console.log(`⏱️  Tempo total: ${duration}ms`);
        console.log(`📁 Arquivos processados: ${this.report.processed.length}`);
        console.log(`🔄 Total de mudanças: ${this.report.changes.length}`);
        console.log(`❌ Erros: ${this.report.errors.length}`);

        if (this.report.processed.length > 0) {
            console.log("\n📋 ARQUIVOS PROCESSADOS:");
            this.report.processed.forEach(p => {
                console.log(`   ✅ ${p.file}: ${p.changes} alterações`);
            });
        }

        if (this.report.changes.length > 0) {
            console.log("\n🔄 RESUMO DE MUDANÇAS:");
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
                    console.log(`      Linha ${change.line}: ${change.url} -> app.apiFetch()`);
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
        console.log(`${'='.repeat(60)}\n`);

        // Salvar relatório em arquivo
        const reportPath = path.join(__dirname, '../reports/fase4-relatorio.json');
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
        console.log("🚀 INICIANDO FASE 4: Padronização app.apiFetch()");
        console.log(`📁 Diretório: ${PUBLIC_DIR}`);
        console.log(`📋 Arquivos para processar: ${FILES_TO_UPDATE.length}`);

        this.createBackupDir();

        // Processar cada arquivo
        for (const filename of FILES_TO_UPDATE) {
            this.processFile(filename);
        }

        this.generateReport();

        if (this.report.errors.length === 0) {
            console.log("🎉 FASE 4 CONCLUÍDA COM SUCESSO!");
            console.log("✨ Todas as chamadas fetch() foram padronizadas para app.apiFetch()");
            return true;
        } else {
            console.log("⚠️  FASE 4 CONCLUÍDA COM ERROS - Verifique o relatório");
            return false;
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const standardizer = new ApiFetchStandardizer();
    standardizer.execute()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(`💥 Erro fatal:`, error);
            process.exit(1);
        });
}

module.exports = ApiFetchStandardizer;