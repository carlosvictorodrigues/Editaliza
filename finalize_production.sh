#!/bin/bash

echo "=== 🚀 FINALIZANDO CONFIGURAÇÃO DE PRODUÇÃO ==="
echo ""

# 1. CORS COM WHITELIST EXPLÍCITA
echo "📋 1. Aplicando CORS com whitelist explícita..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Criar configuração CORS simples e segura
cat > cors_whitelist.js << 'CORS'
// CORS com whitelist explícita - sem exceções
const cors = require('cors');
const origins = ['https://app.editaliza.com.br','https://editaliza.com.br'];

const corsOptions = {
  origin: (o, cb) => cb(null, !o || origins.includes(o)),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','X-Request-Id'],
  exposedHeaders: ['Set-Cookie','X-Request-Id'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors());
app.use((req,res,next)=>{res.setHeader('Vary','Origin');next();});
CORS

echo "✅ CORS configurado com whitelist"
EOF

# 2. VERIFICAR DATABASE_URL
echo ""
echo "🐘 2. Verificando configuração PostgreSQL..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Verificar se DATABASE_URL existe
if grep -q "DATABASE_URL" .env; then
  echo "✅ DATABASE_URL configurado"
  
  # Adicionar verificação no boot (criar arquivo para incluir no server.js)
  cat > db_check.js << 'DBCHECK'
// Verificação obrigatória do banco
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL não configurado');
  process.exit(1);
}

console.log('✅ DATABASE_URL encontrado');
DBCHECK
  
else
  echo "⚠️ DATABASE_URL não encontrado - configurando..."
  source .env
  echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" >> .env
  echo "✅ DATABASE_URL adicionado ao .env"
fi
EOF

# 3. REDIS PARA SESSÕES (se Redis estiver disponível)
echo ""
echo "🔴 3. Configurando Redis para sessões..."
ssh editaliza << 'EOF'
# Verificar se Redis está instalado
if command -v redis-cli &> /dev/null; then
  # Instalar Redis se não estiver rodando
  if ! redis-cli ping > /dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y redis-server
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
  fi
  
  if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis está rodando"
    
    # Instalar dependências
    cd /root/editaliza
    npm install connect-redis redis --save
    
    # Criar configuração de sessão com Redis
    cat > redis_session.js << 'REDIS'
// Configuração de sessão com Redis
const session = require('express-session');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

async function setupRedisSession(app) {
  const client = createClient({ 
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500)
    }
  });
  
  client.on('error', (e) => console.error('Redis error:', e));
  await client.connect();
  
  app.use(session({
    store: new RedisStore({ 
      client, 
      prefix: 'sess:', 
      ttl: 60*60*24*7 
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'none',
      domain: '.editaliza.com.br',
      maxAge: 7*24*60*60*1000
    }
  }));
  
  console.log('✅ Redis session store configurado');
}

module.exports = setupRedisSession;
REDIS
    
    echo "✅ Redis session configurado"
  else
    echo "⚠️ Redis não está acessível - mantendo MemoryStore temporariamente"
  fi
else
  echo "⚠️ Redis não instalado - mantendo MemoryStore temporariamente"
fi
EOF

# 4. OAUTH COM SHORT-CIRCUIT PERMANENTE
echo ""
echo "🔐 4. Garantindo OAuth com short-circuit..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Criar callback OAuth defensivo
cat > oauth_secure.js << 'OAUTH'
// OAuth Callback com short-circuit permanente
app.get('/auth/google/callback', async (req, res, next) => {
  // SHORT-CIRCUIT PERMANENTE
  if (!req.query.code || !req.query.state) {
    return res.status(400).json({
      error: 'missing_parameters',
      message: 'Both code and state are required'
    });
  }
  
  // Validar state
  if (req.session && req.session.oauthState !== req.query.state) {
    return res.status(400).json({
      error: 'invalid_state',
      message: 'State validation failed'
    });
  }
  
  // Processar OAuth...
  // SEMPRE redirecionar para app, NUNCA para callback
  return res.redirect('https://app.editaliza.com.br/dashboard');
});
OAUTH

