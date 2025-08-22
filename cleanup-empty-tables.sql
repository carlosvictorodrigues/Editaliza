-- Script para limpar tabelas duplicadas vazias
-- EXECUTE APENAS APÓS CONFIRMAR QUE TUDO ESTÁ FUNCIONANDO

-- Remover tabelas vazias duplicadas
DROP TABLE IF EXISTS pg_temp.users_33604;     -- users vazia
DROP TABLE IF EXISTS pg_temp.sessions_33618;  -- sessions vazia  
DROP TABLE IF EXISTS pg_temp.sessions_33729;  -- sessions vazia
DROP TABLE IF EXISTS pg_temp.study_plans_33738; -- study_plans vazia
DROP TABLE IF EXISTS pg_temp.subjects_33770;    -- subjects vazia
DROP TABLE IF EXISTS pg_temp.topics_33785;      -- topics vazia
DROP TABLE IF EXISTS pg_temp.study_sessions_33806; -- study_sessions vazia

-- Verificar se ainda existem duplicatas
SELECT 
    schemaname, 
    tablename, 
    COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename 
HAVING COUNT(*) > 1;