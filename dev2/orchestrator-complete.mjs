#!/usr/bin/env node
// orchestrator-complete.mjs - Sistema Completo com Todos os Agentes

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let PROJECT_ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "agents.json"), "utf8"));
// Se configurado, use o diretÃ³rio raiz do projeto informado em agents.json
if (CONFIG.project_dir && typeof CONFIG.project_dir === "string" && fs.existsSync(CONFIG.project_dir)) {
  PROJECT_ROOT = CONFIG.project_dir;
}

// ========== CLASSE BASE DO AGENTE ==========
class Agent {
  constructor(id, config, orchestrator) {
    this.id = id;
    this.name = config.name;
    this.command = config.command;
    this.specialization = config.specialization;
    this.patterns = config.patterns;
    this.timeout = config.timeout_ms;
    this.retryCount = config.retry_count;
    this.orchestrator = orchestrator;
    this.env = config.env || {};
  }

  async askOrchestrator(question) {
    console.log(`[${this.name}] â“ ${question}`);
    return this.orchestrator.answerAgentQuestion(this.name, question);
  }

  async execute(prompt) {
    console.log(`[${this.name}] ðŸš€ Executando tarefa...`);
    
    for (let retry = 0; retry < this.retryCount; retry++) {
      for (const pattern of this.patterns) {
        try {
          const command = pattern
            .replace(/{cmd}/g, this.command)
            .replace(/{prompt}/g, prompt);
          
          const result = await this.runCommand(command);
          if (result.success) {
            return result.output;
          }
        } catch (e) {
          console.log(`[${this.name}] âš ï¸ Tentativa ${retry + 1} falhou`);
        }
      }
    }
    
    return null;
  }

  async runCommand(command) {
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        shell: true,
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...this.env }
      });
      
      let output = "";
      let errorOutput = "";
      
      child.stdout.on("data", data => output += data.toString());
      child.stderr.on("data", data => errorOutput += data.toString());
      
      child.on("close", code => {
        resolve({
          success: code === 0,
          output,
          error: errorOutput
        });
      });
      
      setTimeout(() => {
        child.kill();
        resolve({ success: false, output, error: "Timeout" });
      }, this.timeout);
    });
  }
}

// ========== AGENTES ESPECIALIZADOS ==========

class FrontendAgent extends Agent {
  analyzeProblem = async (problem) => {
    const discovery = this.orchestrator?.context?.discovery;
    if (!discovery || !Array.isArray(discovery.mismatches) || discovery.mismatches.length === 0) {
      return null;
    }

    // Corrigir somente arquivos onde um mismatch real foi detectado
    const files = Array.from(new Set(discovery.mismatches.map(m => m.file).filter(Boolean)));
    if (files.length === 0) return null;

    // Se nesses arquivos há chamadas absolutas para localhost, atualiza base URL
    const raw = (discovery.frontend && discovery.frontend.raw) || [];
    const needsBase = raw.some(r => r && r.url && /^http:\/\/localhost/i.test(r.url) && files.includes(r.file));
    const apiUrl = await this.askOrchestrator("Qual URL a API frontend deve usar?");

    const fixes = [];
    if (needsBase) fixes.push({ find: "http://localhost:3000", replace: apiUrl });
    // Ajuste específico de subjects -> subjects_with_topics
    fixes.push({ find: "/subjects(?!_with_topics)", replace: "/subjects_with_topics" });

    return {
      diagnosis: "Frontend com endpoints divergentes do backend",
      solution: "Aplicar correções mínimas apenas nos arquivos afetados",
      files,
      fixes,
    };
  }
  async findAPIFiles() {
    const found = [];
    const jsDir = path.join(PROJECT_ROOT, "public", "js");
    if (!fs.existsSync(jsDir)) return found;

    const stack = [jsDir];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) { stack.push(full); continue; }
        // Considera apenas arquivos .js/.mjs
        if (!/\.(m?js)$/i.test(entry)) continue;
        const content = fs.readFileSync(full, "utf8");
        if (content.includes("fetch") || content.includes("api/")) {
          const rel = path.relative(PROJECT_ROOT, full).replace(/\\/g, "/");
          found.push(rel);
        }
      }
    }
    return found;
  }
}

