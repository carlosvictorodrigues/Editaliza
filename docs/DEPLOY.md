# 🚀 Guia de Deploy - Editaliza

## 📋 Sumário

- [Pré-requisitos](#-pré-requisitos)
- [Configuração de Ambiente](#-configuração-de-ambiente)
- [Deploy Local](#-deploy-local)
- [Deploy em Produção](#-deploy-em-produção)
- [Monitoramento e Logs](#-monitoramento-e-logs)
- [Troubleshooting](#-troubleshooting)
- [Comandos Úteis](#-comandos-úteis)

## 🔧 Pré-requisitos

### Sistema
- **Docker** 20.10+ e **Docker Compose** 2.0+
- **Node.js** 18+ (para desenvolvimento local)
- **Git** para controle de versão

### Verificação
```bash
docker --version
docker-compose --version
node --version
npm --version
```

## ⚙️ Configuração de Ambiente

### 1. Configuração de Desenvolvimento

```bash
# Copiar arquivo de exemplo
npm run deploy:setup

# Editar .env com suas configurações
cp .env.example .env
```

**Variáveis obrigatórias para desenvolvimento:**
```env
SESSION_SECRET=sua_chave_secreta_aqui
JWT_SECRET=sua_jwt_secret_aqui
JWT_REFRESH_SECRET=sua_refresh_secret_aqui
GOOGLE_CLIENT_ID=seu_google_client_id
GOOGLE_CLIENT_SECRET=seu_google_client_secret
```

### 2. Configuração de Produção

```bash
# Copiar arquivo de exemplo de produção
npm run deploy:prod:setup

# Editar .env.prod com configurações de produção
cp .env.prod.example .env.prod
```

**Variáveis obrigatórias para produção:**
```env
NODE_ENV=production
BASE_URL=https://seudominio.com
SESSION_SECRET=chave_super_segura_producao_min_32_chars
JWT_SECRET=jwt_secret_producao_muito_longo_e_seguro_64_chars
JWT_REFRESH_SECRET=refresh_secret_producao_muito_longo_64_chars
GOOGLE_CLIENT_ID=seu_client_id_producao
GOOGLE_CLIENT_SECRET=seu_client_secret_producao
GOOGLE_CALLBACK_URL=https://seudominio.com/auth/google/callback
ALLOWED_ORIGINS=https://seudominio.com,https://www.seudominio.com
```

## 🏠 Deploy Local

### Desenvolvimento com Docker

```bash
# 1. Construir e iniciar containers
npm run compose:up

# 2. Verificar status
docker compose ps

# 3. Ver logs
npm run compose:logs

# 4. Parar containers
npm run compose:down
```

### Desenvolvimento sem Docker

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
npm run deploy:setup

# 3. Iniciar aplicação
npm start
```

## 🌐 Deploy em Produção

### Método 1: Docker Compose (Recomendado)

```bash
# 1. Preparar ambiente de produção
npm run deploy:prod:setup

# 2. Editar .env.prod com configurações reais
nano .env.prod

# 3. Deploy em produção
npm run compose:prod

# 4. Verificar saúde
curl https://seudominio.com/health
```

### Método 2: Artefato Zipado

```bash
# 1. Gerar artefato
npm run build:artifact

# 2. Transferir editaliza-prod.tar.gz para servidor
scp editaliza-prod.tar.gz user@servidor:/opt/editaliza/

# 3. No servidor
cd /opt/editaliza
gunzip < editaliza-prod.tar.gz | docker load
docker-compose -f docker-compose.prod.yml up -d
```

### Estrutura de Diretórios no Servidor

```
/opt/editaliza/
├── .env.prod                    # Configurações de produção
├── docker-compose.prod.yml     # Orquestração
├── data/                       # Banco de dados SQLite
├── uploads/                    # Arquivos enviados
├── logs/                       # Logs da aplicação
└── ssl/                        # Certificados SSL (se usar NGINX)
```

## 📊 Monitoramento e Logs

### Healthchecks

```bash
# Verificar saúde da aplicação
curl http://localhost:3000/health

# Verificar prontidão (K8s ready probe)
curl http://localhost:3000/ready
```

### Logs

```bash
# Ver logs em tempo real
npm run compose:logs

# Logs específicos do container
docker logs editaliza-prod -f

# Logs estruturados em produção (JSON)
docker logs editaliza-prod | jq '.'
```

### Métricas

A aplicação expõe as seguintes métricas via logs:
- **Tempo de resposta** de requisições
- **Status HTTP** de todas as rotas
- **Autenticação** (sucessos/falhas)
- **Queries lentas** do banco (>1s)
- **Erros de aplicação** com stack trace

## 🔍 Troubleshooting

### Problemas Comuns

#### 1. Container não inicia
```bash
# Verificar logs de erro
docker logs editaliza-prod

# Verificar configurações
docker exec editaliza-prod env | grep -E "(NODE_ENV|PORT|DATABASE)"
```

#### 2. Banco de dados não encontrado
```bash
# Verificar volumes
docker volume ls | grep editaliza

# Verificar permissões
docker exec editaliza-prod ls -la /app/data/
```

#### 3. Problemas de conexão
```bash
# Verificar rede
docker network ls
docker inspect editaliza-prod-network

# Verificar portas
netstat -tlnp | grep 3000
```

#### 4. Problemas de OAuth
- Verificar GOOGLE_CALLBACK_URL está correto
- Confirmar domínio autorizado no Google Console
- Validar CLIENT_ID e CLIENT_SECRET

### Logs de Debug

```bash
# Habilitar debug temporariamente
docker exec editaliza-prod node -e "process.env.DEBUG_MODE=true; process.env.LOG_LEVEL=debug"

# Reiniciar container com debug
docker-compose restart editaliza-app
```

## 🛠️ Comandos Úteis

### Docker

```bash
# Build apenas
npm run docker:build

# Build de produção
npm run docker:build:prod

# Executar container standalone
npm run docker:run

# Parar container standalone
npm run docker:stop
```

### Docker Compose

```bash
# Desenvolvimento
npm run compose:up      # Iniciar
npm run compose:down    # Parar
npm run compose:restart # Reiniciar

# Produção
npm run compose:prod         # Deploy produção
npm run compose:prod:down    # Parar produção
```

### Utilitários

```bash
# Verificar saúde
npm run health

# Backup do banco
npm run backup

# Limpar dados de sessão
npm run clean

# Validar tudo
npm run validate:all
```

### Atualizações

```bash
# Atualizar aplicação (zero-downtime básico)
cd /opt/editaliza
git pull origin main
npm run compose:prod:down
npm run compose:prod

# Verificar saúde após deploy
sleep 30
curl https://seudominio.com/health
```

### Backup e Restore

```bash
# Backup completo
docker run --rm -v editaliza_data_prod:/data -v $(pwd):/backup alpine tar czf /backup/editaliza-backup.tar.gz /data

# Restore
docker run --rm -v editaliza_data_prod:/data -v $(pwd):/backup alpine tar xzf /backup/editaliza-backup.tar.gz -C /
```

## 🔐 Configurações de Segurança

### Produção Checklist

- [ ] Secrets únicos e seguros (min 32 chars)
- [ ] HTTPS configurado
- [ ] CORS restrito ao domínio
- [ ] Rate limiting configurado
- [ ] Volumes com backup
- [ ] Logs sendo coletados
- [ ] Healthchecks funcionando
- [ ] Usuário não-root nos containers

### Configuração SSL (NGINX)

```nginx
# /opt/editaliza/nginx/nginx.conf
server {
    listen 443 ssl;
    server_name seudominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://editaliza-app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        proxy_pass http://editaliza-app:3000/health;
        access_log off;
    }
}
```

## 📞 Suporte

Para problemas específicos:
1. Verificar logs da aplicação
2. Consultar este guia de troubleshooting
3. Verificar issues no repositório
4. Contatar suporte técnico

---
**Última atualização:** $(date)
**Versão:** 1.0.0