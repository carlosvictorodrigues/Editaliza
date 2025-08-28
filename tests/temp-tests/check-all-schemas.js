// Script para verificar todas as tabelas em todos os schemas
const { Client } = require('pg');
require('dotenv').config();

async function checkAllSchemas() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL\n');
        
        // 1. Verificar schemas
        console.log('📊 SCHEMAS DISPONÍVEIS:');
        const schemas = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
        `);
        
        schemas.rows.forEach(row => {
            console.log(`   - ${row.schema_name}`);
        });
        
        // 2. Verificar search_path
        console.log('\n🔍 SEARCH PATH ATUAL:');
        const searchPath = await client.query('SHOW search_path');
        console.log(`   ${searchPath.rows[0].search_path}`);
        
        // 3. Buscar todas as tabelas em todos os schemas
        console.log('\n📋 TODAS AS TABELAS (por schema):');
        const allTables = await client.query(`
            SELECT 
                schemaname, 
                tablename 
            FROM pg_tables 
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schemaname, tablename
        `);
        
        let currentSchema = '';
        allTables.rows.forEach(row => {
            if (row.schemaname !== currentSchema) {
                currentSchema = row.schemaname;
                console.log(`\n[${currentSchema}]`);
            }
            console.log(`   - ${row.tablename}`);
        });
        
        // 4. Verificar especificamente as tabelas que criamos
        console.log('\n🔎 VERIFICANDO TABELAS ESPECÍFICAS:');
        const tablesToCheck = [
            'user_gamification_stats',
            'user_achievements',
            'oauth_providers',
            'schedules',
            'plans',
            'tasks',
            'progress'
        ];
        
        for (const tableName of tablesToCheck) {
            const result = await client.query(`
                SELECT 
                    schemaname,
                    tablename,
                    tableowner
                FROM pg_tables 
                WHERE tablename = $1
            `, [tableName]);
            
            if (result.rows.length > 0) {
                const table = result.rows[0];
                console.log(`✅ ${tableName} existe em: ${table.schemaname} (owner: ${table.tableowner})`);
            } else {
                console.log(`❌ ${tableName} não encontrada`);
            }
        }
        
        // 5. Tentar criar uma tabela explicitamente no schema public
        console.log('\n🔧 TESTE: Criando tabela explicitamente no schema public...');
        try {
            await client.query(`
                CREATE TABLE public.test_explicit (
                    id SERIAL PRIMARY KEY
                )
            `);
            console.log('✅ Tabela public.test_explicit criada');
            
            // Verificar
            const check = await client.query(`
                SELECT schemaname, tablename 
                FROM pg_tables 
                WHERE tablename = 'test_explicit'
            `);
            
            if (check.rows.length > 0) {
                console.log(`   Encontrada em: ${check.rows[0].schemaname}`);
            }
            
            // Limpar
            await client.query('DROP TABLE IF EXISTS public.test_explicit');
            console.log('   Tabela de teste removida');
            
        } catch (err) {
            console.error('❌ Erro ao criar tabela de teste:', err.message);
        }
        
        // 6. Verificar permissões no schema public
        console.log('\n🔐 PERMISSÕES NO SCHEMA PUBLIC:');
        const permissions = await client.query(`
            SELECT 
                grantee,
                privilege_type 
            FROM information_schema.schema_privileges 
            WHERE schema_name = 'public' 
            AND grantee = current_user
        `);
        
        if (permissions.rows.length > 0) {
            permissions.rows.forEach(row => {
                console.log(`   ${row.grantee}: ${row.privilege_type}`);
            });
        } else {
            console.log('   Nenhuma permissão específica encontrada');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

checkAllSchemas();