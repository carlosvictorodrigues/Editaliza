-- Migration: Adicionar coluna meta na tabela study_sessions
-- Data: 2025-09-01
-- Descrição: Adiciona coluna JSONB para armazenar metadados das sessões

-- Adicionar coluna meta se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'study_sessions' 
        AND column_name = 'meta'
    ) THEN
        ALTER TABLE study_sessions 
        ADD COLUMN meta JSONB DEFAULT NULL;
        
        -- Criar índice para performance em queries JSON
        CREATE INDEX IF NOT EXISTS idx_study_sessions_meta 
        ON study_sessions USING gin (meta);
        
        RAISE NOTICE 'Coluna meta adicionada com sucesso à tabela study_sessions';
    ELSE
        RAISE NOTICE 'Coluna meta já existe na tabela study_sessions';
    END IF;
END $$;

-- Popular meta para sessões existentes (opcional)
UPDATE study_sessions 
SET meta = jsonb_build_object(
    'migrated', true,
    'migrationDate', CURRENT_TIMESTAMP,
    'plannedMinutes', 60
)
WHERE meta IS NULL 
AND status IN ('Pendente', 'Em Progresso');

-- Relatório
DO $$
DECLARE
    total_sessions INTEGER;
    sessions_with_meta INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_sessions FROM study_sessions;
    SELECT COUNT(*) INTO sessions_with_meta FROM study_sessions WHERE meta IS NOT NULL;
    
    RAISE NOTICE 'Total de sessões: %', total_sessions;
    RAISE NOTICE 'Sessões com metadados: %', sessions_with_meta;
END $$;