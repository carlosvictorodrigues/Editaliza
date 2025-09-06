// fix-platform.mjs - Orquestrador específico para consertar a plataforma Editaliza
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Carrega configuração
const CFG = JSON.parse(fs.readFileSync(path.join(process.cwd(), "agents-v4.json"), "utf8"));
const PROJECT_DIR = CFG.project_dir || process.cwd();

// Diretórios
const LOG_DIR = path.join(process.cwd(), "logs");
const PROMPTS_DIR = path.join(LOG_DIR, "prompts");
fs.mkdirSync(PROMPTS_DIR, { recursive: true });

const VERBOSE = true; // Sempre verbose para debug

// Missão específica
const MISSION = fs.readFileSync(
  path.join(process.cwd(), "prompts", "architect_platform_fix.txt"),
  "utf8"
);

// Funções auxiliares
function log(f, t) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(path.join(LOG_DIR, f), `[${timestamp}]\n${t}\n\n`);
  console.log(`[${timestamp}] ${f}: ${t.substring(0, 100)}...`);
}

function savePrompt(kind, turn, name, content) {
  const fn = `${String(turn).padStart(2, '0')}-${kind}-${name}.txt`;
  fs.writeFileSync(path.join(PROMPTS_DIR, fn), content, 'utf8');
}

