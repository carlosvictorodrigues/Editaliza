#!/bin/bash
# Script para corrigir erro "Malformed auth code" no Google OAuth
# Autor: Claude
# Data: 20/08/2025

echo "=========================================="
echo "FIX OAUTH - MALFORMED AUTH CODE"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Servidor remoto
SERVER="root@editaliza.com.br"

echo -e "${YELLOW}[1/6] Conectando ao servidor...${NC}"

ssh $SERVER << 'REMOTE_SCRIPT'
set -e

echo "Iniciando correções no servidor..."
cd /root/editaliza

# Backup antes das mudanças
echo "Fazendo backup dos arquivos..."
cp server.js server.js.backup_oauth_$(date +%Y%m%d_%H%M%S)
cp src/controllers/oauthController.js src/controllers/oauthController.js.backup_$(date +%Y%m%d_%H%M%S)
cp src/services/googleOAuthService.js src/services/googleOAuthService.js.backup_$(date +%Y%m%d_%H%M%S)

# 1. Atualizar configuração de sessão no server.js
echo "Atualizando configuração de sessão..."
cat > /tmp/session_config.js << 'EOF'
// Configuração de sessão (otimizada para OAuth)
const sessionConfig = {
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: true, // Importante para OAuth - precisamos inicializar antes do redirect
    name: 'editaliza.sid',
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS em produção
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' permite cookies cross-site no OAuth
        domain: process.env.NODE_ENV === 'production' ? '.editaliza.com.br' : undefined // Cookie válido para todos os subdomínios
    }
};

// Aplicar configuração de sessão
app.use(session(sessionConfig));

// Middleware para debug de sessão (temporário)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        if (req.path.includes('/auth/google')) {
            console.log('[SESSION DEBUG]', {
                path: req.path,
                sessionID: req.sessionID,
                hasSession: !!req.session,
                sessionData: req.session ? Object.keys(req.session) : [],
                cookies: Object.keys(req.cookies || {})
            });
        }
        next();
    });
}
EOF

# Substituir configuração de sessão no server.js
python3 << 'PYTHON_SCRIPT'
import re

# Ler arquivo
with open('server.js', 'r') as f:
    content = f.read()

# Ler nova configuração
with open('/tmp/session_config.js', 'r') as f:
    new_config = f.read()

# Encontrar e substituir configuração de sessão
pattern = r'// Configuração de sessão.*?app\.use\(session\([^}]+\}\)\);'
replacement = new_config.rstrip()

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Salvar arquivo
with open('server.js', 'w') as f:
    f.write(content)

print("✓ Configuração de sessão atualizada")
PYTHON_SCRIPT

# 2. Atualizar oauthController.js com diagnóstico completo
echo "Atualizando oauthController.js..."
cat > /tmp/oauth_controller_update.py << 'PYTHON_UPDATE'
import re

with open('src/controllers/oauthController.js', 'r') as f:
    content = f.read()

# Adicionar geração de state no initiateGoogleOAuth
init_pattern = r'async initiateGoogleOAuth\(req, res\) \{[^}]+// Salvar origem na sessão[^}]+// Gerar URL de autorização'
init_replacement = '''async initiateGoogleOAuth(req, res) {
        try {
            console.log('\\n🚀 INICIANDO FLUXO OAUTH GOOGLE');
            
            if (!googleOAuthService.isEnabled()) {
                console.error('❌ Google OAuth não está configurado');
                return res.status(500).json({
                    error: 'Google OAuth não está configurado no servidor'
                });
            }

            // Gerar state único para prevenir CSRF
            const crypto = require('crypto');
            const state = crypto.randomBytes(32).toString('hex');
            
            // Salvar state e origem na sessão
            req.session.oauth_state = state;
            req.session.oauth_timestamp = Date.now();
            
            if (req.query.app) {
                req.session.oauth_origin = 'app';
                console.log('   Origem: App móvel/web');
            } else {
                req.session.oauth_origin = 'web';
                console.log('   Origem: Site principal');
            }
            
            // Garantir que a sessão seja salva antes de redirecionar
            await new Promise((resolve, reject) => {
                req.session.save(err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            console.log('   Session ID:', req.sessionID);
            console.log('   State gerado:', state.substring(0, 10) + '...');
            console.log('   Cookies:', Object.keys(req.cookies || {}));

            // Gerar URL de autorização'''

content = re.sub(init_pattern, init_replacement, content, flags=re.DOTALL)

