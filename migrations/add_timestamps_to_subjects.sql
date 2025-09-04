-- Adicionar colunas de timestamp na tabela subjects
-- Data: 04/09/2025

-- Adicionar created_at com valor padrão para registros existentes
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Adicionar updated_at com valor padrão
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Atualizar registros existentes para ter created_at (se houver NULLs)
UPDATE subjects 
SET created_at = CURRENT_TIMESTAMP 
WHERE created_at IS NULL;

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger na tabela subjects
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at 
BEFORE UPDATE ON subjects 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verificar também a tabela topics
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Aplicar trigger na tabela topics também
DROP TRIGGER IF EXISTS update_topics_updated_at ON topics;
CREATE TRIGGER update_topics_updated_at 
BEFORE UPDATE ON topics 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verificar resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('subjects', 'topics') 
AND column_name IN ('created_at', 'updated_at')
ORDER BY table_name, column_name;