# 🔴 AÇÃO URGENTE: Atualizar Google Console

## ⚠️ PROBLEMA ATUAL
O OAuth do Google está retornando "Malformed auth code" porque a URL de callback não está batendo.

## 📋 O QUE FAZER AGORA:

### 1. Acesse o Google Cloud Console:
https://console.cloud.google.com/

### 2. Selecione o projeto correto

### 3. Vá para "APIs & Services" > "Credentials"

### 4. Clique no OAuth 2.0 Client ID:
`453039775824-sf6rm85o8vdfi04e9icoda073setqbs1.apps.googleusercontent.com`

### 5. ATUALIZE estas configurações:

#### Authorized JavaScript origins:
- `https://app.editaliza.com.br`
- `https://editaliza.com.br` (se ainda não tiver)

#### Authorized redirect URIs (REMOVA TODAS e adicione APENAS estas):
- `https://app.editaliza.com.br/auth/google/callback`

⚠️ **IMPORTANTE**: Remova qualquer URI antiga como:
- ❌ `https://editaliza.com.br/auth/google/callback`
- ❌ `https://editalizaconcursos.com.br/auth/google/callback`
- ❌ `http://localhost:3000/auth/google/callback`

### 6. Clique em "SAVE"

### 7. Aguarde 5 minutos para propagação

## 🔍 VERIFICAÇÃO
Após salvar, a configuração deve ficar EXATAMENTE assim:

```
Authorized JavaScript origins:
✅ https://app.editaliza.com.br

Authorized redirect URIs:
✅ https://app.editaliza.com.br/auth/google/callback
```

## 🚨 SE AINDA DER ERRO:
Execute este comando no servidor para ver os logs detalhados:
```bash
ssh editaliza "cd /root/editaliza && pm2 logs editaliza-app --lines 50 | grep -A5 -B5 'OAuth'"
```

## ✅ CONFIRMAÇÃO
As configurações no servidor estão corretas:
- Client ID: ✅ Configurado
- Client Secret: ✅ Configurado
- Callback URL: ✅ https://app.editaliza.com.br/auth/google/callback
- Trust Proxy: ✅ Configurado para Nginx

O único problema agora é no Google Console!