function writeTempPrompt(s) {
  const f = path.join(LOG_DIR, `p_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(f, s, 'utf8');
  return f;
}

// Executa comando com timeout maior para tarefas complexas
function runCommand(fullCmd, cwd, timeoutMs, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`  ⚙️ Executando: ${fullCmd.substring(0, 80)}...`);
    
    const child = spawn(fullCmd, {
      cwd,
      shell: true,
      env: { ...process.env, CI: '1', NO_COLOR: '1', ...env }
    });
    
    let out = '', err = '';
    const to = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(`timeout após ${timeoutMs/1000}s`));
    }, timeoutMs);
    
    child.stdout.on('data', d => {
      const data = d.toString();
      out += data;
      if (VERBOSE && data.trim()) {
        console.log(`    📤 ${data.substring(0, 100).trim()}`);
      }
    });
    
    child.stderr.on('data', d => {
      const data = d.toString();
      err += data;
      if (VERBOSE && data.trim()) {
        console.log(`    ⚠️ ${data.substring(0, 100).trim()}`);
      }
    });
    
    child.on('close', c => {
      clearTimeout(to);
      if (c !== 0 && err) {
        return reject(new Error(err || `exit ${c}`));
      }
      resolve(out.trim());
    });
  });
}

// Executa agente com retry e melhor tratamento de erro
async function runAgent(agent, prompt, label) {
  const pf = writeTempPrompt(prompt);
  let lastErr = null;
  const retries = agent.retry_count || 2;
  
  for (let retry = 0; retry < retries; retry++) {
    if (retry > 0) {
      console.log(`  🔄 Tentativa ${retry + 1}/${retries} para ${label}`);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    for (const p of agent.patterns) {
      const cmd = p
        .replace('{cmd}', agent.command)
        .replace('{prompt}', prompt.replace(/"/g, '\\"'))
        .replace('{prompt_file}', pf);
      
      try {
        console.log(`  🚀 ${label}: Iniciando...`);
        const out = await runCommand(cmd, PROJECT_DIR, agent.timeout_ms || 300000, agent.env || {});
        
        if (out && out.trim()) {
          console.log(`  ✅ ${label}: Sucesso!`);
          return out;
        }
      } catch (e) {
        lastErr = e;
        console.error(`  ❌ ${label}: ${e.message}`);
      }
    }
  }
  
  throw lastErr || new Error('Nenhum padrão funcionou');
}

// Parse melhorado para respostas do arquiteto
function parseArchitectResponse(text) {
  const sections = {};
  const sectionNames = ['PLAN', 'CRITIQUES', 'DECISION', 'MESSAGES', 'DONE_WHEN', 'SIGNALS'];
  
  for (const section of sectionNames) {
    const regex = new RegExp(`${section}:\\s*([\\s\\S]*?)(?:(?:${sectionNames.join('|')}):|\$)`, 'i');
    const match = text.match(regex);
    sections[section] = match ? match[1].trim() : '';
  }
  
  // Parse messages especial
  const messages = [];
  if (sections.MESSAGES) {
    const lines = sections.MESSAGES.split('\n');
    let currentMsg = null;
    
    for (const line of lines) {
      const toMatch = line.match(/to:\s*(\w+)/i);
      if (toMatch) {
        if (currentMsg) messages.push(currentMsg);
        currentMsg = { to: toMatch[1], content: '' };
      } else if (currentMsg) {
        const contentMatch = line.match(/content:\s*"([^"]+)"/i);
        if (contentMatch) {
          currentMsg.content = contentMatch[1];
        } else {
          currentMsg.content += line + ' ';
        }
      }
    }
    if (currentMsg && currentMsg.content) messages.push(currentMsg);
  }
  
  // Parse done conditions
  const done = sections.DONE_WHEN
    ? sections.DONE_WHEN.split('\n')
        .map(s => s.replace(/^[-*]\s*/, '').replace(/^["']|["']$/g, '').trim())
        .filter(Boolean)
    : [];
  
  return {
    plan: sections.PLAN,
    critiques: sections.CRITIQUES,
    decision: sections.DECISION,
    messages,
    done,
    signals: sections.SIGNALS
  };
}

// Executa agentes em paralelo com melhor feedback
async function executeAgentsParallel(messages, turn) {
  if (!messages || messages.length === 0) {
    console.log('⚠️ Nenhuma tarefa para executar');
    return [];
  }
  
  console.log(`\n🎯 Distribuindo ${messages.length} tarefas para agentes especializados:`);
  messages.forEach(m => console.log(`   • ${m.to}: ${m.content.substring(0, 60)}...`));
  
  const promises = messages.map(async (msg, i) => {
    // Mapeia agente correto
    const agentConfig = CFG.agents[msg.to] || CFG.agents.fe; // Default para fe
    const label = agentConfig.name || msg.to.toUpperCase();
    
    const fullPrompt = `
${label} - Especialização: ${agentConfig.specialization}

CONTEXTO: Plataforma Editaliza com frontend desconectado do backend.
DIRETÓRIO: ${PROJECT_DIR}

TAREFA ESPECÍFICA:
${msg.content}

INSTRUÇÕES:
1. Execute a tarefa com precisão
2. Reporte todos os arquivos modificados
3. Inclua conteúdo COMPLETO de arquivos editados
4. Teste suas alterações
5. Reporte qualquer erro encontrado

IMPORTANTE: O backend está OK, foque em sincronizar o frontend.
`;
    
    savePrompt('agent', turn, `${msg.to}_${i}`, fullPrompt);
    
    try {
      const result = await runAgent(agentConfig, fullPrompt, label);
      log(`${msg.to}.log`, result);
      return {
        agent: msg.to,
        success: true,
        output: result
      };
    } catch (e) {
      log(`${msg.to}.log`, `ERRO: ${e.message}`);
      return {
        agent: msg.to,
        success: false,
        error: e.message
      };
    }
  });
  
  const results = await Promise.all(promises);
  
  // Resumo dos resultados
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n📊 Resultados da rodada:`);
  console.log(`   ✅ Sucesso: ${successful}`);
  console.log(`   ❌ Falhas: ${failed}`);
  
  return results;
}

