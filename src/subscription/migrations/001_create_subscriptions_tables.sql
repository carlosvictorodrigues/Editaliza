-- 001_create_subscriptions_tables.sql
-- Criação das tabelas do sistema de assinaturas

-- Tabela principal de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    kiwify_transaction_id TEXT UNIQUE NOT NULL,
    kiwify_product_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'suspended', 'expired', 'refunded', 'trialing')),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    payment_method TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    checksum TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_kiwify_transaction ON subscriptions(kiwify_transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at);

-- Tabela de eventos de auditoria imutável
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id INTEGER,
    details TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    created_at TEXT NOT NULL,
    hash TEXT NOT NULL,
    blockchain_hash TEXT NOT NULL
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit_events(severity);

-- Tabela de logs de auditoria de assinatura (legacy)
CREATE TABLE IF NOT EXISTS subscription_audit_logs (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id INTEGER,
    details TEXT NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Índices para logs de assinatura
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_subscription_id ON subscription_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_created_at ON subscription_audit_logs(created_at);

-- Tabela de eventos de webhook
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    processing_id TEXT,
    validation_id TEXT,
    attempt INTEGER NOT NULL DEFAULT 1,
    processing_time INTEGER,
    error TEXT,
    ip_address TEXT,
    user_agent TEXT,
    result TEXT,
    created_at TEXT NOT NULL
);

-- Índices para webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- Tabela de dead letter queue para webhooks falhados
CREATE TABLE IF NOT EXISTS webhook_dead_letter_queue (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    last_error TEXT NOT NULL,
    failed_at TEXT NOT NULL,
    original_processing_id TEXT
);

-- Índices para DLQ
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_webhook_id ON webhook_dead_letter_queue(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event_type ON webhook_dead_letter_queue(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_failed_at ON webhook_dead_letter_queue(failed_at);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS subscription_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Inserir configurações padrão
INSERT OR IGNORE INTO subscription_settings (key, value, description, updated_at) VALUES
('webhook_retry_max_attempts', '3', 'Máximo de tentativas para reprocessar webhooks', datetime('now')),
('webhook_retry_initial_delay', '1000', 'Delay inicial para retry de webhooks (ms)', datetime('now')),
('subscription_grace_period_days', '3', 'Período de graça após expiração (dias)', datetime('now')),
('cache_ttl_seconds', '300', 'TTL padrão do cache (segundos)', datetime('now')),
('audit_retention_days', '2555', 'Retenção de logs de auditoria (dias - 7 anos)', datetime('now'));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
BEGIN
    UPDATE subscriptions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger para validar integridade da assinatura
CREATE TRIGGER IF NOT EXISTS validate_subscription_integrity
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
BEGIN
    -- Verificar se a versão está sendo incrementada corretamente
    SELECT CASE
        WHEN NEW.version <= OLD.version THEN
            RAISE(ABORT, 'Versão deve ser incrementada')
    END;
END;

-- View para assinaturas ativas
CREATE VIEW IF NOT EXISTS active_subscriptions AS
SELECT 
    s.*,
    u.email as user_email,
    u.name as user_name
FROM subscriptions s
JOIN users u ON s.user_id = u.id
WHERE s.status IN ('active', 'trialing')
  AND (s.expires_at IS NULL OR s.expires_at > datetime('now'));

-- View para estatísticas de assinaturas
CREATE VIEW IF NOT EXISTS subscription_stats AS
SELECT 
    COUNT(*) as total_subscriptions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_subscriptions,
    COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_subscriptions,
    COUNT(CASE WHEN plan = 'premium' THEN 1 END) as premium_subscriptions,
    COUNT(CASE WHEN plan = 'premium_anual' THEN 1 END) as premium_annual_subscriptions,
    SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as active_revenue,
    AVG(CASE WHEN status = 'active' THEN amount END) as average_subscription_value
FROM subscriptions;

-- View para auditoria de segurança
CREATE VIEW IF NOT EXISTS security_audit_summary AS
SELECT 
    DATE(created_at) as audit_date,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM audit_events
WHERE entity_type IN ('SUBSCRIPTION_ACCESS', 'WEBHOOK_VALIDATION', 'SECURITY')
GROUP BY DATE(created_at), severity
ORDER BY audit_date DESC, severity;

-- View para monitoramento de webhooks
CREATE VIEW IF NOT EXISTS webhook_health_summary AS
SELECT 
    event_type,
    status,
    COUNT(*) as event_count,
    AVG(processing_time) as avg_processing_time,
    MAX(processing_time) as max_processing_time,
    COUNT(CASE WHEN attempt > 1 THEN 1 END) as retry_count
FROM webhook_events
WHERE created_at > datetime('now', '-24 hours')
GROUP BY event_type, status
ORDER BY event_type, status;