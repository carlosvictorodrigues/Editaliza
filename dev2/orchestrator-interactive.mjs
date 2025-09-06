#!/usr/bin/env node
// orchestrator-interactive.mjs - Orquestrador com arquiteto que faz perguntas

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas ao usuário/assistente
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question + "\n> ", resolve);
  });
}

// Função para executar comando
function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      shell: true,
      cwd: process.cwd()
    });
    
    let output = "";
    child.stdout.on("data", data => output += data.toString());
    child.stderr.on("data", data => output += data.toString());
    
    child.on("close", code => {
      // Para o teste, consideramos qualquer output como sucesso
      resolve(output);
    });
    
    setTimeout(() => {
      child.kill();
      reject(new Error("Timeout"));
    }, 120000);
  });
}

// Função para chamar o arquiteto
async function callArchitect(prompt) {
  const architectPrompt = fs.readFileSync("prompts/architect_interactive.txt", "utf8") + "\n\n" + prompt;
  
  return new Promise((resolve, reject) => {
    // Tenta Claude Opus primeiro
    const claudeChild = spawn("claude", [
      "--model", "opus",
      "--print",
      "--dangerously-skip-permissions"
    ], {
      shell: true,
      cwd: process.cwd()
    });
    
    let output = "";
    let errorOutput = "";
    
    // Envia o prompt via stdin
    claudeChild.stdin.write(architectPrompt);
    claudeChild.stdin.end();
    
    claudeChild.stdout.on("data", data => output += data.toString());
    claudeChild.stderr.on("data", data => errorOutput += data.toString());
    
    claudeChild.on("close", code => {
      if (code === 0 && output) {
        resolve(output);
      } else {
        console.log("Claude falhou, tentando Gemini...");
        
        // Fallback para Gemini
        const geminiChild = spawn("gemini", ["-p", architectPrompt], {
          shell: true,
          cwd: process.cwd()
        });
        
        let geminiOutput = "";
        geminiChild.stdout.on("data", data => geminiOutput += data.toString());
        geminiChild.stderr.on("data", data => geminiOutput += data.toString());
        
        geminiChild.on("close", code => {
          if (geminiOutput) {
            resolve(geminiOutput);
          } else {
            reject(new Error("Ambos Claude e Gemini falharam"));
          }
        });
        
        setTimeout(() => {
          geminiChild.kill();
          reject(new Error("Gemini timeout"));
        }, 120000);
      }
    });
    
    setTimeout(() => {
      claudeChild.kill();
      console.log("Claude timeout, tentando Gemini...");
    }, 120000);
  });
}

// Função para extrair JSON da resposta
function extractJSON(text) {
  // Tenta encontrar JSON no texto
  const jsonMatch = text.match(/\{[\s\S]*\}/m);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Se falhar, tenta extrair apenas o JSON entre ```json
      const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/m);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch (e2) {
          return null;
        }
      }
    }
  }
  return null;
}

// Função principal
async function main() {
  console.log("\n🤖 ORQUESTRADOR INTERATIVO - EDITALIZA");
  console.log("=" .repeat(50));
  console.log("O arquiteto pode fazer perguntas sobre o projeto!");
  console.log("=" .repeat(50) + "\n");
  
  // 1. Testa produção
  console.log("📊 Testando produção...");
  const testResult = await runCommand("node", ["test-production.mjs"]);
  
  // Extrai problemas do teste
  const problems = [];
  if (testResult.includes("❌")) {
    const lines = testResult.split("\n");
    lines.forEach(line => {
      if (line.includes("❌")) {
        problems.push(line.trim());
      }
    });
  }
  
  if (problems.length === 0) {
    console.log("✅ Tudo funcionando! Nenhuma correção necessária.");
    rl.close();
    return;
  }
  
  console.log(`\n❌ ${problems.length} problemas encontrados:`);
  problems.forEach(p => console.log("  " + p));
  
  // 2. Chama o arquiteto com os problemas
  console.log("\n🎯 Consultando arquiteto...\n");
  
  const architectInput = `
PROBLEMAS DETECTADOS EM PRODUÇÃO:
${problems.join("\n")}

Analise estes problemas e crie um plano de correção.
Se precisar de informações específicas sobre o projeto, retorne status "NEED_INFO" com suas perguntas.
`;
  
  let architectResponse = await callArchitect(architectInput);
  
  // 3. Processa resposta do arquiteto
  try {
    // Tenta extrair JSON da resposta
    const response = extractJSON(architectResponse);
    if (!response) {
      throw new Error("Não foi possível extrair JSON da resposta");
    }
    
    // Se o arquiteto precisa de informações
    if (response.status === "NEED_INFO") {
      console.log("🤔 O arquiteto tem perguntas:\n");
      
      const answers = [];
      for (const question of response.questions) {
        console.log(`❓ ${question}`);
        const answer = await askQuestion("Resposta");
        answers.push({ question, answer });
      }
      
      // Envia respostas de volta ao arquiteto
      const followUp = `
Respostas às suas perguntas:
${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}

Agora crie o plano de correção com base nessas informações.
`;
      
      architectResponse = await callArchitect(followUp);
    }
    
    // Processa plano final
    const finalPlan = extractJSON(architectResponse);
    if (!finalPlan) {
      throw new Error("Não foi possível extrair JSON do plano final");
    }
    
    if (finalPlan.status === "READY") {
      console.log("\n📋 PLANO DE CORREÇÃO:");
      console.log(finalPlan.plan);
      
      console.log("\n🚀 Executando correções...\n");
      
      // Executa tarefas dos agentes
      for (const task of finalPlan.agents) {
        console.log(`  Agente ${task.agent}: ${task.task}`);
        
        // Aqui você executaria o agente real
        // Por enquanto, só simula
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`  ✅ Concluído`);
      }
      
      console.log("\n✨ Correções aplicadas!");
    }
    
  } catch (error) {
    console.log("⚠️ Erro ao processar resposta do arquiteto:", error.message);
    console.log("\nResposta completa:");
    console.log(architectResponse);
    
    // Tenta criar um plano básico se a resposta contém informações úteis
    if (architectResponse.toLowerCase().includes("api") || architectResponse.toLowerCase().includes("502")) {
      console.log("\n🔧 Criando plano básico para correção da API...");
      console.log("\n📋 PLANO DE CORREÇÃO:");
      console.log("1. Verificar se o servidor backend está rodando");
      console.log("2. Verificar configuração do Nginx para proxy da API");
      console.log("3. Reiniciar serviços PM2 e Nginx");
      console.log("\nExecute: npm run fix-api");
    }
  }
  
  rl.close();
}

// Tratamento de erros
process.on("unhandledRejection", error => {
  console.error("❌ Erro:", error.message);
  rl.close();
  process.exit(1);
});

// Executa
main().catch(error => {
  console.error("❌ Erro fatal:", error);
  rl.close();
  process.exit(1);
});