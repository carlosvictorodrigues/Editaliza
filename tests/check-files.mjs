// tests/check-files.mjs
import fs from "node:fs";
import path from "node:path";

const BAD = [
  "plan_settings_server_temp.html",
  "plan_settings_temp.html",
  "public/plan_settings_server.html"
];

let ok = true;
for (const f of BAD) {
  if (fs.existsSync(path.join(process.cwd(), f))) {
    console.error(`Encontrado arquivo temporário indevido: ${f}`);
    ok = false;
  }
}
if (ok) { console.log("OK: sem arquivos temporários indevidos."); process.exit(0); }
process.exit(1);
