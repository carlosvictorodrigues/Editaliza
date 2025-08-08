/**
 * @file tests/unit/authentication/jwt-tokens.test.js
 * @description Testes específicos para JWT tokens e segurança
 * @fortress-category authentication
 * @priority critical
 */

const jwt = require('jsonwebtoken');
const FortressUtils = require('../../fortress/fortress-utils');
const RealisticData = require('../../fixtures/realistic-data');

let app;
let fortress;

describe('🔐 FORTRESS: JWT Tokens e Segurança', () => {
    beforeAll(async () => {
        app = require('../../test-server');
        fortress = new FortressUtils();
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    beforeEach(async () => {
        await fortress.runCleanup();
    });

    afterAll(async () => {
        await fortress.runCleanup();
        if (app && app.close) await app.close();
    });

    // ========================================================================
    // TESTES DE GERAÇÃO DE TOKEN
    // ========================================================================
    describe('🎫 Geração de Token JWT', () => {
        test('deve gerar token com estrutura correta', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            const token = userAuth.token;
            
            // Verificar estrutura base do JWT (header.payload.signature)
            const parts = token.split('.');
            expect(parts).toHaveLength(3);
            
            // Verificar se cada parte é base64 válida
            parts.forEach(part => {
                expect(() => Buffer.from(part, 'base64')).not.toThrow();
            });
            
            // Decodificar header
            const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
            expect(header).toHaveProperty('alg', 'HS256');
            expect(header).toHaveProperty('typ', 'JWT');
        });

        test('deve incluir todos os claims obrigatórios', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            const decoded = fortress.validateJWTStructure(userAuth.token);
            
            // Claims padrão JWT
            expect(decoded).toHaveProperty('iss', 'editaliza'); // Issuer
            expect(decoded).toHaveProperty('exp'); // Expiration
            expect(decoded).toHaveProperty('iat'); // Issued At
            
            // Claims específicos da aplicação
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email');
            
            // Verificar tipos
            expect(typeof decoded.id).toBe('number');
            expect(typeof decoded.email).toBe('string');
            expect(typeof decoded.exp).toBe('number');
            expect(typeof decoded.iat).toBe('number');
        });

        test('deve gerar tokens únicos para usuários diferentes', async () => {
            const users = await Promise.all([
                fortress.createAuthenticatedUser(app),
                fortress.createAuthenticatedUser(app),
                fortress.createAuthenticatedUser(app)
            ]);
            
            const tokens = users.map(user => user.token);
            
            // Todos os tokens devem ser diferentes
            expect(new Set(tokens).size).toBe(3);
            
            // Decodificar e verificar dados únicos
            const decodedTokens = tokens.map(token => jwt.decode(token));
            
            decodedTokens.forEach((decoded, index) => {
                expect(decoded.email).toBe(users[index].userData.email.toLowerCase());
                expect(decoded.id).toBe(users[index].login.user.id);
            });
        });

        test('deve ter tempo de expiração configurado corretamente', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            const decoded = jwt.decode(userAuth.token);
            
            const now = Math.floor(Date.now() / 1000);
            const expirationTime = decoded.exp;
            const timeUntilExpiry = expirationTime - now;
            
            // Deve expirar em aproximadamente 24 horas (86400 segundos)
            expect(timeUntilExpiry).toBeGreaterThan(86300); // 23h 58min
            expect(timeUntilExpiry).toBeLessThan(86500);    // 24h 2min
        });

        test('deve incluir issued at timestamp correto', async () => {
            const beforeIssue = Math.floor(Date.now() / 1000);
            
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            const afterIssue = Math.floor(Date.now() / 1000);
            const decoded = jwt.decode(userAuth.token);
            
            expect(decoded.iat).toBeGreaterThanOrEqual(beforeIssue);
            expect(decoded.iat).toBeLessThanOrEqual(afterIssue);
        });
    });

    // ========================================================================
    // TESTES DE VALIDAÇÃO DE TOKEN
    // ========================================================================
    describe('✅ Validação de Token', () => {
        test('deve validar token válido corretamente', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            expect(() => {
                jwt.verify(userAuth.token, process.env.JWT_SECRET);
            }).not.toThrow();
        });

        test('deve rejeitar token com secret incorreto', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            expect(() => {
                jwt.verify(userAuth.token, 'secret-incorreto');
            }).toThrow();
        });

        test('deve rejeitar token malformado', async () => {
            const malformedTokens = [
                'token.incompleto',
                'nao-eh-jwt',
                'muito.partes.demais.aqui.erro',
                '',
                'header.payload.signature.extra',
                'a'.repeat(1000) // Token muito longo
            ];
            
            malformedTokens.forEach(token => {
                expect(() => {
                    jwt.verify(token, process.env.JWT_SECRET);
                }).toThrow();
            });
        });

        test('deve rejeitar token com issuer incorreto', async () => {
            const userData = await fortress.createTestUser();
            
            const tokenWithWrongIssuer = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    issuer: 'atacante',
                    expiresIn: '24h' 
                }
            );
            
            expect(() => {
                jwt.verify(tokenWithWrongIssuer, process.env.JWT_SECRET, {
                    issuer: 'editaliza'
                });
            }).toThrow(/jwt issuer invalid/i);
        });

        test('deve rejeitar token sem issuer', async () => {
            const userData = await fortress.createTestUser();
            
            const tokenWithoutIssuer = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    expiresIn: '24h'
                    // Sem issuer
                }
            );
            
            expect(() => {
                jwt.verify(tokenWithoutIssuer, process.env.JWT_SECRET, {
                    issuer: 'editaliza'
                });
            }).toThrow();
        });
    });

    // ========================================================================
    // TESTES DE EXPIRAÇÃO
    // ========================================================================
    describe('⏰ Expiração de Token', () => {
        test('deve rejeitar token expirado', async () => {
            const userData = await fortress.createTestUser();
            
            const expiredToken = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    issuer: 'editaliza',
                    expiresIn: '1ms' // Expira quase instantaneamente
                }
            );
            
            // Aguardar expiração
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(() => {
                jwt.verify(expiredToken, process.env.JWT_SECRET);
            }).toThrow(/jwt expired/i);
        });

        test('deve aceitar token próximo da expiração mas ainda válido', async () => {
            const userData = await fortress.createTestUser();
            
            const tokenNearExpiry = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    issuer: 'editaliza',
                    expiresIn: '100ms' // Expira em 100ms
                }
            );
            
            // Aguardar 50ms (ainda não expirou)
            await new Promise(resolve => setTimeout(resolve, 50));
            
            expect(() => {
                jwt.verify(tokenNearExpiry, process.env.JWT_SECRET);
            }).not.toThrow();
        });
    });

    // ========================================================================
    // TESTES DE SEGURANÇA DO TOKEN
    // ========================================================================
    describe('🛡️ Segurança do Token', () => {
        test('não deve vazar informações sensíveis no payload', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            const decoded = jwt.decode(userAuth.token);
            
            // Não deve conter dados sensíveis
            expect(decoded).not.toHaveProperty('password');
            expect(decoded).not.toHaveProperty('password_hash');
            expect(decoded).not.toHaveProperty('salt');
            expect(decoded).not.toHaveProperty('secret');
            expect(decoded).not.toHaveProperty('private_key');
            
            // Verificar no payload JSON
            const payloadString = JSON.stringify(decoded);
            expect(payloadString).not.toMatch(/password/i);
            expect(payloadString).not.toMatch(/hash/i);
            expect(payloadString).not.toMatch(/salt/i);
            expect(payloadString).not.toMatch(/secret/i);
        });

        test('deve resistir a manipulação do payload', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            const [header, payload, signature] = userAuth.token.split('.');
            
            // Tentar modificar o payload
            const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
            decodedPayload.id = 999999; // ID de outro usuário
            decodedPayload.email = 'hacker@evil.com';
            
            const modifiedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64');
            const modifiedToken = `${header}.${modifiedPayload}.${signature}`;
            
            // Token modificado deve falhar na verificação
            expect(() => {
                jwt.verify(modifiedToken, process.env.JWT_SECRET);
            }).toThrow(/invalid signature/i);
        });

        test('deve resistir a reutilização de assinatura', async () => {
            const userAuth1 = await fortress.createAuthenticatedUser(app);
            const userAuth2 = await fortress.createAuthenticatedUser(app);
            
            const [header1, payload1, signature1] = userAuth1.token.split('.');
            const [header2, payload2, signature2] = userAuth2.token.split('.');
            
            // Tentar usar assinatura do token 1 com payload do token 2
            const frankensteinToken = `${header2}.${payload2}.${signature1}`;
            
            expect(() => {
                jwt.verify(frankensteinToken, process.env.JWT_SECRET);
            }).toThrow(/invalid signature/i);
        });

        test('deve resistir a ataques de None Algorithm', async () => {
            const userData = await fortress.createTestUser();
            
            // Criar header com alg: "none"
            const noneHeader = Buffer.from(JSON.stringify({
                'alg': 'none',
                'typ': 'JWT'
            })).toString('base64');
            
            const payload = Buffer.from(JSON.stringify({
                id: 1,
                email: userData.email,
                iss: 'editaliza',
                exp: Math.floor(Date.now() / 1000) + 86400
            })).toString('base64');
            
            const noneToken = `${noneHeader}.${payload}.`;
            
            expect(() => {
                jwt.verify(noneToken, process.env.JWT_SECRET);
            }).toThrow();
        });
    });

    // ========================================================================
    // TESTES DE PERFORMANCE DO TOKEN
    // ========================================================================
    describe('⚡ Performance do Token', () => {
        test('deve validar token rapidamente', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            fortress.startTimer('token_validation');
            
            // Validar o token múltiplas vezes
            for (let i = 0; i < 100; i++) {
                jwt.verify(userAuth.token, process.env.JWT_SECRET);
            }
            
            const elapsed = fortress.endTimer('token_validation');
            
            // 100 validações devem ser rápidas
            expect(elapsed).toBeLessThan(100); // menos de 100ms
        });

        test('deve gerar tokens rapidamente', async () => {
            const userData = await fortress.createTestUser();
            
            fortress.startTimer('token_generation');
            
            // Gerar múltiplos tokens
            const tokens = [];
            for (let i = 0; i < 50; i++) {
                const token = jwt.sign(
                    { 
                        id: i, 
                        email: `user${i}@test.com` 
                    },
                    process.env.JWT_SECRET,
                    { 
                        issuer: 'editaliza',
                        expiresIn: '24h' 
                    }
                );
                tokens.push(token);
            }
            
            const elapsed = fortress.endTimer('token_generation');
            
            expect(tokens).toHaveLength(50);
            expect(elapsed).toBeLessThan(200); // menos de 200ms
        });

        test('deve lidar com tokens grandes sem impacto significativo', async () => {
            const userData = await fortress.createTestUser();
            
            // Criar payload maior com dados extras (mas seguros)
            const largePayload = {
                id: 1,
                email: userData.email,
                permissions: Array.from({ length: 100 }, (_, i) => `permission_${i}`),
                metadata: {
                    loginCount: 1,
                    lastAccess: new Date().toISOString(),
                    preferences: Object.fromEntries(
                        Array.from({ length: 20 }, (_, i) => [`pref_${i}`, `value_${i}`])
                    )
                }
            };
            
            fortress.startTimer('large_token_generation');
            
            const largeToken = jwt.sign(
                largePayload,
                process.env.JWT_SECRET,
                { 
                    issuer: 'editaliza',
                    expiresIn: '24h' 
                }
            );
            
            const elapsed = fortress.endTimer('large_token_generation');
            
            // Deve validar corretamente
            const decoded = jwt.verify(largeToken, process.env.JWT_SECRET);
            expect(decoded.permissions).toHaveLength(100);
            expect(elapsed).toBeLessThan(50); // ainda rápido
        });
    });

    // ========================================================================
    // TESTES DE INTEGRAÇÃO COM MIDDLEWARE
    // ========================================================================
    describe('🔗 Integração com Middleware de Autenticação', () => {
        test('deve extrair dados corretos do token no middleware', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            const response = await fortress.authenticatedRequest(app, 'get', '/profile', userAuth.token)
                .expect(200);
            
            expect(response.body.user).toHaveProperty('id', userAuth.login.user.id);
            expect(response.body.user).toHaveProperty('email', userAuth.userData.email.toLowerCase());
        });

        test('deve rejeitar token no header Authorization malformado', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            const malformedHeaders = [
                `Bear ${userAuth.token}`,        // "Bear" ao invés de "Bearer"
                `Bearer${userAuth.token}`,       // Sem espaço
                `Bearer  ${userAuth.token}`,     // Espaço duplo
                userAuth.token,                  // Sem "Bearer"
                `Token ${userAuth.token}`,       // Esquema errado
                `Bearer ${userAuth.token} extra` // Conteúdo extra
            ];
            
            for (const authHeader of malformedHeaders) {
                const response = await request(app)
                    .get('/profile')
                    .set('Authorization', authHeader)
                    .expect(401);
                    
                fortress.expectErrorResponse(response, 401);
            }
        });
    });
});