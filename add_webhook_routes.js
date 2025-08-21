const fs = require('fs');

// Ler o arquivo server_production.js
let serverContent = fs.readFileSync('server_production.js', 'utf8');

// Verificar se as rotas já existem
if (!serverContent.includes('cackto-integration')) {
    // Adicionar imports no início do arquivo (após outros requires)
    const importText = `
// Cackto Integration
const cacktoWebhook = require("./src/cackto-integration/webhooks/processor");
const { validateWebhook } = require("./src/cackto-integration/webhooks/validator");
`;
    
    // Adicionar após os outros requires
    serverContent = serverContent.replace(
        /(const emailService = require.*\n)/,
        `$1${importText}`
    );
    
    // Adicionar rotas de webhook antes do app.listen
    const routeText = `
// Webhook da Cackto para processar pagamentos
app.post("/webhook/cackto", async (req, res) => {
    try {
        // Validar webhook
        const isValid = validateWebhook(req);
        if (!isValid) {
            return res.status(401).json({ error: "Invalid webhook signature" });
        }
        
        // Processar webhook
        const result = await cacktoWebhook.processWebhook(req.body);
        
        res.status(200).json({ 
            success: true, 
            message: "Webhook processed successfully",
            data: result 
        });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ 
            error: "Webhook processing failed",
            message: error.message 
        });
    }
});

// Verificar status de assinatura
app.get("/api/subscription/status/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const db = require("better-sqlite3")("database.db");
        
        const subscription = db.prepare(\`
            SELECT * FROM subscriptions 
            WHERE user_id = ? 
            AND status = 'active' 
            AND end_date > datetime('now')
            ORDER BY created_at DESC 
            LIMIT 1
        \`).get(userId);
        
        res.json({
            hasActiveSubscription: !!subscription,
            subscription: subscription || null
        });
    } catch (error) {
        console.error("Subscription check error:", error);
        res.status(500).json({ error: "Failed to check subscription" });
    }
});

`;
    
    // Adicionar antes do app.listen
    serverContent = serverContent.replace(
        /(app\.listen\(PORT.*)/,
        `${routeText}$1`
    );
    
    // Salvar o arquivo
    fs.writeFileSync('server_production.js', serverContent);
    console.info('✅ Rotas de webhook adicionadas com sucesso!');
} else {
    console.info('ℹ️ Rotas de webhook já existem no servidor');
}