# 🔧 Configuração DNS para Emails - Editaliza

## 📋 Problema Identificado
O SendGrid está recebendo os emails (status 202) mas fica em "processing" eternamente porque **não consegue validar a autenticidade do domínio editaliza.com.br**.

## ✅ Solução: Configurar Registros DNS

### 1. SPF (Sender Policy Framework)
Adicione este registro TXT no DNS do domínio editaliza.com.br:

```
Nome: @ (ou editaliza.com.br)
Tipo: TXT
Valor: v=spf1 include:sendgrid.net include:_spf.google.com ip4:161.35.127.123 ~all
```

### 2. DKIM (SendGrid)
No painel do SendGrid:
1. Vá em Settings → Sender Authentication
2. Clique em "Authenticate Your Domain"
3. Digite: editaliza.com.br
4. O SendGrid fornecerá 3 registros CNAME para adicionar no DNS

Exemplo dos registros que o SendGrid fornecerá:
```
s1._domainkey.editaliza.com.br → s1.domainkey.u123456.wl789.sendgrid.net
s2._domainkey.editaliza.com.br → s2.domainkey.u123456.wl789.sendgrid.net
em1234.editaliza.com.br → u123456.wl789.sendgrid.net
```

### 3. DMARC
Adicione este registro TXT:
```
Nome: _dmarc
Tipo: TXT
Valor: v=DMARC1; p=none; rua=mailto:contato@editaliza.com.br
```

## 📍 Onde Configurar?
Acesse o painel de controle do seu registrador de domínio (onde você comprou editaliza.com.br) e adicione esses registros na zona DNS.

## 🔍 Como Verificar?
Após configurar, teste com:

```bash
# Verificar SPF
nslookup -type=txt editaliza.com.br

# Verificar DKIM (após configurar no SendGrid)
nslookup -type=cname s1._domainkey.editaliza.com.br

# Verificar DMARC
nslookup -type=txt _dmarc.editaliza.com.br
```

## ⏱️ Tempo de Propagação
As mudanças DNS podem levar de 1 a 48 horas para propagar completamente.

## 🚀 Após Configurar DNS:

1. **No SendGrid:**
   - Vá em Settings → Sender Authentication
   - Verifique se o domínio está "Verified"

2. **Teste o envio:**
   - Use o script test-sendgrid-direct.js novamente
   - Os emails devem ser processados corretamente

## 💡 Alternativa Imediata (Temporária)

Enquanto aguarda a propagação DNS, você pode usar um email Gmail com senha de app:

1. Acesse: https://myaccount.google.com/apppasswords
2. Crie uma senha de app para "Mail"
3. Use essa senha no EMAIL_PASS do .env
4. Configure EMAIL_USER com seu Gmail

## 📝 Checklist Final

- [ ] Registros SPF configurados
- [ ] Registros DKIM configurados (via SendGrid)
- [ ] Registro DMARC configurado
- [ ] Domínio verificado no SendGrid
- [ ] Teste de envio bem-sucedido

## ⚠️ Importante
Sem esses registros DNS, seus emails:
- Ficarão presos em "processing" no SendGrid
- Serão rejeitados como spam
- Não serão entregues aos destinatários

**Ação Necessária:** Configure os registros DNS no painel do seu registrador de domínio AGORA!