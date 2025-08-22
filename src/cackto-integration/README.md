# Integração CACKTO - Editaliza

Esta implementação substitui completamente a integração anterior com Kiwify, adaptando todo o sistema de assinaturas para trabalhar com a processadora de pagamentos CACKTO.

## 📋 Visão Geral

A integração CACKTO fornece:
- ✅ Processamento robusto de webhooks
- ✅ Gerenciamento completo de assinaturas
- ✅ Validação criptográfica de segurança
- ✅ Rate limiting e proteção contra ataques
- ✅ Circuit breaker para resiliência
- ✅ Sistema de auditoria completo
- ✅ Cache para performance
- ✅ Retry automático e dead letter queue
- ✅ Sincronização bidirecional

## 🏗️ Estrutura do Projeto

```
/src/cackto-integration/
├── config/
│   └── cackto.config.js          # Configurações centralizadas
├── services/
│   ├── cacktoService.js          # Cliente API CACKTO
│   └── subscriptionManager.js    # Gerenciador de assinaturas
├── webhooks/
│   ├── validator.js              # Validação de webhooks
│   ├── processor.js              # Processamento de eventos
│   └── handlers/                 # Handlers específicos por evento
├── middleware/
│   └── checkCacktoSubscription.js # Middleware de verificação
├── routes/
│   └── webhooks.js               # Rotas de webhook
├── migrations/
│   └── 001_migrate_to_cackto.sql # Migração SQL
└── scripts/
    └── migrate-to-cackto.js      # Script de migração
```

## 🚀 Configuração Inicial

### 1. Variáveis de Ambiente

```bash
# Credenciais CACKTO (obrigatórias)
CACKTO_API_KEY=sua_api_key_aqui
CACKTO_SECRET_KEY=sua_secret_key_aqui
CACKTO_WEBHOOK_SECRET=sua_webhook_secret_aqui

# URLs da API (opcional)
CACKTO_API_URL=https://api.cackto.com

# IDs dos produtos CACKTO (recomendado)
CACKTO_PRODUCT_MENSAL=id_produto_mensal
CACKTO_PRODUCT_SEMESTRAL=id_produto_semestral  
CACKTO_PRODUCT_ANUAL=id_produto_anual
```

### 2. Executar Migração

```bash
# Migração automática (recomendado)
node src/cackto-integration/scripts/migrate-to-cackto.js

# Ou migração manual SQL
sqlite3 database.sqlite < src/cackto-integration/migrations/001_migrate_to_cackto.sql
```

### 3. Configurar Webhook na CACKTO

Configure o endpoint na sua conta CACKTO:
```
URL: https://seudominio.com/api/webhooks/cackto
Eventos: Todos os eventos de pagamento e assinatura
```

## 📡 Eventos Suportados

### Eventos de Pagamento
- `payment.approved` → Pagamento aprovado
- `payment.rejected` → Pagamento rejeitado  
- `payment.cancelled` → Pagamento cancelado
- `payment.refunded` → Pagamento reembolsado

### Eventos de Assinatura
- `subscription.created` → Assinatura criada
- `subscription.activated` → Assinatura ativada
- `subscription.suspended` → Assinatura suspensa
- `subscription.cancelled` → Assinatura cancelada
- `subscription.renewed` → Assinatura renovada
- `subscription.expired` → Assinatura expirada

### Eventos de Chargeback
- `chargeback.created` → Chargeback criado
- `chargeback.resolved` → Chargeback resolvido

## 🛡️ Segurança

### Validação de Webhooks
1. **Validação de IP**: Apenas IPs autorizados da CACKTO
2. **Validação de Timestamp**: Proteção contra replay attacks
3. **Validação de Assinatura**: HMAC SHA-256 com secret
4. **Validação de Estrutura**: Schema validation dos payloads
5. **Idempotência**: Prevenção de processamento duplicado

### Rate Limiting
- 200 requests por minuto por IP para webhooks
- 100 requests por minuto para API calls
- Configurável via config

## 🔄 Uso da API

### Verificar Assinatura do Usuário

```javascript
const CacktoSubscriptionManager = require('./src/cackto-integration/services/subscriptionManager');

// Verificar status da assinatura
const status = await CacktoSubscriptionManager.checkUserSubscription(userId);

console.log({
    hasActiveSubscription: status.hasActiveSubscription,
    plan: status.plan,
    expiresAt: status.expiresAt,
    status: status.status
});
```

### Middleware de Proteção

```javascript
const { checkCacktoSubscription, requirePremiumFeature } = require('./src/cackto-integration/middleware/checkCacktoSubscription');

// Verificação básica de assinatura
app.use('/premium', checkCacktoSubscription());

// Verificação de funcionalidade específica
app.use('/api/pdf-download', requirePremiumFeature('pdf_download'));

// Verificação estrita para APIs
app.use('/api/advanced', requireActiveSubscriptionStrict());
```

