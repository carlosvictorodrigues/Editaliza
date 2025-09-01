-- Migração: Adicionar user_id à tabela study_sessions
-- Data: 2025-08-31
-- Objetivo: Garantir isolamento de dados por usuário

-- 1. Adicionar coluna user_id (permite NULL temporariamente)
ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 2. Popular com dados existentes baseado no relacionamento com study_plans
UPDATE study_sessions ss
SET user_id = sp.user_id
FROM study_plans sp
WHERE ss.study_plan_id = sp.id
AND ss.user_id IS NULL;

-- 3. Adicionar constraint de foreign key
ALTER TABLE study_sessions
ADD CONSTRAINT fk_study_sessions_user 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 4. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id 
ON study_sessions(user_id);

-- 5. Criar índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_plan 
ON study_sessions(user_id, study_plan_id);

-- Verificar resultado
SELECT 
    COUNT(*) as total_sessions,
    COUNT(user_id) as sessions_with_user,
    COUNT(DISTINCT user_id) as unique_users
FROM study_sessions;