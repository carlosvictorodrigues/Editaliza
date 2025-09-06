#!/usr/bin/env node
// frontend-agent.mjs - Agente especializado em Frontend

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

class FrontendAgent {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.name = "Frontend Agent";
    this.expertise = ["HTML", "CSS", "JavaScript", "UI/UX"];
  }

  // Método para fazer perguntas ao orquestrador
  async askOrchestrator(question) {
    console.log(`[${this.name}] Pergunta: ${question}`);
    return this.orchestrator.answerAgentQuestion(this.name, question);
  }

  // Analisa problemas do frontend
  async analyzeProblem(problem, context) {
    console.log(`[${this.name}] Analisando: ${problem}`);
    
    // Se precisa de informações
    if (problem.includes("502") || problem.includes("API")) {
      const answer = await this.askOrchestrator(
        "O erro 502 é causado pelo frontend ou backend? Qual URL a API deve usar?"
      );
      
      // Baseado na resposta, propõe solução
      if (answer.includes("backend")) {
        return {
          diagnosis: "Frontend está tentando acessar API incorretamente",
          solution: "Ajustar URLs da API no frontend",
          files: await this.findAPIFiles(),
          changes: await this.proposeAPIChanges()
        };
      }
    }
    
    if (problem.includes("schedule") || problem.includes("calendar")) {
      return {
        diagnosis: "Página de cronograma não tem conteúdo esperado",
        solution: "Verificar se está usando termos em português",
        files: ["public/schedule.html"],
        changes: []
      };
    }
    
    return null;
  }

  // Encontra arquivos que fazem chamadas à API
  async findAPIFiles() {
    const jsDir = path.join(process.cwd(), "..", "public", "js");
    const files = [];
    
    if (fs.existsSync(jsDir)) {
      const jsFiles = fs.readdirSync(jsDir);
      for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(jsDir, file), "utf8");
        if (content.includes("fetch") || content.includes("api/")) {
          files.push(`public/js/${file}`);
        }
      }
    }
    
    return files;
  }

  // Propõe mudanças nas chamadas da API
  async proposeAPIChanges() {
    const changes = [];
    
    // Verifica se está usando URL correta
    const apiFiles = await this.findAPIFiles();
    
    for (const file of apiFiles) {
      const filePath = path.join(process.cwd(), "..", file);
      const content = fs.readFileSync(filePath, "utf8");
      
      // Procura por URLs problemáticas
      if (content.includes("http://localhost")) {
        changes.push({
          file,
          type: "replace",
          find: "http://localhost:3000",
          replace: "https://app.editaliza.com.br"
        });
      }
      
      if (content.includes("/subjects") && !content.includes("/subjects_with_topics")) {
        changes.push({
          file,
          type: "replace",
          find: "/subjects",
          replace: "/subjects_with_topics"
        });
      }
    }
    
    return changes;
  }

  // Executa correções
  async executeFixe(changes) {
    console.log(`[${this.name}] Executando ${changes.length} correções...`);
    
    for (const change of changes) {
      const filePath = path.join(process.cwd(), "..", change.file);
      
      if (change.type === "replace") {
        let content = fs.readFileSync(filePath, "utf8");
        content = content.replace(new RegExp(change.find, "g"), change.replace);
        fs.writeFileSync(filePath, content);
        console.log(`[${this.name}] ✅ Corrigido: ${change.file}`);
      }
    }
    
    return true;
  }

  // Testa se as correções funcionaram
  async testFixes() {
    console.log(`[${this.name}] Testando correções do frontend...`);
    
    // Testa se arquivos JS são válidos
    const jsFiles = await this.findAPIFiles();
    for (const file of jsFiles) {
      const filePath = path.join(process.cwd(), "..", file);
      try {
        // Verifica sintaxe básica
        const content = fs.readFileSync(filePath, "utf8");
        new Function(content); // Tenta parsear como função
        console.log(`[${this.name}] ✅ ${file} - sintaxe OK`);
      } catch (e) {
        console.log(`[${this.name}] ❌ ${file} - erro de sintaxe`);
        return false;
      }
    }
    
    return true;
  }
}

export default FrontendAgent;