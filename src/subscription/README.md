# Sistema de Assinaturas Kiwify - Editaliza

## Visão Geral

Sistema robusto e seguro de assinaturas integrado com Kiwify para a plataforma Editaliza. Implementa validação criptográfica de webhooks, controle de acesso baseado em planos, auditoria completa e compliance com LGPD.

## Características Principais

### 🔒 Segurança Robusta
- **Validação Criptográfica**: Verificação HMAC-SHA256 de todos os webhooks
- **Rate Limiting**: Proteção contra ataques DDoS e spam
- **IP Whitelisting**: Apenas IPs autorizados do Kiwify
- **Idempotência**: Prevenção de processamento duplicado
- **Circuit Breaker**: Proteção contra falhas em cascata

### 📊 Auditoria e Compliance
- **Logs Imutáveis**: Sistema de auditoria com hash blockchain
- **LGPD Compliance**: Direito ao esquecimento e exportação de dados
- **Rastreamento Completo**: Todos os eventos são logados
- **Retenção Configurável**: Políticas de retenção flexíveis

### ⚡ Performance e Confiabilidade
- **Cache Inteligente**: Redis + fallback em memória
- **Fila de Retry**: Reprocessamento automático com backoff exponencial
- **Dead Letter Queue**: Tratamento de falhas persistentes
- **Monitoramento**: Health checks e métricas em tempo real

### 🎯 Controle de Acesso
- **Middleware Robusto**: Verificação em múltiplas camadas
- **Features por Plano**: Controle granular de recursos
- **Período de Graça**: Flexibilidade para renovações
- **Sincronização**: Validação periódica com Kiwify

## Estrutura do Sistema

```
src/subscription/
├── models/
│   ├── subscription.js      # Modelo principal de assinaturas
│   └── audit.js             # Sistema de auditoria imutável
├── webhooks/
│   ├── validator.js         # Validação criptográfica
│   ├── processor.js         # Processamento com retry
│   └── queue.js             # Fila de eventos
├── middleware/
│   └── subscription.js      # Middleware de autorização
├── services/
│   ├── kiwify.js            # Cliente API Kiwify
│   └── cache.js             # Sistema de cache
├── routes/
│   ├── webhooks.js          # Endpoints de webhook
│   └── subscriptions.js     # Gestão de assinaturas
├── config/
│   └── subscription.js      # Configurações centralizadas
├── migrations/
│   └── 001_create_tables.sql # Schema do banco
├── tests/
│   └── security/            # Testes de segurança
└── scripts/
    └── setup-database.js    # Setup automático
```

## Instalação e Configuração

### 1. Configuração do Banco de Dados

```bash
# Executar migrations
node src/subscription/scripts/setup-database.js --verbose
```

### 2. Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
# Kiwify API
KIWIFY_API_KEY=sua_chave_api_kiwify
KIWIFY_WEBHOOK_SECRET=seu_secret_webhook_32_chars_minimo

# Redis (opcional mas recomendado)
REDIS_URL=redis://localhost:6379

# Segurança
JWT_SECRET=jwt_secret_muito_longo_e_seguro_32_chars_minimo
```

### 3. Configuração no Kiwify

1. Acesse o painel do Kiwify
2. Vá em **Configurações > Webhooks**
3. Adicione a URL: `https://seudominio.com/api/webhooks/kiwify`
4. Configure os eventos:
   - `order.paid`
   - `order.refunded` 
   - `order.cancelled`
   - `subscription.started`
   - `subscription.cancelled`
   - `subscription.suspended`
   - `subscription.reactivated`
5. Anote o **Secret** gerado

### 4. Inicialização

```javascript
const { subscriptionSystem } = require('./src/subscription');

// Inicializar sistema
await subscriptionSystem.initialize({
    verbose: true,
    skipHealthCheck: false
});

// Integrar com Express
app.use(subscriptionSystem.getApp());
```

## Uso

### Middleware de Verificação

```javascript
const { middleware } = require('./src/subscription');

// Verificar assinatura ativa
app.get('/premium-feature', 
    middleware.Subscription.requireActiveSubscription(),
    (req, res) => {
        // Usuário tem assinatura ativa
        res.json({ hasAccess: true });
    }
);

// Verificar recursos específicos
app.get('/advanced-feature',
    middleware.Subscription.requireFeatures(['analises_detalhadas']),
    (req, res) => {
        // Usuário tem acesso ao recurso
        res.json({ feature: 'advanced' });
    }
);

// Rate limiting por plano
app.use('/api',
    middleware.Subscription.planBasedRateLimit({
        free: { requests: 10, window: 60000 },
        premium: { requests: 100, window: 60000 }
    })
);
```

### Verificação Manual

```javascript
const { models } = require('./src/subscription');

// Verificar se usuário tem assinatura
const hasSubscription = await models.Subscription.hasActiveSubscription(userId);

// Buscar assinatura ativa
const subscription = await models.Subscription.findActiveByUserId(userId);

// Listar assinaturas (admin)
const result = await models.Subscription.list({
    page: 1,
    limit: 50,
    status: 'active'
});
```