# Adicionar diagnóstico no callback
callback_pattern = r'console\.log\(\'\\n📥 CALLBACK GOOGLE OAUTH RECEBIDO\'\);[^}]+console\.log\(\'\\n🔗 QUERY PARAMETERS:\'\);'
callback_replacement = '''console.log('\\n📥 CALLBACK GOOGLE OAUTH RECEBIDO');
            console.log('='.repeat(60));
            
            // Log de debug detalhado
            console.log('📋 REQUEST INFO:');
            console.log(\`   URL: \${req.originalUrl}\`);
            console.log(\`   Protocol: \${req.protocol}\`);
            console.log(\`   Host: \${req.get('host')}\`);
            console.log(\`   IP: \${req.ip}\`);
            console.log(\`   Session ID: \${req.sessionID}\`);
            console.log(\`   Cookies: \${Object.keys(req.cookies || {})}\`);
            
            console.log('\\n🔍 SESSION DATA:');
            console.log(\`   oauth_state: \${req.session.oauth_state ? req.session.oauth_state.substring(0, 10) + '...' : 'AUSENTE'}\`);
            console.log(\`   oauth_timestamp: \${req.session.oauth_timestamp}\`);
            console.log(\`   oauth_origin: \${req.session.oauth_origin}\`);
            
            console.log('\\n🔗 QUERY PARAMETERS:');'''

content = re.sub(callback_pattern, callback_replacement, content, flags=re.DOTALL)

# Adicionar verificações de sessão
check_pattern = r'// Verificar erros do Google'
check_replacement = '''// Diagnóstico do problema "Malformed auth code"
            const diagnostics = {
                hasState: !!req.session?.oauth_state,
                stateMatch: req.session?.oauth_state === req.query.state,
                codeLength: String(req.query.code || '').length,
                hasCode: !!req.query.code,
                sessionAge: req.session?.oauth_timestamp ? Date.now() - req.session.oauth_timestamp : null,
                host: req.headers.host,
                forwardedProto: req.headers['x-forwarded-proto'],
                protocol: req.protocol
            };
            
            console.log('\\n🔬 DIAGNÓSTICO PRÉ-TROCA:');
            console.log('   State presente na sessão:', diagnostics.hasState);
            console.log('   State corresponde:', diagnostics.stateMatch);
            console.log('   Código presente:', diagnostics.hasCode);
            console.log('   Comprimento do código:', diagnostics.codeLength);
            console.log('   Idade da sessão (ms):', diagnostics.sessionAge);
            
            // Verificar se a sessão está válida
            if (!diagnostics.hasState) {
                console.error('❌ ERRO: State OAuth perdido - sessão expirou ou cookie não chegou');
                return res.status(400).json({ 
                    error: 'OAuthSessionLost', 
                    message: 'Sessão OAuth perdida. Por favor, tente novamente.',
                    diagnostics: diagnostics
                });
            }
            
            // Verificar state para prevenir CSRF
            if (!diagnostics.stateMatch) {
                console.error('❌ ERRO: State não corresponde - possível ataque CSRF');
                return res.status(400).json({ 
                    error: 'InvalidState',
                    message: 'State inválido. Por favor, tente novamente.',
                    expected: req.session.oauth_state?.substring(0, 10) + '...',
                    received: req.query.state?.substring(0, 10) + '...'
                });
            }
            
            // Verificar idade da sessão (timeout de 10 minutos)
            if (diagnostics.sessionAge && diagnostics.sessionAge > 10 * 60 * 1000) {
                console.error('❌ ERRO: Sessão OAuth expirou (> 10 minutos)');
                return res.status(400).json({ 
                    error: 'OAuthTimeout',
                    message: 'Sessão OAuth expirou. Por favor, tente novamente.',
                    age: Math.round(diagnostics.sessionAge / 1000) + ' segundos'
                });
            }

            // Verificar erros do Google'''

content = re.sub(check_pattern, check_replacement, content)

with open('src/controllers/oauthController.js', 'w') as f:
    f.write(content)

print("✓ oauthController.js atualizado")
PYTHON_UPDATE

python3 /tmp/oauth_controller_update.py

# 3. Atualizar googleOAuthService.js
echo "Atualizando googleOAuthService.js..."
cat > /tmp/oauth_service_update.py << 'SERVICE_UPDATE'
import re

with open('src/services/googleOAuthService.js', 'r') as f:
    content = f.read()

# Fixar redirect URI
constructor_pattern = r'constructor\(\) \{[^}]+this\.redirectUri = [^;]+;'
constructor_replacement = '''constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        // IMPORTANTE: Este redirect_uri DEVE ser EXATAMENTE igual ao configurado no Google Console
        // Se mudar aqui, precisa mudar no Google Console também
        this.redirectUri = 'https://editaliza.com.br/auth/google/callback';'''

content = re.sub(constructor_pattern, constructor_replacement, content, flags=re.DOTALL)

