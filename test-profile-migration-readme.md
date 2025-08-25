# Testes de Migração de Rotas de Perfil - Editaliza

## 📋 Visão Geral

O arquivo `test-profile-migration.js` contém uma suíte completa de testes para validar a migração das rotas de perfil do sistema Editaliza, garantindo que tanto as rotas antigas quanto as novas funcionem corretamente.

## 🎯 Objetivos dos Testes

### 1. **Compatibilidade Completa**
- ✅ Rotas antigas continuam funcionando
- ✅ Rotas novas funcionam corretamente
- ✅ Headers de depreciação são enviados
- ✅ Redirecionamentos estão corretos

### 2. **CRUD Completo do Perfil**
- ✅ **GET** `/api/users/profile` - Obter perfil completo
- ✅ **PATCH** `/api/users/profile` - Atualizar campos do perfil
- ✅ **POST** `/api/users/profile/photo` - Upload de foto
- ✅ **DELETE** `/api/users/profile/photo` - Remover foto

### 3. **Validações Rigorosas**
- ✅ Autenticação obrigatória em todas as rotas
- ✅ Validação de tipos de arquivo (apenas imagens)
- ✅ Limite de tamanho (5MB máximo)
- ✅ Validação de campos obrigatórios
- ✅ Sanitização contra XSS

### 4. **Segurança Robusta**
- ✅ Proteção contra acesso não autorizado
- ✅ Validação de tokens JWT
- ✅ Sanitização de entrada
- ✅ Proteção básica contra SQL Injection
- ✅ CSRF token validation

## 🏗️ Estrutura dos Testes

### **Setup de Autenticação**
```javascript
// 1. Obter CSRF token
// 2. Registrar usuário de teste
// 3. Fazer login e obter JWT
// 4. Armazenar credenciais para testes
```

### **Testes de Rotas Básicas**
- Todas as rotas de perfil (GET, PATCH, POST, DELETE)
- Verificação de status codes corretos
- Validação de headers de depreciação
- Teste de compatibilidade com rotas antigas

### **Testes de CRUD Completo**
```javascript
// 1. Obter perfil inicial
// 2. Atualizar com dados completos
// 3. Verificar se dados foram salvos
// 4. Testar validações com dados inválidos
```

### **Testes de Upload de Foto**
```javascript
// 1. Upload de imagem válida (PNG 1x1)
// 2. Verificar foto no perfil
// 3. Remover foto
// 4. Testar arquivo inválido
// 5. Testar upload sem arquivo
```

### **Testes de Segurança**
```javascript
// 1. Acesso sem autenticação (401/403)
// 2. Token inválido (401/403)
// 3. Sanitização XSS
// 4. Proteção SQL Injection
```

## 📊 Campos Testados

### **Campos Básicos**
- `name` - Nome do usuário
- `phone` - Telefone
- `whatsapp` - WhatsApp
- `profile_picture` - Foto de perfil

### **Campos Estendidos**
- `state` - Estado (sigla com 2 caracteres)
- `city` - Cidade
- `birth_date` - Data de nascimento (ISO8601)
- `education` - Escolaridade
- `work_status` - Situação profissional

### **Campos Especiais**
- `difficulties` - Array JSON de dificuldades
- `motivation_text` - Texto motivacional (max 1000 chars)
- `first_time` - Primeira vez fazendo concurso ('sim'/'nao')
- `concursos_count` - Quantidade de concursos já feitos

### **Campos OAuth**
- `google_id` - ID do Google
- `auth_provider` - Provedor de autenticação
- `google_avatar` - Avatar do Google

## 🚀 Como Executar

### **Execução Completa**
```bash
node test-profile-migration.js
```

### **Com Servidor Específico**
```bash
BASE_URL=http://localhost:3000 node test-profile-migration.js
```

### **Para Produção**
```bash
BASE_URL=https://app.editaliza.com.br node test-profile-migration.js
```

