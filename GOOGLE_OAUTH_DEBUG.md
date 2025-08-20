# 🔍 DIAGNÓSTICO: Google OAuth "Malformed auth code"

## 🚨 ANÁLISE DO PROBLEMA

O erro `TokenError: Malformed auth code` no passport-google-oauth20 indica que o código de autorização recebido do Google não está no formato esperado durante a troca por token de acesso.

## 🔎 CAUSAS MAIS COMUNS

### 1. **URL Encoding Duplo** ⭐ (Mais provável)
O código OAuth pode estar sendo codificado duas vezes:
- Nginx faz encoding
- Express faz encoding novamente
- Resultado: código corrompido

### 2. **Configuração de Proxy Reverso**
Nginx não está repassando corretamente:
- Headers de proxy
- Query parameters originais
- Corpo da requisição

### 3. **HTTPS/HTTP Mismatch**
- Callback registrado como HTTPS
- Servidor interno recebe como HTTP
- Headers confusos causam parsing incorreto

### 4. **Cookies de Sessão Perdidos**
- Estado OAuth não mantido entre requests
- Session store não funcional
- Passport não consegue validar o state

### 5. **Timeout de Código**
- Códigos OAuth têm TTL curto (~10 segundos)
- Delays no proxy podem expirar o código

## 🛠️ SOLUÇÕES PRÁTICAS

### Solução 1: Corrigir Nginx Proxy (Recomendada)
```nginx
location /auth/google/callback {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    
    # NÃO reescrever query parameters
    proxy_set_header Accept-Encoding "";
    proxy_redirect off;
    
    # Manter query string original
    proxy_pass_request_body on;
}
```

### Solução 2: Debug do Código Recebido
Adicionar logs detalhados no callback para ver o que está chegando.

### Solução 3: Configuração Express Trust Proxy
```javascript
app.set('trust proxy', 1);
```

### Solução 4: Callback Direto (Emergencial)
Temporariamente configurar callback diretamente para porta 3000 para isolar o problema do Nginx.

## 📝 PRÓXIMOS PASSOS

1. Implementar logs de debug detalhados
2. Testar callback direto (sem Nginx)
3. Verificar configuração do Nginx
4. Validar configuração trust proxy no Express
5. Verificar estado da sessão

---
**Criado:** 19/08/2025
**Status:** Diagnóstico inicial - implementar soluções na ordem