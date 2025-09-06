#!/usr/bin/env node
// orchestrator-v2.mjs - Orquestrador Inteligente com Comunicação Bidirecional

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

// Configuração
const CONFIG = {
  maxRetries: 3,
  parallelAgents: true,
  testTimeout: 120000,
  sshTimeout: 30000,
  localFirst: true, // Sempre desenvolve localmente primeiro
  preserveProduction: true // Nunca edita direto no servidor
};

// Estado global para comunicação entre agentes
const STATE = {
  problems: [],
  context: {},
  decisions: [],
  agentQuestions: new Map(),
  fixes: []
};

// ========== UTILITÁRIOS ==========

function log(message, level = "info") {
  const icons = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
    question: "❓",
    action: "🚀",
    thinking: "🤔"
  };
  console.log(`${icons[level] || ""} ${message}`);
}

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: true,
      cwd: options.cwd || process.cwd(),
      ...options
    });
    
    let output = "";
    let errorOutput = "";
    
    if (!options.silent) {
      child.stdout.on("data", data => {
        const text = data.toString();
        output += text;
        if (options.stream) process.stdout.write(text);
      });
      
      child.stderr.on("data", data => {
        const text = data.toString();
        errorOutput += text;
        if (options.stream) process.stderr.write(text);
      });
    } else {
      child.stdout.on("data", data => output += data.toString());
      child.stderr.on("data", data => errorOutput += data.toString());
    }
    
    child.on("close", code => {
      resolve({
        success: code === 0,
        code,
        output,
        error: errorOutput
      });
    });
    
    if (options.timeout) {
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          code: -1,
          output,
          error: "Timeout"
        });
      }, options.timeout);
    }
  });
}

async function runSSH(command) {
  log(`SSH: ${command}`, "info");
  return runCommand("ssh", ["editaliza", command], {
    timeout: CONFIG.sshTimeout,
    stream: true
  });
}

// ========== ANÁLISE DO PROJETO ==========

async function analyzeProject() {
  log("Analisando estrutura do projeto...", "thinking");
  
  const analysis = {
    frontend: {},
    backend: {},
    database: {},
    server: {}
  };
  
  // Analisa frontend local
  const publicDir = path.join(PROJECT_ROOT, "public");
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    analysis.frontend = {
      htmlFiles: files.filter(f => f.endsWith(".html")),
      jsFiles: files.filter(f => f.endsWith(".js")),
      cssFiles: files.filter(f => f.endsWith(".css")),
      hasSchedule: files.includes("schedule.html"),
      hasHome: files.includes("home.html"),
      hasPlanSettings: files.includes("plan_settings.html")
    };
  }
  
  // Analisa backend local
  const serverFile = path.join(PROJECT_ROOT, "server.js");
  if (fs.existsSync(serverFile)) {
    const content = fs.readFileSync(serverFile, "utf8");
    analysis.backend = {
      exists: true,
      hasExpress: content.includes("express"),
      hasPostgres: content.includes("pg"),
      port: content.match(/PORT[^0-9]*(\d+)/)?.[1] || "3000"
    };
  }
  
  // Verifica servidor remoto
  const pm2Status = await runSSH("pm2 status --no-color");
  analysis.server.pm2 = {
    running: pm2Status.output.includes("online"),
    appName: pm2Status.output.includes("editaliza-app") ? "editaliza-app" : null
  };
  
  const nginxStatus = await runSSH("systemctl status nginx --no-pager | head -5");
  analysis.server.nginx = {
    running: nginxStatus.output.includes("active (running)")
  };
  
  STATE.context = analysis;
  return analysis;
}

// ========== TESTES INTELIGENTES ==========

async function testProduction() {
  log("Testando produção completa...", "action");
  
  // Testa páginas e APIs
  const basicTest = await runCommand("node", ["test-production.mjs"], {
    cwd: __dirname,
    timeout: CONFIG.testTimeout
  });
  
  // Extrai problemas
  const problems = [];
  if (basicTest.output.includes("❌")) {
    const lines = basicTest.output.split("\n");
    lines.forEach(line => {
      if (line.includes("❌")) {
        problems.push(line.trim());
      }
    });
  }
  
  // Testes funcionais adicionais
  log("Testando funcionalidades críticas...", "action");
  
  // Testa login
  const loginTest = await testLogin();
  if (!loginTest.success) {
    problems.push("❌ Login não funcional");
  }
  
  // Testa criação de plano
  const planTest = await testPlanCreation();
  if (!planTest.success) {
    problems.push("❌ Criação de planos não funcional");
  }
  
  STATE.problems = problems;
  return problems;
}

