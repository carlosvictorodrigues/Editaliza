/**
 * VERIFICAR SCHEMA DO BANCO
 * Script para verificar a estrutura das tabelas
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || '1a2b3c4d',
});

async function checkSchema() {
    console.log('🔍 Verificando schema do banco...\n');
    
    try {
        // Verificar tabelas existentes
        const tablesResult = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' OR schemaname = 'app'
            ORDER BY tablename
        `);
        
        console.log('📋 TABELAS EXISTENTES:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.tablename}`);
        });
        
        // Verificar estrutura da tabela users
        console.log('\n🔍 ESTRUTURA DA TABELA USERS:');
        const usersColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        usersColumns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        // Verificar estrutura da tabela study_plans
        console.log('\n🔍 ESTRUTURA DA TABELA STUDY_PLANS:');
        const plansColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'study_plans'
            ORDER BY ordinal_position
        `);
        
        if (plansColumns.rows.length === 0) {
            console.log('  ⚠️ Tabela study_plans não encontrada');
        } else {
            plansColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
        
        // Verificar estrutura da tabela study_sessions
        console.log('\n🔍 ESTRUTURA DA TABELA STUDY_SESSIONS:');
        const sessionsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'study_sessions'
            ORDER BY ordinal_position
        `);
        
        if (sessionsColumns.rows.length === 0) {
            console.log('  ⚠️ Tabela study_sessions não encontrada');
        } else {
            sessionsColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
        
        // Verificar estrutura da tabela topics
        console.log('\n🔍 ESTRUTURA DA TABELA TOPICS:');
        const topicsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'topics'
            ORDER BY ordinal_position
        `);
        
        if (topicsColumns.rows.length === 0) {
            console.log('  ⚠️ Tabela topics não encontrada');
        } else {
            topicsColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
        
        // Verificar estrutura da tabela subjects
        console.log('\n🔍 ESTRUTURA DA TABELA SUBJECTS:');
        const subjectsColumns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'subjects'
            ORDER BY ordinal_position
        `);
        
        if (subjectsColumns.rows.length === 0) {
            console.log('  ⚠️ Tabela subjects não encontrada');
        } else {
            subjectsColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }
        
        // Verificar dados existentes
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');
        console.log("\n📊 DADOS EXISTENTES:");
        console.log(`  - Usuários: ${usersCount.rows[0].count}`);
        
        if (plansColumns.rows.length > 0) {
            const plansCount = await pool.query('SELECT COUNT(*) FROM study_plans');
            console.log(`  - Planos de estudo: ${plansCount.rows[0].count}`);
        }
        
        if (sessionsColumns.rows.length > 0) {
            const sessionsCount = await pool.query('SELECT COUNT(*) FROM study_sessions');
            console.log(`  - Sessões de estudo: ${sessionsCount.rows[0].count}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar schema:', error.message);
    } finally {
        await pool.end();
    }
}

// Executar
checkSchema().catch(console.error);