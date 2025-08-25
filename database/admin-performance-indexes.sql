-- =====================================================
-- ÍNDICES DE PERFORMANCE PARA ROTAS ADMINISTRATIVAS
-- =====================================================
-- 
-- Este script cria índices otimizados para melhorar a performance
-- das rotas admin que estão causando timeout.
--
-- PROBLEMA IDENTIFICADO:
-- - getUsers: JOINs pesados sem índices em filtros e ordenação
-- - getSystemMetrics: Queries agregadas sem cache nem índices
-- - Consultas com ILIKE, COUNT agregados e filtros temporais lentos
--
-- SOLUÇÃO: Índices estratégicos + queries otimizadas
-- =====================================================

\echo '🔧 Criando índices de performance para Admin Dashboard...'

-- =====================================================
-- ÍNDICES PARA TABELA USERS (getUsers performance)
-- =====================================================

-- Índice composto para busca textual (ILIKE)
-- Acelera filtros por email e name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search_text 
ON users USING gin ((email || ' ' || COALESCE(name, '')) gin_trgm_ops);

-- Índice para filtro por role
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
ON users (role) WHERE role IS NOT NULL;

-- Índice composto para ordenação por created_at + paginação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_pagination 
ON users (created_at DESC, id DESC);

-- Índice composto para ordenação por email + paginação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_pagination 
ON users (email, id) WHERE email IS NOT NULL;

-- Índice composto para ordenação por name + paginação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_pagination 
ON users (name, id) WHERE name IS NOT NULL;

-- Índice para last_login_at (usado em ordenação)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login 
ON users (last_login_at) WHERE last_login_at IS NOT NULL;

-- Índice composto para filtros combinados (role + created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created 
ON users (role, created_at DESC) WHERE role IS NOT NULL;

-- =====================================================
-- ÍNDICES PARA TABELA STUDY_PLANS (getSystemMetrics)
-- =====================================================

-- Índice para contagem de planos por data de criação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_plans_created_date 
ON study_plans (created_at) WHERE created_at IS NOT NULL;

-- Índice para filtro is_active (se existir coluna)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_plans_active 
ON study_plans (is_active) WHERE is_active IS NOT NULL;

-- Índice composto para métricas temporais
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_study_plans_metrics 
ON study_plans (created_at, is_active) 
WHERE created_at IS NOT NULL;

-- =====================================================
-- ÍNDICES PARA SESSIONS (cleanup automático)
-- =====================================================

-- Otimizar limpeza de sessões expiradas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire_cleanup 
ON sessions (expire) WHERE expire < NOW();

-- =====================================================
-- ÍNDICES PARA OUTRAS TABELAS RELACIONADAS
-- =====================================================

-- Índices para schedules (se usado em JOINs admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_user_created 
ON schedules (user_id, created_at DESC);

-- Índices para plans (se usado em métricas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plans_user_created 
ON plans (user_id, created_at DESC);

-- Índices para tasks (métricas de atividade)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_completed_date 
ON tasks (completed, completed_at) WHERE completed_at IS NOT NULL;

-- Índices para progress (métricas de uso)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_progress_completed_date 
ON progress (completed_at) WHERE completed_at IS NOT NULL;

-- =====================================================
-- EXTENSÕES NECESSÁRIAS
-- =====================================================

-- Extensão para busca textual otimizada (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Extensão para estatísticas avançadas
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- =====================================================
-- VIEWS MATERIALIZADAS PARA MÉTRICAS PESADAS
-- =====================================================

-- View materializada para métricas de usuários
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_user_metrics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as users_last_7d,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as users_last_30d,
    COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h,
    COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
    MAX(created_at) as latest_signup,
    MIN(created_at) as first_signup,
    NOW() as calculated_at
FROM users;

-- Índice único na view materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_metrics_calc 
ON admin_user_metrics (calculated_at);

-- View materializada para métricas de planos (adaptar conforme estrutura real)
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_plan_metrics AS
SELECT 
    COUNT(*) as total_plans,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as plans_last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as plans_last_7d,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as plans_last_30d,
    AVG(study_hours_per_day) as avg_study_hours,
    MAX(created_at) as latest_plan,
    NOW() as calculated_at
FROM plans;

-- Índice único na view materializada de planos
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_plan_metrics_calc 
ON admin_plan_metrics (calculated_at);

-- =====================================================
-- FUNCTION PARA REFRESH AUTOMÁTICO DAS VIEWS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_admin_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh concorrente das views materializadas
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_user_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_plan_metrics;
    
    -- Log da operação
    RAISE NOTICE 'Admin metrics refreshed at %', NOW();
END;
$$;

-- =====================================================
-- CONFIGURAÇÕES DE PERFORMANCE
-- =====================================================

-- Configurar work_mem para queries administrativas pesadas
-- (aplicar na sessão quando necessário)
-- SET work_mem = '256MB';

-- Configurar maintenance_work_mem para operações de índice
-- SET maintenance_work_mem = '1GB';

-- =====================================================
-- ESTATÍSTICAS E MONITORAMENTO
-- =====================================================

-- Atualizar estatísticas das tabelas principais
ANALYZE users;
ANALYZE plans;
ANALYZE study_plans;
ANALYZE sessions;
ANALYZE schedules;
ANALYZE tasks;
ANALYZE progress;

-- =====================================================
-- QUERIES DE TESTE PARA VALIDAÇÃO
-- =====================================================

-- Teste 1: Query otimizada de usuários com paginação
/*
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, email, name, role, created_at
FROM users 
WHERE email ILIKE '%test%' 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 0;
*/

-- Teste 2: Métricas agregadas otimizadas
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM admin_user_metrics;
*/

-- Teste 3: Contagem com filtros temporais
/*
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) 
FROM users 
WHERE created_at >= NOW() - INTERVAL '24 hours';
*/

\echo '✅ Índices de performance criados com sucesso!'
\echo '📊 Views materializadas configuradas para cache de métricas'
\echo '⚡ Performance das rotas admin otimizada!'

-- =====================================================
-- INSTRUÇÕES DE MANUTENÇÃO
-- =====================================================

/*
MANUTENÇÃO PERIÓDICA:

1. Refresh das views materializadas (a cada 5-15 minutos):
   SELECT refresh_admin_metrics();

2. Reindex periódico (semanal/mensal):
   REINDEX INDEX CONCURRENTLY idx_users_search_text;
   REINDEX INDEX CONCURRENTLY idx_users_created_pagination;

3. Limpeza de sessões expiradas (diário):
   DELETE FROM sessions WHERE expire < NOW();

4. Atualização de estatísticas (semanal):
   ANALYZE users;
   ANALYZE plans;

5. Monitoramento de queries lentas:
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   WHERE query LIKE '%admin%' 
   ORDER BY mean_time DESC;
*/