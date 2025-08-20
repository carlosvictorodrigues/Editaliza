/**
 * Google OAuth Service - Implementação direta sem Passport.js
 * 
 * Esta implementação bypassa problemas comuns do Passport com proxy reverso
 * e oferece controle total sobre o fluxo OAuth.
 */

const axios = require('axios');
const authRepository = require('../repositories/authRepository');

class GoogleOAuthService {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        // IMPORTANTE: Este redirect_uri DEVE ser EXATAMENTE igual ao configurado no Google Console
        // Se mudar aqui, precisa mudar no Google Console também
        this.redirectUri = 'https://editaliza.com.br/auth/google/callback';
        
        // Validar configuração
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️ Google OAuth não configurado - credenciais ausentes');
            this.enabled = false;
        } else {
            this.enabled = true;
        }
    }

    /**
     * Gera URL de autorização do Google com suporte a PKCE
     * @param {string} state - State para prevenir CSRF
     * @param {string} codeChallenge - Code challenge para PKCE (opcional mas recomendado)
     */
    getAuthUrl(state = null, codeChallenge = null) {
        if (!this.enabled) {
            throw new Error('Google OAuth não está configurado');
        }

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'profile email',
            access_type: 'offline',
            include_granted_scopes: 'true',
            prompt: 'select_account' // Força seleção de conta
        });

        if (state) {
            params.append('state', state);
        }
        
        // Adicionar PKCE se code_challenge for fornecido
        if (codeChallenge) {
            params.append('code_challenge', codeChallenge);
            params.append('code_challenge_method', 'S256');
        }

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    /**
     * Decodifica HTML entities em uma string
     * @param {string} str - String possivelmente com HTML entities
     */
    decodeHtmlEntities(str) {
        const entities = {
            '&#x2F;': '/',
            '&#x3D;': '=',
            '&#x2B;': '+',
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&#x27;': "'",
            '&#x60;': '`'
        };
        
        let decoded = str;
        for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }
        return decoded;
    }

    /**
     * Troca código de autorização por token de acesso com suporte a PKCE
     * @param {string} code - Código de autorização
     * @param {string} codeVerifier - Code verifier para PKCE (opcional)
     */
    async exchangeCodeForToken(code, codeVerifier = null) {
        if (!this.enabled) {
            throw new Error('Google OAuth não está configurado');
        }

        try {
            console.log('\n🔄 INICIANDO TROCA DE CÓDIGO POR TOKEN');
            console.log(`   Código recebido (raw): ${code.substring(0, 20)}...${code.substring(code.length - 10)} (length: ${code.length})`);
            
            // CORREÇÃO CRÍTICA: Decodificar HTML entities PRIMEIRO
            // O código pode vir HTML-encoded do callback (ex: &#x2F; ao invés de /)
            let cleanCode = this.decodeHtmlEntities(code);
            console.log(`   Código após decode HTML: ${cleanCode.substring(0, 20)}...${cleanCode.substring(cleanCode.length - 10)}`);
            
            // Depois limpar espaços e restaurar + se necessário
            // IMPORTANTE: + pode ser convertido em espaço se o proxy não estiver configurado corretamente
            cleanCode = cleanCode.trim().replace(/\s+/g, '+'); // Restaurar + se foi convertido em espaço
            
            console.log('   Cliente ID:', this.clientId.substring(0, 20) + '...');
            console.log('   Redirect URI:', this.redirectUri);

            // Dados para trocar código por token
            // IMPORTANTE: redirect_uri DEVE ser idêntico ao usado na autorização
            const tokenData = {
                code: cleanCode,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri, // DEVE ser exatamente: https://editaliza.com.br/auth/google/callback
                grant_type: 'authorization_code'
            };
            
            // Adicionar code_verifier se PKCE estiver sendo usado
            if (codeVerifier) {
                tokenData.code_verifier = codeVerifier;
                console.log('   🔒 PKCE ativado - code_verifier incluído');
            }
            
            console.log('   Token Data (sem secret):', {
                code_preview: cleanCode.substring(0, 10) + '...',
                client_id: this.clientId,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code'
            });

            // Fazer requisição para trocar código por token
            // Converter objeto para URLSearchParams para garantir formato correto
            const params = new URLSearchParams(tokenData);
            
            const response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000, // 10 segundos timeout
                validateStatus: null // Não lançar erro automaticamente para status HTTP
            });
            
            // Verificar resposta
            if (response.status !== 200) {
                console.error('❌ Erro na resposta do Google:', {
                    status: response.status,
                    data: response.data
                });
                
                if (response.data?.error === 'invalid_grant') {
                    throw new Error('Código de autorização inválido ou já usado. Por favor, tente novamente.');
                } else if (response.data?.error === 'redirect_uri_mismatch') {
                    throw new Error(`Redirect URI não corresponde. Esperado: ${this.redirectUri}`);
                } else {
                    throw new Error(response.data?.error_description || 'Erro ao trocar código por token');
                }
            }

            console.log('✅ Token obtido com sucesso');
            console.log('   Access Token:', response.data.access_token ? 'OK' : 'AUSENTE');
            console.log('   Token Type:', response.data.token_type);
            console.log('   Expires in:', response.data.expires_in);

            return response.data;
        } catch (error) {
            console.error('\n❌ ERRO NA TROCA DE CÓDIGO POR TOKEN:');
            console.error('   Status:', error.response?.status);
            console.error('   Dados da resposta:', JSON.stringify(error.response?.data, null, 2));
            console.error('   Headers da resposta:', error.response?.headers);
            
            if (error.response?.data?.error === 'invalid_grant') {
                throw new Error('Código de autorização inválido ou expirado. Tente novamente.');
            } else if (error.response?.data?.error === 'invalid_client') {
                throw new Error('Credenciais OAuth inválidas. Verifique a configuração.');
            } else {
                throw new Error(`Erro ao trocar código por token: ${error.message}`);
            }
        }
    }

    /**
     * Obtém informações do usuário usando access token
     */
    async getUserInfo(accessToken) {
        try {
            console.log('\n👤 OBTENDO INFORMAÇÕES DO USUÁRIO');
            
            const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            console.log('✅ Informações do usuário obtidas:');
            console.log('   ID:', response.data.id);
            console.log('   Nome:', response.data.name);
            console.log('   Email:', response.data.email);
            console.log('   Foto:', response.data.picture ? 'SIM' : 'NÃO');
            console.log('   Verificado:', response.data.verified_email ? 'SIM' : 'NÃO');

            return response.data;
        } catch (error) {
            console.error('\n❌ ERRO AO OBTER INFORMAÇÕES DO USUÁRIO:');
            console.error('   Status:', error.response?.status);
            console.error('   Dados:', error.response?.data);
            throw new Error(`Erro ao obter informações do usuário: ${error.message}`);
        }
    }

    /**
     * Processa callback completo do OAuth com suporte a PKCE
     * @param {string} code - Código de autorização
     * @param {string} state - State para validação
     * @param {string} codeVerifier - Code verifier para PKCE
     */
    async processCallback(code, state = null, codeVerifier = null) {
        try {
            console.log('\n🔄 PROCESSANDO CALLBACK OAUTH COMPLETO');
            if (codeVerifier) {
                console.log('   🔒 PKCE ativado');
            }
            
            // 1. Trocar código por token (com PKCE se disponível)
            const tokenData = await this.exchangeCodeForToken(code, codeVerifier);
            
            // 2. Obter informações do usuário
            const userInfo = await this.getUserInfo(tokenData.access_token);
            
            // 3. Verificar se usuário já existe ou criar novo
            let user = await authRepository.findUserByEmail(userInfo.email);
            
            if (user) {
                console.log('✅ Usuário existente encontrado:', userInfo.email);
                
                // Atualizar informações se necessário
                if (!user.name && userInfo.name) {
                    await authRepository.updateUser(user.id, { name: userInfo.name });
                    user.name = userInfo.name;
                }
            } else {
                console.log('🆕 Criando novo usuário:', userInfo.email);
                
                // Criar novo usuário
                const newUserData = {
                    email: userInfo.email,
                    name: userInfo.name || 'Usuário',
                    passwordHash: null, // OAuth user não tem senha
                    currentDate: new Date().toISOString(),
                    oauth_provider: 'google',
                    oauth_id: userInfo.id,
                    profile_photo: userInfo.picture
                };
                
                user = await authRepository.createUser(newUserData);
                console.log('✅ Novo usuário criado com ID:', user.id);
            }
            
            return {
                success: true,
                user: user,
                tokenData: tokenData,
                userInfo: userInfo
            };
            
        } catch (error) {
            console.error('\n❌ ERRO NO PROCESSAMENTO DO CALLBACK:');
            console.error('   Mensagem:', error.message);
            console.error('   Stack:', error.stack);
            
            return {
                success: false,
                error: error.message,
                details: error.stack
            };
        }
    }

    /**
     * Verifica se o serviço está habilitado
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Obtém status do serviço
     */
    getStatus() {
        return {
            enabled: this.enabled,
            clientId: this.clientId ? 'CONFIGURADO' : 'AUSENTE',
            clientSecret: this.clientSecret ? 'CONFIGURADO' : 'AUSENTE',
            redirectUri: this.redirectUri
        };
    }
}

// Instância singleton
const googleOAuthService = new GoogleOAuthService();

module.exports = googleOAuthService;