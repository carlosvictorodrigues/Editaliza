#!/usr/bin/env node
/**
 * TESTE SIMPLES - Repository Integration
 * Testa se os repositories funcionam com o database PostgreSQL real
 */

console.log('🧪 TESTANDO REPOSITORIES COM POSTGRESQL REAL...');

async function testRepositories() {
    try {
        // Carregar database real
        const db = require('../database-postgresql.js');
        const { createRepositories } = require('../src/repositories');
        
        // Aguardar inicialização do banco
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('1️⃣ Criando repositories...');
        const repos = createRepositories(db);
        console.log('✅ Repositories criados:', Object.keys(repos));
        
        console.log('\n2️⃣ Testando método findByUserId...');
        
        // Teste com user_id que não existe (para não afetar dados reais)
        const testUserId = 999999;
        const plans = await repos.plan.findByUserId(testUserId);
        console.log(`✅ Repository funcionou! Retornou ${plans.length} planos para user ${testUserId}`);
        
        console.log('\n🎉 TESTE PASSOU! Repositories estão funcionando com PostgreSQL');
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

testRepositories();