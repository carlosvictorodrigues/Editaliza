# 🚨 ALERTA DE SEGURANÇA CRÍTICO - AÇÃO IMEDIATA NECESSÁRIA

## CREDENCIAIS EXPOSTAS NO GITHUB

### ⚠️ CREDENCIAIS COMPROMETIDAS DETECTADAS:

1. **Google OAuth2**
   - CLIENT_ID: `453039775824-ckr0plfuqqn32t2h9pt6vgob8fi78m5g.apps.googleusercontent.com`
   - CLIENT_SECRET: `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`
   - **STATUS: COMPROMETIDO - REVOGUE IMEDIATAMENTE**

2. **SMTP Gmail**
   - Email: `suporte@editaliza.com.br`
   - Senha de App: `usrb wdbu ciny kgku`
   - **STATUS: COMPROMETIDO - REVOGUE IMEDIATAMENTE**

## 🔴 AÇÕES IMEDIATAS NECESSÁRIAS:

### 1. REVOGUE AS CREDENCIAIS COMPROMETIDAS AGORA:

#### Google OAuth:
1. Acesse: https://console.cloud.google.com/
2. Vá em "APIs & Services" > "Credentials"
3. Encontre o OAuth 2.0 Client ID comprometido
4. **DELETE ou REGENERE** as credenciais
5. Crie novas credenciais OAuth

#### Gmail SMTP:
1. Acesse: https://myaccount.google.com/apppasswords
2. **REVOGUE** a senha de app "usrb wdbu ciny kgku"
3. Gere uma nova senha de app
4. Atualize o arquivo .env LOCAL (nunca commite!)

### 2. REMOVA O HISTÓRICO DO GIT:

```bash
# IMPORTANTE: Isso reescreverá o histórico do Git!
# Faça backup primeiro se necessário

# Remover o arquivo .env do histórico
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push para o GitHub (CUIDADO: isso reescreve o histórico!)
git push origin --force --all
git push origin --force --tags
```

### 3. CONFIGURE CORRETAMENTE:

1. **NUNCA** commite o arquivo `.env`
2. O `.env` já está no `.gitignore` ✅
3. Use `.env.example` como template (sem credenciais reais) ✅
4. Mantenha credenciais apenas localmente

### 4. MONITORE ATIVIDADE SUSPEITA:

- Verifique logs de acesso no Google Cloud Console
- Monitore tentativas de login não autorizadas
- Verifique se houve uso indevido das credenciais

## 📋 CHECKLIST DE SEGURANÇA:

- [ ] Revogar Google OAuth credentials comprometidas
- [ ] Revogar senha de app Gmail comprometida  
- [ ] Gerar novas credenciais
- [ ] Atualizar .env LOCAL com novas credenciais
- [ ] Remover .env do histórico do Git
- [ ] Verificar se não há outras credenciais expostas
- [ ] Configurar alertas de segurança no GitHub
- [ ] Ativar 2FA em todas as contas

## 🛡️ PREVENÇÃO FUTURA:

1. **Use variáveis de ambiente no servidor de produção**
2. **NUNCA commite arquivos .env**
3. **Use secrets managers** (AWS Secrets Manager, etc.)
4. **Configure GitHub Secret Scanning**
5. **Revise PRs antes de fazer merge**

## ⏰ URGÊNCIA: FAÇA ISSO AGORA!

As credenciais expostas podem ser usadas por qualquer pessoa que tenha acesso ao repositório público. Cada minuto conta!

---
**Data da detecção:** 15 de Agosto de 2025
**Detectado por:** GitGuardian
**Severidade:** CRÍTICA 🔴