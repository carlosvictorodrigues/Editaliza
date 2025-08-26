-- CORREÇÃO CRÍTICA: Adicionar colunas de reset de senha na tabela users
-- Execute este script para adicionar as colunas necessárias para password reset

-- Adicionar colunas de reset de senha
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Adicionar outras colunas importantes que podem estar faltando
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Verificar se as colunas foram adicionadas
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('reset_token', 'reset_token_expires', 'last_login', 'email_verified', 'auth_provider')
ORDER BY ordinal_position;