### Auditoria e Compliance

```javascript
const { models } = require('./src/subscription');

// Exportar dados do usuário (LGPD)
const userData = await models.Audit.exportUserData(userId);

// Direito ao esquecimento
const result = await models.Audit.forgetUser(userId, {
    reason: 'USER_REQUEST',
    retainAudit: true
});

// Gerar relatório de compliance
const report = await models.Audit.generateComplianceReport({
    startDate: '2024-01-01',
    endDate: '2024-12-31'
});
```

## Planos Disponíveis

### Gratuito
- Cronograma básico
- 5 simulados por mês
- Suporte por comunidade

### Premium Mensal (R$ 97,00)
- Cronograma personalizado
- Simulados ilimitados
- Análises detalhadas
- Suporte prioritário
- Exportação de dados

### Premium Anual (R$ 970,00)
- Todos os recursos Premium
- Acesso antecipado
- Consultoria personalizada
- 16,7% de desconto

## Monitoramento

### Health Check

```bash
# Verificar saúde do sistema
curl https://seudominio.com/api/subscription-system/health
```

### Métricas

```bash
# Estatísticas de webhooks
curl https://seudominio.com/api/webhooks/stats?timeframe=24h

# Estatísticas de assinaturas
curl https://seudominio.com/api/subscriptions/admin/stats
```

### Logs

Todos os eventos são registrados com diferentes níveis:
- `DEBUG`: Chamadas de API
- `INFO`: Operações normais
- `WARN`: Eventos importantes
- `ERROR`: Falhas e erros

## Segurança

### Validação de Webhooks

1. **Verificação de IP**: Apenas IPs oficiais do Kiwify
2. **Verificação de Timestamp**: Proteção contra replay attacks
3. **Validação de Assinatura**: HMAC-SHA256 com secret
4. **Idempotência**: Prevenção de processamento duplicado
5. **Rate Limiting**: Proteção contra spam

### Controle de Acesso

1. **Cache Inteligente**: TTL configurável por tipo
2. **Verificação em Múltiplas Camadas**: Banco + Cache + Kiwify
3. **Fail-Safe**: Comportamento definido para falhas
4. **Auditoria Completa**: Todos os acessos são logados

### Compliance LGPD

1. **Direito ao Esquecimento**: Anonimização de dados
2. **Portabilidade**: Exportação em formato estruturado
3. **Logs Imutáveis**: Auditoria com hash blockchain
4. **Retenção**: Políticas configuráveis (padrão: 7 anos)

## Tratamento de Erros

### Webhook Falhou
1. Retry automático com backoff exponencial
2. Máximo 3 tentativas por padrão
3. Dead Letter Queue para falhas persistentes
4. Alertas para administradores
5. Reprocessamento manual disponível

### Kiwify Indisponível
1. Circuit breaker automático
2. Cache com TTL estendido
3. Modo degradado com funcionalidades básicas
4. Sincronização automática quando voltar

### Redis Indisponível
1. Fallback automático para cache em memória
2. Performance reduzida mas funcional
3. Reconexão automática

## Desenvolvimento

### Executar Testes

```bash
# Todos os testes
npm test

# Testes de segurança
npm run test:security

# Testes de integração
npm run test:integration
```

### Teste de Webhook

```bash
# Enviar webhook de teste (desenvolvimento)
curl -X POST http://localhost:3000/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order.paid",
    "data": {
      "customer": { "email": "test@example.com" },
      "product": { "code": "editaliza-premium-mensal" },
      "total_amount": 97.00
    }
  }'
```

### Debug

```bash
# Modo verbose
DEBUG=subscription:* npm start

# Verificar fila de webhooks
node -e "console.log(require('./src/subscription').services.Queue.getQueueStats())"
```

## Produção

### Checklist de Deploy

- [ ] Configurar Redis em produção
- [ ] Configurar variáveis de ambiente
- [ ] Executar migrations do banco
- [ ] Configurar webhooks no Kiwify
- [ ] Configurar monitoramento
- [ ] Configurar alertas
- [ ] Testar conectividade
- [ ] Verificar health checks

### Monitoramento Recomendado

1. **Uptime**: Health check a cada 30 segundos
2. **Performance**: Tempo de resposta < 2 segundos
3. **Erros**: Taxa de erro < 1%
4. **Webhooks**: Falhas > 5 em 5 minutos
5. **Cache**: Hit rate > 80%

### Backup

```bash
# Backup manual
node src/subscription/scripts/backup.js

# Backup automático (cron)
0 2 * * * /usr/bin/node /path/to/subscription/scripts/backup.js
```

## Suporte

Para dúvidas ou problemas:

1. Verifique os logs de auditoria
2. Execute health check
3. Consulte métricas de webhook
4. Verifique configuração do Kiwify
5. Entre em contato com o suporte técnico

## Licença

Este sistema é proprietário da Editaliza e não deve ser redistribuído sem autorização.