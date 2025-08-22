#!/usr/bin/env node

/**
 * Script para verificar todos os usuários cadastrados no banco
 */

require('dotenv').config();
const { Client } = require('pg');

async function checkDatabaseUsers() {
    console.log('🔍 VERIFICANDO USUÁRIOS NO BANCO DE DADOS');
    console.log('=' .repeat(60));
    
    try {
        const client = new Client({
            connectionString: process.env.DATABASE_URL
        });
        
        await client.connect();
        console.log('✅ Conectado ao PostgreSQL');
        
        // Verificar se a tabela users existe
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
        `);
        
        if (tablesResult.rows.length === 0) {
            console.log('❌ Tabela "users" não encontrada');
            
            // Listar todas as tabelas
            const allTables = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            console.log('\n📋 Tabelas disponíveis:');
            allTables.rows.forEach(table => console.log(`   - ${table.table_name}`));
            
            await client.end();
            return;
        }
        
        // Contar total de usuários
        const countResult = await client.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(countResult.rows[0].count);
        console.log(`👥 Total de usuários: ${totalUsers}`);
        
        if (totalUsers > 0) {
            // Buscar todos os usuários
            const usersResult = await client.query(`
                SELECT 
                    id, 
                    email, 
                    name, 
                    provider,
                    created_at,
                    CASE 
                        WHEN password_hash IS NOT NULL THEN 'COM SENHA'
                        ELSE 'SEM SENHA'
                    END as has_password
                FROM users 
                ORDER BY created_at DESC
                LIMIT 20
            `);
            
            console.log('\n📋 USUÁRIOS CADASTRADOS (últimos 20):');
            console.log('-'.repeat(100));
            console.log('ID'.padEnd(6) + 'EMAIL'.padEnd(35) + 'NOME'.padEnd(20) + 'PROVIDER'.padEnd(10) + 'SENHA'.padEnd(10) + 'CRIADO');
            console.log('-'.repeat(100));
            
            usersResult.rows.forEach(user => {
                const id = user.id.toString().padEnd(6);
                const email = (user.email || 'N/A').substring(0, 34).padEnd(35);
                const name = (user.name || 'N/A').substring(0, 19).padEnd(20);
                const provider = (user.provider || 'local').padEnd(10);
                const password = user.has_password.padEnd(10);
                const created = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A';
                
                console.log(`${id}${email}${name}${provider}${password}${created}`);
            });
            
            // Estatísticas por provider
            const providerResult = await client.query(`
                SELECT 
                    COALESCE(provider, 'local') as provider, 
                    COUNT(*) as count 
                FROM users 
                GROUP BY provider
                ORDER BY count DESC
            `);
            
            console.log('\n📊 ESTATÍSTICAS POR PROVIDER:');
            providerResult.rows.forEach(stat => {
                console.log(`   ${stat.provider}: ${stat.count} usuários`);
            });
            
            // Verificar usuários recentes (últimos 7 dias)
            const recentResult = await client.query(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);
            
            console.log(`\n📅 Usuários cadastrados nos últimos 7 dias: ${recentResult.rows[0].count}`);
            
            // Verificar se há tabelas de planos/assinaturas
            const plansTablesResult = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND (table_name LIKE '%plan%' OR table_name LIKE '%subscription%')
            `);
            
            if (plansTablesResult.rows.length > 0) {
                console.log('\n📋 TABELAS DE PLANOS/ASSINATURAS ENCONTRADAS:');
                for (const table of plansTablesResult.rows) {
                    try {
                        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
                        console.log(`   ${table.table_name}: ${countResult.rows[0].count} registros`);
                    } catch (error) {
                        console.log(`   ${table.table_name}: erro ao contar (${error.message})`);
                    }
                }
            }
            
            // Verificar se há dados do CACKTO
            try {
                const cacktoTablesResult = await client.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name LIKE '%cackto%'
                `);
                
                if (cacktoTablesResult.rows.length > 0) {
                    console.log('\n📦 TABELAS CACKTO ENCONTRADAS:');
                    for (const table of cacktoTablesResult.rows) {
                        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
                        console.log(`   ${table.table_name}: ${countResult.rows[0].count} registros`);
                    }
                }
            } catch (error) {
                console.log('ℹ️  Nenhuma tabela CACKTO encontrada');
            }
        } else {
            console.log('\n📭 Nenhum usuário encontrado no banco de dados');
        }
        
        await client.end();
        
    } catch (error) {
        console.error('❌ Erro ao acessar banco PostgreSQL:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 DICAS PARA RESOLVER:');
            console.log('   1. Verifique se o PostgreSQL está rodando');
            console.log('   2. Verifique as configurações no .env');
            console.log('   3. Teste: npm run db:test-connection');
        }
    }
}

checkDatabaseUsers();