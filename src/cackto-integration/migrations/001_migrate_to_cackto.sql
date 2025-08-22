-- 001_migrate_to_cackto.sql - Migração para adaptar tabelas existentes para CACKTO

-- Renomear coluna kiwify_transaction_id para cackto_transaction_id na tabela subscriptions
ALTER TABLE subscriptions RENAME COLUMN kiwify_transaction_id TO cackto_transaction_id;

-- Adicionar índice para a nova coluna
CREATE INDEX IF NOT EXISTS idx_subscriptions_cackto_transaction_id 
ON subscriptions(cackto_transaction_id);

-- Atualizar tabela de eventos de webhook para suportar CACKTO
-- Adicionar coluna para distinguir entre diferentes processadores de pagamento
ALTER TABLE webhook_events ADD COLUMN payment_processor TEXT DEFAULT 'cackto';

-- Atualizar registros existentes para marcar como vindos do Kiwify (se houver)
UPDATE webhook_events 
SET payment_processor = 'kiwify' 
WHERE payment_processor IS NULL OR payment_processor = 'cackto';

-- Adicionar coluna para armazenar dados específicos do processador
ALTER TABLE webhook_events ADD COLUMN processor_data TEXT;

-- Criar tabela de configurações da integração CACKTO
CREATE TABLE IF NOT EXISTS cackto_integration_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configurações padrão
INSERT OR IGNORE INTO cackto_integration_config (config_key, config_value, description, is_sensitive) VALUES
('webhook_endpoint_active', 'true', 'Se o endpoint de webhook CACKTO está ativo', 0),
('signature_validation_enabled', 'true', 'Se a validação de assinatura está habilitada', 0),
('ip_validation_enabled', 'true', 'Se a validação de IP está habilitada', 0),
('max_retry_attempts', '3', 'Número máximo de tentativas de reprocessamento', 0),
('webhook_timeout_seconds', '30', 'Timeout para processamento de webhooks em segundos', 0),
('grace_period_days', '7', 'Dias de período de graça após expiração', 0),
('auto_sync_enabled', 'true', 'Se a sincronização automática está habilitada', 0),
('sync_interval_hours', '24', 'Intervalo de sincronização automática em horas', 0);

-- Criar tabela de mapeamento de produtos CACKTO para planos internos
CREATE TABLE IF NOT EXISTS cackto_product_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cackto_product_id TEXT UNIQUE NOT NULL,
    internal_plan_code TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL',
    billing_cycle TEXT NOT NULL, -- monthly, semiannual, annual
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir mapeamentos padrão (os IDs reais devem vir das variáveis de ambiente)
INSERT OR IGNORE INTO cackto_product_mapping 
(cackto_product_id, internal_plan_code, plan_name, price, billing_cycle) VALUES
('CACKTO_PRODUCT_MENSAL_PLACEHOLDER', 'editaliza-premium-mensal', 'Editaliza Premium Mensal', 97.00, 'monthly'),
('CACKTO_PRODUCT_SEMESTRAL_PLACEHOLDER', 'editaliza-premium-semestral', 'Editaliza Premium Semestral', 497.00, 'semiannual'),
('CACKTO_PRODUCT_ANUAL_PLACEHOLDER', 'editaliza-premium-anual', 'Editaliza Premium Anual', 897.00, 'annual');

-- Criar tabela de logs de sincronização com CACKTO
CREATE TABLE IF NOT EXISTS cackto_sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    cackto_subscription_id TEXT,
    sync_type TEXT NOT NULL, -- manual, automatic, webhook
    sync_status TEXT NOT NULL, -- started, completed, failed
    changes_detected TEXT, -- JSON com as mudanças detectadas
    error_message TEXT,
    sync_duration_ms INTEGER,
    triggered_by TEXT, -- user_id ou 'system'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_cackto_sync_logs_subscription_id 
ON cackto_sync_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_cackto_sync_logs_created_at 
ON cackto_sync_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_cackto_sync_logs_sync_status 
ON cackto_sync_logs(sync_status);

