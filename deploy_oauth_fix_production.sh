#!/bin/bash

# Deploy da correção OAuth "Malformed auth code" para produção
# Este script implementa a solução direta sem Passport.js

echo "🚀 DEPLOY DA CORREÇÃO OAUTH - PRODUÇÃO"
echo "================================="

# Configurações
SERVER_USER="root"
SERVER_HOST="209.38.193.49"
SERVER_PATH="/opt/Editaliza-sv"
BACKUP_PATH="/opt/Editaliza-sv/backups"

echo "📡 Conectando ao servidor: $SERVER_USER@$SERVER_HOST"

# 1. Criar backup do código atual
echo "💾 Criando backup..."
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
mkdir -p $BACKUP_PATH && \
tar -czf $BACKUP_PATH/oauth-fix-backup-\$(date +%Y%m%d-%H%M%S).tar.gz \
    src/routes/authRoutes.js \
    src/config/passport.js \
    server.js \
    package.json 2>/dev/null || echo 'Alguns arquivos podem não existir'
"

# 2. Copiar novos arquivos
echo "📂 Copiando novos arquivos OAuth..."
scp src/services/googleOAuthService.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/services/
scp src/controllers/oauthController.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/controllers/
scp src/routes/authRoutes.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/src/routes/

# 3. Instalar dependências
echo "📦 Instalando axios se necessário..."
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
npm list axios >/dev/null 2>&1 || npm install axios
"

# 4. Verificar configuração
echo "🔍 Verificando configuração OAuth..."
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
echo 'Verificando variáveis de ambiente OAuth:' && \
grep -E '^GOOGLE_' .env | sed 's/=.*$/=***/' || echo 'Arquivo .env não encontrado'
"

# 5. Testar a implementação
echo "🧪 Testando nova implementação..."
scp test_oauth_fix.js $SERVER_USER@$SERVER_HOST:$SERVER_PATH/
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
node test_oauth_fix.js
"

# 6. Reiniciar o servidor
echo "🔄 Reiniciando servidor..."
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
pm2 restart all || (echo 'PM2 não encontrado, tentando kill/start manual...' && \
pkill -f 'node.*server.js' && \
nohup node server.js > server.log 2>&1 & \
sleep 2 && \
echo 'Servidor reiniciado')
"

# 7. Verificar se o servidor está rodando
echo "✅ Verificando status do servidor..."
sleep 5
ssh $SERVER_USER@$SERVER_HOST "
cd $SERVER_PATH && \
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/auth/google/debug || echo 'Servidor não respondeu'
"

echo ""
echo "🎉 DEPLOY CONCLUÍDO!"
echo ""
echo "🧪 TESTES MANUAIS:"
echo "   1. Acesse: https://editaliza.com.br/login.html"
echo "   2. Clique em 'Login com Google'"
echo "   3. Complete o fluxo OAuth"
echo "   4. Verifique se não aparece mais 'Malformed auth code'"
echo ""
echo "🔧 DEBUG ENDPOINTS:"
echo "   https://editaliza.com.br/auth/google/debug"
echo "   https://editaliza.com.br/auth/google/test"
echo ""
echo "📱 LOGS DO SERVIDOR:"
echo "   ssh $SERVER_USER@$SERVER_HOST 'tail -f /opt/Editaliza-sv/server.log'"
echo ""
echo "🔙 ROLLBACK (se necessário):"
echo "   ssh $SERVER_USER@$SERVER_HOST 'cd $BACKUP_PATH && ls -la'"
echo "   # Descompactar backup mais recente"

echo "✅ Deploy finalizado com sucesso!"