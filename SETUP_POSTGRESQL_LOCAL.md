# 🚀 CONFIGURAÇÃO DO POSTGRESQL LOCAL

## ⚠️ IMPORTANTE: Desenvolvimento DEVE ser igual a Produção!

### 1. INICIAR POSTGRESQL (Como Administrador)

Abra o **CMD como Administrador** e execute:

```cmd
net start postgresql-x64-17
```

Se já estiver rodando, aparecerá: "O serviço solicitado já foi iniciado"

### 2. CRIAR BANCO E USUÁRIO

Execute no CMD normal:

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql" -U postgres
```

Digite a senha do usuário postgres quando solicitado, então execute:

```sql
-- Criar banco
CREATE DATABASE editaliza_db;

-- Criar usuário
CREATE USER editaliza_user WITH PASSWORD '1a2b3c4d';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE editaliza_db TO editaliza_user;

-- Conectar ao banco
\c editaliza_db

-- Dar permissões no schema
GRANT ALL ON SCHEMA public TO editaliza_user;

-- Sair
\q
```

### 3. EXECUTAR SCRIPT DE CRIAÇÃO DE TABELAS

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -f setup-editaliza-db.sql
```

Digite a senha: `1a2b3c4d`

### 4. VERIFICAR CONEXÃO

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql" -U editaliza_user -d editaliza_db -c "SELECT current_database();"
```

Deve retornar: `editaliza_db`

### 5. CONFIGURAÇÃO DO .env

Certifique-se que o `.env` tem:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=editaliza_db
DB_USER=editaliza_user
DB_PASSWORD=1a2b3c4d
```

### 6. TESTAR A APLICAÇÃO

```cmd
npm start
```

Deve aparecer: `[DATABASE] PostgreSQL conectado com sucesso`

## 🔴 PROBLEMAS COMUNS

### PostgreSQL não inicia?
- Verifique se o serviço está instalado: `sc query postgresql-x64-17`
- Verifique logs em: `C:\Program Files\PostgreSQL\17\data\log`

### Erro de autenticação?
- Edite `pg_hba.conf` em `C:\Program Files\PostgreSQL\17\data\`
- Mude `scram-sha-256` para `trust` temporariamente para testar

### Porta 5432 em uso?
- Verifique: `netstat -an | findstr :5432`
- Matar processo: `taskkill /F /PID <PID>`

## ✅ BENEFÍCIOS DE USAR POSTGRESQL LOCAL

1. **Paridade com produção** - Sem surpresas em deploy
2. **Features completas** - Arrays, JSON, CTEs, etc
3. **Performance real** - Testes significativos
4. **Debugging melhor** - Logs e queries reais
5. **Integridade** - Foreign keys funcionando

## 🚫 POR QUE NÃO USAR BANCO EM MEMÓRIA

1. **Comportamento diferente** - SQLite ≠ PostgreSQL
2. **Bugs escondidos** - Funciona local, quebra em produção
3. **Features limitadas** - Sem arrays, JSON limitado
4. **Falsa segurança** - Testes passam mas não refletem realidade

## 📝 CHECKLIST FINAL

- [ ] PostgreSQL rodando localmente
- [ ] Banco `editaliza_db` criado
- [ ] Usuário `editaliza_user` com permissões
- [ ] Tabelas criadas
- [ ] Aplicação conectando com sucesso
- [ ] Testes rodando com banco real

---

**LEMBRE-SE:** Desenvolvimento = Produção. Sempre!