-- Criar tabela para rate limiting de webhooks
CREATE TABLE IF NOT EXISTS webhook_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL, -- 'cackto' ou 'kiwify'
    request_count INTEGER DEFAULT 1,
    window_start DATETIME NOT NULL,
    window_end DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rate limiting
CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_ip_endpoint 
ON webhook_rate_limits(ip_address, endpoint);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window 
ON webhook_rate_limits(window_start, window_end);

-- Criar tabela de métricas de integração
CREATE TABLE IF NOT EXISTS integration_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_type TEXT NOT NULL, -- counter, gauge, histogram
    tags TEXT, -- JSON com tags adicionais
    processor TEXT DEFAULT 'cackto', -- cackto, kiwify
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_integration_metrics_name_processor 
ON integration_metrics(metric_name, processor);

CREATE INDEX IF NOT EXISTS idx_integration_metrics_recorded_at 
ON integration_metrics(recorded_at);

-- Atualizar tabela de auditoria para incluir dados do CACKTO
-- Adicionar coluna para distinguir eventos por processador
ALTER TABLE audit_events ADD COLUMN payment_processor TEXT DEFAULT 'cackto';

-- Marcar eventos existentes como sendo do sistema anterior (se houver)
UPDATE audit_events 
SET payment_processor = 'legacy' 
WHERE payment_processor = 'cackto' AND entity_type LIKE '%KIWIFY%';

-- Criar view para estatísticas rápidas de assinaturas CACKTO
CREATE VIEW IF NOT EXISTS cackto_subscription_stats AS
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
    COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_subscriptions,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_subscriptions,
    SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as active_revenue,
    SUM(amount) as total_revenue,
    AVG(amount) as average_amount,
    plan,
    currency
FROM subscriptions 
WHERE cackto_transaction_id IS NOT NULL
GROUP BY plan, currency;

-- Criar view para estatísticas de webhooks por período
CREATE VIEW IF NOT EXISTS cackto_webhook_stats AS
SELECT 
    DATE(created_at) as date,
    event_type,
    status,
    COUNT(*) as event_count,
    AVG(processing_time) as avg_processing_time,
    MIN(processing_time) as min_processing_time,
    MAX(processing_time) as max_processing_time
FROM webhook_events 
WHERE payment_processor = 'cackto'
GROUP BY DATE(created_at), event_type, status
ORDER BY date DESC, event_type;

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_cackto_integration_config_updated_at
    AFTER UPDATE ON cackto_integration_config
    FOR EACH ROW
BEGIN
    UPDATE cackto_integration_config 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_cackto_product_mapping_updated_at
    AFTER UPDATE ON cackto_product_mapping
    FOR EACH ROW
BEGIN
    UPDATE cackto_product_mapping 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Criar tabela para cache de dados CACKTO
CREATE TABLE IF NOT EXISTS cackto_cache (
    cache_key TEXT PRIMARY KEY,
    cache_value TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índice para limpeza de cache expirado
CREATE INDEX IF NOT EXISTS idx_cackto_cache_expires_at 
ON cackto_cache(expires_at);

-- Inserir métricas iniciais
INSERT OR IGNORE INTO integration_metrics (metric_name, metric_value, metric_type, tags, processor) VALUES
('webhooks_processed_total', 0, 'counter', '{"status": "success"}', 'cackto'),
('webhooks_failed_total', 0, 'counter', '{"status": "failed"}', 'cackto'),
('subscriptions_created_total', 0, 'counter', '{}', 'cackto'),
('subscriptions_cancelled_total', 0, 'counter', '{}', 'cackto'),
('api_calls_total', 0, 'counter', '{}', 'cackto'),
('api_errors_total', 0, 'counter', '{}', 'cackto');

-- Comentários para documentação
PRAGMA table_info(subscriptions);
PRAGMA table_info(webhook_events);
PRAGMA table_info(cackto_integration_config);
PRAGMA table_info(cackto_product_mapping);
PRAGMA table_info(cackto_sync_logs);

-- Verificar se a migração foi aplicada com sucesso
SELECT 'Migração para CACKTO aplicada com sucesso!' as status;