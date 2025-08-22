# 🎯 PLANO DE EXECUÇÃO DETALHADO - MIGRAÇÃO POSTGRESQL
## Para Execução pelo Sonnet - Passo a Passo Ultra Detalhado

### ⚠️ REGRAS CRÍTICAS DE SEGURANÇA
1. **NUNCA** modificar o arquivo `db.sqlite` original
2. **SEMPRE** testar em banco separado primeiro
3. **PARAR** imediatamente se algum erro ocorrer
4. **VERIFICAR** cada passo antes de prosseguir
5. **MANTER** SQLite funcionando durante toda migração

---

## 📋 CHECKLIST PRÉ-EXECUÇÃO

### Verificar se existem:
- [ ] Arquivo: `backups/pre-migration/2025-08-15T11-21-50-561Z/db.sqlite.backup`
- [ ] Arquivo: `migration/001-create-schema.sql`
- [ ] Arquivo: `src/utils/database-adapter.js`
- [ ] PostgreSQL instalado e rodando
- [ ] Senha do PostgreSQL conhecida

---

## 🔧 FASE 1: CONFIGURAÇÃO POSTGRESQL (30 minutos)

### Passo 1.1: Testar PostgreSQL
```bash
# Comando exato:
node migration/test-postgresql-setup.js
```

**O QUE FAZER:**
1. Quando pedir senha, digite a senha do PostgreSQL (definida na instalação)
2. Aguardar todos os 5 testes passarem
3. Se algum falhar, PARAR e reportar

**RESULTADO ESPERADO:**
```
✅ Conectado com sucesso!
✅ Banco editaliza_dev criado
✅ Banco editaliza_test criado
✅ Schema criado e testado com sucesso
✅ Configuração salva em .env.postgresql
```

### Passo 1.2: Verificar bancos criados
```bash
# Criar arquivo para verificar:
```

**CRIAR ARQUIVO:** `migration/verify-databases.js`
```javascript
const { Client } = require('pg');

async function verify() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: process.env.PG_PASSWORD || 'SUA_SENHA_AQUI'
    });

    try {
        await client.connect();
        const result = await client.query(`
            SELECT datname FROM pg_database 
            WHERE datname IN ('editaliza_dev', 'editaliza_test')
        `);
        
        console.log('Bancos encontrados:', result.rows);
        
        if (result.rows.length === 2) {
            console.log('✅ Ambos os bancos foram criados!');
        } else {
            console.log('❌ Faltam bancos!');
        }
        
        await client.end();
    } catch (error) {
        console.error('Erro:', error.message);
    }
}

verify();
```

**EXECUTAR:**
```bash
node migration/verify-databases.js
```

---

## 🗄️ FASE 2: CRIAR SCHEMA NO POSTGRESQL (20 minutos)

### Passo 2.1: Criar executor de schema

**CRIAR ARQUIVO:** `migration/execute-schema.js`
```javascript
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function executeSchema() {
    console.log('🔨 Criando schema no PostgreSQL...\n');
    
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'editaliza_dev',
        user: 'postgres',
        password: process.env.PG_PASSWORD || 'SUA_SENHA_AQUI'
    });

    try {
        await client.connect();
        console.log('✅ Conectado ao banco editaliza_dev');
        
        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, '001-create-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 Executando script SQL...');
        await client.query(sql);
        
        // Verificar tabelas criadas
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'editaliza'
            ORDER BY table_name
        `);
        
        console.log('\n✅ Tabelas criadas:');
        result.rows.forEach(row => {
            console.log('   -', row.table_name);
        });
        
        if (result.rows.length === 14) {
            console.log('\n✅ SCHEMA CRIADO COM SUCESSO!');
        } else {
            console.log(`\n⚠️ Esperado 14 tabelas, encontrado ${result.rows.length}`);
        }
        
        await client.end();
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

executeSchema();
```

**EXECUTAR:**
```bash
node migration/execute-schema.js
```

---

## 📊 FASE 3: MIGRAR DADOS (30 minutos)

### Passo 3.1: Criar migrador de dados

**CRIAR ARQUIVO:** `migration/migrate-data.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

class DataMigrator {
    constructor() {
        this.sqlite = new sqlite3.Database('./db.sqlite');
        this.pgConfig = {
            host: 'localhost',
            port: 5432,
            database: 'editaliza_dev',
            user: 'postgres',
            password: process.env.PG_PASSWORD || 'SUA_SENHA_AQUI'
        };
        this.stats = {
            tables: {},
            errors: [],
            startTime: Date.now()
        };
    }

