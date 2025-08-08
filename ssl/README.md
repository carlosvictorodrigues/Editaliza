# Configuração SSL/HTTPS para Editaliza

## 📋 Pré-requisitos

1. **Domínio configurado** apontando para o servidor
2. **Acesso root** ao servidor
3. **Portas 80 e 443** liberadas no firewall

## 🔐 Opções de SSL

### Opção 1: Let's Encrypt (Recomendado - Gratuito)

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Renovar automaticamente
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Opção 2: Certificado Comercial

1. Comprar certificado SSL
2. Fazer upload dos arquivos:
   - `cert.pem` → `/etc/nginx/ssl/cert.pem`
   - `key.pem` → `/etc/nginx/ssl/key.pem`

## 🚀 Deploy com SSL

```bash
# 1. Configurar domínio
sudo nano /etc/hosts
# Adicionar: yourdomain.com

# 2. Configurar Nginx
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx

# 3. Deploy da aplicação
./deploy.sh
```

## 🔍 Verificação

```bash
# Testar SSL
curl -I https://yourdomain.com

# Verificar certificado
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

## 🆘 Solução de Problemas

### Certificado não encontrado
```bash
# Verificar caminhos no nginx.conf
sudo nginx -t
sudo systemctl status nginx
```

### Redirecionamento não funciona
```bash
# Verificar configuração do servidor HTTP
sudo tail -f /var/log/nginx/error.log
```
