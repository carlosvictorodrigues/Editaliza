# Testes de Autenticação - Editaliza

## Visão Geral

Esta suíte de testes foi criada para garantir a segurança e funcionalidade das rotas de autenticação (`/login` e `/register`) da aplicação Editaliza. Os testes cobrem aspectos críticos de segurança, validação de dados, rate limiting e casos extremos.

## Estrutura dos Testes

```
tests/
├── auth/                    # Testes de autenticação
│   ├── login.test.js       # Testes da rota /login
│   └── register.test.js    # Testes da rota /register
├── helpers/                # Utilitários para testes
│   └── auth-helpers.js     # Funções auxiliares para autenticação
├── database-test.js        # Configuração de banco de dados em memória
├── setup.js               # Configuração global dos testes
├── jest-setup.js          # Configuração customizada do Jest
├── test-server.js         # Servidor configurado para testes
└── README.md              # Esta documentação
```

## Como Executar os Testes

### Instalar Dependências
```bash
npm install
```

### Executar Todos os Testes
```bash
npm test
```

### Executar Apenas Testes de Autenticação
```bash
npm run test:auth
```

### Executar Testes com Relatório de Cobertura
```bash
npm run test:coverage
```

### Executar Testes em Modo Watch
```bash
npm run test:watch
```

## Cobertura de Testes

### Rota `/register`

#### ✅ Casos de Sucesso
- ✅ Registro com dados válidos
- ✅ Normalização de email
- ✅ Senhas com caracteres especiais
- ✅ Hash bcrypt correto

#### ✅ Validação de Email
- ✅ Rejeição de formatos inválidos
- ✅ Tratamento de emails duplicados
- ✅ Case-insensitive para duplicatas
- ✅ Campos obrigatórios

#### ✅ Validação de Senha
- ✅ Senhas muito curtas
- ✅ Caracteres perigosos
- ✅ Campos obrigatórios

#### ✅ Testes de Segurança
- ✅ Proteção contra XSS
- ✅ Proteção contra SQL Injection
- ✅ Sanitização de dados
- ✅ Proteção contra timing attacks
- ✅ Tratamento de headers maliciosos

#### ✅ Validação de Estrutura
- ✅ Content-Type inválido
- ✅ JSON malformado
- ✅ Campos extras não esperados

#### ✅ Casos Extremos
- ✅ Requisições simultâneas
- ✅ Caracteres unicode
- ✅ Preservação de case

### Rota `/login`

#### ✅ Casos de Sucesso
- ✅ Login com credenciais válidas
- ✅ Geração de token JWT correto
- ✅ Email case-insensitive
- ✅ Criação de sessão

#### ✅ Falhas de Autenticação
- ✅ Email inexistente
- ✅ Senha incorreta
- ✅ Mensagens genéricas (anti-enumeração)
- ✅ Timing consistente

#### ✅ Rate Limiting
- ✅ Bloqueio após múltiplas tentativas
- ✅ Não bloquear logins válidos
- ✅ Configuração correta de janela de tempo

#### ✅ Segurança do Token
- ✅ Estrutura JWT correta
- ✅ Claims obrigatórios
- ✅ Expiração apropriada
- ✅ Não vazar informações sensíveis

#### ✅ Testes de Segurança
- ✅ Proteção contra XSS
- ✅ Proteção contra SQL Injection
- ✅ Token seguro
- ✅ Headers maliciosos

#### ✅ Funcionalidade com Token
- ✅ Acesso a rotas protegidas
- ✅ Rejeição de tokens inválidos
- ✅ Tratamento de tokens expirados

## Aspectos de Segurança Testados

### 1. **Autenticação Robusta**
- Validação de credenciais
- Hash seguro de senhas (bcrypt com salt 12)
- Tokens JWT com expiração

### 2. **Proteção contra Ataques**
- **XSS**: Sanitização de inputs
- **SQL Injection**: Prepared statements e validação
- **Timing Attacks**: Tempo consistente para operações
- **Brute Force**: Rate limiting configurável

### 3. **Validação de Dados**
- Formatos de email rigorosos
- Senhas com critérios mínimos
- Sanitização automática de entradas

### 4. **Rate Limiting**
- 5 tentativas por 15 minutos para login
- Não aplicado a logins bem-sucedidos
- Configurável via headers de teste

### 5. **Gerenciamento de Sessão**
- Cookies HTTPOnly
- Configuração de expiração
- Limpeza adequada no logout

## Configuração de Teste

### Variáveis de Ambiente
```env
NODE_ENV=test
JWT_SECRET=test-secret-key-for-jwt-tokens-in-testing-environment
JWT_REFRESH_SECRET=test-refresh-secret-key-for-jwt-refresh-tokens
SESSION_SECRET=test-session-secret-key-for-express-sessions
```

### Banco de Dados
- SQLite em memória para testes rápidos
- Schema idêntico ao de produção
- Limpeza automática entre testes

### Rate Limiting em Testes
- Use header `x-test-rate-limit: true` para ativar rate limiting específico nos testes
- Por padrão, rate limiting é desabilitado em testes

## Utilitários de Teste

### Criação de Usuários
```javascript
const userData = await createTestUser('test@example.com', 'password123');
```

### Login e Obtenção de Token
```javascript
const token = await loginAndGetToken(app, userData);
```

### Requisições Autenticadas
```javascript
const response = await makeAuthenticatedRequest(app, 'get', '/protected', token);
```

### Validação de Respostas
```javascript
expectSuccessResponse(response, 200);
expectErrorResponse(response, 401, /inválidos/i);
```

## Métricas de Qualidade

### Resultados dos Testes
- ✅ **51 testes passando**
- ✅ **0 testes falhando**
- ✅ **Tempo médio**: ~23 segundos
- ✅ **Suites de teste**: 2

### Casos de Teste por Categoria
- **Casos de Sucesso**: 8 testes
- **Validação de Entrada**: 15 testes
- **Segurança**: 14 testes
- **Rate Limiting**: 3 testes
- **Funcionalidade**: 6 testes
- **Casos Extremos**: 5 testes

## Melhores Práticas Implementadas

### 1. **Isolamento de Testes**
- Cada teste é independente
- Limpeza de dados entre testes
- Setup/teardown apropriados

### 2. **Dados de Teste Realistas**
- Payloads maliciosos reais
- Casos extremos comuns
- Dados aleatórios para evitar conflitos

### 3. **Assertões Robustas**
- Verificação de estruturas de resposta
- Validação de dados no banco
- Checks de segurança automatizados

### 4. **Performance**
- Testes rápidos (média <1s por teste)
- Banco em memória
- Execução paralela quando possível

## Próximos Passos

Para expandir a cobertura de testes, considere adicionar:

1. **Testes de Integração**
   - Fluxos completos de autenticação
   - Interação com outras rotas protegidas

2. **Testes de Performance**
   - Load testing das rotas de auth
   - Benchmarks de tempo de resposta

3. **Testes de Acessibilidade**
   - Respostas de erro amigáveis
   - Mensagens internacionalizadas

4. **Testes de Compliance**
   - LGPD/GDPR para dados de usuário
   - Padrões de segurança específicos

## Troubleshooting

### Testes Falhando
1. Verificar se todas as dependências estão instaladas
2. Confirmar variáveis de ambiente
3. Verificar se portas estão livres

### Performance Lenta
1. Verificar se banco está sendo limpo corretamente
2. Revisar timeouts de teste
3. Considerar execução em paralelo

### Problemas de Rate Limiting
1. Usar header `x-test-rate-limit` quando necessário
2. Aguardar reset entre testes se necessário
3. Verificar configuração de janela de tempo