// orchestrator-production.mjs - Orquestrador com foco em Produção
// Fluxo: Testa em produção → Corrige localmente → Push GitHub → Deploy → Verifica produção

import fs from "node:fs";
import path from "node:path";
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const PRODUCTION_URL = "https://editaliza.com.br";
const SSH_CMD = "ssh editaliza";
const GITHUB_REPO = "https://github.com/carlosvictorodrigues/Editaliza";

// Configuração dos agentes
const CFG = {
  architect: {
    command: "claude",
    args: ["--model", "opus", "--print", "--dangerously-skip-permissions"],
    timeout_ms: 120000
  },
  executor_a: {
    command: "claude", 
    args: ["--model", "sonnet", "--print", "--dangerously-skip-permissions"],
    timeout_ms: 120000
  },
  executor_b: {
    command: "gemini",
    args: ["cli", "-p"],
    timeout_ms: 120000
  }
};

// Estado e logs
const STATE_FILE = path.join(process.cwd(), "production-state.json");
const LOG_DIR = path.join(process.cwd(), "production-logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Funcionalidades a testar
const FEATURES = [
  { name: "Login/Registro", url: "/login", check: "form input[name='email']" },
  { name: "Criação de Planos", url: "/plan_settings.html", check: "button#savePlanBtn" },
  { name: "Adicionar Disciplinas", url: "/plan_settings.html", check: "button#addSubjectBtn" },
  { name: "Gerar Cronograma", url: "/schedule.html", check: "div#schedule-container" },
  { name: "Sessões de Estudo", url: "/home.html", check: "button.start-session" },
  { name: "Checklist Modal", url: "/home.html", check: "div#checklistModal" },
  { name: "Timer/Pomodoro", url: "/home.html", check: "div#timerModal" },
  { name: "Notificações", url: "/home.html", check: "div.notification-container" }
];

function log(file, text) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(path.join(LOG_DIR, file), `[${timestamp}]\n${text}\n\n`);
}

function loadState() {
  return fs.existsSync(STATE_FILE) 
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { iteration: 0, issues: [], fixes: [], history: [] };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Testa funcionalidade em produção
async function testProductionFeature(feature) {
  try {
    const checkCmd = `curl -s "${PRODUCTION_URL}${feature.url}" | grep -q "${feature.check}" && echo "OK" || echo "FAIL"`;
    const { stdout } = await execAsync(`${SSH_CMD} "${checkCmd}"`);
    const passed = stdout.trim() === "OK";
    
    log("production-tests.log", `${feature.name}: ${passed ? "✅ PASSOU" : "❌ FALHOU"}`);
    return { feature: feature.name, passed, url: feature.url };
  } catch (error) {
    log("production-tests.log", `${feature.name}: ❌ ERRO - ${error.message}`);
    return { feature: feature.name, passed: false, error: error.message };
  }
}

// Testa todas as funcionalidades
async function testAllFeatures() {
  console.log("\n🔍 Testando funcionalidades em produção...");
  const results = [];
  
  for (const feature of FEATURES) {
    const result = await testProductionFeature(feature);
    results.push(result);
    console.log(`  ${result.passed ? "✅" : "❌"} ${feature.name}`);
  }
  
  return results;
}

// Executa comando via CLI do agente
async function runAgent(agent, prompt) {
  return new Promise((resolve, reject) => {
    const args = [...agent.args, prompt];
    const child = spawn(agent.command, args, { 
      shell: true,
      cwd: process.cwd()
    });
    
    let output = "";
    let error = "";
    
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Agent timeout"));
    }, agent.timeout_ms);
    
    child.stdout.on("data", data => output += data.toString());
    child.stderr.on("data", data => error += data.toString());
    
    child.on("close", code => {
      clearTimeout(timeout);
      if (code !== 0 && error) {
        reject(new Error(error));
      } else {
        resolve(output.trim());
      }
    });
  });
}

// Cria plano de correção com o arquiteto
async function createFixPlan(issues) {
  const prompt = `
CONTEXTO: Sistema Editaliza em produção (app.editaliza.com.br)
PROBLEMAS DETECTADOS:
${issues.map(i => `- ${i.feature}: ${i.error || "não funcional"}`).join("\n")}

MISSÃO: Criar plano detalhado para corrigir TODOS os problemas.
- Backend está OK (confirmado funcionando)
- Frontend tem problemas de sincronização
- Foco em corrigir chamadas incorretas para /subjects (deve ser /subjects_with_topics)

RETORNE JSON:
{
  "fixes": [
    {
      "issue": "nome do problema",
      "file": "arquivo a modificar",
      "change": "mudança específica",
      "test": "como testar"
    }
  ],
  "deploy_steps": ["passo 1", "passo 2"]
}`;

  const response = await runAgent(CFG.architect, prompt);
  log("architect-plan.log", response);
  
  try {
    return JSON.parse(response);
  } catch {
    // Fallback para parsing manual se não for JSON válido
    return {
      fixes: issues.map(i => ({
        issue: i.feature,
        file: "detectar",
        change: "corrigir",
        test: `curl ${PRODUCTION_URL}${i.url || "/"}`
      })),
      deploy_steps: [
        "git add .",
        "git commit -m 'fix: corrigir sincronização frontend/backend'",
        "git push origin main",
        "ssh editaliza 'cd /root/editaliza && git pull && pm2 restart editaliza-app'"
      ]
    };
  }
}

