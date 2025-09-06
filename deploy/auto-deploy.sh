#!/bin/bash
# Auto-deploy script para Editaliza
# Este script deve ser executado via cron no servidor

REPO_DIR="/root/editaliza"
LOG_FILE="/var/log/editaliza-deploy.log"
DEPLOY_FLAG="/tmp/editaliza-deploy.flag"

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Verificar se já está rodando
if [ -f "$DEPLOY_FLAG" ]; then
    log "Deploy já em execução. Abortando."
    exit 0
fi

# Criar flag
touch "$DEPLOY_FLAG"

# Função de limpeza
cleanup() {
    rm -f "$DEPLOY_FLAG"
}
trap cleanup EXIT

log "Iniciando auto-deploy..."

cd "$REPO_DIR" || {
    log "ERRO: Não foi possível acessar $REPO_DIR"
    exit 1
}

# Verificar se há mudanças no repositório
git fetch origin main > /dev/null 2>&1
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Nenhuma mudança detectada. Abortando deploy."
    exit 0
fi

log "Mudanças detectadas. Iniciando deploy..."

# Fazer backup do estado atual
git stash push -m "Auto-backup $(date '+%Y%m%d_%H%M%S')" > /dev/null 2>&1

# Pull das mudanças
if git pull origin main >> "$LOG_FILE" 2>&1; then
    log "Pull concluído com sucesso"
else
    log "ERRO: Falha no git pull"
    git stash pop > /dev/null 2>&1
    exit 1
fi

# Instalar dependências se package.json mudou
if git diff HEAD@{1} --name-only | grep -q "package.json"; then
    log "package.json modificado. Instalando dependências..."
    npm install --production >> "$LOG_FILE" 2>&1
fi

# Reiniciar aplicação
log "Reiniciando aplicação..."
pm2 restart editaliza-app >> "$LOG_FILE" 2>&1

# Verificar se a aplicação está rodando
sleep 5
if pm2 status | grep -q "editaliza-app.*online"; then
    log "Deploy concluído com sucesso!"
    
    # Enviar notificação (opcional)
    curl -X POST https://app.editaliza.com.br/api/admin/notify \
        -H "Content-Type: application/json" \
        -d "{\"message\":\"Deploy automático realizado com sucesso\",\"commit\":\"$REMOTE\"}" \
        > /dev/null 2>&1
else
    log "ERRO: Aplicação não está online após restart"
    exit 1
fi

log "Auto-deploy finalizado"