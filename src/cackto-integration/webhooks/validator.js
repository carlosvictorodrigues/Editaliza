// validator.js - Validação criptográfica robusta de webhooks CACKTO
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../../subscription/models/audit');
const cacktoConfig = require('../config/cackto.config');
const { dbGet, dbAll, dbRun } = require('../../utils/database');

class CacktoWebhookValidator {
    constructor() {
        this.config = cacktoConfig;
        this.webhookSecret = this.config.auth.webhookSecret;
        this.allowedIps = this.config.security.allowedIPs;
        this.maxTimeDifference = this.config.security.maxTimestampDifference;
        this.signatureHeader = this.config.security.signatureHeader;
        this.timestampHeader = this.config.security.timestampHeader;
        
        if (!this.webhookSecret) {
            throw new Error('CACKTO_WEBHOOK_SECRET não configurado');
        }
    }

    /**
     * Valida webhook da CACKTO com verificação criptográfica
     * @param {Object} req - Request do Express
     * @returns {Promise<Object>} - Dados validados do webhook
     */
    async validateWebhook(req) {
        const startTime = Date.now();
        const validationId = crypto.randomUUID();
        
        try {
            // 1. Validação de IP
            await this.validateSourceIP(req.ip, validationId);
            
            // 2. Validação de timestamp (evita replay attacks)
            await this.validateTimestamp(req.headers[this.timestampHeader], validationId);
            
            // 3. Validação de assinatura
            await this.validateSignature(req, validationId);
            
            // 4. Validação de estrutura do payload
            const validatedPayload = await this.validatePayloadStructure(req.body, validationId);
            
            // 5. Verificação de idempotência
            await this.checkIdempotency(validatedPayload.id, validationId);
            
            // Log de sucesso
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_VALIDATION',
                entityId: validationId,
                action: 'VALIDATE_SUCCESS',
                userId: null,
                details: {
                    webhookId: validatedPayload.id,
                    eventType: validatedPayload.event,
                    validationTime: Date.now() - startTime,
                    sourceIP: req.ip
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'INFO'
            });
            
            return {
                valid: true,
                payload: validatedPayload,
                validationId,
                validationTime: Date.now() - startTime
            };
            
        } catch (error) {
            // Log de falha
            await AuditModel.logEvent({
                entityType: 'CACKTO_WEBHOOK_VALIDATION',
                entityId: validationId,
                action: 'VALIDATE_FAILED',
                userId: null,
                details: {
                    error: error.message,
                    validationTime: Date.now() - startTime,
                    sourceIP: req.ip,
                    headers: this.sanitizeHeaders(req.headers)
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                severity: 'ERROR'
            });
            
            throw error;
        }
    }

    /**
     * Valida IP de origem do webhook
     * @param {string} sourceIP - IP de origem
     * @param {string} validationId - ID da validação
     */
    async validateSourceIP(sourceIP, validationId) {
        // Em desenvolvimento, aceitar localhost
        if (process.env.NODE_ENV === 'development') {
            if (sourceIP === '127.0.0.1' || sourceIP === '::1' || sourceIP.includes('localhost')) {
                return true;
            }
        }

        // Extrair IP real (pode vir por trás de proxy)
        const realIP = this.extractRealIP(sourceIP);
        
        if (!this.allowedIps.includes(realIP)) {
            throw new AppError(
                'IP não autorizado para webhooks CACKTO',
                ERROR_TYPES.UNAUTHORIZED,
                { sourceIP: realIP, validationId }
            );
        }
        
        return true;
    }