### Cancelar Assinatura

```javascript
const result = await CacktoSubscriptionManager.cancelUserSubscription(
    userId, 
    'user_request'
);

console.log(result);
// {
//     success: true,
//     subscriptionId: 123,
//     cancelledAt: "2024-01-01T00:00:00.000Z",
//     message: "Assinatura cancelada com sucesso"
// }
```

## 📊 Monitoramento

### Health Check
```bash
GET /api/webhooks/cackto/health
```

### Estatísticas
```bash
GET /api/webhooks/cackto/stats?timeframe=24h
```

### Logs de Auditoria
Todos os eventos são automaticamente logados na tabela `audit_events` com:
- Timestamps precisos
- Detalhes completos da operação
- IP e User-Agent
- Severity levels

## 🔧 Configurações Avançadas

### Circuit Breaker
```javascript
// config/cackto.config.js
circuitBreaker: {
    maxFailures: 5,           // Máximo de falhas antes de abrir
    resetTimeout: 60000,      // Tempo para tentar fechar (ms)
    monitoringWindow: 300000  // Janela de monitoramento (ms)
}
```

### Cache TTL
```javascript
cache: {
    ttl: {
        subscription: 300,    // 5 minutos
        transaction: 600,     // 10 minutos  
        productInfo: 3600     // 1 hora
    }
}
```

### Retry Policy
```javascript
queue: {
    retryAttempts: 3,                    // Tentativas de retry
    retryBackoff: 'exponential',         // Estratégia de backoff
    deadLetterRetention: 7 * 24 * 60 * 60 * 1000, // 7 dias
    batchSize: 10                        // Tamanho do batch
}
```

## 🧪 Testes

### Webhook de Teste (Development)
```bash
POST /api/webhooks/cackto/test
Content-Type: application/json

{
    "event": "payment.approved",
    "data": {
        "id": "test_123",
        "amount": 97.00,
        "customer": {
            "email": "test@example.com",
            "name": "Test User"
        },
        "product": {
            "id": "editaliza-premium-mensal"
        }
    }
}
```

### Sync Manual
```bash
POST /api/webhooks/cackto/sync/123
Authorization: Bearer your_admin_token
```

## 📈 Métricas

### Principais KPIs Monitorados
- Total de assinaturas ativas
- Taxa de churn
- Revenue total e médio
- Tempo de processamento de webhooks
- Taxa de erro de API calls
- Performance do circuit breaker

### Queries Úteis

```sql
-- Assinaturas ativas por plano
SELECT plan, COUNT(*) as active_count, SUM(amount) as revenue
FROM subscriptions 
WHERE status = 'active' AND cackto_transaction_id IS NOT NULL
GROUP BY plan;

-- Eventos de webhook nas últimas 24h
SELECT event_type, status, COUNT(*) as count
FROM webhook_events 
WHERE created_at > datetime('now', '-1 day')
AND payment_processor = 'cackto'
GROUP BY event_type, status;

-- Taxa de sucesso de webhooks
SELECT 
    ROUND(
        (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*)), 2
    ) as success_rate
FROM webhook_events 
WHERE created_at > datetime('now', '-1 day');
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Webhook não sendo processado**
   - Verificar IPs autorizados
   - Validar webhook secret
   - Checar logs de erro

2. **Assinatura não sincronizando**
   - Verificar API keys
   - Validar mapeamento de produtos
   - Forçar sync manual

3. **Rate limit atingido**
   - Verificar configurações de rate limiting
   - Implementar backoff exponencial
   - Distribuir carga

### Logs Importantes

```bash
# Logs de webhook
SELECT * FROM audit_events 
WHERE entity_type LIKE 'CACKTO_%' 
ORDER BY created_at DESC LIMIT 100;

# Logs de API calls
SELECT * FROM audit_events 
WHERE entity_type = 'CACKTO_API_CALL'
AND severity = 'ERROR'
ORDER BY created_at DESC;
```

## 🔮 Roadmap

- [ ] Dashboard de métricas em tempo real
- [ ] Webhooks bidirecionais 
- [ ] Retry inteligente com ML
- [ ] Integração com sistema de notificações
- [ ] API GraphQL para consultas complexas
- [ ] Suporte a múltiplas moedas
- [ ] Integrações com sistemas de CRM

## 🤝 Contribuição

Para contribuir com melhorias:

1. Crie uma branch feature
2. Implemente testes unitários
3. Documente mudanças
4. Submeta pull request

## 📞 Suporte

Para questões técnicas:
- Consulte os logs de auditoria
- Verifique health checks
- Use endpoints de debug em development

---

**⚠️ Importante**: Esta integração substitui completamente o sistema anterior. Certifique-se de executar a migração em ambiente de teste primeiro.