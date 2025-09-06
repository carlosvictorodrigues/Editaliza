@echo off
cls
echo ================================================================
echo          EDITALIZA PLATFORM FIX - SISTEMA AUTOMATIZADO
echo ================================================================
echo.
echo Este sistema ira automaticamente:
echo.
echo [1] Mapear todos os problemas de sincronizacao Frontend/Backend
echo [2] Distribuir tarefas para agentes especializados
echo [3] Executar correcoes em paralelo
echo [4] Testar cada alteracao
echo [5] Garantir 100%% de funcionalidade
echo.
echo ================================================================
echo.
echo AGENTES DISPONVEIS:
echo   - ARQUITETO: Claude Opus (coordenacao)
echo   - FRONTEND:  Gemini 2.5 Pro
echo   - BACKEND:   Claude Sonnet
echo   - DATABASE:  Claude Sonnet
echo   - DEVOPS:    Claude Sonnet
echo   - QA/TESTE:  Gemini 2.5 Pro
echo.
echo ================================================================
echo.
pause
echo.
echo Iniciando orquestracao automatizada...
echo.

cd /d "%~dp0"
node fix-platform.mjs

echo.
echo ================================================================
echo PROCESSO FINALIZADO!
echo.
echo Verifique os logs em: dev2\logs\
echo.
echo Para deployar as correcoes:
echo   1. git add .
echo   2. git commit -m "fix: sincronizar frontend com backend"
echo   3. git push origin main
echo   4. ssh editaliza "cd /root/editaliza && git pull && pm2 restart"
echo.
echo ================================================================
pause