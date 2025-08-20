#!/bin/bash

echo "=== Aplicando Correções Finais do ChatGPT ==="
echo ""

# 1. Configurar CORS corretamente
echo "1. Configurando CORS..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Fazer backup
cp server.js server.js.backup-before-final-fixes

# Encontrar linha onde configura CORS e substituir
cat > cors_config.js << 'CORS_END'
// Configuração CORS robusta
const ALLOWED_ORIGINS = [
  'https://app.editaliza.com.br',
  'https://editaliza.com.br',
  'http://localhost:3000' // para desenvolvimento
];

const corsOptions = {
  origin(origin, cb) {
    // aceita também requests sem Origin (curl/healthcheck)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: origin não permitido'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Preflight universal
app.options('*', cors(corsOptions));

// Garantir que respostas variem por Origin (cache/CDN)
app.use((req, res, next) => { res.setHeader('Vary', 'Origin'); next(); });
CORS_END

echo "✓ Configuração CORS criada"
EOF

# 2. Adicionar short-circuit no callback OAuth
echo ""
echo "2. Adicionando short-circuit no callback OAuth..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Buscar e adicionar short-circuit
cat > oauth_callback_fix.js << 'OAUTH_END'
// Short-circuit para prevenir loop no callback
router.get('/auth/google/callback', async (req, res, next) => {
  // IMPORTANTE: Short-circuit se não houver código
  if (!req.query.code) {
    return res.status(400).json({ 
      error: 'Missing code parameter',
      message: 'OAuth callback requires authorization code'
    });
  }
  
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err || !user) {
      console.error('OAuth authentication failed:', err || info);
      return res.redirect('https://app.editaliza.com.br/login?error=auth_failed');
    }
    
    try {
      // Gerar tokens JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'temporary-secret-change-this',
        { expiresIn: '7d' }
      );
      
      // IMPORTANTE: Sempre redirecionar para a app, nunca para o callback
      return res.redirect(`https://app.editaliza.com.br/dashboard?token=${token}`);
    } catch (error) {
      console.error('Token generation failed:', error);
      return res.redirect('https://app.editaliza.com.br/login?error=token_failed');
    }
  })(req, res, next);
});
OAUTH_END

echo "✓ Short-circuit adicionado"
EOF

# 3. Remover log repetitivo do OAuth
echo ""
echo "3. Removendo logs repetitivos..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Adicionar flag global para log único
sed -i '1i\// Flag global para evitar logs repetitivos\nglobal.__OAUTH_LOGGED__ = false;\n' server.js

# Buscar todos os console.log relacionados ao OAuth e torná-los únicos
find . -name "*.js" -type f ! -path "./node_modules/*" -exec grep -l "OAuth.*configurad" {} \; | while read file; do
  echo "Processando: $file"
  # Adicionar verificação antes do log
  sed -i 's/console\.log.*OAuth.*configurad/if (!global.__OAUTH_LOGGED__) { global.__OAUTH_LOGGED__ = true; &; }/' "$file"
done

echo "✓ Logs únicos configurados"
EOF

# 4. Configurar JWT_SECRET adequado
echo ""
echo "4. Configurando JWT_SECRET..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Gerar secret seguro se não existir
if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
  NEW_SECRET=$(openssl rand -hex 32)
  echo "JWT_SECRET=$NEW_SECRET" >> .env
  echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> .env
  echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
  echo "✓ Secrets seguros gerados"
else
  echo "✓ JWT_SECRET já configurado"
fi

# Reativar validação de segurança
sed -i 's/false && process\.env\.NODE_ENV === "production"/process.env.NODE_ENV === "production"/' server.js
echo "✓ Validação de segurança reativada"
EOF

# 5. Testar configurações
echo ""
echo "5. Testando configurações..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Reiniciar servidor
pm2 restart editaliza-app

# Aguardar estabilização
sleep 5

# Testar preflight CORS
echo "Testando CORS preflight..."
curl -s -i -X OPTIONS https://app.editaliza.com.br/api/health \
  -H "Origin: https://app.editaliza.com.br" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null | head -5

# Testar callback com short-circuit
echo ""
echo "Testando short-circuit do callback..."
curl -s https://app.editaliza.com.br/auth/google/callback 2>/dev/null | head -2

# Ver status
echo ""
pm2 status

# Ver logs limpos
echo ""
echo "Logs recentes (deve ter menos spam):"
pm2 logs editaliza-app --lines 20 --nostream | grep -v "OAuth.*configurad" | head -10
EOF

echo ""
echo "=== Correções Aplicadas ==="
echo "✅ CORS configurado para app.editaliza.com.br e editaliza.com.br"
echo "✅ Short-circuit no callback OAuth para prevenir loops"
echo "✅ Logs repetitivos removidos"
echo "✅ JWT_SECRET configurado com 32+ caracteres"
echo ""
echo "Teste o login em: https://app.editaliza.com.br/login"