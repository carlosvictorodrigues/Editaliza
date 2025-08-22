#!/bin/bash
# Corrigir configuração de sessão para OAuth

echo "=== Corrigindo Sessão e OAuth ==="

ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv

# Adicionar configuração de sessão mais robusta
cat > /tmp/session_fix.js << 'SESSFIX'
// Adicionar antes do passport.initialize()

// Configuração de sessão mais robusta para OAuth
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'editaliza-session-secret-2024',
    resave: true,  // Mudando para true para OAuth
    saveUninitialized: true,  // Mudando para true para OAuth
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'  // Importante para OAuth cross-domain
    },
    name: 'editaliza.sid'
};

app.use(session(sessionConfig));
SESSFIX

# Fazer backup e aplicar correção
cp server.js server.js.bak2

# Remover configuração de sessão antiga e adicionar nova
sed -i '/app.use(session({/,/}));/d' server.js
sed -i '/app.use(passport.initialize/i\
// Configuração de sessão robusta para OAuth\
const sessionConfig = {\
    secret: process.env.SESSION_SECRET || "editaliza-session-secret-2024",\
    resave: true,\
    saveUninitialized: true,\
    cookie: {\
        secure: process.env.NODE_ENV === "production",\
        httpOnly: true,\
        maxAge: 24 * 60 * 60 * 1000,\
        sameSite: "lax"\
    },\
    name: "editaliza.sid"\
};\
app.use(session(sessionConfig));' server.js

# Adicionar trust proxy para funcionar com Nginx
sed -i '/const app = express/a\
// Trust proxy - necessário para OAuth com Nginx\
app.set("trust proxy", 1);' server.js

# Verificar se as mudanças foram aplicadas
echo "=== Verificando configurações aplicadas ==="
grep -A5 "sessionConfig" server.js | head -10
grep "trust proxy" server.js

# Reiniciar o servidor
pm2 restart editaliza-app

echo "=== Aguardando servidor iniciar ==="
sleep 3
pm2 logs editaliza-app --lines 10 --nostream

EOF

echo "=== Correção de sessão aplicada ==="