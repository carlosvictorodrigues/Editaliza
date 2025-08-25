#!/usr/bin/env node

/**
 * FASE 1 - Script de Análise de Dependências
 * Mapeia todas as dependências entre módulos do sistema
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

class DependencyAnalyzer {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.circularDeps = [];
        this.stats = {
            totalModules: 0,
            totalDependencies: 0,
            circularDependencies: 0,
            externalDependencies: 0
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    scanDirectory(dir, baseDir = null) {
        if (!baseDir) baseDir = dir;
        
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !file.includes('node_modules') && !file.startsWith('.')) {
                this.scanDirectory(fullPath, baseDir);
            } else if (file.endsWith('.js')) {
                this.analyzeFile(fullPath, baseDir);
            }
        });
    }

    analyzeFile(filePath, baseDir) {
        const relativePath = path.relative(baseDir, filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Padrões para detectar imports/requires
        const requirePatterns = [
            /require\s*\(\s*['"`]([^'"`)]+)['"`]\s*\)/g,
            /import\s+.*\s+from\s+['"`]([^'"`)]+)['"`]/g,
            /import\s*\(\s*['"`]([^'"`)]+)['"`]\s*\)/g
        ];
        
        const deps = new Set();
        
        requirePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const dep = match[1];
                
                // Classificar dependência
                if (dep.startsWith('.')) {
                    // Dependência local
                    const resolvedPath = this.resolvePath(filePath, dep);
                    deps.add({
                        type: 'local',
                        path: dep,
                        resolved: resolvedPath
                    });
                } else if (!dep.includes('/')) {
                    // Dependência core do Node ou npm
                    deps.add({
                        type: 'external',
                        name: dep
                    });
                } else {
                    // Dependência de subpacote
                    deps.add({
                        type: 'subpackage',
                        name: dep
                    });
                }
            }
        });
        
        this.modules.set(relativePath, {
            path: relativePath,
            dependencies: Array.from(deps),
            exports: this.findExports(content)
        });
    }

    resolvePath(fromFile, toPath) {
        const dir = path.dirname(fromFile);
        let resolved = path.join(dir, toPath);
        
        // Adicionar .js se não tiver extensão
        if (!path.extname(resolved)) {
            if (fs.existsSync(resolved + '.js')) {
                resolved += '.js';
            } else if (fs.existsSync(path.join(resolved, 'index.js'))) {
                resolved = path.join(resolved, 'index.js');
            }
        }
        
        return path.relative(path.dirname(fromFile), resolved);
    }

    findExports(content) {
        const exports = [];
        
        // Padrões para detectar exports
        const exportPatterns = [
            /module\.exports\s*=\s*{([^}]+)}/g,
            /module\.exports\.(\w+)\s*=/g,
            /exports\.(\w+)\s*=/g,
            /export\s+(const|let|var|function|class)\s+(\w+)/g,
            /export\s+default\s+/g
        ];
        
        exportPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (match[2]) {
                    exports.push(match[2]);
                } else if (match[1] && !match[1].includes('const')) {
                    exports.push(match[1]);
                }
            }
        });
        
        return exports;
    }

    detectCircularDependencies() {
        this.log('\n🔄 Detectando dependências circulares...', 'cyan');
        
        const visited = new Set();
        const stack = new Set();
        
        const dfs = (module, path = []) => {
            if (stack.has(module)) {
                // Encontrou dependência circular
                const circularPath = [...path, module];
                const startIdx = circularPath.indexOf(module);
                const cycle = circularPath.slice(startIdx);
                
                this.circularDeps.push(cycle);
                return;
            }
            
            if (visited.has(module)) return;
            
            visited.add(module);
            stack.add(module);
            
            const moduleData = this.modules.get(module);
            if (moduleData) {
                moduleData.dependencies
                    .filter(dep => dep.type === 'local')
                    .forEach(dep => {
                        const depPath = this.resolveModulePath(module, dep.path);
                        if (this.modules.has(depPath)) {
                            dfs(depPath, [...path, module]);
                        }
                    });
            }
            
            stack.delete(module);
        };
        
        this.modules.forEach((_, modulePath) => {
            if (!visited.has(modulePath)) {
                dfs(modulePath);
            }
        });
        
        this.stats.circularDependencies = this.circularDeps.length;
        
        if (this.circularDeps.length > 0) {
            this.log(`⚠️ Encontradas ${this.circularDeps.length} dependências circulares!`, 'yellow');
        } else {
            this.log('✅ Nenhuma dependência circular encontrada', 'green');
        }
    }

    resolveModulePath(fromModule, toPath) {
        const fromDir = path.dirname(fromModule);
        let resolved = path.join(fromDir, toPath);
        
        // Normalizar caminho
        resolved = resolved.replace(/\\/g, '/');
        
        // Adicionar .js se necessário
        if (!resolved.endsWith('.js')) {
            resolved += '.js';
        }
        
        return resolved;
    }

    generateReport() {
        this.log('\n📊 Gerando relatório de dependências...', 'cyan');
        
        // Calcular estatísticas
        this.stats.totalModules = this.modules.size;
        let totalDeps = 0;
        let externalDeps = 0;
        
        this.modules.forEach(module => {
            totalDeps += module.dependencies.length;
            externalDeps += module.dependencies.filter(d => d.type === 'external').length;
        });
        
        this.stats.totalDependencies = totalDeps;
        this.stats.externalDependencies = externalDeps;
        
        // Criar relatório
        let report = `# 🔗 MAPA DE DEPENDÊNCIAS DO SISTEMA

**Data:** ${new Date().toLocaleDateString('pt-BR')}
**Hora:** ${new Date().toLocaleTimeString('pt-BR')}

## 📊 ESTATÍSTICAS

- **Total de módulos analisados:** ${this.stats.totalModules}
- **Total de dependências:** ${this.stats.totalDependencies}
- **Dependências externas (npm):** ${this.stats.externalDependencies}
- **Dependências circulares:** ${this.stats.circularDependencies}

## 🏗️ ARQUITETURA DE MÓDULOS

### Módulos Principais

`;

        // Agrupar módulos por diretório
        const modulesByDir = new Map();
        
        this.modules.forEach((module, path) => {
            const dir = path.includes('/') ? path.split('/')[0] : 'root';
            if (!modulesByDir.has(dir)) {
                modulesByDir.set(dir, []);
            }
            modulesByDir.get(dir).push(module);
        });
        
        // Listar módulos por diretório
        modulesByDir.forEach((modules, dir) => {
            report += `\n#### 📁 ${dir}/\n\n`;
            report += '| Módulo | Dependências Locais | Dependências Externas |\n';
            report += '|--------|--------------------|-----------------------|\n';
            
            modules.forEach(module => {
                const localDeps = module.dependencies.filter(d => d.type === 'local').length;
                const externalDeps = module.dependencies.filter(d => d.type === 'external').length;
                report += `| ${module.path} | ${localDeps} | ${externalDeps} |\n`;
            });
        });
        
        // Dependências circulares
        if (this.circularDeps.length > 0) {
            report += '\n## ⚠️ DEPENDÊNCIAS CIRCULARES\n\n';
            report += '**ATENÇÃO:** Estas dependências devem ser resolvidas antes da modularização completa!\n\n';
            
            this.circularDeps.forEach((cycle, idx) => {
                report += `${idx + 1}. ${cycle.join(' → ')}\n`;
            });
        }
        
        // Módulos mais acoplados
        report += '\n## 📈 MÓDULOS MAIS ACOPLADOS\n\n';
        report += 'Módulos com maior número de dependências (candidatos a refatoração):\n\n';
        
        const sortedModules = Array.from(this.modules.entries())
            .sort((a, b) => b[1].dependencies.length - a[1].dependencies.length)
            .slice(0, 10);
        
        report += '| Módulo | Total de Dependências | Tipo |\n';
        report += '|--------|-----------------------|------|\n';
        
        sortedModules.forEach(([path, module]) => {
            const type = path.includes('server.js') ? '⚠️ Monolítico' : '✅ Modular';
            report += `| ${path} | ${module.dependencies.length} | ${type} |\n`;
        });
        
        // Recomendações
        report += '\n## 💡 RECOMENDAÇÕES\n\n';
        report += '1. **Resolver dependências circulares** antes de prosseguir\n';
        report += '2. **Refatorar módulos altamente acoplados** (server.js em primeiro)\n';
        report += '3. **Criar camada de abstração** para dependências externas\n';
        report += '4. **Implementar injeção de dependências** para facilitar testes\n';
        report += '5. **Documentar interfaces públicas** de cada módulo\n';
        
        // Salvar relatório
        fs.writeFileSync(
            path.join(__dirname, '..', 'DEPENDENCIAS_MODULOS.md'),
            report
        );
        
        this.log('✅ Relatório gerado: DEPENDENCIAS_MODULOS.md', 'green');
    }

    run() {
        this.log('🚀 ANÁLISE DE DEPENDÊNCIAS INICIADA', 'magenta');
        this.log('=' .repeat(50), 'magenta');
        
        const baseDir = path.join(__dirname, '..');
        
        // Analisar diretórios principais
        this.log('\n📂 Analisando estrutura do projeto...', 'cyan');
        
        // Analisar src/
        if (fs.existsSync(path.join(baseDir, 'src'))) {
            this.scanDirectory(path.join(baseDir, 'src'), baseDir);
        }
        
        // Analisar arquivos na raiz
        const rootFiles = ['server.js', 'app.js', 'index.js'];
        rootFiles.forEach(file => {
            const filePath = path.join(baseDir, file);
            if (fs.existsSync(filePath)) {
                this.analyzeFile(filePath, baseDir);
            }
        });
        
        this.log(`✅ ${this.modules.size} módulos analisados`, 'green');
        
        // Detectar problemas
        this.detectCircularDependencies();
        
        // Gerar relatório
        this.generateReport();
        
        // Resumo final
        this.log('\n' + '='.repeat(50), 'magenta');
        this.log('📊 ANÁLISE COMPLETA', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        this.log(`\n✅ Análise de dependências concluída!`, 'green');
        this.log(`📁 ${this.stats.totalModules} módulos mapeados`, 'blue');
        this.log(`🔗 ${this.stats.totalDependencies} dependências identificadas`, 'blue');
        
        if (this.stats.circularDependencies > 0) {
            this.log(`⚠️ ${this.stats.circularDependencies} dependências circulares encontradas`, 'yellow');
        }
    }
}

// Executar análise
const analyzer = new DependencyAnalyzer();
analyzer.run();