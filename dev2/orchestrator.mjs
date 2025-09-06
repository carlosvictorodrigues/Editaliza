// orchestrator.mjs — v3.7.1 (architect fallback)
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawn } from "node:child_process"; import crypto from "node:crypto";
const CFG = JSON.parse(fs.readFileSync(path.join(process.cwd(),"agents.json"),"utf8"));
const PROJECT_DIR = CFG.project_dir || process.cwd(); const SERVER_HOST = CFG.server_host || "editaliza"; const PM2_APP = CFG.pm2_app || "editaliza-app";
const LOG_DIR = path.join(process.cwd(),"logs"); const PROMPTS_DIR = path.join(LOG_DIR,"prompts"); fs.mkdirSync(PROMPTS_DIR,{recursive:true});
const VERBOSE = process.env.ORCH_VERBOSE === "1";
function log(f,t){ fs.appendFileSync(path.join(LOG_DIR,f),`[${new Date().toISOString()}]\n${t}\n\n`); }
function savePrompt(kind, turn, name, content){ const fn = `${String(turn).padStart(2,'0')}-${kind}-${name}.txt`.replace(/[^\w\.\-]+/g,'_'); fs.writeFileSync(path.join(PROMPTS_DIR,fn),content,'utf8'); }
function writeTempPrompt(s){ const f = path.join(LOG_DIR,`p_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`); fs.writeFileSync(f,s,'utf8'); return f; }
function runCommand(fullCmd, cwd, timeoutMs, env={}){
  return new Promise((resolve,reject)=>{ const child=spawn(fullCmd,{cwd,shell:true,env:{...process.env,CI:'1',NO_COLOR:'1',...env}});
    let out='',err=''; const to=setTimeout(()=>{ try{child.kill('SIGKILL');}catch{}; reject(new Error('timeout')); }, timeoutMs);
    child.stdout.on('data',d=>out+=d.toString()); child.stderr.on('data',d=>err+=d.toString());
    child.on('close',c=>{ clearTimeout(to); if(c!==0 && err) return reject(new Error(err||`exit ${c}`)); resolve(out.trim()); });
  });
}
async function runAgent(agent, prompt, label){ const pf=writeTempPrompt(prompt); let lastErr=null;
  for(const p of agent.patterns){ const cmd=p.replace('{cmd}',agent.command).replace('{prompt}',prompt.replace(/"/g,'\\"')).replace('{prompt_file}',pf);
    try{ VERBOSE && console.log(`> ${label}: ${cmd}`); const out=await runCommand(cmd, PROJECT_DIR, agent.timeout_ms||420000, {}); if(out && out.trim()) return out; }
    catch(e){ lastErr=e; }
  }
  throw lastErr || new Error('Nenhum padrão funcionou.');
}
function parseBlocks(t){ const get=(h)=>{ const m=t.match(new RegExp(h+':\\s*([\\s\\S]*?)(?:\\n[A-Z_]+:|$)','i')); return m?m[1].trim():''; };
  const msgs=[]; const m=get('MESSAGES'); m.split('\\n').forEach(line=>{ const r=line.match(/to:\\s*(executor_[ab]).*?content:\\s*\"(.*)\"/i); if(r) msgs.push({to:r[1],content:r[2].replace(/\\"/g,'"')}); });
  const done=get('DONE_WHEN').split('\\n').map(s=>s.replace(/^-+\\s*/,'').trim()).filter(Boolean);
  return { plan:get('PLAN'), critiques:get('CRITIQUES'), decision:get('DECISION'), messages:msgs, done };
}
function runCheck(cmd){ const isWin=os.platform()==='win32'; const sh=isWin?'cmd.exe':'bash'; const args=isWin?['/d','/s','/c',cmd.replaceAll('${SERVER_HOST}',SERVER_HOST).replaceAll('${PM2_APP}',PM2_APP)]:['-lc',cmd.replaceAll('${SERVER_HOST}',SERVER_HOST).replaceAll('${PM2_APP}',PM2_APP)];
  return new Promise((res,rej)=>{ const ch=spawn(sh,args,{cwd:PROJECT_DIR,shell:false,env:{...process.env,PROJECT_DIR:PROJECT_DIR}}); let err=''; ch.stderr.on('data',d=>err+=d.toString()); ch.on('close',c=>c===0?res():rej(new Error(err||`exit ${c}`))); });
}
(async ()=>{
  console.log('PROJECT_DIR =', PROJECT_DIR); console.log('SERVER_HOST  =', SERVER_HOST); console.log('PM2_APP      =', PM2_APP);
  const archRules = fs.readFileSync(path.join(process.cwd(),'prompts','architect_system.txt'),'utf8').replaceAll('${SERVER_HOST}',SERVER_HOST).replaceAll('${PM2_APP}',PM2_APP);
  for(let turn=1; turn<= (CFG.orchestration?.max_turns || 16); turn++){
    const goal = process.argv.slice(2).join(' ') || 'Sincronizar FE/BE com mudança mínima e gates verdes';
    const prompt = `SYSTEM RULES:\\n${archRules}\\n\\nOBJECTIVE:\\n${goal}`;
    savePrompt('architect',turn,'architect',prompt);
    let archOut = ''; let used = 'primary';
    try{ archOut = await runAgent(CFG.architect, prompt, `architect(T${turn})[primary]`); }
    catch(e){
      log('architect.log', `PRIMARY ARCHITECT FAILED: ${e.message}`);
      if(CFG.architect_fallback){
        try{ archOut = await runAgent(CFG.architect_fallback, prompt, `architect(T${turn})[fallback]`); used='fallback'; }
        catch(e2){ log('architect.log', `FALLBACK ARCHITECT FAILED: ${e2.message}`); throw e2; }
      } else { throw e; }
    }
    log('architect.log', `[ARCHITECT ${used}]\\n${archOut}`);
    const parsed = parseBlocks(archOut);
    let i=0; for(const m of parsed.messages){ i++; const ag=m.to==='executor_a'?CFG.executor_a:CFG.executor_b; const lab=m.to==='executor_a'?'Executor A (Claude Sonnet)':'Executor B (Gemini 2.5 Pro)';
      const execPrompt = `${lab} — Trabalhe em ${PROJECT_DIR}.\\n\\nTAREFA:\\n${m.content}\\n\\nOBS: mudanças mínimas; reporte arquivo+conteúdo completo quando editar.`;
      savePrompt('executor',turn,`${m.to}_msg${i}`,execPrompt);
      try{ const out = await runAgent(ag, execPrompt, `${m.to}(T${turn}#${i})`); log(`${m.to}.out.log`, out); } catch(e){ log(`${m.to}.out.log`, `EXECUTOR ERROR: ${e.message}`); }
    }
    const checks = parsed.done.length ? parsed.done : [
      'node tests/check-files.mjs',
      'node tests/scan-frontend.mjs',
      'node tests/check-http.mjs http://localhost:3000/healthz',
      'node tests/check-http.mjs http://localhost:3000/login --method HEAD --expect 200,302',
      'ssh ${SERVER_HOST} "curl -fsS http://localhost:3000/healthz >/dev/null"',
      'ssh ${SERVER_HOST} "pm2 status ${PM2_APP} | grep online"'
    ];
    let ok=true; for(const c of checks){ try{ await runCheck(c); log('checks.log','OK: '+c); } catch(e){ log('checks.log','FAIL: '+c+'\\n'+e.message); ok=false; break; } }
    if(ok){ console.log('✅ Critérios de aceite aprovados.'); return; }
    console.log('⏳ Ainda não passou. Próximo turno…');
  }
  console.log('⚠️ Máximo de turnos atingido. Veja logs/.');
})().catch(e=>{ console.error(e); process.exit(1); });