    async migrate() {
        console.log('🚀 INICIANDO MIGRAÇÃO DE DADOS');
        console.log('=' .repeat(50) + '\n');
        
        const pg = new Client(this.pgConfig);
        await pg.connect();
        
        try {
            // ORDEM IMPORTANTE - respeitar foreign keys
            await this.migrateTable(pg, 'users');
            await this.migrateTable(pg, 'study_plans');
            await this.migrateTable(pg, 'subjects');
            await this.migrateTable(pg, 'topics');
            await this.migrateTable(pg, 'study_sessions');
            await this.migrateTable(pg, 'study_time_logs');
            await this.migrateTable(pg, 'user_activities');
            await this.migrateTable(pg, 'user_settings');
            await this.migrateTable(pg, 'user_preferences');
            await this.migrateTable(pg, 'privacy_settings');
            await this.migrateTable(pg, 'login_attempts');
            await this.migrateTable(pg, 'reta_final_excluded_topics');
            await this.migrateTable(pg, 'reta_final_exclusions');
            
            await this.printReport();
            
        } catch (error) {
            console.error('❌ ERRO CRÍTICO:', error.message);
            this.stats.errors.push({
                phase: 'global',
                error: error.message
            });
        } finally {
            await pg.end();
            this.sqlite.close();
        }
    }

    async migrateTable(pg, tableName) {
        console.log(`\n📦 Migrando tabela: ${tableName}`);
        
        return new Promise((resolve) => {
            this.sqlite.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
                if (err) {
                    console.log(`   ❌ Erro ao ler ${tableName}:`, err.message);
                    this.stats.errors.push({ table: tableName, error: err.message });
                    resolve();
                    return;
                }
                
                if (!rows || rows.length === 0) {
                    console.log(`   ⚠️ Tabela ${tableName} está vazia`);
                    this.stats.tables[tableName] = { source: 0, migrated: 0 };
                    resolve();
                    return;
                }
                
                console.log(`   📊 Encontrados ${rows.length} registros`);
                
                let migrated = 0;
                for (const row of rows) {
                    try {
                        await this.insertRow(pg, tableName, row);
                        migrated++;
                    } catch (insertErr) {
                        console.log(`   ⚠️ Erro em registro:`, insertErr.message);
                        this.stats.errors.push({
                            table: tableName,
                            row: row.id,
                            error: insertErr.message
                        });
                    }
                }
                
                console.log(`   ✅ Migrados ${migrated}/${rows.length} registros`);
                this.stats.tables[tableName] = {
                    source: rows.length,
                    migrated: migrated
                };
                
                resolve();
            });
        });
    }

    async insertRow(pg, tableName, row) {
        // Preparar colunas e valores
        const columns = Object.keys(row).filter(col => row[col] !== null);
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`);
        
        const sql = `
            INSERT INTO editaliza.${tableName} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT DO NOTHING
        `;
        
        await pg.query(sql, values);
    }

    async printReport() {
        console.log('\n' + '=' .repeat(50));
        console.log('📊 RELATÓRIO DE MIGRAÇÃO\n');
        
        // Estatísticas por tabela
        console.log('Tabelas migradas:');
        for (const [table, stats] of Object.entries(this.stats.tables)) {
            const emoji = stats.source === stats.migrated ? '✅' : '⚠️';
            console.log(`  ${emoji} ${table}: ${stats.migrated}/${stats.source}`);
        }
        
        // Erros
        if (this.stats.errors.length > 0) {
            console.log(`\n⚠️ Erros encontrados: ${this.stats.errors.length}`);
            console.log('Salvando log de erros em: migration-errors.json');
            fs.writeFileSync(
                'migration-errors.json',
                JSON.stringify(this.stats.errors, null, 2)
            );
        } else {
            console.log('\n✅ Migração sem erros!');
        }
        
        // Tempo total
        const duration = (Date.now() - this.stats.startTime) / 1000;
        console.log(`\n⏱️ Tempo total: ${duration.toFixed(2)} segundos`);
    }
}

// Executar
const migrator = new DataMigrator();
migrator.migrate();
```

**EXECUTAR:**
```bash
node migration/migrate-data.js
```

---

## ✅ FASE 4: VALIDAÇÃO (20 minutos)

### Passo 4.1: Criar validador

**CRIAR ARQUIVO:** `migration/validate-migration.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');

async function validate() {
    console.log('🔍 VALIDANDO MIGRAÇÃO\n');
    
    const sqlite = new sqlite3.Database('./db.sqlite');
    const pg = new Client({
        host: 'localhost',
        port: 5432,
        database: 'editaliza_dev',
        user: 'postgres',
        password: process.env.PG_PASSWORD || 'SUA_SENHA_AQUI'
    });
    
    await pg.connect();
    
    const tables = [
        'users', 'study_plans', 'subjects', 'topics',
        'study_sessions', 'study_time_logs', 'user_activities',
        'user_settings', 'user_preferences', 'privacy_settings',
        'login_attempts', 'reta_final_excluded_topics', 'reta_final_exclusions'
    ];
    
    let allMatch = true;
    
    for (const table of tables) {
        const sqliteCount = await new Promise((resolve) => {
            sqlite.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
        
        const pgResult = await pg.query(
            `SELECT COUNT(*) as count FROM editaliza.${table}`
        );
        const pgCount = parseInt(pgResult.rows[0].count);
        
        const match = sqliteCount === pgCount ? '✅' : '❌';
        console.log(`${match} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
        
        if (sqliteCount !== pgCount) allMatch = false;
    }
    
    console.log('\n' + '=' .repeat(50));
    if (allMatch) {
        console.log('✅ VALIDAÇÃO COMPLETA - TODOS OS DADOS MIGRADOS!');
    } else {
        console.log('⚠️ VALIDAÇÃO FALHOU - VERIFICAR DIFERENÇAS!');
    }
    
    sqlite.close();
    await pg.end();
}

