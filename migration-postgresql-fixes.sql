-- MIGRATION: PostgreSQL Compatibility Fixes
-- Data: 26/08/2025
-- Descrição: Garantir compatibilidade completa com PostgreSQL

-- 1. Verificar se as colunas necessárias existem na tabela topics
DO $$
BEGIN
    -- Verificar e adicionar coluna status se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'status') THEN
        ALTER TABLE topics ADD COLUMN status VARCHAR(50) DEFAULT 'Pendente';
        RAISE NOTICE 'Coluna status adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna status já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna priority_weight se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'priority_weight') THEN
        ALTER TABLE topics ADD COLUMN priority_weight INTEGER DEFAULT 3;
        RAISE NOTICE 'Coluna priority_weight adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna priority_weight já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna difficulty se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'difficulty') THEN
        ALTER TABLE topics ADD COLUMN difficulty INTEGER DEFAULT 2;
        RAISE NOTICE 'Coluna difficulty adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna difficulty já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna estimated_hours se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'estimated_hours') THEN
        ALTER TABLE topics ADD COLUMN estimated_hours INTEGER DEFAULT 2;
        RAISE NOTICE 'Coluna estimated_hours adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna estimated_hours já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna completion_date se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'completion_date') THEN
        ALTER TABLE topics ADD COLUMN completion_date DATE;
        RAISE NOTICE 'Coluna completion_date adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna completion_date já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna notes se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'notes') THEN
        ALTER TABLE topics ADD COLUMN notes TEXT;
        RAISE NOTICE 'Coluna notes adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna notes já existe na tabela topics';
    END IF;
    
    -- Verificar e adicionar coluna actual_hours se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'topics' AND column_name = 'actual_hours') THEN
        ALTER TABLE topics ADD COLUMN actual_hours INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna actual_hours adicionada à tabela topics';
    ELSE
        RAISE NOTICE 'Coluna actual_hours já existe na tabela topics';
    END IF;
END
$$;

-- 2. Garantir que o tipo de dados study_hours_per_day seja JSON
DO $$
BEGIN
    -- Verificar o tipo da coluna study_hours_per_day
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'study_plans' 
               AND column_name = 'study_hours_per_day' 
               AND data_type != 'json') THEN
        
        -- Se não for JSON, converter
        ALTER TABLE study_plans ALTER COLUMN study_hours_per_day TYPE JSON USING study_hours_per_day::json;
        RAISE NOTICE 'Coluna study_hours_per_day convertida para tipo JSON';
    ELSE
        RAISE NOTICE 'Coluna study_hours_per_day já é do tipo JSON';
    END IF;
END
$$;

-- 3. Atualizar status existentes para português (se necessário)
UPDATE topics SET status = 'Pendente' WHERE status = 'pending' OR status IS NULL;
UPDATE topics SET status = 'Concluído' WHERE status = 'completed' OR status = 'done';
UPDATE topics SET status = 'Em Progresso' WHERE status = 'in_progress' OR status = 'active';

-- 4. Atualizar status das sessões para português (se necessário)
UPDATE study_sessions SET status = 'Pendente' WHERE status = 'pending';
UPDATE study_sessions SET status = 'Concluído' WHERE status = 'completed' OR status = 'done';
UPDATE study_sessions SET status = 'Pulado' WHERE status = 'skipped';
UPDATE study_sessions SET status = 'Adiado' WHERE status = 'postponed';

-- 5. Criar índices para melhor performance (se não existirem)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_priority_weight ON topics(priority_weight);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_status ON study_sessions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_plan_id ON study_sessions(study_plan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date);

-- 6. Criar constraint para validar status válidos
DO $$
BEGIN
    -- Para topics
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'topics_status_check') THEN
        ALTER TABLE topics ADD CONSTRAINT topics_status_check 
            CHECK (status IN ('Pendente', 'Concluído', 'Em Progresso'));
        RAISE NOTICE 'Constraint topics_status_check adicionada';
    ELSE
        RAISE NOTICE 'Constraint topics_status_check já existe';
    END IF;
    
    -- Para study_sessions
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'sessions_status_check') THEN
        ALTER TABLE study_sessions ADD CONSTRAINT sessions_status_check 
            CHECK (status IN ('Pendente', 'Concluído', 'Pulado', 'Adiado'));
        RAISE NOTICE 'Constraint sessions_status_check adicionada';
    ELSE
        RAISE NOTICE 'Constraint sessions_status_check já existe';
    END IF;
END
$$;

-- 7. Atualizar timestamps (se não tiverem timezone)
DO $$
BEGIN
    -- Verificar e atualizar created_at na tabela topics
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'topics' 
               AND column_name = 'created_at' 
               AND data_type = 'timestamp without time zone') THEN
        ALTER TABLE topics ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE 
            USING created_at AT TIME ZONE 'America/Sao_Paulo';
        RAISE NOTICE 'Coluna created_at da tabela topics convertida para timestamp with timezone';
    END IF;
    
    -- Verificar e atualizar updated_at na tabela topics
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'topics' 
               AND column_name = 'updated_at' 
               AND data_type = 'timestamp without time zone') THEN
        ALTER TABLE topics ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE 
            USING updated_at AT TIME ZONE 'America/Sao_Paulo';
        RAISE NOTICE 'Coluna updated_at da tabela topics convertida para timestamp with timezone';
    END IF;
END
$$;

-- 8. Atualizar valores padrão para novos registros
ALTER TABLE topics ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE topics ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE topics ALTER COLUMN status SET DEFAULT 'Pendente';
ALTER TABLE topics ALTER COLUMN priority_weight SET DEFAULT 3;
ALTER TABLE topics ALTER COLUMN difficulty SET DEFAULT 2;
ALTER TABLE topics ALTER COLUMN estimated_hours SET DEFAULT 2;

-- 9. Verificação final
SELECT 'MIGRATION COMPLETED SUCCESSFULLY' as status;

-- 10. Relatório final das tabelas
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('topics', 'study_sessions', 'study_plans')
ORDER BY table_name, ordinal_position;