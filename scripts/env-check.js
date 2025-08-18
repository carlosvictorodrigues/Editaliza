#!/usr/bin/env node
/**
 * @file scripts/env-check.js
 * @description Verificação robusta de ambiente para produção e desenvolvimento
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Cores para console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
    warn: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    title: (msg) => console.log(`${colors.bold}${colors.blue}🔍 ${msg}${colors.reset}`)
};

class EnvironmentChecker {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.env = process.env.NODE_ENV || 'development';
        this.isProduction = this.env === 'production';
        this.isDocker = process.env.DOCKER_BUILD === 'true' || fs.existsSync('/.dockerenv');
    }

    /**
     * Verificar versão do Node.js
     */
    checkNodeVersion() {
        log.title('Verificando Node.js');
        
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        
        log.info(`Versão do Node.js: ${nodeVersion}`);
        log.info(`Plataforma: ${process.platform} ${process.arch}`);
        
        if (majorVersion < 18) {
            this.errors.push(`Node.js ${nodeVersion} não suportado. Necessário Node.js 18+ para better-sqlite3`);
        } else {
            log.success(`Node.js ${nodeVersion} compatível`);
        }
    }

    /**
     * Verificar dependências críticas
     */
    checkDependencies() {
        log.title('Verificando dependências críticas');
        
        const criticalDeps = [
            'express',
            'better-sqlite3',
            'bcryptjs',
            'jsonwebtoken',
            'helmet',
            'cors'
        ];

        for (const dep of criticalDeps) {
            try {
                require(dep);
                log.success(`${dep} disponível`);
            } catch (error) {
                this.errors.push(`Dependência crítica não encontrada: ${dep}`);
            }
        }

        // Verificação especial para better-sqlite3
        try {
            const Database = require('better-sqlite3');
            const testDb = new Database(':memory:');
            testDb.exec('CREATE TABLE test (id INTEGER)');
            testDb.close();
            log.success('better-sqlite3 funcionando corretamente');
        } catch (error) {
            this.errors.push(`better-sqlite3 falhou: ${error.message}`);
        }
    }

    /**
     * Verificar variáveis de ambiente
     */
    checkEnvironmentVariables() {
        log.title('Verificando variáveis de ambiente');
        
        log.info(`Ambiente: ${this.env}`);
        log.info(`Docker: ${this.isDocker ? 'Sim' : 'Não'}`);

        if (this.isProduction) {
            const requiredProdVars = [
                'SESSION_SECRET',
                'JWT_SECRET',
                'JWT_REFRESH_SECRET'
            ];

            for (const varName of requiredProdVars) {
                if (!process.env[varName] || process.env[varName].includes('change_this')) {
                    this.errors.push(`Variável ${varName} deve ser configurada em produção`);
                } else {
                    log.success(`${varName} configurado`);
                }
            }

            // Verificar Google OAuth se configurado
            if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
                if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
                    this.errors.push('Google OAuth incompleto: CLIENT_ID e CLIENT_SECRET são obrigatórios');
                } else {
                    log.success('Google OAuth configurado');
                }
            }

            // Verificar email se configurado
            if (process.env.EMAIL_USER && !process.env.EMAIL_PASS) {
                this.errors.push('EMAIL_PASS obrigatório quando EMAIL_USER está configurado');
            }
        } else {
            log.info('Modo desenvolvimento - variáveis de ambiente opcionais');
        }
    }

    /**
     * Verificar sistema de arquivos
     */
    checkFileSystem() {
        log.title('Verificando sistema de arquivos');
        
        const requiredDirs = ['uploads', 'logs', 'data'];
        const requiredFiles = ['server.js', 'database.js'];

        // Verificar diretórios
        for (const dir of requiredDirs) {
            const dirPath = path.join(process.cwd(), dir);
            if (!fs.existsSync(dirPath)) {
                try {
                    fs.mkdirSync(dirPath, { recursive: true });
                    log.success(`Diretório ${dir} criado`);
                } catch (error) {
                    this.errors.push(`Não foi possível criar diretório ${dir}: ${error.message}`);
                }
            } else {
                log.success(`Diretório ${dir} existe`);
            }
        }

        // Verificar arquivos essenciais
        for (const file of requiredFiles) {
            const filePath = path.join(process.cwd(), file);
            if (!fs.existsSync(filePath)) {
                this.errors.push(`Arquivo essencial não encontrado: ${file}`);
            } else {
                log.success(`Arquivo ${file} encontrado`);
            }
        }

        // Verificar permissões de escrita
        const testFile = path.join(process.cwd(), 'temp_write_test.txt');
        try {
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            log.success('Permissões de escrita OK');
        } catch (error) {
            this.errors.push(`Permissões de escrita insuficientes: ${error.message}`);
        }
    }

    /**
     * Verificar configuração de produção
     */
    checkProductionConfig() {
        if (!this.isProduction) return;

        log.title('Verificando configuração de produção');

        // Verificar se Husky não vai executar
        if (process.env.HUSKY !== '0') {
            this.warnings.push('HUSKY deveria ser desabilitado em produção (HUSKY=0)');
        } else {
            log.success('Husky desabilitado para produção');
        }

        // Verificar se não tem dependências de desenvolvimento
        const packagePath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const devDepsExist = fs.existsSync(path.join(process.cwd(), 'node_modules', 'nodemon'));
            
            if (devDepsExist) {
                this.warnings.push('Dependências de desenvolvimento detectadas em produção');
            } else {
                log.success('Sem dependências de desenvolvimento');
            }
        }

        // Verificar configurações de segurança
        if (process.env.HOST === '0.0.0.0') {
            log.success('HOST configurado para 0.0.0.0 (Docker/produção)');
        }

        if (process.env.PORT) {
            log.success(`PORT configurado: ${process.env.PORT}`);
        }
    }

    /**
     * Verificar recursos do sistema
     */
    checkSystemResources() {
        log.title('Verificando recursos do sistema');

        const totalMemory = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100;
        const freeMemory = Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100;
        const cpuCount = os.cpus().length;

        log.info(`RAM Total: ${totalMemory}GB`);
        log.info(`RAM Livre: ${freeMemory}GB`);
        log.info(`CPUs: ${cpuCount}`);

        if (totalMemory < 0.5) {
            this.warnings.push('Pouca RAM disponível (<512MB) - considere aumentar recursos');
        }

        if (freeMemory < 0.1) {
            this.warnings.push('Pouca RAM livre (<100MB) - sistema pode ficar lento');
        }

        const loadAvg = os.loadavg();
        if (loadAvg[0] > cpuCount) {
            this.warnings.push(`Carga alta do sistema: ${loadAvg[0].toFixed(2)}`);
        }
    }

    /**
     * Executar todas as verificações
     */
    async runAllChecks() {
        console.log(`${colors.bold}${colors.blue}🔍 VERIFICAÇÃO DE AMBIENTE - EDITALIZA${colors.reset}`);
        console.log(`${colors.blue}============================================${colors.reset}\n`);

        this.checkNodeVersion();
        this.checkDependencies();
        this.checkEnvironmentVariables();
        this.checkFileSystem();
        this.checkProductionConfig();
        this.checkSystemResources();

        // Relatório final
        console.log(`\n${colors.bold}${colors.blue}📋 RELATÓRIO FINAL${colors.reset}`);
        console.log(`${colors.blue}====================${colors.reset}`);

        if (this.errors.length === 0 && this.warnings.length === 0) {
            log.success('Todas as verificações passaram!');
            log.success(`Ambiente ${this.env.toUpperCase()} pronto para execução`);
        } else {
            if (this.errors.length > 0) {
                console.log(`\n${colors.red}❌ ERROS CRÍTICOS:${colors.reset}`);
                this.errors.forEach(error => log.error(error));
            }

            if (this.warnings.length > 0) {
                console.log(`\n${colors.yellow}⚠️  AVISOS:${colors.reset}`);
                this.warnings.forEach(warning => log.warn(warning));
            }

            if (this.errors.length > 0) {
                log.error('Corrija os erros críticos antes de continuar');
                process.exit(1);
            } else {
                log.warn('Avisos encontrados, mas sistema pode continuar');
            }
        }

        console.log(`\n${colors.green}🚀 Sistema verificado e pronto!${colors.reset}\n`);
    }
}

// Executar verificação se chamado diretamente
if (require.main === module) {
    const checker = new EnvironmentChecker();
    checker.runAllChecks().catch(console.error);
}

module.exports = EnvironmentChecker;