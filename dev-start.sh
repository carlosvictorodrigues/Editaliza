#!/bin/bash

echo "🚀 Iniciando servidor Editaliza em modo desenvolvimento..."
echo ""

# Verificar se Node.js está disponível
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em: https://nodejs.org/downloads"
    exit 1
fi

# Verificar se nodemon está instalado
if ! command -v nodemon &> /dev/null; then
    echo "📦 Instalando nodemon..."
    npm install -g nodemon
fi

echo "✅ Dependências verificadas"
echo ""
echo "🌐 Servidor rodando em: http://localhost:3000"
echo "🔧 Health check: http://localhost:3000/health"
echo "📊 Dashboard: http://localhost:3000/dashboard.html"
echo ""
echo "🎯 Modo desenvolvimento ativo"
echo "📝 Alterações serão recarregadas automaticamente"
echo ""
echo "Para parar o servidor, pressione Ctrl+C"
echo ""

# Iniciar em modo desenvolvimento
npx nodemon server.js --ignore "*.test.js" --ignore "tests/*" 