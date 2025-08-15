// webhook-validation.test.js - Testes de segurança para validação de webhooks
const WebhookValidator = require('../../webhooks/validator');
const crypto = require('crypto');

describe('Webhook Security Validation', () => {
    let validator;
    let mockRequest;
    
    beforeEach(() => {
        process.env.KIWIFY_WEBHOOK_SECRET = 'test_secret_for_webhook_validation';
        validator = new WebhookValidator();
        
        mockRequest = {
            ip: '54.207.79.86', // IP válido do Kiwify
            headers: {
                'x-kiwify-timestamp': Math.floor(Date.now() / 1000).toString(),
                'x-kiwify-signature': '',
                'user-agent': 'Kiwify-Webhook/1.0'
            },
            body: {
                id: 'webhook_123',
                event_type: 'order.paid',
                data: {
                    transaction_id: 'txn_123',
                    customer: {
                        email: 'test@example.com'
                    }
                }
            },
            rawBody: ''
        };
        
        mockRequest.rawBody = JSON.stringify(mockRequest.body);
    });
    
    describe('IP Validation', () => {
        test('should accept valid Kiwify IP', async () => {
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSourceIP('54.207.79.86', validationId)
            ).resolves.toBe(true);
        });
        
        test('should reject invalid IP', async () => {
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSourceIP('192.168.1.1', validationId)
            ).rejects.toThrow('IP não autorizado');
        });
        
        test('should accept localhost in development', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSourceIP('127.0.0.1', validationId)
            ).resolves.toBe(true);
            
            process.env.NODE_ENV = originalEnv;
        });
    });
    
    describe('Timestamp Validation', () => {
        test('should accept valid timestamp', async () => {
            const validationId = crypto.randomUUID();
            const currentTimestamp = Math.floor(Date.now() / 1000).toString();
            
            await expect(
                validator.validateTimestamp(currentTimestamp, validationId)
            ).resolves.toBe(true);
        });
        
        test('should reject expired timestamp', async () => {
            const validationId = crypto.randomUUID();
            const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 segundos atrás
            
            await expect(
                validator.validateTimestamp(expiredTimestamp, validationId)
            ).rejects.toThrow('Timestamp do webhook expirado');
        });
        
        test('should reject missing timestamp', async () => {
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateTimestamp(undefined, validationId)
            ).rejects.toThrow('Timestamp ausente');
        });
        
        test('should reject future timestamp', async () => {
            const validationId = crypto.randomUUID();
            const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 400 segundos no futuro
            
            await expect(
                validator.validateTimestamp(futureTimestamp, validationId)
            ).rejects.toThrow('Timestamp do webhook expirado');
        });
    });
    
    describe('Signature Validation', () => {
        test('should accept valid signature', async () => {
            const timestamp = mockRequest.headers['x-kiwify-timestamp'];
            const payload = `${timestamp}.${mockRequest.rawBody}`;
            const expectedSignature = crypto
                .createHmac('sha256', 'test_secret_for_webhook_validation')
                .update(payload, 'utf8')
                .digest('hex');
            
            mockRequest.headers['x-kiwify-signature'] = `sha256=${expectedSignature}`;
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSignature(mockRequest, validationId)
            ).resolves.toBe(true);
        });
        
        test('should reject invalid signature', async () => {
            mockRequest.headers['x-kiwify-signature'] = 'sha256=invalid_signature';
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSignature(mockRequest, validationId)
            ).rejects.toThrow('Assinatura inválida');
        });
        
        test('should reject missing signature', async () => {
            delete mockRequest.headers['x-kiwify-signature'];
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSignature(mockRequest, validationId)
            ).rejects.toThrow('Assinatura ausente');
        });
    });
    
    describe('Payload Validation', () => {
        test('should accept valid payload', async () => {
            const validationId = crypto.randomUUID();
            
            const result = await validator.validatePayloadStructure(
                mockRequest.body,
                validationId
            );
            
            expect(result.id).toBe('webhook_123');
            expect(result.event_type).toBe('order.paid');
        });
        
        test('should reject payload without required fields', async () => {
            const invalidPayload = {
                id: 'webhook_123'
                // Missing event_type and data
            };
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validatePayloadStructure(invalidPayload, validationId)
            ).rejects.toThrow('Campos obrigatórios ausentes');
        });
        
        test('should reject unsupported event type', async () => {
            const invalidPayload = {
                ...mockRequest.body,
                event_type: 'unsupported.event'
            };
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validatePayloadStructure(invalidPayload, validationId)
            ).rejects.toThrow('Tipo de evento não suportado');
        });
        
        test('should sanitize sensitive data in payload', async () => {
            const payloadWithSensitiveData = {
                id: 'webhook_123',
                event_type: 'order.paid',
                data: {
                    customer: {
                        email: 'user@example.com',
                        document: '12345678901',
                        phone: '11999999999'
                    }
                }
            };
            
            const sanitized = validator.sanitizePayload(payloadWithSensitiveData);
            
            expect(sanitized.data.customer.email).toMatch(/^us\*\*\*@example.com$/);
            expect(sanitized.data.customer.document).toMatch(/\*\*\*\*\*\*\*8901$/);
            expect(sanitized.data.customer.phone).toMatch(/\*\*\*\*\*\*\*9999$/);
        });
    });
    
    describe('Idempotency Check', () => {
        test('should pass for new webhook', async () => {
            const validationId = crypto.randomUUID();
            const webhookId = `webhook_${Date.now()}`;
            
            await expect(
                validator.checkIdempotency(webhookId, validationId)
            ).resolves.toBeUndefined();
        });
        
        test('should reject duplicate webhook', async () => {
            const db = require('../../../../database');
            const validationId = crypto.randomUUID();
            const webhookId = `webhook_duplicate_${Date.now()}`;
            
            // Inserir webhook primeiro
            await db.run(
                'INSERT INTO webhook_events (id, webhook_id, event_type, status, created_at) VALUES (?, ?, ?, ?, ?)',
                [crypto.randomUUID(), webhookId, 'order.paid', 'SUCCESS', new Date().toISOString()]
            );
            
            await expect(
                validator.checkIdempotency(webhookId, validationId)
            ).rejects.toThrow('Webhook já processado');
        });
    });
    
    describe('Rate Limiting', () => {
        test('should create rate limit middleware', () => {
            const middleware = WebhookValidator.createWebhookRateLimit({
                windowMs: 60000,
                maxRequests: 10
            });
            
            expect(typeof middleware).toBe('function');
        });
        
        test('should rate limit excessive requests', async () => {
            const middleware = WebhookValidator.createWebhookRateLimit({
                windowMs: 60000,
                maxRequests: 2
            });
            
            const mockReq = { ip: '192.168.1.1', headers: {} };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();
            
            // Primeira requisição - deve passar
            await middleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            
            // Segunda requisição - deve passar
            await middleware(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(2);
            
            // Terceira requisição - deve ser bloqueada
            await middleware(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockNext).toHaveBeenCalledTimes(2); // Não deve chamar next
        });
    });
    
    describe('Complete Validation Flow', () => {
        test('should validate complete webhook successfully', async () => {
            // Configurar assinatura válida
            const timestamp = mockRequest.headers['x-kiwify-timestamp'];
            const payload = `${timestamp}.${mockRequest.rawBody}`;
            const signature = crypto
                .createHmac('sha256', 'test_secret_for_webhook_validation')
                .update(payload, 'utf8')
                .digest('hex');
            
            mockRequest.headers['x-kiwify-signature'] = `sha256=${signature}`;
            
            const result = await validator.validateWebhook(mockRequest);
            
            expect(result.valid).toBe(true);
            expect(result.payload.id).toBe('webhook_123');
            expect(result.validationId).toBeDefined();
            expect(result.validationTime).toBeGreaterThan(0);
        });
        
        test('should handle validation failure gracefully', async () => {
            // Forçar falha com IP inválido
            mockRequest.ip = '192.168.1.1';
            
            await expect(
                validator.validateWebhook(mockRequest)
            ).rejects.toThrow('IP não autorizado');
        });
    });
    
    describe('Security Edge Cases', () => {
        test('should handle timing attack attempts', () => {
            const string1 = 'correct_signature';
            const string2 = 'incorrect_sig';
            const string3 = 'correct_signature';
            
            expect(validator.secureCompare(string1, string2)).toBe(false);
            expect(validator.secureCompare(string1, string3)).toBe(true);
        });
        
        test('should handle malformed headers', async () => {
            mockRequest.headers['x-kiwify-signature'] = null;
            
            const validationId = crypto.randomUUID();
            
            await expect(
                validator.validateSignature(mockRequest, validationId)
            ).rejects.toThrow('Assinatura ausente');
        });
        
        test('should handle large payloads', async () => {
            const largePayload = {
                id: 'webhook_123',
                event_type: 'order.paid',
                data: {
                    large_field: 'x'.repeat(100000) // 100KB de dados
                }
            };
            
            const validationId = crypto.randomUUID();
            
            // Deve processar sem erro, mas pode ter limites
            const result = await validator.validatePayloadStructure(
                largePayload,
                validationId
            );
            
            expect(result.id).toBe('webhook_123');
        });
        
        test('should handle concurrent validation requests', async () => {
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
                const uniqueRequest = {
                    ...mockRequest,
                    body: {
                        ...mockRequest.body,
                        id: `webhook_${i}`
                    }
                };
                uniqueRequest.rawBody = JSON.stringify(uniqueRequest.body);
                
                // Gerar assinatura válida
                const timestamp = uniqueRequest.headers['x-kiwify-timestamp'];
                const payload = `${timestamp}.${uniqueRequest.rawBody}`;
                const signature = crypto
                    .createHmac('sha256', 'test_secret_for_webhook_validation')
                    .update(payload, 'utf8')
                    .digest('hex');
                
                uniqueRequest.headers['x-kiwify-signature'] = `sha256=${signature}`;
                
                promises.push(validator.validateWebhook(uniqueRequest));
            }
            
            const results = await Promise.all(promises);
            
            results.forEach((result, index) => {
                expect(result.valid).toBe(true);
                expect(result.payload.id).toBe(`webhook_${index}`);
            });
        });
    });
    
    afterEach(() => {
        // Limpar dados de teste
        jest.clearAllMocks();
    });
});