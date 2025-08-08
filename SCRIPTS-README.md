# 🚀 Scripts de Linha de Comando - Editaliza

Este documento descreve os scripts disponíveis para facilitar o desenvolvimento e manutenção do projeto Editaliza.

## 📋 Scripts Disponíveis

### 🎯 Scripts de Inicialização

#### `start-server.bat` (Windows)
- **Função:** Inicia o servidor em modo produção
- **Uso:** Duplo clique ou `start-server.bat`
- **Recursos:**
  - Verifica se Node.js está instalado
  - Instala dependências automaticamente se necessário
  - Inicia o servidor na porta 3000
  - Mostra URLs importantes

#### `start-server.sh` (Linux/Mac)
- **Função:** Inicia o servidor em modo produção
- **Uso:** `./start-server.sh` ou `bash start-server.sh`
- **Recursos:** Mesmo que o .bat, mas para sistemas Unix

#### `dev-start.bat` (Windows)
- **Função:** Inicia o servidor em modo desenvolvimento
- **Uso:** `dev-start.bat`
- **Recursos:**
  - Modo desenvolvimento com nodemon
  - Recarregamento automático de alterações
  - Verificação de dependências

#### `dev-start.sh` (Linux/Mac)
- **Função:** Inicia o servidor em modo desenvolvimento
- **Uso:** `./dev-start.sh` ou `bash dev-start.sh`
- **Recursos:** Mesmo que o .bat, mas para sistemas Unix

### 🛠️ Scripts de Manutenção

#### `maintenance.bat` (Windows)
- **Função:** Menu interativo para manutenção
- **Uso:** `maintenance.bat`
- **Opções:**
  1. 🔍 Verificar saúde do sistema
  2. 🧹 Limpar sessões
  3. 💾 Fazer backup do banco
  4. 📊 Verificar logs
  5. 🔄 Reiniciar servidor
  6. ❌ Sair

#### `maintenance.sh` (Linux/Mac)
- **Função:** Menu interativo para manutenção
- **Uso:** `./maintenance.sh` ou `bash maintenance.sh`
- **Opções:** Mesmas do .bat

## 📦 Scripts NPM

### Comandos Disponíveis

```bash
# Iniciar servidor
npm start

# Modo desenvolvimento
npm run dev

# Modo desenvolvimento com debug
npm run dev:debug

# Executar testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com cobertura
npm run test:coverage

# Executar testes de autenticação
npm run test:auth

# Verificar sintaxe do código
npm run lint

# Limpar sessões
npm run clean

# Fazer backup do banco
npm run backup

# Verificar saúde do sistema
npm run health
```

## 🔧 Configuração

### Pré-requisitos

1. **Node.js** (versão 14 ou superior)
   - Download: https://nodejs.org/downloads

2. **Dependências**
   ```bash
   npm install
   ```

### Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```bash
# Configurações de Segurança
JWT_SECRET=seu_jwt_secret_aqui
JWT_REFRESH_SECRET=seu_refresh_secret_aqui

# Configurações do Servidor
NODE_ENV=development
PORT=3000

# CORS Origins
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500,null
```

## 🎯 URLs Importantes

- **Servidor:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Dashboard:** http://localhost:3000/dashboard.html
- **Perfil:** http://localhost:3000/profile.html
- **Teste de Avatares:** http://localhost:3000/test-server.html

## 🚨 Solução de Problemas

### Servidor não inicia
1. Verifique se Node.js está instalado: `node --version`
2. Instale dependências: `npm install`
3. Verifique se a porta 3000 está livre
4. Consulte os logs de erro

### Problemas de CORS
1. Verifique o arquivo `.env`
2. Confirme se `ALLOWED_ORIGINS` está configurado
3. Reinicie o servidor

### Banco de dados
1. Verifique se `db.sqlite` existe
2. Execute backup se necessário: `npm run backup`
3. Limpe sessões se necessário: `npm run clean`

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte os logs do servidor
2. Verifique a documentação do projeto
3. Execute `npm run health` para diagnóstico
4. Use o script de manutenção para operações básicas

---

**Desenvolvido com ❤️ para o Editaliza** 