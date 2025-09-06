#!/usr/bin/env node
// orchestrator-autonomous.mjs - Orquestrador totalmente autônomo

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

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
      resolve(output);
    });
    
    setTimeout(() => {
      child.kill();
      reject(new Error("Timeout"));
    }, 120000);
  });
}

// Função para executar comando SSH no servidor
function runSSHCommand(command) {
  return new Promise((resolve, reject) => {
    const sshCommand = `ssh editaliza "${command}"`;
    console.log(`  🖥️  SSH: ${command}`);
    
    const child = spawn(sshCommand, [], { 
      shell: true,
      cwd: process.cwd()
    });
    
    let output = "";
    child.stdout.on("data", data => {
      const text = data.toString();
      output += text;
      process.stdout.write(`    ${text}`);
    });
    child.stderr.on("data", data => {
      const text = data.toString();
      output += text;
    });
    
    child.on("close", code => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`SSH command failed with code ${code}`));
      }
    });
    
    setTimeout(() => {
      child.kill();
      reject(new Error("SSH timeout"));
    }, 30000);
  });
}

// Função para buscar informações do projeto automaticamente
async function gatherProjectInfo(problems) {
  console.log("\n🔍 Analisando projeto automaticamente...\n");
  
  const info = {
    problems: problems,
    context: {}
  };
  
  // Analisa problemas específicos
  for (const problem of problems) {
    if (problem.includes("schedule") || problem.includes("calendar") || problem.includes("study")) {
      // Verifica o arquivo schedule.html
      console.log("  📄 Verificando schedule.html...");
      const schedulePath = path.join("..", "public", "schedule.html");
      if (fs.existsSync(schedulePath)) {
        const content = fs.readFileSync(schedulePath, "utf8");
        info.context.scheduleHTML = {
          exists: true,
          hasScheduleWord: content.toLowerCase().includes("schedule"),
          hasCalendarWord: content.toLowerCase().includes("calendar"),
          hasStudyWord: content.toLowerCase().includes("study"),
          title: content.match(/<title>(.*?)<\/title>/)?.[1] || "N/A"
        };
        console.log(`    - Arquivo existe: ✅`);
        console.log(`    - Contém 'schedule': ${info.context.scheduleHTML.hasScheduleWord ? '✅' : '❌'}`);
        console.log(`    - Contém 'calendar': ${info.context.scheduleHTML.hasCalendarWord ? '✅' : '❌'}`);
        console.log(`    - Contém 'study': ${info.context.scheduleHTML.hasStudyWord ? '✅' : '❌'}`);
      }
    }
    
    if (problem.includes("502") || problem.includes("API")) {
      // Verifica status do servidor
      console.log("\n  🖥️  Verificando servidor remoto...");
      try {
        const pm2Status = await runSSHCommand("pm2 status");
        info.context.serverStatus = {
          pm2Running: pm2Status.includes("online"),
          appName: pm2Status.match(/editaliza-app/)?.[0] || "N/A"
        };
        console.log(`    - PM2 rodando: ${info.context.serverStatus.pm2Running ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`    - Erro ao verificar PM2: ${error.message}`);
        info.context.serverStatus = { error: error.message };
      }
      
      try {
        const nginxStatus = await runSSHCommand("systemctl is-active nginx");
        info.context.nginxStatus = {
          running: nginxStatus.includes("active (running)")
        };
        console.log(`    - Nginx rodando: ${info.context.nginxStatus.running ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`    - Erro ao verificar Nginx: ${error.message}`);
        info.context.nginxStatus = { error: error.message };
      }
    }
  }
  
  return info;
}

// Função para criar plano de correção baseado na análise
function createFixPlan(info) {
  const plan = {
    status: "READY",
    plan: "Correção automática baseada na análise",
    agents: []
  };
  
  // Se o problema é com schedule.html
  if (info.context.scheduleHTML) {
    if (!info.context.scheduleHTML.hasScheduleWord || 
        !info.context.scheduleHTML.hasCalendarWord || 
        !info.context.scheduleHTML.hasStudyWord) {
      console.log("\n📝 Problema identificado: schedule.html não contém palavras esperadas");
      console.log("   Isso é esperado pois a página usa português (cronograma, calendário, estudo)");
      console.log("   O teste precisa ser ajustado para aceitar termos em português.");
    }
  }
  
  // Se o problema é com a API (502)
  if (info.problems.some(p => p.includes("502") || p.includes("API"))) {
    console.log("\n⚠️ Problema identificado: API retornando erro 502");
    
    plan.agents.push({
      agent: "devops",
      task: "Reiniciar aplicação no servidor",
      commands: [
        "cd /root/editaliza && git pull origin main",
        "cd /root/editaliza && npm install --production",
        "pm2 restart editaliza-app",
        "pm2 logs editaliza-app --lines 10"
      ]
    });
    
    plan.agents.push({
      agent: "devops",
      task: "Verificar e reiniciar Nginx",
      commands: [
        "nginx -t",
        "systemctl reload nginx",
        "curl -I http://localhost:3000/api/health"
      ]
    });
  }
  
  return plan;
}

// Função principal
async function main() {
  console.log("\n🤖 ORQUESTRADOR AUTÔNOMO - EDITALIZA");
  console.log("=" .repeat(50));
  console.log("Análise e correção automática sem intervenção humana");
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
    return;
  }
  
  console.log(`\n❌ ${problems.length} problemas encontrados:`);
  problems.forEach(p => console.log("  " + p));
  
  // 2. Busca informações automaticamente
  const projectInfo = await gatherProjectInfo(problems);
  
  // 3. Cria plano de correção
  const fixPlan = createFixPlan(projectInfo);
  
  // 4. Executa correções
  if (fixPlan.agents.length > 0) {
    console.log("\n🚀 Executando correções automáticas...\n");
    
    for (const task of fixPlan.agents) {
      console.log(`\n📦 ${task.task}`);
      
      if (task.commands && Array.isArray(task.commands)) {
        for (const cmd of task.commands) {
          try {
            await runSSHCommand(cmd);
            console.log(`  ✅ OK`);
          } catch (error) {
            console.log(`  ❌ Erro: ${error.message}`);
          }
        }
      }
    }
    
    // 5. Testa novamente
    console.log("\n🔄 Verificando se as correções funcionaram...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const retestResult = await runCommand("node", ["test-production.mjs"]);
    const finalProblems = [];
    if (retestResult.includes("❌")) {
      const lines = retestResult.split("\n");
      lines.forEach(line => {
        if (line.includes("❌")) {
          finalProblems.push(line.trim());
        }
      });
    }
    
    if (finalProblems.length < problems.length) {
      console.log(`\n✨ Melhorou! Problemas reduzidos de ${problems.length} para ${finalProblems.length}`);
    } else if (finalProblems.length === 0) {
      console.log("\n🎉 Todos os problemas foram corrigidos!");
    } else {
      console.log(`\n⚠️ Ainda existem ${finalProblems.length} problemas:`);
      finalProblems.forEach(p => console.log("  " + p));
      console.log("\nPode ser necessária intervenção manual.");
    }
  } else {
    console.log("\n📋 Análise concluída. Problemas identificados:");
    console.log(JSON.stringify(projectInfo, null, 2));
    console.log("\nNenhuma correção automática disponível. Intervenção manual necessária.");
  }
}

// Tratamento de erros
process.on("unhandledRejection", error => {
  console.error("❌ Erro:", error.message);
  process.exit(1);
});

// Executa
main().catch(error => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
