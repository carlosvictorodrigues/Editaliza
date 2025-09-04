/**
 * Serviço de Provisionamento de Usuários
 * 
 * Responsável por criar contas de usuário após confirmação de pagamento
 * e enviar credenciais por email
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');
const { dbRun, dbGet } = require('../utils/database');

class UserProvisioningService {
    constructor() {
        this.planTypes = {
            'mensal': {
                name: 'Plano Mensal',
                duration: 30,
                features: ['Acesso completo', 'Suporte prioritário', 'Atualizações mensais']
            },
            'semestral': {
                name: 'Plano Semestral',
                duration: 180,
                features: ['Acesso completo', 'Suporte prioritário', 'Atualizações semanais', 'Desconto de 15%']
            },
            'anual': {
                name: 'Plano Anual',
                duration: 365,
                features: ['Acesso completo', 'Suporte VIP', 'Atualizações diárias', 'Desconto de 30%', 'Material exclusivo']
            }
        };
    }

    /**
     * Gera uma senha segura aleatória
     */
    generateSecurePassword() {
        const length = 12;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
        let password = '';
        
        // Garantir pelo menos um de cada tipo
        password += 'A'; // Maiúscula
        password += 'a'; // Minúscula
        password += '1'; // Número
        password += '!'; // Especial
        
        // Preencher o resto aleatoriamente
        for (let i = 4; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        // Embaralhar a senha
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    /**
     * Cria um novo usuário após confirmação de pagamento
     */
    async createUserFromPayment(paymentData) {
        try {
            const {
                customer_email,
                customer_name,
                plan_type,
                transaction_id,
                amount
            } = paymentData;

            // Verificar se usuário já existe
            const existingUser = await dbGet(
                'SELECT id FROM users WHERE email = ?',
                [customer_email]
            );

            if (existingUser) {
                // Atualizar plano existente
                return await this.updateUserPlan(existingUser.id, plan_type, transaction_id);
            }

            // Gerar credenciais
            const tempPassword = this.generateSecurePassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            
            // Criar usuário
            const insertedRow = await dbGet(`
                    INSERT INTO users (
                        email,
                        name,
                        password_hash,
                        plan_type,
                        plan_status,
                        plan_expiry,
                        cackto_transaction_id,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, 'active', NOW() + INTERVAL '${this.planTypes[plan_type].duration} days', ?, NOW(), NOW())
                    RETURNING id
                `, [
                    customer_email,
                    customer_name,
                    hashedPassword,
                    plan_type,
                    transaction_id
                ]);

                const newUserId = insertedRow && insertedRow.id ? insertedRow.id : null;
// Enviar email com credenciais
    
            console.info('[DEBUG_EMAIL] prestes a enviar welcome email para:', customer_email);
    
            const sendResult = await this.sendWelcomeEmail({
                email: customer_email,
                name: customer_name,
                password: tempPassword,
                planType: plan_type,
                expiryDate: new Date(Date.now() + (this.planTypes[plan_type].duration * 24 * 60 * 60 * 1000))
            });
    
            console.info('[DEBUG_EMAIL] resultado do envio welcome:', sendResult);


            console.log(`✅ Usuário criado com sucesso: ${customer_email}`);
            
            return {
                success: true,
                userId: newUserId,
                email: customer_email,
                planType: plan_type
            };

        } catch (error) {
            console.error('❌ Erro ao criar usuário:', error);
            throw error;
        }
    }

    /**
     * Atualiza o plano de um usuário existente
     */
    async updateUserPlan(userId, planType, transactionId) {
        try {
            await dbRun(`
                UPDATE users SET 
                    plan_type = ?,
                    plan_status = 'active',
                    plan_expiry = NOW() + INTERVAL '${this.planTypes[planType].duration} days',
                    cackto_transaction_id = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [planType, transactionId, userId]);

            const user = await dbGet('SELECT email, name FROM users WHERE id = ?', [userId]);

            // Enviar email de renovação
    
            console.info('[DEBUG_EMAIL] prestes a enviar renewal email para:', user.email);
    
            const renewalResult = await this.sendRenewalEmail({
                email: user.email,
                name: user.name,
                planType: planType,
                expiryDate: new Date(Date.now() + (this.planTypes[planType].duration * 24 * 60 * 60 * 1000))
            });
    
            console.info('[DEBUG_EMAIL] resultado do envio renewal:', renewalResult);


            return {
                success: true,
                userId: userId,
                planType: planType,
                renewed: true
            };

        } catch (error) {
            console.error('❌ Erro ao atualizar plano:', error);
            throw error;
        }
    }

    /**
     * Envia email de boas-vindas com credenciais
     */
    async sendWelcomeEmail(userData) {
        const { email, name, password, planType, expiryDate } = userData;
        const plan = this.planTypes[planType];

        const emailContent = `
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif;">
                <h2 style="color: #0528f2;">Bem-vindo ao Editaliza, ${name}!</h2>
                
                <p style="font-size: 16px; color: #333;">
                    Sua assinatura do <strong>${plan.name}</strong> foi ativada com sucesso!
                </p>

                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0528f2; margin-top: 0;">Suas Credenciais de Acesso:</h3>
                    <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 10px 0;"><strong>Senha temporária:</strong> <code style="background: #fff; padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px;">${password}</code></p>
                    
                    <p style="color: #dc3545; font-size: 14px; margin-top: 15px;">
                        ⚠️ <strong>Importante:</strong> Por segurança, altere sua senha no primeiro acesso.
                    </p>
                </div>

                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1ad937; margin-top: 0;">Seu Plano Inclui:</h3>
                    <ul style="list-style: none; padding: 0;">
                        ${plan.features.map(feature => `
                            <li style="margin: 8px 0;">
                                ✅ ${feature}
                            </li>
                        `).join('')}
                    </ul>
                    <p style="margin-top: 15px; color: #666;">
                        <strong>Válido até:</strong> ${expiryDate.toLocaleDateString('pt-BR')}
                    </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.editaliza.com.br/login.html" 
                       style="display: inline-block; background: #0528f2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                        Acessar Plataforma
                    </a>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    <h4 style="color: #333;">Primeiros Passos:</h4>
                    <ol style="color: #666;">
                        <li>Faça login com suas credenciais</li>
                        <li>Altere sua senha temporária</li>
                        <li>Configure seu perfil e preferências</li>
                        <li>Crie seu primeiro cronograma de estudos</li>
                    </ol>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Qualquer dúvida, entre em contato conosco pelo email: suporte@editaliza.com.br
                </p>
            </div>
        `;

        // Usar o template base com o conteúdo personalizado
        const htmlBody = emailService.templates.baseTemplate(emailContent);
        
        return await emailService.sendEmail({
            to: email,
            subject: 'Bem-vindo ao Editaliza - Suas Credenciais de Acesso',
            html: htmlBody
        });
    }

    /**
     * Envia email de renovação de plano
     */
    async sendRenewalEmail(userData) {
        const { email, name, planType, expiryDate } = userData;
        const plan = this.planTypes[planType];

        const emailContent = `
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif;">
                <h2 style="color: #0528f2;">Plano Renovado com Sucesso!</h2>
                
                <p style="font-size: 16px; color: #333;">
                    Olá ${name}, seu ${plan.name} foi renovado com sucesso!
                </p>

                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1ad937; margin-top: 0;">Detalhes da Renovação:</h3>
                    <p><strong>Plano:</strong> ${plan.name}</p>
                    <p><strong>Nova validade:</strong> ${expiryDate.toLocaleDateString('pt-BR')}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.editaliza.com.br/login.html" 
                       style="display: inline-block; background: #0528f2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                        Continuar Estudando
                    </a>
                </div>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Obrigado por continuar conosco! 🚀
                </p>
            </div>
        `;

        // Usar o template base com o conteúdo personalizado
        const htmlBody = emailService.templates.baseTemplate(emailContent);
        
        return await emailService.sendEmail({
            to: email,
            subject: `Plano Renovado - ${plan.name}`,
            html: htmlBody
        });
    }

    /**
     * Envia nova senha quando solicitado
     */
    async sendNewPassword(email) {
        try {
            const user = await dbGet('SELECT id, name FROM users WHERE email = ?', [email]);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            const newPassword = this.generateSecurePassword();
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await dbRun(
                'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
                [hashedPassword, user.id]
            );

            const emailContent = `
                <div style="max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif;">
                    <h2 style="color: #0528f2;">Nova Senha Gerada</h2>
                    
                    <p>Olá ${user.name},</p>
                    <p>Conforme solicitado, geramos uma nova senha para sua conta:</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Nova senha:</strong> <code style="background: #fff; padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px;">${newPassword}</code></p>
                    </div>
                    
                    <p style="color: #dc3545;">
                        ⚠️ Por segurança, altere esta senha após fazer login.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://app.editaliza.com.br/login.html" 
                           style="display: inline-block; background: #0528f2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                            Fazer Login
                        </a>
                    </div>
                </div>
            `;

            // Usar o template base com o conteúdo personalizado
            const htmlBody = emailService.templates.baseTemplate(emailContent);
            
            await emailService.sendEmail({
                to: email,
                subject: 'Nova Senha - Editaliza',
                html: htmlBody
            });

            return { success: true };

        } catch (error) {
            console.error('Erro ao gerar nova senha:', error);
            throw error;
        }
    }
}

module.exports = new UserProvisioningService();