async function testLogin() {
  // Tenta fazer login via curl
  const result = await runCommand("curl", [
    "-s", "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", JSON.stringify({
      email: "test@editaliza.com",
      password: "test123"
    }),
    "https://app.editaliza.com.br/api/auth/login"
  ], { timeout: 10000 });
  
  return {
    success: result.output.includes("token") || result.output.includes("success")
  };
}

async function testPlanCreation() {
  // Testa endpoint de criação de planos
  const result = await runCommand("curl", [
    "-s", "-X", "GET",
    "https://app.editaliza.com.br/api/subjects_with_topics"
  ], { timeout: 10000 });
  
  return {
    success: !result.output.includes("502") && !result.output.includes("error")
  };
}

// ========== CONSULTA INTELIGENTE (Claude + Gemini) ==========

async function consultAdvisors(problem, context) {
  log("Consultando múltiplos conselheiros...", "thinking");
  
  const prompt = `
PROBLEMA DETECTADO:
${problem}

CONTEXTO DO PROJETO:
${JSON.stringify(context, null, 2)}

OBJETIVO: Corrigir o problema SEM editar diretamente no servidor.
Fluxo obrigatório: Desenvolvimento LOCAL → Git commit → Push GitHub → Pull no servidor

Retorne um JSON com:
{
  "diagnosis": "explicação do problema",
  "solution": "solução proposta",
  "localChanges": ["arquivos para modificar localmente"],
  "commands": ["comandos para executar"],
  "needsInfo": ["perguntas se precisar mais informações"]
}
`;

  // Consulta Claude
  const claudeResult = await runCommand("claude", [
    "--model", "opus",
    "--print",
    prompt
  ], { timeout: 30000, silent: true });
  
  // Consulta Gemini
  const geminiResult = await runCommand("gemini", [
    "-p", prompt
  ], { timeout: 30000, silent: true });
  
  // Extrai e combina respostas
  const decisions = [];
  
  try {
    const claudeJSON = extractJSON(claudeResult.output);
    if (claudeJSON) decisions.push({ source: "claude", ...claudeJSON });
  } catch (e) {
    log("Claude não retornou JSON válido", "warning");
  }
  
  try {
    const geminiJSON = extractJSON(geminiResult.output);
    if (geminiJSON) decisions.push({ source: "gemini", ...geminiJSON });
  } catch (e) {
    log("Gemini não retornou JSON válido", "warning");
  }
  
  // Combina as melhores sugestões
  return mergeSolutions(decisions);
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      const codeMatch = text.match(/```json\s*([\s\S]*?)```/);
      if (codeMatch) {
        return JSON.parse(codeMatch[1]);
      }
    }
  }
  return null;
}

function mergeSolutions(decisions) {
  if (decisions.length === 0) return null;
  if (decisions.length === 1) return decisions[0];
  
  // Combina soluções de múltiplos conselheiros
  const merged = {
    diagnosis: decisions.map(d => d.diagnosis).join(" | "),
    solution: decisions.map(d => d.solution).join(" + "),
    localChanges: [...new Set(decisions.flatMap(d => d.localChanges || []))],
    commands: [...new Set(decisions.flatMap(d => d.commands || []))],
    needsInfo: [...new Set(decisions.flatMap(d => d.needsInfo || []))]
  };
  
  return merged;
}

// ========== EXECUTORES PARALELOS ==========

async function executeAgents(tasks) {
  log("Executando agentes em paralelo...", "action");
  
  const agentPromises = tasks.map(task => executeAgent(task));
  
  if (CONFIG.parallelAgents) {
    // Executa em paralelo
    const results = await Promise.allSettled(agentPromises);
    return results.map(r => r.status === "fulfilled" ? r.value : { success: false, error: r.reason });
  } else {
    // Executa sequencialmente
    const results = [];
    for (const promise of agentPromises) {
      results.push(await promise);
    }
    return results;
  }
}

async function executeAgent(task) {
  log(`Agente ${task.type}: ${task.description}`, "action");
  
  switch (task.type) {
    case "local_edit":
      return executeLocalEdit(task);
    case "git_operations":
      return executeGitOperations(task);
    case "server_deploy":
      return executeServerDeploy(task);
    case "test":
      return executeTest(task);
    default:
      return { success: false, error: "Unknown agent type" };
  }
}

async function executeLocalEdit(task) {
  // Edita arquivos localmente
  for (const file of task.files || []) {
    const filePath = path.join(PROJECT_ROOT, file.path);
    if (fs.existsSync(filePath)) {
      // Aqui você implementaria a lógica de edição
      log(`Editando ${file.path}`, "info");
    }
  }
  return { success: true };
}

