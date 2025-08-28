@echo off
echo =======================================
echo CRIANDO BANCO DE DADOS EDITALIZA
echo =======================================
echo.

REM Definir variavel de ambiente para senha do postgres
set PGPASSWORD=postgres

echo Criando banco de dados...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "DROP DATABASE IF EXISTS editaliza_db;"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE DATABASE editaliza_db;"

echo.
echo Criando usuario...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "DROP USER IF EXISTS editaliza_user;"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE USER editaliza_user WITH PASSWORD '1a2b3c4d';"

echo.
echo Concedendo permissoes...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;"

echo.
echo Criando tabelas...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -d editaliza_db -c "GRANT ALL ON SCHEMA public TO editaliza_user;"

REM Definir senha do usuario editaliza_user
set PGPASSWORD=1a2b3c4d

echo.
echo Criando estrutura de tabelas...
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, email_verified BOOLEAN DEFAULT false, profile_picture VARCHAR(500));"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS study_plans (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, plan_name VARCHAR(255) NOT NULL, exam_date DATE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_active BOOLEAN DEFAULT true, study_days_per_week INTEGER DEFAULT 6, hours_per_day NUMERIC(4,2) DEFAULT 4.0);"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS subjects (id SERIAL PRIMARY KEY, study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, weight INTEGER DEFAULT 5, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS topics (id SERIAL PRIMARY KEY, subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE, topic_description TEXT NOT NULL, weight INTEGER DEFAULT 5, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS study_sessions (id SERIAL PRIMARY KEY, study_plan_id INTEGER REFERENCES study_plans(id) ON DELETE CASCADE, topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL, subject_name VARCHAR(255), topic_description TEXT, session_date DATE NOT NULL, session_type VARCHAR(50), status VARCHAR(50) DEFAULT 'Pendente', time_studied_seconds INTEGER DEFAULT 0, notes TEXT, questions_solved INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS user_gamification_stats (id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, current_streak INTEGER DEFAULT 0, longest_streak INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS user_achievements (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, achievement_id VARCHAR(100) NOT NULL, unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, achievement_id));"

"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE TABLE IF NOT EXISTS sessions (sid VARCHAR(255) PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL);"

echo.
echo Criando indices...
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);"
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE INDEX IF NOT EXISTS idx_study_sessions_plan ON study_sessions(study_plan_id);"
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE INDEX IF NOT EXISTS idx_study_sessions_date ON study_sessions(session_date);"
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE INDEX IF NOT EXISTS idx_subjects_plan ON subjects(study_plan_id);"
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);"

echo.
echo =======================================
echo BANCO DE DADOS CRIADO COM SUCESSO!
echo =======================================
echo.
echo Banco: editaliza_db
echo Usuario: editaliza_user
echo Senha: 1a2b3c4d
echo Host: localhost
echo Porta: 5432
echo.
pause