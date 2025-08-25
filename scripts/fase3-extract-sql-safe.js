#!/usr/bin/env node

/**
 * FASE 3 - Script de Extração Segura de SQL
 * Analisa dependências e extrai queries SQL de forma segura
 * NÃO remove nada até validação completa
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m'
};

class SafeSQLExtractor {
    constructor() {
        this.queries = [];
        this.dependencies = new Map();
        this.replacements = new Map();
        this.validationErrors = [];
        this.serverPath = path.join(__dirname, '..', 'server.js');
        this.backupPath = path.join(__dirname, '..', 'server.js.backup-fase3');
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * PASSO 1: Fazer backup
     */
    createBackup() {
        this.log('\n📦 Criando backup do server.js...', 'cyan');
        fs.copyFileSync(this.serverPath, this.backupPath);
        this.log('✅ Backup criado: server.js.backup-fase3', 'green');
    }

    /**
     * PASSO 2: Analisar o arquivo usando AST
     */
    analyzeFile() {
        this.log('\n🔍 Analisando server.js...', 'cyan');
        
        const content = fs.readFileSync(this.serverPath, 'utf8');
        
        // Usar análise por regex que é mais confiável para nosso caso
        this.log('✅ Arquivo carregado, usando análise por padrões', 'green');
        return { ast: null, content };
    }

    /**
     * PASSO 3: Identificar queries SQL
     */
    identifyQueries(content) {
        this.log('\n📊 Identificando queries SQL...', 'cyan');
        
        const sqlPatterns = [
            // db.get, db.all, db.run patterns
            /db\.(get|all|run|exec)\s*\(\s*['"`]([\s\S]*?)['"`]/gm,
            // dbGet, dbAll, dbRun patterns
            /(dbGet|dbAll|dbRun|dbExec)\s*\(\s*['"`]([\s\S]*?)['"`]/gm,
            // Direct SQL strings
            /const\s+\w+\s*=\s*['"`](SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)[\s\S]*?['"`]/gim,
            // Template literals with SQL
            /const\s+\w+\s*=\s*`(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)[\s\S]*?`/gim
        ];

        const lines = content.split('\n');
        
        sqlPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                const query = match[2] || match[1];
                
                // Analisar contexto da query
                const context = this.analyzeQueryContext(lines, lineNumber);
                
                this.queries.push({
                    line: lineNumber,
                    query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                    fullQuery: query,
                    method: match[1] || 'unknown',
                    context: context,
                    repository: this.suggestRepository(query, context)
                });
            }
        });

        this.log(`✅ Encontradas ${this.queries.length} queries SQL`, 'green');
    }

    /**
     * PASSO 4: Analisar contexto de cada query
     */
    analyzeQueryContext(lines, lineNumber) {
        const context = {
            function: null,
            route: null,
            variables: [],
            dependencies: []
        };

        // Procurar função/rota envolvente (até 50 linhas acima)
        for (let i = Math.max(0, lineNumber - 50); i < lineNumber; i++) {
            const line = lines[i];
            
            // Detectar rota
            if (/app\.(get|post|put|patch|delete)\s*\(['"`](.*?)['"`]/.test(line)) {
                const routeMatch = line.match(/app\.\w+\s*\(['"`](.*?)['"`]/);
                if (routeMatch) context.route = routeMatch[1];
            }
            
            // Detectar função
            if (/function\s+(\w+)|const\s+(\w+)\s*=\s*async|async\s+(\w+)/.test(line)) {
                const funcMatch = line.match(/function\s+(\w+)|const\s+(\w+)\s*=|async\s+(\w+)/);
                if (funcMatch) context.function = funcMatch[1] || funcMatch[2] || funcMatch[3];
            }
        }

        // Procurar variáveis usadas (5 linhas ao redor)
        for (let i = Math.max(0, lineNumber - 5); i < Math.min(lines.length, lineNumber + 5); i++) {
            const line = lines[i];
            
            // Detectar uso de req.params, req.body, etc
            const varPatterns = [
                /req\.(params|body|query|user)\.(\w+)/g,
                /const\s+{\s*([\w\s,]+)\s*}\s*=\s*req\./g,
                /const\s+(\w+)\s*=\s*req\./g
            ];
            
            varPatterns.forEach(pattern => {
                let varMatch;
                while ((varMatch = pattern.exec(line)) !== null) {
                    context.variables.push(varMatch[0]);
                }
            });
        }

        return context;
    }

    /**
     * PASSO 5: Sugerir repository apropriado
     */
    suggestRepository(query, context) {
        const queryLower = query.toLowerCase();
        
        // Análise baseada em tabelas
        if (queryLower.includes('users')) return 'user.repository.js';
        if (queryLower.includes('study_plans')) return 'plan.repository.js';
        if (queryLower.includes('study_sessions')) return 'session.repository.js';
        if (queryLower.includes('subjects')) return 'subject.repository.js';
        if (queryLower.includes('topics')) return 'topic.repository.js';
        if (queryLower.includes('statistics') || queryLower.includes('metrics')) return 'statistics.repository.js';
        
        // Análise baseada em contexto de rota
        if (context.route) {
            if (context.route.includes('user') || context.route.includes('profile')) return 'user.repository.js';
            if (context.route.includes('plan')) return 'plan.repository.js';
            if (context.route.includes('session')) return 'session.repository.js';
        }
        
        return 'general.repository.js';
    }

    /**
     * PASSO 6: Gerar código do repository
     */
    generateRepositoryCode() {
        this.log('\n🔨 Gerando código dos repositories...', 'cyan');
        
        const repositories = new Map();
        
        // Agrupar queries por repository
        this.queries.forEach(q => {
            if (!repositories.has(q.repository)) {
                repositories.set(q.repository, []);
            }
            repositories.get(q.repository).push(q);
        });

        // Gerar código para cada repository
        repositories.forEach((queries, repoName) => {
            const methods = this.generateMethods(queries);
            const code = this.createRepositoryFile(repoName, methods);
            
            const repoPath = path.join(__dirname, '..', 'src', 'repositories', repoName);
            
            // Salvar como .new para não sobrescrever
            const newPath = repoPath.replace('.js', '.new.js');
            fs.writeFileSync(newPath, code);
            
            this.log(`✅ Gerado: ${repoName}.new (${queries.length} queries)`, 'green');
        });
    }

    /**
     * PASSO 7: Gerar métodos do repository
     */
    generateMethods(queries) {
        const methods = [];
        const methodNames = new Set();
        
        queries.forEach(q => {
            // Gerar nome do método baseado no contexto
            let methodName = this.generateMethodName(q);
            
            // Evitar duplicatas
            if (methodNames.has(methodName)) {
                methodName += '_' + q.line;
            }
            methodNames.add(methodName);
            
            // Gerar código do método
            const method = `
    /**
     * Linha original: ${q.line}
     * Contexto: ${q.context.route || q.context.function || 'global'}
     */
    async ${methodName}(params) {
        const query = \`${q.fullQuery}\`;
        return this.${this.getBaseMethod(q.method)}(query, params);
    }`;
            
            methods.push(method);
        });
        
        return methods.join('\n');
    }

    /**
     * PASSO 8: Gerar nome do método
     */
    generateMethodName(queryInfo) {
        const query = queryInfo.fullQuery.toLowerCase();
        const context = queryInfo.context;
        
        // Usar contexto da rota para nomes mais específicos
        let prefix = '';
        if (context.route) {
            if (context.route.includes('user')) prefix = 'user';
            else if (context.route.includes('plan')) prefix = 'plan';
            else if (context.route.includes('session')) prefix = 'session';
        }
        
        if (query.includes('select')) {
            if (query.includes('count(')) return prefix ? `count${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'count';
            if (query.includes('limit 1')) return prefix ? `find${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'findOne';
            return prefix ? `findAll${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'findAll';
        }
        if (query.includes('insert')) return prefix ? `create${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'create';
        if (query.includes('update')) return prefix ? `update${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'update';
        if (query.includes('delete')) return prefix ? `delete${prefix.charAt(0).toUpperCase() + prefix.slice(1)}` : 'delete';
        
        return 'execute';
    }

    /**
     * PASSO 9: Mapear método base
     */
    getBaseMethod(method) {
        const mapping = {
            'get': 'findOne',
            'all': 'findAll', 
            'run': 'execute',  // Corrigido: run pode ser INSERT/UPDATE/DELETE
            'exec': 'execute',
            'query': 'execute'  // Adicionado para PostgreSQL
        };
        return mapping[method] || 'execute';
    }

    /**
     * PASSO 10: Criar arquivo do repository
     */
    createRepositoryFile(name, methods) {
        const className = name.replace('.repository.js', '')
            .split(/[-_]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('') + 'Repository';
        
        return `/**
 * ${className}
 * Gerado automaticamente pela FASE 3 de modularização
 * Data: ${new Date().toISOString()}
 */

const BaseRepository = require('./base.repository');

class ${className} extends BaseRepository {
    constructor(db) {
        super(db);
    }
${methods}
}

module.exports = ${className};`;
    }

    /**
     * PASSO 11: Validar mudanças
     */
    async validateChanges() {
        this.log('\n🧪 Validando mudanças...', 'cyan');
        
        // Verificar sintaxe
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        try {
            await execPromise('node -c server.js');
            this.log('✅ Sintaxe do server.js válida', 'green');
        } catch (error) {
            this.log('❌ Erro de sintaxe no server.js', 'red');
            this.validationErrors.push('Syntax error');
        }
        
        return this.validationErrors.length === 0;
    }

    /**
     * PASSO 12: Gerar relatório
     */
    generateReport() {
        this.log('\n📋 Gerando relatório...', 'cyan');
        
        let report = `# 📊 FASE 3 - RELATÓRIO DE EXTRAÇÃO SQL

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Hora:** ${new Date().toLocaleTimeString('pt-BR')}

## 📈 RESUMO

- **Total de queries identificadas:** ${this.queries.length}
- **Repositories sugeridos:** ${new Set(this.queries.map(q => q.repository)).size}
- **Validação:** ${this.validationErrors.length === 0 ? '✅ Passou' : '❌ Falhou'}

## 🗄️ QUERIES POR REPOSITORY

`;

        // Agrupar por repository
        const byRepo = {};
        this.queries.forEach(q => {
            if (!byRepo[q.repository]) byRepo[q.repository] = [];
            byRepo[q.repository].push(q);
        });

        Object.entries(byRepo).forEach(([repo, queries]) => {
            report += `\n### ${repo} (${queries.length} queries)\n\n`;
            report += '| Linha | Query | Contexto |\n';
            report += '|-------|-------|----------|\n';
            
            queries.slice(0, 10).forEach(q => {
                report += `| ${q.line} | \`${q.query}\` | ${q.context.route || q.context.function || 'global'} |\n`;
            });
            
            if (queries.length > 10) {
                report += `\n... e mais ${queries.length - 10} queries\n`;
            }
        });

        report += `
## ⚠️ IMPORTANTE

**NÃO REMOVA NADA DO SERVER.JS AINDA!**

1. Revise os arquivos .new.js gerados
2. Teste cada repository individualmente
3. Integre com controllers gradualmente
4. Só remova do server.js após validação completa

## 🔍 PRÓXIMOS PASSOS

1. Revisar repositories gerados em src/repositories/*.new.js
2. Renomear .new.js para .js após revisão
3. Criar testes para cada repository
4. Integrar repositories nos controllers
5. Validar funcionamento completo
6. Só então remover queries do server.js
`;

        fs.writeFileSync(
            path.join(__dirname, '..', 'FASE3_EXTRACAO_SQL.md'),
            report
        );
        
        this.log('✅ Relatório salvo: FASE3_EXTRACAO_SQL.md', 'green');
    }

    /**
     * Executar extração
     */
    async run() {
        this.log('🚀 FASE 3 - EXTRAÇÃO SEGURA DE SQL', 'magenta');
        this.log('=' .repeat(50), 'magenta');
        
        // 1. Backup
        this.createBackup();
        
        // 2. Análise
        const { content } = this.analyzeFile();
        
        // 3. Identificar queries
        this.identifyQueries(content);
        
        // 4. Gerar repositories
        this.generateRepositoryCode();
        
        // 5. Validar
        const isValid = await this.validateChanges();
        
        // 6. Relatório
        this.generateReport();
        
        // Resumo
        this.log('\n' + '='.repeat(50), 'magenta');
        this.log('📊 EXTRAÇÃO CONCLUÍDA', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        this.log(`\n✅ ${this.queries.length} queries identificadas`, 'green');
        this.log(`📁 Repositories gerados em src/repositories/*.new.js`, 'blue');
        this.log(`⚠️ NENHUMA query foi removida do server.js`, 'yellow');
        this.log(`📋 Revise os arquivos antes de prosseguir`, 'cyan');
        
        if (!isValid) {
            this.log('\n❌ ATENÇÃO: Validação falhou!', 'red');
            this.log('Verifique os erros antes de continuar', 'red');
        }
    }
}

// Executar
const extractor = new SafeSQLExtractor();
extractor.run().catch(error => {
    console.error('Erro durante extração:', error);
    process.exit(1);
});