// watch.mjs — tail ao vivo dos logs e prompts
import fs from "node:fs"; import path from "node:path";
const LOG_DIR = path.join(process.cwd(), "logs"); const FILES = ["architect.log","executor_a.out.log","executor_b.out.log","checks.log"]; const PROMPTS_DIR = path.join(LOG_DIR, "prompts");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); if (!fs.existsSync(PROMPTS_DIR)) fs.mkdirSync(PROMPTS_DIR, { recursive: true });
function tail(file){ const full = path.join(LOG_DIR, file); let pos = fs.existsSync(full) ? fs.statSync(full).size : 0; console.log(`==> ${file} <==`);
  setInterval(()=>{ if (!fs.existsSync(full)) return; const stat = fs.statSync(full); if (stat.size > pos){ const fd = fs.openSync(full, "r"); const buf = Buffer.alloc(stat.size - pos);
    fs.readSync(fd, buf, 0, stat.size - pos, pos); fs.closeSync(fd); process.stdout.write(buf.toString("utf8")); pos = stat.size; } }, 800); }
function watchPrompts(){ console.log("==> prompts/ <=="); const seen = new Set(); setInterval(()=>{ for(const f of fs.readdirSync(PROMPTS_DIR)){ const full = path.join(PROMPTS_DIR, f); if (!seen.has(full)){ seen.add(full);
  console.log(`\n--- ${f} ---`); try { console.log(fs.readFileSync(full, "utf8")); } catch {} } } }, 1000); }
FILES.forEach(tail); watchPrompts();
