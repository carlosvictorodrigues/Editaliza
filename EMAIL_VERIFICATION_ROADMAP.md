# 📧 ROADMAP - IMPLEMENTAÇÃO DE CONFIRMAÇÃO POR EMAIL

## 🎯 **SITUAÇÃO ATUAL**
- ✅ Usuários criados com emails fake para desenvolvimento
- ✅ Sistema de autenticação funcionando (local + Google OAuth)
- ✅ Primeiro usuário admin criado: `admin@editaliza.com`
- ⚠️ **SEM validação de email** - qualquer email pode ser usado

---

## 🚀 **IMPLEMENTAÇÃO FUTURA NECESSÁRIA**

### **FASE 1: ESTRUTURA DE VERIFICAÇÃO (1-2 semanas)**

#### **1.1 Database Schema**
```sql
-- Adicionar campos à tabela users
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN verification_token TEXT;
ALTER TABLE users ADD COLUMN verification_token_expires INTEGER;
ALTER TABLE users ADD COLUMN verification_sent_at DATETIME;
```

#### **1.2 Configuração de Email Service**
- **Opções recomendadas:**
  - **SendGrid** (fácil setup, 100 emails/dia grátis)
  - **NodeMailer + Gmail SMTP** (simples para começar)
  - **AWS SES** (escalável, custo baixo)

#### **1.3 Templates de Email**
- Email de confirmação de cadastro
- Email de redefinição de senha (já parcialmente implementado)
- Email de boas-vindas pós-confirmação

### **FASE 2: FLUXO DE CADASTRO (1 semana)**

#### **2.1 Modificar Registration Flow**
```javascript
// Novo fluxo de cadastro
1. Usuário submete formulário
2. Criar usuário com email_verified = FALSE
3. Gerar verification_token único
4. Enviar email de confirmação
5. Bloquear login até confirmação
6. Página "Verifique seu email"
```

#### **2.2 Endpoint de Verificação**
```javascript
// GET /auth/verify-email/:token
- Validar token e expiração
- Marcar email_verified = TRUE
- Limpar verification_token
- Redirecionar para login com success message
```

#### **2.3 Middleware de Verificação**
```javascript
// Middleware para rotas protegidas
const requireVerifiedEmail = (req, res, next) => {
  if (req.user && !req.user.email_verified) {
    return res.status(403).json({ 
      error: 'Email não verificado. Verifique sua caixa de entrada.' 
    });
  }
  next();
};
```

### **FASE 3: UX/UI DE VERIFICAÇÃO (3-4 dias)**

#### **3.1 Páginas Necessárias**
- `email-verification-sent.html` - "Verifique seu email"
- `email-verified-success.html` - "Email confirmado!"
- `resend-verification.html` - Reenviar email

#### **3.2 Funcionalidades UX**
- Countdown para reenvio (60 segundos)
- Link "Não recebeu? Reenviar"
- Validação visual do processo
- Suporte para diferentes provedores de email

### **FASE 4: MIGRAÇÃO DE USUÁRIOS EXISTENTES (2-3 dias)**

#### **4.1 Estratégia de Migração**
```javascript
// Script de migração
1. Marcar usuários com emails fake como email_verified = FALSE
2. Marcar usuários admin como email_verified = TRUE
3. Notificar usuários reais sobre necessidade de verificação
4. Período de graça (30 dias) para verificação
```

#### **4.2 Comunicação com Usuários**
- Email informando sobre nova política
- Banner no sistema alertando sobre verificação pendente
- Funcionalidade degradada até verificação

---

## 📋 **CONFIGURAÇÕES TÉCNICAS DETALHADAS**

### **Environment Variables (.env)**
```bash
# Email Service Configuration
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_api_key_here
FROM_EMAIL=noreply@editaliza.com
FROM_NAME=Editaliza

# Alternative: NodeMailer + Gmail
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Verification Settings
VERIFICATION_TOKEN_EXPIRES=24h
VERIFICATION_BASE_URL=https://editaliza.com
```

