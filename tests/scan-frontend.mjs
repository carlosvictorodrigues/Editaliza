// tests/scan-frontend.mjs
import fs from "node:fs";
import path from "node:path";

const roots = ["public", "src", "."];
const exts = [".html", ".htm", ".js", ".mjs", ".ts"];
const badHits = [];

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      scanDir(full);
    } else {
      if (exts.includes(path.extname(entry.name))) {
        const txt = fs.readFileSync(full, "utf8");
        // procura fetch/axios/xhr com "/subjects" que não contenha "_with_topics" na mesma chamada
        const regex = /(fetch|axios\.(get|post|put|delete)|XMLHttpRequest)[\s\S]*?\/subjects(?!_with_topics)/gi;
        if (regex.test(txt)) badHits.push(full);
      }
    }
  }
}

roots.forEach(r => scanDir(path.join(process.cwd(), r)));

if (badHits.length) {
  console.error("Encontradas chamadas para /subjects sem _with_topics:");
  for (const f of badHits) console.error(" - " + f);
  process.exit(1);
}
console.log("OK: nenhuma chamada indevida a /subjects sem _with_topics.");
process.exit(0);
