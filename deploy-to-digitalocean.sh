#!/bin/bash

# Script de Deploy Simplificado para DigitalOcean
# ================================================

echo "🚀 Deploy Editaliza para DigitalOcean"
echo "====================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Parar containers existentes
echo -e "${YELLOW}1. Parando containers existentes...${NC}"
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# 2. Limpar cache e containers órfãos
echo -e "${YELLOW}2. Limpando cache Docker...${NC}"
docker system prune -f

# 3. Fazer pull das últimas alterações
echo -e "${YELLOW}3. Sincronizando com GitHub...${NC}"
git fetch origin main
git reset --hard origin/main

# 4. Verificar se .env.prod existe
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Arquivo .env.prod não encontrado!${NC}"
    echo ""
    echo "Criando .env.prod a partir do exemplo..."
    cp .env.prod.example .env.prod
    echo -e "${YELLOW}⚠️  IMPORTANTE: Edite .env.prod com suas credenciais reais!${NC}"
    echo "Execute: nano .env.prod"
    exit 1
fi

# 5. Verificar variáveis críticas no .env.prod
echo -e "${YELLOW}4. Verificando configurações...${NC}"
if grep -q "GERAR_STRING_ALEATORIA\|SEU_\|SUA_\|SENHA_DE_APP_DO_GMAIL" .env.prod; then
    echo -e "${RED}❌ .env.prod contém valores de exemplo!${NC}"
    echo "Por favor, edite .env.prod com credenciais reais."
    echo "Execute: nano .env.prod"
    exit 1
fi

# 6. Criar diretórios necessários
echo -e "${YELLOW}5. Criando diretórios necessários...${NC}"
mkdir -p data logs uploads
chmod 755 data logs uploads

# 7. Build da imagem de produção
echo -e "${YELLOW}6. Construindo imagem Docker de produção...${NC}"
docker build -f Dockerfile.prod -t editaliza:prod .

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no build da imagem Docker!${NC}"
    exit 1
fi

# 8. Executar containers
echo -e "${YELLOW}7. Iniciando aplicação...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 9. Aguardar inicialização
echo -e "${YELLOW}8. Aguardando inicialização (30s)...${NC}"
sleep 30

# 10. Verificar saúde da aplicação
echo -e "${YELLOW}9. Verificando saúde da aplicação...${NC}"
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Aplicação rodando com sucesso!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
    echo ""
    echo "Acesse:"
    echo "  - Local: http://localhost:3000"
    echo "  - Produção: https://editalizaconcursos.com.br"
    echo ""
    echo "Comandos úteis:"
    echo "  - Ver logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  - Status: docker-compose -f docker-compose.prod.yml ps"
    echo "  - Parar: docker-compose -f docker-compose.prod.yml down"
else
    echo -e "${RED}❌ Aplicação não está respondendo!${NC}"
    echo ""
    echo "Verificando logs..."
    docker-compose -f docker-compose.prod.yml logs --tail=50
    echo ""
    echo -e "${YELLOW}Tente:${NC}"
    echo "  1. Verificar logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  2. Verificar .env.prod: nano .env.prod"
    echo "  3. Reiniciar: docker-compose -f docker-compose.prod.yml restart"
    exit 1
fi

# 11. Mostrar uso de recursos
echo -e "${YELLOW}10. Uso de recursos:${NC}"
docker stats --no-stream editaliza-prod

echo ""
echo -e "${GREEN}✨ Deploy finalizado!${NC}"