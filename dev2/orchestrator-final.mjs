#!/usr/bin/env node
// orchestrator-final.mjs - Sistema Completo de Correção Automática

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

// ========== CONFIGURAÇÃO ==========
const CONFIG = {
  testUrl: "https://app.editaliza.com.br",
  localFirst: true,
  preserveProduction: true,
  maxRetries: 3
};

// ========== CLASSE PRINCIPAL DO ORQUESTRADOR ==========
class Orchestrator {
  constructor() {
    this.problems = [];
    this.context = {};
    this.agentQuestions = new Map();
    this.solutions = [];
    this.agents = new Map();
  }

  log(message, level = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅", 
      error: "❌",
      warning: "⚠️",
      question: "❓",
      action: "🚀",
      thinking: "🤔",
      fix: "🔧"
    };
    console.log(`${icons[level] || ""} ${message}`);
  }

  // Responde perguntas dos agentes
  async answerAgentQuestion(agent, question) {
    this.log(`${agent} pergunta: ${question}`, "question");
    
    // Busca resposta baseada no contexto
    if (question.includes("PM2") || question.includes("servidor")) {
      if (this.context.server?.pm2?.running) {
        return "Sim, o servidor está rodando com PM2";
      }
      return "Não, o servidor não está rodando";
    }
    
    if (question.includes("API") || question.includes("URL")) {
      return "A API deve usar https://app.editaliza.com.br/api";
    }
    
    if (question.includes("endpoint") || question.includes("testar")) {
      return "/api/health é o endpoint para teste";
    }
    
    // Se não souber, consulta os conselheiros
    return await this.consultAdvisors(question);
  }

  // Executa comando com timeout
  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        shell: true,
        cwd: options.cwd || process.cwd(),
        ...options
      });
      
      let output = "";
      let errorOutput = "";
      
      child.stdout.on("data", data => {
        output += data.toString();
        if (options.stream) process.stdout.write(data);
      });
      
      child.stderr.on("data", data => {
        errorOutput += data.toString();
        if (options.stream && !options.silent) process.stderr.write(data);
      });
      
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
          resolve({ success: false, code: -1, output, error: "Timeout" });
        }, options.timeout);
      }
    });
  }

  // Executa comando SSH
  async runSSH(command) {
    this.log(`SSH: ${command}`, "action");
    return this.runCommand("ssh", ["editaliza", command], {
      timeout: 30000,
      stream: true
    });
  }

  // Analisa o projeto completo
  async analyzeProject() {
    this.log("Analisando projeto local e remoto...", "thinking");
    
    // Análise local
    const publicDir = path.join(PROJECT_ROOT, "public");
    const srcDir = path.join(PROJECT_ROOT, "src");
    
    this.context.local = {
      hasPublic: fs.existsSync(publicDir),
      hasSrc: fs.existsSync(srcDir),
      publicFiles: fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [],
      srcStructure: fs.existsSync(srcDir) ? this.getDirectoryStructure(srcDir) : {}
    };
    
    // Análise remota
    const pm2Result = await this.runSSH("pm2 list --no-color");
    const nginxResult = await this.runSSH("systemctl is-active nginx");
    
    this.context.server = {
      pm2: {
        running: pm2Result.output.includes("online"),
        hasEditalizaApp: pm2Result.output.includes("editaliza-app")
      },
      nginx: {
        running: nginxResult.output.includes("active (running)")
      }
    };
    
    // Verifica comunicação frontend-backend
    const apiTest = await this.runCommand("curl", [
      "-s", "-I", `${CONFIG.testUrl}/api/health`
    ], { timeout: 10000 });
    
    this.context.api = {
      accessible: apiTest.output.includes("200") || apiTest.output.includes("OK"),
      status: apiTest.output.match(/HTTP\/\d\.\d (\d+)/)?.[1] || "unknown"
    };
    
    return this.context;
  }

  // Obtém estrutura de diretório
  getDirectoryStructure(dir) {
    const structure = {};
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith(".") && item !== "node_modules") {
        structure[item] = this.getDirectoryStructure(fullPath);
      } else if (stat.isFile()) {
        structure[item] = "file";
      }
    }
    
    return structure;
  }

  // Testa funcionalidades da plataforma
  async testPlatform() {
    this.log("Testando plataforma completa...", "action");
    const problems = [];
    
    // 1. Teste básico de páginas
    const basicTest = await this.runCommand("node", ["test-production.mjs"], {
      cwd: __dirname,
      timeout: 60000
    });
    
    if (basicTest.output.includes("❌")) {
      const lines = basicTest.output.split("\n");
      lines.forEach(line => {
        if (line.includes("❌")) {
          problems.push(line.trim());
        }
      });
    }
    
    // 2. Teste de login
    this.log("Testando sistema de login...", "action");
    const loginTest = await this.runCommand("curl", [
      "-s", "-X", "POST",
      "-H", "Content-Type: application/json",
      "-d", JSON.stringify({
        email: "test@editaliza.com",
        password: "test123"
      }),
      `${CONFIG.testUrl}/api/auth/login`
    ], { timeout: 10000 });
    
    if (!loginTest.output.includes("token") && !loginTest.output.includes("success")) {
      problems.push("❌ Sistema de login não funcional");
    }
    
    // 3. Teste de criação de planos
    this.log("Testando criação de planos...", "action");
    const planTest = await this.runCommand("curl", [
      "-s", `${CONFIG.testUrl}/api/subjects_with_topics`
    ], { timeout: 10000 });
    
    if (planTest.output.includes("502") || planTest.output.includes("error")) {
      problems.push("❌ API de planos não acessível");
    }
    
    // 4. Teste de disciplinas
    this.log("Testando sistema de disciplinas...", "action");
    const subjectsTest = await this.runCommand("curl", [
      "-s", `${CONFIG.testUrl}/api/subjects`
    ], { timeout: 10000 });
    
    if (subjectsTest.output.includes("404")) {
      problems.push("❌ Rota /api/subjects não existe (usar /api/subjects_with_topics)");
    }
    
    this.problems = problems;
    return problems;
  }

  // Consulta Claude e Gemini
  async consultAdvisors(problem) {
    this.log("Consultando Claude e Gemini...", "thinking");
    
    const prompt = `
PROBLEMA: ${problem}

CONTEXTO:
${JSON.stringify(this.context, null, 2)}

REGRAS:
1. NUNCA editar diretamente no servidor
2. Fluxo: LOCAL → Git → GitHub → Pull no servidor
3. Retorne JSON com: diagnosis, solution, localFiles, commands

Responda em JSON:
{
  "diagnosis": "explicação",
  "solution": "solução",
  "localFiles": ["arquivos para editar localmente"],
  "commands": ["comandos para executar"]
}`;

    // Consulta paralela
    const [claudeResult, geminiResult] = await Promise.all([
      this.runCommand("claude", ["--model", "opus", "--print", prompt], {
        timeout: 30000,
        silent: true
      }),
      this.runCommand("gemini", ["-p", prompt], {
        timeout: 30000,
        silent: true
      })
    ]);
    
    // Extrai e combina respostas
    const solutions = [];
    
    try {
      const claudeJSON = this.extractJSON(claudeResult.output);
      if (claudeJSON) solutions.push({ source: "claude", ...claudeJSON });
    } catch (e) {
      this.log("Claude não retornou JSON válido", "warning");
    }
    
    try {
      const geminiJSON = this.extractJSON(geminiResult.output);
      if (geminiJSON) solutions.push({ source: "gemini", ...geminiJSON });
    } catch (e) {
      this.log("Gemini não retornou JSON válido", "warning");
    }
    
    return this.mergeSolutions(solutions);
  }

  // Extrai JSON de texto
  extractJSON(text) {
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

  // Mescla soluções de múltiplos conselheiros
  mergeSolutions(solutions) {
    if (solutions.length === 0) return null;
    if (solutions.length === 1) return solutions[0];
    
    return {
      diagnosis: solutions.map(s => s.diagnosis).join(" + "),
      solution: solutions.map(s => s.solution).join(" | "),
      localFiles: [...new Set(solutions.flatMap(s => s.localFiles || []))],
      commands: [...new Set(solutions.flatMap(s => s.commands || []))]
    };
  }

  // Corrige problemas identificados
  async fixProblems() {
    this.log(`Corrigindo ${this.problems.length} problemas...`, "fix");
    
    for (const problem of this.problems) {
      this.log(`Problema: ${problem}`, "warning");
      
      // Consulta conselheiros
      const solution = await this.consultAdvisors(problem);
      
      if (solution) {
        this.log(`Solução: ${solution.solution}`, "info");
        
        // Aplica correções locais
        if (solution.localFiles && solution.localFiles.length > 0) {
          await this.applyLocalFixes(solution.localFiles, problem);
        }
        
        // Executa comandos
        if (solution.commands && solution.commands.length > 0) {
          await this.executeCommands(solution.commands);
        }
      }
    }
    
    // Commit e deploy se houve mudanças locais
    if (await this.hasLocalChanges()) {
      await this.deployChanges();
    }
  }

  // Aplica correções locais
  async applyLocalFixes(files, problem) {
    this.log("Aplicando correções locais...", "fix");
    
    for (const file of files) {
      const filePath = path.join(PROJECT_ROOT, file);
      
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, "utf8");
        let modified = false;
        
        // Correções específicas baseadas no problema
        if (problem.includes("502") || problem.includes("API")) {
          // Corrige URLs da API
          if (content.includes("http://localhost")) {
            content = content.replace(/http:\/\/localhost:3000/g, CONFIG.testUrl);
            modified = true;
          }
          
          if (content.includes("/subjects") && !content.includes("/subjects_with_topics")) {
            content = content.replace(/\/subjects(?!_with_topics)/g, "/subjects_with_topics");
            modified = true;
          }
        }
        
        if (modified) {
          fs.writeFileSync(filePath, content);
          this.log(`Corrigido: ${file}`, "success");
        }
      }
    }
  }

  // Executa comandos
  async executeCommands(commands) {
    for (const cmd of commands) {
      if (cmd.startsWith("ssh") || cmd.includes("pm2") || cmd.includes("nginx")) {
        // Comando remoto
        await this.runSSH(cmd.replace("ssh editaliza ", ""));
      } else {
        // Comando local
        await this.runCommand(cmd, [], {
          cwd: PROJECT_ROOT,
          stream: true
        });
      }
    }
  }

  // Verifica se há mudanças locais
  async hasLocalChanges() {
    const gitStatus = await this.runCommand("git", ["status", "--porcelain"], {
      cwd: PROJECT_ROOT
    });
    return gitStatus.output.trim().length > 0;
  }

  // Deploy das mudanças
  async deployChanges() {
    this.log("Fazendo deploy das correções...", "action");
    
    // Git operations
    await this.runCommand("git add .", [], { cwd: PROJECT_ROOT });
    await this.runCommand(`git commit -m "Fix: Correção automática de problemas da plataforma"`, [], {
      cwd: PROJECT_ROOT,
      shell: true
    });
    await this.runCommand("git push origin main", [], { cwd: PROJECT_ROOT });
    
    // Pull no servidor
    await this.runSSH("cd /root/editaliza && git pull origin main");
    await this.runSSH("cd /root/editaliza && npm install --production");
    await this.runSSH("pm2 restart editaliza-app");
    
    this.log("Deploy concluído!", "success");
  }

  // Loop principal de correção
  async run() {
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║          🤖 ORCHESTRATOR FINAL - EDITALIZA                ║");
    console.log("║          Sistema Autônomo de Correção Completa            ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    
    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
      this.log(`\n======== TENTATIVA ${attempt}/${CONFIG.maxRetries} ========\n`, "info");
      
      // 1. Analisa projeto
      await this.analyzeProject();
      
      // 2. Testa plataforma
      const problems = await this.testPlatform();
      
      if (problems.length === 0) {
        console.log("\n╔══════════════════════════════════════════════════════════╗");
        console.log("║          ✅ PLATAFORMA 100% FUNCIONAL!                    ║");
        console.log("╚══════════════════════════════════════════════════════════╝\n");
        return true;
      }
      
      this.log(`${problems.length} problemas encontrados`, "warning");
      
      // 3. Corrige problemas
      await this.fixProblems();
      
      // 4. Aguarda antes de re-testar
      this.log("Aguardando 10 segundos antes de re-testar...", "info");
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║          ⚠️  ALGUMAS CORREÇÕES MANUAIS NECESSÁRIAS        ║");
    console.log("╚══════════════════════════════════════════════════════════╝\n");
    
    this.log("Problemas restantes:", "error");
    this.problems.forEach(p => console.log(`  ${p}`));
    
    return false;
  }
}

// ========== EXECUÇÃO ==========
async function main() {
  const orchestrator = new Orchestrator();
  
  try {
    await orchestrator.run();
  } catch (error) {
    console.error("❌ Erro fatal:", error.message);
    process.exit(1);
  }
}

// Tratamento de erros globais
process.on("unhandledRejection", error => {
  console.error("❌ Erro não tratado:", error.message);
  process.exit(1);
});

// Inicia
main();
