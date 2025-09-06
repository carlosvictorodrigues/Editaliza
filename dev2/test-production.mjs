#!/usr/bin/env node
// test-production.mjs - Testa funcionalidades em produção

import https from "https";
import { URL } from "url";

// Permite sobrescrever a URL de produção via variável de ambiente
const BASE_URL = process.env.ED_PROD_URL || process.env.BASE_URL || "https://editaliza.com.br";

// Páginas e elementos esperados
const TESTS = [
  {
    name: "🏠 Página inicial",
    path: "/",
    checks: ["<!DOCTYPE html", "<title>", "Editaliza"]
  },
  {
    name: "🔐 Página de login",
    path: "/login.html",
    checks: ["login", "email", "password", "form"]
  },
  {
    name: "📝 Registro",
    path: "/register.html",
    checks: ["register", "email", "password", "name"]
  },
  {
    name: "⚙️ Configuração de planos",
    path: "/plan_settings.html",
    checks: ["plan", "subject", "topic"]
  },
  {
    name: "📅 Cronograma",
    path: "/schedule.html", 
    checks: ["schedule", "calendar", "study"]
  },
  {
    name: "🏡 Home (Dashboard)",
    path: "/home.html",
    checks: ["session", "timer", "checklist"]
  },
  {
    name: "🔌 API Health",
    path: "/api/health",
    checks: ["ok", "status"],
    expectJSON: true
  },
  {
    name: "📚 API Subjects",
    path: "/api/subjects_with_topics",
    checks: [],
    expectJSON: true,
    requireAuth: true
  }
];

// Faz requisição HTTPS
function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    https.get(url, (res) => {
      let data = "";
      
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          redirect: res.headers.location
        });
      });
    }).on("error", reject);
  });
}

// Testa uma página
async function testPage(test) {
  try {
    console.log(`\nTestando ${test.name}...`);
    const response = await fetchPage(test.path);
    
    console.log(`  Status: ${response.status}`);
    
    // Verifica redirecionamento
    if (response.redirect) {
      console.log(`  ↪️ Redirecionado para: ${response.redirect}`);
    }
    
    // Verifica se é JSON
    if (test.expectJSON) {
      try {
        const json = JSON.parse(response.body);
        console.log(`  ✅ Resposta JSON válida`);
        if (Object.keys(json).length > 0) {
          console.log(`  📊 Campos: ${Object.keys(json).join(", ")}`);
        }
      } catch {
        console.log(`  ❌ Resposta não é JSON válido`);
        return false;
      }
    }
    
    // Verifica conteúdo esperado
    if (test.checks && test.checks.length > 0) {
      const bodyLower = response.body.toLowerCase();
      let passed = 0;
      let failed = [];
      
      for (const check of test.checks) {
        if (bodyLower.includes(check.toLowerCase())) {
          passed++;
        } else {
          failed.push(check);
        }
      }
      
      if (passed === test.checks.length) {
        console.log(`  ✅ Todos os ${passed} checks passaram`);
      } else {
        console.log(`  ⚠️ ${passed}/${test.checks.length} checks passaram`);
        if (failed.length > 0) {
          console.log(`  ❌ Faltando: ${failed.join(", ")}`);
        }
      }
    }
    
    // Status codes aceitáveis
    const acceptableStatus = [200, 301, 302, 304];
    if (test.requireAuth) acceptableStatus.push(401, 403);
    
    if (acceptableStatus.includes(response.status)) {
      console.log(`  ✅ Status OK`);
      return true;
    } else {
      console.log(`  ❌ Status inesperado: ${response.status}`);
      return false;
    }
    
  } catch (error) {
    console.log(`  ❌ Erro: ${error.message}`);
    return false;
  }
}

// Testa conectividade básica
async function testConnectivity() {
  console.log("🔌 Testando conectividade com o servidor...");
  try {
    const response = await fetchPage("/");
    if (response.status) {
      console.log(`✅ Servidor respondendo (Status: ${response.status})`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Servidor não está acessível: ${error.message}`);
    return false;
  }
  return false;
}

// Executa todos os testes
async function runAllTests() {
  console.log("=" .repeat(60));
  console.log("🧪 TESTE DE PRODUÇÃO - EDITALIZA");
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`🕐 Data: ${new Date().toLocaleString("pt-BR")}`);
  console.log("=" .repeat(60));
  
  // Testa conectividade primeiro
  const isOnline = await testConnectivity();
  if (!isOnline) {
    console.log("\n⛔ Servidor não está acessível. Abortando testes.");
    process.exit(1);
  }
  
  // Executa todos os testes
  const results = [];
  for (const test of TESTS) {
    const passed = await testPage(test);
    results.push({ name: test.name, passed });
  }
  
  // Resumo
  console.log("\n" + "=" .repeat(60));
  console.log("📊 RESUMO DOS TESTES");
  console.log("=" .repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  results.forEach(r => {
    console.log(`${r.passed ? "✅" : "❌"} ${r.name}`);
  });
  
  console.log("\n" + "-" .repeat(60));
  console.log(`📈 Taxa de sucesso: ${passed}/${total} (${percentage}%)`);
  
  if (percentage === 100) {
    console.log("🎉 TODOS OS TESTES PASSARAM!");
  } else if (percentage >= 80) {
    console.log("⚠️ Sistema funcionando parcialmente");
  } else {
    console.log("❌ Sistema com problemas críticos");
  }
  
  console.log("=" .repeat(60));
  
  // Exit code baseado no sucesso
  process.exit(percentage === 100 ? 0 : 1);
}

// Executa
runAllTests().catch(error => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
