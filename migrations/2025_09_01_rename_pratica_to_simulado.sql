-- Migration: Renomear 'Prática Dirigida' para 'Simulado Direcionado'
-- Data: 2025-09-01
-- Descrição: Atualiza nomenclatura para melhor refletir a funcionalidade

-- 1. Backup de segurança (criar tabela temporária com dados atuais)
CREATE TEMP TABLE IF NOT EXISTS sessions_backup AS 
SELECT * FROM study_sessions 
WHERE session_type = 'Prática Dirigida';

-- 2. Atualizar session_type nas sessões existentes
UPDATE study_sessions 
SET 
    session_type = 'Simulado Direcionado',
    updated_at = CURRENT_TIMESTAMP
WHERE session_type = 'Prática Dirigida';

-- 3. Atualizar subject_name para manter consistência
UPDATE study_sessions 
SET 
    subject_name = REPLACE(subject_name, 'Prática:', 'Simulado:'),
    updated_at = CURRENT_TIMESTAMP
WHERE subject_name LIKE 'Prática:%';

-- 4. Atualizar topic_description para refletir nova nomenclatura
UPDATE study_sessions 
SET 
    topic_description = REPLACE(
        topic_description, 
        'Prática dirigida de', 
        'Simulado direcionado de'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE topic_description LIKE '%Prática dirigida de%';

-- 5. Adicionar coluna meta se não existir (para armazenar informações adicionais)
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
    END IF;
END $$;

-- 6. Popular meta para sessões de Simulado Direcionado existentes
UPDATE study_sessions 
SET 
    meta = jsonb_build_object(
        'nQuestoes', 25,
        'tempoSugerido', '30-40 min',
        'migrated', true,
        'migrationDate', CURRENT_TIMESTAMP
    )
WHERE session_type = 'Simulado Direcionado' 
AND meta IS NULL;

-- 7. Relatório de mudanças
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM study_sessions 
    WHERE session_type = 'Simulado Direcionado'
    AND meta->>'migrated' = 'true';
    
    RAISE NOTICE 'Migration concluída: % sessões atualizadas de "Prática Dirigida" para "Simulado Direcionado"', updated_count;
END $$;

-- Nota: Para reverter esta migration, execute:
-- UPDATE study_sessions SET session_type = 'Prática Dirigida' WHERE session_type = 'Simulado Direcionado';
-- UPDATE study_sessions SET subject_name = REPLACE(subject_name, 'Simulado:', 'Prática:') WHERE subject_name LIKE 'Simulado:%';