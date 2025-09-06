@echo off
cls
echo =========================================
echo   EDITALIZA - SISTEMA DE AUTO-CORRECAO
echo =========================================
echo.
echo Este script vai:
echo 1. Testar o sistema em producao
echo 2. Identificar problemas automaticamente  
echo 3. Corrigir usando agentes IA
echo 4. Fazer deploy automatico
echo 5. Verificar se tudo esta funcionando
echo.
echo =========================================
echo.
echo Escolha o modo de execucao:
echo.
echo [1] TESTE APENAS (nao faz correcoes)
echo [2] CORRECAO MANUAL (corrige mas nao faz deploy)
echo [3] CORRECAO AUTOMATICA (corrige e faz deploy)
echo [4] MONITORAMENTO (verifica a cada 5 min)
echo [0] SAIR
echo.
set /p modo="Digite sua escolha: "

if "%modo%"=="0" goto fim
if "%modo%"=="1" goto teste
if "%modo%"=="2" goto manual
if "%modo%"=="3" goto auto
if "%modo%"=="4" goto monitor

echo Opcao invalida!
pause
goto inicio

:teste
echo.
echo ========================================
echo MODO: TESTE APENAS
echo ========================================
powershell -ExecutionPolicy Bypass -File run-orchestrator.ps1 -TestOnly
pause
goto fim

:manual
echo.
echo ========================================
echo MODO: CORRECAO MANUAL
echo ========================================
powershell -ExecutionPolicy Bypass -File run-orchestrator.ps1
pause
goto fim

:auto
echo.
echo ========================================
echo MODO: CORRECAO AUTOMATICA COM DEPLOY
echo ========================================
echo ATENCAO: Este modo fara deploy automatico!
set /p confirma="Tem certeza? (S/N): "
if /i "%confirma%"=="S" (
    powershell -ExecutionPolicy Bypass -File run-orchestrator.ps1 -Deploy
) else (
    echo Operacao cancelada.
)
pause
goto fim

:monitor
echo.
echo ========================================
echo MODO: MONITORAMENTO CONTINUO
echo ========================================
echo Pressione CTRL+C para parar
powershell -ExecutionPolicy Bypass -File run-orchestrator.ps1 -Monitor
pause
goto fim

:fim
exit