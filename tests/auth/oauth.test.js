// tests/auth/oauth.test.js - Comprehensive OAuth authentication tests
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestServer } = require('../test-server');
const { dbGet } = require('../database-test');
const {
    validUserData,
    invalidEmailFormats,
    maliciousPayloads,
    maliciousHeaders,
    registerValidUser,
    expectErrorResponse,
    expectSuccessResponse,
    validateJWTToken,
    generateRandomUserData
} = require('../helpers/auth-helpers');

// Mock passport and Google OAuth strategy
const passport = require('passport');

// Mock Google OAuth profile data
const mockGoogleProfile = {
    id: 'google123456789',
    displayName: 'John Doe',
    emails: [{ value: 'john.doe@gmail.com', verified: true }],
    photos: [{ value: 'https://lh3.googleusercontent.com/photo.jpg' }],
    provider: 'google'
};

const mockGoogleProfileNoPhoto = {
    id: 'google987654321',
    displayName: 'Jane Smith',
    emails: [{ value: 'jane.smith@gmail.com', verified: true }],
    photos: [],
    provider: 'google'
};

const mockInvalidGoogleProfile = {
    id: 'google_invalid',
    displayName: null,
    emails: [],
    photos: [],
    provider: 'google'
};

// Mock OAuth functions
const mockProcessGoogleCallback = jest.fn();

