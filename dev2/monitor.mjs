#!/usr/bin/env node
// monitor.mjs - Monitor em tempo real do orchestrator

import { spawn } from "node:child_process";
import readline from "node:readline";

// Limpa a tela
console.clear();

// Cria interface para output formatado
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Estado do sistema
const state = {
  cycle: 0,
  problems: [],
  agents: {},
  lastUpdate: new Date()
};

// Executa o orchestrator
const orchestrator = spawn("node", ["orchestrator-complete.mjs"], {
  cwd: process.cwd(),
  shell: true
});

// Processa output
orchestrator.stdout.on("data", (data) => {
  const lines = data.toString().split("\n");
  
  lines.forEach(line => {
    // Detecta ciclo
    if (line.includes("CICLO")) {
      const match = line.match(/CICLO (\d+)\/(\d+)/);
      if (match) {
        state.cycle = parseInt(match[1]);
        state.maxCycles = parseInt(match[2]);
      }
    }
    
    // Detecta problemas
    if (line.includes("❌")) {
      state.problems.push(line);
    }
    
    // Detecta agentes
    if (line.includes("Agent]")) {
      const match = line.match(/\[([^\]]+) Agent\]/);
      if (match) {
        const agent = match[1];
        if (!state.agents[agent]) state.agents[agent] = [];
        state.agents[agent].push(line);
      }
    }
    
    // Detecta sucesso
    if (line.includes("✅ PLATAFORMA 100% FUNCIONAL")) {
      state.success = true;
    }
    
    state.lastUpdate = new Date();
  });
  
  // Atualiza display
  updateDisplay();
});

// Processa erros
orchestrator.stderr.on("data", (data) => {
  state.errors = (state.errors || []).concat(data.toString());
  updateDisplay();
});

// Atualiza display
function updateDisplay() {
  console.clear();
  
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           🖥️  MONITOR - ORCHESTRATOR EDITALIZA            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  
  // Status geral
  console.log(`📊 Status: ${state.success ? "✅ SUCESSO" : "🔄 Processando..."}`);
  console.log(`🔄 Ciclo: ${state.cycle || 0}/${state.maxCycles || 16}`);
  console.log(`🕐 Última atualização: ${state.lastUpdate.toLocaleTimeString()}`);
  console.log("");
  
  // Problemas
  if (state.problems.length > 0) {
    console.log("❌ Problemas Detectados:");
    state.problems.slice(-5).forEach(p => {
      console.log(`  ${p.substring(0, 60)}...`);
    });
    console.log("");
  }
  
  // Agentes ativos
  console.log("🤖 Agentes Ativos:");
  Object.keys(state.agents).forEach(agent => {
    const lastAction = state.agents[agent].slice(-1)[0] || "Aguardando...";
    console.log(`  [${agent}]: ${lastAction.substring(0, 50)}...`);
  });
  console.log("");
  
  // Erros
  if (state.errors && state.errors.length > 0) {
    console.log("⚠️ Erros:");
    state.errors.slice(-3).forEach(e => {
      console.log(`  ${e.substring(0, 60)}...`);
    });
  }
  
  // Barra de progresso
  const progress = Math.round((state.cycle / (state.maxCycles || 16)) * 20);
  const progressBar = "█".repeat(progress) + "░".repeat(20 - progress);
  console.log(`\n[${progressBar}] ${Math.round((state.cycle / (state.maxCycles || 16)) * 100)}%`);
  
  // Instruções
  console.log("\nPressione Ctrl+C para parar o monitoramento");
}

// Tratamento de saída
process.on("SIGINT", () => {
  console.log("\n\n👋 Encerrando monitor...");
  orchestrator.kill();
  process.exit(0);
});

// Inicia
console.log("🚀 Iniciando monitoramento...\n");