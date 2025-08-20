// validator.js - Validação criptográfica robusta de webhooks Kiwify
const crypto = require('crypto');
const { AppError, ERROR_TYPES } = require('../../utils/error-handler');
const AuditModel = require('../models/audit');

class WebhookValidator {
    constructor() {
        this.kiwifySecret = process.env.KIWIFY_WEBHOOK_SECRET;
        this.allowedIps = [
            '54.207.79.86',
            '177.71.207.84',
            '18.231.194.34'
        ]; // IPs oficiais do Kiwify
        
        if (!this.kiwifySecret) {
            throw new Error('KIWIFY_WEBHOOK_SECRET não configurado');
        }
    }

    /**
     * Valida webhook do Kiwify com verificação criptográfica
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
            await this.validateTimestamp(req.headers['x-kiwify-timestamp'], validationId);
            
            // 3. Validação de assinatura
            await this.validateSignature(req, validationId);
            
            // 4. Validação de estrutura do payload
            const validatedPayload = await this.validatePayloadStructure(req.body, validationId);
            
            // 5. Verificação de idempotência
            await this.checkIdempotency(validatedPayload.id, validationId);
            
            // Log de sucesso
            await AuditModel.logEvent({
                entityType: 'WEBHOOK_VALIDATION',
                entityId: validationId,
                action: 'VALIDATE_SUCCESS',
                userId: null,
                details: {
                    webhookId: validatedPayload.id,
                    eventType: validatedPayload.event_type,
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
                entityType: 'WEBHOOK_VALIDATION',
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
                'IP não autorizado para webhooks',
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
                'Timestamp ausente no webhook',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        const webhookTime = parseInt(timestamp);
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDifference = Math.abs(currentTime - webhookTime);
        
        // Permitir diferença de até 5 minutos (300 segundos)
        const maxTimeDifference = 300;
        
        if (timeDifference > maxTimeDifference) {
            throw new AppError(
                'Timestamp do webhook expirado ou inválido',
                ERROR_TYPES.BAD_REQUEST,
                {
                    timeDifference,
                    maxAllowed: maxTimeDifference,
                    validationId
                }
            );
        }
        
        return true;
    }

    /**
     * Valida assinatura criptográfica do webhook
     * @param {Object} req - Request do Express
     * @param {string} validationId - ID da validação
     */
    async validateSignature(req, validationId) {
        const signature = req.headers['x-kiwify-signature'];
        const timestamp = req.headers['x-kiwify-timestamp'];
        
        if (!signature) {
            throw new AppError(
                'Assinatura ausente no webhook',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        // Construir payload para verificação
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signaturePayload = `${timestamp}.${rawBody}`;
        
        // Calcular assinatura esperada
        const expectedSignature = crypto
            .createHmac('sha256', this.kiwifySecret)
            .update(signaturePayload, 'utf8')
            .digest('hex');
        
        const expectedSignatureHeader = `sha256=${expectedSignature}`;
        
        // Comparação segura contra timing attacks
        if (!this.secureCompare(signature, expectedSignatureHeader)) {
            throw new AppError(
                'Assinatura inválida do webhook',
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
     * Valida estrutura do payload do webhook
     * @param {Object} payload - Payload do webhook
     * @param {string} validationId - ID da validação
     * @returns {Object} - Payload validado
     */
    async validatePayloadStructure(payload, validationId) {
        if (!payload || typeof payload !== 'object') {
            throw new AppError(
                'Payload inválido do webhook',
                ERROR_TYPES.BAD_REQUEST,
                { validationId }
            );
        }

        const requiredFields = ['id', 'event_type', 'data'];
        const missingFields = requiredFields.filter(field => !payload[field]);
        
        if (missingFields.length > 0) {
            throw new AppError(
                'Campos obrigatórios ausentes no webhook',
                ERROR_TYPES.BAD_REQUEST,
                { missingFields, validationId }
            );
        }

        // Validar tipos de eventos suportados
        const supportedEvents = [
            'order.paid',
            'order.refunded',
            'order.cancelled',
            'subscription.started',
            'subscription.cancelled',
            'subscription.suspended',
            'subscription.reactivated'
        ];
        
        if (!supportedEvents.includes(payload.event_type)) {
            throw new AppError(
                'Tipo de evento não suportado',
                ERROR_TYPES.BAD_REQUEST,
                {
                    eventType: payload.event_type,
                    supportedEvents,
                    validationId
                }
            );
        }

        // Sanitizar e validar dados específicos do evento
        const sanitizedPayload = this.sanitizePayload(payload);
        
        return sanitizedPayload;
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
                    'Webhook já processado (idempotência)',
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
                    customer.email = `${localPart.substring(0, 2)}***@${domain}`;
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
        delete sanitized['x-kiwify-signature'];
        delete sanitized['authorization'];
        delete sanitized['cookie'];
        
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
     * Middleware de rate limiting específico para webhooks
     * @param {Object} options - Opções do rate limiting
     * @returns {Function} - Middleware
     */
    static createWebhookRateLimit(options = {}) {
        const {
            windowMs = 60000, // 1 minuto
            maxRequests = 100,
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
                    entityType: 'WEBHOOK_RATE_LIMIT',
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
                    error: 'Rate limit exceeded',
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

module.exports = WebhookValidator;