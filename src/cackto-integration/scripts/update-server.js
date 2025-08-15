// update-server.js - Script para atualizar server.js com integração CACKTO
const fs = require('fs');
const path = require('path');

class ServerUpdater {
    constructor() {
        this.serverPath = path.join(__dirname, '../../../server.js');
        this.backupPath = this.serverPath + '.backup-before-cackto';
    }

    /**
     * Atualiza o server.js para incluir integração CACKTO
     */
    async updateServer() {
        try {
            console.log('🔄 Atualizando server.js para integração CACKTO...');
            
            // 1. Criar backup
            await this.createBackup();
            
            // 2. Ler arquivo atual
            const serverContent = fs.readFileSync(this.serverPath, 'utf8');
            
            // 3. Verificar se já foi atualizado
            if (serverContent.includes('cackto-integration')) {
                console.log('ℹ️ Server.js já foi atualizado para CACKTO');
                return;
            }
            
            // 4. Adicionar importações CACKTO
            const updatedContent = this.addCacktoImports(serverContent);
            
            // 5. Adicionar rotas CACKTO
            const finalContent = this.addCacktoRoutes(updatedContent);
            
            // 6. Escrever arquivo atualizado
            fs.writeFileSync(this.serverPath, finalContent);
            
            console.log('✅ Server.js atualizado com sucesso');
            console.log('💾 Backup salvo em:', this.backupPath);
            
        } catch (error) {
            console.error('❌ Erro ao atualizar server.js:', error.message);
            
            // Restaurar backup se houver erro
            if (fs.existsSync(this.backupPath)) {
                fs.copyFileSync(this.backupPath, this.serverPath);
                console.log('🔄 Backup restaurado');
            }
            
            throw error;
        }
    }

    /**
     * Cria backup do server.js atual
     */
    async createBackup() {
        if (!fs.existsSync(this.serverPath)) {
            throw new Error('Arquivo server.js não encontrado');
        }
        
        fs.copyFileSync(this.serverPath, this.backupPath);
        console.log('💾 Backup do server.js criado');
    }

    /**
     * Adiciona importações da integração CACKTO
     */
    addCacktoImports(content) {
        // Procurar por importações existentes
        const importSection = content.indexOf('require(\'dotenv\').config();');
        
        if (importSection === -1) {
            throw new Error('Seção de imports não encontrada');
        }
        
        const cacktoImports = `
// Importar integração CACKTO
const { 
    CacktoRoutes,
    initialize: initializeCackto,
    checkCacktoSubscription,
    requirePremiumFeature,
    addSubscriptionInfo
} = require('./src/cackto-integration');`;
        
        // Inserir após a linha do dotenv
        const insertPosition = content.indexOf('\n', importSection) + 1;
        
        return content.slice(0, insertPosition) + 
               cacktoImports + '\n' + 
               content.slice(insertPosition);
    }

    /**
     * Adiciona rotas e configurações CACKTO
     */
    addCacktoRoutes(content) {
        // Procurar por onde adicionar as rotas (após rate limiting)
        const rateLimitLine = content.indexOf('app.use(\'/api/\', moderateRateLimit);');
        
        if (rateLimitLine === -1) {
            throw new Error('Linha de rate limit não encontrada');
        }
        
        const cacktoSetup = `

// ==========================================
// INTEGRAÇÃO CACKTO
// ==========================================

// Inicializar integração CACKTO
(async () => {
    try {
        const result = await initializeCackto({
            enableCache: true,
            enableMetrics: true,
            syncOnInit: false
        });
        console.log('✅ Integração CACKTO inicializada:', result.message);
    } catch (error) {
        console.error('❌ Erro ao inicializar CACKTO:', error.message);
    }
})();

// Adicionar informações de assinatura a todas as rotas autenticadas
app.use(authenticateToken, addSubscriptionInfo());

// Rotas de webhook CACKTO (ANTES do rate limiting para APIs)
app.use('/api/webhooks', CacktoRoutes);

// Middleware para rotas que precisam de assinatura ativa
const requireActiveSubscription = checkCacktoSubscription({
    redirectToPlans: false,
    strict: true
});

// Middleware para funcionalidades premium específicas
const requirePDFDownload = requirePremiumFeature('pdf_download');
const requireAdvancedSearch = requirePremiumFeature('advanced_search');
const requireOfflineAccess = requirePremiumFeature('offline_access');`;

        // Inserir antes do rate limiting
        const insertPosition = content.indexOf('app.use(\'/api/\', moderateRateLimit);');
        
        return content.slice(0, insertPosition) + 
               cacktoSetup + '\n\n' + 
               content.slice(insertPosition);
    }

