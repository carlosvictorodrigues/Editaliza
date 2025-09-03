// webhooks-simple.js - Handler simplificado e compatível para CACKTO
const crypto = require('crypto');
const router = require('express').Router();
const userProvisioningService = require('../../services/userProvisioningService');
const AuditModel = require('../../subscription/models/audit');

/**
 * Comparação segura contra timing attacks
 */
function timingSafeEq(a, b) {
    const A = Buffer.from(a || '');
    const B = Buffer.from(b || '');
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
}

/**
 * POST /api/webhooks/cackto
 * Handler principal para webhooks da CACKTO
 * COMPATÍVEL com diferentes formatos de payload
 */
router.post('/cackto', async (req, res) => {
    // 1. ACK IMEDIATO - Evita retry da CACKTO
    res.status(200).json({ success: true, message: 'Webhook recebido' });

    try {
        // 2. PARSE SEGURO DO BODY (raw -> string -> JSON)
        let payload;
        try {
            // Se vier como Buffer (express.raw())
            if (Buffer.isBuffer(req.body)) {
                const text = req.body.toString('utf8');
                payload = JSON.parse(text);
            } 
            // Se vier como string
            else if (typeof req.body === 'string') {
                payload = JSON.parse(req.body);
            }
            // Se já vier como objeto (express.json())
            else if (typeof req.body === 'object') {
                payload = req.body;
            }
            else {
                throw new Error('Body inválido');
            }
        } catch (parseError) {
            console.error('[CACKTO] Erro ao parsear body:', parseError);
            console.error('[CACKTO] Body recebido:', req.body?.toString?.() || req.body);
            return;
        }

        console.info('[CACKTO] Webhook recebido:', {
            event: payload?.event,
            productId: payload?.data?.product?.id || payload?.data?.product_id,
            status: payload?.data?.status,
            email: payload?.data?.customer?.email || payload?.data?.customer_email
        });

        // 3. VALIDAÇÃO DE ASSINATURA (flexível: header OU body)
        if (process.env.CACKTO_VERIFY_SIGNATURE === 'true' && process.env.CACKTO_WEBHOOK_SECRET) {
            const secret = process.env.CACKTO_WEBHOOK_SECRET;
            
            // Tenta validar pelo header primeiro
            const headerSig = req.get('x-cackto-signature') || 
                            req.get('x-signature') || 
                            req.get('cackto-signature');
            
            // Secret no body (modo teste da CACKTO)
            const bodySecret = payload?.secret;

            let isValid = false;

            if (headerSig) {
                // Validação HMAC do header
                const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(payload));
                const expected = 'sha256=' + crypto.createHmac('sha256', secret)
                    .update(rawBody)
                    .digest('hex');
                
                isValid = timingSafeEq(headerSig, expected) || 
                         timingSafeEq(headerSig, expected.replace('sha256=', '')); // Sem prefixo
                
                if (!isValid) {
                    console.warn('[CACKTO] Assinatura HMAC inválida');
                }
            } else if (bodySecret) {
                // Validação por secret no corpo (teste)
                isValid = timingSafeEq(String(bodySecret), String(secret));
                if (!isValid) {
                    console.warn('[CACKTO] Secret no body inválido');
                }
            } else {
                console.warn('[CACKTO] Sem assinatura no header nem secret no body');
                // Em desenvolvimento, permitir sem assinatura
                if (process.env.NODE_ENV === 'development') {
                    console.info('[CACKTO] Modo desenvolvimento - permitindo sem assinatura');
                    isValid = true;
                }
            }

            if (!isValid) {
                await AuditModel.logEvent({
                    entityType: 'CACKTO_WEBHOOK',
                    entityId: payload?.data?.id || 'unknown',
                    action: 'SIGNATURE_VALIDATION_FAILED',
                    severity: 'WARN',
                    details: { event: payload?.event }
                });
                return;
            }
        }

        // 4. NORMALIZAÇÃO DOS CAMPOS (compatibilidade total)
        const event = String(payload?.event || '').toLowerCase();
        const data = payload?.data || {};
        
        // Email em diferentes formatos
        const email = data?.customer?.email || 
                     data?.customer_email || 
                     data?.email ||
                     data?.buyer?.email;
        
        // Transaction ID em diferentes formatos
        const txId = data?.id || 
                    data?.transaction_id || 
                    data?.refId ||
                    data?.transaction?.id;
        
        // Status normalizado
        const status = String(data?.status || '').toLowerCase();
        
        // IMPORTANTE: CACKTO usa offer.id como identificador principal!
        const offerId = data?.offer?.id;                    // PRINCIPAL
        const productId = data?.product?.id;                // Fallback 1
        const shortId = data?.product?.short_id;            // Fallback 2
        const productIdDirect = data?.product_id;           // Formato antigo
        const price = Number(data?.offer?.price || data?.baseAmount || data?.amount || 0);

        // Nome do cliente
        const customerName = data?.customer?.name || 
                           data?.customer?.full_name ||
                           data?.customer_name ||
                           'Cliente CACKTO';

        // Não precisa mais validar productId pois agora usamos offer.id

        if (!email) {
            console.warn('[CACKTO] Email ausente no payload:', JSON.stringify(data));
            return;
        }

        // 5. MAPEAMENTO DE PLANOS - OFFER.ID é PRINCIPAL!
        // Mapear por OFFER ID (principal)
        const offerMap = {
            [process.env.CACKTO_OFFER_MENSAL]: { 
                plan_type: 'mensal', 
                months: 1 
            },
            [process.env.CACKTO_OFFER_MENSAL_ALT]: { 
                plan_type: 'mensal', 
                months: 1 
            },
            [process.env.CACKTO_OFFER_SEMESTRAL]: { 
                plan_type: 'semestral', 
                months: 6 
            },
            [process.env.CACKTO_OFFER_ANUAL]: { 
                plan_type: 'anual', 
                months: 12 
            }
        };

        let plan = offerMap[offerId];
        
        // Fallback 1: Tentar por product.id
        if (!plan && productId) {
            const productMap = {
                [process.env.CACKTO_PRODUCT_MENSAL]: { plan_type: 'mensal', months: 1 },
                [process.env.CACKTO_PRODUCT_SEMESTRAL]: { plan_type: 'semestral', months: 6 },
                [process.env.CACKTO_PRODUCT_ANUAL]: { plan_type: 'anual', months: 12 }
            };
            plan = productMap[productId];
        }
        
        // Fallback 2: Tentar por short_id
        if (!plan && shortId) {
            const shortMap = {
                [process.env.CACKTO_PRODUCT_SHORT_MENSAL]: { plan_type: 'mensal', months: 1 },
                [process.env.CACKTO_PRODUCT_SHORT_SEMESTRAL]: { plan_type: 'semestral', months: 6 },
                [process.env.CACKTO_PRODUCT_SHORT_ANUAL]: { plan_type: 'anual', months: 12 }
            };
            plan = shortMap[shortId];
        }
        
        // Fallback 3: Formato antigo (product_id direto)
        if (!plan && productIdDirect) {
            const oldMap = {
                [process.env.CACKTO_PRODUCT_MENSAL]: { plan_type: 'mensal', months: 1 },
                [process.env.CACKTO_PRODUCT_SEMESTRAL]: { plan_type: 'semestral', months: 6 },
                [process.env.CACKTO_PRODUCT_ANUAL]: { plan_type: 'anual', months: 12 }
            };
            plan = oldMap[productIdDirect];
        }
        
        if (!plan) {
            console.warn('[CACKTO] Offer/Produto não mapeado:', {
                offerId,
                productId,
                shortId,
                productIdDirect,
                price,
                event,
                status
            });
            
            // Em desenvolvimento, usar plano padrão baseado no preço
            if (process.env.NODE_ENV === 'development') {
                if (price >= 200) {
                    console.info('[CACKTO] Preço alto, assumindo anual (dev)');
                    plan = { plan_type: 'anual', months: 12 };
                } else if (price >= 100) {
                    console.info('[CACKTO] Preço médio, assumindo semestral (dev)');
                    plan = { plan_type: 'semestral', months: 6 };
                } else {
                    console.info('[CACKTO] Preço baixo, assumindo mensal (dev)');
                    plan = { plan_type: 'mensal', months: 1 };
                }
            } else {
                return;
            }
        }

        // 6. EVENTOS QUE ATIVAM PROVISIONAMENTO
        // IMPORTANTE: boleto_gerado e waiting_payment NÃO ativam!
        const activatingEvents = [
            'payment.approved',
            'payment_approved',
            'purchase.approved',
            'purchase_approved',
            'subscription.created',
            'subscription_created',
            'subscription.activated',
            'subscription_activated',
            'subscription.renewed',
            'subscription_renewed'
        ];

        const activatingStatuses = [
            'paid',
            'approved',
            'active',
            'completed'
            // REMOVIDO: 'waiting_payment' - isso é só boleto emitido!
        ];
        
        // Eventos que NÃO devem ativar (explícito)
        const nonActivatingEvents = [
            'boleto_gerado',
            'boleto_generated',
            'invoice_created',
            'payment_waiting'
        ];
        
        // Se for evento de não-ativação, ignorar
        if (nonActivatingEvents.includes(event)) {
            console.info('[CACKTO] Evento sem ativação (OK):', { event, status, offerId });
            return;
        }

        const shouldProvision = activatingEvents.includes(event) || 
                              activatingStatuses.includes(status);

        if (!shouldProvision) {
            console.info('[CACKTO] Evento recebido mas não requer provisionamento:', {
                event,
                status
            });
            return;
        }

        // 7. PROVISIONAMENTO DO USUÁRIO
        console.info('[CACKTO] Iniciando provisionamento:', {
            email,
            plan: plan.plan_type,
            transactionId: txId
        });

        const provisioningResult = await userProvisioningService.createUserFromPayment({
            customer_email: email,
            customer_name: customerName,
            plan_type: plan.plan_type,
            transaction_id: txId,
            amount: price,
            cackto_offer_id: offerId,
            cackto_product_id: productId,
            cackto_short_id: shortId
        });

        // 8. LOG DE AUDITORIA
        await AuditModel.logEvent({
            entityType: 'CACKTO_WEBHOOK',
            entityId: txId,
            action: 'WEBHOOK_PROCESSED',
            userId: provisioningResult?.userId,
            details: {
                event,
                offerId,
                productId,
                shortId,
                planType: plan.plan_type,
                email,
                status,
                price,
                renewed: provisioningResult?.renewed || false
            },
            severity: 'INFO'
        });

        console.info('[CACKTO] Webhook processado com sucesso:', {
            userId: provisioningResult?.userId,
            renewed: provisioningResult?.renewed,
            planType: plan.plan_type
        });

    } catch (error) {
        console.error('[CACKTO] Erro ao processar webhook:', error);
        
        // Log de erro
        try {
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_ERROR',
                entityId: crypto.randomUUID(),
                action: 'PROCESSING_ERROR',
                details: {
                    error: error.message,
                    stack: error.stack
                },
                severity: 'ERROR'
            });
        } catch (logError) {
            console.error('[CACKTO] Erro ao registrar log:', logError);
        }
    }
});

