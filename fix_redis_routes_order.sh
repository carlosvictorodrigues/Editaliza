#!/bin/bash

echo "🔧 Corrigindo ordem: Redis → Passport → Rotas..."

cat > /tmp/fix_routes_order.js << 'EOF'
const fs = require('fs');
let content = fs.readFileSync('/root/editaliza/server.js', 'utf8');

// Encontrar onde as rotas auth estão sendo registradas
const authRoutesRegex = /const authRoutes = require[\s\S]*?app\.use\('\/auth', authRoutes\);/g;
const authRoutesCode = content.match(authRoutesRegex);

if (authRoutesCode) {
    // Remover rotas do local atual
    content = content.replace(authRoutesRegex, '// Auth routes movidas para após Redis Session');
    
    // Adicionar rotas DENTRO do callback Redis, após Passport
    content = content.replace(
        "console.log('✅ Passport inicializado com Redis Session');",
        `console.log('✅ Passport inicializado com Redis Session');
        
        // Registrar rotas AUTH após sessão estar pronta
        const authRoutes = require('./src/routes/authRoutes');
        app.use('/auth', authRoutes);
        console.log('✅ Rotas auth registradas com Redis Session');`
    );
}

fs.writeFileSync('/root/editaliza/server.js', content);
console.log('✅ Ordem corrigida: Redis → Passport → Rotas');
EOF

cd /root/editaliza
node /tmp/fix_routes_order.js

echo "🔄 Reiniciando..."
pm2 restart editaliza-app

sleep 3
echo "📋 Verificando:"
pm2 logs editaliza-app --lines 10 --nostream | grep -E "Redis|Passport|Rotas|erro"

echo "✅ Pronto!"