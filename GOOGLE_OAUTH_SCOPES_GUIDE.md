# 📚 GUIA DE CONFIGURAÇÃO DOS SCOPES DO GOOGLE OAUTH

## 🎯 Localização no Código
**Arquivo**: `server.js`  
**Linha**: 740  
**Código atual**:
```javascript
passport.authenticate('google', { scope: ['profile', 'email'] })
```

## 📋 Scopes Disponíveis e Suas Informações

### **Scopes Básicos (Atualmente Configurados)**
```javascript
scope: ['profile', 'email']
```
**Retorna**:
- ✅ Nome completo
- ✅ Foto do perfil
- ✅ Email principal
- ✅ Email verificado (sim/não)

### **Scopes Adicionais Úteis**

#### 1. **Informações Pessoais Detalhadas**
```javascript
scope: ['profile', 'email', 'openid']
```
**Adiciona**:
- ID único do Google
- Melhor para autenticação segura

#### 2. **Informações de Aniversário e Gênero**
```javascript
scope: [
    'profile', 
    'email',
    'https://www.googleapis.com/auth/user.birthday.read',
    'https://www.googleapis.com/auth/user.gender.read'
]
```
**Adiciona**:
- Data de nascimento
- Gênero

#### 3. **Telefone**
```javascript
scope: [
    'profile',
    'email', 
    'https://www.googleapis.com/auth/user.phonenumbers.read'
]
```
**Adiciona**:
- Número de telefone

#### 4. **Endereço**
```javascript
scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/user.addresses.read'
]
```
**Adiciona**:
- Endereço físico

#### 5. **Organização/Trabalho**
```javascript
scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/user.organization.read'
]
```
**Adiciona**:
- Empresa/organização
- Cargo

## 🔧 Como Modificar no Código

### **Passo 1: Edite server.js**
Localize a linha 740 e modifique o array de scopes:

```javascript
// EXEMPLO: Adicionar telefone e data de nascimento
app.get('/auth/google',
    passport.authenticate('google', { 
        scope: [
            'profile', 
            'email',
            'https://www.googleapis.com/auth/user.birthday.read',
            'https://www.googleapis.com/auth/user.phonenumbers.read'
        ]
    })
);
```

### **Passo 2: Atualize o Handler do Callback**
Na estratégia do Passport (linha 247), você receberá as informações adicionais em `profile`:

```javascript
async (accessToken, refreshToken, profile, done) => {
    // profile agora contém as informações adicionais
    console.log('Informações do usuário:', {
        nome: profile.displayName,
        email: profile.emails[0].value,
        foto: profile.photos[0].value,
        aniversário: profile._json.birthday, // se solicitado
        telefone: profile._json.phoneNumbers, // se solicitado
        // etc...
    });
}
```

### **Passo 3: Salvar Informações Adicionais no Banco**
Se quiser salvar informações extras, adicione colunas na tabela `users`:

```sql
ALTER TABLE users ADD COLUMN phone_number TEXT;
ALTER TABLE users ADD COLUMN birth_date TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN profile_picture TEXT;
```

## ⚠️ Considerações Importantes

### **1. Princípio do Mínimo Privilégio**
- ✅ Solicite apenas as informações que realmente precisa
- ✅ Quanto menos scopes, mais usuários aceitarão

### **2. Tela de Consentimento**
- Cada scope adicional aparece na tela de permissão
- Muitos scopes podem assustar usuários

### **3. Verificação do Google**
- Scopes sensíveis requerem verificação do app pelo Google
- Processo pode levar semanas

### **4. LGPD/GDPR**
- Certifique-se de ter base legal para coletar cada informação
- Documente o uso de cada dado coletado

## 📊 Recomendação para Editaliza

Para uma plataforma de estudos como Editaliza, recomendo manter **APENAS**:

```javascript
scope: ['profile', 'email']
```

**Por quê?**
- ✅ Suficiente para criar conta e identificar usuário
- ✅ Não assusta usuários com muitas permissões
- ✅ Não requer verificação adicional do Google
- ✅ Compatível com LGPD

### **Informações Obtidas com Scopes Básicos**:
1. **Nome completo** - Para personalização
2. **Email** - Para login e comunicação
3. **Foto do perfil** - Para avatar (opcional)
4. **ID do Google** - Para login único

## 🚀 Exemplo de Uso Completo

```javascript
// server.js - linha 740
app.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' // Força seleção de conta
    })
);

// Na estratégia (linha 247)
async (accessToken, refreshToken, profile, done) => {
    const userData = {
        google_id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        email_verified: profile.emails[0].verified,
        profile_picture: profile.photos[0]?.value || null,
        auth_provider: 'google'
    };
    
    // Salvar ou atualizar usuário...
}
```

## 📝 Checklist para Implementação

- [ ] Decidir quais informações são necessárias
- [ ] Atualizar scopes em server.js
- [ ] Testar login com novos scopes
- [ ] Atualizar política de privacidade se necessário
- [ ] Documentar uso dos dados coletados

---

**Última atualização**: 15/08/2025  
**Status**: Configurado com scopes básicos (profile, email)