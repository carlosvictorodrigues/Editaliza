#!/bin/bash

# ============================================================================
# SCRIPT DE DEPLOY PARA PRODUÇÃO - EDITALIZA
# ============================================================================
# Uso: ./deploy-production.sh [ambiente]
# ============================================================================

set -e

# Configuração
ENVIRONMENT=${1:-production}
APP_NAME="editaliza"
DOCKER_IMAGE="$APP_NAME:latest"
CONTAINER_NAME="$APP_NAME-$ENVIRONMENT"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# ============================================================================
# VERIFICAÇÕES PRÉ-DEPLOY
# ============================================================================

pre_deploy_checks() {
    log "🔍 Executando verificações pré-deploy..."
    
    # Verificar se Docker está rodando
    if ! docker info > /dev/null 2>&1; then
        error "Docker não está rodando. Inicie o Docker e tente novamente."
    fi
    
    # Verificar arquivos obrigatórios
    required_files=("Dockerfile" "package.json" "server.js" "docker-compose.yml")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Arquivo obrigatório não encontrado: $file"
        fi
    done
    
    # Verificar secrets
    if [[ ! -f "secrets/session_secret.txt" ]] || [[ ! -f "secrets/jwt_secret.txt" ]]; then
        error "Secrets não configurados. Execute: ./setup-secrets.sh"
    fi
    
    # Verificar se secrets não são os padrão
    if grep -q "your-super-secure" secrets/session_secret.txt || grep -q "your-super-secure" secrets/jwt_secret.txt; then
        error "Secrets ainda são os padrão. Configure secrets reais antes do deploy."
    fi
    
    # Verificar variáveis de ambiente
    if [[ ! -f ".env.production" ]]; then
        warn "Arquivo .env.production não encontrado. Criando baseado no exemplo..."
        cp env.production.example .env.production
        error "Configure o arquivo .env.production antes de continuar."
    fi
    
    log "✅ Verificações pré-deploy aprovadas"
}

# ============================================================================
# CONFIGURAÇÃO DE SECRETS
# ============================================================================

setup_secrets() {
    log "🔐 Configurando secrets..."
    
    # Criar diretório secrets se não existir
    mkdir -p secrets
    
    # Gerar secrets se não existirem
    if [[ ! -f "secrets/session_secret.txt" ]]; then
        log "Gerando session secret..."
        openssl rand -base64 32 > secrets/session_secret.txt
    fi
    
    if [[ ! -f "secrets/jwt_secret.txt" ]]; then
        log "Gerando JWT secret..."
        openssl rand -base64 32 > secrets/jwt_secret.txt
    fi
    
    log "✅ Secrets configurados"
}

# ============================================================================
# BUILD DA IMAGEM DOCKER
# ============================================================================

build_image() {
    log "🏗️  Construindo imagem Docker..."
    
    # Build da imagem
    docker build -t $DOCKER_IMAGE . || error "Falha ao construir imagem Docker"
    
    # Tag com timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    docker tag $DOCKER_IMAGE "$APP_NAME:$TIMESTAMP"
    
    log "✅ Imagem Docker construída: $DOCKER_IMAGE"
}

# ============================================================================
# EXECUÇÃO DE TESTES
# ============================================================================

run_tests() {
    log "🧪 Executando testes..."
    
    # Executar testes em container
    docker run --rm \
        -v "$(pwd)/tests:/app/tests" \
        -e NODE_ENV=test \
        $DOCKER_IMAGE npm test || error "Testes falharam"
    
    log "✅ Todos os testes passaram"
}

# ============================================================================
# DEPLOY DA APLICAÇÃO
# ============================================================================

deploy_app() {
    log "🚀 Deployando aplicação..."
    
    # Parar container existente se estiver rodando
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        log "Parando container existente..."
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
    fi
    
    # Iniciar nova aplicação
    docker-compose -f docker-compose.yml up -d || error "Falha ao iniciar aplicação"
    
    log "✅ Aplicação deployada com sucesso"
}

# ============================================================================
# VERIFICAÇÃO DE SAÚDE
# ============================================================================

health_check() {
    log "🏥 Verificando saúde da aplicação..."
    
    # Aguardar aplicação inicializar
    sleep 15
    
    # Verificar se container está rodando
    if ! docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        error "Container não está rodando"
    fi
    
    # Verificar saúde da aplicação
    for i in {1..30}; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Verificação de saúde aprovada"
            return 0
        fi
        sleep 2
    done
    
    error "❌ Verificação de saúde falhou - aplicação não responde"
}

# ============================================================================
# LIMPEZA
# ============================================================================

cleanup() {
    log "🧹 Limpando imagens antigas..."
    
    # Remover imagens dangling
    docker image prune -f
    
    # Manter apenas últimas 3 versões
    docker images "$APP_NAME" --format "table {{.Tag}}\t{{.ID}}" | \
        grep -v latest | \
        tail -n +4 | \
        awk '{print $2}' | \
        xargs -r docker rmi
    
    log "✅ Limpeza concluída"
}

# ============================================================================
# ROLLBACK
# ============================================================================

rollback() {
    log "🔄 Fazendo rollback para versão anterior..."
    
    # Obter versão anterior
    PREVIOUS_VERSION=$(docker images "$APP_NAME" --format "{{.Tag}}" | grep -v latest | head -n 1)
    
    if [[ -z "$PREVIOUS_VERSION" ]]; then
        error "Nenhuma versão anterior encontrada para rollback"
    fi
    
    # Parar container atual
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    
    # Iniciar versão anterior
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3000:3000 \
        --env-file .env.production \
        "$APP_NAME:$PREVIOUS_VERSION"
    
    log "✅ Rollback concluído para versão: $PREVIOUS_VERSION"
}

# ============================================================================
# FUNÇÃO PRINCIPAL
# ============================================================================

main() {
    log "🚀 Iniciando processo de deploy para ambiente: $ENVIRONMENT"
    
    case "${1:-deploy}" in
        "deploy")
            pre_deploy_checks
            setup_secrets
            build_image
            run_tests
            deploy_app
            health_check
            cleanup
            log "🎉 Deploy concluído com sucesso!"
            ;;
        "rollback")
            rollback
            ;;
        "health-check")
            health_check
            ;;
        "setup-secrets")
            setup_secrets
            ;;
        *)
            echo "Uso: $0 [deploy|rollback|health-check|setup-secrets]"
            exit 1
            ;;
    esac
}

# Tratamento de interrupção do script
trap 'error "Deploy interrompido"' INT TERM

# Executar função principal
main $@
