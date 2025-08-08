@echo off
echo 🛠️ Script de Manutenção - Editaliza
echo.

:menu
echo Escolha uma opção:
echo 1. 🔍 Verificar saúde do sistema
echo 2. 🧹 Limpar sessões
echo 3. 💾 Fazer backup do banco
echo 4. 📊 Verificar logs
echo 5. 🔄 Reiniciar servidor
echo 6. ❌ Sair
echo.
set /p choice="Digite sua escolha (1-6): "

if "%choice%"=="1" goto health
if "%choice%"=="2" goto clean
if "%choice%"=="3" goto backup
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto restart
if "%choice%"=="6" goto exit
goto menu

:health
echo.
echo 🔍 Verificando saúde do sistema...
curl -s http://localhost:3000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Servidor está rodando
) else (
    echo ❌ Servidor não está rodando
)
echo.
pause
goto menu

:clean
echo.
echo 🧹 Limpando sessões...
if exist "sessions.db" (
    del "sessions.db"
    echo ✅ Sessões limpas
) else (
    echo ℹ️ Nenhuma sessão para limpar
)
echo.
pause
goto menu

:backup
echo.
echo 💾 Fazendo backup do banco...
set "date=%date:~-4,4%-%date:~-10,2%-%date:~-7,2%"
if exist "db.sqlite" (
    copy "db.sqlite" "db_backup_%date%.sqlite" >nul
    echo ✅ Backup criado: db_backup_%date%.sqlite
) else (
    echo ❌ Banco de dados não encontrado
)
echo.
pause
goto menu

:logs
echo.
echo 📊 Verificando logs...
if exist "*.log" (
    dir *.log
) else (
    echo ℹ️ Nenhum arquivo de log encontrado
)
echo.
pause
goto menu

:restart
echo.
echo 🔄 Reiniciando servidor...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
start "Editaliza Server" cmd /k "node server.js"
echo ✅ Servidor reiniciado
echo.
pause
goto menu

:exit
echo.
echo 👋 Até logo!
exit /b 0 