validate();
```

**EXECUTAR:**
```bash
node migration/validate-migration.js
```

---

## 🔄 FASE 5: CONFIGURAR APLICAÇÃO (15 minutos)

### Passo 5.1: Criar arquivo de teste

**CRIAR ARQUIVO:** `test-with-postgres.js`
```javascript
// Teste simples com PostgreSQL
process.env.DB_TYPE = 'postgresql';
process.env.PG_PASSWORD = 'SUA_SENHA_AQUI';

const { DatabaseAdapter } = require('./src/utils/database-adapter');

async function test() {
    const db = new DatabaseAdapter({ dbType: 'postgresql' });
    await db.initialize();
    
    // Teste simples
    const result = await db.get('SELECT COUNT(*) as count FROM editaliza.users');
    console.log('Usuários no PostgreSQL:', result.count);
    
    // Health check
    const health = await db.healthCheck();
    console.log('Health:', health);
    
    await db.close();
}

test().catch(console.error);
```

**EXECUTAR:**
```bash
node test-with-postgres.js
```

---

## 🚦 FASE 6: TESTE GRADUAL (30 minutos)

### Passo 6.1: Teste com dual-write

**CRIAR ARQUIVO:** `.env.test`
```env
# Teste de dual-write
DB_TYPE=sqlite
DUAL_WRITE=true
PG_PASSWORD=SUA_SENHA_AQUI
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=editaliza_dev
PG_USER=postgres
```

### Passo 6.2: Executar servidor em modo teste
```bash
# Windows
set NODE_ENV=test && node server.js

# Linux/Mac
NODE_ENV=test node server.js
```

**TESTAR:**
1. Fazer login com usuário existente
2. Criar um novo plano
3. Verificar se foi salvo em ambos bancos

---

## 🛡️ FASE 7: ROLLBACK SE NECESSÁRIO

### Se algo der errado:

**ARQUIVO JÁ CRIADO:** `migration/emergency-rollback.js`
```javascript
// SE PRECISAR REVERTER TUDO
const fs = require('fs');
const path = require('path');

console.log('🔄 EXECUTANDO ROLLBACK DE EMERGÊNCIA\n');

// 1. Restaurar backup SQLite
const backupPath = './backups/pre-migration/2025-08-15T11-21-50-561Z/db.sqlite.backup';
const targetPath = './db.sqlite';

if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, targetPath);
    console.log('✅ Banco SQLite restaurado do backup');
} else {
    console.log('❌ Backup não encontrado!');
}

// 2. Reverter configurações
process.env.DB_TYPE = 'sqlite';
process.env.DUAL_WRITE = 'false';
process.env.USE_POSTGRESQL = 'false';

console.log('✅ Configurações revertidas para SQLite');
console.log('\n✅ ROLLBACK COMPLETO - Sistema voltou ao estado original');
```

---

## 📋 CHECKLIST FINAL

### Após completar todas as fases:

- [ ] PostgreSQL instalado e configurado
- [ ] Bancos editaliza_dev e editaliza_test criados
- [ ] Schema criado com 14 tabelas
- [ ] Todos os dados migrados
- [ ] Validação mostra contagens iguais
- [ ] Teste com aplicação funcionando
- [ ] Backup ainda disponível para rollback

---

## ⚠️ PONTOS CRÍTICOS DE ATENÇÃO

1. **SENHA**: Sempre substituir `SUA_SENHA_AQUI` pela senha real
2. **SCHEMA**: Usar sempre `editaliza.` antes do nome das tabelas
3. **FOREIGN KEYS**: Respeitar ordem de migração
4. **BACKUPS**: Nunca deletar o backup original
5. **TESTES**: Testar TUDO antes de considerar completo

---

## 📞 SE PRECISAR DE AJUDA

### Comandos de diagnóstico:

```bash
# Ver logs do PostgreSQL
pg_ctl status

# Verificar conexão
psql -U postgres -c "SELECT 1"

# Listar bancos
psql -U postgres -c "\l"

# Ver tabelas do editaliza_dev
psql -U postgres -d editaliza_dev -c "\dt editaliza.*"
```

### Arquivos importantes:
- Backup: `backups/pre-migration/2025-08-15T11-21-50-561Z/`
- Schema: `migration/001-create-schema.sql`
- Adapter: `src/utils/database-adapter.js`
- Logs de erro: `migration-errors.json`

---

## ✅ SUCESSO

Quando tudo estiver funcionando:
1. A aplicação roda normalmente
2. PostgreSQL tem todos os dados
3. SQLite continua funcionando como fallback
4. Pode alternar entre bancos mudando `DB_TYPE`

**FIM DO ROTEIRO - BOA SORTE!** 🚀