class BackendAgent extends Agent {
  analyzeProblem = async (problem) => {
    if (problem.includes("502") || !problem.includes("API")) {
      const pm2Status = await this.askOrchestrator("PM2 mostra o app online?");
      
      if (pm2Status.includes("nÃ£o") || pm2Status.includes("offline")) {
        return {
          diagnosis: "Backend nÃ£o estÃ¡ rodando",
          solution: "Iniciar aplicaÃ§Ã£o com PM2",
          commands: [
            "pm2 start server.js --name editaliza-app",
            "pm2 save",
            "pm2 startup"
          ]
        };
      }
    }
    
    if (problem.includes("auth") || problem.includes("login")) {
      return {
        diagnosis: "Problema de autenticaÃ§Ã£o",
        solution: "Verificar sistema de auth",
        files: ["src/middleware/auth.js", "src/controllers/auth.controller.js"]
      };
    }
    
    return null;
  }
}

class DatabaseAgent extends Agent {
  analyzeProblem = async (problem) => {
    if (problem.includes("login") || problem.includes("user")) {
      return {
        diagnosis: "PossÃ­vel problema no banco de dados",
        solution: "Verificar tabelas e conexÃ£o",
        commands: [
          "PGPASSWORD=Editaliza2025 psql -U editaliza_user -h localhost -d editaliza_db -c '\\dt'",
          "PGPASSWORD=Editaliza2025 psql -U editaliza_user -h localhost -d editaliza_db -c 'SELECT COUNT(*) FROM users'"
        ]
      };
    }
    
    if (problem.includes("plan") || problem.includes("subject")) {
      return {
        diagnosis: "Tabelas de planos podem estar faltando",
        solution: "Verificar estrutura das tabelas",
        commands: [
          "PGPASSWORD=Editaliza2025 psql -U editaliza_user -h localhost -d editaliza_db -c 'SELECT * FROM plans LIMIT 1'",
          "PGPASSWORD=Editaliza2025 psql -U editaliza_user -h localhost -d editaliza_db -c 'SELECT * FROM subjects LIMIT 1'"
        ]
      };
    }
    
    return null;
  }
}

class DevOpsAgent extends Agent {
  analyzeProblem = async (problem) => {
    if (problem.includes("502") || problem.includes("nginx")) {
      return {
        diagnosis: "Problema de proxy/nginx",
        solution: "Verificar e reiniciar serviÃ§os",
        commands: [
          "nginx -t",
          "systemctl reload nginx",
          "pm2 restart editaliza-app"
        ]
      };
    }
    
    return {
      diagnosis: "Deploy necessÃ¡rio",
      solution: "Atualizar cÃ³digo no servidor",
      commands: [
        "cd /root/editaliza && git pull origin main",
        "cd /root/editaliza && npm install --production",
        "pm2 restart editaliza-app"
      ]
    };
  }
}

class QAAgent extends Agent {
  constructor(id, config, orchestrator) {
    super(id, config, orchestrator);
    this.cookieFile = path.join(os.tmpdir(), "editaliza_qa_cookies.txt");
    this.loggedIn = false;
  }

  analyzeProblem = async (problem) => {
    const p = (problem || "").toLowerCase();
    if (p.includes("login") || p.includes("auth")) {
      return {
        diagnosis: "Login falhando ou credenciais ausentes",
        solution: "Configurar EDITALIZA_TEST_EMAIL/EDITALIZA_TEST_PASSWORD e validar /api/auth/login",
        files: []
      };
    }
    if (p.includes("plans") || p.includes("subjects")) {
      return {
        diagnosis: "Testes em endpoint protegido sem sessÃ£o",
        solution: "Efetuar login e reutilizar cookies ao chamar APIs protegidas",
        files: []
      };
    }
    return null;
  }

  async ensureLogin() {
    if (this.loggedIn) return true;
    const baseUrl = CONFIG.production.url;
    const email = process.env.EDITALIZA_TEST_EMAIL || process.env.EDTLZ_EMAIL || (CONFIG.production.test_user && CONFIG.production.test_user.email);
    const password = process.env.EDITALIZA_TEST_PASSWORD || process.env.EDTLZ_PASSWORD || (CONFIG.production.test_user && CONFIG.production.test_user.password);
    if (!email || !password) {
      console.log(`[${this.name}] Credenciais de teste nÃ£o configuradas (EDITALIZA_TEST_EMAIL/EDITALIZA_TEST_PASSWORD)`);
      return false;
    }
    const payload = JSON.stringify({ email, password });
    const result = await this.orchestrator.runCommand("curl", [
      "-s", "-X", "POST",
      "-H", "Content-Type: application/json",
      "-d", payload,
      "-c", this.cookieFile,
      `${baseUrl}/api/auth/login`
    ]);
    const ok = (/token|success|200|ok/i.test(result.output || "")) || fs.existsSync(this.cookieFile);
    this.loggedIn = !!ok;
    return this.loggedIn;
  }

