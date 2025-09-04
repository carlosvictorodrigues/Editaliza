-- Criar tabela para preferências de email do usuário (PRODUÇÃO)
CREATE TABLE IF NOT EXISTS user_email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_daily_schedule BOOLEAN DEFAULT true,
    email_weekly_summary BOOLEAN DEFAULT true, 
    email_study_reminders BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Criar índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON user_email_preferences(user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_email_preferences_updated_at 
BEFORE UPDATE ON user_email_preferences 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verificar se a tabela foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_email_preferences';