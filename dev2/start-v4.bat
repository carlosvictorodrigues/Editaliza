@echo off
echo =========================================
echo   ORQUESTRADOR MULTI-AGENTE v4.0
echo =========================================
echo.
echo ARQUITETO:
echo   - Claude Opus 4.1 (fallback: Gemini 2.5 Pro)
echo.
echo AGENTES ESPECIALIZADOS:
echo   - fe: Frontend (Gemini 2.5 Pro)
echo   - be: Backend (Claude Sonnet)
echo   - devops: Deploy (Claude Sonnet)
echo   - dba: Database (Claude Sonnet)
echo   - qa: Testing (Gemini 2.5 Pro)
echo.
echo EXECUCAO: Paralela com retry automatico
echo =========================================
echo.

REM Testa nova versao
node orchestrator-v4.mjs "Analisar sistema e identificar melhorias"

pause