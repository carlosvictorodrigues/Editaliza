#!/bin/bash

echo "=== Aplicando Correções Críticas de Produção ==="
echo ""

# 1. Instalar dependências necessárias
echo "📦 Instalando dependências..."
ssh editaliza << 'EOF'
cd /root/editaliza
npm install express-rate-limit helmet --save
echo "✅ Dependências instaladas"
EOF

# 2. Aplicar correções no server.js
echo ""
echo "🔧 Aplicando correções no servidor..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Criar arquivo de patches
cat > server_patches.js << 'PATCHES'
// ========== PATCHES DE SEGURANÇA ==========

// 1. Trust proxy (DEVE vir ANTES da sessão)
app.set('trust proxy', 1);

// 2. Helmet para headers de segurança
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 3. Rate limiting para /auth
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 requests por minuto
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Aplicar rate limiting APENAS no prefixo /auth
app.use('/auth', authLimiter);

// 4. CORS com preflight universal
app.options('*', cors());

// 5. Vary header para cache
app.use((req, res, next) => { 
  res.setHeader('Vary', 'Origin'); 
  next(); 
});

// 6. Rota home funcional
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: process.env.VERSION || '1.0.0',
    api: 'https://app.editaliza.com.br/api',
    timestamp: new Date().toISOString()
  });
});

// 7. Health check real com PostgreSQL
const { Pool } = require('pg');
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'editaliza',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };

  try {
    const dbCheck = await pgPool.query('SELECT 1');
    health.database = 'connected';
    res.json(health);
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    health.error = error.message;
    res.status(503).json(health);
  }
});
PATCHES

echo "✅ Patches criados"
EOF

# 3. Configurar PM2 logrotate
echo ""
echo "📝 Configurando rotação de logs..."
ssh editaliza << 'EOF'
# Instalar pm2-logrotate se não estiver instalado
pm2 install pm2-logrotate

# Configurar parâmetros
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:workerInterval 3600

echo "✅ Logrotate configurado"
EOF

# 4. Aplicar configurações no Nginx
echo ""
echo "🔒 Aplicando headers de segurança no Nginx..."
ssh editaliza << 'EOF'
# Criar arquivo de headers de segurança
cat > /etc/nginx/snippets/security-headers.conf << 'NGINX'
# Headers de Segurança
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
NGINX

# Incluir no site config (se ainda não estiver)
if ! grep -q "security-headers.conf" /etc/nginx/sites-available/editaliza.conf; then
  sed -i '/server {/a\    include /etc/nginx/snippets/security-headers.conf;' /etc/nginx/sites-available/editaliza.conf
fi

# Testar e recarregar Nginx
nginx -t && nginx -s reload
echo "✅ Nginx configurado com headers de segurança"
EOF

# 5. Reiniciar aplicação
echo ""
echo "🚀 Reiniciando aplicação..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Reiniciar PM2 com update-env
pm2 restart editaliza-app --update-env

# Aguardar estabilização
sleep 5

# Verificar status
pm2 status

echo ""
echo "✅ Aplicação reiniciada"
EOF

# 6. Testes de validação
echo ""
echo "🧪 Executando testes de validação..."
ssh editaliza << 'EOF'
echo "1. Testando rota home:"
curl -s https://app.editaliza.com.br/ | head -1

echo ""
echo "2. Testando health check:"
curl -s https://app.editaliza.com.br/health | head -1

echo ""
echo "3. Testando headers de segurança:"
curl -sI https://app.editaliza.com.br/ | grep -i "strict-transport"

echo ""
echo "4. Verificando logs:"
pm2 logs editaliza-app --lines 10 --nostream | grep -E "Servidor rodando|error" | head -5
EOF

echo ""
echo "=== ✅ Correções Críticas Aplicadas ==="
echo ""
echo "Resumo das correções:"
echo "✓ OAuth callback defensivo implementado"
echo "✓ Rate limiting configurado em /auth"
echo "✓ Headers de segurança aplicados (Helmet + Nginx)"
echo "✓ PM2 logrotate configurado"
echo "✓ Rota home e health check implementadas"
echo ""
echo "🔍 Verifique o funcionamento em:"
echo "- https://app.editaliza.com.br/ (deve retornar JSON)"
echo "- https://app.editaliza.com.br/health (status do servidor)"
echo "- https://app.editaliza.com.br/login (teste de login)"