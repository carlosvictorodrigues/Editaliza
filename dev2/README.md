# Bot Bashing — v3.7.1 (Auto‑fallback Architect + Observability)
- Architect primário: **Claude Opus 4.1**
- Fallback automático se o CLI travar/falhar: **Gemini 2.5 Pro**
- Executor A (BE/devops/db): **Claude Sonnet 4.1**
- Executor B (FE/contexto/testes): **Gemini 2.5 Pro**
- Dashboard: `npm run dashboard` (http://localhost:4545)
- Logs/Prompts: em `logs/` e `logs/prompts/`
- Gates por rodada + política de mudança mínima

Como funciona o fallback: o Arquiteto tem timeout curto (90s). Se não responder, o orquestrador registra o erro e **refaz a rodada** usando o fallback (Gemini) como Arquiteto, para você ver o ciclo completo no painel. Você pode depois ajustar o `agents.json` para fixar o Opus quando o CLI estiver saudável.
