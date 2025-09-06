// Webhook de deploy para Editaliza
// Adicionar este código ao server.js ou criar rota separada

const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuração
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'editaliza-deploy-2024';
const DEPLOY_SCRIPT = '/root/editaliza/deploy/auto-deploy.sh';

/**
 * Configurar rotas de webhook para deploy
 * @param {Express} app - Instância do Express
 */
function setupWebhookRoutes(app) {
    /**
     * Rota de webhook para deploy automático
     * POST /webhook/deploy
     */
    app.post('/webhook/deploy', async (req, res) => {
    try {
        // Verificar token de autenticação
        const token = req.headers['x-deploy-token'] || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Token de autenticação não fornecido' });
        }

        // Validar token (simples por enquanto, pode usar JWT depois)
        const expectedToken = crypto
            .createHash('sha256')
            .update(WEBHOOK_SECRET + new Date().toISOString().split('T')[0])
            .digest('hex');

        if (token !== expectedToken && token !== WEBHOOK_SECRET) {
            console.error('[WEBHOOK] Token inválido recebido');
            return res.status(403).json({ error: 'Token inválido' });
        }

        console.info('[WEBHOOK] Deploy iniciado via webhook');
        
        // Executar deploy em background
        res.json({ 
            message: 'Deploy iniciado', 
            timestamp: new Date().toISOString() 
        });

        // Executar script de deploy
        try {
            const { stdout, stderr } = await execPromise(`bash ${DEPLOY_SCRIPT}`);
            console.info('[WEBHOOK] Deploy concluído:', stdout);
            if (stderr) console.error('[WEBHOOK] Avisos:', stderr);
        } catch (error) {
            console.error('[WEBHOOK] Erro no deploy:', error);
        }

    } catch (error) {
        console.error('[WEBHOOK] Erro:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
    });

    /**
     * Rota para verificar status do deploy
     * GET /webhook/deploy/status
     */
    app.get('/webhook/deploy/status', (req, res) => {
    const fs = require('fs');
    const logFile = '/var/log/editaliza-deploy.log';
    
    try {
        // Ler últimas linhas do log
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8')
                .split('\n')
                .slice(-20)
                .join('\n');
            
            res.json({
                status: 'ok',
                lastLogs: logs,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                status: 'no_logs',
                message: 'Arquivo de log não encontrado'
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
    });
}

// Exportar para uso no server.js
module.exports = { setupWebhookRoutes };