# 🐳 GUIA DE DEPLOYMENT DOCKER - PROJETO EDITALIZA

## 📋 Visão Geral

Este guia descreve como fazer o deployment do projeto Editaliza usando Docker com configuração multi-stage otimizada para produção.

## 🏗️ Arquitetura Docker

### Multi-Stage Build
- **Stage 1 (Builder)**: Instala dependências e prepara aplicação
- **Stage 2 (Runner)**: Imagem final otimizada para produção

### Especificações Técnicas
- **Base Image**: Node.js 18 Alpine (mínima e segura)
- **Usuário**: `editaliza` (uid: 1001, não-root)
- **Arquiteturas**: AMD64 e ARM64
- **Volumes**: `/app/uploads`, `/app/logs`
- **Healthcheck**: Endpoint `/health`

## 🚀 Deploy Rápido

### 1. Build Local
```bash
# Build simples
docker build -t editaliza:latest .

# Build com cache otimizado
docker build --no-cache -t editaliza:latest .
```

### 2. Build Multi-Arquitetura
```bash
# Criar builder para multi-arch
docker buildx create --use

# Build para AMD64 e ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t editaliza:latest \
  --push .
```

### 3. Deploy com Docker Compose
```bash
# Criar diretórios necessários
mkdir -p data/{uploads,db,logs}

# Deploy completo
docker-compose up -d

# Verificar status
docker-compose ps
docker-compose logs -f editaliza-app
```

## 📁 Estrutura de Volumes

```
./data/
├── uploads/     # Arquivos enviados pelos usuários
├── db/          # Banco SQLite
└── logs/        # Logs da aplicação
```

## 🔧 Configuração de Ambiente

### Variáveis Obrigatórias
```bash
NODE_ENV=production
PORT=3000
TZ=America/Sao_Paulo
```

### Variáveis Opcionais
```bash
APP_PORT=3000                    # Porta externa (docker-compose)
NPM_CONFIG_UPDATE_NOTIFIER=false # Desabilita notificações npm
```

## 🔍 Monitoramento e Health Checks

### Health Check Automático
- **Endpoint**: `http://localhost:3000/health`
- **Intervalo**: 30s
- **Timeout**: 10s
- **Tentativas**: 3

### Comandos de Monitoramento
```bash
# Verificar saúde da aplicação
docker-compose exec editaliza-app curl -f http://localhost:3000/health

# Logs em tempo real
docker-compose logs -f editaliza-app

# Status dos containers
docker-compose ps

# Estatísticas de recursos
docker stats editaliza-production
```

## 🛠️ Comandos Úteis

### Backup do Banco
```bash
# Backup manual
docker-compose exec editaliza-app cp /app/db.sqlite /app/uploads/backup_$(date +%Y%m%d).sqlite

# Backup automático (cron)
0 2 * * * docker-compose exec editaliza-app cp /app/db.sqlite /app/uploads/backup_$(date +%Y%m%d).sqlite
```

### Debugging
```bash
# Acessar container
docker-compose exec editaliza-app sh

# Verificar logs
docker-compose logs --tail=100 editaliza-app

# Reiniciar aplicação
docker-compose restart editaliza-app
```

### Limpeza
```bash
# Parar e remover containers
docker-compose down

# Remover volumes (CUIDADO!)
docker-compose down -v

# Limpar imagens não utilizadas
docker image prune -a
```

## 🔒 Segurança

### Práticas Implementadas
- ✅ Usuário não-root (uid: 1001)
- ✅ Apenas dependências de produção
- ✅ Imagem Alpine (mínima)
- ✅ Permissões adequadas nos volumes
- ✅ Healthcheck configurado
- ✅ Logs limitados (rotação)

### Recomendações Adicionais
```bash
# Usar secrets para dados sensíveis
echo "seu-jwt-secret" | docker secret create jwt_secret -
echo "seu-session-secret" | docker secret create session_secret -

# Configurar firewall
ufw allow 3000/tcp
ufw enable

# SSL/TLS com nginx (recomendado)
# Ver configuração em nginx.conf
```

## 📈 Performance e Recursos

### Limites Configurados
```yaml
resources:
  limits:
    memory: 512M    # Máximo de RAM
    cpus: '0.5'     # Máximo de CPU
  reservations:
    memory: 256M    # RAM garantida
    cpus: '0.25'    # CPU garantida
```

### Otimizações
- Cache de camadas Docker otimizado
- `.dockerignore` configurado
- Logs com rotação automática
- Healthcheck eficiente

## 🐛 Troubleshooting

### Problemas Comuns

**Container não inicia:**
```bash
# Verificar logs
docker-compose logs editaliza-app

# Verificar recursos
docker stats
```

**Health check falhando:**
```bash
# Verificar se aplicação está respondendo
docker-compose exec editaliza-app curl localhost:3000/health

# Verificar configuração de rede
docker network ls
```

**Problemas de permissão:**
```bash
# Verificar ownership dos volumes
ls -la data/

# Corrigir permissões se necessário
sudo chown -R 1001:1001 data/
```

## 🚀 Deploy em Produção

### Checklist Pré-Deploy
- [ ] Variáveis de ambiente configuradas
- [ ] Volumes/diretórios criados
- [ ] Backup do banco atual
- [ ] Firewall configurado
- [ ] SSL/TLS configurado (se aplicável)

### Comandos de Deploy
```bash
# 1. Clone do repositório
git clone <repo-url> editaliza
cd editaliza

# 2. Configuração
mkdir -p data/{uploads,db,logs}
cp .env.example .env
# Editar .env com configurações

# 3. Build e Deploy
docker-compose build --no-cache
docker-compose up -d

# 4. Verificação
docker-compose ps
curl http://localhost:3000/health
```

## 📞 Suporte

Para problemas ou dúvidas sobre o deployment:
1. Verificar logs: `docker-compose logs editaliza-app`
2. Consultar health check: `curl localhost:3000/health`
3. Verificar recursos: `docker stats`

---

**Versão**: 1.0.0  
**Última atualização**: $(date +%Y-%m-%d)  
**Compatibilidade**: Docker 20+, Docker Compose 3.8+