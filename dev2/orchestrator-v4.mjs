// orchestrator-v4.mjs — Sistema Multi-Agente com Execução Paralela
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

// Carrega configuração
const CFG = JSON.parse(fs.readFileSync(path.join(process.cwd(), "agents-v4.json"), "utf8"));
const PROJECT_DIR = CFG.project_dir || process.cwd();
const SERVER_HOST = CFG.server_host || "editaliza";
const PM2_APP = CFG.pm2_app || "editaliza-app";

// Diretórios de logs
const LOG_DIR = path.join(process.cwd(), "logs");
const PROMPTS_DIR = path.join(LOG_DIR, "prompts");
fs.mkdirSync(PROMPTS_DIR, { recursive: true });

const VERBOSE = process.env.ORCH_VERBOSE === "1";

// Funções auxiliares
function log(f, t) {
  fs.appendFileSync(path.join(LOG_DIR, f), `[${new Date().toISOString()}]\n${t}\n\n`);
}

function savePrompt(kind, turn, name, content) {
  const fn = `${String(turn).padStart(2, '0')}-${kind}-${name}.txt`.replace(/[^\w\.\-]+/g, '_');
  fs.writeFileSync(path.join(PROMPTS_DIR, fn), content, 'utf8');
}

function writeTempPrompt(s) {
  const f = path.join(LOG_DIR, `p_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(f, s, 'utf8');
  return f;
}

// Executa comando com timeout
function runCommand(fullCmd, cwd, timeoutMs, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(fullCmd, {
      cwd,
      shell: true,
      env: { ...process.env, CI: '1', NO_COLOR: '1', ...env }
    });
    
    let out = '', err = '';
    const to = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error('timeout'));
    }, timeoutMs);
    
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    
    child.on('close', c => {
      clearTimeout(to);
      if (c !== 0 && err) return reject(new Error(err || `exit ${c}`));
      resolve(out.trim());
    });
  });
}

// Executa agente com retry
async function runAgent(agent, prompt, label) {
  const pf = writeTempPrompt(prompt);
  let lastErr = null;
  const retries = agent.retry_count || 1;
  
  for (let retry = 0; retry < retries; retry++) {
    if (retry > 0) {
      console.log(`  Retry ${retry}/${retries} para ${label}`);
      await new Promise(r => setTimeout(r, 2000)); // Aguarda 2s entre tentativas
    }
    
    for (const p of agent.patterns) {
      const cmd = p
        .replace('{cmd}', agent.command)
        .replace('{prompt}', prompt.replace(/"/g, '\\"'))
        .replace('{prompt_file}', pf);
      
      try {
        VERBOSE && console.log(`> ${label}: ${cmd}`);
        const out = await runCommand(cmd, PROJECT_DIR, agent.timeout_ms || 300000, agent.env || {});
        if (out && out.trim()) return out;
      } catch (e) {
        lastErr = e;
        if (VERBOSE) console.error(`  Erro em ${label}: ${e.message}`);
      }
    }
  }
  
  throw lastErr || new Error('Nenhum padrão funcionou.');
}

// Parse melhorado para múltiplos agentes
function parseBlocks(t) {
  const get = (h) => {
    const m = t.match(new RegExp(h + ':\\s*([\\s\\S]*?)(?:\\n[A-Z_]+:|$)', 'i'));
    return m ? m[1].trim() : '';
  };
  
  const msgs = [];
  const messagesBlock = get('MESSAGES');
  
  // Parse mais flexível para múltiplos agentes
  const lines = messagesBlock.split('\n');
  for (const line of lines) {
    // Suporta formato: - to: agente content: "tarefa"
    const match = line.match(/to:\s*(\w+).*?content:\s*"([^"]+)"/i);
    if (match) {
      msgs.push({ to: match[1], content: match[2] });
    }
  }
  
  const done = get('DONE_WHEN').split('\n')
    .map(s => s.replace(/^-+\s*/, '').trim())
    .filter(Boolean);
  
  return {
    plan: get('PLAN'),
    critiques: get('CRITIQUES'),
    decision: get('DECISION'),
    messages: msgs,
    done
  };
}

// Executa verificações
function runCheck(cmd) {
  const isWin = os.platform() === 'win32';
  const sh = isWin ? 'cmd.exe' : 'bash';
  const args = isWin
    ? ['/d', '/s', '/c', cmd.replaceAll('${SERVER_HOST}', SERVER_HOST).replaceAll('${PM2_APP}', PM2_APP)]
    : ['-lc', cmd.replaceAll('${SERVER_HOST}', SERVER_HOST).replaceAll('${PM2_APP}', PM2_APP)];
  
  return new Promise((res, rej) => {
    const ch = spawn(sh, args, {
      cwd: PROJECT_DIR,
      shell: false,
      env: { ...process.env, PROJECT_DIR: PROJECT_DIR }
    });
    let err = '';
    ch.stderr.on('data', d => err += d.toString());
    ch.on('close', c => c === 0 ? res() : rej(new Error(err || `exit ${c}`)));
  });
}

// Execução paralela de agentes
async function runAgentsParallel(messages, turn) {
  console.log(`\n📨 Distribuindo ${messages.length} tarefas para agentes...`);
  
  const promises = messages.map(async (msg, i) => {
    // Mapeia agente
    let agent, label;
    
    // Primeiro tenta agentes específicos
    if (CFG.agents && CFG.agents[msg.to]) {
      agent = CFG.agents[msg.to];
      label = agent.name || msg.to;
    } 
    // Fallback para executores legados
    else if (msg.to === 'executor_a' || msg.to === 'be' || msg.to === 'devops' || msg.to === 'dba') {
      agent = CFG.legacy_executors?.executor_a || CFG.agents.be;
      label = 'Backend/DevOps Agent';
    } 
    else if (msg.to === 'executor_b' || msg.to === 'fe' || msg.to === 'qa') {
      agent = CFG.legacy_executors?.executor_b || CFG.agents.fe;
      label = 'Frontend/QA Agent';
    }
    else {
      console.warn(`⚠️ Agente desconhecido: ${msg.to}`);
      return null;
    }
    
    const execPrompt = `${label} — Trabalhe em ${PROJECT_DIR}.\n\nESPECIALIZAÇÃO: ${agent.specialization || 'Geral'}\n\nTAREFA:\n${msg.content}\n\nOBS: mudanças mínimas; reporte arquivo+conteúdo completo quando editar.`;
    savePrompt('agent', turn, `${msg.to}_msg${i + 1}`, execPrompt);
    
    console.log(`  🚀 Iniciando ${label} (${msg.to})...`);
    
    try {
      const out = await runAgent(agent, execPrompt, `${msg.to}(T${turn}#${i + 1})`);
      log(`${msg.to}.out.log`, out);
      console.log(`  ✅ ${label} concluído`);
      return { agent: msg.to, success: true, output: out };
    } catch (e) {
      log(`${msg.to}.out.log`, `AGENT ERROR: ${e.message}`);
      console.log(`  ❌ ${label} falhou: ${e.message}`);
      return { agent: msg.to, success: false, error: e.message };
    }
  });
  
  // Executa todos em paralelo
  const results = await Promise.all(promises);
  
  // Resumo
  const successful = results.filter(r => r && r.success).length;
  const failed = results.filter(r => r && !r.success).length;
  
  console.log(`\n📊 Resultado: ${successful} sucesso, ${failed} falhas`);
  
  return results;
}