  async testFunctionality(feature) {
    console.log(`[${this.name}] ðŸ§ª Testando ${feature}...`);
    
    const tests = {
      login: async () => {
        return await this.ensureLogin();
      },
      
      plans: async () => {
        const ready = await this.ensureLogin();
        if (!ready) return false;
        const result = await this.orchestrator.runCommand("curl", [
          "-s", "-b", this.cookieFile,
          `${CONFIG.production.url}/api/subjects_with_topics`
        ]);
        const out = (result.output || "").toLowerCase();
        return !(out.includes("401") || out.includes("403") || out.includes("502") || out.includes("error"));
      },
      
      health: async () => {
        const result = await this.orchestrator.runCommand("curl", [
          "-s", `${CONFIG.production.url}/api/health`
        ]);
        return result.output.includes("ok") || result.output.includes("200");
      }
    };
    
    if (tests[feature]) {
      return await tests[feature]();
    }
    
    return false;
  }
}

// ========== ORQUESTRADOR PRINCIPAL ==========

class CompleteOrchestrator {
  constructor() {
    this.agents = new Map();
    this.problems = [];
    this.context = {};
    this.solutions = [];
    
    // Inicializa todos os agentes
    this.agents.set("fe", new FrontendAgent("fe", CONFIG.agents.fe, this));
    this.agents.set("be", new BackendAgent("be", CONFIG.agents.be, this));
    this.agents.set("dba", new DatabaseAgent("dba", CONFIG.agents.dba, this));
    this.agents.set("devops", new DevOpsAgent("devops", CONFIG.agents.devops, this));
    this.agents.set("qa", new QAAgent("qa", CONFIG.agents.qa, this));
  }

  log(message, level = "info") {
    const icons = {
      info: "â„¹ï¸",
      success: "âœ…",
      error: "âŒ",
      warning: "âš ï¸",
      thinking: "ðŸ¤”",
      action: "ðŸš€"
    };
    console.log(`${icons[level] || ""} ${message}`);
  }

  // Responde perguntas dos agentes baseado no contexto
  async answerAgentQuestion(agent, question) {
    this.log(`Respondendo pergunta de ${agent}: ${question}`, "thinking");
    
    // Respostas baseadas no contexto atual
    if (question.includes("PM2")) {
      return this.context.server?.pm2?.running ? "Sim, PM2 estÃ¡ online" : "NÃ£o, PM2 nÃ£o estÃ¡ rodando";
    }
    
    if (question.includes("URL") && question.includes("API")) {
      return CONFIG.production.url;
    }
    
    // Consulta arquiteto se nÃ£o souber
    return await this.consultArchitect(question);
  }

  // Consulta o arquiteto (Claude/Gemini)
  async consultArchitect(question) {
    const prompt = `
${question}

Contexto:
${JSON.stringify(this.context, null, 2)}

Responda de forma concisa e direta.`;

    // Tenta Claude primeiro
    for (const pattern of CONFIG.architect.patterns) {
      try {
        const command = pattern
          .replace(/{cmd}/g, CONFIG.architect.command)
          .replace(/{prompt}/g, prompt);
        
        const result = await this.runCommand(command, [], {
          timeout: CONFIG.architect.timeout_ms,
          env: CONFIG.architect.env
        });
        
        if (result.success) return result.output;
      } catch (e) {
        // Continua tentando
      }
    }
    
    // Fallback para Gemini
    for (const pattern of CONFIG.architect_fallback.patterns) {
      try {
        const command = pattern
          .replace(/{cmd}/g, CONFIG.architect_fallback.command)
          .replace(/{prompt}/g, prompt);
        
        const result = await this.runCommand(command, [], {
          timeout: CONFIG.architect_fallback.timeout_ms
        });
        
        if (result.success) return result.output;
      } catch (e) {
        // Continua tentando
      }
    }
    
    return "NÃ£o foi possÃ­vel obter resposta";
  }

