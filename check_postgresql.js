/**
 * Script para verificar o estado do PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

// Configuração do pool
const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function checkDatabase() {
    console.log('🔍 Verificando PostgreSQL...\n');
    console.log('📋 Configuração:');
    console.log(`   Host: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`   Port: ${process.env.DB_PORT || 5432}`);
    console.log(`   Database: ${process.env.DB_NAME || 'editaliza_db'}`);
    console.log(`   User: ${process.env.DB_USER || 'editaliza_user'}`);
    console.log('');

    let client;
    try {
        // 1. Testar conexão
        console.log('1️⃣ Testando conexão...');
        client = await pool.connect();
        console.log('✅ Conexão estabelecida com sucesso!\n');

        // 2. Verificar versão do PostgreSQL
        console.log('2️⃣ Versão do PostgreSQL:');
        const versionResult = await client.query('SELECT version()');
        console.log('   ' + versionResult.rows[0].version + '\n');

        // 3. Listar todas as tabelas
        console.log('3️⃣ Tabelas existentes:');
        const tablesResult = await client.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        const tables = tablesResult.rows.map(row => row.tablename);
        console.log('   Total de tabelas: ' + tables.length);
        tables.forEach(table => {
            console.log('   ✓ ' + table);
        });
        console.log('');

        // 4. Verificar tabelas essenciais
        console.log('4️⃣ Verificando tabelas essenciais:');
        const essentialTables = [
            'users',
            'study_plans',
            'study_sessions',
            'subjects',
            'topics',
            'user_achievements',
            'gamification_stats',
            'study_time_logs',
            'sessions'
        ];

        for (const table of essentialTables) {
            const exists = tables.includes(table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}`);
            
            if (exists) {
                // Contar registros
                try {
                    const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
                    console.log(`      → ${countResult.rows[0].count} registros`);
                } catch (err) {
                    console.log(`      → Erro ao contar: ${err.message}`);
                }
            }
        }
        console.log('');

        // 5. Verificar estrutura da tabela study_sessions
        console.log('5️⃣ Estrutura da tabela study_sessions:');
        const columnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'study_sessions'
            ORDER BY ordinal_position
        `);
        
        if (columnsResult.rows.length > 0) {
            columnsResult.rows.forEach(col => {
                console.log(`   • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('   ❌ Tabela study_sessions não encontrada!');
        }
        console.log('');

        // 6. Verificar estrutura da tabela users
        console.log('6️⃣ Estrutura da tabela users:');
        const userColumnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        if (userColumnsResult.rows.length > 0) {
            userColumnsResult.rows.forEach(col => {
                console.log(`   • ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('   ❌ Tabela users não encontrada!');
        }
        console.log('');

        // 7. Testar uma query simples
        console.log('7️⃣ Testando queries:');
        try {
            const testResult = await client.query('SELECT COUNT(*) FROM users');
            console.log(`   ✅ Query de teste bem-sucedida (${testResult.rows[0].count} usuários)`);
        } catch (err) {
            console.log(`   ❌ Erro na query de teste: ${err.message}`);
        }

        // 8. Verificar configuração do database.js
        console.log('\n8️⃣ Verificando configuração do database.js:');
        const database = require('./src/config/database');
        console.log(`   ✅ Módulo database carregado`);
        console.log(`   Funções disponíveis: ${Object.keys(database).join(', ')}`);

    } catch (error) {
        console.error('❌ Erro ao conectar ao PostgreSQL:');
        console.error('   Mensagem:', error.message);
        console.error('   Código:', error.code);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️  PostgreSQL não está rodando ou não está acessível!');
            console.error('   Verifique se o serviço está ativo:');
            console.error('   Windows: services.msc → PostgreSQL');
            console.error('   Linux: sudo systemctl status postgresql');
        } else if (error.code === '28P01') {
            console.error('\n⚠️  Erro de autenticação!');
            console.error('   Verifique usuário e senha no .env');
        } else if (error.code === '3D000') {
            console.error('\n⚠️  Banco de dados não existe!');
            console.error('   Crie o banco: CREATE DATABASE editaliza_db;');
        }
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        console.log('\n✨ Verificação concluída!');
    }
}

// Executar verificação
checkDatabase().catch(console.error);