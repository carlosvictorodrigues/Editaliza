// dashboard.mjs — painel web com SSE
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const LOG_DIR = path.join(process.cwd(), "logs"); if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url, true);
  if (pathname === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><head><title>Bot Bashing Dashboard</title><style>
body{font-family:ui-monospace,Consolas,monospace;background:#0b0f16;color:#cde;line-height:1.4;margin:0;}
header{padding:12px 16px;background:#121826;position:sticky;top:0;border-bottom:1px solid #233;}
main{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;}
pre{white-space:pre-wrap;background:#0e1420;border:1px solid #233;padding:8px;border-radius:8px;max-height:40vh;overflow:auto;}
h2{margin:0 0 8px 0;font-weight:600;color:#9fe;} small{color:#7a9;} .card{padding:8px;}
</style></head><body>
<header><h1>Bot Bashing Dashboard</h1><small>Atualiza ao vivo. Sim, dá pra assistir os robôs suarem.</small></header>
<main>
  <div class="card"><h2>architect.log</h2><pre id="arch"></pre></div>
  <div class="card"><h2>checks.log</h2><pre id="checks"></pre></div>
  <div class="card"><h2>executor_a.out.log</h2><pre id="a"></pre></div>
  <div class="card"><h2>executor_b.out.log</h2><pre id="b"></pre></div>
  <div class="card" style="grid-column:1 / -1"><h2>prompts/ (últimos)</h2><pre id="prompts"></pre></div>
</main>
<script>
function sse(file, el){ const es = new EventSource('/sse?file='+encodeURIComponent(file));
  es.onmessage = e => { const pre = document.getElementById(el); pre.textContent += e.data + "\\n"; pre.scrollTop = pre.scrollHeight; }; }
sse('architect.log','arch'); sse('checks.log','checks'); sse('executor_a.out.log','a'); sse('executor_b.out.log','b');
const ep = new EventSource('/sse-prompts'); ep.onmessage = e => { const pre = document.getElementById('prompts'); pre.textContent += e.data + "\\n"; pre.scrollTop = pre.scrollHeight; };
</script></body></html>`); return; }
  if (pathname === "/sse") { const q = url.parse(req.url, true).query; const file = (q.file || "").toString(); const full = path.join(LOG_DIR, file);
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    let pos = fs.existsSync(full) ? fs.statSync(full).size : 0; const timer = setInterval(()=>{ if (!fs.existsSync(full)) return; const stat = fs.statSync(full);
      if (stat.size > pos){ const fd = fs.openSync(full, "r"); const buf = Buffer.alloc(stat.size - pos); fs.readSync(fd, buf, 0, stat.size - pos, pos); fs.closeSync(fd);
        res.write("data: " + buf.toString("utf8").replace(/\\n/g,"\\n") + "\\n\\n"); pos = stat.size; } }, 800); req.on("close", ()=> clearInterval(timer)); return; }
  if (pathname === "/sse-prompts") { const PROMPTS_DIR = path.join(LOG_DIR, "prompts"); if (!fs.existsSync(PROMPTS_DIR)) fs.mkdirSync(PROMPTS_DIR, { recursive: true });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); const seen = new Set();
    const timer = setInterval(()=>{ for(const f of fs.readdirSync(PROMPTS_DIR)){ const full = path.join(PROMPTS_DIR, f); if (!seen.has(full)){ seen.add(full);
      const content = fs.readFileSync(full, "utf8").replace(/\\n/g,"\\n"); res.write("data: --- " + f + " ---\\n" + content + "\\n\\n"); } } }, 1000); req.on("close", ()=> clearInterval(timer)); return; }
  res.writeHead(404); res.end("nope"); });
server.listen(4545, ()=> console.log("Dashboard: http://localhost:4545"));