## 📋 Dependências Necessárias

```json
{
  "node-fetch": "^2.7.0",
  "form-data": "^4.0.4",
  "colors": "^1.4.0"
}
```

## 📈 Relatório de Resultados

### **Métricas Coletadas**
- ✅ **Total de testes executados**
- ✅ **Testes aprovados**
- ⚠️ **Avisos** (depreciação, etc.)
- ❌ **Testes falharam**
- 📊 **Taxa de sucesso geral**

### **Códigos de Saída**
- `0` - Todos os testes passaram
- `1` - Alguns testes falharam

### **Níveis de Qualidade**
- 🎉 **90%+** - EXCELENTE! Migração muito bem sucedida
- ✅ **75%+** - BOM! Bem sucedida com pontos de atenção  
- ⚠️ **50%+** - ATENÇÃO! Parcial, requer correções
- ❌ **<50%** - CRÍTICO! Problemas sérios

## 🔧 Funcionalidades Especiais

### **Criação Automática de Imagem de Teste**
```javascript
// Cria PNG transparente 1x1 pixel para testes de upload
const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...]);
```

### **Sanitização XSS**
```javascript
// Testa com payloads maliciosos
const xssData = {
    name: '<script>alert("XSS")</script>',
    motivation_text: '<img src="x" onerror="alert(\'XSS\')">'
};
```

### **Cleanup Automático**
- Remove arquivos de teste após execução
- Gerencia cookies e tokens automaticamente
- Limpa estado entre testes

## 🎯 Casos de Teste Cobertos

### **Cenários Positivos** ✅
- Login e obtenção de perfil com sucesso
- Atualização de todos os campos do perfil
- Upload de foto válida
- Remoção de foto existente
- Compatibilidade com rotas antigas

### **Cenários Negativos** ❌
- Acesso sem autenticação
- Token inválido
- Upload de arquivo não-imagem
- Upload sem arquivo
- Dados inválidos (validações)
- Tentativas de XSS e SQL Injection

### **Cenários Edge Case** 🔍
- Campos opcionais undefined/null
- Arrays vazios em `difficulties`
- Strings muito longas
- Datas em formatos inválidos
- Estados com mais de 2 caracteres

## 🔄 Rotas Testadas

### **Rotas Novas** (Padronizadas)
- `GET /api/users/profile`
- `PATCH /api/users/profile`
- `POST /api/users/profile/photo`
- `DELETE /api/users/profile/photo`

### **Rotas Antigas** (Compatibilidade)
- `GET /api/profile` → Redirecionada
- `POST /api/profile/upload-photo` → Substituída

## 📝 Logs e Debug

### **Logs Coloridos**
- 🔵 **INFO** - Informações gerais
- 🟢 **SUCCESS** - Testes aprovados
- 🟡 **WARNING** - Avisos e depreciações
- 🔴 **ERROR** - Falhas e erros

### **Timestamps Precisos**
- Todos os logs incluem timestamp HH:MM:SS
- Rastreamento completo da execução
- Facilita debug de problemas específicos

## 🛡️ Considerações de Segurança

### **Dados de Teste Seguros**
- Email único por execução (`profile_test_${timestamp}@example.com`)
- Senha forte com caracteres especiais
- Limpeza automática após testes

### **Validações Implementadas**
- Autenticação JWT obrigatória
- CSRF token em operações de escrita
- Sanitização de entrada contra XSS
- Validação de tipos de arquivo
- Limites de tamanho apropriados

## 🔧 Manutenção e Evolução

### **Facilmente Extensível**
- Estrutura modular para novos testes
- Funções auxiliares reutilizáveis
- Configuração centralizada

### **Compatível com CI/CD**
- Códigos de saída padronizados
- Logs estruturados para parsing
- Execução não-interativa

---

**💡 Dica:** Execute os testes sempre antes de fazer deploy das alterações de perfil para garantir que nada foi quebrado na migração!