// Aplica correções localmente
async function applyFixes(fixes) {
  console.log("\n🔧 Aplicando correções...");
  
  for (const fix of fixes) {
    console.log(`  Corrigindo: ${fix.issue}`);
    
    // Usa Executor A para correções de backend
    if (fix.file.includes("controller") || fix.file.includes("route")) {
      const prompt = `Corrigir ${fix.issue} em ${fix.file}: ${fix.change}`;
      await runAgent(CFG.executor_a, prompt);
    }
    // Usa Executor B para correções de frontend
    else {
      const prompt = `Corrigir ${fix.issue} em ${fix.file}: ${fix.change}`;
      await runAgent(CFG.executor_b, prompt);
    }
    
    log("fixes.log", `Aplicado: ${fix.issue} - ${fix.file}`);
  }
}

// Deploy para produção
async function deployToProduction(steps) {
  console.log("\n🚀 Fazendo deploy para produção...");
  
  for (const step of steps) {
    console.log(`  Executando: ${step}`);
    try {
      const { stdout, stderr } = await execAsync(step);
      log("deploy.log", `${step}\nOUT: ${stdout}\nERR: ${stderr}`);
    } catch (error) {
      log("deploy.log", `ERRO em ${step}: ${error.message}`);
      throw error;
    }
  }
  
  // Aguarda servidor reiniciar
  console.log("  ⏳ Aguardando servidor reiniciar...");
  await new Promise(resolve => setTimeout(resolve, 10000));
}

// Verificação rápida de saúde
async function healthCheck() {
  try {
    const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${PRODUCTION_URL}`);
    return stdout.trim() === "200";
  } catch {
    return false;
  }
}

// Loop principal
async function main() {
  console.log("🎯 Iniciando Orquestrador de Produção");
  console.log(`📍 Alvo: ${PRODUCTION_URL}`);
  
  let state = loadState();
  const MAX_ITERATIONS = 5;
  
  while (state.iteration < MAX_ITERATIONS) {
    state.iteration++;
    console.log(`\n📊 Iteração ${state.iteration}/${MAX_ITERATIONS}`);
    
    // 1. Testa produção
    const testResults = await testAllFeatures();
    const failedTests = testResults.filter(t => !t.passed);
    
    if (failedTests.length === 0) {
      console.log("\n✅ TODAS AS FUNCIONALIDADES ESTÃO FUNCIONANDO!");
      console.log("🎉 Sistema 100% operacional em produção!");
      saveState(state);
      return;
    }
    
    console.log(`\n❌ ${failedTests.length} problemas encontrados`);
    state.issues = failedTests;
    
    // 2. Cria plano de correção
    const plan = await createFixPlan(failedTests);
    state.fixes = plan.fixes;
    
    // 3. Aplica correções localmente
    await applyFixes(plan.fixes);
    
    // 4. Deploy para produção
    try {
      await deployToProduction(plan.deploy_steps);
    } catch (error) {
      console.error("❌ Erro no deploy:", error.message);
      log("errors.log", `Deploy falhou: ${error.message}`);
    }
    
    // 5. Verifica saúde do servidor
    const healthy = await healthCheck();
    if (!healthy) {
      console.error("⚠️ Servidor não está respondendo!");
      // Tenta rollback
      await execAsync(`${SSH_CMD} "cd /root/editaliza && git reset --hard HEAD~1 && pm2 restart editaliza-app"`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Salva estado
    state.history.push({
      iteration: state.iteration,
      issues: failedTests.length,
      fixes: plan.fixes.length,
      timestamp: new Date().toISOString()
    });
    saveState(state);
    
    console.log("\n⏳ Próxima verificação em 30 segundos...");
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  console.log("\n⚠️ Limite de iterações atingido");
  console.log("📋 Verifique os logs em production-logs/");
  saveState(state);
}

// Tratamento de erros e sinais
process.on("SIGINT", () => {
  console.log("\n\n🛑 Interrompido pelo usuário");
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Erro não tratado:", error);
  log("errors.log", `Unhandled: ${error.stack}`);
  process.exit(1);
});

// Executa
main().catch(error => {
  console.error("❌ Erro fatal:", error);
  log("errors.log", `Fatal: ${error.stack}`);
  process.exit(1);
});