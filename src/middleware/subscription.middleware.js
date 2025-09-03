/**
 * Middleware de Verificação de Validade de Assinatura
 * 
 * FUNCIONALIDADES:
 * - Verifica se o plano do usuário está ativo
 * - Valida data de expiração
 * - Permite acesso a rotas públicas
 * - Bloqueia acesso se plano expirou
 * - Adiciona informações do plano ao request
 */

const { dbGet, dbRun, dbAll } = require('../config/database');

/**
 * Verifica se a assinatura do usuário está ativa
 */
const checkSubscription = async (req, res, next) => {
    try {
        // Se não há usuário autenticado, passar adiante (outras middlewares lidarão)
        if (!req.user || !req.user.id) {
            return next();
        }

        // Buscar informações completas do usuário com plano
        const user = await dbGet(`
            SELECT 
                id,
                email,
                name,
                plan_type,
                plan_status,
                plan_expiry,
                CASE 
                    WHEN plan_expiry IS NULL THEN 'no_plan'
                    WHEN plan_expiry < NOW() THEN 'expired'
                    WHEN plan_expiry >= NOW() THEN 'active'
                END as subscription_status,
                CASE 
                    WHEN plan_expiry IS NOT NULL THEN 
                        EXTRACT(DAY FROM (plan_expiry - NOW()))
                    ELSE NULL
                END as days_remaining
            FROM users 
            WHERE id = ?
        `, [req.user.id]);

        if (!user) {
            console.error(`[SUBSCRIPTION] Usuário não encontrado: ${req.user.id}`);
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Adicionar informações do plano ao request
        req.subscription = {
            plan_type: user.plan_type,
            plan_status: user.plan_status,
            plan_expiry: user.plan_expiry,
            subscription_status: user.subscription_status,
            days_remaining: user.days_remaining ? Math.floor(user.days_remaining) : null,
            is_active: user.subscription_status === 'active'
        };

        // Se o plano expirou, atualizar status no banco
        if (user.subscription_status === 'expired' && user.plan_status === 'active') {
            await dbRun(`
                UPDATE users 
                SET plan_status = 'expired',
                    updated_at = NOW()
                WHERE id = ?
            `, [user.id]);
            
            console.log(`[SUBSCRIPTION] Plano expirado marcado para usuário ${user.email}`);
        }

        // Continuar - a decisão de bloquear ou não fica para o próximo middleware
        next();

    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao verificar assinatura:', error);
        // Em caso de erro, permitir acesso mas logar o problema
        next();
    }
};

/**
 * Middleware mais restritivo - BLOQUEIA se não tiver plano ativo
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        // Primeiro executa checkSubscription
        await checkSubscription(req, res, () => {});

        // Verifica se tem assinatura ativa
        if (!req.subscription || !req.subscription.is_active) {
            
            // Mensagem personalizada baseada no status
            let message = 'Assinatura necessária para acessar este recurso';
            let statusCode = 403;

            if (req.subscription) {
                if (req.subscription.subscription_status === 'expired') {
                    message = 'Sua assinatura expirou. Por favor, renove seu plano para continuar.';
                } else if (req.subscription.subscription_status === 'no_plan') {
                    message = 'Você não possui um plano ativo. Por favor, assine um plano para acessar.';
                    statusCode = 402; // Payment Required
                }
            }

            return res.status(statusCode).json({
                success: false,
                error: message,
                subscription: req.subscription,
                redirect: '/plans.html'
            });
        }

        // Avisar se está próximo de expirar (menos de 7 dias)
        if (req.subscription.days_remaining && req.subscription.days_remaining <= 7) {
            // Adicionar header de aviso
            res.setHeader('X-Subscription-Warning', `Plano expira em ${req.subscription.days_remaining} dias`);
        }

        next();

    } catch (error) {
        console.error('[SUBSCRIPTION] Erro ao verificar assinatura obrigatória:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status da assinatura'
        });
    }
};

/**
 * Middleware suave - permite acesso mas adiciona avisos
 */
const checkSubscriptionSoft = async (req, res, next) => {
    try {
        // Executa verificação básica
        await checkSubscription(req, res, () => {});

        // Sempre continua, mas adiciona avisos se necessário
        if (req.subscription && !req.subscription.is_active) {
            res.setHeader('X-Subscription-Status', req.subscription.subscription_status);
            
            if (req.subscription.subscription_status === 'expired') {
                res.setHeader('X-Subscription-Message', 'Plano expirado');
            }
        }

        next();

    } catch (error) {
        console.error('[SUBSCRIPTION] Erro no check suave:', error);
        next();
    }
};

/**
 * Job para marcar planos expirados (executar diariamente)
 */
const markExpiredPlans = async () => {
    try {
        const result = await dbRun(`
            UPDATE users 
            SET plan_status = 'expired',
                updated_at = NOW()
            WHERE plan_expiry < NOW() 
            AND plan_status = 'active'
        `);

        if (result.changes > 0) {
            console.log(`[SUBSCRIPTION JOB] ${result.changes} planos marcados como expirados`);
        }

        // Buscar usuários com planos expirando em 3 dias
        const expiringUsers = await dbAll(`
            SELECT email, name, plan_type, plan_expiry,
                   EXTRACT(DAY FROM (plan_expiry - NOW())) as days_remaining
            FROM users
            WHERE plan_status = 'active'
            AND plan_expiry BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        `);

        // TODO: Enviar emails de aviso para usuários com planos expirando
        if (expiringUsers.length > 0) {
            console.log(`[SUBSCRIPTION JOB] ${expiringUsers.length} usuários com planos expirando em breve`);
            // Implementar envio de email aqui
        }

        return {
            expired: result.changes || 0,
            expiring_soon: expiringUsers.length
        };

    } catch (error) {
        console.error('[SUBSCRIPTION JOB] Erro ao marcar planos expirados:', error);
        throw error;
    }
};

module.exports = {
    checkSubscription,
    requireActiveSubscription,
    checkSubscriptionSoft,
    markExpiredPlans
};