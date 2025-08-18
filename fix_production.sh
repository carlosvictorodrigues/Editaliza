#!/bin/bash

echo "=== Script de Correção do Deploy Editaliza ==="
echo ""

# 1. Parar todos os containers
echo "1. Parando containers..."
docker-compose -f docker-compose.prod.yml down

# 2. Limpar variáveis de ambiente problemáticas
echo "2. Limpando variáveis de ambiente..."
unset NODE_OPTIONS

# 3. Fazer backup do .env atual (se existir)
if [ -f ".env.prod" ]; then
    echo "3. Fazendo backup do .env.prod..."
    cp .env.prod .env.prod.backup.$(date +%Y%m%d_%H%M%S)
fi

# 4. Criar arquivo .env.prod corrigido
echo "4. Criando arquivo .env.prod corrigido..."
cat > .env.prod.tmp << 'EOF'
# Configurações de Segurança
JWT_SECRET=seu_jwt_secret_aqui_32_caracteres_minimo
JWT_REFRESH_SECRET=seu_jwt_refresh_secret_aqui_32_caracteres

# Configurações do Servidor
NODE_ENV=production
PORT=3000
APP_URL=https://editalizaconcursos.com.br

# Configurações de Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@exemplo.com
EMAIL_PASS=sua_senha_de_app

# Configurações de Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Origins
ALLOWED_ORIGINS=https://editalizaconcursos.com.br,https://www.editalizaconcursos.com.br

# Configurações de Sessão
SESSION_SECRET=seu_session_secret_32_caracteres

# Google OAuth Configuration
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_CALLBACK_URL=https://editalizaconcursos.com.br/auth/google/callback

# CACKTO - Pagamentos
CACKTO_API_KEY=sua_api_key
CACKTO_SECRET_KEY=sua_secret_key
CACKTO_WEBHOOK_SECRET=sua_webhook_secret
EOF

echo ""
echo "ATENÇÃO: Arquivo .env.prod.tmp criado com valores de exemplo."
echo "Você precisa editar este arquivo e adicionar as credenciais reais!"
echo ""
echo "Execute: nano .env.prod.tmp"
echo "Adicione as credenciais reais e depois execute:"
echo "mv .env.prod.tmp .env.prod"
echo ""

# 5. Garantir que as pastas necessárias existem
echo "5. Criando pastas necessárias..."
mkdir -p data logs uploads

# 6. Ajustar permissões
echo "6. Ajustando permissões..."
chmod 755 data logs uploads

# 7. Sincronizar com o repositório
echo "7. Sincronizando com o repositório..."
git fetch origin main
git reset --hard origin/main

# 8. Limpar cache do Docker
echo "8. Limpando cache do Docker..."
docker system prune -f

echo ""
echo "=== Instruções Finais ==="
echo ""
echo "1. Edite o arquivo .env.prod.tmp com as credenciais reais:"
echo "   nano .env.prod.tmp"
echo ""
echo "2. Após adicionar as credenciais, renomeie o arquivo:"
echo "   mv .env.prod.tmp .env.prod"
echo ""
echo "3. Rebuild e inicie os containers:"
echo "   docker-compose -f docker-compose.prod.yml up -d --build --force-recreate"
echo ""
echo "4. Verifique os logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "5. Teste a aplicação:"
echo "   curl http://localhost:3000/health"
echo ""