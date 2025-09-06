#!/usr/bin/env node
// backend-agent.mjs - Agente especializado em Backend

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

class BackendAgent {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.name = "Backend Agent";
    this.expertise = ["Node.js", "Express", "PostgreSQL", "APIs"];
  }

  // Método para fazer perguntas ao orquestrador
  async askOrchestrator(question) {
    console.log(`[${this.name}] Pergunta: ${question}`);
    return this.orchestrator.answerAgentQuestion(this.name, question);
  }

  // Analisa problemas do backend
  async analyzeProblem(problem, context) {
    console.log(`[${this.name}] Analisando: ${problem}`);
    
    if (problem.includes("502") || problem.includes("API")) {
      // Pergunta ao orquestrador sobre o estado do servidor
      const serverStatus = await this.askOrchestrator(
        "O servidor está rodando? PM2 mostra o app online?"
      );
      
      if (serverStatus.includes("não") || serverStatus.includes("offline")) {
        return {
          diagnosis: "Aplicação backend não está rodando",
          solution: "Iniciar aplicação com PM2",
          commands: [
            "cd /root/editaliza && pm2 start server.js --name editaliza-app",
            "pm2 save",
            "pm2 startup"
          ]
        };
      } else {
        return {
          diagnosis: "Backend rodando mas não acessível",
          solution: "Verificar configuração do Nginx",
          commands: [
            "nginx -t",
            "systemctl reload nginx"
          ]
        };
      }
    }
    
    if (problem.includes("login") || problem.includes("auth")) {
      return {
        diagnosis: "Problema de autenticação",
        solution: "Verificar middleware de auth e banco de dados",
        files: ["src/middleware/auth.js", "src/controllers/auth.controller.js"],
        checks: await this.checkAuthSystem()
      };
    }
    
    return null;
  }

  // Verifica sistema de autenticação
  async checkAuthSystem() {
    const checks = [];
    
    // Verifica se arquivo de auth existe
    const authMiddleware = path.join(process.cwd(), "..", "src", "middleware", "auth.js");
    if (fs.existsSync(authMiddleware)) {
      const content = fs.readFileSync(authMiddleware, "utf8");
      checks.push({
        item: "Middleware de autenticação",
        exists: true,
        hasJWT: content.includes("jsonwebtoken"),
        hasVerify: content.includes("verify")
      });
    }
    
    // Verifica configuração do banco
    const dbConfig = path.join(process.cwd(), "..", "src", "config", "database.js");
    if (fs.existsSync(dbConfig)) {
      const content = fs.readFileSync(dbConfig, "utf8");
      checks.push({
        item: "Configuração do banco",
        exists: true,
        hasPool: content.includes("Pool"),
        hasSSL: content.includes("ssl")
      });
    }
    
    return checks;
  }

  // Verifica rotas da API
  async checkAPIRoutes() {
    console.log(`[${this.name}] Verificando rotas da API...`);
    
    const routesDir = path.join(process.cwd(), "..", "src", "routes");
    const routes = [];
    
    if (fs.existsSync(routesDir)) {
      const files = fs.readdirSync(routesDir);
      for (const file of files) {
        if (file.endsWith(".routes.js") || file.endsWith(".route.js")) {
          const content = fs.readFileSync(path.join(routesDir, file), "utf8");
          
          // Extrai rotas definidas
          const getRoutes = content.match(/router\.(get|post|put|delete)\(['"]([^'"]+)/g) || [];
          routes.push({
            file,
            endpoints: getRoutes.map(r => {
              const [method, path] = r.match(/(get|post|put|delete)\(['"]([^'"]+)/).slice(1);
              return `${method.toUpperCase()} ${path}`;
            })
          });
        }
      }
    }
    
    return routes;
  }

  // Corrige problemas do backend
  async executeFixes(solution) {
    console.log(`[${this.name}] Executando correções do backend...`);
    
    if (solution.commands) {
      // Executa comandos no servidor
      for (const cmd of solution.commands) {
        const answer = await this.askOrchestrator(
          `Posso executar este comando no servidor: ${cmd}?`
        );
        
        if (answer.includes("sim") || answer.includes("yes")) {
          console.log(`[${this.name}] Executando: ${cmd}`);
          // Aqui executaria via SSH
        }
      }
    }
    
    if (solution.files) {
      // Corrige arquivos localmente
      for (const file of solution.files) {
        console.log(`[${this.name}] Verificando: ${file}`);
        // Implementar correções específicas
      }
    }
    
    return true;
  }

  // Testa se backend está funcionando
  async testBackend() {
    console.log(`[${this.name}] Testando backend...`);
    
    // Pergunta ao orquestrador sobre teste de API
    const apiTest = await this.askOrchestrator(
      "Qual endpoint devo testar para verificar se a API está funcionando?"
    );
    
    // Implementar teste baseado na resposta
    console.log(`[${this.name}] Testando endpoint: ${apiTest}`);
    
    return true;
  }
}

export default BackendAgent;