    /**
     * Adiciona proteção de rotas premium
     */
    addPremiumRouteProtection(content) {
        // Estas rotas devem ser protegidas por assinatura
        const premiumRoutes = [
            { pattern: '/api/download-pdf', middleware: 'requirePDFDownload' },
            { pattern: '/api/advanced-search', middleware: 'requireAdvancedSearch' },
            { pattern: '/api/export', middleware: 'requireActiveSubscription' },
            { pattern: '/api/bulk-download', middleware: 'requireActiveSubscription' }
        ];
        
        let updatedContent = content;
        
        for (const route of premiumRoutes) {
            // Procurar pela definição da rota
            const routePattern = new RegExp(`app\\.(get|post|put|delete)\\s*\\(\\s*['"\`]${route.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            
            updatedContent = updatedContent.replace(routePattern, (match) => {
                // Verificar se já tem middleware de assinatura
                if (match.includes('requireActiveSubscription') || 
                    match.includes('requirePremiumFeature') ||
                    match.includes('checkCacktoSubscription')) {
                    return match; // Já protegido
                }
                
                // Adicionar middleware de proteção
                const methodEnd = match.indexOf('(');
                const routeStart = match.indexOf("'") || match.indexOf('"') || match.indexOf('`');
                
                return match.slice(0, methodEnd + 1) + 
                       `'${route.pattern}', ${route.middleware}, ` + 
                       match.slice(routeStart);
            });
        }
        
        return updatedContent;
    }

    /**
     * Verifica se a atualização foi bem-sucedida
     */
    validateUpdate() {
        const content = fs.readFileSync(this.serverPath, 'utf8');
        
        const requiredElements = [
            'cackto-integration',
            'initializeCackto',
            'CacktoRoutes',
            'checkCacktoSubscription'
        ];
        
        const missing = requiredElements.filter(element => !content.includes(element));
        
        if (missing.length > 0) {
            throw new Error(`Elementos não encontrados após atualização: ${missing.join(', ')}`);
        }
        
        console.log('✅ Atualização do server.js validada');
    }

    /**
     * Gera exemplo de uso das rotas protegidas
     */
    generateUsageExamples() {
        const examples = `
// ==========================================
// EXEMPLOS DE USO - INTEGRAÇÃO CACKTO
// ==========================================

// Rota protegida por assinatura ativa
app.get('/api/premium-content', requireActiveSubscription, async (req, res) => {
    // req.subscription conterá informações da assinatura
    res.json({
        message: 'Conteúdo premium',
        subscription: req.subscription
    });
});

// Rota que requer funcionalidade específica
app.post('/api/download-pdf', requirePDFDownload, async (req, res) => {
    // Usuário tem acesso a download de PDF
    res.json({ downloadUrl: 'https://...' });
});

// Rota com verificação flexível
app.get('/api/user-dashboard', addSubscriptionInfo(), async (req, res) => {
    const { hasActiveSubscription, plan } = req.subscription || {};
    
    res.json({
        user: req.user,
        hasSubscription: hasActiveSubscription,
        plan: plan,
        features: {
            pdfDownload: hasActiveSubscription,
            advancedSearch: plan?.includes('premium'),
            prioritySupport: plan?.includes('premium')
        }
    });
});

// Status da integração CACKTO
app.get('/api/cackto/status', authenticateToken, async (req, res) => {
    const { getStatus } = require('./src/cackto-integration');
    const status = await getStatus();
    res.json(status);
});`;

        console.log('\n📋 EXEMPLOS DE USO:');
        console.log(examples);
        
        return examples;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const updater = new ServerUpdater();
    
    updater.updateServer()
        .then(() => {
            updater.validateUpdate();
            updater.generateUsageExamples();
            
            console.log('\n🎉 Atualização concluída com sucesso!');
            console.log('\n🔄 PRÓXIMOS PASSOS:');
            console.log('1. Reiniciar o servidor');
            console.log('2. Testar endpoint: GET /api/webhooks/cackto/health');
            console.log('3. Configurar webhook na CACKTO');
            console.log('4. Proteger rotas premium com middleware');
            
            process.exit(0);
        })
        .catch(error => {
            console.error('Falha na atualização:', error);
            process.exit(1);
        });
}

module.exports = ServerUpdater;