// Prompt melhorado para o arquiteto
function createArchitectPrompt() {
  return `Você é o ARQUITETO ORQUESTRADOR do projeto Editaliza.
  
AGENTES DISPONÍVEIS:
- fe: Frontend (React, TypeScript, CSS, UX) - Gemini 2.5 Pro
- be: Backend (Node.js, Express, APIs) - Claude Sonnet
- devops: Deploy (PM2, Nginx, SSH, CI/CD) - Claude Sonnet
- dba: Database (PostgreSQL, Migrations, Indexes) - Claude Sonnet
- qa: Testing (E2E, API Contracts, Automation) - Gemini 2.5 Pro

PRINCÍPIOS:
- Delegue tarefas para múltiplos agentes simultaneamente
- Use especialização de cada agente
- Minimize mudanças (menor delta possível)
- Verifique gates a cada rodada

FORMATO OBRIGATÓRIO:
PLAN:
  - análise da situação atual
  - tarefas necessárias por agente
  
CRITIQUES:
  - riscos identificados
  - pontos de atenção
  
DECISION:
  - decisões tomadas
  - justificativas
  
MESSAGES:
  - to: fe
    content: "tarefa específica para frontend"
  - to: be
    content: "tarefa específica para backend"
  - to: devops
    content: "tarefa de deploy se necessário"
  - to: dba
    content: "tarefa de banco se necessário"
  - to: qa
    content: "testes a executar"
  
DONE_WHEN:
  - "node tests/check-files.mjs"
  - "node tests/scan-frontend.mjs"
  - "node tests/check-http.mjs http://localhost:3000/healthz"

SIGNALS:
  - sync: "<SYNC_GO>"`;
}

