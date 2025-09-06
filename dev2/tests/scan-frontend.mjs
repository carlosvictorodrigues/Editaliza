// tests/scan-frontend.mjs
import fs from "node:fs"; import path from "node:path";
const root = process.env.PROJECT_DIR || process.cwd();
const roots = ["public","src","."]; const exts = [".html",".htm",".js",".mjs",".ts"]; const hits=[];
function scanDir(dir){ if(!fs.existsSync(dir)) return;
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full = path.join(dir,e.name);
    if(e.isDirectory()){ if(e.name==="node_modules"||e.name.startsWith(".")) continue; scanDir(full); }
    else { if(exts.includes(path.extname(e.name))){
        const txt = fs.readFileSync(full,"utf8");
        const rx = /(fetch|axios\.(get|post|put|delete)|XMLHttpRequest)[\s\S]*?\/subjects(?!_with_topics)/gi;
        if(rx.test(txt)) hits.push(full);
      } }
  }
}
for(const r of roots) scanDir(path.join(root,r));
if(hits.length){ console.error("Chamadas para /subjects sem _with_topics:"); for(const h of hits) console.error(" - "+h); process.exit(1); }
console.log("OK: nenhuma chamada indevida."); process.exit(0);
