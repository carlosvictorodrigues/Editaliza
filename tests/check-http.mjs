// tests/check-http.mjs
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

function request(urlStr, method="GET") {
  const u = new URL(urlStr);
  const lib = u.protocol === "https:" ? https : http;
  const opts = { method, hostname: u.hostname, port: u.port || (u.protocol==="https:"?443:80), path: u.pathname + (u.search||"") };
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, res => resolve({ status: res.statusCode||0 }));
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const url = process.argv[2];
  const methodFlag = process.argv.indexOf("--method");
  const expectFlag = process.argv.indexOf("--expect");
  const method = methodFlag > -1 ? (process.argv[methodFlag+1] || "GET") : "GET";
  const expect = expectFlag > -1 ? (process.argv[expectFlag+1] || "200").split(",").map(s=>parseInt(s.trim(),10)) : [200];
  if (!url) { console.error("Usage: node tests/check-http.mjs <url> [--method GET] [--expect 200,302]"); process.exit(2); }
  try {
    const { status } = await request(url, method);
    if (expect.includes(status)) { console.log(`OK ${url} -> ${status}`); process.exit(0); }
    console.error(`FAIL ${url} -> ${status}, expected one of ${expect.join(",")}`); process.exit(1);
  } catch (e) { console.error(`ERR ${url} -> ${e.message}`); process.exit(3); }
}
main();