// Main
(async () => {
  console.log('🚀 Orquestrador Multi-Agente v4.0');
  console.log('PROJECT_DIR =', PROJECT_DIR);
  console.log('SERVER_HOST =', SERVER_HOST);
  console.log('PM2_APP =', PM2_APP);
  console.log('');
  
  const archRules = createArchitectPrompt();
  
  for (let turn = 1; turn <= (CFG.orchestration?.max_turns || 16); turn++) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔄 TURNO ${turn}/${CFG.orchestration?.max_turns || 16}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const goal = process.argv.slice(2).join(' ') || 'Sincronizar FE/BE com mudança mínima e gates verdes';
    const prompt = `${archRules}\n\nOBJETIVO:\n${goal}`;
    
    savePrompt('architect', turn, 'architect', prompt);
    
    let archOut = '';
    let used = 'primary';
    
    console.log('\n🧠 Consultando Arquiteto...');
    
    try {
      archOut = await runAgent(CFG.architect, prompt, `architect(T${turn})[primary]`);
    } catch (e) {
      log('architect.log', `PRIMARY ARCHITECT FAILED: ${e.message}`);
      console.log('  ⚠️ Arquiteto primário falhou, tentando fallback...');
      
      if (CFG.architect_fallback) {
        try {
          archOut = await runAgent(CFG.architect_fallback, prompt, `architect(T${turn})[fallback]`);
          used = 'fallback';
        } catch (e2) {
          log('architect.log', `FALLBACK ARCHITECT FAILED: ${e2.message}`);
          console.error('❌ Ambos arquitetos falharam!');
          throw e2;
        }
      } else {
        throw e;
      }
    }
    
    console.log(`  ✅ Arquiteto ${used} respondeu`);
    log('architect.log', `[ARCHITECT ${used}]\n${archOut}`);
    
    // Parse resposta
    const parsed = parseBlocks(archOut);
    
    if (parsed.messages.length === 0) {
      console.log('  ⚠️ Arquiteto não delegou tarefas');
      continue;
    }
    
    // Executa agentes em paralelo
    const results = await runAgentsParallel(parsed.messages, turn);
    
    // Executa verificações
    console.log('\n🔍 Executando verificações...');
    const checks = parsed.done.length ? parsed.done : [
      'node tests/check-files.mjs',
      'node tests/scan-frontend.mjs',
      'node tests/check-http.mjs http://localhost:3000/healthz',
      'node tests/check-http.mjs http://localhost:3000/login --method HEAD --expect 200,302'
    ];
    
    let ok = true;
    for (const c of checks) {
      try {
        await runCheck(c);
        log('checks.log', 'OK: ' + c);
        console.log(`  ✅ ${c}`);
      } catch (e) {
        log('checks.log', 'FAIL: ' + c + '\n' + e.message);
        console.log(`  ❌ ${c}`);
        ok = false;
        break;
      }
    }
    
    if (ok) {
      console.log('\n✅ SUCESSO! Todos os critérios foram aprovados.');
      return;
    }
    
    console.log('\n⏳ Ainda não passou. Preparando próximo turno...');
  }
  
  console.log('\n⚠️ Máximo de turnos atingido. Verifique logs/');
})().catch(e => {
  console.error('💥 Erro fatal:', e);
  process.exit(1);
});