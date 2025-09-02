-- Criar tabela audit_events para registrar eventos de webhook
CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    event_data JSONB,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    
    -- Índices para performance
    INDEX idx_audit_events_type (event_type),
    INDEX idx_audit_events_category (event_category),
    INDEX idx_audit_events_created (created_at),
    INDEX idx_audit_events_status (status)
);

-- Comentário na tabela
COMMENT ON TABLE audit_events IS 'Registra todos os eventos de webhook e auditoria do sistema';
COMMENT ON COLUMN audit_events.event_type IS 'Tipo específico do evento (ex: payment.approved)';
COMMENT ON COLUMN audit_events.event_category IS 'Categoria do evento (ex: webhook, user_action)';
COMMENT ON COLUMN audit_events.event_data IS 'Dados completos do evento em JSON';
COMMENT ON COLUMN audit_events.metadata IS 'Metadados adicionais (headers, context, etc)';