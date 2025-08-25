#!/usr/bin/env node

/**
 * SCRIPT DE TESTE PARA REPOSITORIES
 * Valida cada repository individualmente antes da migração
 */

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

class RepositoryTester {
    constructor() {
        this.results = [];
        this.repositoriesPath = path.join(__dirname, '..', 'src', 'repositories');
        this.serverPath = path.join(__dirname, '..', 'server.js');
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * Teste 1: Carregar database
     */
    async testDatabase() {
        this.log('\n🔌 Teste 1: Carregando database...', 'cyan');
        
        try {
            const db = require(path.join(__dirname, '..', 'database-postgresql.js'));
            
            // Teste simples de conexão
            const result = await db.all('SELECT 1 as test');
            
            if (result && result[0] && result[0].test === 1) {
                this.log('✅ Database conectado com sucesso', 'green');
                return { success: true, db };
            } else {
                throw new Error('Resposta inválida do banco');
            }
        } catch (error) {
            this.log(`❌ Erro ao conectar database: ${error.message}`, 'red');
            return { success: false, error: error.message };
        }
    }

    /**
     * Teste 2: Carregar BaseRepository
     */
    async testBaseRepository(db) {
        this.log('\n🏗️ Teste 2: Carregando BaseRepository...', 'cyan');
        
        try {
            const BaseRepository = require(path.join(this.repositoriesPath, 'base.repository.js'));
            const baseRepo = new BaseRepository(db);
            
            // Teste básico de métodos
            if (typeof baseRepo.findAll === 'function' && 
                typeof baseRepo.findOne === 'function' &&
                typeof baseRepo.create === 'function') {
                this.log('✅ BaseRepository carregado com sucesso', 'green');
                return { success: true, BaseRepository };
            } else {
                throw new Error('Métodos básicos não encontrados');
            }
        } catch (error) {
            this.log(`❌ Erro ao carregar BaseRepository: ${error.message}`, 'red');
            return { success: false, error: error.message };
        }
    }

    /**
     * Teste 3: Testar repository específico
     */
    async testRepository(repositoryPath, db, BaseRepository) {
        const repoName = path.basename(repositoryPath);
        this.log(`\n📦 Teste 3: Testando ${repoName}...`, 'cyan');
        
        try {
            const RepoClass = require(repositoryPath);
            const repo = new RepoClass(db);
            
            // Verificar se herda de BaseRepository
            if (!(repo instanceof BaseRepository)) {
                throw new Error('Repository não herda de BaseRepository');
            }
            
            // Contar métodos disponíveis
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(repo))
                .filter(name => name !== 'constructor' && typeof repo[name] === 'function');
            
            this.log(`✅ ${repoName} carregado com ${methods.length} métodos`, 'green');
            return { 
                success: true, 
                repository: repo, 
                methods,
                name: repoName 
            };
        } catch (error) {
            this.log(`❌ Erro ao testar ${repoName}: ${error.message}`, 'red');
            return { 
                success: false, 
                error: error.message,
                name: repoName 
            };
        }
    }

    /**
     * Teste 4: Executar query simples
     */
    async testSimpleQuery(repo, repoName) {
        this.log(`\n🔍 Teste 4: Query simples em ${repoName}...`, 'cyan');
        
        try {
            // Tentar uma query de teste simples
            const result = await repo.findAll('SELECT 1 as test_value');
            
            if (Array.isArray(result)) {
                this.log(`✅ Query executada com sucesso (${result.length} resultados)`, 'green');
                return { success: true, result };
            } else {
                throw new Error('Resultado não é um array');
            }
        } catch (error) {
            this.log(`❌ Erro na query: ${error.message}`, 'red');
            return { success: false, error: error.message };
        }
    }

    /**
     * Descobrir repositories existentes
     */
    discoverRepositories() {
        const fs = require('fs');
        
        try {
            const files = fs.readdirSync(this.repositoriesPath)
                .filter(file => file.endsWith('.repository.js') && file !== 'base.repository.js')
                .map(file => path.join(this.repositoriesPath, file));
            
            this.log(`\n🔍 Encontrados ${files.length} repositories para testar:`, 'blue');
            files.forEach(file => this.log(`  - ${path.basename(file)}`, 'blue'));
            
            return files;
        } catch (error) {
            this.log(`❌ Erro ao descobrir repositories: ${error.message}`, 'red');
            return [];
        }
    }

    /**
     * Executar todos os testes
     */
    async runAllTests() {
        this.log('🧪 INICIANDO TESTE DE REPOSITORIES', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        const startTime = Date.now();
        
        // 1. Testar database
        const dbResult = await this.testDatabase();
        if (!dbResult.success) {
            this.log('\n❌ FALHA CRÍTICA: Database não funcionando', 'red');
            return;
        }
        
        // 2. Testar BaseRepository
        const baseResult = await this.testBaseRepository(dbResult.db);
        if (!baseResult.success) {
            this.log('\n❌ FALHA CRÍTICA: BaseRepository não funcionando', 'red');
            return;
        }
        
        // 3. Descobrir repositories
        const repositories = this.discoverRepositories();
        if (repositories.length === 0) {
            this.log('\n⚠️ Nenhum repository encontrado para testar', 'yellow');
            return;
        }
        
        // 4. Testar cada repository
        const testResults = [];
        for (const repoPath of repositories) {
            const repoResult = await this.testRepository(repoPath, dbResult.db, baseResult.BaseRepository);
            testResults.push(repoResult);
            
            if (repoResult.success) {
                // Testar query simples
                await this.testSimpleQuery(repoResult.repository, repoResult.name);
            }
        }
        
        // 5. Resumo
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        this.log('\n' + '='.repeat(50), 'magenta');
        this.log('📊 RESUMO DOS TESTES', 'magenta');
        this.log('='.repeat(50), 'magenta');
        
        const successful = testResults.filter(r => r.success).length;
        const failed = testResults.filter(r => !r.success).length;
        
        this.log(`\n✅ Sucessos: ${successful}`, 'green');
        this.log(`❌ Falhas: ${failed}`, 'red');
        this.log(`⏱️ Duração: ${duration}s`, 'cyan');
        
        if (failed > 0) {
            this.log('\n🚨 REPOSITORIES COM FALHA:', 'red');
            testResults.filter(r => !r.success).forEach(r => {
                this.log(`  - ${r.name}: ${r.error}`, 'red');
            });
        }
        
        if (successful === testResults.length) {
            this.log('\n🎉 TODOS OS TESTES PASSARAM!', 'green');
            this.log('✅ Repositories prontos para migração', 'green');
        } else {
            this.log('\n⚠️ Corrija as falhas antes de prosseguir', 'yellow');
        }
    }
}

// Executar testes
const tester = new RepositoryTester();
tester.runAllTests().catch(error => {
    console.error('Erro geral nos testes:', error);
    process.exit(1);
});