// orchestrator.mjs — v3
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const CFG = JSON.parse(fs.readFileSync(path.join(process.cwd(), "agents.json"), "utf8"));
const STATE_FILE = path.join(process.cwd(), "state.json");
const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const ARCH_SYSTEM = fs.readFileSync(path.join(process.cwd(), "prompts", "architect_system.txt"), "utf8");
const EXEC_A_INTRO = fs.readFileSync(path.join(process.cwd(), "prompts", "executor_a_intro.txt"), "utf8");
const EXEC_B_INTRO = fs.readFileSync(path.join(process.cwd(), "prompts", "executor_b_intro.txt"), "utf8");

function b64(s){ return Buffer.from(s, "utf8").toString("base64"); }
function log(file, text){ fs.appendFileSync(path.join(LOG_DIR, file), `[${new Date().toISOString()}]\n${text}\n\n`); }

function runCLI(agent, prompt){
  return new Promise((resolve,reject)=>{
    const args = agent.args.map(a => a.replace("{{b64prompt}}", b64(prompt)));
    const child = spawn(agent.command, args, { cwd: agent.cwd || process.cwd(), shell: true });
    let out="", err=""; const to= setTimeout(()=>{ try{child.kill("SIGKILL");}catch{}; reject(new Error("timeout")); }, agent.timeout_ms||240000);
    child.stdout.on("data", d=> out += d.toString());
    child.stderr.on("data", d=> err += d.toString());
    child.on("close", code => { clearTimeout(to); if(code!==0 && err) return reject(new Error(err||`exit ${code}`)); resolve(out.trim()); });
  });
}

function loadState(){ return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE,"utf8")) : { turn:0, history:[] }; }
function saveState(s){ fs.writeFileSync(STATE_FILE, JSON.stringify(s,null,2)); }

function parseArch(text){
  try{
    const o=JSON.parse(text);
    return { messages:o.MESSAGES||o.messages||[], doneWhen:o.DONE_WHEN||o.done_when||[], sync:o.SIGNALS?.sync, plan:o.PLAN||o.plan||"", raw:text };
  }catch{}
  const messages=[];
  const mBlock=(text.match(/MESSAGES:\s*([\s\S]*?)(?:\n[A-Z_]+:|\s*$)/i)||[])[1]||"";
  mBlock.split("\n").forEach(line=>{
    const m=line.match(/to:\s*(executor_[ab]).*?content:\s*"(.*)"/i);
    if(m) messages.push({to:m[1], content:m[2].replace(/\\"/g,'"')});
  });
  const doneBlock=(text.match(/DONE_WHEN:\s*([\s\S]*?)(?:\n[A-Z_]+:|\s*$)/i)||[])[1]||"";
  const doneWhen=doneBlock.split("\n").map(s=>s.replace(/^-+\s*/,"").trim()).filter(Boolean);
  const sync=(text.match(/SIGNALS:[\s\S]*?sync:\s*"(.*?)"/i)||[])[1];
  const plan=(text.match(/PLAN:\s*([\s\S]*?)(?:\nMESSAGES|\nDONE_WHEN|\nSIGNALS|$)/i)||[])[1]||"";
  return { messages, doneWhen, sync, plan:plan.trim(), raw:text };
}

async function runChecks(cmds){
  if(!cmds || !cmds.length) return false;
  for(const cmd of cmds){
    try{
      const ag = os.platform()==="win32"
        ? { command:"powershell.exe", args:["-NoProfile","-Command", cmd], cwd:process.cwd(), timeout_ms:120000 }
        : { command:"bash", args:["-lc", cmd], cwd:process.cwd(), timeout_ms:120000 };
      const out = await new Promise((resolve,reject)=>{
        const child = spawn(ag.command, ag.args, { cwd: ag.cwd, shell: true });
        let o="", e=""; const to=setTimeout(()=>{ try{child.kill("SIGKILL");}catch{}; reject(new Error("check timeout")); }, ag.timeout_ms);
        child.stdout.on("data", d=> o+=d.toString()); child.stderr.on("data", d=> e+=d.toString());
        child.on("close", code=> { clearTimeout(to); code===0 ? resolve(o||"ok") : reject(new Error(e||`exit ${code}`)); });
      });
      log("checks.log", `OK: ${cmd}\n${out}`);
    }catch(e){
      log("checks.log", `FAIL: ${cmd}\n${e.message}`); return false;
    }
  }
  return true;
}

async function main(){
  const goal = process.argv.slice(2).join(" ") || "Sincronizar FE/BE e passar nos testes.";
  let state = loadState();

  while(state.turn < (CFG.orchestration?.max_turns || 10)){
    state.turn++;

    const archPrompt = `SYSTEM RULES:\n${ARCH_SYSTEM}\n\nOBJECTIVE:\n${goal}\n`;
    const archOut = await runCLI(CFG.architect, archPrompt);
    log("architect.log", archOut);
    const parsed = parseArch(archOut);
    state.history.push({ turn: state.turn, architect_plan: parsed.plan });

    for(const m of parsed.messages){
      const agent = m.to==="executor_a" ? CFG.executor_a : CFG.executor_b;
      const intro = m.to==="executor_a" ? fs.readFileSync(path.join("prompts","executor_a_intro.txt"),"utf8")
                                        : fs.readFileSync(path.join("prompts","executor_b_intro.txt"),"utf8");
      const prompt = `${intro}\n\nTAREFA:\n${m.content}\n\nRequisitos: gere LOG claro e estado final.`;
      const out = await runCLI(agent, prompt);
      log(`${m.to}.out.log`, out);
      if ((CFG.orchestration?.stop_tokens || []).some(t => out.includes(t))) {
        saveState(state); console.log("Token de parada detectado."); return;
      }
    }
    saveState(state);

    if (parsed.sync === (CFG.orchestration?.sync_token || "<SYNC_GO>")) {
      await new Promise(r => setTimeout(r, 1500));
    }

    const ok = await runChecks(parsed.doneWhen.length ? parsed.doneWhen : [
      'node tests/check-files.mjs',
      'node tests/scan-frontend.mjs',
      'node tests/check-http.mjs http://localhost:3000/healthz',
      'node tests/check-http.mjs http://localhost:3000/login --method HEAD --expect 200,302'
    ]);
    if (ok) { console.log("✅ Critérios de aceite aprovados. Projeto pronto."); saveState(state); return; }
    console.log("⏳ Ainda não passou nos testes. Próximo turno…");
  }
  console.log("⚠️ Máximo de turnos atingido. Veja logs/ e state.json.");
  saveState(state);
}
main().catch(e=>{ console.error(e); process.exit(1); });