### **Exemplo de Service de Email**
```javascript
// services/emailService.js
const sendVerificationEmail = async (email, verificationToken) => {
  const verificationUrl = `${process.env.VERIFICATION_BASE_URL}/auth/verify-email/${verificationToken}`;
  
  const htmlContent = `
    <h2>Confirme seu email - Editaliza</h2>
    <p>Clique no link abaixo para confirmar sua conta:</p>
    <a href="${verificationUrl}">Confirmar Email</a>
    <p>Este link expira em 24 horas.</p>
  `;
  
  await emailProvider.send({
    to: email,
    subject: 'Confirme seu email - Editaliza',
    html: htmlContent
  });
};
```

---

## ⚠️ **CONSIDERAÇÕES DE SEGURANÇA**

### **Tokens de Verificação**
- **Usar crypto.randomBytes(32)** para tokens únicos
- **Expiração em 24h** máximo
- **Hash tokens** no banco (opcional, mas recomendado)
- **Rate limiting** para reenvios (max 3 por hora)

### **Proteção Anti-Spam**
- Limitar cadastros por IP (5 por hora)
- Implementar reCAPTCHA no registro
- Verificar domínios de email suspeitos
- Log de tentativas de verificação

### **Backup de Segurança**
- **Administradores sempre verificados** por padrão
- **Código de recuperação** para casos extremos
- **Suporte manual** para verificação em casos especiais

---

## 🎯 **MÉTRICAS E MONITORAMENTO**

### **KPIs Importantes**
- Taxa de verificação de email (target: >85%)
- Tempo médio para verificação (target: <2h)
- Taxa de emails entregues (target: >95%)
- Reenvios por usuário (target: <1.5)

### **Alertas Necessários**
- Email service down
- Taxa de verificação baixa (<70%)
- Muitos emails bouncing
- Usuários bloqueados por não verificação

---

## 🚧 **IMPLEMENTAÇÃO PROGRESSIVA**

### **Opção A: Big Bang (2-3 semanas)**
- Implementar tudo de uma vez
- Período de teste intensivo
- Deploy com feature flag

### **Opção B: Gradual (1-2 meses)**
- **Semana 1-2**: Infraestrutura + emails para novos usuários
- **Semana 3-4**: Migração usuários existentes
- **Semana 5-6**: Enforcement obrigatório
- **Semana 7-8**: Otimizações e UX melhorias

---

## 📞 **SUPORTE E CONTINGÊNCIA**

### **Casos de Suporte Comum**
1. "Não recebi o email" → Verificar spam, reenviar
2. "Email expirou" → Gerar novo token
3. "Troquei de email" → Processo de alteração seguro
4. "Perdi acesso ao email" → Suporte manual com validação

### **Plano de Contingência**
- **Email service down**: Queue de emails + retry automático
- **Tokens comprometidos**: Invalidar todos + reenvio em massa
- **Bug crítico**: Feature flag disable + rollback

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **Backend**
- [ ] Schema database atualizado
- [ ] Email service configurado
- [ ] Endpoints de verificação
- [ ] Middleware de verificação
- [ ] Testes unitários
- [ ] Rate limiting implementado

### **Frontend**
- [ ] Páginas de verificação criadas
- [ ] UX de reenvio implementada
- [ ] Feedback visual adequado
- [ ] Responsividade mobile
- [ ] Testes E2E

### **Infraestrutura**
- [ ] Environment variables configuradas
- [ ] Email templates finalizados
- [ ] Monitoramento implementado
- [ ] Backup/recovery testado
- [ ] Documentação atualizada

### **Go-Live**
- [ ] Testes de carga
- [ ] Plan de comunicação usuários
- [ ] Suporte preparado
- [ ] Rollback plan documentado
- [ ] Métricas baseline coletadas

---

## 💡 **RECOMENDAÇÕES IMPORTANTES**

1. **Comece simples**: NodeMailer + Gmail para MVP
2. **Teste extensivamente**: Diferentes provedores de email
3. **Comunique claramente**: Usuários precisam entender o processo
4. **Monitore ativamente**: Taxa de entrega e verificação
5. **Suporte responsivo**: Casos de suporte serão comuns no início

**Prioridade: MÉDIA-ALTA** - Implementar antes do launch público
**Complexidade: MÉDIA** - 2-3 semanas para implementação completa
**Impacto: ALTO** - Essencial para operação segura e confiável

---

*Documentado em: Dezembro 2024*  
*Próxima revisão: Antes do desenvolvimento da feature*