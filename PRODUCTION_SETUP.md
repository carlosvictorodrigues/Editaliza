# 🚀 CONFIGURAÇÃO PARA PRODUÇÃO - EDITALIZA

## 📧 Configuração de URLs para Emails

### **Desenvolvimento (Atual)**
```env
NODE_ENV=development
APP_URL=http://localhost:3000
```
**Resultado**: Links no email apontam para `http://localhost:3000/reset-password.html?token=...`

### **Produção**
```env
NODE_ENV=production
APP_URL=https://www.editaliza.com.br
```
**Resultado**: Links no email apontam para `https://www.editaliza.com.br/reset-password.html?token=...`

## 🔧 Como Configurar para Produção

### **1. Atualize o arquivo .env no servidor de produção:**
```env
# Configurações do Servidor
NODE_ENV=production
PORT=3000
APP_URL=https://www.editaliza.com.br

# Email já configurado com Google Workspace
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@exemplo.com
EMAIL_PASS=sua_senha_de_app_aqui

# Google OAuth
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_CALLBACK_URL=https://www.editaliza.com.br/auth/google/callback
```

### **2. Certifique-se que o domínio está configurado:**
- ✅ DNS apontando para o servidor
- ✅ SSL/HTTPS configurado (Let's Encrypt ou similar)
- ✅ Porta 443 aberta para HTTPS
- ✅ Redirecionamento de HTTP para HTTPS

### **3. Configurações de Segurança para Produção:**
```env
# Adicione estas configurações em produção
SECURE_COOKIES=true
FORCE_HTTPS=true
TRUST_PROXY=true
```

## 📋 Checklist de Deploy

### **Antes do Deploy:**
- [ ] Backup completo do banco de dados
- [ ] Testar todas as funcionalidades em desenvolvimento
- [ ] Verificar logs de erro

### **Durante o Deploy:**
- [ ] Atualizar arquivo .env com configurações de produção
- [ ] Instalar dependências: `npm install --production`
- [ ] Executar migrations se necessário
- [ ] Reiniciar servidor: `pm2 restart editaliza` (ou seu gerenciador de processos)

### **Após o Deploy:**
- [ ] Testar login com email
- [ ] Testar login com Google OAuth
- [ ] Testar recuperação de senha
- [ ] Verificar que links nos emails apontam para www.editaliza.com.br
- [ ] Monitorar logs por 15 minutos

## 🔍 Verificação de Funcionamento

### **Teste de Email em Produção:**
1. Acesse: https://www.editaliza.com.br/forgot-password.html
2. Digite um email de teste
3. Verifique que o email recebido tem o link correto: `https://www.editaliza.com.br/reset-password.html?token=...`

### **Teste de Google OAuth em Produção:**
1. Acesse: https://www.editaliza.com.br/login.html
2. Clique em "Entrar com Google"
3. Verifique que após autorizar, retorna para www.editaliza.com.br

## 🛠️ Comandos Úteis

### **Verificar status do servidor:**
```bash
pm2 status
pm2 logs editaliza --lines 100
```

### **Reiniciar servidor:**
```bash
pm2 restart editaliza
```

### **Ver logs em tempo real:**
```bash
pm2 logs editaliza --follow
```

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs: `pm2 logs editaliza --lines 200`
2. Verifique o arquivo .env
3. Teste localmente com as mesmas configurações
4. Verifique se o Gmail não bloqueou o acesso (pode precisar autorizar novo IP)

## 🔐 Segurança

**NUNCA commite o arquivo .env no Git!**
- Use .env.example como template
- Mantenha senhas seguras
- Rotacione tokens regularmente
- Use HTTPS sempre em produção

---

**Última atualização**: 15/08/2025  
**Versão**: 1.0