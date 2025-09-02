-- Adicionar campos de preferências de email na tabela study_plans
ALTER TABLE study_plans 
ADD COLUMN IF NOT EXISTS email_daily_schedule BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_weekly_summary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_study_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_time TIME DEFAULT '06:00:00',
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS last_email_sent TIMESTAMP;

-- Gerar tokens únicos para planos existentes
UPDATE study_plans 
SET unsubscribe_token = md5(random()::text || id::text || created_at::text)
WHERE unsubscribe_token IS NULL;

-- Criar índice para o token de unsubscribe
CREATE INDEX IF NOT EXISTS idx_study_plans_unsubscribe_token 
ON study_plans(unsubscribe_token);

-- Criar índice para buscar planos com email ativo
CREATE INDEX IF NOT EXISTS idx_study_plans_email_active
ON study_plans(email_daily_schedule) 
WHERE email_daily_schedule = true AND is_active = true;