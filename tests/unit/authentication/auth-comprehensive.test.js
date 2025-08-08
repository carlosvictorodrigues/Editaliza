/**
 * @file tests/unit/authentication/auth-comprehensive.test.js
 * @description Testes unitários abrangentes para sistema de autenticação
 * @fortress-category authentication
 * @priority critical
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const FortressUtils = require('../../fortress/fortress-utils');
const RealisticData = require('../../fixtures/realistic-data');

// Importar o app de teste
let app;
let fortress;

describe('🛡️ FORTRESS: Sistema de Autenticação Abrangente', () => {
    beforeAll(async () => {
        // Importar app após configurar ambiente de teste
        app = require('../../test-server');
        fortress = new FortressUtils();
        
        // Aguardar inicialização completa
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    beforeEach(async () => {
        // Limpar dados entre testes
        await fortress.runCleanup();
    });

    afterAll(async () => {
        await fortress.runCleanup();
        if (app && app.close) await app.close();
    });

    // ========================================================================
    // TESTES DE REGISTRO DE USUÁRIO
    // ========================================================================
    describe('📝 Registro de Usuário', () => {
        test('deve registrar usuário com dados válidos realísticos', async () => {
            fortress.startTimer('register_valid');
            
            const userData = RealisticData.users.valid[0];
            const response = await request(app)
                .post('/register')
                .send(userData)
                .expect(201);

            const elapsed = fortress.endTimer('register_valid');
            
            fortress.expectSuccessResponse(response, 201, ['user']);
            expect(response.body.user).toHaveProperty('email', userData.email.toLowerCase());
            expect(response.body.user).not.toHaveProperty('password');
            expect(elapsed).toBeLessThan(2000); // Performance check
            
            fortress.log('info', 'Registro realizado com sucesso', { 
                elapsed,
                email: userData.email 
            });
        });

        test('deve registrar múltiplos usuários diferentes', async () => {
            const promises = RealisticData.users.valid.map(userData =>
                request(app)
                    .post('/register')
                    .send(userData)
                    .expect(201)
            );

            const responses = await Promise.all(promises);
            
            responses.forEach((response, index) => {
                fortress.expectSuccessResponse(response, 201);
                expect(response.body.user.email)
                    .toBe(RealisticData.users.valid[index].email.toLowerCase());
            });
        });

        test('deve aplicar hash seguro na senha', async () => {
            const userData = await fortress.createTestUser();
            
            const response = await fortress.registerUser(app, userData);
            
            // Verificar se foi aplicado hash bcrypt adequado
            const { dbGet } = require('../../database-test');
            const user = await dbGet('SELECT password_hash FROM users WHERE email = ?', [userData.email]);
            
            expect(user.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/); // Formato bcrypt
            expect(user.password_hash).toHaveLength(60); // Tamanho padrão bcrypt
            expect(await bcrypt.compare(userData.password, user.password_hash)).toBe(true);
        });

        test('deve validar formatos de email rigorosamente', async () => {
            const invalidEmails = [
                'email-sem-arroba.com',
                '@sem-local.com',
                'sem-dominio@.com',
                'com espaços@teste.com',
                'duplo..ponto@teste.com',
                'terminando-em-ponto.@teste.com',
                'caracteres#especiais@teste.com'
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/register')
                    .send({ email, password: 'ValidPass123!' })
                    .expect(400);

                fortress.expectErrorResponse(response, 400, /email.*inválido/i);
            }
        });

        test('deve impedir registro de emails duplicados', async () => {
            const userData = await fortress.createTestUser();
            
            // Primeiro registro - deve funcionar
            await fortress.registerUser(app, userData);
            
            // Segundo registro - deve falhar
            const response = await request(app)
                .post('/register')
                .send(userData)
                .expect(409);
                
            fortress.expectErrorResponse(response, 409, /já.*cadastrado/i);
        });

        test('deve ser insensível a maiúsculas no email para duplicatas', async () => {
            const userData = await fortress.createTestUser({ 
                email: 'TEST@EXAMPLE.COM'
            });
            
            await fortress.registerUser(app, userData);
            
            // Tentar com minúsculas
            const response = await request(app)
                .post('/register')
                .send({ 
                    ...userData, 
                    email: 'test@example.com' 
                })
                .expect(409);
                
            fortress.expectErrorResponse(response, 409);
        });

        test('deve validar critérios de senha rigorosamente', async () => {
            const userData = await fortress.createTestUser();
            const weakPasswords = [
                '123456',           // muito simples
                'password',         // palavra comum
                'abc123',          // muito curta
                '12345678',        // só números
                'abcdefgh',        // só letras
                'PASSWORD123',     // sem minúsculas
                'password123',     // sem maiúsculas
                'Password',        // sem números
                ''                 // vazia
            ];

            for (const password of weakPasswords) {
                const response = await request(app)
                    .post('/register')
                    .send({ ...userData, password })
                    .expect(400);

                fortress.expectErrorResponse(response, 400, /senha/i);
            }
        });
    });

    // ========================================================================
    // TESTES DE LOGIN
    // ========================================================================
    describe('🔐 Sistema de Login', () => {
        test('deve fazer login com credenciais válidas', async () => {
            const userData = await fortress.createTestUser();
            await fortress.registerUser(app, userData);
            
            fortress.startTimer('login_valid');
            
            const response = await request(app)
                .post('/login')
                .send(userData)
                .expect(200);

            const elapsed = fortress.endTimer('login_valid');
            
            fortress.expectSuccessResponse(response, 200, ['token', 'user']);
            expect(response.body.user.email).toBe(userData.email.toLowerCase());
            expect(elapsed).toBeLessThan(1500);
            
            // Validar estrutura do token
            fortress.validateJWTStructure(response.body.token);
        });

        test('deve ser insensível a maiúsculas no email', async () => {
            const userData = await fortress.createTestUser({ 
                email: 'Test@Example.COM' 
            });
            await fortress.registerUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send({ 
                    email: 'test@example.com', // minúscula
                    password: userData.password 
                })
                .expect(200);

            fortress.expectSuccessResponse(response, 200, ['token']);
        });

        test('deve falhar com email inexistente', async () => {
            const response = await request(app)
                .post('/login')
                .send({ 
                    email: 'naoexiste@teste.com', 
                    password: 'qualquersenha' 
                })
                .expect(401);

            fortress.expectErrorResponse(response, 401, /credenciais.*inválid/i);
        });

        test('deve falhar com senha incorreta', async () => {
            const userData = await fortress.createTestUser();
            await fortress.registerUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send({ 
                    email: userData.email, 
                    password: 'senhaerrada123' 
                })
                .expect(401);

            fortress.expectErrorResponse(response, 401, /credenciais.*inválid/i);
        });

        test('deve aplicar rate limiting em tentativas de login', async () => {
            const userData = await fortress.createTestUser();
            await fortress.registerUser(app, userData);
            
            // Fazer múltiplas tentativas com senha errada
            const attempts = Array.from({ length: 6 }, () =>
                request(app)
                    .post('/login')
                    .set('x-test-rate-limit', 'true') // Ativar rate limiting nos testes
                    .send({ 
                        email: userData.email, 
                        password: 'senhaerrada' 
                    })
            );

            const responses = await Promise.all(attempts);
            
            // As primeiras 5 devem ser 401 (credenciais inválidas)
            responses.slice(0, 5).forEach(response => {
                expect(response.status).toBe(401);
            });
            
            // A 6ª deve ser 429 (rate limited)
            expect(responses[5].status).toBe(429);
            fortress.expectErrorResponse(responses[5], 429, /muitas.*tentativas/i);
        });

        test('deve manter timing consistente para prevenir timing attacks', async () => {
            const userData = await fortress.createTestUser();
            await fortress.registerUser(app, userData);
            
            // Medir tempo para email inexistente
            fortress.startTimer('nonexistent_email');
            await request(app)
                .post('/login')
                .send({ 
                    email: 'naoexiste@teste.com', 
                    password: 'qualquer' 
                });
            const timeNonexistent = fortress.endTimer('nonexistent_email');
            
            // Medir tempo para senha errada
            fortress.startTimer('wrong_password');
            await request(app)
                .post('/login')
                .send({ 
                    email: userData.email, 
                    password: 'senhaerrada' 
                });
            const timeWrongPassword = fortress.endTimer('wrong_password');
            
            // A diferença não deve ser significativa (< 50ms)
            const timeDifference = Math.abs(timeNonexistent - timeWrongPassword);
            expect(timeDifference).toBeLessThan(100);
        });

        test('deve incluir claims corretos no token JWT', async () => {
            const userData = await fortress.createTestUser();
            const registration = await fortress.registerUser(app, userData);
            const login = await fortress.loginUser(app, userData);
            
            const decoded = jwt.verify(login.token, process.env.JWT_SECRET);
            
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email', userData.email.toLowerCase());
            expect(decoded).toHaveProperty('iss', 'editaliza');
            expect(decoded).toHaveProperty('exp');
            
            // Token deve expirar em 24h
            const now = Math.floor(Date.now() / 1000);
            const expiration = decoded.exp;
            const hoursUntilExpiry = (expiration - now) / 3600;
            
            expect(hoursUntilExpiry).toBeCloseTo(24, 0);
        });
    });

    // ========================================================================
    // TESTES DE PROTEÇÃO DE ROTAS
    // ========================================================================
    describe('🔒 Proteção de Rotas', () => {
        test('deve permitir acesso a rota protegida com token válido', async () => {
            const userAuth = await fortress.createAuthenticatedUser(app);
            
            const response = await fortress.authenticatedRequest(app, 'get', '/profile', userAuth.token)
                .expect(200);

            fortress.expectSuccessResponse(response, 200);
        });

        test('deve bloquear acesso sem token', async () => {
            const response = await request(app)
                .get('/profile')
                .expect(401);

            fortress.expectErrorResponse(response, 401, /token.*necessário/i);
        });

        test('deve bloquear acesso com token inválido', async () => {
            const response = await fortress.authenticatedRequest(app, 'get', '/profile', 'token.invalido.aqui')
                .expect(401);

            fortress.expectErrorResponse(response, 401, /token.*inválido/i);
        });

        test('deve bloquear acesso com token expirado', async () => {
            const userData = await fortress.createTestUser();
            
            // Criar token expirado
            const expiredToken = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    expiresIn: '1ms', // Expira imediatamente
                    issuer: 'editaliza' 
                }
            );
            
            // Aguardar expiração
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const response = await fortress.authenticatedRequest(app, 'get', '/profile', expiredToken)
                .expect(401);

            fortress.expectErrorResponse(response, 401, /token.*expirado|expired/i);
        });

        test('deve validar issuer do token', async () => {
            const userData = await fortress.createTestUser();
            
            // Criar token com issuer errado
            const tokenWrongIssuer = jwt.sign(
                { 
                    id: 1, 
                    email: userData.email 
                },
                process.env.JWT_SECRET,
                { 
                    expiresIn: '24h',
                    issuer: 'hacker' // issuer incorreto
                }
            );
            
            const response = await fortress.authenticatedRequest(app, 'get', '/profile', tokenWrongIssuer)
                .expect(401);

            fortress.expectErrorResponse(response, 401, /token.*inválido/i);
        });
    });

    // ========================================================================
    // TESTES DE SEGURANÇA
    // ========================================================================
    describe('🛡️ Segurança e Resistência a Ataques', () => {
        test('deve resistir a tentativas de XSS no registro', async () => {
            const maliciousPayloads = fortress.getMaliciousPayloads().xss;
            
            for (const payload of maliciousPayloads) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: `test${Date.now()}@example.com`,
                        password: payload
                    });
                
                // Deve rejeitar ou sanitizar
                expect([400, 201]).toContain(response.status);
                if (response.status === 201) {
                    fortress.expectNoSensitiveData(response.body);
                }
            }
        });

        test('deve resistir a tentativas de SQL injection', async () => {
            const maliciousPayloads = fortress.getMaliciousPayloads().sqlInjection;
            
            for (const payload of maliciousPayloads) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: payload,
                        password: 'qualquer'
                    });
                
                // Não deve causar erro 500 (indicaria vulnerabilidade)
                expect(response.status).not.toBe(500);
                fortress.expectNoSensitiveData(response.body);
            }
        });

        test('deve lidar com payloads oversized adequadamente', async () => {
            const oversized = fortress.getMaliciousPayloads().oversized;
            
            const response = await request(app)
                .post('/register')
                .send({
                    email: oversized.string,
                    password: oversized.string
                })
                .expect(400);
                
            fortress.expectErrorResponse(response, 400);
        });

        test('deve processar caracteres unicode corretamente', async () => {
            const unicodeData = fortress.getMaliciousPayloads().unicode;
            
            for (const unicode of unicodeData) {
                const userData = await fortress.createTestUser({
                    firstName: unicode,
                    lastName: unicode
                });
                
                const response = await request(app)
                    .post('/register')
                    .send(userData);
                
                // Deve processar sem erro ou rejeitar graciosamente
                expect([400, 201]).toContain(response.status);
            }
        });

        test('deve sanitizar headers maliciosos', async () => {
            const maliciousHeaders = {
                'User-Agent': '<script>alert("xss")</script>',
                'X-Forwarded-For': '\'; DROP TABLE users; --'
            };
            
            const userData = await fortress.createTestUser();
            
            let req = request(app).post('/register').send(userData);
            
            Object.entries(maliciousHeaders).forEach(([key, value]) => {
                req = req.set(key, value);
            });
            
            const response = await req;
            
            // Não deve causar erro 500
            expect(response.status).not.toBe(500);
        });
    });

    // ========================================================================
    // TESTES DE PERFORMANCE
    // ========================================================================
    describe('⚡ Performance e Escalabilidade', () => {
        test('deve processar múltiplos registros simultâneos', async () => {
            fortress.startTimer('concurrent_registrations');
            
            const users = Array.from({ length: 10 }, () => fortress.createTestUser());
            const registrations = await Promise.all(users);
            
            const promises = registrations.map(userData =>
                fortress.registerUser(app, userData)
            );
            
            const results = await Promise.all(promises);
            const elapsed = fortress.endTimer('concurrent_registrations');
            
            expect(results).toHaveLength(10);
            expect(elapsed).toBeLessThan(5000); // Menos de 5 segundos
            
            results.forEach(result => {
                expect(result.response.status).toBe(201);
            });
        });

        test('deve manter performance sob carga de login', async () => {
            // Preparar usuários
            const users = await Promise.all(
                Array.from({ length: 5 }, async () => {
                    const userData = await fortress.createTestUser();
                    await fortress.registerUser(app, userData);
                    return userData;
                })
            );
            
            fortress.startTimer('concurrent_logins');
            
            const loginPromises = users.map(userData =>
                fortress.loginUser(app, userData)
            );
            
            const results = await Promise.all(loginPromises);
            const elapsed = fortress.endTimer('concurrent_logins');
            
            expect(elapsed).toBeLessThan(3000); // Menos de 3 segundos
            results.forEach(result => {
                expect(result.response.status).toBe(200);
                expect(result.token).toBeTruthy();
            });
        });
    });
});