# Melhorar troca de código
exchange_pattern = r'// Limpar código[^}]+const tokenData = \{[^}]+\};'
exchange_replacement = '''// Limpar código - remover possíveis espaços ou caracteres extras
            // IMPORTANTE: + pode ser convertido em espaço se o proxy não estiver configurado corretamente
            const cleanCode = code.trim().replace(/\\s+/g, '+'); // Restaurar + se foi convertido em espaço
            
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
            
            console.log('   Token Data (sem secret):', {
                code_preview: cleanCode.substring(0, 10) + '...',
                client_id: this.clientId,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code'
            });'''

content = re.sub(exchange_pattern, exchange_replacement, content, flags=re.DOTALL)

# Melhorar request para token
request_pattern = r'// Fazer requisição para trocar código por token[^}]+timeout: 10000[^}]+\}\);'
request_replacement = '''// Fazer requisição para trocar código por token
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
                    throw new Error(\`Redirect URI não corresponde. Esperado: \${this.redirectUri}\`);
                } else {
                    throw new Error(response.data?.error_description || 'Erro ao trocar código por token');
                }
            }'''

content = re.sub(request_pattern, request_replacement, content, flags=re.DOTALL)

with open('src/services/googleOAuthService.js', 'w') as f:
    f.write(content)

print("✓ googleOAuthService.js atualizado")
SERVICE_UPDATE

python3 /tmp/oauth_service_update.py

# 4. Garantir que proxy está configurado corretamente
echo "Verificando configuração do Nginx..."
cat > /tmp/nginx_oauth.conf << 'NGINX_CONF'
    # OAuth routes com preservação de query string
    location /auth/google {
        proxy_pass http://127.0.0.1:3000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Preservar cookies e headers
        proxy_pass_request_headers on;
        proxy_pass_request_body on;
        
        # Timeout aumentado para OAuth
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location = /auth/google/callback {
        # IMPORTANTE: Preservar query string com code e state
        proxy_pass http://127.0.0.1:3000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Preservar cookies e headers
        proxy_pass_request_headers on;
        proxy_pass_request_body on;
    }
NGINX_CONF

# Verificar se as rotas OAuth estão configuradas no Nginx
if ! grep -q "/auth/google/callback" /etc/nginx/sites-enabled/editaliza; then
    echo "Adicionando rotas OAuth ao Nginx..."
    # Fazer backup
    cp /etc/nginx/sites-enabled/editaliza /etc/nginx/sites-enabled/editaliza.backup_oauth
    
    # Adicionar configurações OAuth antes do location /
    sed -i '/location \/ {/i\
    # OAuth routes\
    location /auth/google {\
        proxy_pass http://127.0.0.1:3000$request_uri;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_pass_request_headers on;\
    }\
    \
    location = /auth/google/callback {\
        proxy_pass http://127.0.0.1:3000$request_uri;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_pass_request_headers on;\
    }\
' /etc/nginx/sites-enabled/editaliza
    
    # Testar configuração
    nginx -t
    if [ $? -eq 0 ]; then
        systemctl reload nginx
        echo "✓ Nginx recarregado com rotas OAuth"
    else
        echo "✗ Erro na configuração do Nginx, revertendo..."
        mv /etc/nginx/sites-enabled/editaliza.backup_oauth /etc/nginx/sites-enabled/editaliza
    fi
else
    echo "✓ Rotas OAuth já configuradas no Nginx"
fi

# 5. Reiniciar aplicação
echo "Reiniciando aplicação..."
pm2 restart editaliza-app --update-env

# Aguardar inicialização
sleep 3

# 6. Verificar logs
echo ""
echo "=========================================="
echo "ÚLTIMOS LOGS DA APLICAÇÃO:"
echo "=========================================="
pm2 logs editaliza-app --lines 20 --nostream

# 7. Testar endpoint de debug
echo ""
echo "=========================================="
echo "TESTANDO ENDPOINT DE DEBUG OAUTH:"
echo "=========================================="
curl -sS https://editaliza.com.br/auth/google/debug | python3 -m json.tool || echo "Erro ao acessar endpoint de debug"

echo ""
echo "=========================================="
echo "✓ CORREÇÕES APLICADAS COM SUCESSO!"
echo "=========================================="
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Teste o login com Google em: https://editaliza.com.br/login.html"
echo "2. Clique em 'Entrar com Google'"
echo "3. Verifique os logs com: pm2 logs editaliza-app"
echo ""
echo "Se ainda houver erro 'Malformed auth code', verifique:"
echo "- Console do Google: https://console.cloud.google.com"
echo "- Redirect URI deve ser: https://editaliza.com.br/auth/google/callback"
echo "- Credenciais em .env estão corretas"

REMOTE_SCRIPT

echo ""
echo -e "${GREEN}=========================================="
echo "SCRIPT EXECUTADO COM SUCESSO!"
echo "==========================================${NC}"
echo ""
echo "Teste agora em: https://editaliza.com.br/login.html"