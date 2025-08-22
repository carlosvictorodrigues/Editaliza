# 🚀 Guia Completo de Deploy - Editaliza

## 📋 Pré-requisitos

### 1. **Servidor/Infraestrutura**
- ✅ Servidor Linux (Ubuntu 20.04+ recomendado)
- ✅ Docker e Docker Compose instalados
- ✅ Domínio configurado (ex: `editaliza.com`)
- ✅ Portas 80, 443 e 3000 liberadas
- ✅ Acesso root/sudo

### 2. **Configurações de Rede**
- ✅ DNS apontando para o servidor
- ✅ Firewall configurado
- ✅ SSL/HTTPS configurado

## 🔧 Configuração Inicial

### Passo 1: Preparar Secrets
```bash
# 1. Criar diretório secrets
mkdir -p secrets

# 2. Gerar secrets seguros
openssl rand -base64 32 > secrets/session_secret.txt
openssl rand -base64 32 > secrets/jwt_secret.txt

# 3. Verificar se foram gerados
cat secrets/session_secret.txt
cat secrets/jwt_secret.txt
```

### Passo 2: Configurar Variáveis de Ambiente
```bash
# 1. Copiar arquivo de exemplo
cp env.production.example .env.production

# 2. Editar configurações
nano .env.production

# 3. Substituir valores obrigatórios:
# - yourdomain.com → seu-dominio.com
# - your-super-secure-session-secret → secret real
# - your-super-secure-jwt-secret → secret real
```

### Passo 3: Configurar SSL (Opcional mas Recomendado)
```bash
# 1. Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 2. Gerar certificado
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# 3. Configurar renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🚀 Deploy

### Opção 1: Deploy Automático (Recomendado)
```bash
# 1. Dar permissão de execução
chmod +x deploy-production.sh

# 2. Executar deploy
./deploy-production.sh deploy

# 3. Verificar status
./deploy-production.sh health-check
```

### Opção 2: Deploy Manual
```bash
# 1. Build da imagem
docker build -t editaliza:latest .

# 2. Executar testes
docker run --rm -e NODE_ENV=test editaliza:latest npm test

# 3. Deploy com Docker Compose
docker-compose up -d

# 4. Verificar logs
docker-compose logs -f
```

## 🔍 Verificação Pós-Deploy

### 1. **Verificar Status dos Containers**
```bash
docker ps
docker-compose ps
```

### 2. **Verificar Logs**
```bash
# Logs da aplicação
docker-compose logs editaliza-app

# Logs do Nginx
docker-compose logs nginx

# Logs do Redis (se configurado)
docker-compose logs redis
```

### 3. **Testar Endpoints**
```bash
# Health check
curl http://localhost:3000/health

# Página inicial
curl http://localhost:3000/

# API
curl http://localhost:3000/api/health
```

### 4. **Verificar SSL (se configurado)**
```bash
# Testar HTTPS
curl -I https://seu-dominio.com

# Verificar certificado
openssl s_client -connect seu-dominio.com:443 -servername seu-dominio.com
```

## 🆘 Solução de Problemas

### Problema: Container não inicia
```bash
# 1. Verificar logs
docker-compose logs editaliza-app

# 2. Verificar variáveis de ambiente
docker-compose config

# 3. Verificar secrets
ls -la secrets/
```

### Problema: Aplicação não responde
```bash
# 1. Verificar se porta está livre
netstat -tulpn | grep :3000

# 2. Verificar firewall
sudo ufw status

# 3. Verificar logs do Nginx
docker-compose logs nginx
```

### Problema: SSL não funciona
```bash
# 1. Verificar certificado
sudo certbot certificates

# 2. Verificar configuração Nginx
sudo nginx -t

# 3. Verificar logs SSL
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Manutenção

### Backup do Banco de Dados
```bash
# Backup automático
docker exec editaliza-production sqlite3 /app/data/database.db ".backup /app/data/backup_$(date +%Y%m%d_%H%M%S).db"

# Backup manual
docker cp editaliza-production:/app/data/database.db ./backup_manual.db
```

### Atualização da Aplicação
```bash
# 1. Fazer pull das mudanças
git pull origin main

# 2. Rebuild e redeploy
./deploy-production.sh deploy

# 3. Verificar se tudo está funcionando
./deploy-production.sh health-check
```

### Rollback
```bash
# Rollback para versão anterior
./deploy-production.sh rollback
```

## 📊 Monitoramento

### Logs em Tempo Real
```bash
# Todos os serviços
docker-compose logs -f

# Apenas aplicação
docker-compose logs -f editaliza-app

# Apenas Nginx
docker-compose logs -f nginx
```

### Métricas de Performance
```bash
# Uso de recursos
docker stats

# Espaço em disco
df -h

# Uso de memória
free -h
```

## 🔒 Segurança

### Checklist de Segurança
- ✅ Secrets configurados e seguros
- ✅ HTTPS/SSL configurado
- ✅ Firewall ativo
- ✅ Rate limiting ativo
- ✅ Headers de segurança configurados
- ✅ CORS configurado corretamente
- ✅ Logs de segurança ativos

### Auditoria de Segurança
```bash
# Verificar vulnerabilidades
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image editaliza:latest

# Verificar configurações de segurança
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy config .
```

## 📞 Suporte

### Contatos de Emergência
- **Desenvolvedor Principal**: [Seu Nome]
- **Email**: [seu-email@dominio.com]
- **Telefone**: [seu-telefone]

### Documentação Adicional
- [Guia de Troubleshooting](./TROUBLESHOOTING.md)
- [Configuração de SSL](./ssl/README.md)
- [Monitoramento](./MONITORING.md)

---

## 🎯 Próximos Passos

1. **Configurar monitoramento** (Prometheus/Grafana)
2. **Implementar CI/CD** (GitHub Actions)
3. **Configurar backup automático**
4. **Implementar alertas**
5. **Configurar CDN** (Cloudflare)
6. **Implementar cache** (Redis)
7. **Configurar logs centralizados**

---

**✅ Deploy concluído com sucesso!**

A aplicação Editaliza está agora rodando em produção em: `https://seu-dominio.com`
