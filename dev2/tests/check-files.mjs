// tests/check-files.mjs
import fs from "node:fs"; import path from "node:path";
const root = process.env.PROJECT_DIR || process.cwd();
const BAD = ["plan_settings_server_temp.html","plan_settings_temp.html","public/plan_settings_server.html"];
let ok=true; for(const f of BAD){ if(fs.existsSync(path.join(root,f))){ console.error(`Encontrado arquivo temporário: ${f}`); ok=false; } }
if(ok){ console.log("OK: sem arquivos temporários indevidos."); process.exit(0); }
process.exit(1);
