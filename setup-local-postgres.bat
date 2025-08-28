@echo off
echo ====================================
echo Configurando PostgreSQL Local
echo ====================================
echo.

REM Iniciar serviço PostgreSQL
echo Iniciando serviço PostgreSQL...
net start postgresql-x64-17

echo.
echo Aguardando serviço iniciar...
timeout /t 5 /nobreak > nul

REM Criar banco e usuário
echo Criando banco de dados e usuário...

"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE DATABASE editaliza_db;"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE USER editaliza_user WITH PASSWORD '1a2b3c4d';"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -d editaliza_db -c "GRANT ALL ON SCHEMA public TO editaliza_user;"

echo.
echo ====================================
echo Configuração concluída!
echo ====================================
echo.
echo Banco: editaliza_db
echo Usuario: editaliza_user
echo Senha: 1a2b3c4d
echo Host: localhost
echo Porta: 5432
echo.
pause