// tests/auth/login.test.js - Testes completos para a rota /login
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestServer } = require('../test-server');
const { dbGet } = require('../database-test');
const {
    validUserData,
    invalidEmailFormats,
    invalidPasswords,
    maliciousPayloads,
    maliciousHeaders,
    registerValidUser,
    testRateLimit,
    sleep,
    expectErrorResponse,
    expectSuccessResponse,
    validateJWTToken,
    generateRandomUserData
} = require('../helpers/auth-helpers');

describe('POST /login', () => {
    let app;

    beforeAll(() => {
        app = createTestServer();
    });

    describe('Casos de Sucesso', () => {
        test('deve fazer login com credenciais válidas', async () => {
            const userData = generateRandomUserData();
            
            // Registrar usuário primeiro
            await registerValidUser(app, userData);
            
            // Fazer login
            const response = await request(app)
                .post('/login')
                .send(userData);

            expectSuccessResponse(response, 200);
            expect(response.body.message).toBe('Login bem-sucedido!');
            expect(response.body).toHaveProperty('token');
            
            // Validar token JWT
            const decoded = validateJWTToken(response.body.token);
            expect(decoded.email).toBe(userData.email);
        });

        test('deve gerar token JWT com estrutura correta', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            expect(response.status).toBe(200);
            
            const token = response.body.token;
            const decoded = jwt.decode(token);
            
            // Verificar claims obrigatórios
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email', userData.email);
            expect(decoded).toHaveProperty('exp');
            expect(decoded).toHaveProperty('iss', 'editaliza');
            expect(decoded).toHaveProperty('iat');
            
            // Verificar expiração (24 horas)
            const now = Math.floor(Date.now() / 1000);
            const expectedExp = now + (24 * 60 * 60); // 24 horas
            expect(decoded.exp).toBeCloseTo(expectedExp, -2); // ±100 segundos de tolerância
        });

        test('deve aceitar email case-insensitive', async () => {
            const userData = {
                email: 'teste@exemplo.com',
                password: 'senhaSegura123'
            };
            
            await registerValidUser(app, userData);
            
            // Login com email em maiúsculas
            const response = await request(app)
                .post('/login')
                .send({
                    email: userData.email.toUpperCase(),
                    password: userData.password
                });

            expectSuccessResponse(response, 200);
        });

        test('deve criar sessão no servidor', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            expect(response.status).toBe(200);
            
            // Verificar se cookie de sessão foi definido
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeTruthy();
            const sessionCookie = cookies.find(cookie => cookie.includes('connect.sid'));
            expect(sessionCookie).toBeTruthy();
        });
    });

    describe('Casos de Falha de Autenticação', () => {
        test('deve rejeitar login com email inexistente', async () => {
            const response = await request(app)
                .post('/login')
                .send({
                    email: 'naoexiste@exemplo.com',
                    password: 'qualquersenha'
                });

            expectErrorResponse(response, 401, /inválidos/i);
        });

        test('deve rejeitar login com senha incorreta', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send({
                    email: userData.email,
                    password: 'senhaErrada123'
                });

            expectErrorResponse(response, 401, /inválidos/i);
        });

        test('deve usar mensagem genérica para email e senha inválidos', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Testar email inexistente
            const response1 = await request(app)
                .post('/login')
                .send({
                    email: 'naoexiste@exemplo.com',
                    password: 'qualquersenha'
                });

            // Testar senha errada
            const response2 = await request(app)
                .post('/login')
                .send({
                    email: userData.email,
                    password: 'senhaErrada'
                });

            // Ambas devem ter a mesma mensagem de erro
            expect(response1.body.error).toBe(response2.body.error);
            expect(response1.body.error).toMatch(/inválidos/i);
        });

        test('deve ter timing consistente para prevenir enumeração', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Timing para email inexistente
            const start1 = Date.now();
            await request(app)
                .post('/login')
                .send({
                    email: 'naoexiste@exemplo.com',
                    password: 'qualquersenha'
                });
            const time1 = Date.now() - start1;
            
            // Timing para senha errada
            const start2 = Date.now();
            await request(app)
                .post('/login')
                .send({
                    email: userData.email,
                    password: 'senhaErrada'
                });
            const time2 = Date.now() - start2;
            
            // Diferença de timing deve ser mínima (±500ms)
            const timeDifference = Math.abs(time1 - time2);
            expect(timeDifference).toBeLessThan(500);
        });
    });

    describe('Validação de Entrada', () => {
        test('deve rejeitar emails com formato inválido', async () => {
            for (const invalidEmail of invalidEmailFormats) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: invalidEmail,
                        password: 'senhaQualquer123'
                    });

                expectErrorResponse(response, 400, /email inválido/i);
            }
        });

        test('deve rejeitar senhas inválidas', async () => {
            for (const invalidPassword of invalidPasswords) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: 'teste@exemplo.com',
                        password: invalidPassword
                    });

                expectErrorResponse(response, 400);
            }
        });

        test('deve rejeitar campos obrigatórios em falta', async () => {
            // Email em falta
            const response1 = await request(app)
                .post('/login')
                .send({
                    password: 'senhaSegura123'
                });

            expectErrorResponse(response1, 400);

            // Password em falta
            const response2 = await request(app)
                .post('/login')
                .send({
                    email: 'teste@exemplo.com'
                });

            expectErrorResponse(response2, 400);

            // Ambos em falta
            const response3 = await request(app)
                .post('/login')
                .send({});

            expectErrorResponse(response3, 400);
        });
    });

    describe('Rate Limiting', () => {
        test('deve aplicar rate limiting após múltiplas tentativas', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Fazer múltiplas tentativas sequenciais com header de rate limit ativo
            const responses = [];
            
            for (let i = 0; i < 7; i++) {
                const response = await request(app)
                    .post('/login')
                    .set('x-test-rate-limit', 'true') // Ativar rate limiting para testes
                    .send({
                        email: userData.email,
                        password: 'senhaErrada'
                    });
                responses.push(response);
            }

            // Primeiras 5 tentativas devem retornar 401 (credenciais inválidas)
            for (let i = 0; i < 5; i++) {
                expect(responses[i].status).toBe(401);
            }

            // Tentativas adicionais devem ser bloqueadas por rate limiting
            const blockedResponses = responses.slice(5);
            for (const response of blockedResponses) {
                expect(response.status).toBe(429);
                expect(response.body.error).toMatch(/muitas tentativas/i);
            }
        });

        test('deve permitir login após rate limit com credenciais corretas', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Esgotar rate limit com tentativas erradas
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/login')
                    .set('x-test-rate-limit', 'true') // Forçar rate limiting em testes
                    .send({
                        email: userData.email,
                        password: 'senhaErrada'
                    });
            }

            // Tentativa com credenciais corretas deve ainda ser bloqueada
            const response = await request(app)
                .post('/login')
                .set('x-test-rate-limit', 'true')
                .send(userData);

            expect(response.status).toBe(429);
        });

        test('não deve aplicar rate limiting para logins bem-sucedidos', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Fazer múltiplos logins bem-sucedidos
            for (let i = 0; i < 10; i++) {
                const response = await request(app)
                    .post('/login')
                    .send(userData);

                expect(response.status).toBe(200);
            }
        });
    });

    describe('Testes de Segurança', () => {
        test('deve sanitizar tentativas de XSS', async () => {
            for (const xssPayload of maliciousPayloads.xssAttempts) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: xssPayload,
                        password: 'senhaQualquer123'
                    });

                // Deve ser bloqueado por validação ou processado com segurança
                expect(response.status).toBeOneOf([400, 401]);
                expect(response.text).not.toContain('<script>');
                expect(response.text).not.toContain('javascript:');
            }
        });

        test('deve resistir a tentativas de SQL injection', async () => {
            for (const sqlPayload of maliciousPayloads.sqlInjectionAttempts) {
                const response = await request(app)
                    .post('/login')
                    .send({
                        email: `teste@exemplo.com`,
                        password: sqlPayload
                    });

                // Não deve quebrar o sistema
                expect(response.status).toBeOneOf([400, 401]);
                
                // Não deve vazar informações do banco
                expect(response.text).not.toMatch(/sql/i);
                expect(response.text).not.toMatch(/sqlite/i);
                expect(response.text).not.toMatch(/table/i);
            }
        });

        test('deve tratar headers maliciosos com segurança', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .set(maliciousHeaders)
                .send(userData);

            // Deve processar normalmente ou rejeitar com segurança
            expect(response.status).toBeOneOf([200, 400, 403]);
            expect(response.text).not.toContain('<script>');
        });

        test('token JWT deve ser seguro', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            expect(response.status).toBe(200);
            
            const token = response.body.token;
            
            // Verificar que token não contém informações sensíveis
            const decoded = jwt.decode(token);
            expect(decoded).not.toHaveProperty('password');
            expect(decoded).not.toHaveProperty('password_hash');
            expect(decoded).not.toHaveProperty('reset_token');
            
            // Verificar que token é válido
            expect(() => {
                jwt.verify(token, process.env.JWT_SECRET);
            }).not.toThrow();
        });

        test('deve rejeitar dados muito grandes', async () => {
            const response = await request(app)
                .post('/login')
                .send(maliciousPayloads.oversizedData);

            expectErrorResponse(response, 400);
        });
    });

    describe('Funcionalidade de Autenticação com Token', () => {
        test('token gerado deve permitir acesso a rotas protegidas', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const loginResponse = await request(app)
                .post('/login')
                .send(userData);

            const token = loginResponse.body.token;
            
            // Usar token para acessar rota protegida
            const protectedResponse = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${token}`);

            expect(protectedResponse.status).toBe(200);
            expect(protectedResponse.body.user.email).toBe(userData.email);
        });

        test('deve rejeitar token malformado', async () => {
            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token-invalido');

            expect(response.status).toBe(403);
        });

        test('deve rejeitar token expirado', async () => {
            const userData = generateRandomUserData();
            
            // Criar token já expirado
            const expiredToken = jwt.sign(
                { id: 1, email: userData.email },
                process.env.JWT_SECRET,
                { expiresIn: '-1h', issuer: 'editaliza' }
            );

            const response = await request(app)
                .get('/protected')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/expirado/i);
        });
    });

    describe('Casos Extremos', () => {
        test('deve lidar com tentativas de login simultâneas', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Fazer múltiplas tentativas simultâneas
            const promises = Array(5).fill().map(() => 
                request(app)
                    .post('/login')
                    .send(userData)
            );

            const responses = await Promise.all(promises);
            
            // Todas devem ter sucesso
            for (const response of responses) {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('token');
            }
        });

        test('deve funcionar com caracteres especiais na senha', async () => {
            const userData = {
                email: 'teste@exemplo.com',
                password: 'Senh@123!#$%^&*()'
            };
            
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            expectSuccessResponse(response, 200);
        });

        test('deve tratar corretamente whitespace em email', async () => {
            const userData = {
                email: 'teste@exemplo.com',
                password: 'senhaSegura123'
            };
            
            await registerValidUser(app, userData);
            
            // Login com espaços no email
            const response = await request(app)
                .post('/login')
                .send({
                    email: '  teste@exemplo.com  ',
                    password: userData.password
                });

            // Pode ser aceito (200) se normalizado corretamente ou rejeitado (400) se validação falhar
            expect(response.status).toBeOneOf([200, 400]);
            
            if (response.status === 200) {
                expect(response.body).toHaveProperty('token');
            } else {
                expect(response.body).toHaveProperty('error');
            }
        });
    });

    describe('Resposta de Sucesso', () => {
        test('deve retornar estrutura consistente de sucesso', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('token');
            expect(typeof response.body.message).toBe('string');
            expect(typeof response.body.token).toBe('string');
            expect(Object.keys(response.body)).toHaveLength(2);
        });

        test('não deve vazar informações sensíveis na resposta', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            const response = await request(app)
                .post('/login')
                .send(userData);

            const responseText = JSON.stringify(response.body);
            
            // Verificar que não contém informações sensíveis
            expect(responseText).not.toMatch(/password/i);
            expect(responseText).not.toMatch(/hash/i);
            expect(responseText).not.toMatch(/sql/i);
            expect(responseText).not.toMatch(/database/i);
            expect(responseText).not.toMatch(/bcrypt/i);
        });
    });
});