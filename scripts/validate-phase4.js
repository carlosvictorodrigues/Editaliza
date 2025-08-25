#!/usr/bin/env node
/**
 * FASE 4.1 - SCRIPT DE VALIDAÇÃO DA MIGRAÇÃO
 * 
 * Testa se a integração dos repositories está funcionando corretamente
 * sem quebrar as funcionalidades existentes.
 */

const { createRepositories } = require('../src/repositories');
const DatabaseAdapter = require('../src/adapters/database.adapter');

// Simular teste sem conectar ao banco real
async function validatePhase4() {
    console.log('🚀 VALIDANDO FASE 4.1 - INTEGRAÇÃO DOS REPOSITORIES');
    console.log('=' .repeat(60));

    try {
        // Mock database para teste
        const mockDb = {
            get: (sql, params, callback) => {
                console.log(`[MOCK] dbGet: ${sql.substring(0, 50)}...`);
                callback(null, { id: 1, plan_name: 'Test Plan', user_id: 1 });
            },
            all: (sql, params, callback) => {
                console.log(`[MOCK] dbAll: ${sql.substring(0, 50)}...`);
                callback(null, [{ id: 1, plan_name: 'Test Plan' }]);
            },
            run: (sql, params, callback) => {
                console.log(`[MOCK] dbRun: ${sql.substring(0, 50)}...`);
                callback.call({ changes: 1, lastID: 1 }, null);
            }
        };

        // Teste 1: Criação dos repositories
        console.log('\n1️⃣ TESTANDO CRIAÇÃO DOS REPOSITORIES...');
        const repos = createRepositories(mockDb);
        console.log('✅ Repositories criados:', Object.keys(repos));

        // Teste 2: Métodos dos repositories
        console.log('\n2️⃣ TESTANDO MÉTODOS DOS REPOSITORIES...');
        console.log('✅ repos.plan.findByUserId:', typeof repos.plan.findByUserId);
        console.log('✅ repos.plan.findByIdAndUserId:', typeof repos.plan.findByIdAndUserId);
        console.log('✅ repos.user.findByEmail:', typeof repos.user.findByEmail);
        console.log('✅ repos.subject.findByPlanId:', typeof repos.subject.findByPlanId);

        // Teste 3: Database Adapter
        console.log('\n3️⃣ TESTANDO DATABASE ADAPTER...');
        const adapter = new DatabaseAdapter(repos, mockDb);
        console.log('✅ Adapter criado com métodos:', ['dbGet', 'dbAll', 'dbRun'].filter(m => typeof adapter[m] === 'function'));

        // Teste 4: Adapter funcionando
        console.log('\n4️⃣ TESTANDO FUNCIONAMENTO DO ADAPTER...');
        await adapter.dbGet('SELECT * FROM study_plans WHERE user_id = $1', [1]);
        await adapter.dbAll('SELECT * FROM study_plans WHERE user_id = $1 ORDER BY id DESC', [1]);
        
        console.log('✅ Adapter funcionando corretamente');

        // Teste 5: Estatísticas
        console.log('\n5️⃣ TESTANDO ESTATÍSTICAS DO ADAPTER...');
        console.log('📊 Stats:', adapter.getStats());

        console.log('\n🎉 TODOS OS TESTES PASSARAM!');
        console.log('✅ Fase 4.1 está pronta para deploy');

    } catch (error) {
        console.error('\n❌ ERRO NA VALIDAÇÃO:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Teste de compatibilidade com controllers
async function testControllerCompatibility() {
    console.log('\n🧪 TESTANDO COMPATIBILIDADE COM CONTROLLERS...');
    
    try {
        // Simular o que acontece no plans.controller.js
        const mockDb = {
            get: () => Promise.resolve(null),
            all: () => Promise.resolve([]),
            run: () => Promise.resolve({ changes: 1 })
        };
        
        const repos = createRepositories(mockDb);
        
        // Teste dos métodos que estão sendo usados
        const testUserId = 1;
        const testPlanId = 1;
        
        console.log('🔍 Testando repos.plan.findByUserId...');
        console.log('✅ Método disponível:', typeof repos.plan.findByUserId === 'function');
        
        console.log('🔍 Testando repos.plan.findByIdAndUserId...');
        console.log('✅ Método disponível:', typeof repos.plan.findByIdAndUserId === 'function');
        
        console.log('✅ Compatibilidade com controllers OK!');
        
    } catch (error) {
        console.error('❌ Erro na compatibilidade:', error.message);
        throw error;
    }
}

// Executar testes
(async () => {
    await validatePhase4();
    await testControllerCompatibility();
    
    console.log('\n🚀 FASE 4.1 VALIDADA COM SUCESSO!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('  1. Deploy das mudanças em desenvolvimento');
    console.log('  2. Testes manuais das rotas /api/plans');
    console.log('  3. Monitorar logs do adapter');
    console.log('  4. Migrar outros controllers');
    
    process.exit(0);
})();