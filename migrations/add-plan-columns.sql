-- Migração: Adicionar colunas de plano à tabela users
-- Data: 2025-09-02
-- Descrição: Adiciona suporte para planos Mensal, Semestral e Anual

-- Adicionar colunas de plano se não existirem
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'mensal',
ADD COLUMN IF NOT EXISTS plan_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS plan_expiry TIMESTAMP,
ADD COLUMN IF NOT EXISTS cackto_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT true;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users(plan_type);
CREATE INDEX IF NOT EXISTS idx_users_plan_status ON users(plan_status);
CREATE INDEX IF NOT EXISTS idx_users_plan_expiry ON users(plan_expiry);
CREATE INDEX IF NOT EXISTS idx_users_cackto_transaction ON users(cackto_transaction_id);

-- Adicionar comentários nas colunas
COMMENT ON COLUMN users.plan_type IS 'Tipo do plano: mensal, semestral ou anual';
COMMENT ON COLUMN users.plan_status IS 'Status do plano: active, inactive, suspended, expired';
COMMENT ON COLUMN users.plan_expiry IS 'Data de expiração do plano atual';
COMMENT ON COLUMN users.cackto_transaction_id IS 'ID da transação no Cackto que originou o plano';
COMMENT ON COLUMN users.password_reset_required IS 'Se true, força o usuário a trocar a senha no próximo login';