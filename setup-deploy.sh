#!/bin/bash

# 🚀 Script de Setup para Deploy - Editaliza
# Este script vai te ajudar a preparar tudo para o deploy

echo "🚀 Bem-vindo ao setup do Editaliza!"
echo "=================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de logging
log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    error "Você precisa estar no diretório do projeto Editaliza!"
    echo "Execute: cd /caminho/para/editaliza"
    exit 1
fi

log "Verificando ambiente..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado!"
    echo "Baixe em: https://nodejs.org/"
    exit 1
fi

# Verificar se Git está instalado
if ! command -v git &> /dev/null; then
    error "Git não está instalado!"
    echo "Baixe em: https://git-scm.com/"
    exit 1
fi

log "✅ Ambiente verificado!"

# Passo 1: Gerar secrets
log "🔐 Gerando secrets seguros..."

# Gerar session secret
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

log "✅ Secrets gerados!"

# Passo 2: Criar arquivo .env
log "📝 Criando arquivo .env..."

if [ -f ".env" ]; then
    warn "Arquivo .env já existe. Fazendo backup..."
    cp .env .env.backup
fi

# Criar arquivo .env
cat > .env << EOF
# ============================================================================
# CONFIGURAÇÕES DE PRODUÇÃO - EDITALIZA
# ============================================================================

# Configurações do Servidor
NODE_ENV=production
PORT=3000
DOMAIN=https://seu-app.railway.app

# Segurança - Secrets (GERADOS AUTOMATICAMENTE)
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# CORS e Origens Permitidas
ALLOWED_ORIGINS=https://seu-app.railway.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logs e Monitoramento
LOG_LEVEL=info
ENABLE_PERFORMANCE_MONITORING=true
HEALTH_CHECK_ENABLED=true
EOF

log "✅ Arquivo .env criado!"

# Passo 3: Criar .gitignore
log "📁 Criando arquivo .gitignore..."

cat > .gitignore << EOF
# Dependências
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Variáveis de ambiente
.env
.env.local
.env.production
.env.test

# Secrets
secrets/
*.key
*.pem

# Banco de dados
db.sqlite
db.sqlite-shm
db.sqlite-wal
sessions.db
*.db

# Logs
logs/
*.log

# Coverage
coverage/
.nyc_output/

# Sistema
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporários
*.tmp
*.temp
EOF

log "✅ Arquivo .gitignore criado!"

# Passo 4: Verificar se é um repositório Git
if [ ! -d ".git" ]; then
    log "🔧 Inicializando repositório Git..."
    git init
    log "✅ Repositório Git inicializado!"
else
    log "✅ Repositório Git já existe!"
fi

# Passo 5: Instalar dependências
log "📦 Instalando dependências..."
npm install
log "✅ Dependências instaladas!"

# Passo 6: Testar aplicação
log "🧪 Testando aplicação..."
if npm test --silent; then
    log "✅ Testes passaram!"
else
    warn "⚠️  Alguns testes falharam, mas continuando..."
fi

# Passo 7: Mostrar próximos passos
echo ""
echo "🎉 SETUP CONCLUÍDO COM SUCESSO!"
echo "================================"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1. 🌐 CRIAR CONTA NO GITHUB:"
echo "   - Acesse: https://github.com/"
echo "   - Crie uma conta"
echo ""
echo "2. 📁 CRIAR REPOSITÓRIO:"
echo "   - Vá para: https://github.com/new"
echo "   - Nome: editaliza"
echo "   - Público ou privado (sua escolha)"
echo "   - NÃO inicialize com README"
echo ""
echo "3. 🚀 SUBIR CÓDIGO:"
echo "   Execute estes comandos:"
echo ""
echo "   git add ."
echo "   git commit -m 'Primeira versão do Editaliza'"
echo "   git remote add origin https://github.com/SEU_USUARIO/editaliza.git"
echo "   git push -u origin main"
echo ""
echo "4. 🎯 DEPLOY NO RAILWAY:"
echo "   - Acesse: https://railway.app/"
echo "   - Faça login com GitHub"
echo "   - Clique em 'New Project'"
echo "   - Selecione 'Deploy from GitHub repo'"
echo "   - Escolha seu repositório editaliza"
echo ""
echo "5. ⚙️  CONFIGURAR VARIÁVEIS:"
echo "   No Railway, adicione estas variáveis:"
echo ""
echo "   NODE_ENV=production"
echo "   PORT=3000"
echo "   SESSION_SECRET=$SESSION_SECRET"
echo "   JWT_SECRET=$JWT_SECRET"
echo "   ALLOWED_ORIGINS=https://seu-app.railway.app"
echo ""
echo "🔗 LINKS ÚTEIS:"
echo "   - GitHub: https://github.com/"
echo "   - Railway: https://railway.app/"
echo "   - Documentação: https://docs.railway.app/"
echo ""
echo "📞 PRECISA DE AJUDA?"
echo "   - Verifique o arquivo DEPLOY_RAILWAY_GUIDE.md"
echo "   - Consulte a documentação do Railway"
echo ""
echo "🎊 BOA SORTE COM O DEPLOY!"
echo ""
