#!/bin/bash

# Corrigir ordem de inicialização: Redis Session deve vir antes do Passport

echo "🔧 Corrigindo ordem de inicialização do Redis Session..."

# Criar novo patch
cat > /tmp/fix_session_order.js << 'EOF'
const fs = require('fs');

let content = fs.readFileSync('/root/editaliza/server.js', 'utf8');

// Encontrar onde passport está sendo inicializado
const passportInitRegex = /app\.use\(passport\.initialize\(\)\);[\s\S]*?app\.use\(passport\.session\(\)\);/;
const passportInit = content.match(passportInitRegex);

if (passportInit) {
    // Remover passport init do local atual
    content = content.replace(passportInitRegex, '// Passport será inicializado após Redis Session');
    
    // Adicionar passport init dentro do callback Redis
    content = content.replace(
        "console.log('✅ Redis Sessions ativado');",
        `console.log('✅ Redis Sessions ativado');
        
        // Inicializar Passport APÓS Redis Session estar pronto
        app.use(passport.initialize());
        app.use(passport.session());
        console.log('✅ Passport inicializado com Redis Session');`
    );
    
    // Também adicionar no fallback
    content = content.replace(
        "console.warn('⚠️ Usando sessão em memória como fallback');",
        `console.warn('⚠️ Usando sessão em memória como fallback');
        
        // Inicializar Passport mesmo com fallback
        app.use(passport.initialize());
        app.use(passport.session());`
    );
}

fs.writeFileSync('/root/editaliza/server.js', content);
console.log('✅ Ordem de inicialização corrigida');
EOF

# Executar patch
cd /root/editaliza
node /tmp/fix_session_order.js

# Reiniciar aplicação
echo "🔄 Reiniciando aplicação..."
pm2 restart editaliza-app

sleep 3

# Verificar logs
echo "📋 Verificando inicialização:"
pm2 logs editaliza-app --lines 10 --nostream | grep -E "Redis|Passport|session"

echo "✅ Correção aplicada!"