    /**
     * Valida timestamp para evitar replay attacks
     * @param {string} timestamp - Timestamp do header
     * @param {string} validationId - ID da validação
     */
    async validateTimestamp(timestamp, validationId) {
        if (!timestamp) {
            throw new AppError(
                'Timestamp ausente no webhook CACKTO',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        const webhookTime = parseInt(timestamp);
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDifference = Math.abs(currentTime - webhookTime);
        
        if (timeDifference > this.maxTimeDifference) {
            throw new AppError(
                'Timestamp do webhook CACKTO expirado ou inválido',
                ERROR_TYPES.BAD_REQUEST,
                {
                    timeDifference,
                    maxAllowed: this.maxTimeDifference,
                    validationId
                }
            );
        }
        
        return true;
    }

    /**
     * Valida assinatura criptográfica do webhook CACKTO
     * @param {Object} req - Request do Express
     * @param {string} validationId - ID da validação
     */
    async validateSignature(req, validationId) {
        const signature = req.headers[this.signatureHeader];
        const timestamp = req.headers[this.timestampHeader];
        
        if (!signature) {
            throw new AppError(
                'Assinatura ausente no webhook CACKTO',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        // Construir payload para verificação (padrão CACKTO)
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signaturePayload = `${timestamp}.${rawBody}`;
        
        // Calcular assinatura esperada
        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(signaturePayload, 'utf8')
            .digest('hex');
        
        const expectedSignatureHeader = `sha256=${expectedSignature}`;
        
        // Comparação segura contra timing attacks
        if (!this.secureCompare(signature, expectedSignatureHeader)) {
            throw new AppError(
                'Assinatura inválida do webhook CACKTO',
                ERROR_TYPES.UNAUTHORIZED,
                {
                    providedSignature: signature,
                    validationId
                }
            );
        }
        
        return true;
    }

    /**
     * Valida estrutura do payload do webhook CACKTO
     * @param {Object} payload - Payload do webhook
     * @param {string} validationId - ID da validação
     * @returns {Object} - Payload validado
     */
    async validatePayloadStructure(payload, validationId) {
        if (!payload || typeof payload !== 'object') {
            throw new AppError(
                'Payload inválido do webhook CACKTO',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        const requiredFields = this.config.validation.requiredFields.webhook;
        const missingFields = requiredFields.filter(field => !payload[field]);
        
        if (missingFields.length > 0) {
            throw new AppError(
                'Campos obrigatórios ausentes no webhook CACKTO',
                ERROR_TYPES.BAD_REQUEST,
                { missingFields, validationId }
            );
        }

        // Validar tipos de eventos suportados
        const supportedEvents = this.config.events.supported;
        
        if (!supportedEvents.includes(payload.event)) {
            throw new AppError(
                'Tipo de evento CACKTO não suportado',
                ERROR_TYPES.BAD_REQUEST,
                {
                    eventType: payload.event,
                    supportedEvents,
                    validationId
                }
            );
        }

        // Validar estrutura específica do evento
        await this.validateEventStructure(payload, validationId);

        // Sanitizar e validar dados específicos do evento
        const sanitizedPayload = this.sanitizePayload(payload);
        
        return sanitizedPayload;
    }

    /**
     * Valida estrutura específica por tipo de evento
     * @param {Object} payload - Payload do webhook
     * @param {string} validationId - ID da validação
     */
    async validateEventStructure(payload, validationId) {
        const { event, data } = payload;

        if (!data || typeof data !== 'object') {
            throw new AppError(
                'Dados do evento ausentes ou inválidos',
                ERROR_TYPES.BAD_REQUEST,
                { event, validationId }
            );
        }

        // Validações específicas por tipo de evento
        switch (event) {
            case 'payment.approved':
            case 'payment.rejected':
            case 'payment.cancelled':
            case 'payment.refunded':
                this.validatePaymentEvent(data, validationId);
                break;
                
            case 'subscription.created':
            case 'subscription.activated':
            case 'subscription.suspended':
            case 'subscription.cancelled':
            case 'subscription.renewed':
            case 'subscription.expired':
                this.validateSubscriptionEvent(data, validationId);
                break;
                
            case 'chargeback.created':
            case 'chargeback.resolved':
                this.validateChargebackEvent(data, validationId);
                break;
                
            default:
                throw new AppError(
                    'Tipo de evento não reconhecido',
                    ERROR_TYPES.BAD_REQUEST,
                    { event, validationId }
                );
        }
    }

    /**
     * Valida estrutura de eventos de pagamento
     */
    validatePaymentEvent(data, validationId) {
        const requiredFields = ['id', 'amount', 'currency', 'status', 'customer'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            throw new AppError(
                'Campos obrigatórios ausentes no evento de pagamento',
                ERROR_TYPES.BAD_REQUEST,
                { missingFields, validationId }
            );
        }

        // Validar customer
        if (!data.customer.email) {
            throw new AppError(
                'Email do cliente é obrigatório',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }
    }

    /**
     * Valida estrutura de eventos de assinatura
     */
    validateSubscriptionEvent(data, validationId) {
        const requiredFields = ['id', 'status', 'plan', 'customer'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            throw new AppError(
                'Campos obrigatórios ausentes no evento de assinatura',
                ERROR_TYPES.BAD_REQUEST,
                { missingFields, validationId }
            );
        }

        // Validar customer
        if (!data.customer.email) {
            throw new AppError(
                'Email do cliente é obrigatório',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        // Validar plan
        if (!data.plan.id) {
            throw new AppError(
                'ID do plano é obrigatório',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }
    }

    /**
     * Valida estrutura de eventos de chargeback
     */
    validateChargebackEvent(data, validationId) {
        const requiredFields = ['id', 'transaction_id', 'amount', 'reason'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            throw new AppError(
                'Campos obrigatórios ausentes no evento de chargeback',
                ERROR_TYPES.BAD_REQUEST,
                { missingFields, validationId }
            );
        }
    }

    /**
     * Verifica idempotência do webhook
     * @param {string} webhookId - ID do webhook
     * @param {string} validationId - ID da validação
     */
    async checkIdempotency(webhookId, validationId) {
        const { dbGet, dbAll, dbRun } = require('../../utils/database');
        
        try {
            const existingWebhook = await dbGet(
                'SELECT id FROM webhook_events WHERE webhook_id = ?',
                [webhookId]
            );
            
            if (existingWebhook) {
                throw new AppError(
                    'Webhook CACKTO já processado (idempotência)',
                    ERROR_TYPES.CONFLICT,
                    {
                        webhookId,
                        existingId: existingWebhook.id,
                        validationId
                    }
                );
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                'Erro ao verificar idempotência',
                ERROR_TYPES.DATABASE_ERROR,
                { webhookId, validationId, originalError: error.message }
            );
        }
    }

    /**
     * Extrai IP real considerando proxies
     * @param {string} sourceIP - IP recebido
     * @returns {string} - IP real
     */
    extractRealIP(sourceIP) {
        // Se estiver atrás de CloudFlare, Nginx, etc.
        const cfConnectingIP = this.request?.headers?.["cf-connecting-ip"];
        const xForwardedFor = this.request?.headers?.["x-forwarded-for"];
        const xRealIP = this.request?.headers?.["x-real-ip"];
        
        return cfConnectingIP || 
               (xForwardedFor && xForwardedFor.split(',')[0].trim()) ||
               xRealIP ||
               sourceIP;
    }

    /**
     * Comparação segura contra timing attacks
     * @param {string} a - String A
     * @param {string} b - String B
     * @returns {boolean} - Se são iguais
     */
    secureCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }

    /**
     * Sanitiza payload removendo dados sensíveis dos logs
     * @param {Object} payload - Payload original
     * @returns {Object} - Payload sanitizado
     */
    sanitizePayload(payload) {
        const sanitized = { ...payload };
        
        // Remover/mascarar campos sensíveis
        if (sanitized.data) {
            if (sanitized.data.customer) {
                const customer = { ...sanitized.data.customer };
                
                // Mascarar email parcialmente
                if (customer.email) {
                    const [localPart, domain] = customer.email.split('@');
                    if (localPart && domain) {
                        customer.email = `${localPart.substring(0, 2)}***@${domain}`;
                    }
                }
                
                // Mascarar documento
                if (customer.document) {
                    customer.document = customer.document.replace(/\d(?=\d{4})/g, '*');
                }
                
                // Mascarar telefone
                if (customer.phone) {
                    customer.phone = customer.phone.replace(/\d(?=\d{4})/g, '*');
                }
                
                sanitized.data.customer = customer;
            }

            // Mascarar dados de cartão se existirem
            if (sanitized.data.payment_method) {
                const paymentMethod = { ...sanitized.data.payment_method };
                
                if (paymentMethod.card_number) {
                    paymentMethod.card_number = paymentMethod.card_number.replace(/\d(?=\d{4})/g, '*');
                }
                
                sanitized.data.payment_method = paymentMethod;
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitiza headers para logs
     * @param {Object} headers - Headers da requisição
     * @returns {Object} - Headers sanitizados
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        
        // Remover headers sensíveis
        delete sanitized[this.signatureHeader];
        delete sanitized['authorization'];
        delete sanitized['cookie'];
        delete sanitized['x-api-key'];
        
        return sanitized;
    }

    /**
     * Middleware para capturar raw body
     * @param {Object} req - Request
     * @param {Object} res - Response
     * @param {Function} next - Next middleware
     */
    static rawBodyMiddleware(req, res, next) {
        if (req.headers['content-type'] === 'application/json') {
            let rawBody = '';
            
            req.on('data', chunk => {
                rawBody += chunk.toString();
            });
            
            req.on('end', () => {
                req.rawBody = rawBody;
                next();
            });
        } else {
            next();
        }
    }

    /**
     * Middleware de rate limiting específico para webhooks CACKTO
     * @param {Object} options - Opções do rate limiting
     * @returns {Function} - Middleware
     */
    static createWebhookRateLimit(options = {}) {
        const config = cacktoConfig.rateLimiting.webhooks;
        const {
            windowMs = config.windowMs,
            maxRequests = config.maxRequests,
            keyGenerator = (req) => req.ip
        } = options;
        
        const requests = new Map();
        
        return async (req, res, next) => {
            const key = keyGenerator(req);
            const now = Date.now();
            const windowStart = now - windowMs;
            
            // Limpar requisições antigas
            if (requests.has(key)) {
                const userRequests = requests.get(key).filter(time => time > windowStart);
                requests.set(key, userRequests);
            }
            
            const currentRequests = requests.get(key) || [];
            
            if (currentRequests.length >= maxRequests) {
                await AuditModel.logEvent({
                    entityType: 'CACKTO_WEBHOOK_RATE_LIMIT',
                    entityId: crypto.randomUUID(),
                    action: 'RATE_LIMIT_EXCEEDED',
                    userId: null,
                    details: {
                        ip: req.ip,
                        currentRequests: currentRequests.length,
                        maxRequests,
                        windowMs
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    severity: 'WARN'
                });
                
                return res.status(429).json({
                    error: 'Rate limit exceeded for CACKTO webhooks',
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }
            
            // Adicionar requisição atual
            currentRequests.push(now);
            requests.set(key, currentRequests);
            
            next();
        };
    }
}

module.exports = CacktoWebhookValidator;