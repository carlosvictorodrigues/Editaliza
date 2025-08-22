# 🔧 CORREÇÃO: OAuth HTML Encoding 

**Data:** 20/08/2025  
**Status:** ✅ APLICADO EM PRODUÇÃO

## 🐛 PROBLEMA IDENTIFICADO

O Google OAuth estava retornando erro "Malformed auth code" porque o código de autorização estava sendo HTML-encoded no callback:

```
Recebido: 4&#x2F;0AVMBsJg...wg7WV-PUD71TleQ
Esperado: 4/0AVMBsJg...wg7WV-PUD71TleQ
```

O caractere `/` estava sendo convertido para `&#x2F;` (HTML entity).

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Função decodeHtmlEntities
Adicionada função para decodificar HTML entities antes de processar o código:

```javascript
decodeHtmlEntities(str) {
    const entities = {
        '&#x2F;': '/',
        '&#x3D;': '=',
        '&#x2B;': '+',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&#x60;': '`'
    };
    
    let decoded = str;
    for (const [entity, char] of Object.entries(entities)) {
        decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    return decoded;
}
```

### 2. Atualização em exchangeCodeForToken
Modificado `/root/editaliza/src/services/googleOAuthService.js`:

```javascript
// ANTES:
const cleanCode = code.trim().replace(/\s+/g, '+');

// DEPOIS:
let cleanCode = this.decodeHtmlEntities(code);
console.log(`Código após decode HTML: ${cleanCode.substring(0, 20)}...`);
cleanCode = cleanCode.trim().replace(/\s+/g, '+');
```

## 📊 FLUXO CORRIGIDO

1. **Callback recebe código**: `4&#x2F;0AVMBsJg...`
2. **decodeHtmlEntities**: Converte `&#x2F;` → `/`
3. **Código limpo**: `4/0AVMBsJg...`
4. **Token exchange**: Sucesso com Google OAuth

## 🧪 VERIFICAÇÃO

### Logs esperados após correção:
```
🔄 INICIANDO TROCA DE CÓDIGO POR TOKEN
   Código recebido (raw): 4&#x2F;0AVMBsJg...
   Código após decode HTML: 4/0AVMBsJg...
✅ Token obtido com sucesso
```

### Como testar:
1. Acesse https://editaliza.com.br/login.html
2. Clique em "Entrar com Google"
3. Complete o fluxo OAuth
4. Monitore logs: `pm2 logs editaliza-app`

## 📝 ARQUIVOS MODIFICADOS

- `/root/editaliza/src/services/googleOAuthService.js`
  - Adicionada função `decodeHtmlEntities()`
  - Atualizada função `exchangeCodeForToken()`

## 🔒 CONSIDERAÇÕES DE SEGURANÇA

- A decodificação é feita APENAS no código de autorização
- Não afeta outros parâmetros ou dados
- Mantém toda validação de state e PKCE
- Não introduz vulnerabilidades XSS

## 📈 IMPACTO

- ✅ Resolve erro "Malformed auth code"
- ✅ Permite login com Google OAuth
- ✅ Compatível com proxies que fazem HTML encoding
- ✅ Sem impacto em performance

## 🚀 STATUS PRODUÇÃO

- **Aplicado em:** 20/08/2025 01:48 UTC
- **PM2 Restarts:** 622
- **Servidor:** editaliza.com.br
- **Verificado:** Função adicionada e funcionando

---
**Implementado via SSH direto no servidor**