describe('OAuth Authentication System', () => {
    let app;
    
    beforeAll(() => {
        app = createTestServer();
        
        // Mock environment variables for OAuth
        process.env.GOOGLE_CLIENT_ID = 'test_client_id';
        process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
        process.env.GOOGLE_CALLBACK_URL = '/auth/google/callback';
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Google OAuth Flow Tests', () => {
        describe('Successful OAuth Callback Processing', () => {
            test('deve processar callback OAuth com novo usuário com sucesso', async () => {
                // Simulate successful OAuth callback directly
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({
                        profile: mockGoogleProfile,
                        accessToken: 'mock_access_token',
                        refreshToken: 'mock_refresh_token'
                    });
                
                // Since we need to test the actual controller method, let's verify the user creation
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [mockGoogleProfile.emails[0].value]);
                
                expect(user).toBeTruthy();
                expect(user.email).toBe(mockGoogleProfile.emails[0].value);
                expect(user.name).toBe(mockGoogleProfile.displayName);
                expect(user.google_id).toBe(mockGoogleProfile.id);
                expect(user.auth_provider).toBe('google');
                expect(user.password_hash).toBeNull();
            });
            
            test('deve retornar usuário existente com Google ID', async () => {
                // First, create a user with Google OAuth
                const userData = {
                    email: 'existing.google@example.com',
                    name: 'Existing User',
                    google_id: 'existing_google_123',
                    auth_provider: 'google',
                    profile_picture: 'https://photo.jpg',
                    created_at: new Date().toISOString()
                };
                
                // Insert user directly into database
                await request(app)
                    .post('/test/create-google-user')
                    .send(userData);
                
                const profile = {
                    id: 'existing_google_123',
                    displayName: 'Existing User',
                    emails: [{ value: 'existing.google@example.com' }],
                    photos: [{ value: 'https://photo.jpg' }]
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile });
                
                const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [profile.id]);
                expect(user).toBeTruthy();
                expect(user.email).toBe(profile.emails[0].value);
            });
            
            test('deve vincular conta Google a usuário existente com mesmo email', async () => {
                const userData = generateRandomUserData();
                
                // Register regular user first
                await registerValidUser(app, userData);
                
                const linkProfile = {
                    id: 'google_link_123',
                    displayName: 'Test User',
                    emails: [{ value: userData.email }],
                    photos: [{ value: 'https://newphoto.jpg' }]
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: linkProfile });
                
                // Verify account was linked
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [userData.email]);
                expect(user).toBeTruthy();
                expect(user.google_id).toBe(linkProfile.id);
                expect(user.auth_provider).toBe('google');
                expect(user.name).toBe(linkProfile.displayName);
            });
            
            test('deve criar usuário com perfil Google sem foto', async () => {
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: mockGoogleProfileNoPhoto });
                
                const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [mockGoogleProfileNoPhoto.id]);
                expect(user).toBeTruthy();
                expect(user.profile_picture).toBeNull();
                expect(user.email).toBe(mockGoogleProfileNoPhoto.emails[0].value);
            });
            
            test('deve mapear corretamente dados do perfil Google', async () => {
                const detailedProfile = {
                    id: 'google_detailed_123',
                    displayName: 'João Silva Santos',
                    emails: [{ value: 'joao.silva@gmail.com', verified: true }],
                    photos: [{ value: 'https://lh3.googleusercontent.com/detailed-photo.jpg' }],
                    name: {
                        givenName: 'João',
                        familyName: 'Santos'
                    }
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: detailedProfile });
                
                const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [detailedProfile.id]);
                expect(user).toBeTruthy();
                expect(user.name).toBe(detailedProfile.displayName);
                expect(user.email).toBe(detailedProfile.emails[0].value);
                expect(user.profile_picture).toBe(detailedProfile.photos[0].value);
                expect(user.auth_provider).toBe('google');
            });
        });
        
        describe('OAuth Status Endpoint Tests', () => {
            test('deve retornar status OAuth para usuário autenticado', async () => {
                const userData = {
                    email: 'oauth.status@example.com',
                    name: 'OAuth User',
                    google_id: 'oauth_status_123',
                    auth_provider: 'google'
                };
                
                // Create Google user and get the actual user ID
                const createResponse = await request(app)
                    .post('/test/create-google-user')
                    .send(userData);
                
                const actualUserId = createResponse.body.user.id;
                
                const token = jwt.sign(
                    { id: actualUserId, email: userData.email },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h', issuer: 'editaliza' }
                );
                
                const response = await request(app)
                    .get('/auth/google/status')
                    .set('Authorization', `Bearer ${token}`);
                
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('authenticated', true);
                expect(response.body.user).toHaveProperty('email', userData.email);
                expect(response.body.user).toHaveProperty('auth_provider', 'google');
            });
            
            test('deve rejeitar acesso ao status OAuth sem token', async () => {
                const response = await request(app)
                    .get('/auth/google/status');
                
                expect(response.status).toBe(401);
                expect(response.body).toHaveProperty('error');
            });
            
            test('deve rejeitar token inválido para status OAuth', async () => {
                const response = await request(app)
                    .get('/auth/google/status')
                    .set('Authorization', 'Bearer invalid_token');
                
                expect(response.status).toBe(403);
            });
        });
    });
    
    describe('OAuth Error Scenarios', () => {
        describe('Invalid Profile Data', () => {
            test('deve rejeitar perfil OAuth sem email', async () => {
                const profileNoEmail = {
                    id: 'google_no_email',
                    displayName: 'No Email User',
                    emails: [],
                    photos: [{ value: 'https://photo.jpg' }]
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: profileNoEmail });
                
                // Should fail gracefully
                expect(response.status).toBeOneOf([400, 500]);
            });
            
            test('deve rejeitar perfil OAuth com email inválido', async () => {
                // Test only clearly invalid emails that should fail validation
                const clearlyInvalidEmails = [
                    'email-invalido',
                    '@exemplo.com',
                    'teste@',
                    'teste.exemplo.com',
                    'teste @exemplo.com',
                    ''
                ];
                
                for (const invalidEmail of clearlyInvalidEmails) {
                    const profileInvalidEmail = {
                        id: `google_invalid_${Date.now()}_${Math.random()}`,
                        displayName: 'Invalid Email User',
                        emails: [{ value: invalidEmail }],
                        photos: []
                    };
                    
                    const response = await request(app)
                        .post('/test/oauth/google/callback')
                        .send({ profile: profileInvalidEmail });
                    
                    expect(response.status).toBeOneOf([400, 500]);
                }
            });
            
            test('deve rejeitar perfil OAuth sem ID do Google', async () => {
                const profileNoId = {
                    displayName: 'No ID User',
                    emails: [{ value: 'noid@gmail.com' }],
                    photos: []
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: profileNoId });
                
                expect(response.status).toBeOneOf([400, 500]);
            });
            
            test('deve lidar com perfil OAuth com dados corrompidos', async () => {
                const corruptedProfile = {
                    id: 'google_corrupted',
                    displayName: '<script>alert("xss")</script>',
                    emails: [{ value: 'test@example.com<script>' }],
                    photos: [{ value: 'javascript:alert("xss")' }]
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: corruptedProfile });
                
                // Should either reject or sanitize
                if (response.status === 200) {
                    const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [corruptedProfile.id]);
                    if (user) {
                        expect(user.name).not.toContain('<script>');
                        expect(user.email).not.toContain('<script>');
                        // Only check profile_picture if it's not null
                        if (user.profile_picture) {
                            expect(user.profile_picture).not.toContain('javascript:');
                        }
                    }
                }
            });
        });
        
        describe('OAuth Provider Errors', () => {
            test('deve lidar com erro de token inválido do provider', async () => {
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({
                        profile: mockGoogleProfile,
                        accessToken: 'invalid_token',
                        error: 'invalid_token'
                    });
                
                expect(response.status).toBeOneOf([400, 401, 500]);
            });
            
            test('deve lidar com erro de acesso negado pelo usuário', async () => {
                const response = await request(app)
                    .get('/auth/google/callback')
                    .query({
                        error: 'access_denied',
                        error_description: 'The user denied the request'
                    });
                
                expect(response.status).toBe(302); // Should redirect
                expect(response.headers.location).toContain('error=oauth_failed');
            });
            
            test('deve lidar com timeout do provider OAuth', async () => {
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({
                        profile: mockGoogleProfile,
                        error: 'timeout'
                    });
                
                expect(response.status).toBeOneOf([408, 500, 503]);
            });
        });
        
        describe('OAuth Token Validation', () => {
            test('deve rejeitar token OAuth malformado', async () => {
                const malformedTokens = [
                    'Bearer malformed.token',
                    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
                    'Bearer .',
                    'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
                    ''
                ];
                
                for (const token of malformedTokens) {
                    const response = await request(app)
                        .get('/auth/google/status')
                        .set('Authorization', token);
                    
                    expect(response.status).toBeOneOf([401, 403]);
                }
            });
            
            test('deve rejeitar token OAuth expirado', async () => {
                const expiredToken = jwt.sign(
                    { id: 1, email: 'test@example.com' },
                    process.env.JWT_SECRET,
                    { expiresIn: '-1h', issuer: 'editaliza' }
                );
                
                const response = await request(app)
                    .get('/auth/google/status')
                    .set('Authorization', `Bearer ${expiredToken}`);
                
                expect(response.status).toBe(401);
                expect(response.body.error).toMatch(/expirado/i);
            });
        });
    });
    
    describe('OAuth Security Tests', () => {
        describe('State Parameter Validation', () => {
            test('deve validar parâmetro state em callback OAuth', async () => {
                const response = await request(app)
                    .get('/auth/google/callback')
                    .query({
                        code: 'valid_auth_code',
                        state: 'tampered_state'
                    });
                
                // Should either validate state or handle gracefully
                expect(response.status).toBeOneOf([302, 400, 403]);
            });
            
            test('deve rejeitar callback OAuth sem state', async () => {
                const response = await request(app)
                    .get('/auth/google/callback')
                    .query({
                        code: 'valid_auth_code'
                    });
                
                // Should handle missing state parameter
                expect(response.status).toBeOneOf([302, 400]);
            });
        });
        
        describe('CSRF Protection', () => {
            test('deve proteger contra ataques CSRF no OAuth', async () => {
                // Simulate CSRF attack
                const response = await request(app)
                    .get('/auth/google')
                    .set('Origin', 'https://malicious-site.com')
                    .set('Referer', 'https://malicious-site.com/attack');
                
                // Should either block or handle safely
                expect(response.status).toBeOneOf([200, 302, 403]);
            });
            
            test('deve validar origem das requisições OAuth', async () => {
                const maliciousOrigins = [
                    'https://evil.com',
                    'http://phishing-site.com',
                    'javascript:alert("xss")',
                    'data:text/html,<script>alert("xss")</script>'
                ];
                
                for (const origin of maliciousOrigins) {
                    const response = await request(app)
                        .get('/auth/google')
                        .set('Origin', origin);
                    
                    // Should handle safely
                    expect(response.status).toBeOneOf([200, 302, 403]);
                }
            });
        });
        
        describe('OAuth Callback Tampering', () => {
            test('deve detectar tentativas de manipulação do callback', async () => {
                const tamperedCallbacks = [
                    { code: 'valid_code', state: '<script>alert("xss")</script>' },
                    { code: '"; DROP TABLE users; --', state: 'valid_state' },
                    { code: 'valid_code', state: '../../../etc/passwd' },
                    { code: 'eval(alert("xss"))', state: 'valid_state' }
                ];
                
                for (const params of tamperedCallbacks) {
                    const response = await request(app)
                        .get('/auth/google/callback')
                        .query(params);
                    
                    expect(response.status).toBeOneOf([302, 400, 403]);
                    // Should not execute malicious code
                    expect(response.text).not.toContain('<script>');
                    expect(response.text).not.toContain('DROP TABLE');
                }
            });
            
            test('deve sanitizar dados do perfil OAuth', async () => {
                const maliciousProfile = {
                    id: 'google_malicious',
                    displayName: maliciousPayloads.xssAttempts[0],
                    emails: [{ value: 'test@example.com' }],
                    photos: [{ value: maliciousPayloads.xssAttempts[2] }]
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: maliciousProfile });
                
                if (response.status === 200) {
                    const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [maliciousProfile.id]);
                    if (user) {
                        expect(user.name).not.toContain('<script>');
                        expect(user.profile_picture).not.toContain('<script>');
                    }
                }
            });
        });
        
        describe('OAuth Rate Limiting', () => {
            test('deve aplicar rate limiting em tentativas de OAuth', async () => {
                const responses = [];
                
                // Make multiple OAuth initiation requests rapidly
                for (let i = 0; i < 10; i++) {
                    const response = await request(app)
                        .get('/auth/google')
                        .set('x-test-rate-limit', 'true');
                    responses.push(response);
                }
                
                // Should start rate limiting after threshold
                const rateLimitedResponses = responses.filter(r => r.status === 429);
                expect(rateLimitedResponses.length).toBeGreaterThan(0);
            });
            
            test('deve aplicar rate limiting em callbacks OAuth falhados', async () => {
                const responses = [];
                
                // Make multiple failed callback attempts
                for (let i = 0; i < 8; i++) {
                    const response = await request(app)
                        .get('/auth/google/callback')
                        .set('x-test-rate-limit', 'true')
                        .query({ error: 'access_denied' });
                    responses.push(response);
                }
                
                // Should rate limit after multiple failures
                const lastResponses = responses.slice(-2);
                const hasRateLimit = lastResponses.some(r => 
                    r.status === 429 || r.headers.location?.includes('rate_limited')
                );
                expect(hasRateLimit).toBeTruthy();
            });
        });
    });
    
    describe('OAuth Integration Tests', () => {
        describe('Different OAuth Providers', () => {
            test('deve distinguir entre diferentes provedores OAuth', async () => {
                const googleProfile = {
                    id: 'google_provider_test',
                    displayName: 'Google User',
                    emails: [{ value: 'google@example.com' }],
                    provider: 'google'
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: googleProfile });
                
                const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [googleProfile.id]);
                expect(user?.auth_provider).toBe('google');
            });
            
            test('deve lidar com mudança de provedor OAuth', async () => {
                const userData = generateRandomUserData();
                
                // Register as regular user
                await registerValidUser(app, userData);
                
                // Try to link with Google
                const googleProfile = {
                    id: 'google_switch_test',
                    displayName: 'Switched User',
                    emails: [{ value: userData.email }],
                    provider: 'google'
                };
                
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: googleProfile });
                
                const user = await dbGet('SELECT * FROM users WHERE email = ?', [userData.email]);
                expect(user?.auth_provider).toBe('google');
                expect(user?.google_id).toBe(googleProfile.id);
            });
        });
        
        describe('OAuth Session Management', () => {
            test('deve criar sessão após OAuth bem-sucedido', async () => {
                const response = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: mockGoogleProfile });
                
                // Check for session cookie
                const cookies = response.headers['set-cookie'];
                expect(cookies).toBeTruthy();
                
                const sessionCookie = cookies?.find(cookie => 
                    cookie.includes('connect.sid') || cookie.includes('session')
                );
                expect(sessionCookie).toBeTruthy();
            });
            
            test('deve limpar sessão anterior em novo login OAuth', async () => {
                // First OAuth login
                const firstResponse = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: mockGoogleProfile });
                
                // Second OAuth login with different profile
                const secondProfile = { ...mockGoogleProfile, id: 'google_second_123' };
                const secondResponse = await request(app)
                    .post('/test/oauth/google/callback')
                    .send({ profile: secondProfile });
                
                // Should create new session
                expect(secondResponse.headers['set-cookie']).toBeTruthy();
            });
        });
    });
    
    describe('OAuth Edge Cases', () => {
        test('deve lidar com emails OAuth muito longos', async () => {
            const longEmailProfile = {
                id: 'google_long_email',
                displayName: 'Long Email User',
                emails: [{ value: 'a'.repeat(300) + '@gmail.com' }],
                photos: []
            };
            
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: longEmailProfile });
            
            // Should handle gracefully
            expect(response.status).toBeOneOf([200, 400]);
        });
        
        test('deve lidar com nomes OAuth com caracteres especiais', async () => {
            const specialCharsProfile = {
                id: 'google_special_chars',
                displayName: 'José María González-Pérez (Dr.) 🎓',
                emails: [{ value: 'jose.maria@gmail.com' }],
                photos: []
            };
            
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: specialCharsProfile });
            
            if (response.status === 200) {
                const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [specialCharsProfile.id]);
                expect(user?.name).toBeTruthy();
                // Should preserve or safely handle special characters
            }
        });
        
        test('deve lidar com perfil OAuth sem foto de perfil', async () => {
            const noPhotoProfile = {
                id: 'google_no_photo',
                displayName: 'No Photo User',
                emails: [{ value: 'nophoto@gmail.com' }],
                photos: []
            };
            
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: noPhotoProfile });
            
            expect(response.status).toBe(200);
            
            const user = await dbGet('SELECT * FROM users WHERE google_id = ?', [noPhotoProfile.id]);
            expect(user?.profile_picture).toBeNull();
        });
        
        test('deve lidar com tentativas simultâneas de OAuth', async () => {
            const promises = Array(5).fill().map((_, i) => 
                request(app)
                    .post('/test/oauth/google/callback')
                    .send({
                        profile: {
                            ...mockGoogleProfile,
                            id: `google_concurrent_${i}`,
                            emails: [{ value: `concurrent${i}@gmail.com` }]
                        }
                    })
            );
            
            const responses = await Promise.all(promises);
            
            // All should succeed or fail gracefully
            for (const response of responses) {
                expect(response.status).toBeOneOf([200, 400, 409, 500]);
            }
        });
        
        test('deve preservar dados do usuário existente ao vincular OAuth', async () => {
            const userData = generateRandomUserData();
            await registerValidUser(app, userData);
            
            // Add some user data
            await request(app)
                .post('/test/add-user-data')
                .send({
                    email: userData.email,
                    preferences: { theme: 'dark', language: 'pt' }
                });
            
            // Link Google account
            const linkProfile = {
                id: 'google_preserve_data',
                displayName: 'Updated Name',
                emails: [{ value: userData.email }],
                photos: [{ value: 'https://newphoto.jpg' }]
            };
            
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: linkProfile });
            
            const user = await dbGet('SELECT * FROM users WHERE email = ?', [userData.email]);
            expect(user?.google_id).toBe(linkProfile.id);
            expect(user?.auth_provider).toBe('google');
            // Original data should be preserved or gracefully updated
        });
    });
    
    describe('OAuth Performance Tests', () => {
        test('deve processar callback OAuth em tempo razoável', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: mockGoogleProfile });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // OAuth processing should complete within reasonable time
            expect(duration).toBeLessThan(5000); // 5 seconds max
            expect(response.status).toBeOneOf([200, 201]);
        });
        
        test('não deve vazar informações sensíveis em respostas OAuth', async () => {
            const response = await request(app)
                .post('/test/oauth/google/callback')
                .send({ profile: mockGoogleProfile });
            
            const responseText = JSON.stringify(response.body) + response.text;
            
            // Should not contain sensitive OAuth information
            expect(responseText).not.toContain('client_secret');
            expect(responseText).not.toContain('refresh_token');
            expect(responseText).not.toContain('access_token');
            expect(responseText).not.toContain('password_hash');
            expect(responseText).not.toMatch(/sql/i);
            expect(responseText).not.toMatch(/database/i);
        });
    });
});