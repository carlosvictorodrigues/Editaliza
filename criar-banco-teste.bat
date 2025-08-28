@echo off
echo =======================================
echo TESTANDO CONEXAO COM POSTGRESQL
echo =======================================
echo.

echo Tentando sem senha (trust)...
set PGPASSWORD=
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "SELECT version();" 2>nul
if %ERRORLEVEL%==0 (
    echo SUCESSO: Conectou sem senha!
    goto :criar_banco
)

echo.
echo Tentando com senha 'postgres'...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "SELECT version();" 2>nul
if %ERRORLEVEL%==0 (
    echo SUCESSO: Senha é 'postgres'!
    goto :criar_banco
)

echo.
echo Tentando com senha '123456'...
set PGPASSWORD=123456
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "SELECT version();" 2>nul
if %ERRORLEVEL%==0 (
    echo SUCESSO: Senha é '123456'!
    goto :criar_banco
)

echo.
echo Tentando com senha 'admin'...
set PGPASSWORD=admin
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "SELECT version();" 2>nul
if %ERRORLEVEL%==0 (
    echo SUCESSO: Senha é 'admin'!
    goto :criar_banco
)

echo.
echo Tentando com senha '1234'...
set PGPASSWORD=1234
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "SELECT version();" 2>nul
if %ERRORLEVEL%==0 (
    echo SUCESSO: Senha é '1234'!
    goto :criar_banco
)

echo.
echo =======================================
echo ERRO: Nao consegui conectar ao PostgreSQL
echo Por favor, digite a senha do usuario postgres manualmente
echo =======================================
pause
exit /b 1

:criar_banco
echo.
echo =======================================
echo CRIANDO BANCO DE DADOS
echo =======================================
echo.

echo Removendo banco antigo se existir...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "DROP DATABASE IF EXISTS editaliza_db;" 2>nul

echo Criando banco novo...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE DATABASE editaliza_db;"

echo Removendo usuario antigo se existir...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "DROP USER IF EXISTS editaliza_user;" 2>nul

echo Criando usuario...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "CREATE USER editaliza_user WITH PASSWORD '1a2b3c4d';"

echo Concedendo permissoes...
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;"
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres -d editaliza_db -c "GRANT ALL ON SCHEMA public TO editaliza_user;"

echo.
echo =======================================
echo BANCO CRIADO COM SUCESSO!
echo =======================================
echo.
echo Agora vou criar as tabelas...
echo.

set PGPASSWORD=1a2b3c4d
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -f setup-editaliza-db.sql

echo.
echo =======================================
echo PROCESSO CONCLUIDO!
echo =======================================
echo.
echo Banco: editaliza_db
echo Usuario: editaliza_user
echo Senha: 1a2b3c4d
echo Host: localhost
echo Porta: 5432
echo.
pause