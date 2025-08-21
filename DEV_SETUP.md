# 🚀 Configuração do Ambiente de Desenvolvimento

## Pré-requisitos
- Node.js v14+
- PostgreSQL 12+
- Git

## Configuração Inicial

### 1. Clone o repositório
```bash
git clone https://github.com/carlosvictorodrigues/Editaliza.git
cd Editaliza
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o PostgreSQL local

#### Opção A: Usar o script de configuração
```bash
node setup-local-db.js
```

#### Opção B: Configurar manualmente
1. Crie o banco de dados:
```sql
CREATE DATABASE editaliza_dev;
```

2. Configure o `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=editaliza_dev
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
```

### 4. Execute o servidor
```bash
npm start
```

## Credenciais de Teste
- Email: `c@c.com`
- Senha: `123`

## Estrutura do Banco

### PostgreSQL em Produção
- Host: Servidor DigitalOcean
- Banco: `editaliza_db`
- Migração completa do SQLite

### PostgreSQL Local
- Host: `localhost`
- Banco: `editaliza_dev`
- Dados de teste incluídos

## Comandos Úteis

```bash
# Desenvolvimento com hot-reload
npm run dev

# Executar testes
npm test

# Verificar logs
npm run logs
```

## ⚠️ Importante
- **NUNCA** commite o arquivo `.env`
- **SEMPRE** teste localmente antes de fazer push
- **Use** branches para novas features