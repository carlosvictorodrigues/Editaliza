#!/bin/bash
# Script completo para corrigir OAuth

echo "=== Corrigindo OAuth Completamente ==="

# 1. Fazer backup dos arquivos originais
echo "1. Criando backups..."
ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv
cp src/config/passport.js src/config/passport.js.bak
cp src/routes/authRoutes.js src/routes/authRoutes.js.bak
cp server.js server.js.bak
EOF

# 2. Copiar arquivo de debug
echo "2. Enviando arquivo de debug..."
scp src/config/passport-debug.js root@161.35.127.123:/opt/Editaliza-sv/src/config/passport.js

# 3. Adicionar mais logging no servidor
echo "3. Adicionando logging no servidor..."
ssh root@161.35.127.123 << 'EOF'
cd /opt/Editaliza-sv

# Adicionar logging no server.js
sed -i '/app.use(passport.initialize/i\
// OAuth Debug Logging\
app.use((req, res, next) => {\
    if (req.path.includes("/auth/google")) {\
        console.log("🔍 OAuth Request:", {\
            path: req.path,\
            query: req.query,\
            session: req.sessionID,\
            headers: {\
                referer: req.get("referer"),\
                origin: req.get("origin")\
            }\
        });\
    }\
    next();\
});' server.js

# Verificar configuração
echo "Verificando variáveis de ambiente:"
grep GOOGLE .env | head -3

# Reiniciar com logs verbose
pm2 delete editaliza-app 2>/dev/null
pm2 start server.js --name editaliza-app --log-date-format "YYYY-MM-DD HH:mm:ss"
pm2 logs editaliza-app --lines 5
EOF

echo "=== Correção aplicada ==="
echo "Teste agora em: https://editaliza.com.br/login.html"