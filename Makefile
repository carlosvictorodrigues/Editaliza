# =========================================
# EDITALIZA - MAKEFILE
# Comandos simplificados para deploy
# =========================================

.PHONY: help setup build dev prod logs stop clean test health

# Configurações
IMAGE_NAME=editaliza
CONTAINER_NAME=editaliza
PORT=3000

## Ajuda
help: ## Mostrar esta ajuda
	@echo "Comandos disponíveis:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Setup inicial
setup: ## Configurar ambiente de desenvolvimento
	@echo "🔧 Configurando ambiente..."
	@cp .env.example .env 2>/dev/null || echo ".env já existe"
	@echo "✅ Configure o arquivo .env antes de continuar"

setup-prod: ## Configurar ambiente de produção
	@echo "🔧 Configurando produção..."
	@cp .env.prod.example .env.prod 2>/dev/null || echo ".env.prod já existe"
	@echo "✅ Configure o arquivo .env.prod antes de fazer deploy"

## Build
build: ## Construir imagem Docker
	@echo "🔨 Construindo imagem..."
	docker build -t $(IMAGE_NAME):latest .

build-prod: ## Construir imagem de produção
	@echo "🔨 Construindo imagem de produção..."
	docker build -t $(IMAGE_NAME):prod --target runner .

## Desenvolvimento
dev: ## Iniciar ambiente de desenvolvimento
	@echo "🚀 Iniciando desenvolvimento..."
	docker-compose up -d
	@echo "✅ Ambiente disponível em http://localhost:$(PORT)"

dev-logs: ## Ver logs de desenvolvimento
	docker-compose logs -f

dev-stop: ## Parar ambiente de desenvolvimento
	@echo "🛑 Parando desenvolvimento..."
	docker-compose down

## Produção
prod: ## Deploy em produção
	@echo "🚀 Deploy em produção..."
	@if [ ! -f .env.prod ]; then echo "❌ Arquivo .env.prod não encontrado. Execute 'make setup-prod' primeiro"; exit 1; fi
	docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
	@echo "✅ Produção iniciada"

prod-logs: ## Ver logs de produção
	docker-compose -f docker-compose.prod.yml logs -f

prod-stop: ## Parar produção
	@echo "🛑 Parando produção..."
	docker-compose -f docker-compose.prod.yml down

## Utilitários
logs: ## Ver logs (development por padrão)
	docker-compose logs -f

stop: ## Parar todos os containers
	@echo "🛑 Parando todos os containers..."
	docker-compose down 2>/dev/null || true
	docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

restart: ## Reiniciar aplicação
	@echo "🔄 Reiniciando..."
	docker-compose restart

restart-prod: ## Reiniciar produção
	@echo "🔄 Reiniciando produção..."
	docker-compose -f docker-compose.prod.yml restart

## Health e Status
health: ## Verificar saúde da aplicação
	@echo "🏥 Verificando saúde..."
	@curl -s http://localhost:$(PORT)/health | jq '.' 2>/dev/null || curl -s http://localhost:$(PORT)/health || echo "❌ Aplicação não está respondendo"

status: ## Status dos containers
	@echo "📊 Status dos containers:"
	@docker-compose ps 2>/dev/null || echo "Nenhum container de desenvolvimento rodando"
	@docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Nenhum container de produção rodando"

## Testes
test: ## Executar testes
	@echo "🧪 Executando testes..."
	npm test

test-full: ## Executar todos os testes
	@echo "🧪 Executando testes completos..."
	npm run test:fortress:full

lint: ## Verificar código
	@echo "🔍 Verificando código..."
	npm run lint

validate: ## Validar projeto completo
	@echo "✅ Validando projeto..."
	npm run validate:all

## Backup
backup: ## Fazer backup do banco
	@echo "💾 Fazendo backup..."
	npm run backup

## Limpeza
clean: ## Limpar dados de desenvolvimento
	@echo "🧹 Limpando..."
	docker-compose down -v 2>/dev/null || true
	docker system prune -f
	@echo "✅ Limpeza concluída"

clean-prod: ## Limpar dados de produção (CUIDADO!)
	@echo "⚠️  Esta operação irá remover TODOS os dados de produção!"
	@echo -n "Tem certeza? Digite 'yes' para confirmar: " && read confirm && [ "$$confirm" = "yes" ]
	docker-compose -f docker-compose.prod.yml down -v
	docker volume rm editaliza_data_prod editaliza_uploads_prod editaliza_logs_prod 2>/dev/null || true
	@echo "✅ Dados de produção removidos"

## Artifact
artifact: ## Gerar artefato para deploy
	@echo "📦 Gerando artefato..."
	npm run build:artifact
	@echo "✅ Artefato editaliza-prod.tar.gz criado"

## Atualização
update: ## Atualizar aplicação (git pull + rebuild)
	@echo "🔄 Atualizando aplicação..."
	git pull origin main
	make build
	make restart
	sleep 5
	make health
	@echo "✅ Atualização concluída"

update-prod: ## Atualizar produção (ZERO DOWNTIME)
	@echo "🔄 Atualizando produção..."
	git pull origin main
	docker-compose -f docker-compose.prod.yml build
	docker-compose -f docker-compose.prod.yml up -d
	sleep 10
	make health
	@echo "✅ Produção atualizada"

## Debug
debug: ## Entrar no container para debug
	@echo "🐛 Entrando no container..."
	docker exec -it editaliza-dev sh 2>/dev/null || docker exec -it editaliza-prod sh

debug-prod: ## Entrar no container de produção
	@echo "🐛 Entrando no container de produção..."
	docker exec -it editaliza-prod sh

## Info
info: ## Informações do sistema
	@echo "📋 Informações do sistema:"
	@echo "Docker version: $$(docker --version)"
	@echo "Docker Compose version: $$(docker-compose --version)"
	@echo "Node.js version: $$(node --version 2>/dev/null || echo 'Node.js não instalado localmente')"
	@echo "Imagens disponíveis:"
	@docker images | grep editaliza || echo "Nenhuma imagem encontrada"
	@echo "Volumes:"
	@docker volume ls | grep editaliza || echo "Nenhum volume encontrado"

## Configuração Docker
docker-setup: ## Configurar Docker (se necessário)
	@echo "🐳 Verificando Docker..."
	@docker --version > /dev/null 2>&1 || (echo "❌ Docker não instalado"; exit 1)
	@docker-compose --version > /dev/null 2>&1 || (echo "❌ Docker Compose não instalado"; exit 1)
	@echo "✅ Docker configurado corretamente"

## Comandos de emergência
emergency-stop: ## Parar TUDO (emergência)
	@echo "🚨 PARANDO TUDO..."
	docker stop $$(docker ps -aq) 2>/dev/null || true
	docker-compose down 2>/dev/null || true
	docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

emergency-logs: ## Logs de emergência (últimas 50 linhas)
	@echo "🚨 LOGS DE EMERGÊNCIA:"
	docker-compose logs --tail=50 2>/dev/null || echo "Sem logs de desenvolvimento"
	docker-compose -f docker-compose.prod.yml logs --tail=50 2>/dev/null || echo "Sem logs de produção"