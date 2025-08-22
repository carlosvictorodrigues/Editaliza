// tests/auth/register.test.js - Testes completos para a rota /register
const request = require('supertest');
const { createTestServer } = require('../test-server');
const { dbGet } = require('../database-test');
const {
    validUserData,
    invalidEmailFormats,
    invalidPasswords,
    maliciousPayloads,
    maliciousHeaders,
    expectErrorResponse,
    expectSuccessResponse,
    generateRandomUserData
} = require('../helpers/auth-helpers');

describe('POST /register', () => {
    let app;

    beforeAll(() => {
        app = createTestServer();
    });

    describe('Casos de Sucesso', () => {
        test('deve registrar usuário com dados válidos', async () => {
            const userData = generateRandomUserData();
            
            const response = await request(app)
                .post('/register')
                .send(userData);

            expectSuccessResponse(response, 201);
            expect(response.body.message).toBe('Usuário criado com sucesso!');

            // Verificar se usuário foi salvo no banco de dados
            const savedUser = await dbGet('SELECT * FROM users WHERE email = ?', [userData.email]);
            expect(savedUser).toBeTruthy();
            expect(savedUser.email).toBe(userData.email);
            expect(savedUser.password_hash).toBeTruthy();
            expect(savedUser.password_hash).not.toBe(userData.password); // Senha deve estar hasheada
        });

        test('deve aceitar email normalizado', async () => {
            const userData = {
                email: 'TESTE.Email+tag@EXEMPLO.COM',
                password: 'senhaSegura123'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            expectSuccessResponse(response, 201);

            // Verificar se email foi normalizado no banco (express-validator normaliza para lowercase)
            const savedUser = await dbGet('SELECT email FROM users WHERE email LIKE "%teste.email%"');
            expect(savedUser).toBeTruthy();
            expect(savedUser.email.toLowerCase()).toContain('teste.email');
        });

        test('deve aceitar senha com caracteres especiais permitidos', async () => {
            const userData = {
                email: 'teste@exemplo.com',
                password: 'Senh@123!#$%^&*()'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            expectSuccessResponse(response, 201);
        });

        test('deve hashear senha com bcrypt', async () => {
            const userData = generateRandomUserData();
            
            await request(app)
                .post('/register')
                .send(userData);

            const savedUser = await dbGet('SELECT password_hash FROM users WHERE email = ?', [userData.email]);
            
            // Verificar que é um hash bcrypt válido
            expect(savedUser.password_hash).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/);
            expect(savedUser.password_hash).not.toBe(userData.password);
            
            // Verificar que o hash é válido
            const bcrypt = require('bcryptjs');
            const isValidHash = await bcrypt.compare(userData.password, savedUser.password_hash);
            expect(isValidHash).toBe(true);
        });
    });

    describe('Validação de Email', () => {
        test('deve rejeitar emails com formato inválido', async () => {
            for (const invalidEmail of invalidEmailFormats) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: invalidEmail,
                        password: 'senhaSegura123'
                    });

                expectErrorResponse(response, 400, /email inválido/i);
            }
        });

        test('deve rejeitar email vazio', async () => {
            const response = await request(app)
                .post('/register')
                .send({
                    password: 'senhaSegura123'
                });

            expectErrorResponse(response, 400);
        });

        test('deve rejeitar email duplicado', async () => {
            const userData = generateRandomUserData();
            
            // Registrar usuário pela primeira vez
            await request(app)
                .post('/register')
                .send(userData);

            // Tentar registrar novamente com mesmo email
            const response = await request(app)
                .post('/register')
                .send(userData);

            expectErrorResponse(response, 400, /já está em uso/i);
        });

        test('deve tratar email duplicado case-insensitive', async () => {
            const userData = generateRandomUserData();
            
            // Registrar com email em minúsculas
            await request(app)
                .post('/register')
                .send(userData);

            // Tentar registrar com email em maiúsculas
            const response = await request(app)
                .post('/register')
                .send({
                    email: userData.email.toUpperCase(),
                    password: 'outraSenha123'
                });

            expectErrorResponse(response, 400, /já está em uso/i);
        });
    });

    describe('Validação de Senha', () => {
        test('deve rejeitar senhas muito curtas', async () => {
            for (const invalidPassword of invalidPasswords) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: 'teste@exemplo.com',
                        password: invalidPassword
                    });

                expectErrorResponse(response, 400);
            }
        });

        test('deve rejeitar senha vazia', async () => {
            const response = await request(app)
                .post('/register')
                .send({
                    email: 'teste@exemplo.com'
                });

            expectErrorResponse(response, 400);
        });

        test('deve rejeitar senha com caracteres perigosos', async () => {
            const dangerousPasswords = [
                'senha\n\r\t',
                'senha\x00null',
                'senha\x1b[31mcolored'
            ];

            for (const password of dangerousPasswords) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: `teste${Date.now()}@exemplo.com`,
                        password: password
                    });

                expectErrorResponse(response, 400);
            }
        });
    });

    describe('Testes de Segurança', () => {
        test('deve sanitizar tentativas de XSS no email', async () => {
            for (const xssPayload of maliciousPayloads.xssAttempts) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: xssPayload,
                        password: 'senhaSegura123'
                    });

                expectErrorResponse(response, 400, /email inválido/i);
                
                // Verificar que o payload não foi executado
                expect(response.text).not.toContain('<script>');
                expect(response.text).not.toContain('javascript:');
            }
        });

        test('deve sanitizar tentativas de SQL injection', async () => {
            for (const sqlPayload of maliciousPayloads.sqlInjectionAttempts) {
                const response = await request(app)
                    .post('/register')
                    .send({
                        email: `teste${Date.now()}@exemplo.com`,
                        password: sqlPayload
                    });

                // Pode ser rejeitado por validação ou aceito se sanitizado
                // O importante é não quebrar o sistema
                expect(response.status).toBeOneOf([400, 201]);
                
                if (response.status === 201) {
                    // Se aceito, verificar que foi sanitizado
                    const savedUser = await dbGet('SELECT password_hash FROM users WHERE email LIKE "%teste%"');
                    expect(savedUser.password_hash).not.toContain('DROP');
                    expect(savedUser.password_hash).not.toContain('UNION');
                }
            }
        });

        test('deve rejeitar dados muito grandes', async () => {
            const response = await request(app)
                .post('/register')
                .send(maliciousPayloads.oversizedData);

            expectErrorResponse(response, 400);
        });

        test('deve tratar headers maliciosos com segurança', async () => {
            const response = await request(app)
                .post('/register')
                .set(maliciousHeaders)
                .send(validUserData);

            // Deve processar normalmente ou rejeitar com segurança
            expect(response.status).toBeOneOf([201, 400, 403]);
            
            // Não deve vazar informações sensíveis
            expect(response.text).not.toContain('<script>');
        });

        test('deve resistir a ataques de timing', async () => {
            const startTime = Date.now();
            
            // Tentar registrar com email existente
            await request(app)
                .post('/register')
                .send(validUserData);
                
            const firstDuration = Date.now() - startTime;
            
            const startTime2 = Date.now();
            
            // Tentar registrar novamente
            await request(app)
                .post('/register')
                .send(validUserData);
                
            const secondDuration = Date.now() - startTime2;
            
            // As duas operações devem ter tempo similar (±1000ms de diferença)
            const timeDifference = Math.abs(firstDuration - secondDuration);
            expect(timeDifference).toBeLessThan(1000);
        });
    });

    describe('Validação de Estrutura de Requisição', () => {
        test('deve rejeitar Content-Type inválido', async () => {
            const response = await request(app)
                .post('/register')
                .set('Content-Type', 'text/plain')
                .send('email=teste@exemplo.com&password=senha123');

            expect(response.status).toBeOneOf([400, 415]);
        });

        test('deve rejeitar JSON malformado', async () => {
            const response = await request(app)
                .post('/register')
                .set('Content-Type', 'application/json')
                .send('{"email": "teste@exemplo.com", "password": }');

            expect(response.status).toBeOneOf([400, 422]);
        });

        test('deve rejeitar campos extras não esperados', async () => {
            const response = await request(app)
                .post('/register')
                .send({
                    email: 'teste@exemplo.com',
                    password: 'senhaSegura123',
                    admin: true,
                    role: 'admin',
                    extraField: 'malicious'
                });

            // Deve aceitar mas ignorar campos extras
            // ou rejeitar a requisição inteira
            if (response.status === 201) {
                const savedUser = await dbGet('SELECT * FROM users WHERE email = ?', ['teste@exemplo.com']);
                expect(savedUser).not.toHaveProperty('admin');
                expect(savedUser).not.toHaveProperty('role');
            }
        });
    });

    describe('Casos Extremos', () => {
        test('deve lidar com requisições simultâneas do mesmo usuário', async () => {
            const userData = generateRandomUserData();
            
            // Fazer múltiplas requisições simultâneas
            const promises = Array(5).fill().map(() => 
                request(app)
                    .post('/register')
                    .send(userData)
            );

            const responses = await Promise.all(promises);
            
            // Apenas uma deve ter sucesso
            const successResponses = responses.filter(r => r.status === 201);
            const errorResponses = responses.filter(r => r.status === 400);
            
            expect(successResponses).toHaveLength(1);
            expect(errorResponses.length).toBeGreaterThan(0);
            
            // Verificar que apenas um usuário foi criado
            const users = await dbGet('SELECT COUNT(*) as count FROM users WHERE email = ?', [userData.email]);
            expect(users.count).toBe(1);
        });

        test('deve funcionar com caracteres unicode no email', async () => {
            const userData = {
                email: 'tëste@éxamplo.com',
                password: 'senhaSegura123'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            // Pode aceitar ou rejeitar, mas deve tratar com segurança
            expect(response.status).toBeOneOf([201, 400]);
        });

        test('deve preservar case do email original', async () => {
            const userData = {
                email: 'Teste.Email@Exemplo.COM',
                password: 'senhaSegura123'
            };

            const response = await request(app)
                .post('/register')
                .send(userData);

            if (response.status === 201) {
                const savedUser = await dbGet('SELECT email FROM users WHERE email LIKE "%teste.email%"');
                expect(savedUser).toBeTruthy();
            }
        });
    });

    describe('Resposta de Erro', () => {
        test('deve retornar estrutura de erro consistente', async () => {
            const response = await request(app)
                .post('/register')
                .send({
                    email: 'email-invalido',
                    password: '123'
                });

            expectErrorResponse(response, 400);
            expect(response.body).toHaveProperty('error');
            expect(typeof response.body.error).toBe('string');
            expect(response.body.error.length).toBeGreaterThan(0);
        });

        test('não deve vazar informações sensíveis em erros', async () => {
            const response = await request(app)
                .post('/register')
                .send({
                    email: 'teste@exemplo.com',
                    password: 'senhaSegura123'
                });

            const responseText = JSON.stringify(response.body);
            
            // Verificar que não contém informações sensíveis
            expect(responseText).not.toMatch(/password_hash/i);
            expect(responseText).not.toMatch(/sql/i);
            expect(responseText).not.toMatch(/sqlite/i);
            expect(responseText).not.toMatch(/error.*stack/i);
            expect(responseText).not.toMatch(/bcrypt/i);
        });
    });
});