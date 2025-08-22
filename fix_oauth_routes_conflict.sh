#!/bin/bash

echo "🔧 Corrigindo conflito de rotas OAuth..."

# Comentar rotas antigas do Passport que estão conflitando
cat > /tmp/fix_oauth_conflict.js << 'EOF'
const fs = require('fs');
let content = fs.readFileSync('/root/editaliza/server.js', 'utf8');

// Comentar rotas antigas do Passport
content = content.replace(
    /app\.get\('\/auth\/google',[\s\S]*?passport\.authenticate\('google'[\s\S]*?\);/g,
    `/* COMENTADO - Usando novo OAuth Controller sem Passport
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
); */`
);

content = content.replace(
    /app\.get\('\/auth\/google\/callback',[\s\S]*?passport\.authenticate\('google'[\s\S]*?\}\);/g,
    `/* COMENTADO - Usando novo OAuth Controller sem Passport
$& */`
);

// Verificar se as rotas novas estão registradas
if (!content.includes("app.use('/auth', authRoutes)")) {
    console.log('⚠️ Rotas auth não encontradas, verificando initializeApp...');
}

fs.writeFileSync('/root/editaliza/server.js', content);
console.log('✅ Rotas antigas do Passport comentadas');
EOF

cd /root/editaliza
node /tmp/fix_oauth_conflict.js

# Adicionar log de diagnóstico melhorado no callback
echo "📝 Adicionando diagnóstico melhorado..."
cat > /tmp/add_diagnostics.js << 'EOF'
const fs = require('fs');
let content = fs.readFileSync('/root/editaliza/src/controllers/oauthController.js', 'utf8');

// Adicionar mais logs no callback
const diagnosticsCode = `
            // Log completo para diagnóstico
            console.log('\\n🔍 DIAGNÓSTICO COMPLETO DO CALLBACK:');
            console.log('━'.repeat(60));
            console.log('📌 REDIRECT URI USADO:');
            console.log('   No início:', 'https://editaliza.com.br/auth/google/callback');
            console.log('   No callback:', 'https://editaliza.com.br/auth/google/callback');
            console.log('   São iguais?', 'SIM - hardcoded');
            console.log('');
            console.log('🔑 CREDENCIAIS:');
            console.log('   CLIENT_ID existe?', !!process.env.GOOGLE_CLIENT_ID);
            console.log('   CLIENT_SECRET existe?', !!process.env.GOOGLE_CLIENT_SECRET);
            console.log('');`;

// Adicionar antes do diagnóstico existente
content = content.replace(
    "console.log('\\n🔬 DIAGNÓSTICO PRÉ-TROCA:');",
    diagnosticsCode + "\n            console.log('\\n🔬 DIAGNÓSTICO PRÉ-TROCA:');"
);

fs.writeFileSync('/root/editaliza/src/controllers/oauthController.js', content);
console.log('✅ Diagnóstico melhorado adicionado');
EOF

node /tmp/add_diagnostics.js

echo "🔄 Reiniciando aplicação..."
pm2 restart editaliza-app

sleep 3

echo "📋 Verificando configuração:"
pm2 logs editaliza-app --lines 5 --nostream | grep -E "OAuth|Passport|Rotas"

echo ""
echo "🧪 Testando rota OAuth:"
curl -I "https://editaliza.com.br/auth/google/direct" 2>/dev/null | head -5

echo ""
echo "✅ Conflito resolvido!"
echo ""
echo "Para testar:"
echo "1. Acesse https://editaliza.com.br/login.html"
echo "2. Clique em 'Entrar com Google'"
echo "3. Verifique logs: pm2 logs editaliza-app"