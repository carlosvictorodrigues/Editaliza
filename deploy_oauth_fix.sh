#!/bin/bash
# Script para enviar correção OAuth ao servidor

echo "Enviando arquivo corrigido para o servidor..."
scp src/routes/authRoutes.js root@161.35.127.123:/opt/Editaliza-sv/src/routes/authRoutes.js

echo "Reiniciando servidor..."
ssh root@161.35.127.123 "cd /opt/Editaliza-sv && pm2 restart editaliza-app"

echo "Deploy concluído!"