// Testes automatizados
async function runTests() {
  console.log('\n🧪 Executando testes...');
  
  const tests = [
    { name: 'API Health', cmd: 'curl -s http://localhost:3000/api/health' },
    { name: 'Login Page', cmd: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login.html' },
    { name: 'Home Page', cmd: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/home.html' },
    { name: 'API Routes', cmd: 'curl -s http://localhost:3000/api/auth/status' }
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    try {
      await runCommand(test.cmd, PROJECT_DIR, 5000);
      console.log(`   ✅ ${test.name}`);
    } catch (e) {
      console.log(`   ❌ ${test.name}: ${e.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Main
(async () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     🔧 EDITALIZA PLATFORM FIX - ORQUESTRADOR v1.0        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n📁 Diretório: ${PROJECT_DIR}`);
  console.log(`📝 Missão: Sincronizar Frontend com Backend\n`);
  
  // Inicia servidor local se não estiver rodando
  console.log('🚀 Verificando servidor local...');
  try {
    await runCommand('curl -s http://localhost:3000/api/health', PROJECT_DIR, 2000);
    console.log('   ✅ Servidor já está rodando');
  } catch {
    console.log('   ⚠️ Iniciando servidor...');
    spawn('npm', ['run', 'dev'], {
      cwd: PROJECT_DIR,
      detached: true,
      stdio: 'ignore'
    }).unref();
    await new Promise(r => setTimeout(r, 5000)); // Aguarda inicialização
  }
  
  // Loop principal
  for (let turn = 1; turn <= 10; turn++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📍 TURNO ${turn}/10`);
    console.log(`${'═'.repeat(60)}\n`);
    
    // Consulta o arquiteto
    console.log('🧠 Consultando Arquiteto Mestre...');
    
    const architectPrompt = `${MISSION}

TURNO: ${turn}/10

OBJETIVO ESPECÍFICO DESTE TURNO:
${turn === 1 ? 'Mapear todos os problemas e criar plano de ação' : 'Continuar correções baseado no feedback dos agentes'}

IMPORTANTE:
- Backend está funcionando corretamente
- Frontend precisa ser sincronizado
- Interceptador em plan_settings.html linha 786 é temporário
- Teste cada correção antes de prosseguir

Delegue tarefas específicas para os agentes especializados.`;
    
    savePrompt('architect', turn, 'mission', architectPrompt);
    
    let architectResponse;
    try {
      architectResponse = await runAgent(CFG.architect, architectPrompt, 'ARQUITETO');
    } catch (e) {
      console.error('❌ Arquiteto falhou, tentando fallback...');
      try {
        architectResponse = await runAgent(CFG.architect_fallback, architectPrompt, 'ARQUITETO-FALLBACK');
      } catch (e2) {
        console.error('💥 Ambos arquitetos falharam!');
        break;
      }
    }
    
    log('architect.log', architectResponse);
    
    // Parse resposta
    const parsed = parseArchitectResponse(architectResponse);
    
    if (parsed.plan) {
      console.log('\n📋 PLANO DO ARQUITETO:');
      console.log(parsed.plan.substring(0, 200) + '...');
    }
    
    // Executa agentes
    if (parsed.messages && parsed.messages.length > 0) {
      const results = await executeAgentsParallel(parsed.messages, turn);
      
      // Salva resultados
      fs.writeFileSync(
        path.join(LOG_DIR, `turn-${turn}-results.json`),
        JSON.stringify(results, null, 2)
      );
    }
    
    // Executa testes
    const testsPass = await runTests();
    
    if (testsPass && parsed.signals && parsed.signals.includes('ALL_GREEN')) {
      console.log('\n🎉 SUCESSO! Plataforma sincronizada e funcionando!');
      break;
    }
    
    console.log('\n⏳ Preparando próximo turno...');
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n📊 RESUMO FINAL:');
  console.log('   • Logs salvos em: ' + LOG_DIR);
  console.log('   • Execute npm test para validar');
  console.log('   • Deploy: git push && ssh editaliza "cd /root/editaliza && git pull && pm2 restart"');
  
})().catch(e => {
  console.error('💥 ERRO FATAL:', e);
  process.exit(1);
});