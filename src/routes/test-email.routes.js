// Rota de teste para envio de emails
const router = require('express').Router();
const emailService = require('../services/emailService');
const userProvisioningService = require('../services/userProvisioningService');

/**
 * POST /api/test/send-welcome-email
 * Envia email de boas-vindas de teste
 */
router.post('/send-welcome-email', async (req, res) => {
    try {
        const { email = 'carlosvictorodrigues@gmail.com' } = req.body;
        
        // Dados de teste para o email
        const testData = {
            email: email,
            name: 'Carlos Victor',
            password: 'Senha@Teste123',
            planType: 'anual',
            expiryDate: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
        };

        console.log(`📧 Enviando email de teste para: ${email}`);
        
        // Usar o método sendWelcomeEmail do userProvisioningService
        await userProvisioningService.sendWelcomeEmail(testData);
        
        res.json({
            success: true,
            message: `Email de boas-vindas enviado para ${email}`,
            testData: {
                destinatario: email,
                plano: 'Plano Anual',
                senhaTemporaria: 'Senha@Teste123',
                validadeAte: testData.expiryDate.toLocaleDateString('pt-BR')
            }
        });

    } catch (error) {
        console.error('❌ Erro ao enviar email de teste:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/test/send-test-email
 * Envia email simples de teste
 */
router.post('/send-test-email', async (req, res) => {
    try {
        const { email = 'carlosvictorodrigues@gmail.com' } = req.body;
        
        console.log(`📧 Enviando email simples de teste para: ${email}`);
        
        const emailContent = `
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif;">
                <h2 style="color: #0528f2;">Teste de Email - Editaliza</h2>
                
                <p style="font-size: 16px; color: #333;">
                    Este é um email de teste do sistema Editaliza.
                </p>

                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0528f2;">Status do Sistema de Email:</h3>
                    <p>✅ Sistema de email funcionando corretamente</p>
                    <p>✅ Templates HTML renderizando</p>
                    <p>✅ Integração com servidor SMTP ativa</p>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Email enviado em: ${new Date().toLocaleString('pt-BR')}
                </p>
            </div>
        `;
        
        const htmlBody = emailService.templates.baseTemplate(emailContent);
        
        await emailService.sendEmail({
            to: email,
            subject: 'Teste de Email - Sistema Editaliza',
            html: htmlBody
        });
        
        res.json({
            success: true,
            message: `Email de teste enviado para ${email}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro ao enviar email de teste:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

/**
 * GET /api/test/email-config
 * Verifica configuração de email
 */
router.get('/email-config', (req, res) => {
    const config = {
        smtp_configured: !!process.env.EMAIL_HOST,
        host: process.env.EMAIL_HOST || 'não configurado',
        port: process.env.EMAIL_PORT || 'não configurado',
        user: process.env.EMAIL_USER || 'não configurado',
        templates_available: [
            'welcome',
            'passwordRecovery',
            'dailySchedule',
            'baseTemplate'
        ]
    };
    
    res.json({
        success: true,
        config
    });
});

module.exports = router;