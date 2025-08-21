#!/usr/bin/env node

/**
 * Script de Health Check completo
 * Verifica todos os componentes críticos do sistema
 */

const fetch = require('node-fetch');
const { Client } = require('pg');

const PROD_URL = 'https://app.editaliza.com.br';
const LOCAL_URL = 'http://localhost:3000';

// Usar URL de produção se não estiver em localhost
const BASE_URL = process.env.NODE_ENV === 'production' ? PROD_URL : LOCAL_URL;

// Configuração do banco
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'editaliza_db',
    user: process.env.DB_USER || 'editaliza_user',
    password: process.env.DB_PASSWORD || 'Editaliza@2025#Secure'
};

const checks = {
    server: false,
    database: false,
    sessions: false,
    auth: false,
    criticalTables: []
};

async function checkServer() {
    console.log('\n🔍 Verificando servidor...');
    try {
        const response = await fetch(`${BASE_URL}/health`);
        if (response.status === 200) {
            checks.server = true;
            console.log('✅ Servidor respondendo');
            return true;
        }
    } catch (error) {
        console.error('❌ Servidor não está respondendo:', error.message);
    }
    return false;
}

async function checkDatabase() {
    console.log('\n🔍 Verificando banco de dados...');
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        
        // Testar conexão
        const result = await client.query('SELECT NOW()');
        checks.database = true;
        console.log('✅ Conexão com banco OK');
        
        // Verificar tabelas críticas
        const criticalTables = [
            'users',
            'study_plans',
            'sessions',
            'login_attempts',
            'subjects',
            'topics',
            'study_sessions'
        ];
        
        console.log('\n📋 Verificando tabelas críticas:');
        for (const table of criticalTables) {
            const tableCheck = await client.query(`
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_name = $1
            `, [table]);
            
            if (tableCheck.rows[0].count === '1') {
                checks.criticalTables.push(table);
                console.log(`   ✅ ${table}`);
            } else {
                console.log(`   ❌ ${table} - NÃO EXISTE!`);
            }
        }
        
        // Verificar tabela sessions específicamente
        const sessionCheck = await client.query(`
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = 'sessions'
        `);
        
        if (sessionCheck.rows[0].count === '1') {
            checks.sessions = true;
            
            // Limpar sessões expiradas
            const deleted = await client.query(`
                DELETE FROM sessions 
                WHERE expire < NOW() 
                RETURNING sid
            `);
            
            if (deleted.rowCount > 0) {
                console.log(`\n🧹 ${deleted.rowCount} sessões expiradas removidas`);
            }
        }
        
        await client.end();
        return true;
        
    } catch (error) {
        console.error('❌ Erro no banco de dados:', error.message);
        await client.end();
        return false;
    }
}

async function checkAuth() {
    console.log('\n🔍 Testando autenticação...');
    try {
        // Tentar login com usuário de teste
        const loginResponse = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'teste@teste.com',
                password: '123456'
            })
        });
        
        if (loginResponse.status === 200) {
            const data = await loginResponse.json();
            if (data.token) {
                checks.auth = true;
                console.log('✅ Sistema de autenticação OK');
                
                // Testar endpoint protegido
                const profileResponse = await fetch(`${BASE_URL}/profile`, {
                    headers: { 'Authorization': `Bearer ${data.token}` }
                });
                
                if (profileResponse.status === 200) {
                    console.log('✅ Endpoints protegidos OK');
                }
            }
        } else if (loginResponse.status === 401) {
            console.log('⚠️  Usuário de teste não existe ou senha incorreta');
        }
    } catch (error) {
        console.error('❌ Erro na autenticação:', error.message);
    }
}

async function generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE SAÚDE DO SISTEMA');
    console.log('='.repeat(60));
    
    const totalChecks = 4;
    const passedChecks = [
        checks.server,
        checks.database,
        checks.sessions,
        checks.auth
    ].filter(Boolean).length;
    
    const healthScore = Math.round((passedChecks / totalChecks) * 100);
    
    console.log(`\n🏥 Health Score: ${healthScore}%`);
    
    if (healthScore === 100) {
        console.log('✅ Sistema 100% saudável!');
    } else if (healthScore >= 75) {
        console.log('⚠️  Sistema funcional mas com alguns problemas');
    } else if (healthScore >= 50) {
        console.log('⚠️  Sistema com problemas significativos');
    } else {
        console.log('🚨 Sistema crítico - necessita atenção imediata!');
    }
    
    console.log('\n📋 Detalhes:');
    console.log(`   Servidor: ${checks.server ? '✅' : '❌'}`);
    console.log(`   Banco de dados: ${checks.database ? '✅' : '❌'}`);
    console.log(`   Tabela sessions: ${checks.sessions ? '✅' : '❌'}`);
    console.log(`   Autenticação: ${checks.auth ? '✅' : '❌'}`);
    console.log(`   Tabelas críticas: ${checks.criticalTables.length}/7`);
    
    // Recomendações
    if (!checks.sessions) {
        console.log('\n⚠️  AÇÃO NECESSÁRIA:');
        console.log('   Execute: node scripts/init-database.js');
    }
    
    return healthScore;
}

async function runHealthCheck() {
    console.log('🏥 HEALTH CHECK - EDITALIZA');
    console.log('Ambiente:', process.env.NODE_ENV || 'development');
    console.log('URL:', BASE_URL);
    
    await checkServer();
    await checkDatabase();
    await checkAuth();
    
    const score = await generateReport();
    
    // Exit code baseado no score
    if (score < 50) {
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runHealthCheck();
}

module.exports = { runHealthCheck };