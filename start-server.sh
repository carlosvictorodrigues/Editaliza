#!/bin/bash

echo "�� Iniciando servidor Editaliza..."
echo ""
echo "📋 Verificando dependências..."

# Verificar se Node.js está disponível
if command -v node &> /dev/null; then
    echo "✅ Node.js encontrado"
    echo ""
    echo "🌐 Servidor rodando em: http://localhost:3000"
    echo "🖼️ Teste de avatares: http://localhost:3000/test-server.html"
    echo "👤 Página de perfil: http://localhost:3000/profile.html"
    echo "📊 Dashboard: http://localhost:3000/dashboard.html"
    echo ""
    echo "🔧 Health check: http://localhost:3000/health"
    echo ""
    echo "Para parar o servidor, pressione Ctrl+C"
    echo ""
    
    # Verificar se as dependências estão instaladas
    if [ ! -d "node_modules" ]; then
        echo "📦 Instalando dependências..."
        npm install
        echo ""
    fi
    
    echo "🎯 Iniciando servidor Express..."
    node server.js
else
    echo "❌ Node.js não encontrado."
    echo ""
    echo "📋 SOLUÇÕES POSSÍVEIS:"
    echo "1. Instale Node.js: https://nodejs.org/downloads"
    echo "2. Use uma extensão do VS Code como 'Live Server'"
    echo "3. Use outro servidor HTTP local de sua preferência"
    echo ""
    echo "💡 Comandos alternativos:"
    echo "• python3 -m http.server 3000 (se Python estiver instalado)"
    echo "• php -S localhost:3000 (se PHP estiver instalado)"
    echo "• ruby -run -e httpd . -p 3000 (se Ruby estiver instalado)"
    echo ""
    exit 1
fi