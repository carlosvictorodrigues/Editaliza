-- CORREÇÃO CRÍTICA: Script para adicionar colunas faltantes na tabela study_sessions
-- Este script resolve o erro: "coluna 'subject_name' não existe" na geração de cronogramas
-- Execute este script no PostgreSQL local para corrigir o problema

-- PROBLEMA IDENTIFICADO: O código tenta inserir colunas que não existem na tabela study_sessions
-- Colunas que faltam: subject_name, topic_description, questions_solved, time_studied_seconds, postpone_count

CONSOLE.LOG('🔧 Iniciando correção da estrutura da tabela study_sessions...');

-- Adicionar colunas que estão sendo usadas pelo código mas não existem na tabela
ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS subject_name VARCHAR(255);

ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS topic_description TEXT;

-- Adicionar outras colunas necessárias baseadas no código do server.js
ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS questions_solved INTEGER DEFAULT 0;

ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS time_studied_seconds INTEGER DEFAULT 0;

ALTER TABLE study_sessions 
ADD COLUMN IF NOT EXISTS postpone_count INTEGER DEFAULT 0;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_study_sessions_subject_name ON study_sessions(subject_name);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status);
CREATE INDEX IF NOT EXISTS idx_study_sessions_session_type ON study_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_study_sessions_topic_id ON study_sessions(topic_id);

-- Verificar se as alterações foram aplicadas corretamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'study_sessions' 
  AND column_name IN ('subject_name', 'topic_description', 'questions_solved', 'time_studied_seconds', 'postpone_count')
ORDER BY ordinal_position;

-- Também adicionar as tabelas que podem estar faltando para o modo reta final
CREATE TABLE IF NOT EXISTS reta_final_exclusions (
    id SERIAL PRIMARY KEY,
    study_plan_id INTEGER NOT NULL,
    topic_id INTEGER,
    subject_name VARCHAR(255),
    topic_description TEXT,
    priority_combined DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reta_final_excluded_topics (
    id SERIAL PRIMARY KEY,
    study_plan_id INTEGER NOT NULL,
    subject_name VARCHAR(255),
    topic_name VARCHAR(500),
    importance INTEGER,
    priority_weight DECIMAL(5,2),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
);

-- Adicionar tabela para logs de tempo de estudo
CREATE TABLE IF NOT EXISTS study_time_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER,
    duration_seconds INTEGER NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
);

-- Criar índices para as novas tabelas
CREATE INDEX IF NOT EXISTS idx_reta_final_exclusions_plan_id ON reta_final_exclusions(study_plan_id);
CREATE INDEX IF NOT EXISTS idx_reta_final_excluded_topics_plan_id ON reta_final_excluded_topics(study_plan_id);
CREATE INDEX IF NOT EXISTS idx_study_time_logs_session_id ON study_time_logs(session_id);

-- Verificar estrutura final das tabelas
SELECT 'study_sessions' AS table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'study_sessions' 
UNION ALL
SELECT 'reta_final_exclusions' AS table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'reta_final_exclusions' 
UNION ALL
SELECT 'reta_final_excluded_topics' AS table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'reta_final_excluded_topics'
ORDER BY table_name, column_name;