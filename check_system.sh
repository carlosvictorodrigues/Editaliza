#!/bin/bash
# Script para verificar status do sistema

echo "=== STATUS DO SISTEMA EDITALIZA ==="
echo ""
echo "1. Status do PM2:"
ssh root@161.35.127.123 "pm2 list"

echo ""
echo "2. Verificando endpoints principais:"
echo -n "  - editaliza.com.br: "
curl -s -o /dev/null -w "%{http_code}" https://editaliza.com.br
echo ""
echo -n "  - app.editaliza.com.br: "
curl -s -o /dev/null -w "%{http_code}" https://app.editaliza.com.br
echo ""

echo ""
echo "3. Testando registro regular:"
curl -X POST https://editaliza.com.br/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@example.com","password":"Test123456","name":"Test User"}' \
  -s | head -c 100

echo ""
echo ""
echo "=== FIM DO STATUS ==="