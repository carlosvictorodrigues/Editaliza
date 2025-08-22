#!/bin/bash

# 🚀 DEPLOY DO DASHBOARD ADMINISTRATIVO PROFISSIONAL
# Script para deploy no servidor DigitalOcean

set -e  # Parar se houver erro

echo "🛡️  INICIANDO DEPLOY DO ADMIN DASHBOARD"
echo "═══════════════════════════════════════════"

# Configurações
SERVER_IP="161.35.127.123"
SERVER_USER="root"
PROJECT_DIR="/root/editaliza"
ADMIN_PORT="3001"
DOMAIN="admin.editaliza.com.br"

echo "📋 Configurações:"
echo "   Servidor: $SERVER_IP"
echo "   Diretório: $PROJECT_DIR"
echo "   Porta: $ADMIN_PORT"
echo "   Domínio: $DOMAIN"

# Função para executar comando remoto
run_remote() {
    echo "🔧 Executando: $1"
    ssh $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && $1"
}

# 1. Fazer backup do dashboard atual (se existir)
echo ""
echo "💾 Fazendo backup do dashboard atual..."
run_remote "if [ -f admin-dashboard-production.js ]; then cp admin-dashboard-production.js admin-dashboard-backup-\$(date +%Y%m%d_%H%M%S).js; fi"

# 2. Fazer pull das últimas mudanças
echo ""
echo "📥 Atualizando código do repositório..."
run_remote "git pull origin main"

# 3. Instalar/atualizar dependências
echo ""
echo "📦 Instalando dependências..."
run_remote "npm install --production"

# 4. Criar diretório de logs
echo ""
echo "📝 Criando diretório de logs..."
run_remote "mkdir -p logs"

# 5. Configurar variáveis de ambiente
echo ""
echo "⚙️ Configurando variáveis de ambiente..."
run_remote "cat >> .env << 'EOF'

# CONFIGURAÇÕES DO ADMIN DASHBOARD
ADMIN_PORT=$ADMIN_PORT
ADMIN_PASSWORD=Edital@2301
NODE_ENV=production
EOF"

# 6. Configurar PM2 para o dashboard
echo ""
echo "🚀 Configurando PM2 para o dashboard..."
run_remote "cat > ecosystem.admin.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'editaliza-admin-dashboard',
    script: 'admin-dashboard-production.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      ADMIN_PORT: $ADMIN_PORT
    },
    error_file: './logs/admin-dashboard-error.log',
    out_file: './logs/admin-dashboard-out.log',
    log_file: './logs/admin-dashboard-combined.log',
    time: true,
    max_memory_restart: '200M'
  }]
};
EOF"

# 7. Parar dashboard antigo (se estiver rodando)
echo ""
echo "🛑 Parando dashboard antigo..."
run_remote "pm2 delete editaliza-admin-dashboard || true"

# 8. Iniciar novo dashboard
echo ""
echo "🚀 Iniciando novo dashboard..."
run_remote "pm2 start ecosystem.admin.config.js"
run_remote "pm2 save"

# 9. Configurar Nginx para o dashboard
echo ""
echo "🌐 Configurando Nginx para o dashboard..."
run_remote "cat > /etc/nginx/sites-available/admin-dashboard << 'EOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration (usar certificados existentes do domínio principal)
    ssl_certificate /etc/letsencrypt/live/app.editaliza.com.br/fullchain.pem;
    ssl_private_key /etc/letsencrypt/live/app.editaliza.com.br/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options \"DENY\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;

    # Rate Limiting para admin
    limit_req_zone \$binary_remote_addr zone=admin_login:10m rate=5r/m;
    
    location / {
        limit_req zone=admin_login burst=10 nodelay;
        
        proxy_pass http://localhost:$ADMIN_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts para admin dashboard
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Block access to sensitive files
    location ~ /\\. {
        deny all;
        return 404;
    }
    
    location ~* \\.(log|env)$ {
        deny all;
        return 404;
    }
}
EOF"

# 10. Testar configuração Nginx ANTES de aplicar
echo ""
echo "🔍 Testando configuração Nginx..."
run_remote "nginx -t"

if [ $? -eq 0 ]; then
    echo "✅ Configuração Nginx válida. Aplicando..."
    run_remote "ln -sf /etc/nginx/sites-available/admin-dashboard /etc/nginx/sites-enabled/"
    run_remote "systemctl reload nginx"
else
    echo "❌ ERRO na configuração Nginx! Não aplicando mudanças."
    echo "⚠️  Seu site principal permanece intocado e funcionando."
    exit 1
fi

# 11. Verificar se está funcionando
echo ""
echo "🔍 Verificando status do dashboard..."
sleep 3
run_remote "pm2 status editaliza-admin-dashboard"
run_remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:$ADMIN_PORT || echo 'Dashboard não está respondendo'"

echo ""
echo "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "═══════════════════════════════════════"
echo ""
echo "🌐 URL de acesso: https://$DOMAIN"
echo "🔐 Porta local: $ADMIN_PORT"
echo "📊 Dashboard: Operacional"
echo ""
echo "🛡️ PRÓXIMOS PASSOS:"
echo "1. Configurar DNS para $DOMAIN apontar para $SERVER_IP"
echo "2. Definir senha segura na variável ADMIN_PASSWORD no servidor"
echo "3. Testar acesso via https://$DOMAIN"
echo "4. Configurar certificado SSL específico se necessário"
echo ""
echo "📝 LOGS:"
echo "   pm2 logs editaliza-admin-dashboard"
echo "   tail -f $PROJECT_DIR/logs/admin-audit.log"
echo ""
echo "🔧 COMANDOS ÚTEIS:"
echo "   pm2 restart editaliza-admin-dashboard"
echo "   pm2 stop editaliza-admin-dashboard" 
echo "   pm2 monit"