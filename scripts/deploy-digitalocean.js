#!/usr/bin/env node
/**
 * @file scripts/deploy-digitalocean.js
 * @description Script de deploy otimizado para DigitalOcean App Platform
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

// Cores para console
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
    warn: (msg) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.cyan}🔄 ${msg}${colors.reset}`),
    title: (msg) => console.log(`${colors.bold}${colors.magenta}🚀 ${msg}${colors.reset}`)
};

class DigitalOceanDeployment {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.rootDir = process.cwd();
    }

    /**
     * Verificar pré-requisitos
     */
    async checkPrerequisites() {
        log.title('Verificando pré-requisitos para deploy');

        // Verificar Docker
        try {
            execSync('docker --version', { stdio: 'ignore' });
            log.success('Docker instalado');
        } catch {
            this.errors.push('Docker não está instalado ou não está no PATH');
        }

        // Verificar doctl (CLI da DigitalOcean)
        try {
            execSync('doctl version', { stdio: 'ignore' });
            log.success('doctl (DigitalOcean CLI) instalado');
        } catch {
            this.warnings.push('doctl não encontrado - necessário para deploy automático');
        }

        // Verificar git
        try {
            execSync('git --version', { stdio: 'ignore' });
            log.success('Git instalado');
        } catch {
            this.errors.push('Git não está instalado');
        }

        // Verificar se está no diretório correto
        if (!fs.existsSync(path.join(this.rootDir, 'server.js'))) {
            this.errors.push('Execute este script na raiz do projeto (onde está server.js)');
        } else {
            log.success('Diretório do projeto correto');
        }

        // Verificar se branch está limpa
        try {
            const status = execSync('git status --porcelain', { encoding: 'utf8' });
            if (status.trim()) {
                this.warnings.push('Existem mudanças não commitadas - considere fazer commit primeiro');
            } else {
                log.success('Working directory limpo');
            }
        } catch {
            this.warnings.push('Não foi possível verificar status do Git');
        }
    }

    /**
     * Validar configuração de produção
     */
    validateProductionConfig() {
        log.title('Validando configuração de produção');

        const envProdExample = path.join(this.rootDir, '.env.prod.example');
        if (!fs.existsSync(envProdExample)) {
            this.errors.push('.env.prod.example não encontrado');
            return;
        }

        log.success('Arquivo .env.prod.example encontrado');

        // Verificar se Dockerfile.prod existe
        const dockerfileProd = path.join(this.rootDir, 'Dockerfile.prod');
        if (!fs.existsSync(dockerfileProd)) {
            this.errors.push('Dockerfile.prod não encontrado');
        } else {
            log.success('Dockerfile.prod encontrado');
        }

        // Verificar package.json
        const packagePath = path.join(this.rootDir, 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            if (packageJson.scripts['start:prod']) {
                log.success('Script start:prod configurado');
            } else {
                this.warnings.push('Script start:prod não encontrado no package.json');
            }

            if (packageJson.scripts['docker:build:prod']) {
                log.success('Script docker:build:prod configurado');
            } else {
                this.warnings.push('Script docker:build:prod não encontrado');
            }
        }
    }

    /**
     * Executar testes antes do deploy
     */
    async runTests() {
        log.title('Executando testes');

        try {
            log.step('Executando verificação de ambiente...');
            execSync('npm run env:check', { stdio: 'inherit' });
            log.success('Verificação de ambiente passou');
        } catch (error) {
            this.errors.push(`Verificação de ambiente falhou: ${error.message}`);
            return;
        }

        try {
            log.step('Executando lint...');
            execSync('npm run lint', { stdio: 'ignore' });
            log.success('Lint passou');
        } catch (error) {
            this.warnings.push('Lint falhou - considere corrigir antes do deploy');
        }

        try {
            log.step('Executando testes unitários...');
            execSync('npm test', { stdio: 'ignore', timeout: 60000 });
            log.success('Testes unitários passaram');
        } catch (error) {
            this.warnings.push('Alguns testes falharam - verifique antes do deploy');
        }
    }

    /**
     * Construir imagem Docker de produção
     */
    async buildDockerImage() {
        log.title('Construindo imagem Docker de produção');

        const imageName = 'editaliza:prod';
        const imageTag = `editaliza:prod-${Date.now()}`;

        try {
            log.step('Construindo imagem Docker...');
            execSync(`DOCKER_BUILD=true docker build -f Dockerfile.prod -t ${imageName} -t ${imageTag} .`, {
                stdio: 'inherit',
                env: { ...process.env, DOCKER_BUILD: 'true' }
            });
            log.success(`Imagem construída: ${imageName}`);
            
            return { imageName, imageTag };
        } catch (error) {
            this.errors.push(`Falha na construção da imagem: ${error.message}`);
            throw error;
        }
    }

    /**
     * Testar imagem Docker localmente
     */
    async testDockerImage(imageName) {
        log.title('Testando imagem Docker localmente');

        const containerName = 'editaliza-deploy-test';

        try {
            // Parar container se estiver rodando
            try {
                execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
                execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
            } catch {
                // Container não estava rodando
            }

            log.step('Iniciando container de teste...');
            execSync(`docker run -d --name ${containerName} -p 3001:3000 -e NODE_ENV=production ${imageName}`, {
                stdio: 'ignore'
            });

            // Aguardar inicialização
            log.step('Aguardando inicialização (30s)...');
            await new Promise(resolve => setTimeout(resolve, 30000));

            // Testar health check
            try {
                execSync('curl -f http://localhost:3001/health', { stdio: 'ignore' });
                log.success('Health check passou');
            } catch {
                this.warnings.push('Health check falhou - verifique se a aplicação está funcionando');
            }

            // Limpar
            execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
            execSync(`docker rm ${containerName}`, { stdio: 'ignore' });

            log.success('Teste local da imagem concluído');

        } catch (error) {
            this.warnings.push(`Erro no teste local: ${error.message}`);
            
            // Tentar limpar mesmo em caso de erro
            try {
                execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
                execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
            } catch {
                // Ignorar erros de limpeza
            }
        }
    }

    /**
     * Gerar artefatos de deploy
     */
    async generateDeployArtifacts() {
        log.title('Gerando artefatos de deploy');

        // Criar diretório deploy
        const deployDir = path.join(this.rootDir, 'deploy');
        if (!fs.existsSync(deployDir)) {
            fs.mkdirSync(deployDir);
        }

        // Gerar docker-compose.prod.yml otimizado
        const composeContent = this.generateOptimizedCompose();
        fs.writeFileSync(path.join(deployDir, 'docker-compose.yml'), composeContent);
        log.success('docker-compose.yml gerado');

        // Copiar .env.prod.example
        const envExample = fs.readFileSync(path.join(this.rootDir, '.env.prod.example'), 'utf8');
        fs.writeFileSync(path.join(deployDir, '.env.example'), envExample);
        log.success('Arquivo .env.example copiado');

        // Gerar script de inicialização
        const startScript = this.generateStartScript();
        fs.writeFileSync(path.join(deployDir, 'start.sh'), startScript);
        fs.chmodSync(path.join(deployDir, 'start.sh'), '755');
        log.success('Script start.sh gerado');

        // Gerar documentação de deploy
        const deployDocs = this.generateDeployDocs();
        fs.writeFileSync(path.join(deployDir, 'README.md'), deployDocs);
        log.success('Documentação de deploy gerada');

        log.success(`Artefatos gerados em: ${deployDir}`);
        return deployDir;
    }

    /**
     * Gerar docker-compose otimizado
     */
    generateOptimizedCompose() {
        return `# DigitalOcean Production Deployment
version: '3.8'

services:
  editaliza:
    image: editaliza:prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - DOCKER_BUILD=true
      - HUSKY=0
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'
`;
    }

    /**
     * Gerar script de inicialização
     */
    generateStartScript() {
        return `#!/bin/bash
# Editaliza - Script de inicialização para DigitalOcean

set -e

echo "🚀 Iniciando Editaliza em produção..."

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "📋 Copie .env.example para .env e configure as variáveis"
    exit 1
fi

# Criar diretórios necessários
mkdir -p data uploads logs
chmod 755 data uploads logs

echo "✅ Diretórios criados"

# Iniciar com docker-compose
docker-compose up -d

echo "🎉 Editaliza iniciado com sucesso!"
echo "🔗 Acesse: http://localhost:3000"
echo "📊 Health: http://localhost:3000/health"
echo "📋 Logs: docker-compose logs -f"
`;
    }

    /**
     * Gerar documentação de deploy
     */
    generateDeployDocs() {
        return `# Editaliza - Deploy para DigitalOcean

## Pré-requisitos

- Docker instalado
- docker-compose instalado
- Arquivo .env configurado (copiar de .env.example)

## Deploy Rápido

1. Configurar variáveis de ambiente:
\`\`\`bash
cp .env.example .env
# Editar .env com valores reais
\`\`\`

2. Executar:
\`\`\`bash
./start.sh
\`\`\`

## Variáveis Importantes

### Obrigatórias
- SESSION_SECRET
- JWT_SECRET
- JWT_REFRESH_SECRET
- BASE_URL
- ALLOWED_ORIGINS

### Google OAuth
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL

### Email
- EMAIL_USER
- EMAIL_PASS

## Health Check

- URL: \`/health\`
- Intervalo: 30s
- Timeout: 10s
- Retries: 3

## Logs

\`\`\`bash
# Ver logs
docker-compose logs -f

# Ver logs específicos
docker-compose logs -f editaliza
\`\`\`

## Backup

\`\`\`bash
# Backup do banco
docker exec editaliza_container npm run backup

# Backup manual
cp data/db.sqlite backup/db_$(date +%Y%m%d).sqlite
\`\`\`

## Troubleshooting

### Container não inicia
1. Verificar logs: \`docker-compose logs\`
2. Verificar .env
3. Verificar portas disponíveis

### Health check falha
1. Verificar se aplicação respondeu na porta 3000
2. Verificar logs de inicialização
3. Aguardar até 60s para inicialização completa

## Comandos Úteis

\`\`\`bash
# Parar
docker-compose down

# Reiniciar
docker-compose restart

# Atualizar imagem
docker-compose pull
docker-compose up -d

# Limpar logs
docker-compose logs --tail=0 -f
\`\`\`
`;
    }

    /**
     * Relatório final
     */
    generateReport(deployDir, imageInfo) {
        log.title('RELATÓRIO DE DEPLOY');

        console.log(`\n${colors.blue}📦 ARTEFATOS GERADOS:${colors.reset}`);
        console.log(`   📁 Diretório: ${deployDir}`);
        console.log(`   🐳 Imagem: ${imageInfo.imageName}`);
        console.log(`   🏷️  Tag: ${imageInfo.imageTag}`);

        if (this.errors.length === 0) {
            console.log(`\n${colors.green}✅ DEPLOY PREPARADO COM SUCESSO!${colors.reset}`);
            
            console.log(`\n${colors.cyan}🚀 PRÓXIMOS PASSOS:${colors.reset}`);
            console.log(`   1. Configurar .env com valores reais`);
            console.log(`   2. Fazer upload da imagem para registry`);
            console.log(`   3. Configurar DigitalOcean App Platform`);
            console.log(`   4. Deploy!`);

        } else {
            console.log(`\n${colors.red}❌ ERROS ENCONTRADOS:${colors.reset}`);
            this.errors.forEach(error => log.error(error));
        }

        if (this.warnings.length > 0) {
            console.log(`\n${colors.yellow}⚠️  AVISOS:${colors.reset}`);
            this.warnings.forEach(warning => log.warn(warning));
        }
    }

    /**
     * Executar todo o processo de deploy
     */
    async deploy() {
        console.log(`${colors.bold}${colors.magenta}🚀 DEPLOY EDITALIZA - DIGITALOCEAN${colors.reset}`);
        console.log(`${colors.magenta}=====================================\n${colors.reset}`);

        try {
            await this.checkPrerequisites();
            
            if (this.errors.length > 0) {
                log.error('Corrija os erros antes de continuar');
                process.exit(1);
            }

            this.validateProductionConfig();
            
            if (this.errors.length > 0) {
                log.error('Corrija os erros de configuração');
                process.exit(1);
            }

            await this.runTests();
            const imageInfo = await this.buildDockerImage();
            await this.testDockerImage(imageInfo.imageName);
            const deployDir = await this.generateDeployArtifacts();

            this.generateReport(deployDir, imageInfo);

        } catch (error) {
            log.error(`Erro durante o deploy: ${error.message}`);
            process.exit(1);
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const deployment = new DigitalOceanDeployment();
    deployment.deploy().catch(console.error);
}

module.exports = DigitalOceanDeployment;