/**
 * GET /api/webhooks/cackto/__ping
 * Health check rápido
 */
router.get('/cackto/__ping', (req, res) => {
    res.json({ 
        ok: true, 
        timestamp: new Date().toISOString(),
        configured: {
            mensal: !!process.env.CACKTO_PRODUCT_MENSAL,
            semestral: !!process.env.CACKTO_PRODUCT_SEMESTRAL,
            anual: !!process.env.CACKTO_PRODUCT_ANUAL,
            secret: !!process.env.CACKTO_WEBHOOK_SECRET
        }
    });
});

/**
 * POST /api/webhooks/cackto/__test
 * Endpoint de teste para desenvolvimento
 */
if (process.env.NODE_ENV === 'development') {
    router.post('/cackto/__test', async (req, res) => {
        const testPayload = {
            id: `test_${Date.now()}`,
            event: 'payment.approved',
            created_at: new Date().toISOString(),
            data: {
                id: `tx_test_${Date.now()}`,
                product: {
                    id: process.env.CACKTO_PRODUCT_MENSAL || 'test_product',
                    name: 'Teste Mensal'
                },
                customer: {
                    email: 'teste@example.com',
                    name: 'Usuário Teste'
                },
                amount: 97.00,
                currency: 'BRL',
                status: 'approved'
            }
        };

        // Simula request com o payload de teste
        req.body = testPayload;
        
        // Chama o handler principal
        await router.handle(req, res);
    });
}

module.exports = router;