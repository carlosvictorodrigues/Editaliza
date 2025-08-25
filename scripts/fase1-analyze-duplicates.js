#!/usr/bin/env node

/**
 * FASE 1 - Script de Análise de Duplicação
 * Mapeia todas as rotas duplicadas entre server.js e arquivos modulares
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

class DuplicationAnalyzer {
    constructor() {
        this.serverRoutes = new Map();
        this.modularRoutes = new Map();
        this.sqlQueries = [];
        this.businessLogic = [];
        this.duplicates = [];
        this.stats = {
            totalServerRoutes: 0,
            totalModularRoutes: 0,
            duplicateRoutes: 0,
            sqlQueries: 0,
            businessLogicBlocks: 0
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    analyzeServerJs() {
        this.log('\n📝 Analisando server.js...', 'cyan');
        
        const serverPath = path.join(__dirname, '..', 'server.js');
        const content = fs.readFileSync(serverPath, 'utf8');
        const lines = content.split('\n');
        
        // Padrões para detectar rotas
        const routePatterns = [
            /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`)]+)/gi,
            /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`)]+)/gi
        ];
        
        // Padrões para detectar SQL
        const sqlPatterns = [
            /db\.query\s*\(/gi,
            /db\.execute\s*\(/gi,
            /SELECT\s+.*FROM/gi,
            /INSERT\s+INTO/gi,
            /UPDATE\s+.*SET/gi,
            /DELETE\s+FROM/gi
        ];
        
        // Analisar linha por linha
        lines.forEach((line, index) => {
            // Detectar rotas
            routePatterns.forEach(pattern => {
                const matches = line.matchAll(pattern);
                for (const match of matches) {
                    const method = match[1].toUpperCase();
                    const path = match[2];
                    const key = `${method} ${path}`;
                    
                    if (!this.serverRoutes.has(key)) {
                        this.serverRoutes.set(key, {
                            method,
                            path,
                            line: index + 1,
                            file: 'server.js'
                        });
                    }
                }
            });
            
            // Detectar SQL
            sqlPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    this.sqlQueries.push({
                        line: index + 1,
                        content: line.trim(),
                        file: 'server.js'
                    });
                }
            });
        });
        
        this.stats.totalServerRoutes = this.serverRoutes.size;
        this.stats.sqlQueries = this.sqlQueries.length;
        
        this.log(`✅ Encontradas ${this.serverRoutes.size} rotas em server.js`, 'green');
        this.log(`✅ Encontradas ${this.sqlQueries.length} queries SQL`, 'green');
    }

    analyzeModularRoutes() {
        this.log('\n📂 Analisando rotas modulares...', 'cyan');
        
        const routesDir = path.join(__dirname, '..', 'src', 'routes');
        
        if (!fs.existsSync(routesDir)) {
            this.log('⚠️ Diretório src/routes não encontrado', 'yellow');
            return;
        }
        
        const routeFiles = fs.readdirSync(routesDir)
            .filter(file => file.endsWith('.routes.js'));
        
        routeFiles.forEach(file => {
            const filePath = path.join(routesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            const routePatterns = [
                /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`)]+)/gi,
                /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`)]+)/gi
            ];
            
            lines.forEach((line, index) => {
                routePatterns.forEach(pattern => {
                    const matches = line.matchAll(pattern);
                    for (const match of matches) {
                        const method = match[1].toUpperCase();
                        let routePath = match[2];
                        
                        // Inferir prefixo baseado no nome do arquivo
                        const prefix = this.inferRoutePrefix(file);
                        if (!routePath.startsWith('/api/')) {
                            routePath = `/api${prefix}${routePath}`;
                        }
                        
                        const key = `${method} ${routePath}`;
                        
                        if (!this.modularRoutes.has(key)) {
                            this.modularRoutes.set(key, {
                                method,
                                path: routePath,
                                line: index + 1,
                                file: `src/routes/${file}`
                            });
                        }
                    }
                });
            });
        });
        
        this.stats.totalModularRoutes = this.modularRoutes.size;
        this.log(`✅ Encontradas ${this.modularRoutes.size} rotas modulares`, 'green');
    }

    inferRoutePrefix(filename) {
        // Mapear nome do arquivo para prefixo da rota
        const prefixMap = {
            'auth.routes.js': '/auth',
            'users.routes.js': '/users',
            'plans.routes.js': '/plans',
            'sessions.routes.js': '/sessions',
            'schedules.routes.js': '/schedules',
            'statistics.routes.js': '/statistics',
            'admin.routes.js': '/admin'
        };
        
        return prefixMap[filename] || '';
    }

    findDuplicates() {
        this.log('\n🔍 Procurando duplicações...', 'cyan');
        
        this.serverRoutes.forEach((serverRoute, key) => {
            if (this.modularRoutes.has(key)) {
                const modularRoute = this.modularRoutes.get(key);
                this.duplicates.push({
                    route: key,
                    server: serverRoute,
                    modular: modularRoute
                });
            }
        });
        
        this.stats.duplicateRoutes = this.duplicates.length;
        
        if (this.duplicates.length > 0) {
            this.log(`⚠️ Encontradas ${this.duplicates.length} rotas duplicadas!`, 'yellow');
        } else {
            this.log('✅ Nenhuma rota duplicada encontrada', 'green');
        }
    }

    generateReport() {
        this.log('\n📊 Gerando relatório...', 'cyan');
        
        // Relatório de rotas duplicadas
        let duplicatesReport = `# 📋 MAPEAMENTO DE ROTAS DUPLICADAS

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Hora:** ${new Date().toLocaleTimeString('pt-BR')}

## 📊 ESTATÍSTICAS GERAIS

- **Total de rotas em server.js:** ${this.stats.totalServerRoutes}
- **Total de rotas modulares:** ${this.stats.totalModularRoutes}
- **Rotas duplicadas:** ${this.stats.duplicateRoutes}
- **Taxa de duplicação:** ${((this.stats.duplicateRoutes / this.stats.totalServerRoutes) * 100).toFixed(1)}%

## 🔄 ROTAS DUPLICADAS

`;

        if (this.duplicates.length > 0) {
            duplicatesReport += '| Rota | server.js (linha) | Arquivo Modular (linha) | Ação Recomendada |\n';
            duplicatesReport += '|------|------------------|------------------------|------------------|\n';
            
            this.duplicates.forEach(dup => {
                duplicatesReport += `| \`${dup.route}\` | L${dup.server.line} | ${dup.modular.file} L${dup.modular.line} | Remover de server.js |\n`;
            });
        } else {
            duplicatesReport += '✅ **Nenhuma rota duplicada encontrada!**\n';
        }

        // Adicionar rotas únicas em server.js
        duplicatesReport += '\n## 📌 ROTAS ÚNICAS EM SERVER.JS\n\n';
        const uniqueServerRoutes = [];
        
        this.serverRoutes.forEach((route, key) => {
            if (!this.modularRoutes.has(key)) {
                uniqueServerRoutes.push({key, ...route});
            }
        });
        
        if (uniqueServerRoutes.length > 0) {
            duplicatesReport += '| Rota | Linha | Ação Recomendada |\n';
            duplicatesReport += '|------|-------|------------------|\n';
            
            uniqueServerRoutes.forEach(route => {
                const module = this.suggestModule(route.path);
                duplicatesReport += `| \`${route.key}\` | L${route.line} | Mover para ${module} |\n`;
            });
        }
        
        // Salvar relatório
        fs.writeFileSync(
            path.join(__dirname, '..', 'MAPEAMENTO_ROTAS_DUPLICADAS.md'),
            duplicatesReport
        );
        
        // Relatório de SQL queries
        let sqlReport = `# 🗄️ INVENTÁRIO DE QUERIES SQL

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Hora:** ${new Date().toLocaleTimeString('pt-BR')}

## 📊 ESTATÍSTICAS

- **Total de queries SQL em server.js:** ${this.stats.sqlQueries}
- **Queries por tipo:**
  - SELECT: ${this.sqlQueries.filter(q => q.content.includes('SELECT')).length}
  - INSERT: ${this.sqlQueries.filter(q => q.content.includes('INSERT')).length}
  - UPDATE: ${this.sqlQueries.filter(q => q.content.includes('UPDATE')).length}
  - DELETE: ${this.sqlQueries.filter(q => q.content.includes('DELETE')).length}

## 📝 QUERIES ENCONTRADAS

`;

        if (this.sqlQueries.length > 0) {
            sqlReport += '| Linha | Query (preview) | Repository Sugerido |\n';
            sqlReport += '|-------|----------------|--------------------|\n';
            
            this.sqlQueries.slice(0, 50).forEach(query => {
                const preview = query.content.substring(0, 60) + '...';
                const repository = this.suggestRepository(query.content);
                sqlReport += `| L${query.line} | \`${preview}\` | ${repository} |\n`;
            });
            
            if (this.sqlQueries.length > 50) {
                sqlReport += `\n... e mais ${this.sqlQueries.length - 50} queries\n`;
            }
        }
        
        fs.writeFileSync(
            path.join(__dirname, '..', 'INVENTARIO_QUERIES_SQL.md'),
            sqlReport
        );
        
        this.log('✅ Relatórios gerados:', 'green');
        this.log('  - MAPEAMENTO_ROTAS_DUPLICADAS.md', 'blue');
        this.log('  - INVENTARIO_QUERIES_SQL.md', 'blue');
    }

    suggestModule(path) {
        if (path.includes('auth') || path.includes('login') || path.includes('register')) {
            return 'auth.routes.js';
        }
        if (path.includes('user') || path.includes('profile')) {
            return 'users.routes.js';
        }
        if (path.includes('plan')) {
            return 'plans.routes.js';
        }
        if (path.includes('session')) {
            return 'sessions.routes.js';
        }
        if (path.includes('schedule')) {
            return 'schedules.routes.js';
        }
        if (path.includes('admin')) {
            return 'admin.routes.js';
        }
        return 'api.routes.js';
    }

    suggestRepository(query) {
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('users')) return 'users.repository.js';
        if (queryLower.includes('plans')) return 'plans.repository.js';
        if (queryLower.includes('sessions')) return 'sessions.repository.js';
        if (queryLower.includes('schedules')) return 'schedules.repository.js';
        if (queryLower.includes('statistics')) return 'statistics.repository.js';
        
        return 'general.repository.js';
    }

    run() {
        this.log('🚀 FASE 1 - ANÁLISE DE DUPLICAÇÃO INICIADA', 'magenta');
        this.log('=' .repeat(50), 'magenta');
        
        // Executar análises
        this.analyzeServerJs();
        this.analyzeModularRoutes();
        this.findDuplicates();
        this.generateReport();
        
        // Resumo final
        this.log('\n' + '='.repeat(50), 'magenta');
        this.log('📊 RESUMO DA ANÁLISE', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        this.log(`\n✅ Análise completa!`, 'green');
        this.log(`📈 ${this.stats.duplicateRoutes} rotas duplicadas encontradas`, 'yellow');
        this.log(`🗄️ ${this.stats.sqlQueries} queries SQL para extrair`, 'yellow');
        this.log(`📁 Relatórios salvos no diretório raiz`, 'blue');
        
        // Recomendações
        this.log('\n💡 PRÓXIMOS PASSOS:', 'cyan');
        this.log('1. Revisar MAPEAMENTO_ROTAS_DUPLICADAS.md', 'white');
        this.log('2. Iniciar FASE 2 com remoção cuidadosa de duplicatas', 'white');
        this.log('3. Testar cada remoção individualmente', 'white');
        this.log('4. Verificar sincronização frontend-backend', 'white');
    }
}

// Executar análise
const analyzer = new DuplicationAnalyzer();
analyzer.run();