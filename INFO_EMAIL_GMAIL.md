# 📧 CONFIGURAÇÃO DE EMAIL GMAIL

## ⚠️ IMPORTANTE: Gmail requer "Senha de App" para SMTP

### Por que o erro está ocorrendo?
O Gmail não permite mais usar a senha normal da conta para aplicações. É necessário:
1. Ativar verificação em 2 etapas na conta Google
2. Gerar uma "Senha de app" específica para o aplicativo

### Como gerar uma Senha de App:
1. Acesse https://myaccount.google.com/security
2. Entre com a conta: editalizaconcursos@gmail.com
3. Ative a "Verificação em duas etapas" se não estiver ativa
4. Clique em "Senhas de app"
5. Selecione "Email" e "Outro (nome personalizado)"
6. Digite "Editaliza App"
7. Clique em "Gerar"
8. Copie a senha de 16 caracteres (será algo como: xxxx xxxx xxxx xxxx)

### Configuração no servidor:
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=editalizaconcursos@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # Senha de app gerada
EMAIL_SECURE=false
EMAIL_FROM=Editaliza <editalizaconcursos@gmail.com>
```

### Configuração atual (incorreta):
- Email: suporte@editaliza.com.br (não existe ou não está configurado)
- Senha: Provavelmente uma senha de app antiga

### Solução:
1. Gerar nova senha de app para editalizaconcursos@gmail.com
2. Atualizar no servidor via SSH
3. Reiniciar aplicação

### Comando para atualizar no servidor:
```bash
ssh editaliza "cd /root/editaliza && nano .env"
# Ou usar sed para atualizar diretamente:
ssh editaliza "cd /root/editaliza && sed -i 's/EMAIL_USER=.*/EMAIL_USER=editalizaconcursos@gmail.com/' .env"
ssh editaliza "cd /root/editaliza && sed -i 's/EMAIL_PASS=.*/EMAIL_PASS=nova_senha_aqui/' .env"
ssh editaliza "pm2 restart editaliza-app"
```