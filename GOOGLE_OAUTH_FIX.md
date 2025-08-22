# 🛠️ CORREÇÕES IMPLEMENTADAS: Google OAuth "Malformed auth code"

## ✅ PROBLEMA ATUAL
Embora as credenciais estejam configuradas, o erro "Malformed auth code" indica que o código OAuth está sendo corrompido durante a troca por token de acesso. Isso é comum com proxy reverso (Nginx).

## ✅ IMPLEMENTADO

### 1. **Trust Proxy Configurado**
- Adicionado `app.set('trust proxy', 1)` no server.js
- Isso corrige headers X-Forwarded-* vindos do Nginx
- **Requer restart do servidor**

### 2. **Debug Detalhado**
- Logs completos no callback OAuth
- Detecção específica de "Malformed auth code"
- Informações sobre encoding do código
- Headers de proxy visíveis

### 3. **Endpoint de Debug**
- `/auth/google/debug` (apenas desenvolvimento)
- Mostra configuração completa
- Valida trust proxy e headers

## 🔧 PRÓXIMOS PASSOS PARA TESTE

### Passo 1: Reiniciar Servidor
```bash
# Para o servidor atual e reinicie
npm start
```

### Passo 2: Testar Debug
```bash
curl https://editaliza.com.br/auth/google/debug
```

### Passo 3: Testar OAuth
1. Acesse: https://editaliza.com.br/login.html
2. Clique em "Login com Google"
3. Observe logs detalhados no servidor
4. Verifique se erro "malformed auth code" ainda aparece

### Passo 4: Se Ainda Der Erro
Teste callback **direto** (sem Nginx):
1. Temporariamente configure no Google Console:
   - Callback: `http://SEU-IP:3000/auth/google/callback`
2. Teste direto na porta 3000
3. Se funcionar = problema é no Nginx
4. Se não funcionar = problema na aplicação

## 🔍 O QUE OBSERVAR NOS LOGS

### ✅ Sucesso Esperado:
```
🔍 CALLBACK OAUTH RECEBIDO
HEADERS:
   x-forwarded-proto: https
   x-forwarded-host: editaliza.com.br
   host: localhost:3000

QUERY PARAMETERS:
   code: 4/0AfJohX... (length: 123)
   code_encoded_check: not_encoded
   
✅ Usuário autenticado: usuario@email.com
```

### ❌ Erro para Investigar:
```
❌ ERRO DETALHADO NO PASSPORT:
   Tipo: TokenError
   Mensagem: Malformed auth code.
   
🔎 ERRO "MALFORMED AUTH CODE" DETECTADO!
```

## 🚨 SOLUÇÕES ALTERNATIVAS SE NÃO FUNCIONAR

### Solução A: Nginx Headers
Verificar se Nginx está passando headers corretos:
```nginx
location /auth/google/callback {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_redirect off;
}
```

### Solução B: Desabilitar URL Rewrite no Nginx
```nginx
# NÃO usar proxy_redirect
# NÃO usar rewrite rules na rota callback
```

### Solução C: Timeout Aumentado
Adicionar timeout maior no Nginx:
```nginx
proxy_read_timeout 60s;
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
```

---
**Status:** Implementado - aguardando teste
**Próximo:** Reiniciar servidor e testar OAuth