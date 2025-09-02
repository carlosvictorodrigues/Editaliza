const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

module.exports = function(db, emailSchedulerService) {
    // Obter preferências de email do usuário
    router.get('/preferences', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            
            const query = `
                SELECT 
                    daily_schedule,
                    weekly_summary,
                    study_reminders,
                    achievement_notifications,
                    email_time,
                    timezone
                FROM email_preferences
                WHERE user_id = $1
            `;
            
            const result = await db.query(query, [userId]);
            
            if (result.rows.length === 0) {
                // Criar preferências padrão se não existirem
                const preferences = await emailSchedulerService.createEmailPreferences(userId);
                return res.json(preferences);
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Erro ao buscar preferências de email:', error);
            res.status(500).json({ error: 'Erro ao buscar preferências' });
        }
    });

    // Atualizar preferências de email
    router.put('/preferences', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const preferences = req.body;
            
            const updated = await emailSchedulerService.updateEmailPreferences(userId, preferences);
            
            res.json({
                success: true,
                message: 'Preferências atualizadas com sucesso',
                preferences: updated
            });
        } catch (error) {
            console.error('Erro ao atualizar preferências:', error);
            res.status(500).json({ error: 'Erro ao atualizar preferências' });
        }
    });

    // Descadastrar via token (não requer autenticação)
    router.get('/unsubscribe', async (req, res) => {
        try {
            const { token, type = 'daily_schedule' } = req.query;
            
            if (!token) {
                return res.status(400).send(`
                    <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h2>❌ Link inválido</h2>
                        <p>O link de descadastro está incorreto.</p>
                    </body>
                    </html>
                `);
            }
            
            const result = await emailSchedulerService.unsubscribeByToken(token, type);
            
            if (result) {
                return res.send(`
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Descadastro realizado</title>
                    </head>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px; background: #f3f4f6;">
                        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <h2 style="color: #10b981; margin-bottom: 20px;">✅ Descadastro realizado</h2>
                            <p style="color: #6b7280; line-height: 1.6;">
                                ${type === 'all' 
                                    ? 'Você não receberá mais emails do Editaliza.' 
                                    : 'Você não receberá mais emails de cronograma diário.'}
                            </p>
                            <p style="color: #6b7280; margin-top: 20px;">
                                Você pode reativar os emails a qualquer momento nas configurações da sua conta.
                            </p>
                            <a href="https://app.editaliza.com.br" 
                               style="display: inline-block; margin-top: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                                Voltar ao Editaliza
                            </a>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                return res.status(404).send(`
                    <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h2>❌ Token não encontrado</h2>
                        <p>O link de descadastro expirou ou é inválido.</p>
                    </body>
                    </html>
                `);
            }
        } catch (error) {
            console.error('Erro ao descadastrar:', error);
            res.status(500).send(`
                <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2>❌ Erro ao processar descadastro</h2>
                    <p>Por favor, tente novamente mais tarde.</p>
                </body>
                </html>
            `);
        }
    });

    // Enviar email de teste (apenas para desenvolvimento)
    router.post('/test', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            
            // Verificar se está em desenvolvimento ou se usuário é admin
            if (process.env.NODE_ENV === 'production' && !req.user.isAdmin) {
                return res.status(403).json({ error: 'Recurso não disponível' });
            }
            
            const sent = await emailSchedulerService.sendTestEmail(userId);
            
            if (sent) {
                res.json({
                    success: true,
                    message: 'Email de teste enviado com sucesso'
                });
            } else {
                res.status(404).json({
                    error: 'Usuário não encontrado'
                });
            }
        } catch (error) {
            console.error('Erro ao enviar email de teste:', error);
            res.status(500).json({ error: 'Erro ao enviar email de teste' });
        }
    });

    // Obter estatísticas de emails
    router.get('/stats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            
            const query = `
                SELECT 
                    email_type,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
                    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
                    MAX(sent_at) as last_sent
                FROM email_logs
                WHERE user_id = $1
                AND sent_at >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY email_type
            `;
            
            const result = await db.query(query, [userId]);
            
            res.json({
                stats: result.rows,
                period: '30 days'
            });
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ error: 'Erro ao buscar estatísticas' });
        }
    });

    return router;
};