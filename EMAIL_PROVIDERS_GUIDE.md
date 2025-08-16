# 📧 Guia de Configuração de Provedores de Email - Editaliza

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Recomendações por Fase](#recomendações-por-fase)
3. [Configuração por Provedor](#configuração-por-provedor)
4. [Monitoramento e Logs](#monitoramento-e-logs)
5. [Solução de Problemas](#solução-de-problemas)

## 🎯 Visão Geral

O sistema Editaliza suporta múltiplos provedores de email para garantir alta disponibilidade e escalabilidade. Este guia ajudará você a escolher e configurar o melhor provedor para suas necessidades.

### Provedores Suportados:
- **Gmail** (atual) - Desenvolvimento e baixo volume
- **SendGrid** - Recomendado para produção inicial
- **Amazon SES** - Melhor custo-benefício para alto volume
- **Mailgun** - Alternativa confiável
- **Elastic Email** - Opção econômica
- **Microsoft 365/Outlook** - Integração corporativa
- **SMTP Genérico** - Servidores próprios

## 🚀 Recomendações por Fase

### 🔧 Desenvolvimento
```env
EMAIL_PROVIDER=gmail
EMAIL_USER=seu_email@exemplo.com
EMAIL_PASS=sua_senha_de_app_aqui
```
**Limites**: 500 emails/dia, 5 emails/segundo

### 🌱 Produção Inicial (até 1.000 usuários)
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
```
**Limites**: 100 emails/dia grátis, depois $15/mês para 40k emails
**Por que**: Fácil configuração, excelente entregabilidade, analytics incluído

### 📈 Produção em Crescimento (1.000-10.000 usuários)
```env
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXXX
AWS_SES_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
**Custo**: $0.10 por 1.000 emails
**Por que**: Melhor custo-benefício, escala automática

### 🏢 Produção em Escala (10.000+ usuários)
Continue com **Amazon SES** com configurações avançadas:
- Dedicated IP pools
- Configuration sets para tracking
- SNS para bounce/complaint handling

## 🔧 Configuração por Provedor

### Gmail (Atual)
```env
EMAIL_PROVIDER=gmail
EMAIL_USER=seu_email@exemplo.com
EMAIL_PASS=sua_senha_de_app_aqui
```

⚠️ **Importante**: 
- Limite de 500 emails/dia
- Pode ser bloqueado se enviar muitos emails rapidamente
- Use apenas para desenvolvimento ou baixo volume

### SendGrid (Recomendado para Produção)

1. **Criar conta**: https://sendgrid.com/
2. **Gerar API Key**:
   - Settings → API Keys → Create API Key
   - Escolha "Full Access"
   - Copie a chave (só aparece uma vez!)

3. **Configurar .env**:
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
EMAIL_USER=seu_email@exemplo.com  # Seu email verificado
```

4. **Verificar domínio** (opcional mas recomendado):
   - Settings → Sender Authentication
   - Adicione editaliza.com.br
   - Configure DNS conforme instruções

### Amazon SES

1. **Configurar AWS**:
   ```bash
   # Instalar AWS CLI
   pip install awscli
   
   # Configurar credenciais
   aws configure
   ```

2. **Verificar domínio**:
   ```bash
   aws ses verify-domain-identity --domain editaliza.com.br
   ```

3. **Sair do Sandbox** (para enviar para qualquer email):
   - AWS Console → SES → Account dashboard
   - Request production access

4. **Configurar .env**:
```env
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXXX
AWS_SES_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_USER=seu_email@exemplo.com
```

### Mailgun

1. **Criar conta**: https://www.mailgun.com/
2. **Adicionar domínio**: Dashboard → Domains → Add Domain
3. **Configurar DNS** conforme instruções
4. **Configurar .env**:
```env
EMAIL_PROVIDER=mailgun
MAILGUN_HOST=smtp.mailgun.org
MAILGUN_USER=postmaster@mg.editaliza.com.br
MAILGUN_PASS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Elastic Email

1. **Criar conta**: https://elasticemail.com/
2. **Gerar API Key**: Settings → API → Create
3. **Configurar .env**:
```env
EMAIL_PROVIDER=elastic
ELASTIC_EMAIL_USER=seu_email@exemplo.com
ELASTIC_EMAIL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Microsoft 365/Outlook

```env
EMAIL_PROVIDER=outlook
OUTLOOK_USER=seu_email@exemplo.com
OUTLOOK_PASS=sua_senha_aqui
```

⚠️ **Nota**: Pode precisar de senha de app se tiver 2FA ativado

### SMTP Genérico

Para servidores próprios ou outros provedores:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.editaliza.com.br
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_email@exemplo.com
SMTP_PASS=sua_senha_aqui
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
```

## 📊 Monitoramento e Logs

### Winston Logs Estruturados

O sistema agora usa Winston para logs estruturados em produção:

```javascript
// Logs são salvos em:
logs/
  ├── error-2024-01-15.log      # Apenas erros
  ├── combined-2024-01-15.log   # Todos os logs
  ├── security-2024-01-15.log   # Eventos de segurança
  └── email-2024-01-15.log      # Logs de email específicos
```

### Verificar Status do Provedor

```javascript
// Endpoint para verificar status
GET /api/email/status

// Resposta:
{
  "provider": "sendgrid",
  "configured": true,
  "connected": true,
  "limits": {
    "daily": 100,
    "perSecond": 10
  }
}
```

### Métricas Importantes

Monitor estas métricas:
- **Bounce Rate**: < 5% (ideal < 2%)
- **Complaint Rate**: < 0.1%
- **Delivery Rate**: > 95%
- **Open Rate**: > 20% (emails transacionais)

## 🔥 Solução de Problemas

### Gmail bloqueando envios
```
Erro: "Too many login attempts"
```
**Solução**: 
1. Reduza rate limit
2. Use App Password em vez de senha normal
3. Migre para SendGrid

### SES em Sandbox
```
Erro: "Email address not verified"
```
**Solução**:
1. Verifique o email destinatário no SES
2. Ou solicite acesso de produção

### Emails indo para SPAM
**Soluções**:
1. Configure SPF, DKIM, DMARC no DNS
2. Use domínio verificado
3. Evite palavras spam no assunto
4. Mantenha bounce rate baixo

### Limite de taxa excedido
```
Erro: "Rate limit exceeded"
```
**Solução**:
1. Implemente fila de emails
2. Use retry com backoff exponencial
3. Distribua envios ao longo do tempo

## 📈 Migração de Provedor

### De Gmail para SendGrid:

1. **Criar conta SendGrid** e obter API key
2. **Atualizar .env**:
   ```env
   # Comentar configuração antiga
   # EMAIL_PROVIDER=gmail
   # EMAIL_USER=seu_email@exemplo.com
   # EMAIL_PASS=sua_senha_aqui
   
   # Nova configuração
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
   ```
3. **Testar em staging** primeiro
4. **Deploy em produção** durante período de baixo tráfego
5. **Monitorar logs** por 24h

## 🎯 Checklist de Produção

- [ ] Provedor de email configurado (não Gmail)
- [ ] Domínio verificado no provedor
- [ ] SPF, DKIM, DMARC configurados no DNS
- [ ] Rate limiting implementado
- [ ] Retry logic configurado
- [ ] Logs estruturados ativos
- [ ] Monitoramento de bounce/complaints
- [ ] Backup de provedor configurado
- [ ] Templates testados em múltiplos clients
- [ ] Unsubscribe link funcionando

## 📞 Suporte dos Provedores

- **SendGrid**: https://support.sendgrid.com/
- **AWS SES**: https://aws.amazon.com/ses/getting-started/
- **Mailgun**: https://documentation.mailgun.com/
- **Elastic Email**: https://elasticemail.com/support/

## 🔒 Segurança

1. **Nunca commite credenciais** no Git
2. **Use variáveis de ambiente** sempre
3. **Rotacione API keys** regularmente
4. **Configure alertas** para atividade suspeita
5. **Implemente rate limiting** por usuário
6. **Valide emails** antes de enviar

---

**Última atualização**: 15/08/2025  
**Versão**: 2.0