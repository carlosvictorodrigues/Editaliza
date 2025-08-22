/**
 * OAuth Controller - Controle direto do fluxo OAuth sem Passport.js
 * 
 * Este controlador implementa OAuth Google de forma direta,
 * evitando problemas comuns do Passport com proxy reverso.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const googleOAuthService = require('../services/googleOAuthService');
const { signCookie, verifyCookie, OAUTH_COOKIE_CONFIG } = require('../utils/cookieSecurity');

class OAuthController {
    /**
     * Inicia fluxo OAuth - redireciona para Google
     */
    async initiateGoogleOAuth(req, res) {
        try {
            console.log('\n🚀 INICIANDO FLUXO OAUTH GOOGLE');
            
            if (!googleOAuthService.isEnabled()) {
                console.error('❌ Google OAuth não está configurado');
                return res.status(500).json({
                    error: 'Google OAuth não está configurado no servidor'
                });
            }

            // Gerar state único para prevenir CSRF
            const state = crypto.randomBytes(32).toString('hex');
            const timestamp = Date.now();
            
            // Gerar PKCE code_verifier e code_challenge
            const codeVerifier = crypto.randomBytes(32).toString('base64url');
            const codeChallenge = crypto
                .createHash('sha256')
                .update(codeVerifier)
                .digest('base64url');
            
            // Determinar origem
            const origin = req.query.app ? 'app' : 'web';
            
            // Salvar state e origem na sessão
            req.session.oauth_state = state;
            req.session.oauth_timestamp = timestamp;
            req.session.oauth_origin = origin;
            req.session.code_verifier = codeVerifier;
            req.session.code_challenge = codeChallenge;
            
            console.log('   Origem:', origin === 'app' ? 'App móvel/web' : 'Site principal');
            console.log('   PKCE configurado (code_challenge gerado)');
            
            // Cookies de fallback ASSINADOS com HMAC
            // Path limitado a /auth para reduzir superfície de ataque
            res.cookie('oauth_state', signCookie(state), OAUTH_COOKIE_CONFIG);
            res.cookie('oauth_cv', signCookie(codeVerifier), OAUTH_COOKIE_CONFIG);
            res.cookie('oauth_origin', signCookie(origin), OAUTH_COOKIE_CONFIG);
            res.cookie('oauth_ts', signCookie(timestamp.toString()), OAUTH_COOKIE_CONFIG);
            
            console.log('   ✅ Cookies de fallback assinados (HMAC) configurados');
            console.log('   🔒 Path limitado a /auth para segurança');
            
            // Garantir que a sessão seja salva antes de redirecionar
            await new Promise((resolve, reject) => {
                req.session.save(err => {
                    if (err) {
                        console.error('⚠️ Erro ao salvar sessão:', err);
                        // Continua mesmo com erro - temos os cookies de fallback
                        resolve();
                    } else {
                        resolve();
                    }
                });
            });
            
            console.log('   Session ID:', req.sessionID);
            console.log('   State gerado:', state.substring(0, 10) + '...');
            console.log('   Cookies enviados:', Object.keys(req.cookies || {}));

            // Gerar URL de autorização com state
            const authUrl = googleOAuthService.getAuthUrl(state);
            console.log('✅ URL de autorização gerada');
            console.log('   Redirecionando para:', authUrl.substring(0, 80) + '...');

            // Redirecionar para Google
            res.redirect(authUrl);

        } catch (error) {
            console.error('❌ Erro ao iniciar OAuth:', error);
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }

    /**
     * Processa callback do Google OAuth
     * ESTA FUNÇÃO RESOLVE O PROBLEMA "Malformed auth code"
     */
    async handleGoogleCallback(req, res) {
        try {
            console.log('\n📥 CALLBACK GOOGLE OAUTH RECEBIDO');
            console.log('='.repeat(60));
            
            // Log de debug detalhado
            console.log('📋 REQUEST INFO:');
            console.log(`   URL: ${req.originalUrl}`);
            console.log(`   Protocol: ${req.protocol}`);
            console.log(`   Host: ${req.get('host')}`);
            console.log(`   IP: ${req.ip}`);
            console.log(`   Session ID: ${req.sessionID}`);
            console.log(`   Cookies recebidos: ${Object.keys(req.cookies || {})}`);
            
            // Recuperar e verificar dados da sessão ou cookies assinados
            const oauth_state = req.session?.oauth_state || verifyCookie(req.cookies?.oauth_state);
            const code_verifier = req.session?.code_verifier || verifyCookie(req.cookies?.oauth_cv);
            const oauth_origin = req.session?.oauth_origin || verifyCookie(req.cookies?.oauth_origin) || 'web';
            const oauth_timestamp = req.session?.oauth_timestamp || 
                (req.cookies?.oauth_timestamp ? parseInt(verifyCookie(req.cookies.oauth_timestamp)) : null);
            
            console.log('\n🔍 OAUTH DATA (sessão + fallback):');
            console.log(`   oauth_state (sessão): ${req.session?.oauth_state ? req.session.oauth_state.substring(0, 10) + '...' : 'AUSENTE'}`);
            console.log(`   oauth_state (cookie): ${req.cookies?.oauth_state ? req.cookies.oauth_state.substring(0, 10) + '...' : 'AUSENTE'}`);
            console.log(`   oauth_state (usado): ${oauth_state ? oauth_state.substring(0, 10) + '...' : 'AUSENTE'}`);
            console.log(`   oauth_timestamp: ${oauth_timestamp}`);
            console.log(`   oauth_origin: ${oauth_origin}`);
            
            console.log('\n🔗 QUERY PARAMETERS:');
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];
                if (key === 'code') {
                    const preview = value ? `${value.substring(0, 15)}...${value.substring(value.length - 15)}` : 'null';
                    console.log(`   ${key}: ${preview} (length: ${value ? value.length : 0})`);
                } else if (key === 'state') {
                    console.log(`   ${key}: ${value ? value.substring(0, 10) + '...' : 'AUSENTE'}`);
                } else {
                    console.log(`   ${key}: ${value}`);
                }
            });
            
            // Diagnóstico do problema "Malformed auth code"
            const diagnostics = {
                hasState: !!oauth_state,
                stateMatch: oauth_state === req.query.state,
                codeLength: String(req.query.code || '').length,
                hasCode: !!req.query.code,
                sessionAge: oauth_timestamp ? Date.now() - oauth_timestamp : null,
                host: req.headers.host,
                forwardedProto: req.headers['x-forwarded-proto'],
                protocol: req.protocol,
                stateSource: req.session?.oauth_state ? 'session' : (req.cookies?.oauth_state ? 'cookie' : 'none')
            };
            
            console.log('\n🔬 DIAGNÓSTICO PRÉ-TROCA:');
            console.log('   State presente:', diagnostics.hasState);
            console.log('   State origem:', diagnostics.stateSource);
            console.log('   State corresponde:', diagnostics.stateMatch);
            console.log('   Código presente:', diagnostics.hasCode);
            console.log('   Comprimento do código:', diagnostics.codeLength);
            console.log('   Idade da sessão (ms):', diagnostics.sessionAge);
            
            // Verificar se temos state (de qualquer fonte)
            if (!diagnostics.hasState) {
                console.error('❌ ERRO: State OAuth perdido - nem sessão nem cookie de fallback');
                
                // Limpar cookies de fallback
                res.clearCookie('oauth_state', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_timestamp', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_origin', { domain: '.editaliza.com.br' });
                
                return res.status(400).json({ 
                    error: 'OAuthSessionLost', 
                    message: 'Sessão OAuth perdida. Por favor, tente novamente.',
                    diagnostics: diagnostics
                });
            }
            
            // Verificar state para prevenir CSRF
            if (!diagnostics.stateMatch) {
                console.error('❌ ERRO: State não corresponde - possível ataque CSRF');
                
                // Limpar cookies de fallback
                res.clearCookie('oauth_state', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_timestamp', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_origin', { domain: '.editaliza.com.br' });
                
                return res.status(400).json({ 
                    error: 'InvalidState',
                    message: 'State inválido. Por favor, tente novamente.',
                    expected: oauth_state?.substring(0, 10) + '...',
                    received: req.query.state?.substring(0, 10) + '...',
                    source: diagnostics.stateSource
                });
            }
            
            // Verificar idade da sessão (timeout de 10 minutos)
            if (diagnostics.sessionAge && diagnostics.sessionAge > 10 * 60 * 1000) {
                console.error('❌ ERRO: Sessão OAuth expirou (> 10 minutos)');
                
                // Limpar cookies de fallback
                res.clearCookie('oauth_state', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_timestamp', { domain: '.editaliza.com.br' });
                res.clearCookie('oauth_origin', { domain: '.editaliza.com.br' });
                
                return res.status(400).json({ 
                    error: 'OAuthTimeout',
                    message: 'Sessão OAuth expirou. Por favor, tente novamente.',
                    age: Math.round(diagnostics.sessionAge / 1000) + ' segundos'
                });
            }

            // Verificar erros do Google
            if (req.query.error) {
                console.error('❌ Google retornou erro:', req.query.error);
                if (req.query.error_description) {
                    console.error('   Descrição:', decodeURIComponent(req.query.error_description));
                }
                return res.redirect('/login.html?error=' + encodeURIComponent(req.query.error));
            }

            // Verificar código de autorização
            if (!req.query.code) {
                console.error('❌ Código de autorização ausente');
                return res.redirect('/login.html?error=no_authorization_code');
            }

            // Limpar e validar código
            const authCode = req.query.code.trim().replace(/\s+/g, ''); // Remover todos espaços
            console.log('✅ Código de autorização válido recebido');
            console.log('   Código limpo, comprimento:', authCode.length);

            // Processar OAuth usando nosso serviço direto
            console.log('\n🔄 INICIANDO PROCESSAMENTO OAUTH...');
            const result = await googleOAuthService.processCallback(authCode, req.query.state);

            if (!result.success) {
                console.error('❌ Falha no processamento OAuth:', result.error);
                return res.redirect('/login.html?error=' + encodeURIComponent('oauth_processing_failed'));
            }

            const user = result.user;
            console.log('\n✅ OAUTH PROCESSADO COM SUCESSO');
            console.log(`   Usuário: ${user.email} (ID: ${user.id})`);
            console.log(`   Nome: ${user.name}`);

            // Fazer login na sessão - COMPLETO
            req.session.userId = user.id;
            req.session.user = {
                id: user.id,
                email: user.email,
                name: user.name
            };
            req.session.isAuthenticated = true;
            req.session.loginTime = new Date();
            req.session.loginMethod = 'google_oauth';

            // Gerar JWT
            const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    loginMethod: 'oauth'
                },
                jwtSecret,
                {
                    expiresIn: '24h',
                    issuer: 'editaliza'
                }
            );

            // Determinar URL de redirecionamento
            let redirectUrl = '/home.html?auth_success=1&method=google';
            
            // Se veio do app, redirecionar para domínio do app
            if (oauth_origin === 'app') {
                redirectUrl = 'https://app.editaliza.com.br' + redirectUrl;
                console.log('   Redirecionamento para app');
            } else {
                console.log('   Redirecionamento para site');
            }

            // Limpar dados OAuth da sessão
            delete req.session.oauth_origin;
            delete req.session.oauth_state;
            delete req.session.oauth_timestamp;
            
            // Limpar cookies de fallback
            res.clearCookie('oauth_state', { domain: '.editaliza.com.br' });
            res.clearCookie('oauth_timestamp', { domain: '.editaliza.com.br' });
            res.clearCookie('oauth_origin', { domain: '.editaliza.com.br' });

            // Adicionar token à URL apenas se não for redirecionamento externo
            if (!redirectUrl.startsWith('https://app.')) {
                redirectUrl += '&token=' + encodeURIComponent(token);
            }

            // LOG DE DEBUG PÓS-LOGIN
            console.log('\n🔍 DEBUG PÓS-LOGIN:');
            console.log('   hasSession:', !!req.session);
            console.log('   hasUser:', !!req.session?.user);
            console.log('   isAuthenticated:', !!req.session?.isAuthenticated);
            console.log('   userId:', req.session?.userId);
            console.log('   sessionID:', req.sessionID);
            console.log('   user:', req.session?.user);
            
            // IMPORTANTE: Salvar sessão ANTES de redirecionar
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('⚠️ Erro ao salvar sessão:', saveErr);
                    return res.redirect('/login.html?error=session_save_failed');
                }
                
                console.log('✅ Sessão salva com sucesso');
                console.log(`✅ REDIRECIONAMENTO FINAL: ${redirectUrl}`);
                console.log('='.repeat(60));
                
                // Opcionalmente, definir cookie JWT adicional
                if (token) {
                    res.cookie('editaliza_jwt', token, {
                        httpOnly: true,
                        secure: true,
                        sameSite: 'none',
                        domain: '.editaliza.com.br',
                        maxAge: 24 * 60 * 60 * 1000 // 24 horas
                    });
                }
                
                res.redirect(redirectUrl);
            });

        } catch (error) {
            console.error('\n❌ ERRO CRÍTICO NO CALLBACK OAUTH:');
            console.error('   Tipo:', error.constructor.name);
            console.error('   Mensagem:', error.message);
            console.error('   Stack:', error.stack);

            // Redirecionar com erro genérico
            res.redirect('/login.html?error=oauth_error&details=' + encodeURIComponent(error.message));
        }
    }

    /**
     * Status do OAuth - para debug
     */
    async getOAuthStatus(req, res) {
        try {
            const status = googleOAuthService.getStatus();
            const requestInfo = {
                protocol: req.protocol,
                host: req.get('host'),
                secure: req.secure,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                headers: {
                    'x-forwarded-proto': req.headers['x-forwarded-proto'],
                    'x-forwarded-host': req.headers['x-forwarded-host'],
                    'x-forwarded-for': req.headers['x-forwarded-for']
                }
            };

            res.json({
                oauth_service: status,
                request_info: requestInfo,
                test_urls: {
                    oauth_start: `${req.protocol}://${req.get('host')}/auth/google/direct`,
                    callback_expected: status.redirectUri
                },
                environment: {
                    node_env: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({
                error: 'Erro ao obter status OAuth',
                message: error.message
            });
        }
    }

    /**
     * Teste de conectividade com Google
     */
    async testGoogleConnectivity(req, res) {
        try {
            // Testar se conseguimos acessar as APIs do Google
            const axios = require('axios');
            
            const tests = [];
            
            // Teste 1: Google OAuth2 endpoint
            try {
                const response1 = await axios.get('https://accounts.google.com/.well-known/openid-configuration', {
                    timeout: 5000
                });
                tests.push({
                    name: 'Google OAuth2 Discovery',
                    status: 'SUCCESS',
                    response_code: response1.status,
                    authorization_endpoint: response1.data.authorization_endpoint
                });
            } catch (error) {
                tests.push({
                    name: 'Google OAuth2 Discovery',
                    status: 'FAILED',
                    error: error.message
                });
            }

            // Teste 2: Token endpoint
            try {
                // Apenas testar se o endpoint responde (deve dar 400 mas indica que está online)
                await axios.post('https://oauth2.googleapis.com/token', {}, {
                    timeout: 5000,
                    validateStatus: () => true // Aceitar qualquer status
                });
                tests.push({
                    name: 'Google Token Endpoint',
                    status: 'ONLINE',
                    note: 'Endpoint acessível'
                });
            } catch (error) {
                tests.push({
                    name: 'Google Token Endpoint',
                    status: 'FAILED',
                    error: error.message
                });
            }

            res.json({
                message: 'Testes de conectividade com Google',
                tests: tests,
                oauth_config: googleOAuthService.getStatus(),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                error: 'Erro nos testes de conectividade',
                message: error.message
            });
        }
    }
}

module.exports = new OAuthController();