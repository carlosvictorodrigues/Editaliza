# 📧 Guia de Configuração do Sistema de E-mail - Editaliza

Este guia explica como configurar o sistema de recuperação de senha por e-mail do Editaliza usando Gmail SMTP.

## 📋 Visão Geral

O sistema de e-mail do Editaliza inclui:
- ✅ Envio profissional de e-mails de recuperação de senha
- ✅ Templates HTML responsivos com branding Editaliza
- ✅ Rate limiting avançado para prevenir abuso
- ✅ Fallback para simulação se o e-mail falhar
- ✅ Logs detalhados e monitoramento
- ✅ Prevenção de enumeração de usuários

## 🚀 Configuração Rápida

### 1. Configurar Gmail App Password

Para usar o Gmail SMTP, você precisa de uma **senha de aplicativo** (não sua senha normal do Gmail):

#### Passo a Passo:

1. **Acesse sua conta Google**: [myaccount.google.com](https://myaccount.google.com)

2. **Vá para Segurança**: No menu lateral, clique em "Segurança"

3. **Ative a Verificação em 2 Etapas** (obrigatório):
   - Se não estiver ativada, clique em "Verificação em duas etapas"
   - Siga as instruções para configurar

4. **Gere uma Senha de Aplicativo**:
   - Na seção "Verificação em duas etapas", clique em "Senhas de aplicativo"
   - Selecione "E-mail" como aplicativo
   - Selecione "Outro (nome personalizado)" como dispositivo
   - Digite "Editaliza" como nome
   - Clique em "Gerar"

5. **Copie a senha gerada** (16 caracteres, sem espaços)

### 2. Atualizar o arquivo .env

Edite o arquivo `.env` na raiz do projeto:

```env
# Configurações de Email (para recuperação de senha)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app_16_caracteres
```

**Substitua:**
- `seu_email@gmail.com` → Seu e-mail Gmail real
- `sua_senha_de_app_16_caracteres` → A senha de aplicativo gerada (16 caracteres, sem espaços)

### 3. Reiniciar o Servidor

Após alterar o `.env`, reinicie o servidor:

```bash
npm run dev
```

Você deve ver a mensagem:
```
✅ Email service configured successfully
```

## 🧪 Testando a Configuração

### 1. Teste via Endpoint Administrativo

```bash
# Testar configuração do e-mail
curl -X GET http://localhost:3000/admin/email/status \
  -H "Authorization: Bearer SEU_TOKEN_JWT"

# Enviar e-mail de teste
curl -X POST http://localhost:3000/admin/email/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{"email": "seu_email@gmail.com"}'
```

### 2. Teste via Interface

1. Acesse a página de login: `http://localhost:3000/login.html`
2. Clique em "Esqueci minha senha"
3. Digite um e-mail válido cadastrado
4. Verifique sua caixa de entrada (e spam)

## 📱 Exemplo de E-mail Enviado

O e-mail de recuperação inclui:

```
Assunto: 🔐 Recuperação de Senha - Editaliza

- Design profissional com cores Editaliza (azul/roxo)
- Botão CTA responsivo "Redefinir Minha Senha"
- Aviso de expiração (1 hora)
- Notificações de segurança
- Versão texto para clientes sem HTML
- Links diretos como fallback
```

## 🔒 Recursos de Segurança

### Rate Limiting
- **Por e-mail**: 3 tentativas a cada 15 minutos
- **Por IP**: 10 tentativas por hora
- **Global**: 5 tentativas a cada 15 minutos (middleware express)

### Prevenção de Abuso
- Mesma resposta para e-mails válidos e inválidos
- Não revelação de existência de contas
- Logs detalhados para monitoramento
- Tokens seguros de 32 bytes

### Logs de Segurança
```
✅ Password recovery simulated for user@example.com
📧 Para: user@example.com
📝 Message ID: <message-id@gmail.com>
```

## 🚨 Solução de Problemas

### Erro: "Invalid login"
**Causa**: Credenciais incorretas
**Solução**: 
1. Verifique se o e-mail está correto
2. Confirme que a senha de aplicativo foi copiada corretamente (16 caracteres)
3. Certifique-se de que a verificação em 2 etapas está ativada

### Erro: "Connection timeout"
**Causa**: Problemas de rede ou firewall
**Solução**:
1. Verifique conexão com internet
2. Teste com diferentes portas (587, 465)
3. Desative temporariamente antivírus/firewall

### E-mails não chegam
**Verificações**:
1. ✅ Caixa de entrada
2. ✅ Pasta de spam/lixo eletrônico
3. ✅ Filtros de e-mail
4. ✅ Configurações de segurança do Gmail

### Modo Simulação Ativado
**Causa**: Configuração de e-mail não detectada
**Solução**:
1. Verifique arquivo `.env`
2. Reinicie o servidor
3. Confirme logs de inicialização

## 📊 Monitoramento

### Status do Sistema
```bash
GET /admin/email/status
```

Retorna:
```json
{
  "emailService": {
    "configured": true,
    "ready": true,
    "provider": "Gmail SMTP",
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "your_email@gmail.com"
  },
  "rateLimiting": {
    "totalEmailsTracked": 5,
    "totalIPsTracked": 3,
    "config": { ... }
  }
}
```

### Reset de Rate Limits
```bash
POST /admin/email/reset-limits
{
  "email": "user@example.com"
}
```

## 🌐 Configuração para Produção

### Variáveis de Ambiente Adicionais

```env
# URLs de produção
NODE_ENV=production
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@editaliza.com.br
EMAIL_PASS=sua_senha_de_app_producao

# SSL/TLS mais rígido para produção
EMAIL_SECURE=true
EMAIL_REJECT_UNAUTHORIZED=true
```

### Domínio Personalizado

Para usar um domínio personalizado (ex: `noreply@editaliza.com.br`):

1. Configure MX records no DNS
2. Adicione o domínio ao Google Workspace
3. Gere senha de aplicativo para a conta do domínio
4. Atualize EMAIL_USER no .env

## 📞 Suporte

### Problemas Comuns

| Problema | Solução |
|----------|---------|
| "Email service not configured" | Verificar .env e reiniciar servidor |
| "Rate limit exceeded" | Aguardar cooldown ou resetar via admin |
| "Gmail connection failed" | Verificar senha de aplicativo |
| "Test email failed" | Verificar logs e configuração SMTP |

### Logs Úteis

```bash
# Logs do sistema de e-mail
tail -f logs/email.log

# Status em tempo real
curl http://localhost:3000/admin/email/status
```

---

**✅ Sistema Configurado com Sucesso!**

Seu sistema de recuperação de senha por e-mail está agora totalmente operacional com:
- Envio profissional de e-mails
- Segurança robusta contra abuso
- Monitoramento completo
- Fallback inteligente

Para mais suporte, consulte os logs do servidor ou entre em contato com a equipe de desenvolvimento.