  // Executa comando
  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        shell: true,
        cwd: options.cwd || PROJECT_ROOT,
        env: { ...process.env, ...(options.env || {}) }
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
    // Tenta algumas vezes e marca disponibilidade no contexto
    let last;
    for (let i = 0; i < 3; i++) {
      last = await this.runCommand("ssh", ["editaliza", command], {
        timeout: 30000,
        stream: true
      });
      if (last.success) {
        this.context.sshAvailable = true;
        return last;
      }
      const err = (last.error || last.output || "").toLowerCase();
      if (err.includes("connection reset") || err.includes("kex_exchange") || err.includes("connection closed")) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      } else {
        break;
      }
    }
    this.context.sshAvailable = false;
    this.log("SSH indisponÃ­vel no momento; seguindo com checks locais", "warning");
    return last;
  }

  // Analisa o projeto
  async analyzeProject() {
    this.log("Analisando projeto completo...", "thinking");
    
    // AnÃ¡lise local
    this.context.local = {
      hasPublic: fs.existsSync(path.join(PROJECT_ROOT, "public")),
      hasSrc: fs.existsSync(path.join(PROJECT_ROOT, "src")),
      hasServer: fs.existsSync(path.join(PROJECT_ROOT, "server.js"))
    };
    
    // AnÃ¡lise remota
    const pm2Status = await this.runSSH("pm2 status --no-color");
    this.context.server = {
      pm2: {
        running: pm2Status.output.includes("online"),
        hasApp: pm2Status.output.includes(CONFIG.pm2_app)
      }
    };
    
    const nginxStatus = await this.runSSH("systemctl is-active nginx");
    this.context.nginx = {
      running: nginxStatus.output.includes("active")
    };
    
    return this.context;
  }

  // Descobre rotas do backend e chamadas de API no frontend
  async discoverPlatform() {
    const discovery = { backend: { routes: [] }, frontend: { calls: [] }, mismatches: [] };

    const tryDirs = [
      PROJECT_ROOT,
      path.join(__dirname, ".."),
      process.cwd()
    ].filter((p, i, a) => !!p && fs.existsSync(p) && a.indexOf(p) === i);

    const exts = [".js", ".mjs", ".cjs", ".html"];

    const walk = (dir, acc) => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const full = path.join(dir, entry);
          let stat;
          try { stat = fs.statSync(full); } catch { continue; }
          if (stat.isDirectory()) {
            // ignora node_modules e .git
            if (/node_modules|\.git/.test(full)) continue;
            walk(full, acc);
          } else if (exts.includes(path.extname(entry))) {
            acc.push(full);
          }
        }
      } catch { /* noop */ }
    };

    const files = [];
    for (const root of tryDirs) walk(root, files);

    const backendRouteSet = new Set();
    const backendRegexes = [
      /\bapp\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\brouter\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    const feCalls = [];
    const feRegexes = [
      /fetch\(\s*['"`]([^'"`]+)['"`]/g,
      /axios\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g,
      /\$\.ajax\(\s*\{[\s\S]*?url\s*:\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const file of files) {
      let content = "";
      try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
      // Backend routes
      if (/src|server\.js|routes/.test(file)) {
        for (const rx of backendRegexes) {
          let m;
          while ((m = rx.exec(content)) !== null) {
            const route = m[2];
            if (route && route.startsWith("/")) backendRouteSet.add(route);
          }
        }
      }
      // Frontend API calls
      if (/public|views|frontend|\.html$/i.test(file)) {
        for (const rx of feRegexes) {
          let m;
          while ((m = rx.exec(content)) !== null) {
            const url = m[1];
            if (url) {
              const rel = path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");
              feCalls.push({ file: rel, url });
            }
          }
        }
      }
    }

    const normalize = (p) => {
      if (!p) return null;
      try { const u = new URL(p); p = u.pathname; } catch { /* not absolute URL */ }
      // garante prefixo /api se jÃ¡ contiver /api em qualquer posiÃ§Ã£o
      const apiIdx = p.indexOf("/api");
      if (apiIdx >= 0) p = p.slice(apiIdx);
      // remove querystring e hash
      p = p.split("?")[0].split("#")[0];
      // normaliza nÃºmeros e templates
      p = p.replace(/\/[0-9]+/g, "/:num");
      p = p.replace(/\/(\$\{[^}]+\})/g, "/:var");
      p = p.replace(/\/:([a-zA-Z0-9_]+)/g, "/:param");
      // remove barra final
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p;
    };

    const backendRoutes = Array.from(backendRouteSet).map(normalize).filter(Boolean);
    const backendSet = new Set(backendRoutes);
    const frontendCallsNormalized = feCalls
      .map(o => ({ file: o.file, path: normalize(o.url) }))
      .filter(o => o.path && o.path.startsWith("/api"));
    const frontendCalls = frontendCallsNormalized.map(o => o.path);

    // Detecta mismatches especÃ­ficos: subjects vs subjects_with_topics
    const mismatches = [];
    for (const o of frontendCallsNormalized) {
      const call = o.path;
      if (!backendSet.has(call)) {
        const candidate = call.replace(/\/(subjects)(?!_with_topics)\b/, "/subjects_with_topics");
        if (candidate !== call && backendSet.has(candidate)) {
          mismatches.push({ file: o.file, from: call, to: candidate });
        }
      }
    }

    discovery.backend.routes = backendRoutes;
    discovery.frontend.calls = frontendCalls;
    discovery.frontend.raw = feCalls;
    discovery.mismatches = mismatches;
    this.context.discovery = discovery;

    // Persiste relatÃ³rio de descoberta para inspeÃ§Ã£o
    try {
      const logDir = path.join(PROJECT_ROOT || process.cwd(), "orchestrator-logs");
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(path.join(logDir, "discovery.json"), JSON.stringify(discovery, null, 2));
    } catch {}

    if (mismatches.length > 0) {
      this.log(`Descoberta: ${mismatches.length} possÃ­vel(is) chamada(s) incorreta(s) no frontend`, "warning");
    } else {
      this.log("Descoberta: nenhuma inconsistÃªncia FE/BE evidente", "info");
    }

    // Retorna problemas em formato legÃ­vel para o loop de correÃ§Ã£o
    return mismatches.map(m => `âš ï¸ Descoberta: FE chama ${m.from} mas BE expÃµe ${m.to}`);
  }

  // Testa a plataforma
  async testPlatform() {
    this.log("Testando plataforma completa...", "action");
    
    // Usa o agente QA para testes
    const qa = this.agents.get("qa");
    const tests = ["health", "login", "plans"];
    const problems = [];
    
    for (const test of tests) {
      const passed = await qa.testFunctionality(test);
      if (!passed) {
        problems.push(`âŒ Teste falhou: ${test}`);
      }
    }
    
    // Teste de produÃ§Ã£o bÃ¡sico
    const prodTest = await this.runCommand("node", ["test-production.mjs"], {
      cwd: __dirname,
      timeout: 60000,
      env: { ED_PROD_URL: CONFIG.production.url }
    });
    
    if (prodTest.output.includes("âŒ")) {
      const lines = prodTest.output.split("\n");
      lines.forEach(line => {
        if (line.includes("âŒ")) {
          problems.push(line.trim());
        }
      });
    }
    
    this.problems = problems;
    return problems;
  }

  // Corrige problemas usando agentes
  async fixProblems() {
    this.log(`Corrigindo ${this.problems.length} problemas com agentes especializados...`, "action");
    
    // Para cada problema, consulta agentes relevantes
    for (const problem of this.problems) {
      this.log(`\nProblema: ${problem}`, "warning");
      
      // Consulta apenas agentes que expÃµem anÃ¡lise
      const agentPromises = Array.from(this.agents.values())
        .filter(agent => typeof agent.analyzeProblem === "function")
        .map(async agent => {
          const solution = await agent.analyzeProblem(problem);
          if (solution) {
            solution.agent = agent.name;
          }
          return solution;
        });
      
      const solutions = (await Promise.all(agentPromises)).filter(s => s !== null);
      
      // Aplica soluÃ§Ãµes
      for (const solution of solutions) {
        this.log(`${solution.agent}: ${solution.solution}`, "info");
        
        // Aplica correÃ§Ãµes locais
        if (solution.files) {
          await this.applyLocalFixes(solution);
        }
        
        // Executa comandos
        if (solution.commands) {
          await this.executeCommands(solution.commands);
        }
      }
    }
    
    // Deploy se houve mudanças
    if (await this.hasLocalChanges()) {
      if (typeof this.deployChangesSafe === 'function') {
        await this.deployChangesSafe();
      } else {
        await this.deployChanges();
      }
    }
  }

  // Aplica correÃ§Ãµes locais
  async applyLocalFixes(solution) {
    for (const file of solution.files) {
      const filePath = path.join(PROJECT_ROOT, file);
      
      if (fs.existsSync(filePath) && solution.fixes) {
        let content = fs.readFileSync(filePath, "utf8");
        
        for (const fix of solution.fixes) {
          const regex = new RegExp(fix.find, "g");
          content = content.replace(regex, fix.replace);
        }
        
        fs.writeFileSync(filePath, content);
        this.log(`Corrigido: ${file}`, "success");
      }
    }
  }

  // Executa comandos
  async executeCommands(commands) {
    for (const cmd of commands) {
      if (
        cmd.includes("pm2") ||
        cmd.includes("nginx") ||
        cmd.includes("psql") ||
        cmd.includes("cd /root/editaliza") ||
        (cmd.includes("git pull") && cmd.includes("/root/editaliza")) ||
        (cmd.includes("npm install") && cmd.includes("/root/editaliza"))
      ) {
        if (this.context.sshAvailable === false) {
          this.log(`SSH indisponÃ­vel; ignorando comando remoto: ${cmd}`, "warning");
        } else {
          await this.runSSH(cmd);
        }
      } else {
        await this.runCommand(cmd, [], { cwd: PROJECT_ROOT, stream: true });
      }
    }
  }

  // Verifica mudanÃ§as locais
  async hasLocalChanges() {
    const gitStatus = await this.runCommand("git", ["status", "--porcelain"], {
      cwd: PROJECT_ROOT
    });
    return gitStatus.output.trim().length > 0;
  }

  // Deploy das mudanÃ§as
  // Deploy das mudanças
  async deployChanges() {
    // Checa mudanças locais
    const changed = await this.hasLocalChanges();
    if (!changed) {
      this.log("Sem mudanças locais; pulando deploy", "info");
      return;
    }

    this.log("Fazendo deploy com DevOps Agent...", "action");

    let allOk = true;
    for (const cmd of CONFIG.deploy_commands) {
      const isRemote = cmd.trim().startsWith("ssh ") || cmd.includes("/root/editaliza");
      if (isRemote) {
        if (this.context.sshAvailable === false) {
          this.log(`SSH indisponível; pulando comando remoto: ${cmd}`, "warning");
          allOk = false;
          continue;
        }
        const r = await this.runSSH(cmd.replace(/^ssh\s+editaliza\s+/, ""));
        if (!r.success) allOk = false;
      } else {
        const r = await this.runCommand(cmd, [], {
          cwd: PROJECT_ROOT,
          shell: true,
          stream: true
        });
        if (!r.success) allOk = false;
      }
    }

    if (allOk) {
      this.log("Deploy concluído!", "success");
    } else {
      this.log("Deploy incompleto (alguns passos falharam ou foram pulados)", "warning");
    }
  }
  // Loop principal
  async run() {
    console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
    console.log("â•‘      ðŸ¤– ORCHESTRATOR COMPLETE - EDITALIZA                 â•‘");
    console.log("â•‘      Sistema Multi-Agente AutÃ´nomo                        â•‘");
    console.log("â•‘      Agentes: Frontend, Backend, Database, DevOps, QA     â•‘");
    console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
    
    for (let attempt = 1; attempt <= CONFIG.orchestration.max_turns; attempt++) {
      this.log(`\n======== CICLO ${attempt}/${CONFIG.orchestration.max_turns} ========\n`, "info");
      
      // 1. Analisa
      await this.analyzeProject();
      
      // 2. Descoberta
      const discoveryIssues = await this.discoverPlatform();
      
      // 3. Testa
      const testIssues = await this.testPlatform();
      const problems = [...(discoveryIssues || []), ...(testIssues || [])];
      this.problems = problems;
      
      if (problems.length === 0) {
        console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
        console.log("â•‘          âœ… PLATAFORMA 100% FUNCIONAL!                    â•‘");
        console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
        return true;
      }
      
      this.log(`${problems.length} problemas detectados`, "warning");
      
      // 4. Corrige
      await this.fixProblems();
      
      // 5. Aguarda
      this.log("Aguardando 10 segundos...", "info");
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log("\nâ•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—");
    console.log("â•‘          âš ï¸  INTERVENÃ‡ÃƒO MANUAL NECESSÃRIA                â•‘");
    console.log("â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
    
    return false;
  }
}

// ========== EXECUÃ‡ÃƒO ==========
async function main() {
  const orchestrator = new CompleteOrchestrator();
  
  try {
    await orchestrator.run();
  } catch (error) {
    console.error("âŒ Erro fatal:", error.message);
    process.exit(1);
  }
}

// Tratamento de erros
process.on("unhandledRejection", error => {
  console.error("âŒ Erro nÃ£o tratado:", error.message);
  process.exit(1);
});

// Inicia
main();



