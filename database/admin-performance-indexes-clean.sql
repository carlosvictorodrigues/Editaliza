-- ÍNDICES DE PERFORMANCE PARA ROTAS ADMINISTRATIVAS
-- Versão limpa - apenas comandos SQL executáveis

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ÍNDICES PARA TABELA USERS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_search_text 
ON users USING gin ((email || ' ' || COALESCE(name, '')) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
ON users (role) WHERE role IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_pagination 
ON users (created_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_pagination 
ON users (email, id) WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_pagination 
ON users (name, id) WHERE name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login 
ON users (last_login_at) WHERE last_login_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created 
ON users (role, created_at DESC) WHERE role IS NOT NULL;

-- ÍNDICES PARA OUTRAS TABELAS
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire_cleanup 
ON sessions (expire) WHERE expire < NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_user_created 
ON schedules (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_plans_user_created 
ON plans (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_completed_date 
ON tasks (completed, completed_at) WHERE completed_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_progress_completed_date 
ON progress (completed_at) WHERE completed_at IS NOT NULL;

-- VIEWS MATERIALIZADAS PARA MÉTRICAS PESADAS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_metrics_calc 
ON admin_user_metrics (calculated_at);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_plan_metrics_calc 
ON admin_plan_metrics (calculated_at);

-- FUNCTION PARA REFRESH AUTOMÁTICO DAS VIEWS
CREATE OR REPLACE FUNCTION refresh_admin_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_user_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY admin_plan_metrics;
    
    RAISE NOTICE 'Admin metrics refreshed at %', NOW();
END;
$$;

-- ATUALIZAR ESTATÍSTICAS DAS TABELAS PRINCIPAIS
ANALYZE users;
ANALYZE plans;
ANALYZE sessions;
ANALYZE schedules;
ANALYZE tasks;
ANALYZE progress;