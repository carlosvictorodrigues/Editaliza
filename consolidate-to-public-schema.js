// Script para consolidar todas as tabelas no schema PUBLIC
const { Client } = require('pg');
require('dotenv').config();

async function consolidateToPublicSchema() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        await client.connect();
        void('✅ Conectado ao PostgreSQL\n');
        void('🎯 OBJETIVO: Consolidar todas as tabelas no schema PUBLIC');
        void('=' . repeat(60) + '\n');
        
        // 1. Primeiro, configurar search_path para usar APENAS public
        void('1️⃣ Configurando search_path para usar APENAS public...');
        await client.query(`ALTER USER editaliza_user SET search_path = public`);
        void('✅ Search_path configurado\n');
        
        // 2. Listar tabelas em cada schema
        void('2️⃣ Analisando situação atual...\n');
        
        const appTables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'app'
            ORDER BY tablename
        `);
        
        const publicTables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        void(`📊 Schema APP: ${appTables.rows.length} tabelas`);
        void(`📊 Schema PUBLIC: ${publicTables.rows.length} tabelas\n`);
        
        // 3. Mover tabelas do schema app para public
        if (appTables.rows.length > 0) {
            void('3️⃣ Movendo tabelas do schema APP para PUBLIC...\n');
            
            for (const row of appTables.rows) {
                const tableName = row.tablename;
                
                // Verificar se já existe em public
                const existsInPublic = publicTables.rows.some(t => t.tablename === tableName);
                
                if (!existsInPublic) {
                    try {
                        // Mover tabela
                        await client.query(`ALTER TABLE app."${tableName}" SET SCHEMA public`);
                        void(`✅ Movida: ${tableName}`);
                    } catch (err) {
                        void(`⚠️  Erro ao mover ${tableName}: ${err.message}`);
                    }
                } else {
                    void(`⚠️  ${tableName} já existe em public`);
                    
                    // Verificar se as tabelas são diferentes
                    const appCount = await client.query(
                        `SELECT COUNT(*) as count FROM app."${tableName}"`
                    );
                    const publicCount = await client.query(
                        `SELECT COUNT(*) as count FROM public."${tableName}"`
                    );
                    
                    if (appCount.rows[0].count > 0 && publicCount.rows[0].count === 0) {
                        void(`   📝 Tabela em app tem ${appCount.rows[0].count} registros`);
                        void("📝 Tabela em public está vazia");
                        void("🔄 Copiando dados de app para public...");
                        
                        try {
                            // Copiar dados
                            await client.query(`
                                INSERT INTO public."${tableName}"
                                SELECT * FROM app."${tableName}"
                                ON CONFLICT DO NOTHING
                            `);
                            void("✅ Dados copiados");
                            
                            // Remover tabela do schema app
                            await client.query(`DROP TABLE IF EXISTS app."${tableName}"`);
                            void("✅ Tabela removida do schema app");
                        } catch (err) {
                            void(`   ❌ Erro ao copiar dados: ${err.message}`);
                        }
                    } else if (appCount.rows[0].count === 0) {
                        // Se a tabela em app está vazia, podemos removê-la
                        try {
                            await client.query(`DROP TABLE IF EXISTS app."${tableName}"`);
                            void("✅ Tabela vazia removida do schema app");
                        } catch (err) {
                            void(`   ❌ Erro ao remover tabela: ${err.message}`);
                        }
                    }
                }
            }
        }
        
        // 4. Verificar se o schema app está vazio
        void('\n4️⃣ Verificando schema APP...');
        const remainingApp = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'app'
        `);
        
        if (remainingApp.rows.length === 0) {
            void('✅ Schema APP está vazio\n');
            
            // Opcional: remover o schema app
            void('5️⃣ Removendo schema APP desnecessário...');
            try {
                await client.query(`DROP SCHEMA IF EXISTS app CASCADE`);
                void('✅ Schema APP removido\n');
            } catch (err) {
                void(`⚠️  Não foi possível remover schema app: ${err.message}\n`);
            }
        } else {
            void(`⚠️  Schema APP ainda tem ${remainingApp.rows.length} tabelas\n`);
        }
        
        // 5. Listar resultado final
        void('📊 RESULTADO FINAL:');
        void('=' . repeat(60));
        
        const finalTables = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        void('\nTabelas no schema PUBLIC:');
        let count = 1;
        finalTables.rows.forEach(row => {
            void(`   ${count.toString().padStart(2, '0')}. ${row.tablename}`);
            count++;
        });
        void(`\n✅ Total: ${finalTables.rows.length} tabelas consolidadas no schema PUBLIC`);
        
        // 6. Verificar search_path final
        const searchPath = await client.query('SHOW search_path');
        void(`\n🔍 Search path configurado: ${searchPath.rows[0].search_path}`);
        
        void('\n✨ CONSOLIDAÇÃO CONCLUÍDA COM SUCESSO!');
        void('\n💡 Próximos passos:');
        void('1. Reinicie o servidor: npm start');
        void('2. Teste o login com: c@c.com / 123456');
        void('3. Todas as operações agora usarão o schema PUBLIC');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error.stack);
    } finally {
        await client.end();
    }
}

consolidateToPublicSchema();