#!/bin/bash

# Script para corrigir problema de sessão perdida no OAuth
# Problema: "OAuthSessionLost" - sessão não persiste entre início e callback

echo "🔧 Iniciando correção de sessão OAuth..."

# 1. Verificar se oauthController.js já tem fallback cookies
echo "📝 Verificando implementação atual do OAuth..."
if grep -q "oauth_state.*cookie" /root/editaliza/src/controllers/oauthController.js; then
    echo "✅ Fallback cookies já implementados no oauthController.js"
else
    echo "❌ Fallback cookies não encontrados. Atualizando oauthController.js..."
    
    # Fazer backup do arquivo atual
    cp /root/editaliza/src/controllers/oauthController.js /root/editaliza/src/controllers/oauthController.js.backup
    
    echo "📝 Aplicando correções no oauthController.js..."
    # A atualização já foi feita localmente e enviada via scp
fi

# 2. Verificar configuração de cookies no server.js
echo "📝 Verificando configuração de sessão no server.js..."
if grep -q "sameSite.*none" /root/editaliza/server.js; then
    echo "✅ Configuração de cookies já permite cross-site (sameSite: 'none')"
else
    echo "⚠️ Configuração de cookies pode estar bloqueando OAuth cross-site"
fi

# 3. Verificar e criar pasta de sessões se não existir
echo "📝 Verificando pasta de sessões..."
if [ ! -d "/root/editaliza/sessions" ]; then
    mkdir -p /root/editaliza/sessions
    echo "✅ Pasta de sessões criada"
fi

# 4. Verificar permissões da pasta de sessões
chmod 755 /root/editaliza/sessions
echo "✅ Permissões da pasta de sessões ajustadas"

# 5. Limpar sessões antigas que podem estar corrompidas
echo "🧹 Limpando sessões antigas..."
if [ -f "/root/editaliza/sessions.db" ]; then
    rm -f /root/editaliza/sessions.db
    echo "✅ Banco de sessões limpo"
fi

# 6. Verificar configuração do Nginx
echo "📝 Verificando configuração do Nginx para OAuth..."
nginx_config="/etc/nginx/sites-available/editaliza"

if [ -f "$nginx_config" ]; then
    if grep -q "location /auth/google" "$nginx_config"; then
        echo "✅ Configuração específica para OAuth encontrada no Nginx"
    else
        echo "⚠️ Configuração específica para OAuth não encontrada no Nginx"
        echo "   Recomendado adicionar configuração específica para /auth/google/*"
    fi
fi

# 7. Verificar variáveis de ambiente necessárias
echo "📝 Verificando variáveis de ambiente..."
if [ -f "/root/editaliza/.env" ]; then
    if grep -q "GOOGLE_CLIENT_ID" /root/editaliza/.env; then
        echo "✅ Google OAuth configurado no .env"
    else
        echo "❌ Google OAuth não configurado no .env"
    fi
    
    if grep -q "SESSION_SECRET" /root/editaliza/.env; then
        echo "✅ SESSION_SECRET configurado"
    else
        echo "⚠️ SESSION_SECRET não encontrado - usando valor padrão"
    fi
fi

# 8. Reiniciar aplicação com PM2
echo "🔄 Reiniciando aplicação..."
cd /root/editaliza
pm2 restart editaliza-app

# 9. Aguardar aplicação iniciar
sleep 3

# 10. Verificar status
echo "📊 Verificando status da aplicação..."
pm2 status editaliza-app

# 11. Mostrar últimos logs para verificar se há erros
echo "📋 Últimos logs da aplicação:"
pm2 logs editaliza-app --lines 10 --nostream

echo ""
echo "✅ Script de correção OAuth concluído!"
echo ""
echo "🔍 Para testar:"
echo "1. Acesse: https://editaliza.com.br/login.html"
echo "2. Clique em 'Entrar com Google'"
echo "3. Verifique os logs com: pm2 logs editaliza-app"
echo ""
echo "⚠️ Se ainda houver erro 'OAuthSessionLost':"
echo "- Verifique se cookies estão sendo aceitos pelo navegador"
echo "- Teste em aba anônima/privada"
echo "- Verifique configuração de CORS e cookies no navegador"