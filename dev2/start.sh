#!/bin/bash

echo "========================================="
echo "      INICIANDO ORQUESTRADOR v3.7.1"
echo "========================================="
echo ""
echo "Modelos configurados:"
echo "- Arquiteto: Claude Opus 4.1 (fallback: Gemini 2.5 Pro)"
echo "- Executor A: Claude Sonnet 4.1 (BE/DevOps/DB)"
echo "- Executor B: Gemini 2.5 Pro (FE/Contexto/Testes)"
echo ""
echo "========================================="
echo ""

# Comando basico sem objetivo especifico
# node orchestrator.mjs

# Comando com objetivo padrao
node orchestrator.mjs "Sincronizar FE/BE com mudanca minima e gates verdes"

# Comando com objetivo customizado (descomente e modifique)
# node orchestrator.mjs "Seu objetivo aqui"