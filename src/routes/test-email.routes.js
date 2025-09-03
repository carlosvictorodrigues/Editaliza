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

        console.log(`📧 Iniciando envio de email de teste para: ${email}`);
        
        // Adicionar timeout para evitar travamento
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao enviar email')), 10000);
        });
        
        const emailPromise = userProvisioningService.sendWelcomeEmail(testData);
        
        // Executar com timeout
        await Promise.race([emailPromise, timeoutPromise]);
        
        console.log(`✅ Email enviado com sucesso para: ${email}`);
        
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
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
 * POST /api/test/send-schedule-email
 * Envia email de cronograma de estudos
 */
router.post('/send-schedule-email', async (req, res) => {
    try {
        const { email = 'carlosvictorodrigues@gmail.com' } = req.body;
        
        console.log(`📧 Enviando email de cronograma para: ${email}`);
        
        // Dados de exemplo do cronograma
        const scheduleData = {
            topics: [
                {
                    subject: 'Português',
                    name: 'Concordância Verbal e Nominal',
                    duration: 45
                },
                {
                    subject: 'Matemática',
                    name: 'Razão e Proporção',
                    duration: 60
                },
                {
                    subject: 'Direito Constitucional',
                    name: 'Direitos e Garantias Fundamentais',
                    duration: 90
                },
                {
                    subject: 'Informática',
                    name: 'Excel - Fórmulas e Funções',
                    duration: 30
                }
            ],
            streak: 7,
            todayGoal: 4,
            completedToday: 1,
            totalMinutes: 225
        };
        
        // Calcular estatísticas
        const totalHours = Math.floor(scheduleData.totalMinutes / 60);
        const remainingMinutes = scheduleData.totalMinutes % 60;
        
        await emailService.sendDailyScheduleEmail(
            email,
            'Carlos Victor',
            scheduleData
        );
        
        console.log(`✅ Email de cronograma enviado para: ${email}`);
        
        res.json({
            success: true,
            message: `Email de cronograma enviado para ${email}`,
            details: {
                destinatario: email,
                topicosHoje: scheduleData.topics.length,
                tempoTotal: `${totalHours}h${remainingMinutes > 0 ? remainingMinutes + 'min' : ''}`,
                sequenciaDias: scheduleData.streak
            }
        });

    } catch (error) {
        console.error('❌ Erro ao enviar email de cronograma:', error);
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
        sendgrid_configured: !!process.env.SENDGRID_API_KEY,
        templates_available: [
            'welcome',
            'passwordRecovery',
            'dailySchedule',
            'weeklyReport',
            'studyReminder',
            'achievement',
            'baseTemplate'
        ]
    };
    
    res.json({
        success: true,
        config
    });
});

module.exports = router;