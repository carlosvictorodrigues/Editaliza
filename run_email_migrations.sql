-- Script consolidado para adicionar suporte a emails nos planos

-- 1. Adicionar campos de preferências de email na tabela study_plans
ALTER TABLE study_plans 
ADD COLUMN IF NOT EXISTS email_daily_schedule BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_weekly_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_study_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_time TIME DEFAULT '06:00:00',
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS last_email_sent TIMESTAMP;

-- 2. Gerar tokens únicos para planos existentes
UPDATE study_plans 
SET unsubscribe_token = md5(random()::text || id::text || created_at::text)
WHERE unsubscribe_token IS NULL;

-- 3. Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_study_plans_unsubscribe_token 
ON study_plans(unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_study_plans_email_active
ON study_plans(email_daily_schedule) 
WHERE email_daily_schedule = true AND is_active = true;

-- 4. Criar tabela de logs de emails (se não existir)
CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'sent',
    error_message TEXT,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP
);

-- 5. Criar índices para logs
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- Verificar se as colunas foram criadas com sucesso
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'study_plans'
AND column_name IN ('email_daily_schedule', 'email_weekly_summary', 'email_study_reminders', 'unsubscribe_token', 'last_email_sent');