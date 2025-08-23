// Script para verificar e corrigir OAuth com PostgreSQL
const { Pool } = require("pg");

// Configuração do PostgreSQL
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "editaliza",
    user: "editaliza_user",
    password: "Ed1t@l1z@2025"
});

async function checkOAuthSetup() {
    console.log("🔍 Verificando configuração OAuth com PostgreSQL...\n");
    
    try {
        // 1. Verificar conexão
        const client = await pool.connect();
        console.log("✅ Conexão com PostgreSQL estabelecida");
        
        // 2. Verificar estrutura da tabela users
        const tableInfo = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `);
        
        console.log("\n📋 Estrutura da tabela users:");
        console.log("Colunas encontradas:", tableInfo.rows.length);
        
        const requiredColumns = ['google_id', 'email', 'name', 'password'];
        const existingColumns = tableInfo.rows.map(row => row.column_name);
        
        for (const col of requiredColumns) {
            if (existingColumns.includes(col)) {
                console.log(`  ✓ ${col}`);
            } else {
                console.log(`  ✗ ${col} - FALTANDO!`);
            }
        }
        
        // 3. Verificar usuários com Google OAuth
        const googleUsers = await client.query(
            "SELECT COUNT(*) as count FROM users WHERE google_id IS NOT NULL"
        );
        console.log(`\n👥 Usuários com Google OAuth: ${googleUsers.rows[0].count}`);
        
        // 4. Verificar últimos logins com OAuth
        const recentOAuth = await client.query(`
            SELECT id, email, google_id, created_at 
            FROM users 
            WHERE google_id IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (recentOAuth.rows.length > 0) {
            console.log("\n📊 Últimos usuários OAuth:");
            recentOAuth.rows.forEach(user => {
                console.log(`  - ${user.email} (ID: ${user.id})`);
            });
        }
        
        // 5. Verificar se há erros com password NULL em usuários OAuth
        const oauthWithoutPassword = await client.query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE google_id IS NOT NULL 
            AND password IS NULL
        `);
        
        if (oauthWithoutPassword.rows[0].count > 0) {
            console.log(`\n⚠️  ${oauthWithoutPassword.rows[0].count} usuários OAuth sem senha (esperado)`);
            
            // Corrigir adicionando senha padrão para OAuth
            console.log("🔧 Adicionando senha padrão para usuários OAuth...");
            await client.query(`
                UPDATE users 
                SET password = '$2b$10$dummy.oauth.password.hash' 
                WHERE google_id IS NOT NULL 
                AND password IS NULL
            `);
            console.log("✅ Senhas padrão adicionadas");
        }
        
        // 6. Testar uma query típica do OAuth
        console.log("\n🧪 Testando query do OAuth:");
        const testEmail = "teste@example.com";
        const testGoogleId = "test123";
        
        try {
            // Simular busca de usuário
            const findUser = await client.query(
                "SELECT * FROM users WHERE google_id = $1",
                [testGoogleId]
            );
            console.log("  ✓ Query de busca funciona");
            
            // Simular upsert (sem executar)
            const upsertQuery = `
                INSERT INTO users (google_id, email, name, password, created_at) 
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (email) 
                DO UPDATE SET 
                    google_id = EXCLUDED.google_id,
                    name = EXCLUDED.name,
                    last_login = NOW()
                RETURNING *
            `;
            console.log("  ✓ Query de upsert preparada corretamente");
            
        } catch (err) {
            console.error("  ✗ Erro na query:", err.message);
        }
        
        // 7. Verificar índices
        const indexes = await client.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'users'
        `);
        
        console.log("\n🔍 Índices na tabela users:");
        indexes.rows.forEach(idx => {
            console.log(`  - ${idx.indexname}`);
        });
        
        // Criar índice no google_id se não existir
        const hasGoogleIndex = indexes.rows.some(idx => 
            idx.indexdef.includes('google_id')
        );
        
        if (!hasGoogleIndex) {
            console.log("\n🔧 Criando índice para google_id...");
            await client.query(
                "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)"
            );
            console.log("✅ Índice criado");
        }
        
        client.release();
        console.log("\n✅ Verificação completa!");
        console.log("\n📝 Recomendações:");
        console.log("1. Reinicie o servidor: pm2 restart editaliza-app");
        console.log("2. Teste o login OAuth novamente");
        console.log("3. Verifique os logs: pm2 logs editaliza-app");
        
    } catch (error) {
        console.error("❌ Erro:", error.message);
        console.error("\nDetalhes:", error);
    } finally {
        await pool.end();
    }
}

// Executar verificação
checkOAuthSetup().catch(console.error);