const { Pool } = require("pg");

// Configuração do PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "editaliza",
    user: "editaliza_user",
    password: "Ed1t@l1z@2025",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Converter placeholders de SQLite (?) para PostgreSQL ($1, $2, etc)
function convertQuery(sql, params) {
    let pgSQL = sql;
    let paramIndex = 1;
    
    // Substituir ? por $1, $2, etc.
    pgSQL = pgSQL.replace(/\?/g, () => {
        return "$" + (paramIndex++);
    });
    
    // Conversões de funções SQLite para PostgreSQL
    pgSQL = pgSQL
        // Datas
        .replace(/datetime\(\s*'now'\s*\)/gi, "NOW()")
        .replace(/datetime\(\)/gi, "NOW()")
        .replace(/date\(\s*'now'\s*\)/gi, "CURRENT_DATE")
        
        // Tipos
        .replace(/AUTOINCREMENT/gi, "")
        .replace(/INTEGER PRIMARY KEY/gi, "SERIAL PRIMARY KEY")
        
        // INSERT OR
        .replace(/INSERT OR REPLACE INTO/gi, "INSERT INTO")
        .replace(/INSERT OR IGNORE INTO/gi, "INSERT INTO");
    
    return pgSQL;
}

// Wrapper para compatibilidade com SQLite
const db = {
    // Para queries simples (INSERT, UPDATE, DELETE)
    run: async (sql, params = []) => {
        const client = await pool.connect();
        try {
            const pgSQL = convertQuery(sql, params);
            const result = await client.query(pgSQL, params);
            
            // Tentar obter o ID inserido se for um INSERT
            let lastInsertRowid = null;
            if (pgSQL.toUpperCase().includes("INSERT")) {
                if (result.rows && result.rows[0] && result.rows[0].id) {
                    lastInsertRowid = result.rows[0].id;
                }
            }
            
            return { 
                lastInsertRowid: lastInsertRowid,
                changes: result.rowCount 
            };
        } catch (error) {
            console.error("[DB Error] run:", error.message);
            throw error;
        } finally {
            client.release();
        }
    },
    
    // Para SELECT único
    get: async (sql, params = []) => {
        const client = await pool.connect();
        try {
            const pgSQL = convertQuery(sql, params);
            const result = await client.query(pgSQL, params);
            return result.rows ? result.rows[0] : null;
        } catch (error) {
            console.error("[DB Error] get:", error.message);
            throw error;
        } finally {
            client.release();
        }
    },
    
    // Para SELECT múltiplo
    all: async (sql, params = []) => {
        const client = await pool.connect();
        try {
            const pgSQL = convertQuery(sql, params);
            const result = await client.query(pgSQL, params);
            return result.rows || [];
        } catch (error) {
            console.error("[DB Error] all:", error.message);
            throw error;
        } finally {
            client.release();
        }
    },
    
    // Método exec para DDL
    exec: async (sql) => {
        const client = await pool.connect();
        try {
            const pgSQL = convertQuery(sql, []);
            await client.query(pgSQL);
            return true;
        } catch (error) {
            console.error("[DB Error] exec:", error.message);
            throw error;
        } finally {
            client.release();
        }
    },
    
    // Para compatibilidade com prepared statements
    prepare: (sql) => {
        return {
            run: (params = []) => db.run(sql, params),
            get: (params = []) => db.get(sql, params),
            all: (params = []) => db.all(sql, params),
            finalize: () => {} // No-op
        };
    },
    
    // Fechar conexão
    close: async () => {
        await pool.end();
    }
};

// Teste de conexão
pool.connect((err, client, release) => {
    if (err) {
        console.error("Erro ao conectar ao PostgreSQL:", err.stack);
    } else {
        console.log("✅ Conectado ao PostgreSQL!");
        release();
    }
});

module.exports = db;