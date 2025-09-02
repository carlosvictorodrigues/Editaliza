/**
 * Controller de Recuperação de Senha
 * Gerencia o fluxo completo de reset de senha com templates padronizados
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const emailService = require('../services/emailService');
const { authLogger } = require('../utils/logger');

/**
 * Solicitar recuperação de senha
 */
const requestPasswordReset = async (req, res) => {
    const logger = authLogger.child({ 
        method: 'requestPasswordReset',
        ip: req.ip
    });
    
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }
        
        logger.info('Password reset requested', { email });
        
        // Buscar usuário pelo email
        const userQuery = await db.query(
            'SELECT id, name, email FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );
        
        if (userQuery.rows.length === 0) {
            // Por segurança, sempre retornar sucesso mesmo se email não existe
            logger.warn('Password reset requested for non-existent email', { email });
            return res.json({
                success: true,
                message: 'Se o email existir em nossa base, você receberá instruções de recuperação.'
            });
        }
        
        const user = userQuery.rows[0];
        
        // Gerar token único de recuperação
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora
        
        // Salvar token no banco
        await db.query(
            `UPDATE users 
             SET reset_token = $1, 
                 reset_token_expiry = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [resetTokenHash, resetTokenExpiry, user.id]
        );
        
        // Enviar email com template padronizado
        const emailResult = await emailService.sendPasswordRecoveryEmail(
            user.email,
            user.name || 'Usuário',
            resetToken,
            process.env.APP_URL || 'https://app.editaliza.com.br'
        );
        
        if (emailResult.success) {
            logger.info('Password reset email sent successfully', { 
                userId: user.id,
                email: user.email 
            });
            
            res.json({
                success: true,
                message: 'Email de recuperação enviado! Verifique sua caixa de entrada.'
            });
        } else {
            logger.error('Failed to send password reset email', {
                userId: user.id,
                email: user.email,
                error: emailResult.error
            });
            
            // Ainda retorna sucesso para não expor informações
            res.json({
                success: true,
                message: 'Se o email existir em nossa base, você receberá instruções de recuperação.'
            });
        }
        
    } catch (error) {
        logger.error('Password reset request failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao processar solicitação. Tente novamente mais tarde.'
        });
    }
};

/**
 * Resetar senha com token
 */
const resetPassword = async (req, res) => {
    const logger = authLogger.child({ 
        method: 'resetPassword',
        ip: req.ip
    });
    
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token e nova senha são obrigatórios'
            });
        }
        
        // Validar força da senha
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'A senha deve ter pelo menos 8 caracteres'
            });
        }
        
        // Hash do token recebido
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        // Buscar usuário com token válido
        const userQuery = await db.query(
            `SELECT id, email, name 
             FROM users 
             WHERE reset_token = $1 
             AND reset_token_expiry > NOW()`,
            [resetTokenHash]
        );
        
        if (userQuery.rows.length === 0) {
            logger.warn('Invalid or expired reset token used', { tokenHash: resetTokenHash });
            return res.status(400).json({
                success: false,
                error: 'Token inválido ou expirado. Solicite uma nova recuperação de senha.'
            });
        }
        
        const user = userQuery.rows[0];
        
        // Hash da nova senha
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Atualizar senha e limpar token
        await db.query(
            `UPDATE users 
             SET password_hash = $1,
                 reset_token = NULL,
                 reset_token_expiry = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [passwordHash, user.id]
        );
        
        logger.info('Password reset successful', {
            userId: user.id,
            email: user.email
        });
        
        // Opcional: Enviar email de confirmação
        try {
            await emailService.sendEmail({
                to: user.email,
                subject: '✅ Senha Alterada com Sucesso - Editaliza',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Senha alterada com sucesso!</h2>
                        <p>Olá ${user.name || 'Usuário'},</p>
                        <p>Sua senha foi alterada com sucesso.</p>
                        <p>Se você não realizou esta alteração, entre em contato conosco imediatamente.</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">
                            Esta alteração foi realizada em: ${new Date().toLocaleString('pt-BR')}<br>
                            IP: ${req.ip}
                        </p>
                    </div>
                `
            });
        } catch (emailError) {
            // Não falhar se email de confirmação não enviar
            logger.error('Failed to send password change confirmation', {
                error: emailError.message
            });
        }
        
        res.json({
            success: true,
            message: 'Senha alterada com sucesso! Você já pode fazer login.'
        });
        
    } catch (error) {
        logger.error('Password reset failed', {
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Erro ao resetar senha. Tente novamente mais tarde.'
        });
    }
};

/**
 * Validar token de recuperação (para verificar se ainda é válido)
 */
const validateResetToken = async (req, res) => {
    try {
        const { token } = req.params;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token é obrigatório'
            });
        }
        
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const userQuery = await db.query(
            `SELECT id 
             FROM users 
             WHERE reset_token = $1 
             AND reset_token_expiry > NOW()`,
            [resetTokenHash]
        );
        
        if (userQuery.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Token inválido ou expirado'
            });
        }
        
        res.json({
            success: true,
            message: 'Token válido'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erro ao validar token'
        });
    }
};

module.exports = {
    requestPasswordReset,
    resetPassword,
    validateResetToken
};