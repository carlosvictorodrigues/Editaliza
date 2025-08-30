-- Adicionar colunas faltantes na tabela users
-- Execute este script quando necessário para adicionar campos do perfil

-- Verificar quais colunas já existem
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users';

-- Adicionar colunas se não existirem (comentadas para segurança)
-- Descomente e execute apenas as que precisar:

-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS education VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS work_status VARCHAR(50);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS first_time BOOLEAN DEFAULT true;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS concursos_count INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS difficulties TEXT; -- JSON array as text
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS area_interest VARCHAR(200);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS level_desired VARCHAR(100);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS timeline_goal VARCHAR(50);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS study_hours VARCHAR(20);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation_text TEXT;

-- Verificar resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;