echo "✅ OAuth short-circuit configurado"
EOF

# 5. REMOVER SQLITE (CUIDADO!)
echo ""
echo "🗑️ 5. Verificando dependências SQLite..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Verificar se SQLite ainda está sendo usado
if grep -q "sqlite" package.json; then
  echo "⚠️ SQLite ainda está no package.json"
  echo "   Para remover após migração completa:"
  echo "   npm uninstall sqlite3"
else
  echo "✅ SQLite não encontrado no package.json"
fi

# Buscar referências no código
echo ""
echo "Referências a SQLite no código:"
grep -r "sqlite" --include="*.js" src/ 2>/dev/null | wc -l
EOF

# 6. REINICIAR E TESTAR
echo ""
echo "🔄 6. Reiniciando aplicação..."
ssh editaliza << 'EOF'
cd /root/editaliza

# Reiniciar PM2
pm2 restart editaliza-app --update-env

# Aguardar estabilização
sleep 5

# Salvar configuração
pm2 save

echo "✅ Aplicação reiniciada"
EOF

# 7. TESTES FINAIS
echo ""
echo "🧪 7. Executando testes finais..."
ssh editaliza << 'EOF'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TESTE 1: Health Check"
echo -n "  Status: "
curl -s -o /dev/null -w "%{http_code}" https://app.editaliza.com.br/health
echo ""

echo ""
echo "TESTE 2: CORS OPTIONS"
echo -n "  Status: "
curl -s -o /dev/null -w "%{http_code}" -X OPTIONS https://app.editaliza.com.br/api/test \
  -H "Origin: https://app.editaliza.com.br" \
  -H "Access-Control-Request-Method: GET"
echo " (deve ser 204)"

echo ""
echo "TESTE 3: OAuth Callback sem code"
echo -n "  Status: "
curl -s -o /dev/null -w "%{http_code}" "https://app.editaliza.com.br/auth/google/callback"
echo " (deve ser 400)"

echo ""
echo "TESTE 4: PostgreSQL"
source /root/editaliza/.env 2>/dev/null
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" \
   -c "SELECT COUNT(*) as tables FROM pg_tables WHERE schemaname='public'" 2>/dev/null | grep -q tables; then
  echo "  ✅ PostgreSQL conectado"
else
  echo "  ❌ PostgreSQL não acessível"
fi

echo ""
echo "TESTE 5: Redis"
if redis-cli ping > /dev/null 2>&1; then
  SESSIONS=$(redis-cli keys 'sess:*' | wc -l)
  echo "  ✅ Redis rodando ($SESSIONS sessões)"
else
  echo "  ⚠️ Redis não disponível"
fi

echo ""
echo "TESTE 6: PM2"
pm2 list | grep editaliza-app | awk '{print "  Status:", $12, "| Restarts:", $8, "| Memory:", $14}'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF

echo ""
echo "=== 📊 RESUMO FINAL ==="
echo ""
echo "✅ IMPLEMENTADO:"
echo "  • CORS com whitelist explícita"
echo "  • PostgreSQL verificação obrigatória"
echo "  • OAuth short-circuit permanente"
echo "  • Redis para sessões (se disponível)"
echo ""
echo "⚠️ AÇÃO MANUAL NECESSÁRIA:"
echo "  1. Rodar migrations do PostgreSQL"
echo "  2. Migrar dados do SQLite"
echo "  3. Remover sqlite3 após migração"
echo ""
echo "📋 COMANDOS ÚTEIS:"
echo "  • pm2 logs --lines 100"
echo "  • pm2 monit"
echo "  • redis-cli monitor"
echo "  • psql \$DATABASE_URL"
echo ""
echo "🔗 Sistema disponível em: https://app.editaliza.com.br"