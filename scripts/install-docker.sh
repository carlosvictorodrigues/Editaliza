#!/bin/bash
# =========================================
# SCRIPT DE INSTALAÇÃO DO DOCKER
# =========================================

set -e

echo "🐳 Instalando Docker..."

# Detectar sistema operacional
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "📋 Detectado: Linux"
    
    # Atualizar repositórios
    sudo apt-get update
    
    # Instalar dependências
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Adicionar chave GPG oficial do Docker
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Configurar repositório estável
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Instalar Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Adicionar usuário ao grupo docker
    sudo usermod -aG docker $USER
    
    echo "✅ Docker instalado com sucesso!"
    echo "⚠️  Faça logout e login novamente para usar o Docker sem sudo"

elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📋 Detectado: macOS"
    
    if command -v brew >/dev/null; then
        echo "🍺 Instalando via Homebrew..."
        brew install --cask docker
    else
        echo "❌ Homebrew não encontrado."
        echo "📥 Baixe o Docker Desktop em: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi
    
    echo "✅ Docker instalado via Homebrew!"
    echo "⚠️  Inicie o Docker Desktop manualmente"

elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows
    echo "📋 Detectado: Windows"
    echo "📥 Para Windows, baixe o Docker Desktop em:"
    echo "   https://www.docker.com/products/docker-desktop/"
    echo "   ou use WSL2 com Ubuntu"
    exit 1

else
    echo "❌ Sistema operacional não suportado: $OSTYPE"
    exit 1
fi

# Verificar instalação
echo "🔍 Verificando instalação..."
sleep 2

if command -v docker >/dev/null; then
    echo "✅ Docker: $(docker --version)"
else
    echo "❌ Docker não encontrado no PATH"
    exit 1
fi

if command -v docker-compose >/dev/null || docker compose version >/dev/null 2>&1; then
    echo "✅ Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)"
else
    echo "❌ Docker Compose não encontrado"
    exit 1
fi

echo ""
echo "🎉 Docker instalado com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Reinicie o terminal"
echo "   2. Execute: make setup"
echo "   3. Configure o arquivo .env"
echo "   4. Execute: make dev"