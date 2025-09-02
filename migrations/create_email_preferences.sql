-- Tabela para armazenar preferências de email dos usuários
CREATE TABLE IF NOT EXISTS email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_schedule BOOLEAN DEFAULT true, -- Receber cronograma diário
    weekly_summary BOOLEAN DEFAULT true, -- Receber resumo semanal
    study_reminders BOOLEAN DEFAULT true, -- Receber lembretes de estudo
    achievement_notifications BOOLEAN DEFAULT true, -- Notificações de conquistas
    email_time TIME DEFAULT '06:00:00', -- Horário preferido para receber emails
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo', -- Timezone do usuário
    unsubscribe_token VARCHAR(255) UNIQUE, -- Token único para descadastro
    last_daily_sent TIMESTAMP, -- Última vez que o email diário foi enviado
    last_weekly_sent TIMESTAMP, -- Última vez que o resumo semanal foi enviado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Índices para otimização
CREATE INDEX idx_email_preferences_user_id ON email_preferences(user_id);
CREATE INDEX idx_email_preferences_daily_schedule ON email_preferences(daily_schedule) WHERE daily_schedule = true;
CREATE INDEX idx_email_preferences_unsubscribe_token ON email_preferences(unsubscribe_token);

-- Tabela para registrar logs de emails enviados
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL, -- 'daily_schedule', 'weekly_summary', etc
    subject VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    error_message TEXT,
    opened_at TIMESTAMP, -- Quando o email foi aberto
    clicked_at TIMESTAMP -- Quando algum link foi clicado
);

-- Índices para logs
CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_email_type ON email_logs(email_type);