-- Migration: Adicionar colunas de perfil faltantes
-- Data: 2025-09-04
-- Descrição: Adiciona colunas necessárias para o sistema de perfil de usuários

-- Adicionar colunas de perfil básico se não existirem
DO $$ 
BEGIN
    -- profile_picture
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'profile_picture') THEN
        ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500);
    END IF;

    -- phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;

    -- whatsapp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'whatsapp') THEN
        ALTER TABLE users ADD COLUMN whatsapp VARCHAR(20);
    END IF;

    -- state
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'state') THEN
        ALTER TABLE users ADD COLUMN state VARCHAR(100);
    END IF;

    -- city
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE users ADD COLUMN city VARCHAR(100);
    END IF;

    -- birth_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'birth_date') THEN
        ALTER TABLE users ADD COLUMN birth_date DATE;
    END IF;

    -- education
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'education') THEN
        ALTER TABLE users ADD COLUMN education VARCHAR(100);
    END IF;

    -- work_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'work_status') THEN
        ALTER TABLE users ADD COLUMN work_status VARCHAR(100);
    END IF;

    -- first_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'first_time') THEN
        ALTER TABLE users ADD COLUMN first_time VARCHAR(10);
    END IF;

    -- concursos_count
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'concursos_count') THEN
        ALTER TABLE users ADD COLUMN concursos_count INTEGER DEFAULT 0;
    END IF;

    -- difficulties (JSON)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'difficulties') THEN
        ALTER TABLE users ADD COLUMN difficulties TEXT;
    END IF;

    -- area_interest
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'area_interest') THEN
        ALTER TABLE users ADD COLUMN area_interest VARCHAR(100);
    END IF;

    -- level_desired
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'level_desired') THEN
        ALTER TABLE users ADD COLUMN level_desired VARCHAR(100);
    END IF;

    -- timeline_goal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'timeline_goal') THEN
        ALTER TABLE users ADD COLUMN timeline_goal VARCHAR(100);
    END IF;

    -- study_hours
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'study_hours') THEN
        ALTER TABLE users ADD COLUMN study_hours INTEGER;
    END IF;

    -- motivation_text
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'motivation_text') THEN
        ALTER TABLE users ADD COLUMN motivation_text TEXT;
    END IF;

    -- google_avatar (para usuários OAuth)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'google_avatar') THEN
        ALTER TABLE users ADD COLUMN google_avatar VARCHAR(500);
    END IF;

    -- auth_provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
        ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50);
    END IF;
END $$;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

-- Comentário sobre as colunas
COMMENT ON COLUMN users.profile_picture IS 'Caminho do avatar do usuário';
COMMENT ON COLUMN users.phone IS 'Telefone do usuário';
COMMENT ON COLUMN users.whatsapp IS 'WhatsApp do usuário';
COMMENT ON COLUMN users.state IS 'Estado do usuário';
COMMENT ON COLUMN users.city IS 'Cidade do usuário';
COMMENT ON COLUMN users.birth_date IS 'Data de nascimento';
COMMENT ON COLUMN users.education IS 'Nível de educação';
COMMENT ON COLUMN users.work_status IS 'Situação profissional';
COMMENT ON COLUMN users.first_time IS 'Primeira vez em concursos (sim/nao)';
COMMENT ON COLUMN users.concursos_count IS 'Quantidade de concursos prestados';
COMMENT ON COLUMN users.difficulties IS 'Dificuldades (JSON array)';
COMMENT ON COLUMN users.area_interest IS 'Área de interesse principal';
COMMENT ON COLUMN users.level_desired IS 'Nível desejado';
COMMENT ON COLUMN users.timeline_goal IS 'Prazo meta';
COMMENT ON COLUMN users.study_hours IS 'Horas de estudo por dia';
COMMENT ON COLUMN users.motivation_text IS 'Texto de motivação';
COMMENT ON COLUMN users.google_avatar IS 'URL do avatar do Google';
COMMENT ON COLUMN users.auth_provider IS 'Provedor de autenticação (local/google)';