// Script para verificar configuração completa do PostgreSQL
const { Client } = require('pg');
require('dotenv').config();

async function verifyPostgresSetup() {
    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'editaliza_db',
        user: process.env.DB_USER || 'editaliza_user',
        password: process.env.DB_PASSWORD || '1a2b3c4d'
    });
    
    try {
        console.log('🔧 Verificando configuração do PostgreSQL...\n');
        await client.connect();
        console.log('✅ Conexão estabelecida\n');
        
        // 1. Listar todas as tabelas
        console.log('📋 TABELAS EXISTENTES:');
        console.log('=' . repeat(50));
        
        const tables = await client.query(`
            SELECT tablename, 
                   (SELECT COUNT(*) 
                    FROM information_schema.columns 
                    WHERE table_name = tablename 
                    AND table_schema = 'public') as column_count
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        for (const table of tables.rows) {
            console.log(`✅ ${table.tablename.padEnd(30)} (${table.column_count} colunas)`);
        }
        console.log(`\nTotal: ${tables.rows.length} tabelas\n`);
        
        // 2. Verificar tabelas essenciais
        console.log('🔍 VERIFICANDO TABELAS ESSENCIAIS:');
        console.log('=' . repeat(50));
        
        const essentialTables = [
            'users',
            'study_plans',
            'subjects',
            'topics',
            'study_sessions',
            'sessions',
            'user_gamification_stats',
            'user_achievements'
        ];
        
        for (const tableName of essentialTables) {
            const exists = tables.rows.some(t => t.tablename === tableName);
            if (exists) {
                // Verificar contagem de registros
                const count = await client.query(
                    `SELECT COUNT(*) as count FROM ${tableName}`
                );
                console.log(`✅ ${tableName.padEnd(25)} - ${count.rows[0].count} registros`);
            } else {
                console.log(`❌ ${tableName.padEnd(25)} - NÃO EXISTE`);
            }
        }
        
        // 3. Verificar colunas críticas
        console.log('\n🔍 VERIFICANDO COLUNAS CRÍTICAS:');
        console.log('=' . repeat(50));
        
        const criticalColumns = [
            { table: 'users', column: 'password_hash' },
            { table: 'users', column: 'email' },
            { table: 'study_plans', column: 'user_id' },
            { table: 'subjects', column: 'study_plan_id' },
            { table: 'topics', column: 'subject_id' },
            { table: 'study_sessions', column: 'study_plan_id' }
        ];
        
        for (const check of criticalColumns) {
            const result = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1 AND column_name = $2
                AND table_schema = 'public'
            `, [check.table, check.column]);
            
            if (result.rows.length > 0) {
                const col = result.rows[0];
                console.log(`✅ ${check.table}.${check.column} - ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            } else {
                console.log(`❌ ${check.table}.${check.column} - NÃO EXISTE`);
            }
        }
        
        // 4. Verificar foreign keys
        console.log('\n🔗 VERIFICANDO FOREIGN KEYS:');
        console.log('=' . repeat(50));
        
        const foreignKeys = await client.query(`
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
            ORDER BY tc.table_name
        `);
        
        if (foreignKeys.rows.length > 0) {
            for (const fk of foreignKeys.rows) {
                console.log(`✅ ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
            }
        } else {
            console.log('⚠️  Nenhuma foreign key encontrada');
        }
        
        // 5. Verificar índices
        console.log('\n📊 VERIFICANDO ÍNDICES:');
        console.log('=' . repeat(50));
        
        const indexes = await client.query(`
            SELECT 
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname
        `);
        
        if (indexes.rows.length > 0) {
            for (const idx of indexes.rows) {
                console.log(`✅ ${idx.tablename}.${idx.indexname}`);
            }
        } else {
            console.log('⚠️  Nenhum índice adicional encontrado');
        }
        
        // 6. Testar operações básicas
        console.log('\n🧪 TESTANDO OPERAÇÕES BÁSICAS:');
        console.log('=' . repeat(50));
        
        // Testar SELECT
        try {
            await client.query('SELECT * FROM users LIMIT 1');
            console.log('✅ SELECT em users funcionando');
        } catch (err) {
            console.log('❌ SELECT em users falhou:', err.message);
        }
        
        // Testar transação
        try {
            await client.query('BEGIN');
            await client.query('ROLLBACK');
            console.log('✅ Transações funcionando');
        } catch (err) {
            console.log('❌ Transações falharam:', err.message);
        }
        
        // 7. Resumo final
        console.log('\n📈 RESUMO:');
        console.log('=' . repeat(50));
        console.log(`✅ PostgreSQL versão: ${(await client.query('SELECT version()')).rows[0].version.split(' ')[1]}`);
        console.log(`✅ Banco de dados: ${process.env.DB_NAME || 'editaliza_db'}`);
        console.log(`✅ Total de tabelas: ${tables.rows.length}`);
        console.log(`✅ Foreign keys: ${foreignKeys.rows.length}`);
        console.log(`✅ Índices adicionais: ${indexes.rows.length}`);
        
        // Verificar se tem usuário de teste
        const testUser = await client.query(
            "SELECT id, email FROM users WHERE email = 'c@c.com'"
        );
        
        if (testUser.rows.length > 0) {
            console.log(`✅ Usuário de teste existe: c@c.com (ID: ${testUser.rows[0].id})`);
        }
        
        console.log('\n✨ PostgreSQL está configurado e pronto para uso!');
        console.log('\n💡 Próximos passos:');
        console.log('1. Reinicie o servidor: npm start');
        console.log('2. Teste o login com: c@c.com / 123456');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.log('\n💡 Solução:');
        console.log('1. Verifique se o PostgreSQL está rodando');
        console.log('2. Execute: node check-postgres-tables.js');
        console.log('3. Verifique as credenciais no arquivo .env');
    } finally {
        await client.end();
    }
}

verifyPostgresSetup();