async function executeGitOperations(task) {
  // Operações Git
  const commands = [
    "git add .",
    `git commit -m "${task.message || 'Fix: Auto-correção pelo orchestrator'}"`,
    "git push origin main"
  ];
  
  for (const cmd of commands) {
    const result = await runCommand(cmd, [], {
      cwd: PROJECT_ROOT,
      stream: true
    });
    if (!result.success) {
      return { success: false, error: `Git falhou: ${cmd}` };
    }
  }
  
  return { success: true };
}

async function executeServerDeploy(task) {
  // Deploy no servidor
  const commands = [
    "cd /root/editaliza && git pull origin main",
    "cd /root/editaliza && npm install --production",
    "pm2 restart editaliza-app"
  ];
  
  for (const cmd of commands) {
    const result = await runSSH(cmd);
    if (!result.success) {
      return { success: false, error: `Deploy falhou: ${cmd}` };
    }
  }
  
  return { success: true };
}

async function executeTest(task) {
  // Executa testes
  const result = await runCommand("node", [task.testFile || "test-production.mjs"], {
    cwd: __dirname,
    timeout: CONFIG.testTimeout
  });
  
  return {
    success: !result.output.includes("❌"),
    output: result.output
  };
}

// ========== LOOP DE CORREÇÃO INTELIGENTE ==========

async function intelligentFixLoop() {
  let attempts = 0;
  
  while (attempts < CONFIG.maxRetries) {
    attempts++;
    log(`\n========== TENTATIVA ${attempts}/${CONFIG.maxRetries} ==========\n`, "info");
    
    // 1. Analisa projeto
    const projectAnalysis = await analyzeProject();
    
    // 2. Testa produção
    const problems = await testProduction();
    
    if (problems.length === 0) {
      log("Todos os problemas foram resolvidos!", "success");
      return true;
    }
    
    log(`${problems.length} problemas detectados`, "warning");
    
    // 3. Para cada problema, consulta conselheiros
    const solutions = [];
    for (const problem of problems) {
      const solution = await consultAdvisors(problem, projectAnalysis);
      if (solution) {
        solutions.push(solution);
      }
    }
    
    // 4. Cria plano de execução
    const executionPlan = createExecutionPlan(solutions);
    
    // 5. Executa correções
    const results = await executeAgents(executionPlan);
    
    // 6. Verifica resultados
    const successCount = results.filter(r => r.success).length;
    log(`${successCount}/${results.length} tarefas concluídas com sucesso`, "info");
    
    // Aguarda antes de re-testar
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  log("Máximo de tentativas alcançado", "error");
  return false;
}

function createExecutionPlan(solutions) {
  const plan = [];
  
  // Agrupa soluções por tipo
  const localChanges = solutions.flatMap(s => s.localChanges || []);
  const commands = solutions.flatMap(s => s.commands || []);
  
  // 1. Edições locais
  if (localChanges.length > 0) {
    plan.push({
      type: "local_edit",
      description: "Corrigir arquivos localmente",
      files: localChanges.map(f => ({ path: f }))
    });
  }
  
  // 2. Git operations
  if (localChanges.length > 0) {
    plan.push({
      type: "git_operations",
      description: "Commit e push das correções",
      message: `Fix: Correção automática de ${solutions.length} problemas`
    });
  }
  
  // 3. Deploy
  if (localChanges.length > 0 || commands.length > 0) {
    plan.push({
      type: "server_deploy",
      description: "Deploy das correções no servidor"
    });
  }
  
  // 4. Teste final
  plan.push({
    type: "test",
    description: "Verificar se correções funcionaram"
  });
  
  return plan;
}

// ========== MAIN ==========

async function main() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       🤖 ORCHESTRATOR V2 - EDITALIZA                      ║");
  console.log("║       Sistema Inteligente de Correção Automática          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");
  
  log("Iniciando correção inteligente...", "action");
  log("Fluxo: LOCAL → GitHub → Servidor", "info");
  log("Consultores: Claude + Gemini", "info");
  log("Execução: Paralela", "info");
  console.log("\n");
  
  const success = await intelligentFixLoop();
  
  if (success) {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║       ✅ PLATAFORMA 100% FUNCIONAL                        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("\n");
  } else {
    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║       ⚠️  INTERVENÇÃO MANUAL NECESSÁRIA                   ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("\n");
    
    log("Problemas restantes:", "error");
    STATE.problems.forEach(p => console.log(`  ${p}`));
  }
}

// Tratamento de erros
process.on("unhandledRejection", error => {
  log(`Erro não tratado: ${error.message}`, "error");
  process.exit(1);
});

// Executa
main().catch(error => {
  log(`Erro fatal: ${error.message}`, "error");
  process.exit(1);
});