-- OTIMIZAÇÕES CRÍTICAS PARA PERFORMANCE DO ENDPOINT /api/admin
-- Execute estas queries no PostgreSQL para melhorar dramaticamente a performance

-- 1. ÍNDICES ESSENCIAIS PARA TABELA USERS
-- Índice composto para paginação otimizada (ORDER BY id DESC + LIMIT/OFFSET)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_desc 
ON users (id DESC);

-- Índice para filtro por role
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
ON users (role);

-- Índice para busca por email (ILIKE otimizado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm 
ON users USING gin (email gin_trgm_ops);

-- Índice para busca por nome (ILIKE otimizado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm 
ON users USING gin (name gin_trgm_ops);

-- Índice composto para filtros combinados
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created 
ON users (role, created_at DESC);

-- 2. HABILITAR EXTENSÃO TRIGRAM PARA BUSCA OTIMIZADA
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. ESTATÍSTICAS AVANÇADAS PARA OTIMIZADOR
ANALYZE users;

-- 4. VIEW MATERIALIZADA PARA MÉTRICAS ADMINISTRATIVAS
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_user_metrics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_count,
    COUNT(CASE WHEN auth_provider = 'google' THEN 1 END) as google_users,
    COUNT(CASE WHEN auth_provider = 'email' THEN 1 END) as email_users,
    MIN(created_at) as first_user_date,
    MAX(created_at) as latest_user_date,
    NOW() as last_updated
FROM users;

-- Índice para view materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_metrics_update 
ON admin_user_metrics (last_updated);

-- 5. FUNÇÃO PARA REFRESH AUTOMÁTICO DAS MÉTRICAS
CREATE OR REPLACE FUNCTION refresh_admin_metrics() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_user_metrics;
END;
$$ LANGUAGE plpgsql;

-- 6. CONFIGURAÇÕES DE PERFORMANCE PARA QUERIES ADMIN
-- Aumentar work_mem temporariamente para queries administrativas
-- (Execute apenas durante operações administrativas pesadas)
-- SET work_mem = '256MB';
-- SET maintenance_work_mem = '1GB';

-- 7. VERIFICAR ÍNDICES EXISTENTES
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users'
ORDER BY indexname;

-- 8. VERIFICAR ESTATÍSTICAS DA TABELA
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename = 'users';

-- 9. VACUUM E ANALYZE PARA OTIMIZAÇÃO IMEDIATA
VACUUM ANALYZE users;

-- 10. CONFIGURAÇÕES DE POSTGRESQL RECOMENDADAS
-- Adicionar no postgresql.conf:
-- shared_buffers = 256MB          # Para cache de páginas
-- effective_cache_size = 1GB      # Estimativa de cache do SO
-- work_mem = 64MB                 # Para operações de ordenação
-- maintenance_work_mem = 256MB    # Para VACUUM e índices
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- random_page_cost = 1.1          # Para SSD
-- effective_io_concurrency = 200  # Para SSD

COMMIT;